/**
 * The LTP Calculator's level engine — `docs/spec/ltp-calculator-v1.md`, layers L0-L3 and L6.
 *
 * Reconstructed from `LTP-CALCULATOR/ANALYSIS/`, which reconstructs 163 transcript files. Every
 * rule below cites the spec row that locked it and the video the spec cites. Nothing here invents
 * a number: if the spec does not state a value, this file does not have one.
 *
 * THREE THINGS THAT WILL BITE ANYONE EDITING THIS:
 *
 *  1. **"Max Pain" means STOP LOSS and "Max Gain" means TARGET** in this product (spec row 1).
 *     Neither carries its industry meaning. That is why nothing here is called maxPain.
 *  2. **ATM here is the strike with the highest TIME VALUE**, not the strike nearest spot
 *     (spec row 2, V18/V75). `derive.ts` already owns `atmStrike` = nearest spot and P23's spot
 *     window depends on it, so this one is `ltpAtm` and the two must never be conflated.
 *  3. **Every rule is in STRIKE SPACE** (spec row 5). Higher strike = bullish. Nothing here knows
 *     which way the screen points; `screenDir` in the client is the only place that does. This is
 *     what makes V112, V121, V45 and V13 agree instead of contradict — see OQ-35 in the spec.
 *
 * Pure: no I/O, no clock, no Date.now(). Spec row 24 — a rule that reads the clock has an
 * acceptance criterion that cannot be run outside 09:15-15:30 IST, and almost every session on
 * this project is outside those hours.
 */

import type { Row, Side } from './derive.ts';

/* ------------------------------------------------------------------ types */

export type LevelSide = 'call' | 'put';

/** Spec row 19. The single system constant: eight separate files put it at 75%. */
export const CHALLENGE_PCT = 75;

export type Factor = 'volume' | 'oi';

export type Challenger = {
  strike: number;
  /** challenger / level * 100 — V23's own arithmetic (1.11 crore / 1.35 crore -> 82). */
  pct: number;
  /** Does it qualify, i.e. is it at or past CHALLENGE_PCT? */
  qualifies: boolean;
};

export type FactorRead = {
  /** The strike holding the highest value of this factor on this side, scanning outward. */
  strike: number;
  value: number;
  /** The second highest, and how close it is. Null when the side has only one strike with data. */
  challenger: Challenger | null;
  /** Spec row 20. Purely positional: is the qualifying challenger at a higher or lower strike? */
  grade: 'strong' | 'wtt' | 'wtb';
};

export type Level = {
  side: LevelSide;
  /** The strike the level sits at. */
  strike: number;
  /** Which factor(s) put it there. Spec row 22: volume leads intraday. */
  builtOn: Factor[];
  volume: FactorRead | null;
  oi: FactorRead | null;
  /** Spec rows 20-21, after the double-factor asymmetry is applied. */
  grade: 'strong' | 'wtt' | 'wtb';
  /** How the grade was reached, in words, so the read is auditable rather than magic. */
  why: string;
  /** Spec rows 12-13. The level's REACH, not its strike. */
  reversal: number | null;
  /** True when the level sits in the money. Spec row 17. */
  itm: boolean;
  /** Strikes in the money; support may never exceed 1 (V111). */
  itmBy: number;
};

export type LtpReading = {
  spot: number;
  /** L1. The two adjacent strikes bracketing spot. Null when spot sits exactly on a strike. */
  pair: { lower: number; upper: number } | null;
  /** Why there is no pair. Null once there is one — the two states read differently. */
  note: string | null;
  /** Spec row 2/11. The pair strike with the higher total time value. NOT derive.ts's atmStrike. */
  ltpAtm: number | null;
  ltpAtmTie: boolean;
  resistance: Level | null;
  support: Level | null;
  /** L6. The full reversal ladder, every strike, both sides. Spec rows 12-14. */
  ladder: { strike: number; call: number | null; put: number | null }[];
  /** The chain's own implied forward, c - p + K, median over the strikes that quote both sides. */
  impliedForward: number | null;
  /** impliedForward - spot. The carry. Reported because comparing parity to SPOT measures this. */
  basis: number | null;
};

/* --------------------------------------------------------------- L6: OQ-1 */

