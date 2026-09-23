/**
 * The LTP Calculator workspace — `docs/spec/ltp-calculator-v1.md` rows 23-26, layers L0-L3 and L6.
 *
 * Reads `/api/ltp`, which is a second READING of the chain the option-chain workspace already
 * subscribes to (spec row 8) — this makes no Dhan call of its own and starts no poller.
 *
 * SHAPE: the same one-directional shape `scan.js` uses. This module owns `#ltp`, `#ltpTab` and
 * nothing else; it imports nothing downstream of itself, so there is no ESM cycle. Workspace
 * switching is carried by ONE CustomEvent, `ws`, on `document` — each workspace announces that it
 * opened and closes itself when it hears another one open.
 *
 * TWO TRAPS THIS FILE IS WRITTEN AROUND:
 *
 *  1. **A CSS layout rule outranks the `hidden` attribute.** `.scan{position:fixed;display:flex}`
 *     once beat the UA stylesheet's `[hidden]{display:none}` and the scanner panel was on screen
 *     from page load with no way to dismiss it. `.ltp` therefore has an explicit
 *     `.ltp[hidden]{display:none!important}` in app.css.
 *  2. **"Max Pain" here means STOP LOSS and "Max Gain" means TARGET** (spec row 1). They belong to
 *     L10 and are not on this screen at all — but do not "fix" a later label to the industry
 *     meaning, because they do not carry it.
 *
 * Everything on screen is in STRIKE space (spec row 5). `screenDir()` below is the ONLY place that
 * knows which way the grid points, and the engine never calls it.
 */

const $ = (id) => document.getElementById(id);
const WS_KEY = 'ws';

const state = {
  open: false,
  loading: false,
  reading: null,
  meta: null,
  error: null,
  /** The chip the chain workspace is on, so both screens agree on the instrument. */
  key: null,
  expiry: null,
  timer: null,
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const num = (v, dp = 2) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : '—';

const int = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-IN') : '—');

/**
 * Spec rows 5 and 6 — **the only function on the client that knows which way the screen points.**
 *
 * The corpus's vocabulary is in STRIKE space ("top of the chain" = the highest strike), while the
 * grid prints the SMALLEST strike first (`derive.ts:106` sorts ascending). So a move to a bigger
 * strike is bullish and, on this grid, draws DOWNWARD. That is why V121 ("an upward arrow means
 * bearish") and V112 ("smaller to larger strike is bullish") say the same thing — see OQ-35.
 */
function screenDir(fromStrike, toStrike) {
  if (toStrike === fromStrike) return 'flat';
  return toStrike > fromStrike ? 'down' : 'up';   // bigger strike prints lower on an ascending grid
}

/** The arrow glyph for a strike-space move, once it has been turned into a screen direction. */
function arrow(fromStrike, toStrike) {
  const d = screenDir(fromStrike, toStrike);
  return d === 'flat' ? '•' : d === 'down' ? '↓' : '↑';
}

/* ------------------------------------------------------- workspace switch */

function setTabs() {
  const t = $('ltpTab');
  if (t) t.setAttribute('aria-selected', String(state.open));
}

function saveWs(v) {
  try { localStorage.setItem(WS_KEY, v); } catch { /* private window, quota — not fatal */ }
}

function open() {
  if (state.open) return;
  state.open = true;
  $('ltp').hidden = false;
  setTabs();
  saveWs('ltp');
  // Announce, so the scanner (and anything added later) closes itself. One event, one direction.
  document.dispatchEvent(new CustomEvent('ws', { detail: 'ltp' }));
  load();
  // The chain polls every 3 s; matching it would re-render on every snapshot for no gain, because
  // levels move far more slowly than LTP. 5 s is a readable cadence that cannot outrun the source.
  state.timer = setInterval(load, 5000);
  $('ltpTab').focus({ preventScroll: true });
}

function close() {
  if (!state.open) return;
  state.open = false;
  $('ltp').hidden = true;
  setTabs();
  clearInterval(state.timer);
  state.timer = null;
}

/* ------------------------------------------------------------------ load */

async function load() {
  // `chain-scope` fires on every chip change, but this module attaches its listener after app.js
  // has already dispatched the first one — so on a cold open there is nothing to have heard yet.
  // `window.__grid` is app.js's existing read-only seam and is the same source of truth, not a
  // second one.
  if (!state.key) {
    state.key = window.__grid?.key?.() ?? null;
    state.expiry = state.expiry ?? window.__grid?.expiry?.() ?? null;
  }
  if (!state.key) {
    state.error = 'no instrument selected yet — open the Option chain workspace once';
    render();
    return;
  }
  state.loading = !state.reading;
  const url = `/api/ltp?key=${encodeURIComponent(state.key)}`
    + (state.expiry ? `&expiry=${encodeURIComponent(state.expiry)}` : '');
  try {
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) {
      // A 503 with a note is the chain not having polled yet — a WAITING state, not a failure.
      state.error = body.note ?? body.error ?? `HTTP ${res.status}`;
      state.reading = null;
    } else {
      state.reading = body.reading;
      state.meta = body;
      state.error = null;
    }
  } catch (e) {
    state.error = `could not reach the backend — ${e}`;
  }
  state.loading = false;
  render();
}

