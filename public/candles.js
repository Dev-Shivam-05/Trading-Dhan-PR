/* P9 — option candle colouring.

   Spec: docs/spec/option-candles-v1.md. Clicking the CE or the PE half of a strike row switches
   the existing chart strip into candlestick mode for THAT contract (rows 1, 2) — one chart, one
   grip, one resize path, and the chain poll underneath is never touched.

   This file draws into its own <svg id="candleSvg">, layered inside the same .chart-body, rather
   than borrowing app.js's drawChart(). The two never run at once (`body.optmode` hides one and
   shows the other), and keeping them apart means neither module has to import the other — the
   only thing crossing is the number formatting, which is imported so one screen never prints
   12.4 L in the grid and 1,240,000 on the chart.

   Drawing tools stay bound to the underlying tick chart and are disabled here (row 17). */

import { abbr, inr } from '/app.js';

const $ = (id) => document.getElementById(id);

/** Row 4. */
const INTERVALS = ['1', '5', '15'];
/** Row 14. Candles close every 5 min, so 60 s is at most 60 s stale for one call a minute. */
const REFRESH_MS = 60_000;
/** Same content box as the tick chart: .chart-body pads 16px sideways, 8px bottom, and the
    price gutter is 76px wide (docs/spec/chart-tools-v1.md rows 1, 7). */
const PAD_R = 76;
const PAD_B = 16;

const state = {
  active: false,
  /** {id, label, expiry, lot} — whichever chip and expiry the chain is showing. */
  scope: null,
  /** {strike, side} of the charted contract. */
  sel: null,
  interval: INTERVALS.includes(localStorage.getItem('candleInterval'))
    ? localStorage.getItem('candleInterval') : '5',
  data: null,
  loading: false,
  message: null,
  hover: -1,
  dirty: false,
  timer: null,
  /** Bumped on every request so a slow reply for an old contract can never paint (AC5). */
  seq: 0,
  /** Last frame's geometry, so the pointer can be turned back into a candle index. */
  frame: null,
};