/**
 * **The reversal price.** Spec row 12. The single function that knows the formula.
 *
 *     reversal(K, call) = K + callLTP(K)
 *     reversal(K, put)  = K - putLTP(K)
 *
 * In words: a level holds until price passes the point where the writer AT THAT STRIKE stops
 * being profitable — the strike plus (calls) or minus (puts) the premium they collected.
 *
 * **This is a reconstruction, not a quoted formula.** No file in the 163-file corpus gives one;
 * ~20 say only "derived from the Option Greeks". It was chosen by testing against the corpus's own
 * 17 worked (strike -> reversal) pairs and approved by the user on 2026-09-23:
 *
 *   - Put-call parity is the falsifiable test, and the candidate never mentions it.
 *     `F = revCall + revPut - K` recovers a spot the candidate was never shown, on three separate
 *     passages, to +8 / +12 / -6 points.  (`npm run oq1:test`)
 *   - "At expiry all reversal prices converge to intrinsic value" holds numerically: on the
 *     expired 22-Sep chain every ITM reversal landed on spot (23,328.4-23,329.6 vs 23,329) and
 *     every OTM one on its own strike.  (`npm run oq1:live`)
 *   - That same line eliminates `reversal = strike`, `strike ± a fixed offset`, and a LITERAL
 *     reading of V18 — "the spot at which time value peaks" is EXACTLY the strike under
 *     Black-Scholes, since dTV/dS is delta below the strike and delta-1 above it.
 *
 * Keep it a one-function change: if the app's own API ever exposes the real number, or it is
 * repriced from Black-Scholes instead of the traded LTP, THIS is the only thing that moves.
 */
export function reversalPrice(strike: number, side: LevelSide, row: Row | undefined): number | null {
  const leg: Side | undefined = side === 'call' ? row?.ce : row?.pe;
  const ltp = leg?.ltp;
  if (typeof ltp !== 'number' || !Number.isFinite(ltp) || ltp < 0) return null;
  return side === 'call' ? strike + ltp : strike - ltp;
}

/* ------------------------------------------------------- small utilities */

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Intrinsic value. Spec row 11 / V99 — **never negative**, which is the whole reason it is written
 * out rather than left as `spot - strike`.
 */
