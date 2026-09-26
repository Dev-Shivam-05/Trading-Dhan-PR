/**
 * P51 — the index option backtest: P50's 920 and AI LTP signals turned into option trades priced from the options'
 * own minute candles. `docs/spec/ltp-backtest-v1.md` (every "row N" below is a row of that spec).
 *
 * The entries are P50's, untouched. This file decides only which option is bought (row 3), at what price (row 4), how
 * the trade ends (rows 5-6), how big it is and what it costs (rows 7-8).
 *
 * Two things that will bite anyone editing this:
 *  1. **Stops and targets are INDEX levels; the P&L is the OPTION's.** A call's stop is hit when NIFTY's low reaches
 *     it; the loss is whatever that option's candle says it was worth then.
 *  2. **Both fill models, always** (CLAUDE.md, P44). Neither is a price at the line: the data has no premium there.
 *
 * Pure: no I/O, no clock, nothing from dhan.ts.
 */

import type { ChainDay } from './chainhist.ts';
import { drawnFor, priceVeto, stepOf, type Buy, type DayLines, type Signal, type Veto } from './ltp-lines.ts';

/* ------------------------------------------------------------------ constants (each is a spec row) */

/** Row 7: the user's per-trade budget, and today's NIFTY lot (GUESS for past days). */
export const BUDGET = 20_000;
export const LOT = 65;
/** Row 5: V117's mechanical target and stop, in index points. */
export const MECH_PTS = 50;
/** Row 6: V48 — everything closed at 2:30. The time exit is the close of this minute. */
export const EXIT_HM = '14:29';
/** Row 8 (GUESS): options, per round trip. */
export const COSTS = { brokeragePerOrder: 20, stt: 0.001, exchange: 0.0003503, sebi: 0.000001, stamp: 0.00003, gst: 0.18 };
/** P52 (OQ-9): the deepest in-the-money strike tried. */
export const MAX_DEPTH = 4;
/** Row 1: the vetoes a different stop/target can change. */
export const PRICE_VETOES: Veto[] = ['no-stop', 'stop-on-entry', 'target', 'ratio'];

/* ------------------------------------------------------------------ types */

export type Fill = 'touch' | 'late1m';
export type Book = '920' | 'ai';
export type Cfg = {
  book: Book;
  /** A preset, or (P52) one line's name to trade that line on its own. */
  lines: 'all' | 'ext' | 'outer' | string;
  /** P52 adds 'nextline' (V48: the next 920 line in the trade's direction). */
  target: 'structure' | 'mech50' | 'nextline';
  stop: 'structure' | 'mech50';
  /** P52 variants. Index points for a mechanical target / stop (V99's grid); strikes in the money (OQ-9); the IV gate. */
  tgtPts?: number; stopPts?: number; depth?: number; ivGate?: boolean;
};
export const DEFAULT_CFG: Cfg = { book: '920', lines: 'all', target: 'structure', stop: 'structure' };

/** One day, reduced to what a trade needs: the index path, which side each minute permits, and option closes. */
export type DayBook = {
  date: string;
  hm: string[];
  h: number[]; l: number[]; c: number[];
  /** Row 6: which side the verdict of minute i permits (P50 row 17). */
  permit: { CE: boolean; PE: boolean }[];
  signals: Signal[];
  step: number;
  gapWidth: number | null;
  /** P52: the four 920 values (for the `nextline` target), and P49's IV verdict per minute (unbalanced AND moving). */
  l920: Record<string, number | null>;
  /** P52 (Q11): the 09:20 resistance and support strikes. */
  R920: number | null; S920: number | null;
  ivBad: boolean[];
  /** `${strike}CE` -> the leg's close at each session minute. */
  legs: Record<string, (number | null)[]>;
};

export type Trade = {
  date: string; book: Book; line: string; buy: Buy; strike: number;
  basis: Signal['basis'];
  i: number; hm: string;
  /** Index levels. */
  entryLevel: number; stop: number; target: number;
  entryPx: number; exitPx: number; exitI: number; exitHm: string;
  reason: 'target' | 'stop' | 'time' | 'state';
  lots: number; units: number; overBudget: boolean;
  /** Option premium per unit, and the index move the trade saw (for V117, whose figures are index points). */
  points: number; idxPoints: number;
  gross: number; cost: number; net: number;
  minutes: number;
  gapWidth: number | null;
};

