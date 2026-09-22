/* Dhan Option Chain Terminal — client.
   Talks only to the local backend. Never sees a Dhan credential. */

import * as tools from '/chart-tools.js';
// P19. Both are leaves (chart-style imports only ucandles), so there is no cycle back into here.
import * as uc from '/ucandles.js';
import * as cstyle from '/chart-style.js';

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------ P26 popup mode
   docs/spec/panel-windows-v1.md rows 2 and 3. A popped-out panel is THIS page with one query
   parameter, not a second HTML file — a new file under public/ is invisible until it has a row
   in the server's STATIC allow-list, and that failure looks like the whole client dying.
   The class goes on before anything paints, so the popup never flashes the full terminal. */

export const POP_Q = new URLSearchParams(location.search);
export const POP_PANEL = ['chart', 'chain', 'opt'].includes(POP_Q.get('pop')) ? POP_Q.get('pop') : null;
if (POP_PANEL) document.body.classList.add('pop', `pop-${POP_PANEL}`);

/* ------------------------------------------------------------- formatting */
/* Locked in docs/spec/option-chain-v1.md row 13. */

const trimZeros = (s) => s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');

/** Indian abbreviation: <1e3 raw, <1e5 K, <1e7 L, >=1e7 Cr. */
export function abbr(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e7) return sign + trimZeros((a / 1e7).toFixed(2)) + ' Cr';
  if (a >= 1e5) return sign + trimZeros((a / 1e5).toFixed(2)) + ' L';
  if (a >= 1e3) return sign + trimZeros((a / 1e3).toFixed(2)) + ' K';
  return sign + trimZeros(a.toFixed(2));
}

function fx(v, d) {
  return (v === null || v === undefined || !Number.isFinite(v)) ? '—' : v.toFixed(d);
}

/** Indian digit grouping: 24,078.30 / 1,63,940.00 */
export function inr(v, d = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const parts = Math.abs(v).toFixed(d).split('.');
  let int = parts[0];
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  int = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return sign + int + (parts[1] !== undefined ? '.' + parts[1] : '');
}

function pctText(v) {
  return (v === null || v === undefined || !Number.isFinite(v)) ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}

