/**
 * P37 — the backtest engine. `docs/spec/backtest-v1.md`.
 *
 * Pure: every function here is a function of its arguments. The data comes in through a
 * `DataSource` that answers synchronously from what `history.ts` already has on disk. When it
 * does not have something (a 1-minute series nobody fetched yet), the engine records the key in
 * `missing` and skips that leg, and the job fetches the missing keys and runs again.
 *
 * The engine is deliberately its OWN implementation of P33's rules, parameterised for the grid
 * (row 10). With the default parameters it must agree with `paper.ts` on every trade. AC2 checks
 * this against `openingRange` / `smaAt` / `applyBars`, so the live rules and the backtest cannot
 * silently drift apart.
 */

import { nseFunnel, type NseScanRow } from './scanner-nse.ts';
import type { NseBundle } from './nse.ts';
import { MAX_POSITIONS, pnlOf, type OptionPick } from './paper.ts';

/* ------------------------------------------------------------ spec values */

/** Row 7 (GUESS): one tick beyond the level when the break candle did not open beyond it. */
export const TICK = 0.05;
/** Rows 6 and 14. Minutes after IST midnight. */
export const OPEN_MIN = 9 * 60 + 15;
export const ENTRY_UNTIL_MIN = 15 * 60;
export const SQUARE_OFF_MIN = 15 * 60 + 15;
export const JOB_AT_MIN = 16 * 60;
/** Row 4: a real scan counts when NSE stamped its prices inside this window. */
export const REAL_SCAN_FROM_MIN = 9 * 60 + 15;
export const REAL_SCAN_UNTIL_MIN = 9 * 60 + 30;

export type Params = { topN: 20 | 25 | 30; sma: number; closes: number; rangeBars: 1 | 2 | 3 };
/** The live rules today (P33): top 20, SMA9, 2 closes, the 09:15 + 09:20 range. */
export const DEFAULT_PARAMS: Params = { topN: 20, sma: 9, closes: 2, rangeBars: 2 };
/** Row 10: 3 x 4 x 3 x 3 = 108. */
export const GRID: Params[] = [];
for (const topN of [20, 25, 30] as const)
  for (const sma of [5, 9, 13, 20])
    for (const closes of [1, 2, 3])
      for (const rangeBars of [1, 2, 3] as const) GRID.push({ topN, sma, closes, rangeBars });
export const keyOf = (p: Params) => `top${p.topN}/sma${p.sma}/x${p.closes}/r${p.rangeBars}`;

const FIVE = 5 * 60_000;
const MINUTE = 60_000;
const IST_MS = 5.5 * 3600_000;
const r2 = (x: number) => Math.round(x * 100) / 100;

/* ------------------------------------------------------------------ types */

/** A candle. `t` is its OPEN time, epoch ms. `oi` only on futures 5-minute candles. */
export type Candle = { t: number; o: number; h: number; l: number; c: number; oi?: number };
export type Side = 'BUY' | 'SELL';
export type Signal = { symbol: string; side: Side; chgPct: number };
export type DayKind = 'real' | 'proxy';
export type Contract = { futureId: number; lot: number; expiry: string };

export type DataSource = {
  /** Every 5-minute candle of the contract that was near-month on `date`, up to the end of `date`. */
  fut5(symbol: string, date: string): Candle[] | null;
  contract(symbol: string, date: string): Contract | null;
  /** A 1-minute series (future or option), or null when it has not been fetched. */
  m1(securityId: number): Candle[] | null;
  options(symbol: string, expiry: string): OptionPick[];
};

export type OptionLeg = {
  strike: number; optionType: 'CE' | 'PE'; securityId: number; lot: number;
  entryPx: number; entryT: number; exitPx: number; exitT: number; pnl: number;
};

export type Trade = {
  date: string; kind: DayKind; symbol: string; side: Side; lot: number;
  range: { high: number; low: number };
  level: number; entryT: number; entryPx: number;
  exitT: number; exitPx: number; reason: 'sma' | 'eod';
  /** The completed 5-minute candle whose close made the exit due, and the SMA at it. */
  exitBarT: number | null; smaAtExit: number | null;
  futPnl: number;
  opt: OptionLeg | null;
  optNote: string | null;
  pnl: number;
};

/* ------------------------------------------------------------- the clock */

export function ist(ms: number) {
  const d = new Date(ms + IST_MS);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), hm: d.toISOString().slice(11, 16), weekday: d.getUTCDay() };
}
/** Epoch ms of `minutes` after IST midnight on `date`. */
export const at = (date: string, minutes: number) => Date.parse(`${date}T00:00:00Z`) - IST_MS + minutes * 60_000;

