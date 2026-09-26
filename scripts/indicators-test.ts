/**
 * `npm run ind:test` — P57's indicator math (`docs/spec/indicators-v1.md`, AC1 and AC4's unit half).
 *
 * Hand-worked values on short series, then every series against a second implementation written separately
 * (array-at-a-time, transcribed from the Pine definitions) on 2,000 synthetic candles over six sessions.
 */

// @ts-expect-error — a browser module without types; it is plain ESM and loads in Node.
import * as I from '../public/indicators.js';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
type K = { t: number; d?: string; h: number; l: number; c: number; v?: number };
const near = (a: number | null, b: number | null, eps = 1e-9) => (a === null || b === null ? a === b : Math.abs(a - b) <= eps);
const k = (c: number, h = c, l = c, v = 0, d = '2026-09-24'): K => ({ t: 0, d, h, l, c, v });

/* ------------------------------------------------------------------ hand-worked */

{
  const e = I.emaSeries([1, 2, 3, 4, 5].map(c => k(c)), 3);
  ok('EMA 3 of 1..5 = [-, -, 2, 3, 4] (seeded with the SMA, alpha 0.5)', JSON.stringify(e) === JSON.stringify([null, null, 2, 3, 4]), JSON.stringify(e));
  ok('EMA longer than the series is all null', I.emaSeries([k(1), k(2)], 3).every((x: unknown) => x === null));

  const v = I.vwapSeries([k(10, 12, 8, 100, 'A'), k(12, 14, 10, 300, 'A'), k(20, 21, 19, 50, 'B'), k(30, 30, 30, 0, 'C'), k(33, 36, 30, 10, 'C')]);
  ok('VWAP: (10x100 + 12x300) / 400 = 11.5 within a session', near(v[1], 11.5), String(v[1]));
  ok('VWAP resets at a new date (B starts at its own hlc3, 20)', near(v[2], 20));
  ok('VWAP is null while the session has no volume, then starts', v[3] === null && near(v[4], 33));
  ok('hasVolume: false for all-zero candles, true otherwise', !I.hasVolume([k(1), k(2)]) && I.hasVolume([k(1, 1, 1, 5)]));

  const a = I.atrSeries([k(9, 10, 8), k(10, 11, 9), k(13, 14, 10)], 2);
  ok('ATR 2: TR 2, 2, 4 -> [-, 2, 3] (Wilder: (2 x 1 + 4) / 2)', JSON.stringify(a) === JSON.stringify([null, 2, 3]), JSON.stringify(a));

  const b = I.bollingerSeries([k(1), k(2), k(3)], 3, 2);
  const sd = Math.sqrt(2 / 3);
  ok('Bollinger 3,2 of 1,2,3: basis 2, bands 2 +/- 2 x sqrt(2/3) (population sigma)', near(b.basis[2], 2) && near(b.upper[2], 2 + 2 * sd) && near(b.lower[2], 2 - 2 * sd));

  // A hand-built reversal: 15 flat-ish candles, a strong rally, then a crash.
  const series: K[] = [];
  let px = 100;
  for (let i = 0; i < 15; i++) { series.push(k(px, px + 1, px - 1)); px += i % 2 ? 0.3 : -0.3; }
  for (let i = 0; i < 20; i++) { px += 3; series.push(k(px, px + 1, px - 1)); }
  for (let i = 0; i < 20; i++) { px -= 4; series.push(k(px, px + 1, px - 1)); }
  const st = I.supertrendSeries(series, 10, 3);
  const firstIdx = st.dir.findIndex((x: number | null) => x !== null);
  const upAt = st.dir.findIndex((x: number | null, i: number) => i > firstIdx && x === 1);
  const downAt = st.dir.findIndex((x: number | null, i: number) => i > upAt && x === -1);
  ok('Supertrend starts DOWN on its first bar (ta.supertrend)', firstIdx === 9 && st.dir[9] === -1, `first ${firstIdx}`);
  ok('Supertrend flips UP during the rally and DOWN during the crash', upAt >= 15 && upAt < 35 && downAt >= 35, `up at ${upAt}, down at ${downAt}`);
  ok('Supertrend line is under price while up, over it while down', series.every((c, i) => st.dir[i] === null || (st.dir[i] === 1 ? st.line[i] <= c.c : st.line[i] >= c.c)));
}

/* ------------------------------------------------------------------ the second implementation */