const cls = (v) => (v === null || v === undefined || !Number.isFinite(v)) ? 'dim' : v > 0 ? 'up' : v < 0 ? 'down' : 'dim';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-08-28 -> "28 Aug". Only ever used for the peak-OI tooltip. */
function dayLabel(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`;
}

/** value with its percentage in a smaller tail: "-107.10 (-20.03%)" */
function signedPair(v, p, d) {
  if (v === null || !Number.isFinite(v)) return '<span class="dim">—</span>';
  const tail = (p === null || !Number.isFinite(p)) ? '—' : (p > 0 ? '+' : '') + p.toFixed(2) + '%';
  return `<span class="${cls(v)}">${v > 0 ? '+' : ''}${d === 'abbr' ? abbr(v) : v.toFixed(d)}<span class="sub">(${tail})</span></span>`;
}

/* ------------------------------------------------------------------ state */

const state = {
  instruments: [],
  current: null,
  expiry: null,
  snapshot: null,
  samples: [],
  log: [],
  es: null,
  lastReceivedAt: 0,
  cadenceMs: 3000,
  clientStages: { transport: null, render: null },
  prevLtp: new Map(),
  filter: '',
  // P7 peak OI
  breachOnly: false,
  peaks: {},
  peakDate: null,
  // tick feed
  ticks: [],                 // underlying: [{t, p}]
  chartRange: Number(localStorage.getItem('chartRange') ?? 300000),
  chartDirty: false,
  rowByStrike: new Map(),
  tickTimes: [],
  feed: { state: 'off' },
  // P19 underlying candles: the candle under the pointer (index into the drawn session), and the
  // last frame's view so the pointer can be turned back into a candle.
  ucHover: -1,
  ucView: null,
};

/* ------------------------------------------------------------------ chips */

async function loadInstruments() {
  const res = await fetch('/api/instruments');
  const body = await res.json();
  state.instruments = body.instruments;

  const replay = body.mode === 'replay';
  $('modeBadge').textContent = replay ? 'REPLAY' : 'LIVE';
  $('modeBadge').className = 'badge ' + (replay ? 'replay' : 'live');
  $('replayBar').hidden = !replay;
  // P16 row 5: the Scanner workspace starts below the 28px replay line when it is showing.
  document.body.classList.toggle('replay', replay);

  const wrap = $('chips');
  wrap.textContent = '';
  state.instruments.forEach((inst, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', 'false');
    b.disabled = !inst.resolved;
    if (!inst.resolved) b.title = inst.problems.join('; ');
    else b.title = `${inst.displayName} · ${inst.underlyingSeg} ${inst.underlyingScrip} · ${inst.session.window}`;
    b.innerHTML =
      `<i class="${inst.session.openNow ? 'open' : ''}"></i>${inst.label}<span class="kbd">${i + 1}</span>`;
    b.addEventListener('click', () => select(inst.id));
    wrap.appendChild(b);
  });

  // P26 row 2: a popped-out window carries its chip and expiry in the URL, because nothing
  // persists the current instrument — without this a popup always booted on NIFTY.
  const wanted = POP_Q.get('key');
  const first = (wanted && state.instruments.find(i => i.id === wanted && i.resolved))
    ?? state.instruments.find(i => i.resolved) ?? state.instruments[0];
  if (first) select(first.id, wanted === first.id ? (POP_Q.get('expiry') || undefined) : undefined);
}

function select(id, expiry) {
  const inst = state.instruments.find(i => i.id === id);
  if (!inst) return;
  state.current = inst;
  state.expiry = expiry ?? inst.nearestExpiry;
  state.snapshot = null;
  state.centred = false;
  state.peaks = {};
  state.peakDate = null;
  // The chip is per-instrument: leaving the old count up until the first snapshot of the new one
  // would attribute one chip's backfill to another chip's chain.
  $('peakChip').hidden = true;
  $('peakChip').textContent = '';
  state.prevLtp.clear();
  state.ticks = [];
  state.rowByStrike.clear();
  state.spotIdx = -1;
  // renderHeader(null) resets uSpot/uChg but these two are only ever written by paintSpot(), so
  // without this the previous instrument's price and day change sit under the NEW instrument's
  // label — "NIFTY BANK IDX" beside NIFTY 50's 24,099.50. It self-corrects on the first tick of
  // the new instrument, which on a closed market never arrives.
  $('chartPx').textContent = '—';
  $('chartChg').textContent = '—';
  $('chartChg').className = 'cchg mono tickonly dim';
  state.chartDirty = true;
  tools.setScope(inst.id, state.expiry);       // drawings never cross an instrument or an expiry
  state.ucHover = -1;
  tools.resetView();                           // chart-nav-v1.md row 14
  uc.setScope(inst.id, inst.label);            // underlying-candles-v1.md row 2

  [...$('chips').children].forEach((b, i) =>
    b.setAttribute('aria-pressed', String(state.instruments[i].id === id)));

  const sel = $('expiry');
  sel.textContent = '';
  for (const e of inst.expiries) {
    const o = document.createElement('option');
    o.value = e;
    o.textContent = e;
    if (e === state.expiry) o.selected = true;
    sel.appendChild(o);
  }

  // candles.js charts one contract of THIS instrument and expiry (option-candles-v1.md row 1).
  // A custom event rather than an import, so app.js depends on nothing downstream of it.
  document.dispatchEvent(new CustomEvent('chain-scope', {
    detail: { id: inst.id, label: inst.label, expiry: state.expiry, lot: inst.lot },
  }));

  renderHeader(null);
  skeleton();
  connect();
}

/* -------------------------------------------------------------------- SSE */

function connect() {
  if (state.es) state.es.close();
  const url = `/api/stream?key=${encodeURIComponent(state.current.id)}&expiry=${encodeURIComponent(state.expiry)}`;
  const es = new EventSource(url);
  state.es = es;

  setConn('connecting');
  es.addEventListener('hello', () => setConn('on'));
  es.addEventListener('open', () => setConn('on'));
  es.onopen = () => setConn('on');
  es.onerror = () => setConn('off');

  es.addEventListener('snapshot', (ev) => {
    const data = JSON.parse(ev.data);
    state.clientStages.transport = Math.max(0, Date.now() - data.pushedAt);
    onSnapshot(data);
  });
  es.addEventListener('status', (ev) => onStatus(JSON.parse(ev.data)));
  es.addEventListener('telemetry', (ev) => onTelemetry(JSON.parse(ev.data)));
  es.addEventListener('ticks', (ev) => onTicks(JSON.parse(ev.data).batch));
  es.addEventListener('feed', (ev) => onFeed(JSON.parse(ev.data)));
  es.addEventListener('chart-history', (ev) => {
    const pts = JSON.parse(ev.data).points ?? [];
    state.ticks = pts.map(x => ({ t: x.t, p: x.p }));
    state.chartDirty = true;
  });
}

let wasOff = false;

function setConn(kind) {
  const el = $('conn');
  el.className = 'conn ' + (kind === 'on' ? 'on' : kind === 'off' ? 'off' : '');
  el.lastElementChild.textContent = kind === 'on' ? 'streaming' : kind === 'off' ? 'disconnected' : 'connecting';

  // panel-windows-v1.md row 10. The stream coming back is a stronger signal than any timer, so
  // every panel sitting on an error refetches at once instead of serving out its backoff. Only
  // on the off -> on EDGE: `hello` and `open` both fire on a healthy connect.
  if (kind === 'on' && wasOff) {
    uc.onReconnect();
    document.dispatchEvent(new CustomEvent('backend-back'));
  }
  wasOff = kind === 'off';
}

/* -------------------------------------------------------------- rendering */

/* Vega Theta Gamma Delta OI Pk% OI-Chg Volume Vol-Chg% IV LTP-Chg LTP — mirrored for PE. */
const CE_COLS = [40, 46, 52, 38, 56, 48, 106, 56, 56, 38, 100, 60];
const SPINE = 92;
const COLS = CE_COLS.length * 2 + 1;

/* Column indices into a rendered <tr>. 25 cells: 12 CE, the spine at 12, then 12 PE mirrored.
   Unaffected by the greeks toggle: `display:none` removes a cell from the CSS table but not from
   tr.children, so these keep addressing the same <td>s. */
const CELL = {
  ce: { ltp: 11, ltpChg: 10, vol: 7, volChg: 8, oi: 4, oiChg: 6, pk: 5 },
  pe: { ltp: 13, ltpChg: 14, vol: 17, volChg: 16, oi: 20, oiChg: 18, pk: 19 },
};

/* Which column set the <colgroup> was last built for, so it is rebuilt on a `G` toggle and on
   nothing else. `null` until the first build. */
let cgGreeks = null;

function buildColgroup() {
  const on = !document.body.classList.contains('nogreeks');
  if (cgGreeks === on) return;
  cgGreeks = on;

  // Spec row 7: greeks off drops the first four of each side — 696 - 176 = 520px per side,
  // 1132px in total. The <colgroup> has to match the number of columns the CSS table actually
  // generates, or col[0]'s 40px would land on OI instead of on Vega.
  const ce = on ? CE_COLS : CE_COLS.slice(4);
  const widths = [...ce, SPINE, ...[...ce].reverse()];
  $('cg').innerHTML = widths.map(w => `<col style="width:${w}px">`).join('');
  for (const th of document.querySelectorAll('thead th.side')) th.colSpan = ce.length;
}

/* panes.js owns the toggle; this side owns the table. One event, one direction. */
document.addEventListener('greeks', () => {
  buildColgroup();
  if (state.snapshot) requestAnimationFrame(() => placeSpotPill(state.snapshot));
});

function skeleton() {
  buildColgroup();
  $('expState').hidden = true;
  $('gridScroll').style.display = '';
  $('spotPill').hidden = true;
  // The skeleton has to carry `gk` on the same eight cells the real rows do. Without it these
  // rows generate 25 columns against a 17-<col> colgroup with greeks off, and the shimmer lands
  // on different column boundaries than the header above it and the grid that replaces it.
  const cells = Array.from({ length: COLS },
    (_, i) => `<td${i < 4 || i >= COLS - 4 ? ' class="gk"' : ''}><span></span></td>`).join('');
  $('ocBody').innerHTML = `<tr class="skel">${cells}</tr>`.repeat(15);
}

function renderHeader(s) {
  if (!s) {
    $('uName').textContent = state.current ? state.current.displayName : '—';
    for (const id of ['uSpot', 'uChg', 'sAtm', 'sIv', 'sIvc', 'sPcr', 'sDte', 'sStrikes']) $(id).textContent = '—';
    $('sLot').textContent = state.current?.lot ?? '—';
    return;
  }
  $('uName').textContent = s.instrument.displayName;
  $('uSpot').textContent = inr(s.spot);
  // P25: say which number this is. Dhan's option chain carries its own `last_price`, and on MCX
  // that one is hours old, so the spot comes from a quote of the same contract instead. Where
  // the two differ the tooltip names both rather than leaving the screen to be trusted blindly.
  $('uSpot').title = s.spotSource === 'quote' && s.spotChainLast !== null
      && Math.abs(s.spot - s.spotChainLast) > 0.005
    ? `${inr(s.spot)} — live quote of ${s.instrument.underlyingScrip} `
      + `(${s.instrument.underlyingSeg}). Dhan's option-chain payload still reads `
      + `${inr(s.spotChainLast)}.`
    : `${inr(s.spot)} — ${s.spotSource === 'quote' ? 'live quote of' : 'option-chain payload for'} `
      + `${s.instrument.underlyingScrip} (${s.instrument.underlyingSeg})`;
  const chg = $('uChg');
  chg.textContent = s.spotChange === null
    ? 'previous close unavailable'
    : `${s.spotChange > 0 ? '+' : ''}${inr(s.spotChange)} (${pctText(s.spotChangePct)})`;
  chg.className = 'chg mono ' + (s.spotChange === null ? 'dim' : cls(s.spotChange));

  $('sAtm').textContent = s.atmStrike === null ? '—' : inr(s.atmStrike, 0);
  $('sIv').textContent = fx(s.atmIV, 2);
  const ivc = $('sIvc');
  ivc.textContent = pctText(s.ivChangePct);
  ivc.className = 'v mono ' + cls(s.ivChangePct);
  $('ivcWrap').title = s.ivBaselineAt
    ? `Baseline: first snapshot of the session at ${new Date(s.ivBaselineAt).toLocaleTimeString('en-IN')}. Dhan returns no previous IV, so this is an approximation.`
    : 'Dhan returns no previous IV; baseline not set yet.';
  $('sPcr').textContent = fx(s.pcr, 2);
  $('sLot').textContent = s.instrument.lot ?? '—';
  $('sDte').textContent = s.daysToExpiry;
  $('sStrikes').textContent = s.strikes;
}