export function intrinsic(strike: number, side: LevelSide, spot: number): number {
  return side === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

/** Time value = premium - intrinsic. Drives the ATM definition (spec row 11, V18/V75). */
export function timeValue(strike: number, side: LevelSide, spot: number, row: Row | undefined): number | null {
  const leg: Side | undefined = side === 'call' ? row?.ce : row?.pe;
  const ltp = num(leg?.ltp);
  if (ltp === null) return null;
  return ltp - intrinsic(strike, side, spot);
}

/* ------------------------------------------------------------- L1: the line */

/**
 * The imaginary line: the two adjacent strikes bracketing spot (spec row 9, V01).
 *
 * Spot exactly ON a strike returns null (spec row 10). V08 names this: Tata Power at exactly
 * 257.50 produced no output and the highlights vanished; at 257.25 it worked again. We do not
 * round and do not pick a side — a silently-picked side is a wrong level with nothing on screen
 * to say so.
 */
export function imaginaryLine(strikes: number[], spot: number): { lower: number; upper: number } | null {
  const sorted = [...strikes].sort((a, b) => a - b);
  if (sorted.includes(spot)) return null;
  let lower: number | null = null, upper: number | null = null;
  for (const s of sorted) {
    if (s < spot) lower = s;
    else { upper = s; break; }
  }
  return lower !== null && upper !== null ? { lower, upper } : null;
}

/* ------------------------------------------------------------- L3: grading */

/**
 * One factor's read on one side: the leading strike, its challenger, and the positional grade.
 *
 * `candidates` must already be restricted to the scan direction (L2) — grading a strike the scan
 * would never have reached is how V112's "a highlighted strike is NOT automatically the level"
 * gets violated.
 */
function readFactor(
  candidates: { strike: number; value: number }[],
  factor: Factor,
): FactorRead | null {
  const withValue = candidates.filter(c => c.value > 0);
  if (!withValue.length) return null;
  const ranked = [...withValue].sort((a, b) => b.value - a.value);
  const top = ranked[0]!;
  const second = ranked[1] ?? null;

  let challenger: Challenger | null = null;
  if (second) {
    // V23's arithmetic, directly: second / highest * 100.
    const p = (second.value / top.value) * 100;
    challenger = { strike: second.strike, pct: p, qualifies: p >= CHALLENGE_PCT };
  }

  // Spec row 20. Purely positional, identical on both sides. Where several strikes qualify, the
  // STRONGEST qualifying one is the reading (V112) — which is `second` by construction, since the
  // list is ranked by value.
  const grade: FactorRead['grade'] = !challenger?.qualifies
    ? 'strong'
    : challenger.strike > top.strike ? 'wtt' : 'wtb';

  void factor;
  return { strike: top.strike, value: top.value, challenger, grade };
}

/**
 * Spec row 21 — the double-factor asymmetry, which is **deliberately not symmetric**:
 *
 *   resistance  turns WTB if EITHER factor says so, and WTT only if BOTH do
 *   support     turns WTT if EITHER factor says so, and WTB only if BOTH do
 *
 * i.e. **the inward direction needs only one factor; the outward direction needs both** (V114,
 * and V08 states the same thing directionally). Inward means towards the imaginary line: for
 * resistance, which sits above, that is WTB; for support, which sits below, that is WTT.
 */
function combineGrades(
  side: LevelSide,
  vol: FactorRead | null,
  oi: FactorRead | null,
): { grade: Level['grade']; why: string } {
  const inward: Level['grade'] = side === 'call' ? 'wtb' : 'wtt';
  const outward: Level['grade'] = side === 'call' ? 'wtt' : 'wtb';
  const present = [vol, oi].filter(Boolean) as FactorRead[];
  if (!present.length) return { grade: 'strong', why: 'no factor had data' };

  // Single factor: whatever that one factor is doing, the level is doing (V114).
  if (present.length === 1) {
    const f = present[0]!;
    const name = f === vol ? 'volume' : 'OI';
    return { grade: f.grade, why: `single factor (${name}): the level does what it does — ${f.grade}` };
  }

  const anyInward = present.some(f => f.grade === inward);
  const allOutward = present.every(f => f.grade === outward);
  if (anyInward) {
    const who = [vol?.grade === inward ? 'volume' : null, oi?.grade === inward ? 'OI' : null]
      .filter(Boolean).join(' and ');
    return { grade: inward, why: `${who} challenged towards the imaginary line — one factor is enough for ${inward.toUpperCase()}` };
  }
  if (allOutward) return { grade: outward, why: `both factors challenged away from the line — ${outward.toUpperCase()} needs both, and has both` };
  return { grade: 'strong', why: 'no qualifying challenger on either factor' };
}

/* ---------------------------------------------------------- L2: the scan */

/**
 * Resistance (spec row 15) and support (spec row 16).
 *
 * Resistance: start at the SMALLER strike of the pair and scan UPWARD on the call side.
 * Support: start at the BIGGER strike of the pair and scan DOWNWARD on the put side.
 * Where highest-volume and highest-OI land on different strikes, the one CLOSER TO THE LINE wins.
 *
 * The direction is not arbitrary (V04, V06): the call side has already pushed the line up to that
 * point, so strikes BEHIND it cannot stop the move — only ones still ahead can.
 */
function locate(
  side: LevelSide,
  rows: Row[],
  pair: { lower: number; upper: number },
  spot: number,
): Level | null {
  const start = side === 'call' ? pair.lower : pair.upper;
  const inScan = side === 'call'
    ? rows.filter(r => r.strike >= start).sort((a, b) => a.strike - b.strike)
    : rows.filter(r => r.strike <= start).sort((a, b) => b.strike - a.strike);
  if (!inScan.length) return null;

  const leg = (r: Row) => (side === 'call' ? r.ce : r.pe);
  const vol = readFactor(inScan.map(r => ({ strike: r.strike, value: num(leg(r).volume) ?? 0 })), 'volume');
  const oi = readFactor(inScan.map(r => ({ strike: r.strike, value: num(leg(r).oi) ?? 0 })), 'oi');
  if (!vol && !oi) return null;

  // The tie-break: whichever of the two sits CLOSER TO THE IMAGINARY LINE is the level. Distance
  // is measured from the scan's start, which IS the line's own strike on this side.
  const dist = (s: number) => Math.abs(s - start);
  let strike: number;
  let builtOn: Factor[];
  if (vol && oi && vol.strike === oi.strike) { strike = vol.strike; builtOn = ['volume', 'oi']; }
  else if (vol && oi) {
    const pick = dist(vol.strike) <= dist(oi.strike) ? vol : oi;
    strike = pick.strike;
    builtOn = [pick === vol ? 'volume' : 'oi'];
  } else { const f = (vol ?? oi)!; strike = f.strike; builtOn = [vol ? 'volume' : 'oi']; }

  // Only the factor(s) that actually placed the level grade it. Grading the level by a factor
  // whose own leader sits at a different strike is how a "highlighted" strike leaks back in.
  const volHere = builtOn.includes('volume') ? vol : null;
  const oiHere = builtOn.includes('oi') ? oi : null;
  const { grade, why } = combineGrades(side, volHere, oiHere);

  const itmBy = side === 'call'
    ? (spot > strike ? Math.round((spot - strike) / gap(rows)) : 0)
    : (spot < strike ? Math.round((strike - spot) / gap(rows)) : 0);

  return {
    side, strike, builtOn, volume: volHere, oi: oiHere, grade, why,
    reversal: reversalPrice(strike, side, rows.find(r => r.strike === strike)),
    itm: itmBy > 0, itmBy,
  };
}

/** The strike ladder's own step, from the rows themselves rather than a hardcoded 50/100. */
function gap(rows: Row[]): number {
  const s = rows.map(r => r.strike).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < s.length; i++) diffs.push(s[i]! - s[i - 1]!);
  return median(diffs) ?? 50;
}