/** Row 1: the day after the last Tuesday of the month before `expiry`'s month. */
export function windowStart(expiry: string): string {
  const [y, m] = expiry.split('-').map(Number) as [number, number];
  // Day 0 of this month is the last day of the previous one.
  const last = new Date(Date.UTC(y, m - 1, 0));
  const back = (last.getUTCDay() - 2 + 7) % 7;   // 2 = Tuesday
  const tue = new Date(last.getTime() - back * 86_400_000);
  return new Date(tue.getTime() + 86_400_000).toISOString().slice(0, 10);
}

/** Row 14 / AC7: is the nightly job due? A weekday, at or after 16:00 IST, not yet run today. */
export function jobDue(lastRunDate: string | null, nowMs: number): boolean {
  const { date, minutes, weekday } = ist(nowMs);
  if (weekday === 0 || weekday === 6) return false;
  if (minutes < JOB_AT_MIN) return false;
  return lastRunDate === null || lastRunDate < date;
}

/* ------------------------------------------------------------- the scan */

/** Rows 4, 6: the live cap — both lists merged, strongest |chg%| first, at most 10. */
export function capSignals(long: { symbol: string; chgPct: number }[], short: { symbol: string; chgPct: number }[]): Signal[] {
  return [
    ...long.map(r => ({ symbol: r.symbol, side: 'BUY' as Side, chgPct: r.chgPct })),
    ...short.map(r => ({ symbol: r.symbol, side: 'SELL' as Side, chgPct: r.chgPct })),
  ].sort((a, b) => Math.abs(b.chgPct) - Math.abs(a.chgPct) || a.symbol.localeCompare(b.symbol)).slice(0, MAX_POSITIONS);
}

