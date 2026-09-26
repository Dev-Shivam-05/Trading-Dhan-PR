/**
 * P50 — the LTP Calculator's line sets: the 920 lines, the AI LTP lines, the scenario → line-set table, first
 * touch and the vetoes. `docs/spec/ltp-lines-v1.md` (every "row N" below is a row of that spec).
 *
 * It stands on two verified engines and changes neither: P29's `readChain()` says where resistance (R) and
 * support (S) are at a minute, and P49's `stepDay()` says which scenario the day is in. Every line here is a
 * reversal price (P29 row 12) of some strike, read through `reversalPrice()` — the one function that knows the
 * formula.
 *
 * Three things that will bite anyone editing this:
 *  1. **"Max Pain" is the STOP and "Max Gain" is the TARGET** (P29 row 1). The code says stop/target.
 *  2. **The side-crossing rule** (§9.3, V12): the extension of SUPPORT is read on the PUT side and is where a
 *     CALL is bought; the extension of RESISTANCE is read on the CALL side and is where a PUT is bought.
 *  3. **No look-ahead** (row 18): an AI line traded in minute i is the one computed from minute i-1's chain,
 *     because minute i's chain already contains minute i's trading.
 *
 * Pure: no I/O, no clock, nothing from dhan.ts.
 */

import type { ChainDay } from './chainhist.ts';
import type { Row } from './derive.ts';
import { readChain, reversalPrice, type LtpReading, type Level } from './ltp.ts';
import { accumulate, newAcc, snapshotAt, hmOf, stepDay, observeDay, FIRST_HM, LAST_HM, type MinuteOut } from './ltp-state.ts';
import type { IdxDay } from './idxhist.ts';

/* ------------------------------------------------------------------ constants (each is a spec row) */

/** Row 4: the 920 lines are read from the candle opening 09:20 and are live from 09:21. */
export const L920_HM = '09:20';
export const LIVE_FROM_HM = '09:21';
/** Row 20: last minute a new trade may start. 920 (V48/V117), AI (GUESS, V48's 2:30). */
export const L920_LAST_ENTRY_HM = '11:29';
export const AI_LAST_ENTRY_HM = '14:29';
/** Rows 9, 21(e)(f): one tick. Two prices closer than this are the same price. */
export const TICK = 0.05;

/* ------------------------------------------------------------------ types */

export type Buy = 'CE' | 'PE';
export type Name920 = 'EOR+1' | 'EOR' | 'EOS' | 'EOS-1';
export type AiName = 'R Max Pain' | 'R Moderate' | 'R Risky' | 'R Max Gain' | 'S Max Gain' | 'S Risky' | 'S Moderate' | 'S Max Pain';
export const AI_NAMES: AiName[] = ['R Max Pain', 'R Moderate', 'R Risky', 'R Max Gain', 'S Max Gain', 'S Risky', 'S Moderate', 'S Max Pain'];
export const AI_ENTRIES: AiName[] = ['R Risky', 'R Moderate', 'S Risky', 'S Moderate'];

export type Missing = 'no-ltp' | 'beyond' | 'no-stop';
export type Line920 = { name: Name920; strike: number; buy: Buy; value: number | null; missing: Missing | null; target: number | null };

export type Lines920 = {
  ready: boolean;
  note: string | null;
  R: number | null; S: number | null; step: number;
  /** Row 4's close: the index at 09:21. */
  close: number | null;
  lines: Line920[];
  /** Row 6: EOR+2 for puts, EOS-2 for calls. */
  stopPut: number | null; stopCall: number | null;
  /** Row 7: every reversal price of a strike strictly between S and R, ascending. */
  divergences: number[];
  /** Row 10. */
  gapWidth: number | null;
  /** Row 9. */
  coincide: string[];
};

export type AiLines = {
  R: number; S: number; step: number;
  value: Record<AiName, number | null>;
  /** Row 16: which of the eight are drawn under this minute's verdict. */
  drawn: Set<AiName>;
  /** Row 17. */
  permit: { CE: boolean; PE: boolean };
};

