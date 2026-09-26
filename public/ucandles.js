/* P19 — underlying candles. Spec: docs/spec/underlying-candles-v1.md.

   The chip's own underlying as OHLC candles in the main chart strip (and in the Chart Style
   dialog's preview). This module is a LEAF: it imports only the indicator math (P57's
   indicators.js, itself a leaf), so app.js and chart-style.js can
   both import it without a cycle. It owns three things:

   - the data: one `/api/ucandles` payload for the current chip and interval, re-fetched every
     60 s while that chip's session is open (row 4), with feed ticks merged into the forming candle
   - the arithmetic: SMA series, the price range, nice axis steps
   - the markup: one SVG string, drawn through whatever X()/Y() the caller hands in, so the strip
     (which borrows chart-tools' X/Y, keeping P6 drawings anchored) and the preview (its own X/Y)
     can never draw the same candle two different ways */

import { emaSeries, vwapSeries, supertrendSeries, bollingerSeries, hasVolume, rsiSeries, macdSeries } from '/indicators.js';

/** P58 row 2: the lower pane's height for a strip SVG `H` tall, or 0 when no pane is chosen. */
export function paneHeight(style, H) {
  const k = style?.ind?.pane?.kind;
  return k && k !== 'none' ? Math.max(48, Math.round(0.30 * H)) : 0;
}
/** P58 rows 3-4: line colours (GUESS). */
const PANE_COL = { rsi: '#A78BFA', macd: '#60A5FA', signal: '#F97316' };

/** Row 3. */
export const INTERVALS = ['1', '5', '15'];
/** Row 4. */
const REFRESH_MS = 60_000;
/** panel-windows-v1.md row 8. A FAILED fetch does not wait for the next refresh: it backs off
 *  through this ladder and resets to the head on the first success. Measured before it was
 *  written — reusing REFRESH_MS as the retry cadence cost up to 60 s of dead chart for a 2 s
 *  server restart (the table at the top of that spec). */
const RETRY_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000];
/** Same content box as drawChart() and chart-tools (chart-tools-v1.md row 1). */
export const PAD_R = 76;
export const PAD_B = 16;
/** Row 8 (guess, locked). */
const LABEL_GAP_PX = 28;
/** Amendment 26 (guess, locked): time labels sit on IST clock boundaries at least this far apart. */
const TIME_GAP_PX = 72;
const TIME_STEPS_MIN = [5, 15, 30, 60, 120, 240];
const MONO = 'Inter, system-ui, sans-serif';
const IST_MS = 5.5 * 3600 * 1000;

/* ------------------------------------------------------------------- store */

const store = {
  key: null,
  label: '',
  interval: INTERVALS.includes(safeGet('ucandleInterval')) ? safeGet('ucandleInterval') : '5',
  data: null,
  loading: false,
  message: null,
  openNow: false,
  lastFetch: 0,
  timer: null,
  /** Bumped per request, so a slow reply for an old chip or interval can never paint. */
  seq: 0,
  /** Bumped on every change to `data`, so a caller can cache work per version. */
  version: 0,
  /** Row 8. Index into RETRY_MS; 0 means the last fetch succeeded. */
  retryStep: 0,
  /** Row 9. Epoch ms of the next automatic attempt, or 0 when nothing is scheduled. */
  retryAt: 0,
  /** Row 16. 1 s repaint ticker, alive only while an error is on screen. */
  cdTimer: null,
  /** The error without the "retrying in Ns" tail, so the tail can be recomputed every second. */
  errorText: null,
};

let onChange = () => {};

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

export function init(opts) { onChange = opts.onChange ?? onChange; }
export function current() { return store; }

function changed() { store.version++; onChange(); }

/** Chip switch. Candles belong to one underlying; the old ones go at once (P9 AC5's rule). */
export function setScope(key, label) {
  if (store.key === key) return;
  store.key = key;
  store.label = label;
  store.data = null;
  store.message = null;
  refresh(true);
}

export function setInterval_(iv) {
  if (!INTERVALS.includes(iv) || iv === store.interval) return;
  store.interval = iv;
  safeSet('ucandleInterval', iv);
  store.data = null;
  store.message = null;
  refresh(true);
}

function schedule(ms) {
  clearTimeout(store.timer);
  store.timer = setTimeout(() => refresh(false), ms);
}

/* ------------------------------------------------------- failure and retry */

/** Row 9. The seconds left before the next automatic attempt, never below 0. */
function secondsLeft() {
  return Math.max(0, Math.ceil((store.retryAt - Date.now()) / 1000));
}

/** Rows 9 and 16. One repaint a second while an error is up, and not one after it clears. */
function startCountdown() {
  if (store.cdTimer) return;
  store.cdTimer = setInterval(() => {
    if (!store.errorText) { stopCountdown(); return; }
    store.message = `${store.errorText} — retrying in ${secondsLeft()} s`;
    changed();
  }, 1000);
}