function cell(html, extra = '') {
  return `<td class="${extra}">${html}</td>`;
}

/* --------------------------------------------------- peak OI (docs/spec/peak-oi-v1.md) */

/**
 * One `Pk %` cell from a live OI and that contract's peak. The single place the ratio and the
 * breach are decided, so the 3 s poll and the 10 Hz tick path cannot disagree about a cell.
 */
function pkCell(oi, pk, sessionDate) {
  const peak = pk && Number.isFinite(pk.peak) ? pk.peak : null;
  if (peak === null || peak <= 0) {
    return { text: '—', breach: false, title: (pk && pk.why) || 'no peak available' };
  }
  const day = dayLabel(sessionDate);
  const title = `peak ${abbr(peak)}${pk.at ? ` at ${pk.at}` : ''}${day ? ` · ${day}` : ''}`;
  if (oi === null || oi === undefined || !Number.isFinite(oi)) {
    return { text: '—', breach: false, title };
  }
  const breach = oi > peak;
  return { text: `${breach ? '▲' : ''}${Math.round((oi / peak) * 100)}%`, breach, title };
}

function pkTd(k, extra) {
  return `<td class="pk ${k.breach ? 'breach ' : ''}${extra}" title="${k.title.replace(/"/g, '')}">${k.text}</td>`;
}

/** Where yesterday's peak sits on the OI bar's own scale. */
function pkMark(peak, max, side) {
  if (!peak || !max) return '';
  const pct = Math.min(100, (100 * peak) / max).toFixed(1);
  return `<i class="pkmark" style="${side === 'ce' ? 'right' : 'left'}:${pct}%"></i>`;
}

/** P23 row 1 — strikes on each side of the spot. */
const WING = 8;

/**
 * P23 (docs/spec/spot-window-v1.md), replacing P20's "ATM row + 8 each side = 17": WING strikes
 * strictly BELOW the snapshot's spot and WING strikes AT OR ABOVE it — 16 rows. The user's own
 * example: NIFTY 23,346.40 → 22,950 … 23,300 below and 23,350 … 23,700 above. A spot sitting
 * exactly on a strike counts that strike as "above". Near a chain edge a side is simply shorter —
 * rows are never borrowed from the other side. No spot → the whole chain stays.
 */
function windowRows(s) {
  const rows = s.rows;
  if (!Number.isFinite(s.spot) || !rows.length) return rows;
  let i = rows.findIndex(r => r.strike >= s.spot);   // first strike at or above the spot
  if (i < 0) i = rows.length;                        // spot above the whole chain
  return rows.slice(Math.max(0, i - WING), Math.min(rows.length, i + WING));
}

/* Read-only test seam: the P20 verification drives windowRows() with synthetic snapshots, because
   replay's chain is always centred and a chain edge never happens on its own. Nothing reads it. */
window.__grid = { windowRows, WING };

function renderGrid(s) {
  buildColgroup();
  const q = state.filter.trim();
  // Row 6: a strike search is an explicit lookup, so it reaches the whole chain. Everything else
  // (including Breached, row 7) sees only the window.
  const all = s.rows;
  const rows = q ? all : windowRows(s);
  // OI bars are scaled to the rows on screen, or the 17 visible bars would be measured against a
  // far strike nobody can see.
  let maxCe = 0, maxPe = 0;
  for (const r of rows) {
    if ((r.ce.oi ?? 0) > maxCe) maxCe = r.ce.oi ?? 0;
    if ((r.pe.oi ?? 0) > maxPe) maxPe = r.pe.oi ?? 0;
  }

  let shown = 0;
  const html = rows.map((r, i) => {
    const itmCe = r.strike < s.spot ? 'itm' : '';
    const itmPe = r.strike > s.spot ? 'itm' : '';
    const isAtm = r.strike === s.atmStrike;
    const spotline = i < rows.length - 1 && r.strike < s.spot && rows[i + 1].strike > s.spot;

    const c = r.ce, p = r.pe;
    const pk = state.peaks[r.strike] ?? {};
    const pkC = pkCell(c.oi, pk.ce, state.peakDate);
    const pkP = pkCell(p.oi, pk.pe, state.peakDate);

    const hidden = (q && !String(r.strike).includes(q))
      || (state.breachOnly && !pkC.breach && !pkP.breach);
    if (!hidden) shown++;

    const barCe = maxCe ? `<i class="bar" style="width:${(100 * (c.oi ?? 0) / maxCe).toFixed(1)}%"></i>` : '';
    const barPe = maxPe ? `<i class="bar" style="width:${(100 * (p.oi ?? 0) / maxPe).toFixed(1)}%"></i>` : '';

    /* The three change columns are derived from a baseline the poll does not resend: the
       previous close, the previous session's OI, and the previous volume. Carry each one on the
       row so the 10 Hz tick can recompute its column instead of leaving a 3 s-old number beside
       a moving one — `LTP - LTP Chg` is the previous close and must not drift between frames.
       Exact for LTP and OI (both differences come from the same poll); volume's base is
       recovered from its own percentage, which is a float round-trip, not a rounded one. */
    const bases = (s) => [
      s.ltp !== null && s.ltpChg !== null ? s.ltp - s.ltpChg : '',
      s.oi !== null && s.oiChg !== null ? s.oi - s.oiChg : '',
      s.volume !== null && s.volChgPct !== null && s.volChgPct !== -100
        ? s.volume / (1 + s.volChgPct / 100) : '',
    ];
    const [pcC, poC, pvC] = bases(c);
    const [pcP, poP, pvP] = bases(p);

    return `<tr class="${isAtm ? 'atm ' : ''}${spotline ? 'spotline ' : ''}${hidden ? 'hidden' : ''}" data-strike="${r.strike}"`
      + ` data-pcce="${pcC}" data-poce="${poC}" data-pvce="${pvC}"`
      + ` data-pcpe="${pcP}" data-pope="${poP}" data-pvpe="${pvP}">`
      + cell(fx(c.vega, 2), `gk ${itmCe}`)
      + cell(fx(c.theta, 2), `gk ${itmCe}`)
      + cell(fx(c.gamma, 5), `gk ${itmCe}`)
      + cell(fx(c.delta, 2), `gk ${itmCe}`)
      + cell(`${barCe}${pkMark(pk.ce?.peak, maxCe, 'ce')}<span class="v">${abbr(c.oi)}</span>`, `oi r ${itmCe}`)
      + pkTd(pkC, itmCe)
      + cell(signedPair(c.oiChg, c.oiChgPct, 'abbr'), itmCe)
      + cell(abbr(c.volume), itmCe)
      + cell(`<span class="${cls(c.volChgPct)}">${pctText(c.volChgPct)}</span>`, itmCe)
      + cell(fx(c.iv, 2), itmCe)
      + cell(signedPair(c.ltpChg, c.ltpChgPct, 2), itmCe)
      + cell(inr(c.ltp), `ltp ${itmCe}`)
      + cell(inr(r.strike, 0), 'spine')
      + cell(inr(p.ltp), `ltp ${itmPe}`)
      + cell(signedPair(p.ltpChg, p.ltpChgPct, 2), itmPe)
      + cell(fx(p.iv, 2), itmPe)
      + cell(`<span class="${cls(p.volChgPct)}">${pctText(p.volChgPct)}</span>`, itmPe)
      + cell(abbr(p.volume), itmPe)
      + cell(signedPair(p.oiChg, p.oiChgPct, 'abbr'), itmPe)
      + pkTd(pkP, itmPe)
      + cell(`${barPe}${pkMark(pk.pe?.peak, maxPe, 'pe')}<span class="v">${abbr(p.oi)}</span>`, `oi ${itmPe}`)
      + cell(fx(p.delta, 2), `gk ${itmPe}`)
      + cell(fx(p.gamma, 5), `gk ${itmPe}`)
      + cell(fx(p.theta, 2), `gk ${itmPe}`)
      + cell(fx(p.vega, 2), `gk ${itmPe}`)
      + '</tr>';
  }).join('');

  $('ocBody').innerHTML = html;

  /* P20 row 5 (was option-chain row 8). The window always leaves strikes out, so the chip always
     says so — a 17-row chain must read as a filter, never as missing data. */
  const fc = $('filterChip');
  fc.hidden = shown === all.length;
  fc.textContent = q ? `showing ${shown} of ${all.length} strikes`
    : `Spot ±${WING} · ${shown} of ${all.length} strikes`;

  const body = $('ocBody');
  state.rowByStrike.clear();
  for (const tr of body.children) state.rowByStrike.set(Number(tr.dataset.strike), tr);

  // Flash only the cells whose LTP actually moved.
  for (const tr of body.children) {
    const strike = Number(tr.dataset.strike);
    const row = rows.find(r => r.strike === strike);
    if (!row) continue;
    for (const [side, idx] of [['ce', CELL.ce.ltp], ['pe', CELL.pe.ltp]]) {
      const key = `${strike}|${side}`;
      const now = row[side].ltp;
      if (state.prevLtp.has(key) && state.prevLtp.get(key) !== now) tr.children[idx].classList.add('flash');
      state.prevLtp.set(key, now);
    }
  }

  state.spotIdx = -1;
  placeSpotPill(s);

  // The tbody was just replaced wholesale, which drops candles.js's selected-half outline.
  document.dispatchEvent(new CustomEvent('chain-render'));
}