export type DayResult = { trades: Trade[]; eligible: number; busy: number; noPrice: number; priceVetoed: number; ivVetoed: number };

/* ------------------------------------------------------------------ rows 7-8 */

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Row 7. */
export function lotsFor(premium: number): { lots: number; overBudget: boolean } {
  const one = premium * LOT;
  return { lots: Math.max(1, Math.floor(BUDGET / one)), overBudget: one > BUDGET };
}

/** Row 8: one bought option's round trip of `units`, to the paisa. */
export function costOf(entry: number, exit: number, units: number): number {
  const buy = entry * units, sell = exit * units, turnover = buy + sell;
  const brokerage = 2 * COSTS.brokeragePerOrder;
  const exch = COSTS.exchange * turnover, sebi = COSTS.sebi * turnover;
  return r2(brokerage + COSTS.stt * sell + exch + sebi + COSTS.stamp * buy + COSTS.gst * (brokerage + exch + sebi));
}

/* ------------------------------------------------------------------ preparing a day */

/** Row 3: the strike nearest the line; an exact half goes to the lower strike. */
export function nearestStrike(level: number, step: number): number {
  const k = Math.floor(level / step) * step;
  return level - k > step / 2 ? k + step : k;
}

export function prepareDay(dl: DayLines, day: ChainDay): DayBook {
  const hm = dl.minutes.map(m => m.hm);
  const raw = new Map(day.t.map((t, i) => [t, i]));
  const at = dl.minutes.map(m => raw.get(m.t)!);
  const permit = dl.states.map(s => drawnFor(s.scenario, s.verdict).permit);
  const rows = dl.minutes.find(m => m.rows.length)?.rows ?? [];
  const step = rows.length ? stepOf(rows) : 50;
  // Only the legs a trade could buy (row 3's strike and its fallback): 680 days of every leg do not fit comfortably.
  const want = new Set<string>();
  for (const s of dl.signals) {
    if (s.veto !== null && !PRICE_VETOES.includes(s.veto)) continue;
    // Row 3's strike and its fallback, at every depth P52 tries (0-4 strikes in the money).
    const k0 = nearestStrike(s.entry, step), itm = s.buy === 'CE' ? -step : step;
    for (let d = 0; d <= MAX_DEPTH; d++) { const k = k0 + d * itm; want.add(`${k}${s.buy}`); want.add(`${k - itm}${s.buy}`); }
  }
  const legs: Record<string, (number | null)[]> = {};
  for (const k of want) { const l = day.legs[k]; if (l) legs[k] = at.map(i => l.c[i] ?? null); }
  return {
    date: dl.date, hm,
    h: dl.minutes.map(m => m.h), l: dl.minutes.map(m => m.l), c: dl.minutes.map(m => m.c),
    permit, signals: dl.signals, step, gapWidth: dl.l920.gapWidth, legs,
    l920: Object.fromEntries(dl.l920.lines.map(l => [l.name, l.value])),
    R920: dl.l920.R, S920: dl.l920.S,
    ivBad: dl.states.map(st => st.iv.balance === 'unbalanced' && st.iv.move === 'moving'),
  };
}

/* ------------------------------------------------------------------ the trade walk */

const LINES: Record<Book, Record<Cfg['lines'], string[]>> = {
  '920': { all: ['EOR+1', 'EOR', 'EOS', 'EOS-1'], ext: ['EOR', 'EOS'], outer: ['EOR+1', 'EOS-1'] },
  ai: { all: ['R Risky', 'R Moderate', 'S Risky', 'S Moderate'], ext: ['R Moderate', 'S Moderate'], outer: ['R Risky', 'S Risky'] },
};

/** Row 1: the signals this config may trade, before its own stop/target is priced. */
export function eligibleSignals(b: DayBook, cfg: Cfg): Signal[] {
  const set = LINES[cfg.book][cfg.lines as 'all'] ?? [cfg.lines];
  return b.signals.filter(s => s.kind === cfg.book && set.includes(s.line) && (s.veto === null || PRICE_VETOES.includes(s.veto)));
}