function stopCountdown() {
  clearInterval(store.cdTimer);
  store.cdTimer = null;
}

/** Row 8. Called on every failed fetch. */
function failed(error) {
  const wait = RETRY_MS[Math.min(store.retryStep, RETRY_MS.length - 1)];
  store.retryStep = Math.min(store.retryStep + 1, RETRY_MS.length - 1);
  store.retryAt = Date.now() + wait;
  store.errorText = error;
  store.message = `${error} — retrying in ${Math.round(wait / 1000)} s`;
  schedule(wait);
  startCountdown();
}

/**
 * P27 / underlying-candles-v1.md row 21. A REFUSAL is not a blip: the server answered and said
 * no, so it does not enter P26 row 8's ladder and waits the ordinary REFRESH_MS instead. But the
 * screen must still say WHEN it will try again — that is what row 21 promised, and P26's
 * blip-vs-refusal split quietly dropped it, leaving "request failed (DH-904)" on screen with
 * nothing to say it was coming back. P19's own suite had been reporting that as a red line.
 */
function refused(error) {
  succeeded();
  store.retryStep = 0;                       // a refusal never advances the blip ladder
  store.retryAt = Date.now() + REFRESH_MS;
  store.errorText = error;
  store.message = `${error} — retrying in ${Math.round(REFRESH_MS / 1000)} s`;
  schedule(REFRESH_MS);
  startCountdown();
}

/** Row 8. Called on every successful fetch. */
function succeeded() {
  store.retryStep = 0;
  store.retryAt = 0;
  store.errorText = null;
  stopCountdown();
}

/** Row 9's button. Also row 10's path: an immediate attempt that cancels the pending backoff. */
export function retryNow() {
  if (!store.key) return;
  clearTimeout(store.timer);
  store.retryAt = 0;
  refresh(true);
}

/** Row 10. The feed came back; anything showing an error tries again at once rather than
 *  sitting out the rest of its backoff. Healthy panels are left alone. */
export function onReconnect() {
  if (store.errorText) retryNow();
}

export async function refresh(showLoading) {
  if (!store.key) return;
  const seq = ++store.seq;
  const key = store.key, interval = store.interval;
  if (showLoading) { store.loading = true; changed(); }
  store.lastFetch = Date.now();

  // `unreachable` separates "the server answered and said no" from "there is no server". Only
  // the second is a blip, and only the second enters row 8's ladder — a 400 for a bad interval
  // would otherwise be re-asked every two seconds forever.
  let body = null, error = null, unreachable = false;
  try {
    const res = await fetch(`/api/ucandles?key=${encodeURIComponent(key)}&interval=${interval}`);
    body = await res.json();
    if (!res.ok || body.error) error = body.error ?? `HTTP ${res.status}`;
  } catch (err) {
    error = `could not reach the backend — ${err}`;
    unreachable = true;
  }
  if (seq !== store.seq) return;                     // a newer request has already been sent
  store.loading = false;

  if (error) {
    // Row 21: say so and actually retry. A refresh that fails keeps the candles already on
    // screen — they are still true, only no longer extending.
    // panel-windows-v1.md row 8: the retry ladder for a blip, REFRESH_MS for a real refusal.
    if (unreachable) { failed(error); }
    else { refused(error); }
  } else {
    succeeded();
    store.openNow = !!body.openNow;
    store.data = body;
    store.message = body.note ?? null;
    // Row 4: a shut session cannot change, so it is fetched once. A tick on a newer date
    // (onTick below) is what brings it back to life on the next session's open.
    if (store.openNow) schedule(REFRESH_MS); else clearTimeout(store.timer);
  }
  changed();
}

/* ------------------------------------------------------------ forming candle */

export const istDate = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);

/**
 * Row 4. Pure apart from mutating `candles`, so the verification script can drive it through the
 * test seam on a closed market. Returns what it did: 'merged' | 'opened' | 'ignored'.
 *
 * New candles open on the grid of the session's FIRST candle (09:15 for NSE, 09:00 for MCX),
 * not on the tick's own minute, or a quiet first minute would shift every later candle.
 */
export function mergeTick(candles, sessionStart, tick, ivMs, sessionDate) {
  if (!candles.length || !Number.isFinite(tick.p) || !Number.isFinite(tick.t)) return 'ignored';
  if (istDate(tick.t) !== sessionDate) return 'ignored';
  const last = candles[candles.length - 1];
  if (tick.t < last.t) return 'ignored';
  if (tick.t < last.t + ivMs) {
    if (tick.p > last.h) last.h = tick.p;
    if (tick.p < last.l) last.l = tick.p;
    last.c = tick.p;
    return 'merged';
  }
  const base = candles[Math.min(sessionStart, candles.length - 1)].t;
  const open = base + Math.floor((tick.t - base) / ivMs) * ivMs;
  const t = new Date(open + IST_MS).toISOString();
  candles.push({ t: open, at: t.slice(11, 16), d: t.slice(0, 10), o: tick.p, h: tick.p, l: tick.p, c: tick.p });
  return 'opened';
}