/**
 * The backfill takes ~1 s per contract, so an 82-contract chain fills over more than a minute.
 * A column that arrives in pieces looks broken without a count beside it (spec row 17).
 */
function renderPeakChip(s) {
  const chip = $('peakChip');
  const p = s.peakProgress;
  if (!s.peakSessionDate) {
    chip.hidden = false;
    chip.textContent = 'PEAK OI —';
    chip.title = s.peakNote ?? '';
    return;
  }
  if (!p || !p.total) { chip.hidden = true; return; }
  const complete = p.done + p.skipped >= p.total;
  chip.hidden = complete && p.skipped === 0;
  chip.textContent = `PEAK OI ${p.done} / ${p.total}` + (p.skipped ? ` · ${p.skipped} skipped` : '');
  chip.title = `Peaks are from ${dayLabel(s.peakSessionDate)}`;
}

function placeSpotPill(s) {
  const pill = $('spotPill');
  const line = $('ocBody').querySelector('tr.spotline');
  if (!line || line.classList.contains('hidden')) { pill.hidden = true; return; }
  const spine = line.querySelector('td.spine');
  pill.hidden = false;
  pill.textContent = inr(s.spot);
  pill.style.top = `${line.offsetTop + line.offsetHeight}px`;
  pill.style.left = `${spine.offsetLeft + spine.offsetWidth / 2}px`;
}

function scrollToAtm(behavior = 'smooth') {
  const atm = document.querySelector('#ocBody tr.atm');
  if (!atm) return;
  // P16 amendment 20: centre the ATM row, snapped to a whole row, so no row is cut at the top edge
  // under the sticky header. A fractional centre cost one full row at 1440x900.
  const box = $('gridScroll');
  const head = document.querySelector('table.oc thead').getBoundingClientRect().height;
  const rowH = atm.getBoundingClientRect().height || 28;
  const view = box.clientHeight - head;
  const want = atm.offsetTop - head - (view - rowH) / 2;
  box.scrollTo({ top: Math.max(0, Math.round(want / rowH) * rowH), behavior });
}

function onSnapshot(s) {
  state.snapshot = s;
  state.lastReceivedAt = Date.now();
  state.peaks = s.peaks ?? {};
  state.peakDate = s.peakSessionDate ?? null;

  const t0 = performance.now();
  renderHeader(s);
  renderPeakChip(s);
  renderGrid(s);
  requestAnimationFrame(() => {
    state.clientStages.render = Math.round((performance.now() - t0) * 10) / 10;
    // telemetry.js draws the rail and the drawer; it needs the two scalars its own 250 ms loop
    // counts against, plus the two stages only this side can time.
    document.dispatchEvent(new CustomEvent('chain-timing', {
      detail: {
        lastReceivedAt: state.lastReceivedAt,
        cadenceMs: state.cadenceMs,
        clientStages: state.clientStages,
      },
    }));
    if (!state.centred) { state.centred = true; scrollToAtm('auto'); }
  });

  $('expState').hidden = true;
  $('gridScroll').style.display = '';
  $('pulse').className = 'pulse' + (s.session.openNow ? ' on' : '');
}

/* ----------------------------------------------------------------- states */

const NEEDLE = {
  closed: 'idle',
  error: 'concerned',
};

function onStatus(st) {
  const chip = $('stateChip');
  const exp = $('expState');

  if (st.state === 'polling' || st.state === 'idle') {
    chip.hidden = true;
    if (state.snapshot) { exp.hidden = true; $('gridScroll').style.display = ''; }
    return;
  }

  if (st.state === 'closed') {
    chip.hidden = false;
    chip.className = 'statechip flat';
    chip.textContent = `MARKET CLOSED · ${st.since}`;
    if (!state.snapshot) showExpressive('idle', 'Market abhi band hai',
      `${state.current.displayName} ka session ${state.current.session.window} hai. Abhi ${st.since}.`,
      'Try another instrument', JSON.stringify(st, null, 2));
    return;
  }

  // error
  chip.hidden = false;
  chip.className = 'statechip ' + (st.code === 'DH-904' ? 'warn' : 'crit');
  chip.textContent = st.code === 'DH-904'
    ? `THROTTLED · retry in ${Math.round((st.retryInMs ?? 0) / 1000)}s`
    : `DISCONNECTED · ${st.code}`;

  if (!state.snapshot) {
    const title = st.code === 'DH-901' || st.code === 'DH-906' || st.code === 'NO_CREDS'
      ? 'Dhan ne token accept nahi kiya'
      : st.code === 'DH-904' ? 'Dhan ne rate limit laga diya'
      : 'Dhan tak request nahi pahunch payi';
    showExpressive(NEEDLE.error, title, st.explain,
      st.retryInMs ? `Retrying in ${Math.round(st.retryInMs / 1000)}s` : 'Retry now',
      `${st.code}  ${st.message}\nkey       ${state.current.id}|${state.expiry}\nendpoint  POST /v2/optionchain`);
  }
}

function showExpressive(pose, title, body, action, tech) {
  const exp = $('expState');
  exp.hidden = false;
  exp.className = 'exp ' + pose;
  $('gridScroll').style.display = 'none';
  $('expTitle').textContent = title;
  $('expBody').textContent = body;
  $('expA').textContent = action;
  $('expTech').textContent = tech;
}
$('expA').addEventListener('click', () => { skeleton(); connect(); });

