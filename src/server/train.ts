/**
 * P44: the rule trainer. `docs/spec/train-all-v1.md`.
 *
 * Pure. Every function works only on its arguments, and `train-data.ts` does the I/O. This is a
 * THIRD implementation of the P33 rules, after `paper.ts` and P37's `backtest.ts`. It was written
 * for speed over 1,728 settings × ~60 sessions × 210 stocks, so it works on typed arrays and
 * memoises per (day, stock). AC2 holds it to `replayDay` on 24 Sep's real candles, so the three
 * cannot drift apart unnoticed.
 */

import { TICK, OPEN_MIN, ENTRY_UNTIL_MIN, SQUARE_OFF_MIN, at, ist, type Candle, type Side } from './backtest.ts';
import { MAX_POSITIONS, TARGET_R, FROZEN_RANGE_PCT } from './paper.ts';

const MINUTE = 60_000;
const FIVE = 5 * MINUTE;
const r2 = (x: number) => Math.round(x * 100) / 100;

/* ------------------------------------------------------------ settings */

export type Direction = 'gap' | 'either';
export type TrainParams = {
  minChg: 0 | 1 | 2; dir: Direction; rangeBars: 1 | 2 | 3; sma: 5 | 9 | 13 | 20; closes: 1 | 2 | 3;
  stop: boolean; target: boolean; frozen: boolean;
};
/** Row 12: today's live strategy without its OI filter. */
export const BASELINE: TrainParams = { minChg: 2, dir: 'gap', rangeBars: 2, sma: 9, closes: 2, stop: false, target: false, frozen: false };
export const tkey = (p: TrainParams) =>
  `chg${p.minChg}/${p.dir}/r${p.rangeBars}/sma${p.sma}/x${p.closes}/${p.stop ? 'SL' : 'noSL'}/${p.target ? 'T2R' : 'noT'}/${p.frozen ? 'frz' : 'nofrz'}`;
/** Row 11: 3 × 2 × 3 × 4 × 3 × 2 × 2 × 2 = 1,728. */
export const TRAIN_GRID: TrainParams[] = [];
for (const minChg of [0, 1, 2] as const) for (const dir of ['gap', 'either'] as const)
  for (const rangeBars of [1, 2, 3] as const) for (const sma of [5, 9, 13, 20] as const) for (const closes of [1, 2, 3] as const)
    for (const stop of [false, true]) for (const target of [false, true]) for (const frozen of [false, true])
      TRAIN_GRID.push({ minChg, dir, rangeBars, sma, closes, stop, target, frozen });

/**
 * Row 18: how fills are priced. `level` is row 7/8's model. `late1m` is the stress test: every fill
 * lands one minute late, at the close of the minute it was due in (the break candle, the stop or
 * target candle, the candle starting at the SMA / 15:15 instant). A band jump such as POLICYBZR's
 * on 24 Sep (model 1700.45, live 1606) is exactly what `level` gets wrong and `late1m` does not.
 */
export type FillModel = 'level' | 'late1m';

/** Row 13: the walk-forward's first test session, and the trade floor for a choice. */
export const WF_FIRST_TEST = 10;
export const WF_MIN_TRADES = 20;

/* ------------------------------------------------------------ costs (row 9, GUESS) */

export const COSTS = { brokeragePerOrder: 20, stt: 0.0002, exchange: 0.0000173, sebi: 0.000001, stamp: 0.00002, gst: 0.18 };

/** Row 9: one futures round trip of `qty`, in rupees to the paisa. */
export function costOf(side: Side, entry: number, exit: number, qty: number): number {
  const buy = (side === 'BUY' ? entry : exit) * qty;
  const sell = (side === 'BUY' ? exit : entry) * qty;
  const turnover = buy + sell;
  const brokerage = 2 * COSTS.brokeragePerOrder;
  const exch = COSTS.exchange * turnover;
  const sebi = COSTS.sebi * turnover;
  return r2(brokerage + COSTS.stt * sell + exch + sebi + COSTS.stamp * buy + COSTS.gst * (brokerage + exch + sebi));
}

/* ------------------------------------------------------------ the data, in arrays */

export type Bars = { t: Float64Array; o: Float64Array; h: Float64Array; l: Float64Array; c: Float64Array };
export type StockData = {
  symbol: string; lot: number;
  m1: Bars; b5: Bars;
  /** date -> [start, end) index into m1 / b5. */
  m1Day: Map<string, [number, number]>; b5Day: Map<string, [number, number]>;
  /** Official daily closes. */
  close: Map<string, number>;
  /** sma period -> the SMA at each b5 index (NaN before there are enough bars). */
  smaCache: Map<number, Float64Array>;
};