/** Underlying tick from the feed (epoch ms, price). */
export function onTick(t, p) {
  const d = store.data;
  if (!d || !d.candles.length || !d.sessionDate) return;
  const ivMs = Number(d.interval) * 60_000;

  // chart-nav-v1.md amendment 21. A SHUT session cannot grow a candle. The replay feed keeps
  // ticking after 15:30, and without this guard mergeTick opened a lone candle at the wall
  // clock — measured 2026-09-22 at 21:15 IST as one candle 5 h 50 min after the 15:25 close,
  // with nothing in between. That empty stretch is real data to every zoom, pan and price-range
  // rule downstream, and almost every session on this project is outside 09:15-15:30.
  // The server, not the tick, decides the session is open: one throttled refresh asks it.
  if (!store.openNow) {
    if (t >= d.candles[d.candles.length - 1].t + ivMs
        && Date.now() - store.lastFetch >= REFRESH_MS) refresh(false);
    return;
  }

  const r = mergeTick(d.candles, d.sessionStart, { t, p }, ivMs, d.sessionDate);
  if (r !== 'ignored') { changed(); return; }
  // A tick from a later date than the drawn session means a new session has opened since the
  // last fetch. Fetch it, but no more than once a minute however many ticks arrive meanwhile.
  if (istDate(t) > d.sessionDate && Date.now() - store.lastFetch >= REFRESH_MS) refresh(false);
}

/* ---------------------------------------------------------------- arithmetic */

/** Row 12. Rolling mean over the WHOLE window (context days included); null where fewer than
 *  `period` candles exist, so a partial average is never drawn as if it were a full one. */
export function smaSeries(candles, period) {
  const out = new Array(candles.length).fill(null);
  if (!(period >= 1)) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].c;
    if (i >= period) sum -= candles[i - period].c;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Row 8: 1 / 2 / 2.5 / 5 × 10ⁿ, the smallest that keeps labels `LABEL_GAP_PX` apart. */