/* ------------------------------------------------------------- telemetry */

/**
 * P10b moved every telemetry renderer to public/telemetry.js, which owns the status rail and the
 * drawer. This side still owns the poll, so it still owns the numbers: it pushes them across as
 * two CustomEvents and reads nothing back. app.js imports nothing downstream of itself.
 */
function onTelemetry(s) {
  document.dispatchEvent(new CustomEvent('telemetry', { detail: s }));
}

/* ------------------------------------------------------------- live ticks */

/* AGE, NEXT and the countdown ring moved to telemetry.js with the rail they are drawn into.
   What is left here is the clock and the one thing that is grid business rather than telemetry:
   fading the chain when the data on it goes stale. */
setInterval(() => {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';
  if (!state.lastReceivedAt) return;
  const age = (Date.now() - state.lastReceivedAt) / 1000;
  $('gridScroll').style.opacity = age > 6 ? '.85' : '1';
}, 250);

/* --------------------------------------------------------------- controls */

$('expiry').addEventListener('change', (e) => select(state.current.id, e.target.value));

$('search').addEventListener('input', (e) => {
  state.filter = e.target.value;
  if (state.snapshot) renderGrid(state.snapshot);
});

/** Spec row 15: ANDs with the strike search, it does not replace it. */
$('breachBtn').addEventListener('click', () => {
  state.breachOnly = !state.breachOnly;
  $('breachBtn').setAttribute('aria-pressed', String(state.breachOnly));
  if (state.snapshot) { renderGrid(state.snapshot); placeSpotPill(state.snapshot); }
});

const applyTheme = (t) => {
  if (t) document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
};
/* Spec row 11 — dark is the default when nothing is stored, rather than the OS preference. `T`
   still toggles both ways and an existing stored choice still wins. */
applyTheme(localStorage.getItem('theme') || 'dark');
$('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
  if (state.snapshot) placeSpotPill(state.snapshot);
  // The candle colours re-resolve against the new theme (underlying-candles-v1.md row 18).
  state.chartDirty = true;
  cstyle.repaint();
});

/* The 380px right dock is gone (P10b row 12). telemetry.js owns #panelBtn and the drawer; `L`
   still reaches it the way `P` and `G` reach their buttons. */

document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  // Every shortcut below is a bare letter, so a modifier combo must not reach them.
  // chart-tools.js and scan.js both guard this already; this handler did not, and the result
  // was that Ctrl+C (copy an LTP out of the chain) collapsed the chart pane and persisted it,
  // and Ctrl+P toggled the Breached filter while the print dialog snapshotted the page.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // drawing tools claim V/D/H/R/B, Esc and Delete first (docs/spec/chart-tools-v1.md row 11)
  if (tools.onKey(e)) { e.preventDefault(); return; }

  const n = Number(e.key);
  if (n >= 1 && n <= state.instruments.length) { select(state.instruments[n - 1].id); return; }
  if (e.key === '/') { e.preventDefault(); $('search').focus(); }
  if (e.key.toLowerCase() === 'p') $('breachBtn').click();
  if (e.key.toLowerCase() === 'g') $('greeksBtn').click();   // spec row 19
  if (e.key.toLowerCase() === 'l') $('panelBtn').click();
  if (e.key.toLowerCase() === 't') $('themeBtn').click();
  if (e.key.toLowerCase() === 'e') $('expiry').focus();
  if (e.key.toLowerCase() === 'c') setChart(document.body.classList.contains('nochart'));
  // P26 row 5. F and W act on the panel under the pointer (row 6).
  if (e.key.toLowerCase() === 'f') toggleFullscreen(POP_PANEL ?? hotPanel);
  if (e.key.toLowerCase() === 'w') popOut(POP_PANEL ?? hotPanel);
  if (e.key === 'Home' && state.snapshot) scrollToAtm();
});

window.addEventListener('resize', () => { if (state.snapshot) placeSpotPill(state.snapshot); });

loadInstruments().catch(err => {
  $('chips').hidden = true;
  document.querySelector('.hstrip').hidden = true;
  showExpressive('concerned', 'Backend se baat nahi ho payi',
    'Local server chal raha hai? Terminal mein `npm run dev` chala kar dobara try karo.',
    'Retry', String(err));
});

/* ==========================================================================
   Tick feed — chart + per-cell updates
   ==========================================================================
   The feed carries LTP, volume and OI only. IV and greeks have no tick source
   at all, so those columns keep coming from the 3 s snapshot, and the legend
   above the chart says which is which. */

/* `tickonly` rides along in every className below on purpose: it is what hides these two in
   candles.js's option-candle mode, and a bare `className =` assignment silently drops it. */
function onFeed(fs) {
  state.feed = fs;
  const pill = $('feedPill');
  const label = pill.lastElementChild;
  if (fs.state === 'live') {
    pill.className = 'feedpill tickonly live';
    label.textContent = `feed live · ${fs.instruments} instruments`;
    pill.title = 'Tick-by-tick over Dhan WebSocket';
  } else if (fs.state === 'connecting') {
    pill.className = 'feedpill tickonly';
    label.textContent = 'feed connecting';
  } else if (fs.state === 'error') {
    pill.className = 'feedpill tickonly bad';
    label.textContent = `feed down · ${fs.code}`;
    pill.title = fs.message ?? '';
  } else {
    pill.className = 'feedpill tickonly';
    label.textContent = 'feed off';
  }
}

function onTicks(batch) {
  const now = Date.now();
  for (const it of batch) {
    state.tickTimes.push(now);
    if (it.k === 'u') {
      if (it.p !== null && it.p !== undefined) {
        state.ticks.push({ t: it.t, p: it.p });
        uc.onTick(it.t, it.p);                   // underlying-candles-v1.md row 4: the forming candle
        // The chart only ever needs the visible window plus a little slack.
        if (state.ticks.length > 6000) state.ticks.splice(0, state.ticks.length - 6000);
        paintSpot(it.p);
      }
      continue;
    }
    applyCellTick(it);
  }
  state.chartDirty = true;
}

/**
 * The spot marker in the grid follows ticks too, otherwise the header would read one price and
 * the dashed line another. The row only moves when the price actually crosses a strike, so the
 * marker does not jitter on every print.
 */
function updateSpotMarker(price) {
  const rows = state.snapshot?.rows;
  if (!rows || !rows.length) return;

  let idx = -1;
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].strike < price && rows[i + 1].strike > price) { idx = i; break; }
  }
  const pill = $('spotPill');
  if (idx === -1) { pill.hidden = true; state.spotIdx = -1; return; }

  if (idx !== state.spotIdx) {
    state.spotIdx = idx;
    const body = $('ocBody');
    const prev = body.querySelector('tr.spotline');
    if (prev) prev.classList.remove('spotline');
    const tr = state.rowByStrike.get(rows[idx].strike);
    // The same guard placeSpotPill() already has. A filtered-out row is display:none, so its
    // offsetTop/offsetLeft/offsetWidth are all 0 and the pill lands at top:0/left:0 — printing
    // the live spot price on top of the sticky "CALLS · CE" header. Reproduced: type any strike
    // that is not the spot row, wait one underlying tick.
    if (tr && !tr.classList.contains('hidden')) {
      tr.classList.add('spotline');
      const spine = tr.querySelector('td.spine');
      pill.hidden = false;
      pill.style.top = `${tr.offsetTop + tr.offsetHeight}px`;
      pill.style.left = `${spine.offsetLeft + spine.offsetWidth / 2}px`;
    } else {
      pill.hidden = true;
    }
  }
  pill.textContent = inr(price);
}