const toBars = (c: Candle[]): Bars => ({
  t: Float64Array.from(c, x => x.t), o: Float64Array.from(c, x => x.o), h: Float64Array.from(c, x => x.h),
  l: Float64Array.from(c, x => x.l), c: Float64Array.from(c, x => x.c),
});

function dayIndex(t: Float64Array): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  let cur = '', start = 0;
  for (let i = 0; i < t.length; i++) {
    const d = ist(t[i]!).date;
    if (d !== cur) { if (cur) m.set(cur, [start, i]); cur = d; start = i; }
  }
  if (cur) m.set(cur, [start, t.length]);
  return m;
}

/**
 * 5-minute bars from 1-minute candles: 09:15 … 15:25 buckets only, each bar the OHLC of the
 * 1-minute candles inside it. A bucket with no candle is absent, as it is in Dhan's own series.
 */
export function fiveFromOne(m1: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (const k of m1) {
    const { minutes } = ist(k.t);
    if (minutes < OPEN_MIN || minutes >= 15 * 60 + 30) continue;
    const bt = Math.floor(k.t / FIVE) * FIVE;
    const last = out[out.length - 1];
    if (last && last.t === bt) { last.h = Math.max(last.h, k.h); last.l = Math.min(last.l, k.l); last.c = k.c; }
    else out.push({ t: bt, o: k.o, h: k.h, l: k.l, c: k.c });
  }
  return out;
}

export function makeStock(symbol: string, lot: number, m1: Candle[], close: Map<string, number>, b5?: Candle[]): StockData {
  const five = b5 ?? fiveFromOne(m1);
  const s: StockData = { symbol, lot, m1: toBars(m1), b5: toBars(five), m1Day: new Map(), b5Day: new Map(), close, smaCache: new Map() };
  s.m1Day = dayIndex(s.m1.t);
  s.b5Day = dayIndex(s.b5.t);
  return s;
}

/** The SMA over the last `n` 5-minute closes at every index. Earlier sessions count, as live. */
function smaSeries(s: StockData, n: number): Float64Array {
  const hit = s.smaCache.get(n);
  if (hit) return hit;
  const c = s.b5.c, out = new Float64Array(c.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < c.length; i++) {
    sum += c[i]!;
    if (i >= n) sum -= c[i - n]!;
    if (i + 1 >= n) out[i] = sum / n;
  }
  s.smaCache.set(n, out);
  return out;
}

/* ------------------------------------------------------------ selection (rows 5, 6) */

export type Pick = { symbol: string; chg: number };

/** Row 5: chg % at 09:20:00 (the 09:19 candle's close) against the previous session's official close. */
export function chgAt0920(s: StockData, date: string, prevDate: string | null): number | null {
  const d = s.m1Day.get(date);
  const prev = prevDate ? s.close.get(prevDate) : undefined;
  if (!d || !prev) return null;
  const want = at(date, 9 * 60 + 19);
  for (let i = d[0]; i < d[1]; i++) if (s.m1.t[i] === want) return r2((s.m1.c[i]! - prev) / prev * 100);
  return null;
}

/** Rows 5, 6: the day's candidates, strongest |chg| first, a tie to the symbol, at most 10. */
export function selectDay(chgs: Pick[], minChg: number, dir: Direction): Pick[] {
  return chgs.filter(p => Math.abs(p.chg) >= minChg && (dir === 'either' || p.chg !== 0))
    .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg) || a.symbol.localeCompare(b.symbol))
    .slice(0, MAX_POSITIONS);
}

/* ------------------------------------------------------------ one trade (rows 7, 8) */

export type Skip = 'no-day' | 'no-range' | 'frozen' | 'no-break' | 'double-break' | 'no-exit-price';
export type TTrade = {
  date: string; symbol: string; side: Side; chg: number; lot: number;
  range: { high: number; low: number }; entryT: number; entryPx: number;
  exitT: number; exitPx: number; reason: 'stop' | 'target' | 'sma' | 'eod';
  gross: number; cost: number; net: number;
};

/** The price at instant `T`: the open of the candle starting then, or the close of the one ending then. */
export function priceAt(s: StockData, date: string, T: number): number | null {
  const d = s.m1Day.get(date);
  if (!d) return null;
  let best = -1;
  for (let i = d[0]; i < d[1]; i++) {
    const t = s.m1.t[i]!;
    if (t === T) return s.m1.o[i]!;
    if (t + MINUTE <= T) best = i; else break;
  }
  return best >= 0 ? s.m1.c[best]! : null;
}

