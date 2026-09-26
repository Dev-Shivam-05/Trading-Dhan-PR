/**
 * P54 — NIFTY's weekly range (the W button): L1-L3 above and below, built two ways, and scored against the hit rates the
 * corpus claims for them. `docs/spec/ltp-range-v1.md` (every "row N" below is a row of that spec).
 *
 * The tool's own formula is not in the corpus (§16.4 lists only its inputs), so neither method here IS the tool's
 * range. They are the two readings the corpus supports: the standard-deviation bands §16.1 says the hit rates imply,
 * and V118's straddle projection. The point is to MEASURE the claims (OQ-16), not to assert them.
 *
 * Pure: no I/O, no clock.
 */

import type { ChainDay } from './chainhist.ts';

const IST_MS = 5.5 * 3600_000;
/** Row 3: the band is read at the close of the week's first 09:15 minute. */
export const RANGE_HM = '09:15';
/** Row 5: V118's before-noon discount on the straddle. */
export const STRADDLE_DISCOUNT = 0.9;
/** Row 8 (GUESS): a measured hit rate within this many points of the claim "matches" it. */
export const CLAIM_TOL = 5;
/** §16.1: L1 ~65-66%, L2 ~95%, L3 >99%. */
export const CLAIMS: Record<1 | 2 | 3, number> = { 1: 65, 2: 95, 3: 99 };
export const BANDS = [1, 2, 3] as const;
export type Method = 'sigma' | 'straddle';

export type Week = { expiry: string; sessions: string[] };

/** Row 2: sessions grouped by their W1 expiry; the first group (the data starts mid-week) is dropped. */
export function weeksOf(expiries: Record<string, { W1: string }>, sessions: string[]): { weeks: Week[]; dropped: Week | null } {
  const by = new Map<string, string[]>();
  for (const d of [...sessions].sort()) {
    const e = expiries[d]?.W1;
    if (!e) continue;
    if (!by.has(e)) by.set(e, []);
    by.get(e)!.push(d);
  }
  const all = [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([expiry, s]) => ({ expiry, sessions: s }));
  return { weeks: all.slice(1), dropped: all[0] ?? null };
}

export type Range = {
  date: string; t: number; centre: number;
  strike: number; iv: number | null; T: number; straddle: number | null;
  /** Row 4 and row 5: the L1 distance in index points; Lk = k x it. */
  l1: Record<Method, number | null>;
};

const hmOf = (t: number) => new Date(t + IST_MS).toISOString().slice(11, 16);

/** Rows 3-5, at minute i of `day` with the index at `centre`. */
export function rangeAt(day: ChainDay, i: number, centre: number, expiry: string): Range | null {
  const strikes = [...new Set(Object.keys(day.legs).map(k => Number(k.slice(0, -2))))].filter(k => {
    const c = day.legs[`${k}CE`]?.c[i], p = day.legs[`${k}PE`]?.c[i];
    return c !== null && c !== undefined && p !== null && p !== undefined;
  }).sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b);
  const k = strikes[0];
  if (k === undefined) return null;
  const ce = day.legs[`${k}CE`]!, pe = day.legs[`${k}PE`]!;
  const ivs = [ce.iv[i], pe.iv[i]].filter((v): v is number => typeof v === 'number' && v > 0);
  const iv = ivs.length === 2 ? (ivs[0]! + ivs[1]!) / 2 : null;
  const tClose = day.t[i]! + 60_000;
  const tExp = Date.parse(`${expiry}T15:30:00Z`) - IST_MS;
  const T = (tExp - tClose) / 86_400_000;
  const straddle = ce.c[i]! + pe.c[i]!;
  return {
    date: day.date, t: day.t[i]!, centre, strike: k, iv, T, straddle,
    l1: {
      sigma: iv === null || T <= 0 ? null : centre * (iv / 100) * Math.sqrt(T / 365),
      straddle: straddle * STRADDLE_DISCOUNT,
    },
  };
}

/** The index of the first minute of `day` stamped `hm`, or -1. */
export const minuteIndex = (day: ChainDay, hm: string) => day.t.findIndex(t => hmOf(t) === hm);

export type WeekScore = { pathInside: boolean; closeInside: boolean | null; upTouched: boolean; dnTouched: boolean };

/**
 * Rows 6-7 for one band. A breach is strictly beyond the line (a high 0.05 above RL is out; a high exactly on it is
 * not), because a line the market only reaches has held.
 */
export function scoreWeek(path: { h: number; l: number }[], close: number | null, centre: number, dist: number): WeekScore {
  const up = centre + dist, dn = centre - dist;
  let upT = false, dnT = false;
  for (const b of path) { if (b.h > up) upT = true; if (b.l < dn) dnT = true; }
  return { pathInside: !upT && !dnT, closeInside: close === null ? null : close <= up && close >= dn, upTouched: upT, dnTouched: dnT };
}

/** Row 8. */
export function scoreClaim(measuredPct: number, band: 1 | 2 | 3): 'matches' | 'wider than claimed' | 'narrower than claimed' {
  const c = CLAIMS[band];
  return Math.abs(measuredPct - c) <= CLAIM_TOL ? 'matches' : measuredPct > c ? 'wider than claimed' : 'narrower than claimed';
}