/** Underlying price straight from the feed — fresher than the 3 s snapshot. */
function paintSpot(p) {
  $('chartPx').textContent = inr(p);
  $('uSpot').textContent = inr(p);
  updateSpotMarker(p);

  const prev = state.snapshot?.spotPrevClose ?? null;
  const chg = prev !== null && prev !== 0 ? p - prev : null;
  const text = chg === null ? 'prev close n/a'
    : `${chg > 0 ? '+' : ''}${inr(chg)} (${pctText((chg / prev) * 100)})`;
  const klass = chg === null ? 'dim' : cls(chg);

  const c = $('chartChg');
  c.textContent = text;
  c.className = 'cchg mono tickonly ' + klass;

  const h = $('uChg');
  h.textContent = text;
  h.className = 'chg mono ' + klass;
}

function applyCellTick(it) {
  const tr = state.rowByStrike.get(it.s);
  if (!tr) return;
  const idx = CELL[it.k];
  if (!idx) return;

  if (it.p !== null && it.p !== undefined) {
    const td = tr.children[idx.ltp];
    const before = parseFloat((td.textContent || '').replace(/,/g, ''));
    td.textContent = inr(it.p);
    if (Number.isFinite(before) && before !== it.p) {
      td.classList.remove('tup', 'tdn');
      void td.offsetWidth;                       // restart the animation on a repeat move
      td.classList.add(it.p > before ? 'tup' : 'tdn');
    }

    // LTP Chg follows the tick, or `LTP - LTP Chg` stops equalling the previous close. Measured
    // drifting 0.81 in 2 s on the ATM CE before this.
    const pc = Number(tr.dataset[`pc${it.k}`]);
    if (Number.isFinite(pc)) {
      const chg = it.p - pc;
      tr.children[idx.ltpChg].innerHTML = signedPair(chg, pc ? (chg / pc) * 100 : null, 2);
    }
  }
  if (it.v !== null && it.v !== undefined) {
    tr.children[idx.vol].textContent = abbr(it.v);
    const pv = Number(tr.dataset[`pv${it.k}`]);
    if (Number.isFinite(pv) && pv > 0) {
      const pct = ((it.v - pv) / pv) * 100;
      tr.children[idx.volChg].innerHTML = `<span class="${cls(pct)}">${pctText(pct)}</span>`;
    }
  }
  if (it.o !== null && it.o !== undefined) {
    const span = tr.children[idx.oi].querySelector('.v');
    if (span) span.textContent = abbr(it.o);

    const po = Number(tr.dataset[`po${it.k}`]);
    if (Number.isFinite(po)) {
      const d = it.o - po;
      tr.children[idx.oiChg].innerHTML = signedPair(d, po ? (d / po) * 100 : null, 'abbr');
    }

    // The OI cell moves at 10 Hz while the chain poll is 3 s, so Pk % has to follow the tick
    // or the screen would print 97% beside an OI that has already crossed the peak.
    const td = tr.children[idx.pk];
    if (td) {
      const k = pkCell(it.o, (state.peaks[it.s] ?? {})[it.k], state.peakDate);
      td.textContent = k.text;
      td.classList.toggle('breach', k.breach);
    }
  }
}

/* ------------------------------------------------------------------ chart */

function drawChart() {
  // P20 row 9: option candles open in their own window (candles.js). This strip is never handed
  // over any more, so P9's early return that blanked it and disabled the tools is gone.
  if (document.body.classList.contains('ucmode')) { drawCandleStrip(); return; }

  const svg = $('chartSvg');
  const box = svg.getBoundingClientRect();
  const W = Math.max(1, Math.round(box.width));
  const H = Math.max(1, Math.round(box.height));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const cutoff = state.chartRange ? Date.now() - state.chartRange : 0;
  const all = state.ticks.filter(p => p.t >= cutoff);

  $('chartEmpty').style.display = all.length < 2 ? '' : 'none';
  tools.setEnabled(all.length >= 2);                 // chart-tools row 25
  if (all.length < 2) { svg.innerHTML = ''; return; }

  const PAD_R = 76, PAD_B = 16;
  // chart-nav-v1.md rows 1, 4, 9 — the tick line navigates like the candles do: the window
  // first, then only the prices inside it decide the scale.
  tools.setMinSpan(5000);
  const [t0, t1] = tools.applyTime(all[0].t, Math.max(all[all.length - 1].t, all[0].t + 1));
  const pts = (t0 <= all[0].t && t1 >= all[all.length - 1].t)
    ? all : all.filter(p => p.t >= t0 && p.t <= t1);
  // A window can be narrower than the gap between two ticks; one point still draws a dot and a
  // scale, and blanking the chart under the pointer would read as a crash.
  if (!pts.length) { svg.innerHTML = ''; return; }

  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { if (p.p < lo) lo = p.p; if (p.p > hi) hi = p.p; }
  const span = hi - lo;
  const pad = span > 0 ? span * 0.12 : Math.max(hi * 0.0005, 0.05);
  const loP = lo - pad, hiP = hi + pad;

  // The price axis can be dragged to compress or expand the scale (chart-tools rows 2-4). The
  // transform lives in chart-tools so the price line and the drawings can never disagree.
  const [loV, hiV] = tools.applyZoom(loP, hiP);
  tools.setFrame({ W, H, t0, t1, lo: loV, hi: hiV, pts });
  const X = tools.X, Y = tools.Y;

  // A quiet period is not a straight line between two prices - it is missing data.
  // Anything over GAP_MS starts a new segment so the chart never invents a move.
  const GAP_MS = 5000;
  const segs = [[pts[0]]];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].t - pts[i - 1].t > GAP_MS) segs.push([pts[i]]);
    else segs[segs.length - 1].push(pts[i]);
  }
  const pathOf = (seg) => seg
    .map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p.p).toFixed(1)}`)
    .join('');

  const last = pts[pts.length - 1];
  const rising = last.p >= pts[0].p;
  const stroke = rising ? 'var(--up)' : 'var(--down)';
  const lastX = X(last.t), lastY = Y(last.p);
  const MONO = 'Inter, system-ui, sans-serif';

  // Zoomed in past the data (chart-tools row 6), a price can sit outside the view. The svg is
  // overflow:visible, so anything off-plot has to be dropped or it paints over the header.
  const inPlot = (y) => y >= 0 && y <= H - PAD_B;
  const guide = (p) => !inPlot(Y(p)) ? ''
    : `<line x1="0" y1="${Y(p).toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${Y(p).toFixed(1)}" `
    + `stroke="var(--border)" stroke-width="1" stroke-dasharray="2 4"/>`
    + `<text x="${(W - PAD_R + 6).toFixed(1)}" y="${(Y(p) + 3.5).toFixed(1)}" fill="var(--fg-faint)" `
    + `font-family="${MONO}" font-size="10">${inr(p)}</text>`;

  // The pill keeps the true last price readable by sticking to the edge; the dot and its rule
  // are dropped instead of drawn at a price they are not at.
  const pillY = Math.min(Math.max(lastY, 9), H - PAD_B - 9);

  svg.innerHTML =
    guide(hi) + guide(lo)
    + segs.filter(s => s.length > 1).map(s =>
        `<path d="${pathOf(s)} L${X(s[s.length - 1].t).toFixed(1)} ${H - PAD_B} L${X(s[0].t).toFixed(1)} ${H - PAD_B} Z" `
        + `fill="${stroke}" fill-opacity=".10"/>`).join('')
    + segs.map(s => s.length > 1
        ? `<path d="${pathOf(s)}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`
        : `<circle cx="${X(s[0].t).toFixed(1)}" cy="${Y(s[0].p).toFixed(1)}" r="1.6" fill="${stroke}"/>`).join('')
    + tools.renderDrawings()                          // chart-tools row 26 — above the fill…
    + (!inPlot(lastY) ? ''
        : `<line x1="0" y1="${lastY.toFixed(1)}" x2="${lastX.toFixed(1)}" y2="${lastY.toFixed(1)}" `
        + `stroke="${stroke}" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>`
        + `<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="${stroke}"/>`)
    + `<rect x="${(W - PAD_R + 2).toFixed(1)}" y="${(pillY - 9).toFixed(1)}" width="${PAD_R - 6}" height="18" rx="3" fill="${stroke}"/>`
    + `<text x="${(W - PAD_R + 7).toFixed(1)}" y="${(pillY + 3.5).toFixed(1)}" fill="var(--bg-panel)" `
    + `font-family="${MONO}" font-size="11" font-weight="600">${inr(last.p)}</text>`
    + `<text x="0" y="${H - 3}" fill="var(--fg-faint)" font-family="${MONO}" font-size="10">`
    + `${new Date(t0).toLocaleTimeString('en-IN', { hour12: false })}</text>`
    + `<text x="${(W - PAD_R).toFixed(1)}" y="${H - 3}" fill="var(--fg-faint)" text-anchor="end" `
    + `font-family="${MONO}" font-size="10">`
    + `${new Date(t1).toLocaleTimeString('en-IN', { hour12: false })}</text>`
    + tools.renderCrosshair();                        // …and the crosshair on top of everything
}