/* -------------------------------------------------------------- the read */

/**
 * One reading of one chain, at one instant. Spec row 24: pure, and the only entry point.
 */
export function readChain(snap: { spot: number; rows: Row[] }): LtpReading {
  const { spot, rows } = snap;
  const strikes = rows.map(r => r.strike);
  const empty = (note: string): LtpReading => ({
    spot, pair: null, note, ltpAtm: null, ltpAtmTie: false,
    resistance: null, support: null, ladder: [], impliedForward: null, basis: null,
  });

  if (!rows.length) return empty('the chain has no strikes yet');
  if (!Number.isFinite(spot) || spot <= 0) return empty('no usable spot price');

  const pair = imaginaryLine(strikes, spot);
  // Spec row 10 / V08. This is a deliberate refusal, not a gap in the code.
  if (!pair) {
    return empty(`spot is exactly on the ${spot} strike — the imaginary line needs two strikes `
      + 'around it, so no level is calculated (V08)');
  }

  // Spec row 11. ATM = the pair strike with the higher TOTAL time value (both sides), because
  // V18/V75 state the same strike carries the highest time value on both — so summing is the
  // reading that cannot disagree with itself.
  const tvOf = (k: number) => {
    const r = rows.find(x => x.strike === k);
    const c = timeValue(k, 'call', spot, r);
    const p = timeValue(k, 'put', spot, r);
    return c === null && p === null ? null : (c ?? 0) + (p ?? 0);
  };
  const tvLo = tvOf(pair.lower), tvHi = tvOf(pair.upper);
  let ltpAtm: number | null = null, ltpAtmTie = false;
  if (tvLo !== null || tvHi !== null) {
    if (tvLo !== null && tvHi !== null && tvLo === tvHi) { ltpAtm = pair.lower; ltpAtmTie = true; }
    else ltpAtm = (tvHi ?? -Infinity) > (tvLo ?? -Infinity) ? pair.upper : pair.lower;
  }

  const resistance = locate('call', rows, pair, spot);
  let support = locate('put', rows, pair, spot);
  // Spec row 17 / V111: "support can never sit more than ONE STRIKE in the money." A level that
  // breaks it is reported as absent WITH the reason, never silently replaced.
  if (support && support.itmBy > 1) {
    support = { ...support, why: `${support.why} — REJECTED: support may not sit more than one `
      + `strike in the money (V111); this one is ${support.itmBy} strikes ITM`, grade: support.grade };
  }

  const ladder = rows.map(r => ({
    strike: r.strike,
    call: reversalPrice(r.strike, 'call', r),
    put: reversalPrice(r.strike, 'put', r),
  }));

  // The chain's own implied forward. Parity is c - p = F - K, so c - p + K is F, and every strike
  // must agree. Reported because comparing a reversal recovery against SPOT measures the basis —
  // which is exactly the red line that cost a debugging round on 2026-09-23.
  const fwds = rows
    .filter(r => num(r.ce.ltp) !== null && num(r.pe.ltp) !== null)
    .map(r => r.ce.ltp! - r.pe.ltp! + r.strike);
  const impliedForward = median(fwds);

  return {
    spot, pair, note: null, ltpAtm, ltpAtmTie, resistance, support, ladder,
    impliedForward,
    basis: impliedForward === null ? null : impliedForward - spot,
  };
}
