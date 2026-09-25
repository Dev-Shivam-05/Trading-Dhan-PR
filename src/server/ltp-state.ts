/**
 * P49 — the LTP Calculator's state machine: L4 pressure, L5 scenario + SOC, L8 the Game of Percentage,
 * L9 the IV gate. `docs/spec/ltp-state-v1.md` (every "row N" below is a row of that spec).
 *
 * It reads a rebuilt minute chain (P48, `readDay()`), turns each minute into a chain snapshot, and asks
 * P29's `readChain()` — unchanged — where resistance and support are and how they are graded. Everything
 * here is about what those levels DID through the day, which a single snapshot cannot say (05 §6.1:
 * "pressure cannot be computed from a snapshot").
 *
 * Two things that will bite anyone editing this:
 *  1. **Store the pressure, derive the label** (V112). The same WTT label means bullish before a shift and
 *     bearish after one (row 10); only the pressure is unambiguous.
 *  2. **Strike space** (P29 row 5): up = a higher strike = bullish. Nothing here knows which way a screen points.
 *
 * Pure: no I/O, no clock. Time is the minute stamp the data carries (row 4).
 */

import type { ChainDay } from './chainhist.ts';
import type { Row, Side } from './derive.ts';
import { readChain, type Factor, type Level } from './ltp.ts';

/* ------------------------------------------------------------------ constants (each is a spec row) */

const IST_MS = 5.5 * 3600_000;
/** Row 1: the regular session. The rebuild's 15:30–15:39 candles are after the close. */
export const FIRST_HM = '09:15';
export const LAST_HM = '15:29';
/** Row 15: an SOC is confirmed after an hour, and graded in whole hours (V27, V112). */
export const SOC_CONFIRM_MIN = 60;
/** Row 16 (GUESS): the Game of Percentage compares against 5 minutes back; under 1.0 point is "stable". */
export const GOP_WINDOW_MIN = 5;
export const GOP_STABLE_PTS = 1.0;
/** Row 19 (V104): call and put IV within one point of each other = settled. */
export const IV_BALANCE_PTS = 1.0;
/** Row 20 (GUESS, V107): an ATM IV two points away from its 09:20 value = moving. */
export const IV_MOVE_PTS = 2.0;
export const IV_BASE_HM = '09:20';
/** Row 21 (V11): after 14:30 the chain stops being reliable. */
export const LATE_HM = '14:30';
/**
 * Only absorbs binary floating point (1.1 - 0.1 is not 1.0), so that a value the spec puts ON a boundary
 * lands on the side the spec says. It is not a tolerance.
 */
const EPS = 1e-9;

/* ------------------------------------------------------------------ types */

export type Grade = Level['grade'];
export type Dir = 'up' | 'down';
export type Pressure = 'bullish' | 'bearish' | 'neutral';
export type Trend = 'inc' | 'dec' | 'stable';

/** One side's reading at one minute — what `readChain()` said, plus row 3's and row 18's extras. */
export type SideObs = {
  strike: number;
  grade: Grade;
  /** Row 14: the challenger % of the factor that placed the level (volume first). */
  factor: Factor;
  pct: number | null;
  /** Which way the challenger sits from the level (row 17). */
  chDir: Dir | null;
  /** Row 7/8: the strikes inside this side's scan range this minute. */
  scan: number[];
  /** Row 18: the highest % above and below the level, same factor. */
  above: number | null;
  below: number | null;
  /** Row 3. */
  partial: boolean;
  edge: boolean;
};

export type Obs = {
  t: number;
  hm: string;
  spot: number;
  ltpAtm: number | null;
  ceIv: number | null;
  peIv: number | null;
  res: SideObs;
  sup: SideObs;
};

/** A minute of the session: an observation, or `null` when there was no reading (row 5). */
export type ObsMinute = { t: number; hm: string; obs: Obs | null };

export type State = 'stable' | 'weak' | 'abandoned' | 'shifted';
export type Shift = { dir: Dir; cause: 'volume' | 'reseat'; t: number };

export type SideState = {
  strike: number | null;
  grade: Grade | null;
  state: State | null;
  /** weak: the label's direction; abandoned: the attempt's; shifted: the shift's. */
  dir: Dir | null;
  lastWeak: Dir | null;
  /** The shift that brought the level to this strike, until it is first strong here (row 9). */
  arrivedBy: Dir | null;
  lastShift: Shift | null;
  shiftDone: boolean;
  pressure: Pressure | null;
  /** Row 15: when the SOC clock started, or null when it is not running. */
  socStart: number | null;
};