/**
 * P19 — the strip as underlying candles (underlying-candles-v1.md). Same svg, same content box
 * and the same chart-tools frame as the tick line, so the axis drag, the crosshair and every P6
 * drawing work unchanged: a drawing is (time, price), and X()/Y() are chart-tools' own.
 */
/* panel-windows-v1.md row 9 + amendment 16. The countdown rewrites this text every second and
   drawCandleStrip() runs every frame, so the button is built ONCE and only the words change —
   a control rebuilt under the pointer loses the click and takes focus to <body> with it (the
   P19 Chart Style lesson in CLAUDE.md). */
function ucMsgText(msg, text, showRetry) {
  if (!msg.firstElementChild) {
    const span = document.createElement('span');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'retry';
    b.textContent = 'Retry now';
    b.addEventListener('click', () => uc.retryNow());
    msg.textContent = '';
    msg.append(span, b);
  }
  const [span, btn] = msg.children;
  if (span.textContent !== text) span.textContent = text;
  btn.hidden = !showRetry;
}

function drawCandleStrip() {
  const svg = $('chartSvg');
  const box = svg.getBoundingClientRect();
  const W = Math.max(1, Math.round(box.width));
  const H = Math.max(1, Math.round(box.height));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const st = uc.current();
  const style = cstyle.get();
  // chart-nav-v1.md row 4 — five candles is the narrowest window this chart allows, so the
  // floor moves with the interval rather than being a fixed number of minutes.
  tools.setMinSpan(5 * Number(st.data?.interval ?? 5) * 60_000);
  const view = uc.buildView(st.data, style, tools.applyZoom, tools.applyTime);
  state.ucView = view;

  // Row 21. With candles on screen a failed refresh is reported in the plot's note instead.
  const msg = $('ucMsg');
  msg.hidden = !!view;
  if (!view) {
    ucMsgText(msg, st.loading ? 'loading candles…'
      : (st.message ?? `no candles for ${st.label} in the last 5 days`), !!st.errorText);
  }
  tools.setEnabled(!!view && view.vis.length >= 2);  // chart-tools row 25
  if (!view) { svg.innerHTML = ''; return; }

  tools.setFrame({ W, H, t0: view.t0, t1: view.t1, lo: view.lo, hi: view.hi, pts: view.pts });
  const col = cstyle.colours($('chartBody'), style);
  svg.innerHTML = uc.renderSvg(view, {
    W, H, X: tools.X, Y: tools.Y, up: col.up, down: col.down, inr,
    hover: state.ucHover, clipId: 'ucClipStrip', note: ucNote(),
    drawings: tools.renderDrawings(),               // chart-tools row 26 — above the series…
    crosshair: tools.renderCrosshair(),             // …and the crosshair on top of everything
  });
}

/** Header items that follow the candle data: the interval buttons. */
function renderUcHead() {
  const st = uc.current();
  for (const b of $('ucInterval').children) {
    b.setAttribute('aria-pressed', String(b.dataset.iv === st.interval));
  }
}

/** Row 21 / amendment 28: the session note, drawn in the plot's top-right corner. In the header it
 *  wrapped the strip to two lines at 1024px. With candles on screen a failed refresh is reported
 *  here too — the candles already drawn are still true. */
function ucNote() {
  const st = uc.current();
  const d = st.data;
  if (d && st.message && d.candles?.length) return st.message;
  if (d?.sessionDate) return `session ${dayLabel(d.sessionDate)}${st.openNow ? '' : ' · market closed'}`;
  return '';
}

/* One paint per frame at most, however many ticks arrived in between. */
function chartLoop() {
  if (state.chartDirty) {
    state.chartDirty = false;
    const t0 = performance.now();
    drawChart();
    // paint cost, read by the replay verification script through the chart-tools test seam
    if (window.__chart) window.__chart.paintMs = performance.now() - t0;
    if (document.body.classList.contains('ucmode') && window.__ucandles) {
      const p = window.__ucandles.paints;
      p.push(performance.now() - t0);
      if (p.length > 400) p.shift();
    }
  }
  requestAnimationFrame(chartLoop);
}
requestAnimationFrame(chartLoop);

/* ticks per second over a rolling 1 s window */
setInterval(() => {
  const cut = Date.now() - 1000;
  state.tickTimes = state.tickTimes.filter(x => x >= cut);
  $('tickRate').textContent = `${state.tickTimes.length} t/s`;
  if (state.chartRange) state.chartDirty = true;   // keep the window sliding
}, 500);

/* ------------------------------------------------------- chart controls */

/* Price axis, crosshair and drawing tools — docs/spec/chart-tools-v1.md */
tools.init({
  svg: $('chartSvg'),
  surface: $('chartSurface'),
  axis: $('chartAxis'),
  tools: $('chartTools'),
  reset: $('chartReset'),                            // P25 — chart-nav-v1.md row 12
  inr,
  repaint: () => { state.chartDirty = true; },
});