/* ---------------------------------------------------------------- render */

function levelCard(title, L, spot, side) {
  if (!L) {
    return `<article class="ltp-card ltp-${side}">
      <h3>${title}</h3>
      <p class="ltp-none">No level found on this side yet. The outward scan needs at least one
      strike with volume or open interest beyond the imaginary line.</p></article>`;
  }
  const gradeLabel = { strong: 'Strong', wtt: 'Weak towards top', wtb: 'Weak towards bottom' }[L.grade];
  const reach = L.reversal === null ? null : (side === 'res' ? L.reversal - spot : spot - L.reversal);
  const ch = L.volume?.challenger ?? L.oi?.challenger ?? null;
  return `<article class="ltp-card ltp-${side}">
    <h3>${title}</h3>
    <div class="ltp-strike">${int(L.strike)}<span class="ltp-unit">strike</span></div>
    <div class="ltp-grade ltp-g-${L.grade}">${gradeLabel}</div>
    <dl class="ltp-facts">
      <dt>Reversal price</dt>
      <dd class="ltp-rev">${num(L.reversal)}</dd>
      <dt>Room to it</dt>
      <dd>${reach === null ? '—' : `${num(reach)} pts`}</dd>
      <dt>Built on</dt>
      <dd>${L.builtOn.map(b => (b === 'oi' ? 'OI' : 'volume')).join(' + ')}</dd>
      <dt>Challenger</dt>
      <dd>${ch ? `${int(ch.strike)} at ${ch.pct.toFixed(1)}% ${arrow(L.strike, ch.strike)}
           <span class="ltp-q">${ch.qualifies ? 'qualifies' : 'below 75%'}</span>` : 'none'}</dd>
      ${L.itm ? `<dt>In the money</dt><dd>${L.itmBy} strike${L.itmBy === 1 ? '' : 's'}</dd>` : ''}
    </dl>
    <p class="ltp-why">${esc(L.why)}</p>
  </article>`;
}

