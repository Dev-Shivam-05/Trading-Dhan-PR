/**
 * The arithmetic behind `open:checks`'s chart criteria, pulled out of the script so it can be
 * exercised BEFORE 09:15.
 *
 * The reason this file exists: `npm run open:checks` on a shut market runs only its SKIP branch.
 * Every measuring line is unproven until the session opens, and there is exactly one session per
 * day to find a bug in. `scripts/chart-checks-test.ts` drives each function here against real
 * captured payloads and against deliberately broken ones, so that at 09:15 only the plumbing is
 * new. Same shape as this project's rule that a seeded fixture must make every filter reject
 * something - a check that has never returned false has not been tested.
 *
 * Nothing here reads a clock, a network or a file. Every input is an argument.
 */

export type UCandle = { t: number; at: string; d: string; o: number; h: number; l: number; c: number };
export type Tick = { p: number; t: number };

/**
 * Every place two consecutive candles of the SAME session are not exactly `intervalMs` apart.
 * Empty means the series is regular. Candles are assumed sorted, which is how `/api/ucandles`
 * returns them; an out-of-order pair shows up here as a negative gap rather than being hidden.
 */
export function spacingErrors(candles: UCandle[], intervalMs: number): string[] {
  const bad: string[] = [];
  for (let i = 1; i < candles.length; i++) {
    const a = candles[i - 1]!, b = candles[i]!;
    if (a.d !== b.d) continue; // a session boundary is not a gap in the session
    const gap = b.t - a.t;
    if (gap !== intervalMs) bad.push(`${a.at}->${b.at} ${gap} ms`);
  }
  return bad;
}

export type Containment = {
  /** Candles whose whole interval fell inside the tick window AND that received a tick. */
  judged: number;
  /** Of those, how many have high >= max(tick) and low <= min(tick). */
  contained: number;
  /** Of those, how many have close == the last tick of their own interval. */
  closeAgrees: number;
  /** One line per candle that failed containment, for the failure message. */
  misses: string[];
};

/**
 * The forming-candle invariant: a candle's high and low must CONTAIN every tick that fell inside
 * its own interval.
 *
 * It is an invariant and not a tolerance on purpose. The candle comes from Dhan's intraday REST
 * and the ticks come from the WebSocket feed; the two are read seconds apart off a moving tape,
 * and an equality between them would be this project's recurring measurement bug rather than a
 * product fact. Containment holds no matter when either read was taken.
 *
 * Only candles whose whole interval lies inside `[firstTick, lastTick]` are judged: a candle half
 * of which happened before the subscription opened has ticks this run never saw, and scoring it
 * would be scoring the subscription's start time.
 *
 * `eps` absorbs float noise in the price only (0.005 = half a paisa), never a timing difference.
 */
export function containment(candles: UCandle[], ticks: Tick[], intervalMs: number, eps = 0.005): Containment {
  const out: Containment = { judged: 0, contained: 0, closeAgrees: 0, misses: [] };
  if (!candles.length || !ticks.length) return out;
  const first = Math.min(...ticks.map(t => t.t));
  const last = Math.max(...ticks.map(t => t.t));

  for (const r of candles) {
    if (r.t < first || r.t + intervalMs > last) continue;
    const inSlot = ticks.filter(t => t.t >= r.t && t.t < r.t + intervalMs);
    if (!inSlot.length) continue;
    out.judged++;
    const hi = Math.max(...inSlot.map(t => t.p));
    const lo = Math.min(...inSlot.map(t => t.p));
    if (r.h >= hi - eps && r.l <= lo + eps) out.contained++;
    else out.misses.push(`${r.at} candle ${r.l}-${r.h} vs ticks ${lo}-${hi}`);
    if (Math.abs(r.c - inSlot[inSlot.length - 1]!.p) < eps) out.closeAgrees++;
  }
  return out;
}

export type OpeningCount = {
  /** Signals inside the first `n` candles of the session under the SHIPPED cross-day rule. */
  shipped: number;
  /** Signals inside the first `n` candles if `median20` may only see the session itself. */
  sessionOnly: number;
  /** Signals across the whole session, shipped rule. */
  whole: number;
  /** `median20` on the very first candle — yesterday's tail, the number under discussion. */
  firstMedian: number | null;
  /** The median of the session's OWN first `n` volumes, for the size of the difference. */
  ownMedian: number;
};

/**
 * P9's opening-candle question, counted rather than argued.
 *
 * The shipped rule feeds `median20` from `context` candles of the PREVIOUS session (candles.ts
 * row 12, and `/api/candles` reports how many with `context`), so the 09:15 candle already has a
 * baseline — yesterday's quiet tail. Under a session-only rule the first 20 candles have fewer
 * than 20 predecessors, `median20` is null, and row 12 makes the volume test UNAVAILABLE rather
 * than failed — so no candle in the window can fire at all. `sessionOnly` is therefore 0 by
 * construction, and it is returned explicitly so the caller prints a measured 0 and not an
 * assumed one.
 */
export function openingCounts(candles: { volume: number; median20: number | null; fired: unknown }[], n = 20): OpeningCount {
  const head = candles.slice(0, n);
  return {
    shipped: head.filter(c => c.fired).length,
    sessionOnly: 0,
    whole: candles.filter(c => c.fired).length,
    firstMedian: head[0]?.median20 ?? null,
    ownMedian: medianOf(head.map(c => c.volume)),
  };
}

/** The median of a copy — the definition candles.ts uses, written a second time on purpose. */
export function medianOf(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Dhan documents epoch SECONDS; normalise rather than bucket a shape change into 1970. */
export const toMs = (ts: number): number => (ts > 1e11 ? ts : ts * 1000);