/* P19 — mode, interval and the Chart Style dialog (underlying-candles-v1.md rows 1, 3, 13, 19) */
function applyStyle(s) {
  document.body.classList.toggle('ucmode', s.mode === 'candle');
  for (const b of $('chartMode').children) b.setAttribute('aria-pressed', String(b.dataset.mode === s.mode));
  cstyle.applyBg($('chartBody'), s);
  state.ucHover = -1;
  // chart-nav-v1.md row 14 — the tick line and the candles are two different time domains, so
  // a window measured in one is meaningless in the other.
  tools.resetView();
  state.chartDirty = true;
}
uc.init({
  onChange: () => { renderUcHead(); state.chartDirty = true; cstyle.repaint(); },
});
cstyle.init({ inr, onSave: applyStyle });
applyStyle(cstyle.get());
renderUcHead();
$('chartMode').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) cstyle.setMode(b.dataset.mode);
});
$('ucInterval').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.ucHover = -1;
  tools.resetView();                           // chart-nav-v1.md row 14
  uc.setInterval_(b.dataset.iv);
});
$('styleBtn').addEventListener('click', () => cstyle.open());

/* ==========================================================================
   P26 — panel windows. Spec: docs/spec/panel-windows-v1.md
   ==========================================================================
   Three panels, two actions each. Fullscreen is the browser's own API (row 1), so Esc exits it
   for free and no layout is invented. Pop-out is this same page with `?pop=<panel>` (row 2):
   the popup opens its own SSE, but on the SAME poller key, so Dhan sees no extra calls. */

const PANELS = {
  chart: { el: () => $('chartWrap'), name: 'chart' },
  chain: { el: () => $('work'), name: 'option chain' },
  opt: { el: () => $('optWin'), name: 'option chart' },
};

/** Row 6. The panel under the pointer decides what F and W act on; none → the chart. */
let hotPanel = 'chart';
document.addEventListener('pointerover', (e) => {
  const sec = e.target.closest?.('#chartWrap,#work,#optWin');
  if (!sec) return;
  hotPanel = sec.id === 'chartWrap' ? 'chart' : sec.id === 'work' ? 'chain' : 'opt';
}, { passive: true });

/** Row 12 / row 9's sibling: a one-line note in the status rail rather than a silent no-op. */
function panelNote(text) {
  const el = $('panelNote');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(panelNote.t);
  panelNote.t = setTimeout(() => { el.hidden = true; }, 6000);
}

function popKey(panel) { return `pop-${panel}`; }

function readPopBox(panel) {
  try {
    const b = JSON.parse(localStorage.getItem(popKey(panel)) ?? 'null');
    if (b && Number.isFinite(b.w) && Number.isFinite(b.h)) return b;
  } catch { /* private mode */ }
  return { w: 1280, h: 800, x: null, y: null };      // row 2's defaults
}

/** Row 1. */
function toggleFullscreen(panel) {
  const el = PANELS[panel]?.el();
  if (!el) return;
  if (document.fullscreenElement === el) { document.exitFullscreen?.(); return; }
  if (panel === 'opt' && el.hidden) { panelNote('open a contract first — click a CE or PE cell'); return; }
  // A collapsed chart has no body to show, so C is undone first rather than showing an empty box.
  if (panel === 'chart' && document.body.classList.contains('nochart')) setChart(true);
  el.requestFullscreen?.().catch(err => panelNote(`fullscreen refused — ${err}`));
}

/** Row 2. One window per panel: a second click re-focuses the one already open (out-of-scope
 *  line 3). Row 7 restores the size and position the user left it at. */
const popWindows = new Map();

function popOut(panel) {
  const open = popWindows.get(panel);
  if (open && !open.closed) { open.focus(); return; }

  const q = new URLSearchParams({ pop: panel });
  if (state.current) q.set('key', state.current.id);
  if (state.expiry) q.set('expiry', state.expiry);
  if (panel === 'opt') {
    const sel = window.__candles?.sel?.();
    if (!sel) { panelNote('open a contract first — click a CE or PE cell'); return; }
    q.set('strike', String(sel.strike));
    q.set('side', sel.side);
  }

  const b = readPopBox(panel);
  const feat = [`width=${b.w}`, `height=${b.h}`, 'menubar=no', 'toolbar=no', 'location=no']
    .concat(Number.isFinite(b.x) && Number.isFinite(b.y) ? [`left=${b.x}`, `top=${b.y}`] : []);
  const w = window.open(`/?${q}`, `dhan-${panel}`, feat.join(','));
  if (!w) { panelNote('popup blocked — allow popups for this page'); return; }   // row 12
  popWindows.set(panel, w);
}

for (const b of document.querySelectorAll('button.pw')) {
  b.addEventListener('click', () => {
    (b.id.endsWith('Fs') ? toggleFullscreen : popOut)(b.dataset.panel);
  });
}

/* Row 7 — the popup remembers where it was left. Written by the popup about itself. */
if (POP_PANEL) {
  window.addEventListener('beforeunload', () => {
    try {
      localStorage.setItem(popKey(POP_PANEL), JSON.stringify({
        w: window.outerWidth, h: window.outerHeight, x: window.screenX, y: window.screenY,
      }));
    } catch { /* private mode */ }
  });
}
/* Row 11 — the readout follows the pointer. chart-tools owns the surface's crosshair; this only
   reads the same pointer, it does not compete for it. */
$('chartSurface').addEventListener('pointermove', (e) => {
  if (!document.body.classList.contains('ucmode') || !state.ucView) return;
  const r = $('chartSurface').getBoundingClientRect();
  const v = state.ucView;
  const t = v.t0 + ((e.clientX - r.left) / Math.max(1, r.width)) * (v.t1 - v.t0);
  const i = uc.indexAt(v, t);
  if (i !== state.ucHover) { state.ucHover = i; state.chartDirty = true; }
});
$('chartSurface').addEventListener('pointerleave', () => {
  if (state.ucHover !== -1) { state.ucHover = -1; state.chartDirty = true; }
});

$('chartRange').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.chartRange = Number(b.dataset.range);
  localStorage.setItem('chartRange', String(state.chartRange));
  [...$('chartRange').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  tools.resetView();                           // chart-nav-v1.md row 14 — a new time domain
  state.chartDirty = true;
});
[...$('chartRange').children].forEach(b =>
  b.setAttribute('aria-pressed', String(Number(b.dataset.range) === state.chartRange)));

function setChart(open) {
  document.body.classList.toggle('nochart', !open);
  localStorage.setItem('chart', open ? '1' : '0');
  // P24: collapsed, the only way back used to be a 24px rotated arrow at the far right, and a
  // stray `C` persists the collapse across reloads — the user read it as "the chart is gone".
  // Collapsed, the button says what it does.
  const b = $('chartBtn');
  b.textContent = open ? '▾' : '▸ Show chart';
  b.title = open ? 'Collapse chart (C)' : 'Show chart (C)';
  b.setAttribute('aria-label', open ? 'Collapse chart' : 'Show chart');
  state.chartDirty = true;
}
setChart(localStorage.getItem('chart') !== '0');
$('chartBtn').addEventListener('click', () => setChart(document.body.classList.contains('nochart')));

/* The grip's drag moved to panes.js as splitter #1 (docs/spec/terminal-redesign-v1.md rows 3, 4),
   which added the 60%-of-shell ceiling, the 200px chain minimum, the keyboard and the double-click
   reset. This side only has to repaint when it reports a resize. */
document.addEventListener('pane-resize', () => {
  state.chartDirty = true;
  if (state.snapshot) placeSpotPill(state.snapshot);
});

window.addEventListener('resize', () => { state.chartDirty = true; });

/* candles.js took the strip over, or handed it back. One repaint either way: leaving the tick
   chart's last frame behind would show a price line that is no longer being updated. */
document.addEventListener('optmode', () => { state.chartDirty = true; });