/** Row 18's late fill: the close of the candle starting at `T`, if there is one. */
function closeOfMinute(s: StockData, date: string, T: number): number | null {
  const d = s.m1Day.get(date);
  if (!d) return null;
  for (let i = d[0]; i < d[1]; i++) { const t = s.m1.t[i]!; if (t === T) return s.m1.c[i]!; if (t > T) break; }
  return null;
}

type Break = { side: Side; i: number; level: number; entryPx: number; range: { high: number; low: number } } | { skip: Skip };

/** Row 7: the range and the first strict break. Memoised per (stock, day, rangeBars, dir, side). */
function findBreak(s: StockData, date: string, rangeBars: number, frozen: boolean, want: Side | null, memo: Map<string, Break>, fill: FillModel): Break {
  const key = `${date}|${rangeBars}|${frozen}|${want ?? 'E'}|${fill}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const res = ((): Break => {
    const d1 = s.m1Day.get(date), d5 = s.b5Day.get(date);
    if (!d1 || !d5) return { skip: 'no-day' };
    let high = -Infinity, low = Infinity;
    for (let k = 0; k < rangeBars; k++) {
      const T = at(date, OPEN_MIN + 5 * k);
      let found = -1;
      for (let i = d5[0]; i < d5[1]; i++) if (s.b5.t[i] === T) { found = i; break; }
      if (found < 0) return { skip: 'no-range' };
      high = Math.max(high, s.b5.h[found]!); low = Math.min(low, s.b5.l[found]!);
    }
    if (frozen && (low > 0 ? (high - low) / low * 100 : 0) < FROZEN_RANGE_PCT) return { skip: 'frozen' };
    const ready = at(date, OPEN_MIN + 5 * rangeBars), until = at(date, ENTRY_UNTIL_MIN);
    for (let i = d1[0]; i < d1[1]; i++) {
      const t = s.m1.t[i]!;
      if (t < ready) continue;
      if (t >= until) break;
      const up = s.m1.h[i]! > high, down = s.m1.l[i]! < low;
      if (want === null && up && down) return { skip: 'double-break' };
      const side: Side | null = want === null ? (up ? 'BUY' : down ? 'SELL' : null) : (want === 'BUY' ? (up ? 'BUY' : null) : (down ? 'SELL' : null));
      if (!side) continue;
      const level = side === 'BUY' ? high : low;
      const o = s.m1.o[i]!;
      const beyond = side === 'BUY' ? o > level : o < level;
      const entryPx = fill === 'late1m' ? s.m1.c[i]! : beyond ? o : r2(level + (side === 'BUY' ? TICK : -TICK));
      return { side, i, level, entryPx, range: { high, low } };
    }
    return { skip: 'no-break' };
  })();
  memo.set(key, res);
  return res;
}

/** Row 8 (c): when N completed 5-minute closes against the SMA make the exit due, or null. */
function smaDue(s: StockData, date: string, side: Side, entryT: number, sma: number, closes: number): number | null {
  const d5 = s.b5Day.get(date)!;
  const sq = at(date, SQUARE_OFF_MIN);
  const from = Math.floor(entryT / FIVE) * FIVE;
  const ser = smaSeries(s, sma);
  let against = 0;
  for (let i = d5[0]; i < d5[1]; i++) {
    const t = s.b5.t[i]!;
    if (t < from || t + FIVE > sq - 1) continue;
    const m = ser[i]!;
    if (Number.isNaN(m)) { against = 0; continue; }
    const c = s.b5.c[i]!;
    against = (side === 'BUY' ? c < m : c > m) ? against + 1 : 0;
    if (against >= closes) return t + FIVE;
  }
  return null;
}

/** Rows 7-9: one stock, one day, one setting. */
export function tradeOne(s: StockData, date: string, pick: Pick, p: TrainParams, memo: Map<string, Break>, fill: FillModel = 'level'): TTrade | { skip: Skip } {
  const want: Side | null = p.dir === 'gap' ? (pick.chg > 0 ? 'BUY' : 'SELL') : null;
  const b = findBreak(s, date, p.rangeBars, p.frozen, want, memo, fill);
  if ('skip' in b) return b;
  const { side, i: bi, entryPx, range } = b;
  const entryT = s.m1.t[bi]!;
  const sq = at(date, SQUARE_OFF_MIN);
  const due = smaDue(s, date, side, entryT, p.sma, p.closes) ?? sq;
  const stopPx = side === 'BUY' ? range.low : range.high;
  const tgtPx = r2(side === 'BUY' ? entryPx + TARGET_R * (entryPx - stopPx) : entryPx - TARGET_R * (stopPx - entryPx));

  let exitT = due, exitPx: number | null = null, reason: TTrade['reason'] = due === sq ? 'eod' : 'sma';
  if (p.stop || p.target) {
    const d1 = s.m1Day.get(date)!;
    for (let i = bi + 1; i < d1[1]; i++) {
      const t = s.m1.t[i]!;
      if (t >= due) break;
      const o = s.m1.o[i]!, h = s.m1.h[i]!, l = s.m1.l[i]!;
      const hitStop = p.stop && (side === 'BUY' ? l <= stopPx : h >= stopPx);
      const hitTgt = p.target && (side === 'BUY' ? h >= tgtPx : l <= tgtPx);
      if (hitStop) { exitT = t; reason = 'stop'; exitPx = fill === 'late1m' ? s.m1.c[i]! : (side === 'BUY' ? o < stopPx : o > stopPx) ? o : stopPx; break; }
      if (hitTgt) { exitT = t; reason = 'target'; exitPx = fill === 'late1m' ? s.m1.c[i]! : (side === 'BUY' ? o > tgtPx : o < tgtPx) ? o : tgtPx; break; }
    }
  }
  if (exitPx === null && fill === 'late1m') exitPx = closeOfMinute(s, date, exitT);
  if (exitPx === null) exitPx = priceAt(s, date, exitT);
  if (exitPx === null) return { skip: 'no-exit-price' };
  const gross = r2((exitPx - entryPx) * s.lot * (side === 'BUY' ? 1 : -1));
  const cost = costOf(side, entryPx, exitPx, s.lot);
  return { date, symbol: s.symbol, side, chg: pick.chg, lot: s.lot, range, entryT, entryPx, exitT, exitPx, reason, gross, cost, net: r2(gross - cost) };
}

/* ------------------------------------------------------------ the grid */

export type ComboResult = { key: string; p: TrainParams; perDay: Float64Array; tradesPerDay: Int32Array; trades: number; wins: number; gross: number; cost: number; net: number; skips: Record<Skip, number> };

/** Row 4: sessions where at least `minStocks` stocks have candles. */
export function sessionsOf(stocks: StockData[], minStocks = 100): string[] {
  const n = new Map<string, number>();
  for (const s of stocks) for (const d of s.m1Day.keys()) n.set(d, (n.get(d) ?? 0) + 1);
  return [...n].filter(([, k]) => k >= minStocks).map(([d]) => d).sort();
}

export function dayPicks(stocks: StockData[], sessions: string[]): Map<string, Pick[]> {
  const out = new Map<string, Pick[]>();
  for (let k = 0; k < sessions.length; k++) {
    const date = sessions[k]!;
    const picks: Pick[] = [];
    for (const s of stocks) {
      // The previous session this stock has an official close for, strictly before `date`.
      let prev: string | null = null;
      for (const d of s.close.keys()) if (d < date && (prev === null || d > prev)) prev = d;
      const chg = chgAt0920(s, date, prev);
      if (chg !== null) picks.push({ symbol: s.symbol, chg });
    }
    out.set(date, picks);
  }
  return out;
}

export function runGrid(stocks: StockData[], sessions: string[], picks: Map<string, Pick[]>, grid: TrainParams[] = TRAIN_GRID, keepTrades: Set<string> = new Set(), fill: FillModel = 'level') {
  const bySym = new Map(stocks.map(s => [s.symbol, s]));
  const memos = new Map<string, Map<string, Break>>(stocks.map(s => [s.symbol, new Map()]));
  const results: ComboResult[] = [];
  const kept = new Map<string, TTrade[]>();
  for (const p of grid) {
    const key = tkey(p);
    const r: ComboResult = {
      key, p, perDay: new Float64Array(sessions.length), tradesPerDay: new Int32Array(sessions.length), trades: 0, wins: 0, gross: 0, cost: 0, net: 0,
      skips: { 'no-day': 0, 'no-range': 0, frozen: 0, 'no-break': 0, 'double-break': 0, 'no-exit-price': 0 },
    };
    const keep = keepTrades.has(key) ? [] as TTrade[] : null;
    for (let k = 0; k < sessions.length; k++) {
      const date = sessions[k]!;
      for (const pk of selectDay(picks.get(date) ?? [], p.minChg, p.dir)) {
        const s = bySym.get(pk.symbol)!;
        const t = tradeOne(s, date, pk, p, memos.get(pk.symbol)!, fill);
        if ('skip' in t) { r.skips[t.skip]++; continue; }
        r.trades++; r.tradesPerDay[k]!++;
        if (t.net > 0) r.wins++;
        r.gross += t.gross; r.cost += t.cost; r.net += t.net; r.perDay[k]! += t.net;
        keep?.push(t);
      }
    }
    r.gross = r2(r.gross); r.cost = r2(r.cost); r.net = r2(r.net);
    for (let k = 0; k < sessions.length; k++) r.perDay[k] = r2(r.perDay[k]!);
    results.push(r);
    if (keep) kept.set(key, keep);
  }
  return { results, kept };
}

/* ------------------------------------------------------------ walk-forward (row 13) */

export type TrainWF = {
  steps: { trainedOn: number; testDate: string; chosen: string; chosenNet: number; baselineNet: number }[];
  heldOut: number; baseline: number; switches: number; chosenCounts: Record<string, number>;
};

export function walkForwardTrain(sessions: string[], results: ComboResult[], baselineKey: string, first = WF_FIRST_TEST, minTrades = WF_MIN_TRADES): TrainWF {
  const order = [...results].sort((a, b) => (a.key === baselineKey ? -1 : b.key === baselineKey ? 1 : a.key.localeCompare(b.key)));
  const base = results.find(r => r.key === baselineKey)!;
  const steps: TrainWF['steps'] = [];
  const counts: Record<string, number> = {};
  let prev = '', switches = 0;
  for (let k = first; k < sessions.length; k++) {
    let best: ComboResult | null = null, bv = -Infinity;
    for (const r of order) {
      let n = 0, v = 0;
      for (let j = 0; j < k; j++) { n += r.tradesPerDay[j]!; v += r.perDay[j]!; }
      if (n < minTrades) continue;
      if (v > bv + 1e-9) { bv = v; best = r; }
    }
    const chosen = best ?? base;
    if (prev && chosen.key !== prev) switches++;
    prev = chosen.key;
    counts[chosen.key] = (counts[chosen.key] ?? 0) + 1;
    steps.push({ trainedOn: k, testDate: sessions[k]!, chosen: chosen.key, chosenNet: chosen.perDay[k]!, baselineNet: base.perDay[k]! });
  }
  return {
    steps, heldOut: r2(steps.reduce((s, x) => s + x.chosenNet, 0)), baseline: r2(steps.reduce((s, x) => s + x.baselineNet, 0)),
    switches, chosenCounts: counts,
  };
}

/* ------------------------------------------------------------ measures (rows 14, 15) */

export function splitNet(r: ComboResult, sessions: string[]) {
  const half = Math.floor(sessions.length / 2);
  const sum = (from: number, to: number) => r2(Array.from(r.perDay.slice(from, to)).reduce((s, x) => s + x, 0));
  const byMonth: Record<string, number> = {}, byWeekday: Record<string, number> = {};
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  sessions.forEach((d, k) => {
    byMonth[d.slice(0, 7)] = r2((byMonth[d.slice(0, 7)] ?? 0) + r.perDay[k]!);
    const wd = WD[new Date(`${d}T00:00:00Z`).getUTCDay()]!;
    byWeekday[wd] = r2((byWeekday[wd] ?? 0) + r.perDay[k]!);
  });
  let peak = 0, cum = 0, dd = 0, worst = Infinity, worstDay = '';
  sessions.forEach((d, k) => { cum += r.perDay[k]!; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); if (r.perDay[k]! < worst) { worst = r.perDay[k]!; worstDay = d; } });
  const positiveDays = Array.from(r.perDay).filter(x => x > 0).length;
  return { firstHalf: sum(0, half), secondHalf: sum(half, sessions.length), byMonth, byWeekday, maxDrawdown: r2(dd), worstDay: { date: worstDay, net: r2(worst) }, positiveDays };
}

export function marginals(results: ComboResult[]) {
  const dims: (keyof TrainParams)[] = ['minChg', 'dir', 'rangeBars', 'sma', 'closes', 'stop', 'target', 'frozen'];
  const out: Record<string, { value: string; combos: number; trades: number; netPerTrade: number | null; netPerCombo: number }[]> = {};
  for (const d of dims) {
    const g = new Map<string, { combos: number; trades: number; net: number }>();
    for (const r of results) {
      const v = String(r.p[d]);
      const x = g.get(v) ?? { combos: 0, trades: 0, net: 0 };
      x.combos++; x.trades += r.trades; x.net += r.net;
      g.set(v, x);
    }
    out[d] = [...g].map(([value, x]) => ({ value, combos: x.combos, trades: x.trades, netPerTrade: x.trades ? r2(x.net / x.trades) : null, netPerCombo: r2(x.net / x.combos) }));
  }
  return out;
}