export type Veto = 'window' | 'used' | 'side' | 'no-stop' | 'stop-on-entry' | 'target' | 'ratio' | 'iv';
export const VETOES: Veto[] = ['window', 'used', 'side', 'no-stop', 'stop-on-entry', 'target', 'ratio', 'iv'];

export type Signal = {
  kind: '920' | 'ai';
  line: string;
  /** Minute index into the day's session minutes, its stamp and label. */
  i: number; t: number; hm: string;
  buy: Buy;
  /** Index levels. */
  entry: number; stop: number | null; target: number | null;
  scenario: number | null; verdict: string | null;
  veto: Veto | null;
};

/** One session minute with its index bar and the chain reading. */
export type Minute = {
  t: number; hm: string;
  o: number; h: number; l: number; c: number;
  /** The index bar came from the chain's close, because the index file has no bar for this minute. */
  idxMissing: boolean;
  reading: LtpReading | null;
  rows: Row[];
};

export type DayLines = {
  date: string;
  minutes: Minute[];
  states: MinuteOut[];
  l920: Lines920;
  ai: (AiLines | null)[];
  signals: Signal[];
};

export type Opts = { ivGate?: boolean };

/* ------------------------------------------------------------------ small helpers */

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Row 3: the ladder's own step. */
export function stepOf(rows: Row[]): number {
  const s = rows.map(r => r.strike).sort((a, b) => a - b);
  const d: number[] = [];
  for (let i = 1; i < s.length; i++) d.push(s[i]! - s[i - 1]!);
  d.sort((a, b) => a - b);
  return d.length ? d[d.length >> 1]! : 50;
}

const rev = (rows: Row[], k: number, side: 'call' | 'put') => reversalPrice(k, side, rows.find(r => r.strike === k));

/** Row 7: reversal prices of every strike strictly between S and R, both sides, ascending. */
export function divergencesOf(rows: Row[], S: number, R: number): number[] {
  const out: number[] = [];
  for (const r of rows) {
    if (r.strike <= Math.min(S, R) || r.strike >= Math.max(S, R)) continue;
    for (const side of ['call', 'put'] as const) { const v = rev(rows, r.strike, side); if (v !== null) out.push(v); }
  }
  return out.sort((a, b) => a - b);
}