export type Soc = { stage: 'warning' | 'confirmed'; minutes: number; r: number };

export type SideOut = {
  strike: number | null;
  grade: Grade | null;
  state: State | null;
  dir: Dir | null;
  pressure: Pressure | null;
  shiftDone: boolean;
  /** A shift completed at THIS minute. */
  shift: Shift | null;
  pct: number | null;
  above: number | null;
  below: number | null;
  partial: boolean;
  edge: boolean;
  soc: Soc | null;
  /** Row 17: V109's reading of the percentage's move, inverted after a shift. */
  useB: 'up' | 'down' | 'flat' | null;
};

export type IvGate = {
  ce: number | null; pe: number | null; atm: number | null;
  balance: 'settled' | 'unbalanced' | 'unknown';
  move: 'steady' | 'moving' | 'unknown';
};

export type MinuteOut = {
  t: number;
  hm: string;
  noRead: boolean;
  late: boolean;
  res: SideOut;
  sup: SideOut;
  scenario: number | null;
  /** The label to print: an SOC when one is confirmed (row 15), else the COA 1.0 scenario's. */
  verdict: string | null;
  /** Row 16: resolves scenarios 8 and 9 only; null otherwise. */
  gop: 'bullish' | 'bearish' | 'consolidation' | 'unknown' | null;
  iv: IvGate;
};

/* ------------------------------------------------------------------ small helpers */

export const hmOf = (t: number) => new Date(t + IST_MS).toISOString().slice(11, 16);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const EMPTY: Side = {
  ltp: null, ltpChg: null, ltpChgPct: null, iv: null, volume: null, volChgPct: null,
  oi: null, oiChg: null, oiChgPct: null, delta: null, gamma: null, theta: null, vega: null,
};

/* ------------------------------------------------------------------ minute -> observation (rows 1-3, 5) */

/** Running totals for one day: row 2's cumulative volume and row 3's "had a gap" per leg. */
export type Acc = { cum: Record<string, number>; gap: Record<string, boolean> };
export const newAcc = (): Acc => ({ cum: {}, gap: {} });

/** Add minute i to the running totals. Called for every minute in order, from the day's first. */
export function accumulate(acc: Acc, day: ChainDay, i: number) {
  for (const [k, l] of Object.entries(day.legs)) {
    const v = l.v[i];
    acc.cum[k] = (acc.cum[k] ?? 0) + (v ?? 0);
    if (v === null || v === undefined) acc.gap[k] = true;
  }
}

/** Row 2: minute i as the chain snapshot P29's engine reads. Only strikes with a close at i. */
export function snapshotAt(day: ChainDay, i: number, acc: Acc): { spot: number; rows: Row[] } {
  const strikes = new Set<number>();
  for (const [k, l] of Object.entries(day.legs)) if (l.c[i] !== null && l.c[i] !== undefined) strikes.add(Number(k.slice(0, -2)));
  const side = (k: string): Side => {
    const l = day.legs[k];
    if (!l || l.c[i] === null || l.c[i] === undefined) return EMPTY;
    return { ...EMPTY, ltp: l.c[i]!, volume: acc.cum[k] ?? 0, oi: l.oi[i] ?? null, iv: l.iv[i] ?? null };
  };
  const rows = [...strikes].sort((a, b) => a - b).map(s => ({ strike: s, ce: side(`${s}CE`), pe: side(`${s}PE`) }));
  return { spot: num(day.spot[i]) ?? NaN, rows };
}

