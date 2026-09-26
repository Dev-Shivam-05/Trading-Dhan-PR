/* P57 — the chart's indicator math. Spec: docs/spec/indicators-v1.md.

   A leaf: no DOM, no `window`, no imports, so `npm run ind:test` can load it from Node. Every
   series is the same length as the candles it was given, with `null` wherever the indicator does
   not exist yet (a partial value is never drawn as if it were a full one, as P19's SMA does).
   Candles are `{ t, h, l, c, v? }`; `d` (the IST date) is read by VWAP when present, else
   derived from `t`. */

const IST_MS = 5.5 * 3600_000;
const dateOf = (k) => k.d || new Date(k.t + IST_MS).toISOString().slice(0, 10);

/** Row 3. `α = 2/(n+1)`, seeded with the SMA of the first n closes. */
export function emaSeries(candles, period) {
  const out = new Array(candles.length).fill(null);
  const n = Math.round(period);
  if (!(n >= 1) || candles.length < n) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += candles[i].c;
  let e = sum / n;
  out[n - 1] = e;
  const a = 2 / (n + 1);
  for (let i = n; i < candles.length; i++) { e = a * candles[i].c + (1 - a) * e; out[i] = e; }
  return out;
}

/** Rows 4-5. Session-anchored, hlc3, volume-weighted. Null while the session has no volume. */
export function vwapSeries(candles) {
  const out = new Array(candles.length).fill(null);
  let day = null, pv = 0, vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const k = candles[i];
    const d = dateOf(k);
    if (d !== day) { day = d; pv = 0; vol = 0; }
    const v = Number(k.v) > 0 ? Number(k.v) : 0;
    pv += ((k.h + k.l + k.c) / 3) * v;
    vol += v;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}

/** True range; the first candle's is its own high - low. */
function trueRange(candles, i) {
  const k = candles[i];
  if (i === 0) return k.h - k.l;
  const pc = candles[i - 1].c;
  return Math.max(k.h - k.l, Math.abs(k.h - pc), Math.abs(k.l - pc));
}

/** Row 7. Wilder's ATR (RMA), seeded with the SMA of the first n true ranges. */
export function atrSeries(candles, period) {
  const out = new Array(candles.length).fill(null);
  const n = Math.round(period);
  if (!(n >= 1) || candles.length < n) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += trueRange(candles, i);
  let a = sum / n;
  out[n - 1] = a;
  for (let i = n; i < candles.length; i++) { a = (a * (n - 1) + trueRange(candles, i)) / n; out[i] = a; }
  return out;
}

/**
 * Row 7. `ta.supertrend(mult, period)`: returns `{ line, dir }`, where `dir` is 1 (up, the line is
 * the lower band under price) or -1 (down, the upper band over price), both null before the ATR
 * exists.
 */
export function supertrendSeries(candles, period, mult) {
  const atr = atrSeries(candles, period);
  const line = new Array(candles.length).fill(null);
  const dir = new Array(candles.length).fill(null);
  let lowerPrev = 0, upperPrev = 0, dirPrev = null;
  for (let i = 0; i < candles.length; i++) {
    if (atr[i] === null) continue;
    const k = candles[i];
    const hl2 = (k.h + k.l) / 2;
    let lower = hl2 - mult * atr[i];
    let upper = hl2 + mult * atr[i];
    const pc = i > 0 ? candles[i - 1].c : k.c;
    // The ratchet, exactly as ta.supertrend writes it (a first band compares against 0, nz()'s value):
    // the lower band only rises and the upper only falls, until the previous close goes through it.
    if (!(lower > lowerPrev || pc < lowerPrev)) lower = lowerPrev;
    if (!(upper < upperPrev || pc > upperPrev)) upper = upperPrev;
    // The first bar with an ATR starts DOWN (ta.supertrend's direction 1: the upper band).
    const d = dirPrev === null ? -1 : dirPrev === -1 ? (k.c > upper ? 1 : -1) : (k.c < lower ? -1 : 1);
    dir[i] = d;
    line[i] = d === 1 ? lower : upper;
    lowerPrev = lower; upperPrev = upper; dirPrev = d;
  }
  return { line, dir };
}

/** Row 12. Bollinger Bands: SMA basis ± k population standard deviations of the close. */
export function bollingerSeries(candles, period, mult) {
  const n = Math.round(period);
  const basis = new Array(candles.length).fill(null);
  const upper = new Array(candles.length).fill(null);
  const lower = new Array(candles.length).fill(null);
  if (!(n >= 1)) return { basis, upper, lower };
  for (let i = n - 1; i < candles.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += candles[j].c;
    const m = s / n;
    let q = 0;
    for (let j = i - n + 1; j <= i; j++) q += (candles[j].c - m) ** 2;
    const sd = Math.sqrt(q / n);
    basis[i] = m; upper[i] = m + mult * sd; lower[i] = m - mult * sd;
  }
  return { basis, upper, lower };
}

/** True when the candles carry no volume at all (an index): row 5's "no volume" case. */
export function hasVolume(candles) {
  for (const k of candles) if (Number(k.v) > 0) return true;
  return false;
}

/* ---------------------------------------------------------------- P58: the lower pane */

/** P58 row 3. Wilder's RSI: the first averages are the plain means of the first n changes. */
export function rsiSeries(candles, period) {
  const out = new Array(candles.length).fill(null);
  const n = Math.round(period);
  if (!(n >= 1) || candles.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) {
    const d = candles[i].c - candles[i - 1].c;
    if (d > 0) g += d; else l -= d;
  }
  g /= n; l /= n;
  const rsi = () => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[n] = rsi();
  for (let i = n + 1; i < candles.length; i++) {
    const d = candles[i].c - candles[i - 1].c;
    g = (g * (n - 1) + (d > 0 ? d : 0)) / n;
    l = (l * (n - 1) + (d < 0 ? -d : 0)) / n;
    out[i] = rsi();
  }
  return out;
}

/** P58 row 4. MACD (fast, slow, signal): the signal EMA is seeded with the mean of the first `sig` MACD values. */
export function macdSeries(candles, fast = 12, slow = 26, sig = 9) {
  const f = emaSeries(candles, fast), s = emaSeries(candles, slow);
  const macd = candles.map((_, i) => (f[i] === null || s[i] === null ? null : f[i] - s[i]));
  const signal = new Array(candles.length).fill(null);
  const hist = new Array(candles.length).fill(null);
  const first = macd.findIndex(v => v !== null);
  if (first < 0 || candles.length < first + sig) return { macd, signal, hist };
  let e = 0;
  for (let i = first; i < first + sig; i++) e += macd[i];
  e /= sig;
  signal[first + sig - 1] = e;
  const a = 2 / (sig + 1);
  for (let i = first + sig; i < candles.length; i++) { e = a * macd[i] + (1 - a) * e; signal[i] = e; }
  for (let i = 0; i < candles.length; i++) if (macd[i] !== null && signal[i] !== null) hist[i] = macd[i] - signal[i];
  return { macd, signal, hist };
}