/** Nearest value strictly beyond `from` (by more than a tick) in the direction of `up`. */
function nextBeyond(values: number[], from: number, up: boolean): number | null {
  let best: number | null = null;
  for (const v of values) {
    if (up ? v > from + TICK - 1e-9 : v < from - TICK + 1e-9) {
      if (best === null || (up ? v < best : v > best)) best = v;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ L7: the 920 lines (rows 4-10) */

export function lines920(reading: LtpReading | null, rows: Row[], close: number | null): Lines920 {
  const step = rows.length ? stepOf(rows) : 50;
  const empty = (note: string): Lines920 => ({ ready: false, note, R: null, S: null, step, close, lines: [], stopPut: null, stopCall: null, divergences: [], gapWidth: null, coincide: [] });
  if (!reading || !reading.resistance || !reading.support) return empty(reading?.note ?? 'no reading at 09:20');
  const R = reading.resistance.strike, S = reading.support.strike;
  const stopPut = rev(rows, R + 2 * step, 'call');
  const stopCall = rev(rows, S - 2 * step, 'put');
  const divergences = divergencesOf(rows, S, R);
  const raw: Omit<Line920, 'missing' | 'target'>[] = [
    { name: 'EOR+1', strike: R + step, buy: 'PE', value: rev(rows, R + step, 'call') },
    { name: 'EOR', strike: R, buy: 'PE', value: rev(rows, R, 'call') },
    { name: 'EOS', strike: S, buy: 'CE', value: rev(rows, S, 'put') },
    { name: 'EOS-1', strike: S - step, buy: 'CE', value: rev(rows, S - step, 'put') },
  ];
  const values = raw.map(l => l.value).filter((v): v is number => v !== null);
  const lines: Line920[] = raw.map(l => {
    const upper = l.buy === 'PE';
    let missing: Missing | null = null;
    if (l.value === null) missing = 'no-ltp';
    else if ((upper ? stopPut : stopCall) === null) missing = 'no-stop';
    else if (close !== null && (upper ? close >= l.value : close <= l.value)) missing = 'beyond';
    // Row 7: the nearest divergence beyond the entry in the trade's direction; none -> the next line (V48).
    const target = l.value === null ? null
      : nextBeyond(divergences, l.value, !upper) ?? nextBeyond(values, l.value, !upper);
    return { ...l, missing, target };
  });
  const coincide: string[] = [];
  for (let a = 0; a < raw.length; a++) for (let b = a + 1; b < raw.length; b++) {
    const x = raw[a]!.value, y = raw[b]!.value;
    if (x !== null && y !== null && Math.abs(x - y) < TICK - 1e-9) coincide.push(`${raw[a]!.name}=${raw[b]!.name}`);
  }
  const eor = lines[1]!.value, eos = lines[2]!.value;
  return { ready: true, note: null, R, S, step, close, lines, stopPut, stopCall, divergences, gapWidth: eor !== null && eos !== null ? eor - eos : null, coincide };
}

/* ------------------------------------------------------------------ L7/L8: the AI lines (rows 11-17) */

/** Row 13: the strongest challenger on the inward side of a level, by that level's own factor. */
function riskyStrike(level: Level, rows: Row[], pair: { lower: number; upper: number }): number | null {
  const call = level.side === 'call';
  const factor = level.builtOn.includes('volume') ? 'volume' : 'oi';
  const lv = (factor === 'volume' ? level.volume : level.oi)?.value ?? 0;
  if (lv <= 0) return null;
  let best: number | null = null, bestPct = -Infinity;
  for (const r of rows) {
    // Support: above it, inside its scan range (<= pair.upper). Resistance: below it, >= pair.lower.
    const inside = call ? r.strike < level.strike && r.strike >= pair.lower : r.strike > level.strike && r.strike <= pair.upper;
    if (!inside) continue;
    const v = num((call ? r.ce : r.pe)[factor]) ?? 0;
    if (v <= 0) continue;
    const p = v / lv * 100;
    if (p > bestPct) { bestPct = p; best = r.strike; }
  }
  return best;
}

/** Row 16: V100's scenario -> line-set table, keyed on P49's verdict. */
export function drawnFor(scenario: number | null, verdict: string | null): { drawn: Set<AiName>; permit: { CE: boolean; PE: boolean } } {
  const S4: AiName[] = ['S Max Gain', 'S Risky', 'S Moderate', 'S Max Pain'];
  const R4: AiName[] = ['R Max Pain', 'R Moderate', 'R Risky', 'R Max Gain'];
  const set = (xs: AiName[], CE: boolean, PE: boolean) => ({ drawn: new Set(xs), permit: { CE, PE } });
  if (verdict?.startsWith('bullish SOC')) return set(S4, true, false);
  if (verdict?.startsWith('bearish SOC')) return set(R4, false, true);
  switch (scenario) {
    case 3: case 5: return set([...S4, 'R Risky', 'R Max Gain', 'R Max Pain'], true, false);
    case 2: case 4: return set([...R4, 'S Risky', 'S Max Gain', 'S Max Pain'], false, true);
    case 7: return set(S4, true, false);
    case 6: return set(R4, false, true);
    case 8: return set([...AI_NAMES], true, true);
    case 9: return set(AI_NAMES.filter(n => n !== 'R Moderate' && n !== 'S Moderate'), true, true);
    default: return set([], false, false);   // neutral (1) or no verdict: row 16's GUESS
  }
}

export function aiLines(reading: LtpReading | null, rows: Row[], state: MinuteOut | undefined): AiLines | null {
  if (!reading || !reading.pair || !reading.resistance || !reading.support) return null;
  const R = reading.resistance.strike, S = reading.support.strike, step = stepOf(rows);
  const sRiskyK = riskyStrike(reading.support, rows, reading.pair);
  const rRiskyK = riskyStrike(reading.resistance, rows, reading.pair);
  const value = {} as Record<AiName, number | null>;
  value['S Moderate'] = rev(rows, S, 'put');
  value['R Moderate'] = rev(rows, R, 'call');
  value['S Risky'] = sRiskyK === null ? null : rev(rows, sRiskyK, 'put');
  value['R Risky'] = rRiskyK === null ? null : rev(rows, rRiskyK, 'call');
  value['S Max Pain'] = rev(rows, S - 2 * step, 'put');
  value['R Max Pain'] = rev(rows, R + 2 * step, 'call');
  const divs = divergencesOf(rows, S, R);
  // Row 15: Max Gain is the nearest divergence beyond the side's entry lines; none -> the other side's Moderate.
  const sTop = Math.max(...[value['S Risky'], value['S Moderate']].filter((v): v is number => v !== null));
  const rBot = Math.min(...[value['R Risky'], value['R Moderate']].filter((v): v is number => v !== null));
  value['S Max Gain'] = Number.isFinite(sTop) ? (nextBeyond(divs, sTop, true) ?? value['R Moderate']) : null;
  value['R Max Gain'] = Number.isFinite(rBot) ? (nextBeyond(divs, rBot, false) ?? value['S Moderate']) : null;
  const { drawn, permit } = drawnFor(state?.scenario ?? null, state?.verdict ?? null);
  return { R, S, step, value, drawn, permit };
}

/* ------------------------------------------------------------------ L9: vetoes (row 21) */

/** Row 21 (d)-(g) for one candidate. Returns the first veto that applies, or null. */
export function priceVeto(buy: Buy, entry: number, stop: number | null, target: number | null): Veto | null {
  const up = buy === 'CE';
  if (stop === null) return 'no-stop';
  // (e) a stop on (or through) the entry is no stop.
  if (up ? stop > entry - TICK + 1e-9 : stop < entry + TICK - 1e-9) return 'stop-on-entry';
  // (f) no target, or a target on (or behind) the entry.
  if (target === null || (up ? target < entry + TICK - 1e-9 : target > entry - TICK + 1e-9)) return 'target';
  // (g) the ratio gate: never a stop larger than the target (V57, V58, V60).
  if (Math.abs(entry - stop) > Math.abs(target - entry) + 1e-9) return 'ratio';
  return null;
}

/**
 * Row 21 in its order: (a) window, (b) used, (c) side, (d)-(g) the prices, (h) the IV gate. The first that applies
 * is the one recorded, so each rejection is counted exactly once, where it happens. A first touch that is vetoed
 * still uses the line up (row 19): the level has been hit, whatever we did about it (V125).
 */
export function vetoOf(c: { hm: string; lastHm: string; usedBefore: boolean; permitted: boolean; buy: Buy; entry: number; stop: number | null; target: number | null; ivBad: boolean }): Veto | null {
  if (c.hm > c.lastHm) return 'window';
  if (c.usedBefore) return 'used';
  if (!c.permitted) return 'side';
  return priceVeto(c.buy, c.entry, c.stop, c.target) ?? (c.ivBad ? 'iv' : null);
}

/* ------------------------------------------------------------------ the day */

/** Session minutes (P49 row 1) with the index bar and the chain reading for each. */
export function dayMinutes(day: ChainDay, idx: IdxDay | undefined): Minute[] {
  const acc = newAcc(), out: Minute[] = [];
  for (let i = 0; i < day.t.length; i++) {
    const t = day.t[i]!, hm = hmOf(t);
    if (hm > LAST_HM) break;
    accumulate(acc, day, i);
    if (hm < FIRST_HM) continue;
    const snap = snapshotAt(day, i, acc);
    const reading = readChain(snap);
    const bar = idx?.get(t);
    const sp = num(day.spot[i]);
    out.push({
      t, hm,
      o: bar?.o ?? sp ?? NaN, h: bar?.h ?? sp ?? NaN, l: bar?.l ?? sp ?? NaN, c: bar?.c ?? sp ?? NaN,
      idxMissing: !bar, reading: reading.pair ? reading : null, rows: snap.rows,
    });
  }
  return out;
}

/** Row 18: did minute i touch `line` coming from the right side at the end of minute i-1? */
export function touched(prevClose: number, bar: { h: number; l: number }, line: number, buy: Buy): boolean {
  return buy === 'CE' ? prevClose > line && bar.l <= line : prevClose < line && bar.h >= line;
}

export function daySignals(day: ChainDay, idx: IdxDay | undefined, opts: Opts = {}): DayLines {
  const minutes = dayMinutes(day, idx);
  const states = stepDay(observeDay(day));
  const stAt = new Map(states.map(s => [s.t, s]));
  const at920 = minutes.findIndex(m => m.hm === L920_HM);
  const l920 = at920 < 0 ? lines920(null, [], null) : lines920(minutes[at920]!.reading, minutes[at920]!.rows, minutes[at920]!.c);
  const ai = minutes.map(m => aiLines(m.reading, m.rows, stAt.get(m.t)));
  const signals: Signal[] = [];
  const used = new Set<string>();

  for (let i = 1; i < minutes.length; i++) {
    const m = minutes[i]!, prev = minutes[i - 1]!;
    if (m.hm < LIVE_FROM_HM) continue;
    // The scenario a decision is made on is the one on screen before this minute started (row 18).
    const st = stAt.get(prev.t);
    const base = { i, t: m.t, hm: m.hm, scenario: st?.scenario ?? null, verdict: st?.verdict ?? null };

    // The 920 lines: fixed from 09:21 (row 4), a missing line is never touchable (row 8).
    if (l920.ready) for (const L of l920.lines) {
      if (L.missing || L.value === null || !touched(prev.c, m, L.value, L.buy)) continue;
      const key = `920|${L.name}`;
      const stop = L.buy === 'PE' ? l920.stopPut : l920.stopCall;
      const veto = vetoOf({ hm: m.hm, lastHm: L920_LAST_ENTRY_HM, usedBefore: used.has(key), permitted: true, buy: L.buy, entry: L.value, stop, target: L.target, ivBad: false });
      used.add(key);
      signals.push({ ...base, kind: '920', line: L.name, buy: L.buy, entry: L.value, stop, target: L.target, veto });
    }

    // The AI lines: the value visible BEFORE this minute started (row 18), drawn under that minute's verdict.
    const A = ai[i - 1];
    if (A) for (const name of AI_ENTRIES) {
      const v = A.value[name];
      const buy: Buy = name.startsWith('S') ? 'CE' : 'PE';
      if (v === null || !A.drawn.has(name) || !touched(prev.c, m, v, buy)) continue;
      const key = `ai|${name}`;
      const stop = buy === 'CE' ? A.value['S Max Pain'] : A.value['R Max Pain'];
      const target = buy === 'CE' ? A.value['S Max Gain'] : A.value['R Max Gain'];
      const ivBad = !!opts.ivGate && st?.iv.balance === 'unbalanced' && st.iv.move === 'moving';
      const veto = vetoOf({ hm: m.hm, lastHm: AI_LAST_ENTRY_HM, usedBefore: used.has(key), permitted: A.permit[buy], buy, entry: v, stop, target, ivBad });
      used.add(key);
      signals.push({ ...base, kind: 'ai', line: name, buy, entry: v, stop, target, veto });
    }
  }
  return { date: day.date, minutes, states, l920, ai, signals };
}