function sideObs(level: Level, rows: Row[], pair: { lower: number; upper: number }, acc: Acc): SideObs {
  const call = level.side === 'call';
  const factor: Factor = level.builtOn.includes('volume') ? 'volume' : 'oi';
  const read = factor === 'volume' ? level.volume : level.oi;
  const ch = read?.challenger ?? null;
  const scanRows = call ? rows.filter(r => r.strike >= pair.lower) : rows.filter(r => r.strike <= pair.upper);
  const scan = scanRows.map(r => r.strike);
  const val = (r: Row) => num((call ? r.ce : r.pe)[factor === 'volume' ? 'volume' : 'oi']) ?? 0;
  const lv = read?.value ?? 0;
  let above: number | null = null, below: number | null = null;
  for (const r of scanRows) {
    const v = val(r);
    if (r.strike === level.strike || v <= 0 || lv <= 0) continue;
    const p = (v / lv) * 100;
    if (r.strike > level.strike) above = Math.max(above ?? -Infinity, p);
    else below = Math.max(below ?? -Infinity, p);
  }
  const suffix = call ? 'CE' : 'PE';
  const partial = !!acc.gap[`${level.strike}${suffix}`] || (ch ? !!acc.gap[`${ch.strike}${suffix}`] : false);
  const edge = scan.length > 0 && (call ? level.strike === Math.max(...scan) : level.strike === Math.min(...scan));
  return {
    strike: level.strike, grade: level.grade, factor, pct: ch?.pct ?? null,
    chDir: ch ? (ch.strike > level.strike ? 'up' : 'down') : null,
    scan, above, below, partial, edge,
  };
}

/** One minute's observation, or null when P29's engine gives no pair or no level (row 5). */
export function observe(day: ChainDay, i: number, acc: Acc): Obs | null {
  const snap = snapshotAt(day, i, acc);
  const r = readChain(snap);
  if (!r.pair || !r.resistance || !r.support) return null;
  const atmRow = r.ltpAtm === null ? undefined : snap.rows.find(x => x.strike === r.ltpAtm);
  const t = day.t[i]!;
  return {
    t, hm: hmOf(t), spot: snap.spot, ltpAtm: r.ltpAtm,
    ceIv: num(atmRow?.ce.iv), peIv: num(atmRow?.pe.iv),
    res: sideObs(r.resistance, snap.rows, r.pair, acc),
    sup: sideObs(r.support, snap.rows, r.pair, acc),
  };
}

/** Every session minute of a day (row 1), in order, each with its observation or null. */
export function observeDay(day: ChainDay): ObsMinute[] {
  const acc = newAcc(), out: ObsMinute[] = [];
  for (let i = 0; i < day.t.length; i++) {
    const t = day.t[i]!, hm = hmOf(t);
    if (hm > LAST_HM) break;
    accumulate(acc, day, i);
    if (hm < FIRST_HM) continue;
    out.push({ t, hm, obs: observe(day, i, acc) });
  }
  return out;
}

/* ------------------------------------------------------------------ L4: one side's transitions (rows 6-11) */

export const initialSide = (): SideState => ({
  strike: null, grade: null, state: null, dir: null, lastWeak: null, arrivedBy: null,
  lastShift: null, shiftDone: false, pressure: null, socStart: null,
});

const weakDir = (g: Grade): Dir | null => (g === 'wtt' ? 'up' : g === 'wtb' ? 'down' : null);

/** Rows 9-10. The pressure a side carries, from its state — never from the label alone. */
export function pressureOf(s: Pick<SideState, 'state' | 'dir' | 'lastShift'>): Pressure | null {
  switch (s.state) {
    case 'stable': return 'neutral';
    // An attempt given up pushes the OTHER way (V108).
    case 'abandoned': return s.dir === 'up' ? 'bearish' : 'bullish';
    // A move completed pushes the way it went (V108).
    case 'shifted': return s.dir === 'up' ? 'bullish' : 'bearish';
    case 'weak': {
      // Row 10: before any shift the label speaks (COA scenarios 2-5); after one, the last shift does (V112).
      const d = s.lastShift ? s.lastShift.dir : s.dir;
      return d === 'up' ? 'bullish' : 'bearish';
    }
    default: return null;
  }
}