/* --------------------------------------------------------------- formatting */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-09-04 -> "04 Sep" — row 2's header format. */
function dayLabel(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d} ${MONTHS[Number(m) - 1] ?? ''}`;
}

function ratio(v) {
  return (v === null || v === undefined || !Number.isFinite(v)) ? '—' : v.toFixed(2) + '×';
}

function signedPct(v) {
  return (v === null || v === undefined || !Number.isFinite(v)) ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}

function signedAbbr(v) {
  return (v === null || v === undefined || !Number.isFinite(v)) ? '—' : (v > 0 ? '+' : '') + abbr(v);
}

/* -------------------------------------------------------------- mode switch */

function setActive(on) {
  if (state.active === on) return;
  state.active = on;
  document.body.classList.toggle('optmode', on);
  // app.js owns the tick chart and the drawing tools; it repaints (and disables the tools,
  // row 17) when it sees this. A custom event rather than an import, so neither module has to
  // depend on the other.
  document.dispatchEvent(new CustomEvent('optmode', { detail: { on } }));
  if (on) {
    if (!state.timer) state.timer = setInterval(() => refresh(false), REFRESH_MS);
  } else {
    clearInterval(state.timer);
    state.timer = null;
    state.hover = -1;
    hideTip();
  }
  markRow();
  state.dirty = true;
}

/** Row 2. The selected half of the row carries a --ring outline. renderGrid() rewrites the
 *  tbody on every snapshot, so this is re-applied whenever app.js says it has re-rendered. */
function markRow() {
  const body = $('ocBody');
  if (!body) return;
  for (const tr of body.children) tr.classList.remove('selce', 'selpe');
  if (!state.active || !state.sel) return;
  const tr = body.querySelector(`tr[data-strike="${state.sel.strike}"]`);
  if (tr) tr.classList.add(state.sel.side === 'ce' ? 'selce' : 'selpe');
}

/* --------------------------------------------------------------- selection */

/** Row 1. Exactly one contract at a time. */
function select(strike, side) {
  if (!state.scope) return;
  state.sel = { strike, side };
  state.data = null;
  state.hover = -1;
  hideTip();
  setActive(true);
  markRow();
  renderHead();
  refresh(true);
}

function back() {
  state.sel = null;
  state.data = null;
  setActive(false);
  renderHead();
}

function setInterval_(iv) {
  if (!INTERVALS.includes(iv) || iv === state.interval) return;
  state.interval = iv;
  localStorage.setItem('candleInterval', iv);
  // AC5: the old candles go with the old interval. Nothing stale is left on screen while the
  // new payload is in flight.
  state.data = null;
  state.hover = -1;
  hideTip();
  renderHead();
  state.dirty = true;
  refresh(true);
}

/* ------------------------------------------------------------------ fetch */

async function refresh(showLoading) {
  if (!state.active || !state.sel || !state.scope) return;
  const seq = ++state.seq;
  if (showLoading) { state.loading = true; state.message = 'loading candles…'; state.dirty = true; }

  const q = new URLSearchParams({
    key: state.scope.id,
    expiry: state.scope.expiry ?? '',
    strike: String(state.sel.strike),
    side: state.sel.side,
    interval: state.interval,
  });

  try {
    const res = await fetch(`/api/candles?${q}`);
    const body = await res.json();
    if (seq !== state.seq) return;                 // a newer request has already been sent
    state.loading = false;
    if (!res.ok) { state.data = null; state.message = body.error ?? `HTTP ${res.status}`; }
    else if (body.error) { state.data = null; state.message = body.error; }
    else if (body.note) { state.data = body; state.message = body.note; }
    else { state.data = body; state.message = null; }
  } catch (err) {
    if (seq !== state.seq) return;
    state.loading = false;
    state.data = null;
    state.message = `could not reach the backend — ${err}`;
  }
  renderHead();
  state.dirty = true;
}

/* ----------------------------------------------------------------- header */

function renderHead() {
  const t = $('candleTitle');
  if (!state.sel || !state.scope) { t.textContent = ''; return; }
  // Row 2: NIFTY 24500 CE · 04 Sep
  t.textContent = `${state.scope.label} ${inr(state.sel.strike, 0)} ${state.sel.side.toUpperCase()}`
    + ` · ${dayLabel(state.scope.expiry)}`;

  const c = $('candleCount');
  const d = state.data;
  if (d && d.candles.length) {
    c.textContent = `${d.candles.length} × ${d.interval}m · ${d.counts.blue} blue · ${d.counts.yellow} yellow`;
    c.title = `session ${d.sessionDate} · ${d.context} earlier candles fetched as median-20 context`;
  } else {
    c.textContent = '';
    c.title = '';
  }

  for (const b of $('candleInterval').children) {
    b.setAttribute('aria-pressed', String(b.dataset.iv === state.interval));
  }
}

/* ------------------------------------------------------------------ paint */

/** Fill / stroke per candle class. Row 9's stroke is "1px darker" with no value locked, so it
 *  is derived from the token rather than invented as a sixth colour. */
const PAINT = {
  up: { fill: 'var(--up)', line: 'var(--up)' },
  down: { fill: 'var(--down)', line: 'var(--down)' },
  blue: { fill: 'var(--big-in)', line: 'var(--big-in-line)' },
  yellow: { fill: 'var(--big-out)', line: 'var(--big-out-line)' },
};
const GROUPS = ['up', 'down', 'blue', 'yellow'];
const MONO = 'IBM Plex Mono, monospace';

function groupOf(k) {
  if (k.fired === 'blue') return 'blue';
  if (k.fired === 'yellow') return 'yellow';
  return k.c >= k.o ? 'up' : 'down';
}

/**
 * Row 16: p95 under 8 ms at 375 candles. 375 candles as one node each is 750 nodes; the P6
 * amendment measured that a 21-node page already spikes past 8 ms. So the candles are batched
 * into ONE path per group — eight nodes for the whole series however many candles there are.
 */
function drawCandles() {
  const svg = $('candleSvg');
  const box = svg.getBoundingClientRect();
  const W = Math.max(1, Math.round(box.width));
  const H = Math.max(1, Math.round(box.height));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const ks = state.data?.candles ?? [];
  const msg = $('candleMsg');
  msg.hidden = !(state.message || !ks.length);
  // Row 15's empty state names the strike, so it is composed here rather than printed from the
  // server's note — the server has no digit grouping and the header beside it says "23,100".
  msg.textContent = (state.data && state.data.note && state.sel)
    ? `no trades in this contract today — ${state.scope.label} `
      + `${inr(state.sel.strike, 0)} ${state.sel.side.toUpperCase()}`
    : (state.message ?? (state.loading ? 'loading candles…' : 'no candles'));

  if (!ks.length) { svg.innerHTML = ''; state.frame = null; return; }

  const plotW = Math.max(1, W - PAD_R);
  const plotH = Math.max(1, H - PAD_B);

  let lo = Infinity, hi = -Infinity;
  for (const k of ks) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; }
  const span = hi - lo;
  const pad = span > 0 ? span * 0.08 : Math.max(hi * 0.02, 0.05);
  const loV = lo - pad, hiV = hi + pad;
  const Y = (p) => plotH - ((p - loV) / (hiV - loV)) * plotH;

  // Candles are indexed, not time-scaled: a lunch lull or a halt must not stretch the bars.
  const slot = plotW / ks.length;
  const bw = Math.max(1, Math.min(15, slot * 0.68));
  const xc = (i) => (i + 0.5) * slot;
  state.frame = { W, H, plotW, plotH, slot, n: ks.length, loV, hiV };

  const bodies = { up: '', down: '', blue: '', yellow: '' };
  const wicks = { up: '', down: '', blue: '', yellow: '' };

  for (let i = 0; i < ks.length; i++) {
    const k = ks[i];
    const g = groupOf(k);
    const x = xc(i);
    const x0 = x - bw / 2, x1 = x + bw / 2;
    let top = Math.min(Y(k.o), Y(k.c));
    let bot = Math.max(Y(k.o), Y(k.c));
    if (bot - top < 1) { const m = (top + bot) / 2; top = m - 0.5; bot = m + 0.5; }
    bodies[g] += `M${x0.toFixed(1)} ${top.toFixed(1)}H${x1.toFixed(1)}V${bot.toFixed(1)}H${x0.toFixed(1)}Z`;
    wicks[g] += `M${x.toFixed(1)} ${Y(k.h).toFixed(1)}V${Y(k.l).toFixed(1)}`;
  }

  /* four price guides, drawn under everything */
  let guides = '';
  for (let i = 0; i <= 3; i++) {
    const p = loV + ((hiV - loV) * i) / 3;
    const y = Y(p);
    guides += `<line x1="0" y1="${y.toFixed(1)}" x2="${plotW.toFixed(1)}" y2="${y.toFixed(1)}" `
      + `stroke="var(--border)" stroke-width="1" stroke-dasharray="2 4"/>`
      + `<text x="${(plotW + 6).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" fill="var(--fg-faint)" `
      + `font-family="${MONO}" font-size="9.5">${inr(p)}</text>`;
  }

  const series = GROUPS.map(g =>
    (wicks[g] ? `<path d="${wicks[g]}" fill="none" stroke="${PAINT[g].line}" stroke-width="1"/>` : '')
    + (bodies[g] ? `<path d="${bodies[g]}" fill="${PAINT[g].fill}" stroke="${PAINT[g].line}" stroke-width="1"/>` : '')
  ).join('');

  /* time labels: first, last, and up to three inside */
  let times = '';
  const steps = Math.min(4, ks.length - 1);
  for (let i = 0; i <= steps; i++) {
    const idx = Math.round((i * (ks.length - 1)) / Math.max(1, steps));
    const x = Math.min(plotW, Math.max(0, xc(idx)));
    times += `<text x="${x.toFixed(1)}" y="${H - 3}" fill="var(--fg-faint)" font-family="${MONO}" `
      + `font-size="9" text-anchor="${i === 0 ? 'start' : i === steps ? 'end' : 'middle'}">`
      + `${esc(ks[idx].at)}</text>`;
  }

  /* last close, on the axis, in that candle's own colour */
  const last = ks[ks.length - 1];
  const lastG = groupOf(last);
  const pillY = Math.min(Math.max(Y(last.c), 9), plotH - 9);
  const pill = `<rect x="${(plotW + 2).toFixed(1)}" y="${(pillY - 9).toFixed(1)}" width="${PAD_R - 6}" `
    + `height="18" rx="3" fill="${PAINT[lastG].fill}"/>`
    + `<text x="${(plotW + 7).toFixed(1)}" y="${(pillY + 3.5).toFixed(1)}" fill="var(--bg-panel)" `
    + `font-family="${MONO}" font-size="10.5" font-weight="600">${inr(last.c)}</text>`;

  /* hover guide */
  let cross = '';
  if (state.hover >= 0 && state.hover < ks.length) {
    const x = xc(state.hover);
    cross = `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${plotH.toFixed(1)}" `
      + `stroke="var(--fg-faint)" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>`;
  }

  svg.innerHTML = guides + series + times + pill + cross;
}