export type ProxyInput = {
  symbol: string; name: string;
  px0920: number | null; prevClose: number | null;
  oi0920: number | null; prevOi: number | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nseStamp = (date: string, hms: string) => `${date.slice(8, 10)}-${MONTHS[Number(date.slice(5, 7)) - 1]}-${date.slice(0, 4)} ${hms}`;

/**
 * Row 4's proxy. Built as an NSE bundle and put through the SAME `nseFunnel` the live scan uses,
 * so the only difference from a real scan is where the two numbers come from. NSE rounds its
 * percentages to 2 dp, so these are rounded the same way before the filters see them.
 */
export function proxyScan(date: string, prevDate: string, rows: ProxyInput[], list: { symbols: string[]; names: Map<string, string>; rows: number }, topN: number) {
  const price = [], oi = [];
  const invalidP = [], invalidO = [];
  for (const r of rows) {
    if (r.px0920 && r.prevClose) {
      price.push({ symbol: r.symbol, name: r.name, ltp: r.px0920, prevClose: r.prevClose, chgPct: r2((r.px0920 - r.prevClose) / r.prevClose * 100), volume: null });
    } else invalidP.push({ symbol: r.symbol, reason: 'no 09:20 price or previous close in the history' });
    if (r.oi0920 && r.prevOi) {
      oi.push({ symbol: r.symbol, latestOi: r.oi0920, prevOi: r.prevOi, oiPct: r2((r.oi0920 - r.prevOi) / r.prevOi * 100) });
    } else invalidO.push({ symbol: r.symbol, reason: 'no future OI at 09:20 or at the previous close' });
  }
  const bundle: NseBundle = {
    mode: 'live', fetchedAt: new Date(0).toISOString(), evidence: [],
    price: { timestamp: nseStamp(date, '09:20:00'), date, marketStatus: 'Open', rows: price, invalid: invalidP },
    oi: { timestamp: nseStamp(date, '09:20:00'), currTradingDate: date, prevTradingDate: prevDate, rows: oi, invalid: invalidO },
  };
  return nseFunnel(bundle, list, topN as 20 | 25 | 30);
}

/* ------------------------------------------------------------- the replay */

const sameDay = (c: Candle, date: string) => ist(c.t).date === date;

/** Row 6: the range from the first `k` five-minute candles of `date` (09:15, 09:20, 09:25). */
export function rangeOf(bars: Candle[], date: string, k: number): { high: number; low: number } | null {
  const want = [0, 1, 2].slice(0, k).map(i => at(date, OPEN_MIN + 5 * i));
  const found = want.map(t => bars.find(b => b.t === t));
  if (found.some(b => !b)) return null;
  return { high: Math.max(...found.map(b => b!.h)), low: Math.min(...found.map(b => b!.l)) };
}

/** Row 8: the open of the first 1-minute candle at or after `dueT` on the same date. */
export function openAtOrAfter(m1: Candle[], dueT: number): Candle | null {
  const m = Math.floor(dueT / MINUTE) * MINUTE;
  const d = ist(dueT).date;
  return m1.find(c => c.t >= m && sameDay(c, d)) ?? null;
}

/** P33 row 6 / amendment 16: the nearest strike, a tie to the lower one. */
function nearest(list: OptionPick[], px: number, type: 'CE' | 'PE'): OptionPick | null {
  let best: OptionPick | null = null;
  for (const o of list) {
    if (o.optionType !== type) continue;
    if (!best) { best = o; continue; }
    const d = Math.abs(o.strike - px), bd = Math.abs(best.strike - px);
    if (d < bd || (d === bd && o.strike < best.strike)) best = o;
  }
  return best;
}

/**
 * One session, one parameter set. Returns the trades it could complete. Every series it needed
 * and did not have goes into `missing` as `m1:<securityId>`.
 */
export function replayDay(date: string, kind: DayKind, signals: Signal[], p: Params, data: DataSource, missing: Set<string>): Trade[] {
  const trades: Trade[] = [];
  const ready = at(date, OPEN_MIN + 5 * p.rangeBars);
  const until = at(date, ENTRY_UNTIL_MIN);
  const sq = at(date, SQUARE_OFF_MIN);

  for (const s of signals) {
    const c = data.contract(s.symbol, date);
    const bars = data.fut5(s.symbol, date);
    if (!c || !bars) continue;
    const range = rangeOf(bars, date, p.rangeBars);
    if (!range) continue;
    const m1 = data.m1(c.futureId);
    if (!m1) { missing.add(`m1:${c.futureId}`); continue; }

    // Rows 6, 7: the first 1-minute candle from `ready` to 15:00 that trades strictly beyond.
    const level = s.side === 'BUY' ? range.high : range.low;
    const brk = m1.find(k => k.t >= ready && k.t < until && (s.side === 'BUY' ? k.h > level : k.l < level));
    if (!brk) continue;   // no break by 15:00
    const opensBeyond = s.side === 'BUY' ? brk.o > level : brk.o < level;
    const entryPx = opensBeyond ? brk.o : r2(level + (s.side === 'BUY' ? TICK : -TICK));
    const entryT = brk.t;

    // Rows 6, 8: completed 5-minute closes from the entry candle on, SMA over completed closes
    // (earlier sessions included, as live). A candle completing AT 15:15 is not seen: live, the
    // square-off comes first (sleep-proof-v1 catch-up step 1).
    const from = Math.floor(entryT / FIVE) * FIVE;
    let against = 0, dueT = sq, reason: 'sma' | 'eod' = 'eod', exitBarT: number | null = null, smaAtExit: number | null = null;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i]!;
      if (b.t < from || !sameDay(b, date) || b.t + FIVE > sq - 1) continue;
      if (i + 1 < p.sma) { against = 0; continue; }
      let sum = 0;
      for (let k = i - p.sma + 1; k <= i; k++) sum += bars[k]!.c;
      const sma = sum / p.sma;
      const wrong = s.side === 'BUY' ? b.c < sma : b.c > sma;
      against = wrong ? against + 1 : 0;
      if (against >= p.closes) { dueT = b.t + FIVE; reason = 'sma'; exitBarT = b.t; smaAtExit = sma; break; }
    }
    const xc = openAtOrAfter(m1, dueT);
    if (!xc) continue;   // no candle after the due instant: nothing honest to price it at
    const futPnl = pnlOf(s.side, entryPx, xc.o, c.lot);

    // Row 6: the option leg, priced by rows 7 and 8 on its own 1-minute series.
    let opt: OptionLeg | null = null, optNote: string | null = null;
    const type = s.side === 'BUY' ? 'CE' : 'PE';
    const pick = nearest(data.options(s.symbol, c.expiry), entryPx, type);
    if (!pick) optNote = `no ${type} in the saved option list`;
    else {
      const om1 = data.m1(pick.securityId);
      if (!om1) { missing.add(`m1:${pick.securityId}`); optNote = 'option candles not fetched yet'; }
      else {
        const oe = openAtOrAfter(om1, entryT);
        const ox = openAtOrAfter(om1, dueT);
        if (!oe || oe.t >= dueT || !ox) optNote = 'option did not trade between entry and exit';
        else {
          const lot = pick.lot ?? c.lot;
          const oEntry = r2((oe.h + oe.l) / 2);
          opt = { strike: pick.strike, optionType: type, securityId: pick.securityId, lot, entryPx: oEntry, entryT: oe.t, exitPx: ox.o, exitT: dueT, pnl: pnlOf('BUY', oEntry, ox.o, lot) };
        }
      }
    }
    trades.push({
      date, kind, symbol: s.symbol, side: s.side, lot: c.lot, range, level, entryT, entryPx,
      exitT: dueT, exitPx: xc.o, reason, exitBarT, smaAtExit, futPnl, opt, optNote,
      pnl: r2(futPnl + (opt?.pnl ?? 0)),
    });
  }
  return trades;
}