/** A close at minute j, or the next one that exists (a leg can miss a minute). */
function closeFrom(col: (number | null)[] | undefined, j: number): { px: number; j: number } | null {
  if (!col) return null;
  for (let k = j; k < col.length; k++) if (col[k] !== null && col[k] !== undefined) return { px: col[k]!, j: k };
  return null;
}

export function tradeDay(b: DayBook, cfg: Cfg, fill: Fill): DayResult {
  const out: DayResult = { trades: [], eligible: 0, busy: 0, noPrice: 0, priceVetoed: 0, ivVetoed: 0 };
  const last = b.hm.length - 1;
  const timeExit = (() => { const k = b.hm.indexOf(EXIT_HM); return k < 0 ? last : k; })();
  let freeAfter = -1;                                   // the book is open through this minute index
  for (const s of eligibleSignals(b, cfg)) {
    out.eligible++;
    if (s.i <= freeAfter) { out.busy++; continue; }
    const up = s.buy === 'CE';
    const sp = cfg.stopPts ?? (cfg.stop === 'mech50' ? MECH_PTS : null), tp = cfg.tgtPts ?? (cfg.target === 'mech50' ? MECH_PTS : null);
    const stop = sp !== null ? s.entry + (up ? -sp : sp) : s.stop;
    const target = tp !== null ? s.entry + (up ? tp : -tp)
      : cfg.target === 'nextline' && s.kind === '920' ? nextLine(b.l920, s.entry, up) : s.target;
    if (priceVeto(s.buy, s.entry, stop, target)) { out.priceVetoed++; continue; }
    // P52: P49's IV gate, read from the minute before the touch like every other input (P50 row 18).
    if (cfg.ivGate && b.ivBad[s.i - 1]) { out.ivVetoed++; continue; }
    // Row 4: the fill minute; row 3: the strike, with one fallback toward the price.
    const fi = fill === 'touch' ? s.i : s.i + 1;
    if (fi > timeExit) { out.noPrice++; continue; }
    const k0 = nearestStrike(s.entry, b.step) + (cfg.depth ?? 0) * (up ? -b.step : b.step);
    let strike = k0, px = b.legs[`${k0}${s.buy}`]?.[fi] ?? null;
    if (px === null) { strike = k0 + (up ? b.step : -b.step); px = b.legs[`${strike}${s.buy}`]?.[fi] ?? null; }
    if (px === null || px <= 0) { out.noPrice++; continue; }
    const col = b.legs[`${strike}${s.buy}`]!;
    // Row 6: exits from the minute after the fill. Stop before target when one minute reaches both.
    let exitJ = timeExit, reason: Trade['reason'] = 'time', exitLevel = b.c[timeExit]!;
    for (let j = fi + 1; j <= timeExit; j++) {
      const hitStop = up ? b.l[j]! <= stop! : b.h[j]! >= stop!;
      const hitTgt = up ? b.h[j]! >= target! : b.l[j]! <= target!;
      if (hitStop) { exitJ = j; reason = 'stop'; exitLevel = stop!; break; }
      if (hitTgt) { exitJ = j; reason = 'target'; exitLevel = target!; break; }
      if (cfg.book === 'ai' && !b.permit[j]![s.buy]) { exitJ = j; reason = 'state'; exitLevel = b.c[j]!; break; }
    }
    const pj = fill === 'touch' ? exitJ : Math.min(exitJ + 1, last);
    const ex = closeFrom(col, pj) ?? closeFrom(col, exitJ);
    const exitPx = ex?.px ?? px;
    const { lots, overBudget } = lotsFor(px);
    const units = lots * LOT;
    const points = r2(exitPx - px);
    const gross = r2(points * units), cost = costOf(px, exitPx, units);
    out.trades.push({
      date: b.date, book: cfg.book, line: s.line, buy: s.buy, strike, basis: s.basis ?? null, i: s.i, hm: s.hm,
      entryLevel: s.entry, stop: stop!, target: target!, entryPx: px, exitPx, exitI: exitJ, exitHm: b.hm[exitJ]!, reason,
      lots, units, overBudget, points, idxPoints: r2(up ? exitLevel - s.entry : s.entry - exitLevel),
      gross, cost, net: r2(gross - cost), minutes: exitJ - fi, gapWidth: b.gapWidth,
    });
    freeAfter = exitJ;
  }
  return out;
}