function paint() {
  if (state.dirty && state.active) {
    state.dirty = false;
    const t0 = performance.now();
    drawCandles();
    window.__candles.paintMs = performance.now() - t0;
    window.__candles.frames++;
    window.__candles.paints.push(window.__candles.paintMs);
    if (window.__candles.paints.length > 400) window.__candles.paints.shift();
  }
  requestAnimationFrame(paint);
}
requestAnimationFrame(paint);

/* ---------------------------------------------------------------- tooltip */

/**
 * Row 13. This is what makes the acceptance criteria checkable at all: the tooltip prints the
 * exact four inputs the colour was computed from, so a reader can redo the arithmetic without
 * trusting the code that did it.
 */
function showTip(i, clientX, clientY) {
  const ks = state.data?.candles ?? [];
  const k = ks[i];
  const tip = $('candleTip');
  if (!k) { hideTip(); return; }

  const d = state.data;
  const prevOi = k.dOi === null ? null : k.oi - k.dOi;
  const verdict = k.inProgress ? 'no — still forming'
    : k.fired === 'blue' ? 'blue — big player entering'
    : k.fired === 'yellow' ? 'yellow — big player exiting'
    : 'no';

  const row = (a, b, extra = '') => `<tr><th>${a}</th><td class="${extra}">${b}</td></tr>`;
  tip.innerHTML =
    `<div class="tt-h">${esc(k.at)} · ${esc(d.interval)}m</div>`
    + '<table>'
    + row('O / H', `${inr(k.o)} / ${inr(k.h)}`)
    + row('L / C', `${inr(k.l)} / ${inr(k.c)}`)
    + row('Volume', abbr(k.volume))
    + row('median20', k.median20 === null ? '— (fewer than 20 predecessors)' : abbr(k.median20))
    + row('vol / median', `${ratio(k.volRatio)} ${k.volPass ? '✓' : '✗'} ≥ 3.00×`,
      k.volPass ? 'ok' : 'no')
    + row('OI', abbr(k.oi))
    + row('oi[i−1]', prevOi === null ? '—' : abbr(prevOi))
    + row('ΔOI', `${signedAbbr(k.dOi)} (${signedPct(k.dOiPct)}) ${k.oiPass ? '✓' : '✗'} ≥ 5% and ≥ ${abbr(d.oiFloor)}`,
      k.oiPass ? 'ok' : 'no')
    + row('fired', esc(verdict), k.fired ?? '')
    + '</table>';

  tip.hidden = false;
  const wrap = $('chartBody').getBoundingClientRect();
  const box = tip.getBoundingClientRect();
  const left = Math.min(Math.max(clientX - wrap.left + 14, 4), wrap.width - box.width - 4);
  const top = Math.min(Math.max(clientY - wrap.top - box.height / 2, 4), wrap.height - box.height - 4);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideTip() { $('candleTip').hidden = true; }

/* ------------------------------------------------------------------ wiring */

/* Row 1. Delegated click on #ocBody; the rows already carry data-strike, and no other row click
   handler exists, so nothing conflicts. */
$('ocBody').addEventListener('click', (e) => {
  const td = e.target.closest('td');
  if (!td) return;
  const tr = td.closest('tr');
  if (!tr || !tr.dataset.strike) return;
  const idx = [...tr.children].indexOf(td);
  if (idx < 0 || idx === 12) return;             // the strike spine itself charts nothing
  select(Number(tr.dataset.strike), idx < 12 ? 'ce' : 'pe');
});

/* app.js announces which chip and expiry the chain is on, and when it has re-rendered the
   tbody (which drops the selection outline). One-way — app.js imports nothing from here. */
document.addEventListener('chain-scope', (e) => {
  const next = e.detail;
  const changed = !state.scope || state.scope.id !== next.id || state.scope.expiry !== next.expiry;
  state.scope = next;
  // A contract belongs to one instrument and one expiry. Carrying a NIFTY strike across to
  // BANKNIFTY would chart a contract the reader never asked for.
  if (changed && state.active) back();
  else renderHead();
});
document.addEventListener('chain-render', markRow);

$('candleBack').addEventListener('click', back);
$('candleInterval').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setInterval_(b.dataset.iv);
});