export function niceStep(span, plotH) {
  const want = span / Math.max(1, Math.floor(plotH / LABEL_GAP_PX));
  const p = 10 ** Math.floor(Math.log10(Math.max(want, 1e-9)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= want) return m * p;
  return 10 * p;
}

/**
 * Everything the renderer needs that does not depend on pixels. `zoom` is chart-tools'
 * applyZoom in the strip (so the axis drag works, row 8) and identity in the preview.
 *
 * Amendment 25: a candle's CENTRE sits at its open time, so the x range runs from the first open
 * minus half an interval to the last open plus half. That keeps the crosshair's snapped time
 * label reading 09:15:00 rather than 09:17:30 without touching chart-tools.
 */
export function buildView(data, style, zoom = (a, b) => [a, b], timeWin = (a, b) => [a, b]) {
  const all = data?.candles ?? [];
  const s = Math.min(data?.sessionStart ?? 0, Math.max(0, all.length - 1));
  const vis = all.slice(s);
  if (!vis.length) return null;
  const ivMs = Number(data.interval) * 60_000;

  const smas = (style?.sma ?? []).filter(x => x.on).map(x => ({
    color: x.color, period: x.period, vals: smaSeries(all, x.period),
  }));
  const ind = indicatorsFor(all, style?.ind);

  // chart-nav-v1.md rows 1 and 9: the time window first, then the price range of what that
  // window actually contains. Fitting price to the whole session while showing ten minutes of
  // it would leave the ten minutes as a flat line — the zoom would be decorative.
  const T0 = vis[0].t - ivMs / 2;
  const T1 = vis[vis.length - 1].t + ivMs / 2;
  const [t0, t1] = timeWin(T0, T1);
  const inWin = (t) => t >= t0 - ivMs / 2 && t <= t1 + ivMs / 2;
  const whole = t0 <= T0 && t1 >= T1;

  let lo = Infinity, hi = -Infinity;
  for (const k of vis) {
    if (!whole && !inWin(k.t)) continue;
    if (k.l < lo) lo = k.l;
    if (k.h > hi) hi = k.h;
  }
  // P57 row 13: every drawn indicator joins the price fit, as the SMAs do.
  for (const m of [...smas, ...ind.lines]) {
    for (let i = s; i < all.length; i++) {
      const v = m.vals[i];
      if (v === null || (!whole && !inWin(all[i].t))) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  // A window narrower than one candle's slot can contain no centre at all; fall back rather
  // than hand the renderer an infinite range.
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = Infinity; hi = -Infinity;
    for (const k of vis) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; }
  }
  const span = hi - lo;
  const pad = span > 0 ? span * 0.08 : Math.max(hi * 0.0005, 0.05);   // row 8
  const [loV, hiV] = zoom(lo - pad, hi + pad);

  return {
    all, s, vis, ivMs, smas, ind,
    t0, t1, T0, T1,
    lo: loV, hi: hiV,
    // the crosshair snaps to these (row 11)
    pts: vis.map(k => ({ t: k.t, p: k.c })),
  };
}

/**
 * P57: the active indicators as drawable lines (`vals` aligned to `all`, like an SMA's) plus what
 * the legend needs. Supertrend is one line whose colour follows its direction (`dir`).
 */
export function indicatorsFor(all, cfg) {
  const lines = [];
  const legend = [];
  if (!cfg) return { lines, legend };
  if (cfg.vwap?.on) {
    if (hasVolume(all)) {
      const vals = vwapSeries(all);
      lines.push({ key: 'vwap', color: cfg.vwap.color, width: 1.5, vals });
      legend.push({ key: 'vwap', name: 'VWAP', color: cfg.vwap.color, vals });
    } else {
      legend.push({ key: 'vwap', name: 'VWAP', color: cfg.vwap.color, vals: null, note: 'no volume' });
    }
  }
  for (const [n, e] of (cfg.ema ?? []).entries()) {
    if (!e?.on) continue;
    const vals = emaSeries(all, e.period);
    lines.push({ key: `ema${n}`, color: e.color, width: 1.5, vals });
    legend.push({ key: `ema${n}`, name: `EMA ${e.period}`, color: e.color, vals });
  }
  if (cfg.bb?.on) {
    const b = bollingerSeries(all, cfg.bb.period, cfg.bb.mult);
    lines.push({ key: 'bbU', color: cfg.bb.color, width: 1, vals: b.upper });
    lines.push({ key: 'bbB', color: cfg.bb.color, width: 1, dash: '4 3', vals: b.basis });
    lines.push({ key: 'bbL', color: cfg.bb.color, width: 1, vals: b.lower });
    legend.push({ key: 'bb', name: `BB ${cfg.bb.period},${cfg.bb.mult}`, color: cfg.bb.color, vals: b.upper, lower: b.lower });
  }
  if (cfg.st?.on) {
    const st = supertrendSeries(all, cfg.st.period, cfg.st.mult);
    lines.push({ key: 'st', trend: st.dir, width: 1.6, vals: st.line });
    legend.push({ key: 'st', name: `ST ${cfg.st.period},${cfg.st.mult}`, trend: st.dir, vals: st.line });
  }
  return { lines, legend };
}

/** Index into `view.vis` of the candle under a plot x, or -1. */
export function indexAt(view, t) {
  if (!view) return -1;
  const i = Math.round((t - view.vis[0].t) / view.ivMs);
  if (i < 0 || i >= view.vis.length) return -1;
  // Time-scaled, so a halt leaves a gap; pick the nearest real candle rather than the slot.
  let best = -1, bd = Infinity;
  for (let j = Math.max(0, i - 2); j <= Math.min(view.vis.length - 1, i + 2); j++) {
    const d = Math.abs(view.vis[j].t - t);
    if (d < bd) { bd = d; best = j; }
  }
  return bd <= view.ivMs ? best : -1;
}

/* ------------------------------------------------------------------- markup */

const f1 = (v) => v.toFixed(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * One SVG string. `o` carries the frame (W, H, X, Y), the two effective candle colours, the
 * number formatter, an optional hovered index, and the strip-only layers (drawings, crosshair)
 * which are slotted in at the same depth drawChart() puts them.
 */
export function renderSvg(view, o) {
  const { W, H, X, Y, up, down, inr } = o;
  const plotW = Math.max(1, W - PAD_R);
  const plotH = Math.max(1, H - PAD_B);
  const clip = o.clipId ?? 'ucClip';
  const { all, s, vis, ivMs } = view;

  /* price labels (row 8) — no rules; the dot grid is the chart body's background (row 9) */
  let axis = '';
  const step = niceStep(view.hi - view.lo, plotH);
  const dp = step >= 1 ? 0 : 2;
  // A label under the 18px last-price pill peeks out above and below it ("23,340" behind
  // "23,346.40", seen live 2026-09-19), so any label within the pill's reach is left out.
  const lastC = view.vis[view.vis.length - 1].c;
  const pillAt = Math.min(Math.max(Y(lastC), 9), plotH - 9);
  for (let p = Math.ceil(view.lo / step) * step; p <= view.hi; p += step) {
    const y = Y(p);
    if (y < 6 || y > plotH - 2 || Math.abs(y - pillAt) < 14) continue;
    axis += `<text x="${f1(plotW + 6)}" y="${f1(y + 3.5)}" fill="var(--fg-faint)" `
      + `font-family="${MONO}" font-size="10">${inr(p, dp)}</text>`;
  }

  /* candles (row 7): one path per colour group, bodies over wicks */
  const slot = (plotW * ivMs) / Math.max(1, view.t1 - view.t0);
  const bw = Math.max(1, Math.min(15, slot * 0.68));
  let bUp = '', bDn = '', wUp = '', wDn = '';
  for (const k of vis) {
    const x = X(k.t);
    if (x < -bw || x > plotW + bw) continue;
    let top = Y(Math.max(k.o, k.c)), bot = Y(Math.min(k.o, k.c));
    if (bot - top < 1) { const m = (top + bot) / 2; top = m - 0.5; bot = m + 0.5; }
    const body = `M${f1(x - bw / 2)} ${f1(top)}H${f1(x + bw / 2)}V${f1(bot)}H${f1(x - bw / 2)}Z`;
    const wick = `M${f1(x)} ${f1(Y(k.h))}V${f1(Y(k.l))}`;
    if (k.c >= k.o) { bUp += body; wUp += wick; } else { bDn += body; wDn += wick; }
  }
  // `line` is the dialog preview's picture of Line mode: the same closes, joined.
  let line = '';
  if (o.line) {
    for (const k of vis) line += `${line ? 'L' : 'M'}${f1(X(k.t))} ${f1(Y(k.c))}`;
    const col = vis[vis.length - 1].c >= vis[0].o ? up : down;
    line = `<path data-g="line" d="${line}" fill="none" stroke="${col}" stroke-width="1.6" `
      + `stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const candles = o.line ? line :
    (wUp ? `<path data-g="wick-up" d="${wUp}" fill="none" stroke="${up}" stroke-width="1"/>` : '')
    + (wDn ? `<path data-g="wick-down" d="${wDn}" fill="none" stroke="${down}" stroke-width="1"/>` : '')
    + (bUp ? `<path data-g="up" d="${bUp}" fill="${up}" stroke="${up}" stroke-width="1"/>` : '')
    + (bDn ? `<path data-g="down" d="${bDn}" fill="${down}" stroke="${down}" stroke-width="1"/>` : '');

  /* SMA lines (row 12), over the candles as in the reference */
  let smas = '';
  for (const m of o.line ? [] : view.smas) {
    let d = '';
    for (let i = s; i < all.length; i++) {
      const v = m.vals[i];
      if (v === null) continue;
      d += `${d ? 'L' : 'M'}${f1(X(all[i].t))} ${f1(Y(v))}`;
    }
    if (d) {
      smas += `<path data-sma="${m.period}" d="${d}" fill="none" stroke="${m.color}" `
        + `stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
  }

  /* P57 indicators, over the SMAs. A Supertrend is split into runs of one direction, each in the
     candle colour of that direction, with a break at every flip (indicators-v1.md row 7). */
  let inds = '';
  for (const m of o.line ? [] : (view.ind?.lines ?? [])) {
    const runs = [];
    let d = '', runDir = null;
    for (let i = s; i < all.length; i++) {
      const v = m.vals[i];
      const dir = m.trend ? m.trend[i] : 0;
      if (v === null || (m.trend && dir !== runDir)) {
        if (d) runs.push({ d, dir: runDir });
        d = '';
        runDir = dir;
        if (v === null) continue;
      }
      d += `${d ? 'L' : 'M'}${f1(X(all[i].t))} ${f1(Y(v))}`;
    }
    if (d) runs.push({ d, dir: runDir });
    for (const r of runs) {
      const col = m.trend ? (r.dir === 1 ? up : down) : m.color;
      inds += `<path data-ind="${m.key}" d="${r.d}" fill="none" stroke="${col}" stroke-width="${m.width}" `
        + (m.dash ? `stroke-dasharray="${m.dash}" ` : '')
        + `stroke-linejoin="round" stroke-linecap="round"/>`;
    }
  }

  /* last price: dashed rule + pill in the last candle's colour (row 10) */
  const last = vis[vis.length - 1];
  const lastCol = last.c >= last.o ? up : down;
  const ly = Y(last.c);
  const pillY = Math.min(Math.max(ly, 9), plotH - 9);
  const rule = ly >= 0 && ly <= plotH
    ? `<line x1="${f1(X(last.t))}" y1="${f1(ly)}" x2="${f1(plotW)}" y2="${f1(ly)}" stroke="${lastCol}" `
      + `stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>`
    : '';
  const pill = `<rect data-pill="1" x="${f1(plotW + 2)}" y="${f1(pillY - 9)}" width="${PAD_R - 6}" height="18" `
    + `rx="3" fill="${lastCol}"/>`
    + `<text x="${f1(plotW + 7)}" y="${f1(pillY + 3.5)}" fill="var(--bg-panel)" font-family="${MONO}" `
    + `font-size="11" font-weight="600">${inr(last.c)}</text>`;

  /* time labels on IST clock boundaries (amendment 26) */
  let times = '';
  const pxPerMin = (plotW * 60_000) / Math.max(1, view.t1 - view.t0);
  const stepMin = TIME_STEPS_MIN.find(m => m * pxPerMin >= TIME_GAP_PX) ?? 1440;
  let lastX = -Infinity;
  // ui-type-v1 row 7: the session note sits at the right end of this row, so a time label that
  // would run under it is skipped. 6px per character over-estimates Inter 10px (5.4-6.2), so the
  // estimate errs towards a gap, never an overlap.
  const noteLeft = o.note ? plotW - 4 - o.note.length * 6 : Infinity;
  for (const k of vis) {
    const mod = Math.round((k.t + IST_MS) / 60_000) % 1440;
    if (mod % stepMin) continue;
    const x = X(k.t);
    if (x < 14 || x > plotW - 14 || x - lastX < TIME_GAP_PX || x + 16 > noteLeft - 8) continue;
    lastX = x;
    times += `<text x="${f1(x)}" y="${H - 3}" fill="var(--fg-faint)" font-family="${MONO}" `
      + `font-size="10" text-anchor="middle">${esc(k.at)}</text>`;
  }

  /* OHLC readout (row 11): hovered candle, else the last one INSIDE the window — panned back a
     session, reading the live candle's OHLC over a chart that does not show it is a lie
     (chart-nav-v1.md row 9's reasoning applied to the readout). */
  let lastIn = vis.length - 1;
  while (lastIn > 0 && vis[lastIn].t > view.t1) lastIn--;
  const hi = o.hover >= 0 && o.hover < vis.length ? o.hover : lastIn;
  const k = vis[hi];
  const prev = all[s + hi - 1];
  const kc = k.c >= k.o ? up : down;
  const chg = prev ? k.c - prev.c : null;
  const pct = prev && prev.c ? (chg / prev.c) * 100 : null;
  const lab = (t) => `<tspan fill="var(--fg-faint)">${t}</tspan>`;
  const val = (v) => `<tspan fill="${kc}">${inr(v)}</tspan>`;
  const readout = `<text data-readout="${hi}" x="0" y="11" font-family="${MONO}" font-size="11" `
    + `paint-order="stroke" stroke="var(--chart-bg)" stroke-width="3" stroke-linejoin="round">`
    + `${lab(esc(k.at))}  ${lab('O')} ${val(k.o)} ${lab('H')} ${val(k.h)} ${lab('L')} ${val(k.l)} `
    + `${lab('C')} ${val(k.c)}`
    + (chg === null ? '' : ` <tspan fill="${kc}">${chg > 0 ? '+' : ''}${inr(chg)} (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%)</tspan>`)
    + '</text>';

  /* P57 row 11: the indicator legend, one line under the readout, values at the same candle. */
  let legend = '';
  const lg = o.line ? [] : (view.ind?.legend ?? []);
  if (lg.length) {
    const j = s + hi;
    const parts = lg.map(x => {
      const nameCol = x.trend ? (x.trend[j] === 1 ? up : x.trend[j] === -1 ? down : 'var(--fg-faint)') : x.color;
      const name = `<tspan fill="${nameCol}">${esc(x.name)}</tspan>`;
      if (x.note) return `${name} <tspan fill="var(--fg-faint)">— ${esc(x.note)}</tspan>`;
      const v = x.vals?.[j];
      if (v === null || v === undefined) return `${name} <tspan fill="var(--fg-faint)">—</tspan>`;
      const arrow = x.trend ? (x.trend[j] === 1 ? '▲ ' : '▼ ') : '';
      const val = x.lower ? `${inr(v)} / ${inr(x.lower[j])}` : inr(v);
      return `${name} <tspan fill="var(--fg-muted)">${arrow}${val}</tspan>`;
    });
    // Wrap onto a second (third…) line rather than run under the price labels: the dialog's preview
    // is narrower than the strip (seen in P57's first screenshots). 6px a character over-estimates
    // Inter 10px, so the estimate errs towards an early wrap, never an overlap.
    const plain = (h) => h.replace(/<[^>]+>/g, '');
    const lines = [[]];
    let used = 0;
    for (const part of parts) {
      const w = (plain(part).length + 3) * 6;
      if (used && used + w > plotW - 8) { lines.push([]); used = 0; }
      lines[lines.length - 1].push(part);
      used += w;
    }
    legend = lines.map((ln, n) => `<text data-legend="${n + 1}" x="0" y="${25 + n * 12}" font-family="${MONO}" font-size="10" `
      + `paint-order="stroke" stroke="var(--chart-bg)" stroke-width="3" stroke-linejoin="round">`
      + ln.join('<tspan fill="var(--fg-faint)"> · </tspan>') + '</text>').join('');
  }

  /* session note on the time-axis row, right-aligned (ui-type-v1 row 7; amendment 28 had it in
     the plot's top-right, where it sat on the day's highs) */
  const note = o.note
    ? `<text data-note="1" x="${f1(plotW - 4)}" y="${H - 3}" text-anchor="end" fill="var(--fg-faint)" `
      + `font-family="${MONO}" font-size="10" paint-order="stroke" stroke="var(--chart-bg)" `
      + `stroke-width="3" stroke-linejoin="round">${esc(o.note)}</text>`
    : '';

  /* hover guide in the preview (the strip has chart-tools' crosshair instead) */
  let guide = '';
  if (o.hoverGuide && o.hover >= 0 && o.hover < vis.length) {
    const x = X(vis[o.hover].t);
    guide = `<line x1="${f1(x)}" y1="0" x2="${f1(x)}" y2="${f1(plotH)}" stroke="var(--fg-faint)" `
      + `stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>`;
  }

  return `<defs><clipPath id="${clip}"><rect x="0" y="0" width="${f1(plotW)}" height="${f1(plotH)}"/>`
    + `</clipPath></defs>`
    + axis
    + `<g clip-path="url(#${clip})">${candles}${smas}${inds}${rule}</g>`
    + (o.drawings ?? '')
    + guide + pill + times + readout + legend + note
    + (o.crosshair ?? '');
}

/**
 * P58: the lower pane, drawn in the band [top, H] of the same SVG, under the price plot's time
 * labels. `o` carries W, H (the full SVG height), top (the price area's height), the strip's X,
 * the up/down colours, the formatter, the hovered index and the pane choice.
 */
export function renderPane(view, o) {
  const { W, H, top, X, up, down, inr, pane } = o;
  const plotW = Math.max(1, W - PAD_R);
  const y0 = top + 6, y1 = H - 2, ph = Math.max(1, y1 - y0);
  const { all, s, vis, ivMs } = view;
  const inWin = (t) => t >= view.t0 - ivMs / 2 && t <= view.t1 + ivMs / 2;
  let lastIn = vis.length - 1;
  while (lastIn > 0 && vis[lastIn].t > view.t1) lastIn--;
  const j = s + (o.hover >= 0 && o.hover < vis.length ? o.hover : lastIn);
  const slot = (plotW * ivMs) / Math.max(1, view.t1 - view.t0);
  const bw = Math.max(1, Math.min(15, slot * 0.68));
  const clip = o.clipId ? `${o.clipId}Pane` : 'ucPaneClip';
  let body = '', legend = '', axis = '';
  const lineOf = (vals, Yp) => {
    let d = '';
    for (let i = s; i < all.length; i++) if (vals[i] !== null) d += `${d ? 'L' : 'M'}${f1(X(all[i].t))} ${f1(Yp(vals[i]))}`;
    return d;
  };
  const lab = (x, y, text) => `<text x="${f1(x)}" y="${f1(y)}" fill="var(--fg-faint)" font-family="${MONO}" font-size="10">${text}</text>`;
  const fmt = (v) => (v === null || v === undefined ? '—' : inr(v));

  if (pane.kind === 'rsi') {
    const n = pane.rsi ?? 14;
    const r = rsiSeries(all, n);
    const Yp = (v) => y1 - (v / 100) * ph;
    for (const [lvl, op, dash] of [[70, 0.6, '3 3'], [30, 0.6, '3 3'], [50, 0.3, '1 3']]) {
      body += `<line x1="0" y1="${f1(Yp(lvl))}" x2="${f1(plotW)}" y2="${f1(Yp(lvl))}" stroke="var(--fg-faint)" stroke-width="1" stroke-dasharray="${dash}" opacity="${op}"/>`;
    }
    body += `<path data-pane="rsi" d="${lineOf(r, Yp)}" fill="none" stroke="${PANE_COL.rsi}" stroke-width="1.4" stroke-linejoin="round"/>`;
    axis = lab(plotW + 6, Yp(70) + 3.5, '70') + lab(plotW + 6, Yp(30) + 3.5, '30');
    legend = `<tspan fill="${PANE_COL.rsi}">RSI ${n}</tspan> <tspan fill="var(--fg-muted)">${r[j] === null ? '—' : r[j].toFixed(2)}</tspan>`;
  } else if (pane.kind === 'macd') {
    const m = macdSeries(all);
    let mx = 0;
    for (let i = s; i < all.length; i++) {
      if (!inWin(all[i].t)) continue;
      for (const v of [m.macd[i], m.signal[i], m.hist[i]]) if (v !== null) mx = Math.max(mx, Math.abs(v));
    }
    mx = mx || 1;
    const Yp = (v) => y0 + ph / 2 - (v / mx) * (ph / 2) * 0.92;
    body += `<line x1="0" y1="${f1(Yp(0))}" x2="${f1(plotW)}" y2="${f1(Yp(0))}" stroke="var(--fg-faint)" stroke-width="1" opacity=".4"/>`;
    let hu = '', hd = '';
    for (let i = s; i < all.length; i++) {
      const v = m.hist[i];
      if (v === null) continue;
      const x = X(all[i].t), a = Yp(0), b = Yp(v);
      const r = `M${f1(x - bw / 2)} ${f1(Math.min(a, b))}H${f1(x + bw / 2)}V${f1(Math.max(a, b) + 0.5)}H${f1(x - bw / 2)}Z`;
      if (v >= 0) hu += r; else hd += r;
    }
    body += (hu ? `<path data-pane="hist-up" d="${hu}" fill="${up}" opacity=".6"/>` : '')
      + (hd ? `<path data-pane="hist-down" d="${hd}" fill="${down}" opacity=".6"/>` : '')
      + `<path data-pane="macd" d="${lineOf(m.macd, Yp)}" fill="none" stroke="${PANE_COL.macd}" stroke-width="1.4"/>`
      + `<path data-pane="signal" d="${lineOf(m.signal, Yp)}" fill="none" stroke="${PANE_COL.signal}" stroke-width="1.2"/>`;
    axis = lab(plotW + 6, Yp(0) + 3.5, '0');
    legend = `<tspan fill="${PANE_COL.macd}">MACD 12,26,9</tspan> <tspan fill="var(--fg-muted)">${fmt(m.macd[j])}</tspan>`
      + ` <tspan fill="${PANE_COL.signal}">${fmt(m.signal[j])}</tspan> <tspan fill="var(--fg-muted)">${fmt(m.hist[j])}</tspan>`;
  } else if (pane.kind === 'vol') {
    if (!hasVolume(all)) {
      legend = `<tspan fill="var(--fg-faint)">Vol — no volume</tspan>`;
    } else {
      let mx = 0;
      for (let i = s; i < all.length; i++) if (inWin(all[i].t)) mx = Math.max(mx, Number(all[i].v) || 0);
      mx = mx || 1;
      let vu = '', vd = '';
      for (let i = s; i < all.length; i++) {
        const k = all[i], v = Number(k.v) || 0, x = X(k.t), b = y1 - (v / mx) * ph * 0.92;
        const r = `M${f1(x - bw / 2)} ${f1(b)}H${f1(x + bw / 2)}V${f1(y1)}H${f1(x - bw / 2)}Z`;
        if (k.c >= k.o) vu += r; else vd += r;
      }
      body += (vu ? `<path data-pane="vol-up" d="${vu}" fill="${up}" opacity=".6"/>` : '')
        + (vd ? `<path data-pane="vol-down" d="${vd}" fill="${down}" opacity=".6"/>` : '');
      legend = `<tspan fill="var(--fg-faint)">Vol</tspan> <tspan fill="var(--fg-muted)">${inr(Number(all[j]?.v) || 0, 0)}</tspan>`;
    }
  }
  return `<defs><clipPath id="${clip}"><rect x="0" y="${f1(y0 - 2)}" width="${f1(plotW)}" height="${f1(ph + 4)}"/></clipPath></defs>`
    + `<line data-pane-sep="1" x1="0" y1="${f1(top + 1)}" x2="${f1(W)}" y2="${f1(top + 1)}" stroke="var(--border)" stroke-width="1"/>`
    + `<g clip-path="url(#${clip})">${body}</g>` + axis
    + `<text data-pane-legend="1" x="0" y="${f1(y0 + 9)}" font-family="${MONO}" font-size="10" paint-order="stroke" `
    + `stroke="var(--chart-bg)" stroke-width="3" stroke-linejoin="round">${legend}</text>`;
}

/**
 * Read-only test seam for the verification scripts, mirroring `window.__chart` and
 * `window.__candles`. Nothing in the app reads it; app.js adds the paint timings.
 */
window.__ucandles = {
  paints: [],
  data: () => store.data,
  interval: () => store.interval,
  message: () => store.message,
  loading: () => store.loading,
  /** panel-windows-v1.md rows 8-10, read by the recovery verification script. */
  retryStep: () => store.retryStep,
  retryInMs: () => Math.max(0, store.retryAt - Date.now()),
  retryNow, onReconnect,
  mergeTick, smaSeries, niceStep, buildView, istDate, indicatorsFor, paneHeight,
};