/* ------------------------------------------------------------- measures */

export type Summary = {
  sessions: number; trades: number; wins: number; winPct: number | null;
  gross: number; avgWin: number | null; avgLoss: number | null;
  worstDay: { date: string; pnl: number } | null; maxDrawdown: number;
  bySide: Record<Side, { trades: number; gross: number }>;
  byReason: Record<'sma' | 'eod', { trades: number; gross: number }>;
  legs: { future: number; option: number; optionsMissing: number };
};

/** Row 9. `sessions` are all the dates replayed, including those with no trade. */
export function summarise(trades: Trade[], sessions: string[]): Summary {
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const byDay = new Map(sessions.map(d => [d, 0]));
  for (const t of trades) byDay.set(t.date, r2((byDay.get(t.date) ?? 0) + t.pnl));
  let peak = 0, cum = 0, dd = 0, worst: { date: string; pnl: number } | null = null;
  for (const d of [...byDay.keys()].sort()) {
    const v = byDay.get(d)!;
    cum = r2(cum + v); peak = Math.max(peak, cum); dd = Math.max(dd, r2(peak - cum));
    if (!worst || v < worst.pnl) worst = { date: d, pnl: v };
  }
  const sum = (xs: Trade[], f: (t: Trade) => number) => r2(xs.reduce((s, t) => s + f(t), 0));
  const mean = (xs: Trade[]) => (xs.length ? r2(sum(xs, t => t.pnl) / xs.length) : null);
  return {
    sessions: sessions.length, trades: trades.length, wins: wins.length,
    winPct: trades.length ? r2((wins.length / trades.length) * 100) : null,
    gross: sum(trades, t => t.pnl), avgWin: mean(wins), avgLoss: mean(losses),
    worstDay: worst, maxDrawdown: dd,
    bySide: {
      BUY: { trades: trades.filter(t => t.side === 'BUY').length, gross: sum(trades.filter(t => t.side === 'BUY'), t => t.pnl) },
      SELL: { trades: trades.filter(t => t.side === 'SELL').length, gross: sum(trades.filter(t => t.side === 'SELL'), t => t.pnl) },
    },
    byReason: {
      sma: { trades: trades.filter(t => t.reason === 'sma').length, gross: sum(trades.filter(t => t.reason === 'sma'), t => t.pnl) },
      eod: { trades: trades.filter(t => t.reason === 'eod').length, gross: sum(trades.filter(t => t.reason === 'eod'), t => t.pnl) },
    },
    legs: { future: sum(trades, t => t.futPnl), option: sum(trades, t => t.opt?.pnl ?? 0), optionsMissing: trades.filter(t => !t.opt).length },
  };
}

/* ------------------------------------------------------------ walk-forward */

export type WalkForward = {
  steps: { trainedOn: number; testDate: string; chosen: string; chosenPnl: number; currentPnl: number }[];
  heldOut: number; current: number;
  /** What the whole window would choose today, by gross P&L. */
  bestNow: { key: string; gross: number } | null;
  currentGross: number;
};

/**
 * Row 11. `pnl` maps a combination key to its P&L per session, in `dates` order. A tie goes to
 * the current settings, then to the lexically smaller key, so the choice is deterministic.
 */
export function walkForward(dates: string[], pnl: Map<string, number[]>, currentKey: string): WalkForward {
  const keys = [...pnl.keys()].sort((a, b) => (a === currentKey ? -1 : b === currentKey ? 1 : a.localeCompare(b)));
  const best = (upto: number) => {
    let bk: string | null = null, bv = -Infinity;
    for (const k of keys) {
      const v = r2(pnl.get(k)!.slice(0, upto).reduce((s, x) => s + x, 0));
      if (v > bv) { bv = v; bk = k; }
    }
    return bk === null ? null : { key: bk, gross: bv };
  };
  const steps: WalkForward['steps'] = [];
  for (let k = 1; k < dates.length; k++) {
    const b = best(k)!;
    steps.push({ trainedOn: k, testDate: dates[k]!, chosen: b.key, chosenPnl: pnl.get(b.key)![k]!, currentPnl: pnl.get(currentKey)?.[k] ?? 0 });
  }
  return {
    steps,
    heldOut: r2(steps.reduce((s, x) => s + x.chosenPnl, 0)),
    current: r2(steps.reduce((s, x) => s + x.currentPnl, 0)),
    bestNow: best(dates.length),
    currentGross: r2((pnl.get(currentKey) ?? []).reduce((s, x) => s + x, 0)),
  };
}

export type { NseScanRow };