{
  const surface = $('candleSurface');
  const indexAt = (e) => {
    const f = state.frame;
    if (!f) return -1;
    const r = surface.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x < 0 || x > f.plotW) return -1;
    return Math.min(f.n - 1, Math.max(0, Math.floor(x / f.slot)));
  };
  surface.addEventListener('pointermove', (e) => {
    const i = indexAt(e);
    if (i !== state.hover) { state.hover = i; state.dirty = true; }
    if (i < 0) hideTip(); else showTip(i, e.clientX, e.clientY);
  });
  surface.addEventListener('pointerleave', () => {
    state.hover = -1;
    state.dirty = true;
    hideTip();
  });
}

/* Esc leaves option mode. app.js's handler runs first but tools.onKey() only claims Esc when a
   drawing is in flight, and the tools are disabled here anyway (row 17). */
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === 'Escape' && state.active) { back(); return; }
});

window.addEventListener('resize', () => { state.dirty = true; });

/**
 * Read-only test seam for the replay verification scripts, mirroring `window.__chart`.
 * Nothing in the app reads it.
 */
window.__candles = {
  paintMs: 0,
  frames: 0,
  paints: [],
  active: () => state.active,
  data: () => state.data,
  sel: () => state.sel,
  interval: () => state.interval,
  message: () => state.message,
  fired: () => (state.data?.candles ?? []).map(k => k.fired),
  select, back,
  setInterval: setInterval_,
  hoverAt: (i) => {
    state.hover = i;
    state.dirty = true;
    const r = $('candleSurface').getBoundingClientRect();
    showTip(i, r.left + 20, r.top + r.height / 2);
  },
  repaint: () => { state.dirty = true; },
};