function ema2(c: number[], n: number): (number | null)[] {
  return c.map((_, i) => {
    if (i < n - 1) return null;
    let e = c.slice(0, n).reduce((x, y) => x + y, 0) / n;
    for (let j = n; j <= i; j++) e = (c[j]! - e) * (2 / (n + 1)) + e;
    return e;
  });
}
function vwap2(ks: K[]): (number | null)[] {
  return ks.map((x, i) => {
    let j = i; while (j > 0 && ks[j - 1]!.d === x.d) j--;
    const s = ks.slice(j, i + 1);
    const vol = s.reduce((a, y) => a + (y.v ?? 0), 0);
    return vol > 0 ? s.reduce((a, y) => a + ((y.h + y.l + y.c) / 3) * (y.v ?? 0), 0) / vol : null;
  });
}
function st2(ks: K[], n: number, m: number) {
  const tr = ks.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - ks[i - 1]!.c), Math.abs(x.l - ks[i - 1]!.c))));
  const atr: (number | null)[] = tr.map(() => null);
  for (let i = n - 1; i < ks.length; i++) atr[i] = i === n - 1 ? tr.slice(0, n).reduce((a, b) => a + b, 0) / n : (atr[i - 1]! * (n - 1) + tr[i]!) / n;
  // Pine, transcribed: lowerBand := lowerBand > prevLowerBand or close[1] < prevLowerBand ? lowerBand : prevLowerBand
  const lb: number[] = [], ub: number[] = [], dir: (number | null)[] = [], line: (number | null)[] = [];
  for (let i = 0; i < ks.length; i++) {
    if (atr[i] === null) { lb.push(NaN); ub.push(NaN); dir.push(null); line.push(null); continue; }
    const src = (ks[i]!.h + ks[i]!.l) / 2;
    const pl = Number.isNaN(lb[i - 1] ?? NaN) ? 0 : lb[i - 1]!, pu = Number.isNaN(ub[i - 1] ?? NaN) ? 0 : ub[i - 1]!;
    const c1 = i > 0 ? ks[i - 1]!.c : ks[i]!.c;
    let lo = src - m * atr[i]!, hi = src + m * atr[i]!;
    lo = lo > pl || c1 < pl ? lo : pl;
    hi = hi < pu || c1 > pu ? hi : pu;
    lb.push(lo); ub.push(hi);
    let d: number;
    if (atr[i - 1] === null || atr[i - 1] === undefined) d = -1;
    else if (line[i - 1] === ub[i - 1]) d = ks[i]!.c > hi ? 1 : -1;
    else d = ks[i]!.c < lo ? -1 : 1;
    dir.push(d); line.push(d === 1 ? lo : hi);
  }
  return { line, dir };
}
function bb2(c: number[], n: number, m: number) {
  const out = { basis: [] as (number | null)[], upper: [] as (number | null)[], lower: [] as (number | null)[] };
  c.forEach((_, i) => {
    if (i < n - 1) { out.basis.push(null); out.upper.push(null); out.lower.push(null); return; }
    const w = c.slice(i - n + 1, i + 1), mean = w.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(w.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / n);
    out.basis.push(mean); out.upper.push(mean + m * sd); out.lower.push(mean - m * sd);
  });
  return out;
}

{
  // 2,000 candles over six dates, a seeded walk; one whole session with zero volume.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ks: K[] = [];
  let px = 23000;
  for (let i = 0; i < 2000; i++) {
    const d = `2026-09-${String(20 + Math.floor(i / 334)).padStart(2, '0')}`;
    const o = px; px += (rnd() - 0.5) * 30;
    const h = Math.max(o, px) + rnd() * 8, l = Math.min(o, px) - rnd() * 8;
    ks.push({ t: i * 60_000, d, h, l, c: px, v: d === '2026-09-22' ? 0 : Math.round(rnd() * 5000) });
  }
  const c = ks.map(x => x.c);
  const cmp = (name: string, a: (number | null)[], b: (number | null)[]) => {
    let bad = 0; for (let i = 0; i < a.length; i++) if (!near(a[i]!, b[i]!, 1e-6)) bad++;
    ok(`AC1 ${name}: the second implementation agrees on 2,000 candles`, bad === 0 && a.length === b.length, `${bad} mismatches`);
  };
  for (const n of [9, 21, 200]) cmp(`EMA ${n}`, I.emaSeries(ks, n), ema2(c, n));
  cmp('VWAP (with a zero-volume session)', I.vwapSeries(ks), vwap2(ks));
  ok('AC4 unit: the zero-volume session has no VWAP at all', I.vwapSeries(ks).every((v: number | null, i: number) => ks[i]!.d !== '2026-09-22' || v === null));
  for (const [n, m] of [[10, 3], [7, 2.5], [14, 1]] as [number, number][]) {
    const a = I.supertrendSeries(ks, n, m), b = st2(ks, n, m);
    cmp(`Supertrend ${n},${m} line`, a.line, b.line);
    cmp(`Supertrend ${n},${m} direction`, a.dir, b.dir);
    const flips = a.dir.filter((d: number | null, i: number) => i > 0 && d !== null && a.dir[i - 1] !== null && d !== a.dir[i - 1]).length;
    ok(`Supertrend ${n},${m} actually flips on the walk (the comparison is not of two flat lines)`, flips >= 5, `${flips} flips`);
  }
  for (const [n, m] of [[20, 2], [50, 1.5]] as [number, number][]) {
    const a = I.bollingerSeries(ks, n, m), b = bb2(c, n, m);
    cmp(`Bollinger ${n},${m} upper`, a.upper, b.upper);
    cmp(`Bollinger ${n},${m} lower`, a.lower, b.lower);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