/** One side, one minute. Returns the new state and the shift that completed at this minute, if any. */
export function stepSide(prev: SideState, o: SideObs, t: number): { s: SideState; shift: Shift | null } {
  const s: SideState = { ...prev };
  const w = weakDir(o.grade);
  let shift: Shift | null = null;
  if (prev.strike === null) {
    // The day's first reading: nothing has happened yet.
    s.state = w ? 'weak' : 'stable';
    s.dir = w;
    if (w) s.lastWeak = w;
  } else if (o.strike !== prev.strike) {
    // Row 7 / row 8: the level moved. Still in range = the leader was overtaken; out of range = re-seat.
    const dir: Dir = o.strike > prev.strike ? 'up' : 'down';
    shift = { dir, cause: o.scan.includes(prev.strike) ? 'volume' : 'reseat', t };
    s.lastShift = shift;
    s.shiftDone = true;
    if (w) { s.state = 'weak'; s.dir = w; s.lastWeak = w; s.arrivedBy = dir; }
    else { s.state = 'shifted'; s.dir = dir; s.arrivedBy = null; }
  } else if (w) {
    s.state = 'weak'; s.dir = w; s.lastWeak = w;
  } else if (prev.state === 'weak') {
    // Row 9: weak -> strong at the same strike. It arrived by a shift and settled = shifted; otherwise
    // the attempt was given up = abandoned, in the direction of the last weak label.
    if (prev.arrivedBy) { s.state = 'shifted'; s.dir = prev.arrivedBy; }
    else { s.state = 'abandoned'; s.dir = prev.lastWeak; }
    s.arrivedBy = null;
  }
  s.strike = o.strike;
  s.grade = o.grade;
  s.pressure = pressureOf(s);
  return { s, shift };
}

/* ------------------------------------------------------------------ L5: scenario (rows 12-13) */

/** Row 12. Resistance pressure x support pressure -> COA 1.0. Row 13: bear/bear is 6, never 9. */
export function scenarioOf(res: Pressure | null, sup: Pressure | null): number | null {
  if (!res || !sup) return null;
  const table: Record<string, number> = {
    'neutral/neutral': 1, 'bearish/neutral': 2, 'bullish/neutral': 3, 'neutral/bearish': 4, 'neutral/bullish': 5,
    'bearish/bearish': 6, 'bullish/bullish': 7, 'bullish/bearish': 8, 'bearish/bullish': 9,
  };
  return table[`${res}/${sup}`]!;
}

export const SCENARIO_LABEL: Record<number, string> = {
  1: 'neutral', 2: 'slightly bearish', 3: 'slightly bullish', 4: 'slightly bearish', 5: 'slightly bullish',
  6: 'blood bath', 7: 'bull run', 8: 'both sides risky (8)', 9: 'both sides risky (9)',
};

/** Row 15: how long the clock has run, as a stage. */
export function socOf(start: number | null, t: number): Soc | null {
  if (start === null) return null;
  const minutes = Math.round((t - start) / 60_000);
  return minutes >= SOC_CONFIRM_MIN
    ? { stage: 'confirmed', minutes, r: Math.floor(minutes / SOC_CONFIRM_MIN) }
    : { stage: 'warning', minutes, r: 0 };
}

/* ------------------------------------------------------------------ L8: the Game of Percentage (rows 16-17) */

/** Row 16's dead-band: a change under 1.0 point is stable. */
export function trend(delta: number | null): Trend | null {
  if (delta === null) return null;
  if (Math.abs(delta) < GOP_STABLE_PTS - EPS) return 'stable';
  return delta > 0 ? 'inc' : 'dec';
}

/** Row 16: V23's second nine-way table. Resistance % change x support % change. */
export function useA(res: Trend | null, sup: Trend | null): 'bullish' | 'bearish' | 'consolidation' | 'unknown' {
  if (!res || !sup) return 'unknown';
  const t: Record<string, 'bullish' | 'bearish' | 'consolidation'> = {
    'inc/stable': 'bullish', 'dec/stable': 'bearish', 'stable/stable': 'consolidation',
    'inc/inc': 'consolidation', 'dec/inc': 'bearish', 'stable/inc': 'bearish',
    'stable/dec': 'bullish', 'inc/dec': 'bullish', 'dec/dec': 'consolidation',
  };
  return t[`${res}/${sup}`]!;
}

/**
 * Row 17: V109. A challenger above the level (WTT-like): rising pulls up, falling lets go. Below (WTB-like):
 * the mirror. Once the side has completed a shift, the SAME move reads the other way (V109's inversion).
 */
export function useB(chDir: Dir | null, tr: Trend | null, shiftDone: boolean): 'up' | 'down' | 'flat' | null {
  if (!chDir || !tr) return null;
  if (tr === 'stable') return 'flat';
  let up = (chDir === 'up') === (tr === 'inc');
  if (shiftDone) up = !up;
  return up ? 'up' : 'down';
}

/* ------------------------------------------------------------------ L9: the IV gate (rows 19-20) */

export function ivBalance(ce: number | null, pe: number | null): IvGate['balance'] {
  if (ce === null || pe === null) return 'unknown';
  return Math.abs(ce - pe) <= IV_BALANCE_PTS + EPS ? 'settled' : 'unbalanced';
}