function render() {
  const el = $('ltpBody');
  if (!el) return;

  if (state.error) {
    el.innerHTML = `<div class="ltp-msg"><b>Waiting for the chain.</b><p>${esc(state.error)}</p>
      <p class="ltp-hint">This screen reads the option chain's own snapshot and makes no request of
      its own. Open the Option chain workspace once and it will fill.</p></div>`;
    return;
  }
  if (!state.reading) {
    el.innerHTML = `<div class="ltp-msg">${state.loading ? 'Reading the chain…' : 'No reading yet.'}</div>`;
    return;
  }

  const r = state.reading;
  const m = state.meta ?? {};

  // Spec row 10 / V08. A refusal, stated in words — not an empty screen.
  if (!r.pair) {
    el.innerHTML = `<div class="ltp-msg ltp-refuse"><b>No levels calculated.</b>
      <p>${esc(r.note ?? 'the chain could not be read')}</p>
      <p class="ltp-hint">This is deliberate, not a failure. The imaginary line needs a strike on
      each side of spot; with spot exactly on a strike the real tool stops calculating too (V08).</p>
      </div>`;
    return;
  }

  const spot = r.spot;
  const ladder = r.ladder;
  // Show the ladder around the ATM only — the full 268 rows is a data dump, not a screen.
  const i = ladder.findIndex(x => x.strike === r.ltpAtm);
  const from = Math.max(0, i - 6), to = Math.min(ladder.length, i + 7);
  const rows = ladder.slice(from, to).map(x => {
    const isAtm = x.strike === r.ltpAtm;
    const isRes = r.resistance && x.strike === r.resistance.strike;
    const isSup = r.support && x.strike === r.support.strike;
    const tag = isRes ? '<span class="ltp-tag r">R</span>'
      : isSup ? '<span class="ltp-tag s">S</span>' : '';
    return `<tr class="${isAtm ? 'atm' : ''}">
      <td class="mono num">${num(x.call, 1)}</td>
      <td class="mono num strike">${int(x.strike)} ${tag}</td>
      <td class="mono num">${num(x.put, 1)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="ltp-top">
      <div class="ltp-spot">
        <span class="ltp-lab">Spot</span>
        <b class="mono">${num(spot)}</b>
        <span class="ltp-src">${esc(m.spotSource ?? '')}</span>
      </div>
      <div class="ltp-line">
        <span class="ltp-lab">Imaginary line</span>
        <b class="mono">${int(r.pair.lower)} — ${int(r.pair.upper)}</b>
      </div>
      <div class="ltp-atm">
        <span class="ltp-lab">ATM <em>by time value</em></span>
        <b class="mono">${int(r.ltpAtm)}</b>
        ${r.ltpAtmTie ? '<span class="ltp-tie" title="Both strikes carry equal time value — OQ-26">tie</span>' : ''}
      </div>
      <div class="ltp-fwd">
        <span class="ltp-lab">Implied forward</span>
        <b class="mono">${num(r.impliedForward, 1)}</b>
        <span class="ltp-src">basis ${num(r.basis, 1)}</span>
      </div>
    </div>

    <div class="ltp-cards">
      ${levelCard('Resistance · call side', r.resistance, spot, 'res')}
      ${levelCard('Support · put side', r.support, spot, 'sup')}
    </div>

    <section class="ltp-ladder">
      <h3>Reversal ladder <span class="ltp-sub">strike ± that side's LTP — the writer's break-even</span></h3>
      <table class="ltp-tab">
        <thead><tr><th>Call reversal</th><th>Strike</th><th>Put reversal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="ltp-foot">Showing 13 of ${ladder.length} strikes, centred on the time-value ATM.
        Every call reversal sits at or above its strike and every put reversal at or below —
        at expiry they converge on intrinsic value.</p>
    </section>

    <p class="ltp-prov">${esc(m.instrument ?? '')} · ${esc(m.expiry ?? '')} ·
      ${m.sessionOpen ? 'session open' : 'session closed'} ·
      snapshot ${m.receivedAt ? new Date(m.receivedAt).toLocaleTimeString('en-GB', { hour12: false }) : '—'} ·
      layers L0–L3 and L6 of <code>ltp-calculator-v1.md</code></p>`;
}

/* ------------------------------------------------------------------ wire */

$('ltpTab')?.addEventListener('click', () => (state.open ? close() : open()));

// Another workspace opened — stand down. Same one-directional shape scan.js uses.
document.addEventListener('ws', (e) => { if (e.detail !== 'ltp') close(); });

// The chain workspace tells us which chip and expiry are live, so both screens agree. app.js
// already emits `chain-scope` for the candle strip; this listens to the same one rather than
// adding a second source of truth.
document.addEventListener('chain-scope', (e) => {
  const d = e.detail ?? {};
  // app.js:191 sends `{ id, label, expiry, lot }` — `id`, not `key`. Reading `d.key` here would
  // silently never fire and this screen would sit on whatever it opened with.
  if (d.id) state.key = d.id;
  if (d.expiry) state.expiry = d.expiry;
  if (state.open) load();
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === 'Escape' && state.open) { close(); return; }
  if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    state.open ? close() : open();
  }
});

/** Read-only test seam, beside window.__chart / __grid / __scan. Nothing in the app reads it. */
window.__ltp = {
  open: () => state.open,
  reading: () => state.reading,
  meta: () => state.meta,
  error: () => state.error,
  screenDir,
  reload: load,
};

// P16 row 3 / spec row 23: the page opens on whichever workspace it was last on.
try {
  if (localStorage.getItem(WS_KEY) === 'ltp') queueMicrotask(open);
} catch { /* private window — open on the default workspace */ }