/** P52 (OQ-15, V48): the next 920 line beyond the entry in the trade's direction. */
function nextLine(l920: Record<string, number | null>, entry: number, up: boolean): number | null {
  let best: number | null = null;
  for (const v of Object.values(l920)) {
    if (v === null || (up ? v <= entry + 0.05 - 1e-9 : v >= entry - 0.05 + 1e-9)) continue;
    if (best === null || (up ? v < best : v > best)) best = v;
  }
  return best;
}

/* ------------------------------------------------------------------ the report (rows 9-11) */

export type Summary = {
  trades: number; targetPct: number; positivePct: number; points: number; idxPoints: number;
  gross: number; cost: number; net: number; maxDrawdown: number; medianMinutes: number;
};

export function summarise(ts: Trade[]): Summary {
  let eq = 0, peak = 0, dd = 0;
  for (const t of ts) { eq += t.net; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
  const mins = ts.map(t => t.minutes).sort((a, b) => a - b);
  const sum = (f: (t: Trade) => number) => r2(ts.reduce((a, t) => a + f(t), 0));
  return {
    trades: ts.length,
    targetPct: ts.length ? r2(100 * ts.filter(t => t.reason === 'target').length / ts.length) : 0,
    positivePct: ts.length ? r2(100 * ts.filter(t => t.net > 0).length / ts.length) : 0,
    points: sum(t => t.points), idxPoints: sum(t => t.idxPoints),
    gross: sum(t => t.gross), cost: sum(t => t.cost), net: sum(t => t.net),
    maxDrawdown: r2(dd), medianMinutes: mins.length ? mins[mins.length >> 1]! : 0,
  };
}

/** Row 11: the 24 configurations. */
export const CONFIGS: Cfg[] = [];
for (const book of ['920', 'ai'] as const) for (const lines of ['all', 'ext', 'outer'] as const)
  for (const target of ['structure', 'mech50'] as const) for (const stop of ['structure', 'mech50'] as const)
    CONFIGS.push({ book, lines, target, stop });
export const cfgKey = (c: Cfg) => `${c.book}/${c.lines}/t-${c.tgtPts ?? c.target}/s-${c.stopPts ?? c.stop}`
  + (c.depth ? `/itm${c.depth}` : '') + (c.ivGate ? '/iv' : '');

/** Row 11 (GUESS windows): train on the previous 6 months, trade the next one; <10 trades -> the P34 default. */
export const WF_TRAIN_MONTHS = 6;
export const WF_MIN_TRADES = 10;

export function walkForward(byMonth: Map<string, Map<string, Trade[]>>): { months: { month: string; chosen: string; net: number; trades: number }[]; oos: number; oosTrades: number } {
  const months = [...byMonth.keys()].sort();
  const res: { month: string; chosen: string; net: number; trades: number }[] = [];
  for (let m = WF_TRAIN_MONTHS; m < months.length; m++) {
    const train = months.slice(m - WF_TRAIN_MONTHS, m);
    let best = cfgKey(DEFAULT_CFG), bestNet = -Infinity;
    for (const c of CONFIGS) {
      const k = cfgKey(c);
      const ts = train.flatMap(x => byMonth.get(x)?.get(k) ?? []);
      if (ts.length < WF_MIN_TRADES) continue;
      const net = ts.reduce((a, t) => a + t.net, 0);
      if (net > bestNet) { bestNet = net; best = k; }
    }
    const test = byMonth.get(months[m]!)?.get(best) ?? [];
    res.push({ month: months[m]!, chosen: best, net: r2(test.reduce((a, t) => a + t.net, 0)), trades: test.length });
  }
  return { months: res, oos: r2(res.reduce((a, x) => a + x.net, 0)), oosTrades: res.reduce((a, x) => a + x.trades, 0) };
}