export function ivMove(atm: number | null, base: number | null): IvGate['move'] {
  if (atm === null || base === null) return 'unknown';
  return Math.abs(atm - base) >= IV_MOVE_PTS - EPS ? 'moving' : 'steady';
}

const atmIv = (o: Obs | null) => (o && o.ceIv !== null && o.peIv !== null ? (o.ceIv + o.peIv) / 2 : null);

/* ------------------------------------------------------------------ the day */

const sideOut = (s: SideState, o: SideObs | null, shift: Shift | null, soc: Soc | null, b: SideOut['useB']): SideOut => ({
  strike: s.strike, grade: s.grade, state: s.state, dir: s.dir, pressure: s.pressure, shiftDone: s.shiftDone,
  shift, pct: o?.pct ?? null, above: o?.above ?? null, below: o?.below ?? null,
  partial: o?.partial ?? false, edge: o?.edge ?? false, soc, useB: b,
});

/** Rows 4-21 over one day's observations. Pure: the same minutes in give the same minutes out. */
export function stepDay(minutes: ObsMinute[]): MinuteOut[] {
  let res = initialSide(), sup = initialSide();
  const pctAt = new Map<number, { res: number | null; sup: number | null }>();
  const base = minutes.find(m => m.hm === IV_BASE_HM);
  const ivBase = base ? atmIv(base.obs) : null;
  const out: MinuteOut[] = [];

  for (const { t, hm, obs } of minutes) {
    let rShift: Shift | null = null, sShift: Shift | null = null;
    if (obs) {
      ({ s: res, shift: rShift } = stepSide(res, obs.res, t));
      ({ s: sup, shift: sShift } = stepSide(sup, obs.sup, t));
      // Row 15: the clock runs while this side is weak and the other strong; a shift here restarts it.
      const clock = (me: SideState, other: SideState, shifted: boolean) =>
        me.grade !== 'strong' && other.grade === 'strong' ? (shifted || me.socStart === null ? t : me.socStart) : null;
      const rStart = clock(res, sup, !!rShift), sStart = clock(sup, res, !!sShift);
      res = { ...res, socStart: rStart };
      sup = { ...sup, socStart: sStart };
      pctAt.set(t, { res: obs.res.pct, sup: obs.sup.pct });
    }
    // Row 5: a minute without a reading holds every state and clock; its percentages are simply absent.
    const then = pctAt.get(t - GOP_WINDOW_MIN * 60_000);
    const now = obs ? { res: obs.res.pct, sup: obs.sup.pct } : null;
    const d = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : a - b);
    const rTr = trend(d(now?.res, then?.res)), sTr = trend(d(now?.sup, then?.sup));

    const rSoc = socOf(res.socStart, t), sSoc = socOf(sup.socStart, t);
    const scenario = scenarioOf(res.pressure, sup.pressure);
    let verdict: string | null = scenario === null ? null : SCENARIO_LABEL[scenario]!;
    // Row 15: a confirmed SOC overrides COA 1.0. Resistance-side = bullish, support-side = bearish.
    if (rSoc?.stage === 'confirmed') verdict = `bullish SOC ${rSoc.r}R`;
    else if (sSoc?.stage === 'confirmed') verdict = `bearish SOC ${sSoc.r}R`;

    const ce = obs?.ceIv ?? null, pe = obs?.peIv ?? null, atm = atmIv(obs);
    out.push({
      t, hm, noRead: !obs, late: hm >= LATE_HM,
      res: sideOut(res, obs?.res ?? null, rShift, rSoc, useB(obs?.res.chDir ?? null, rTr, res.shiftDone)),
      sup: sideOut(sup, obs?.sup ?? null, sShift, sSoc, useB(obs?.sup.chDir ?? null, sTr, sup.shiftDone)),
      scenario, verdict,
      gop: scenario === 8 || scenario === 9 ? useA(rTr, sTr) : null,
      iv: { ce, pe, atm, balance: ivBalance(ce, pe), move: hm < IV_BASE_HM ? 'unknown' : ivMove(atm, ivBase) },
    });
  }
  return out;
}

/** The whole pipeline for one stored day. */
export function runDay(day: ChainDay): MinuteOut[] {
  return stepDay(observeDay(day));
}
