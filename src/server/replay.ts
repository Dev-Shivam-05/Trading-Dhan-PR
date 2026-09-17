/**
 * Replay mode - synthetic option chains in Dhan's exact response shape.
 *
 * WHY this exists: the whole pipeline (poller -> derive -> SSE -> grid -> latency panel) has to
 * be verifiable without a live token, and a trading screen must never silently invent numbers.
 * So replay is explicit: it only runs when REPLAY=1, and the UI shows a loud banner.
 *
 * The numbers come from Black-Scholes with a volatility smile, so deltas move monotonically,
 * gamma peaks at the money and OI humps around spot - i.e. the grid is exercised the way real
 * data exercises it. They are still fake.
 */

import type { OptionChainResponse, OptionLeg } from './dhan.ts';
import type { Candles } from './peakoi.ts';

export function isReplay(): boolean {
  return process.env.REPLAY === '1';
}

type Shape = { spot: number; step: number; iv: number; strikes: number };

const SHAPES: Record<string, Shape> = {
  NIFTY:     { spot: 24078.30, step: 50,  iv: 9.3,  strikes: 41 },
  BANKNIFTY: { spot: 54318.75, step: 100, iv: 11.4, strikes: 41 },
  SENSEX:    { spot: 78642.30, step: 100, iv: 10.2, strikes: 41 },
  RELIANCE:  { spot: 1392.40,  step: 10,  iv: 19.6, strikes: 31 },
  HDFCBANK:  { spot: 758.90,   step: 5,   iv: 17.3, strikes: 31 },
  GOLD:      { spot: 163940.0, step: 500, iv: 13.8, strikes: 31 },
};

/** Deterministic per (key, strike, field) so a redraw does not reshuffle the whole grid. */
function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
function npdf(x: number): number { return 0.3989422804014327 * Math.exp(-x * x / 2); }

/**
 * OI humps around the money. Shared by the chain and by the peak-OI candle series so the two
 * cannot drift - a peak that is not anchored to the same base would render as a nonsense ratio.
 */
function humpAt(i: number, strikes: number): number {
  return Math.exp(-Math.pow(i / (strikes / 6), 2));
}

function oiBaseAt(key: string, K: number, tag: 'ce' | 'pe', i: number, strikes: number): number {
  return Math.round((2_400_000 * humpAt(i, strikes) + 60_000) * (0.4 + hash(key, K, tag, 'oi') * 1.4));
}

/**
 * @param tick advances every poll so LTP/volume drift and the grid's change-flash is exercised.
 */
export function replayChain(key: string, expiry: string, dte: number, tick: number): OptionChainResponse {
  const shape = SHAPES[key] ?? SHAPES.NIFTY!;
  const drift = Math.sin(tick / 9) * shape.spot * 0.0004;
  const spot = shape.spot + drift;

  const T = Math.max(dte, 1) / 365;
  const rt = Math.sqrt(T);
  const r = 0.065;
  const atm = Math.round(spot / shape.step) * shape.step;
  const half = Math.floor(shape.strikes / 2);

  const oc: Record<string, { ce?: OptionLeg; pe?: OptionLeg }> = {};

  for (let i = -half; i <= half; i++) {
    const K = atm + i * shape.step;
    if (K <= 0) continue;
    const m = (K - spot) / spot;
    const iv = Math.max(2, shape.iv * (1 + 2.6 * m * m + 0.22 * Math.abs(m)) + (hash(key, K, 'iv') - 0.5) * 0.3);
    const v = iv / 100;
    const d1 = (Math.log(spot / K) + (r + v * v / 2) * T) / (v * rt);
    const d2 = d1 - v * rt;

    const cePrice = Math.max(0.05, spot * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2));
    const pePrice = Math.max(0.05, K * Math.exp(-r * T) * ncdf(-d2) - spot * ncdf(-d1));
    const gamma = npdf(d1) / (spot * v * rt);
    const vega = spot * npdf(d1) * rt / 100;
    const theta = -(spot * npdf(d1) * v) / (2 * rt) / 252;

    const mk = (isCe: boolean, price: number, delta: number): OptionLeg => {
      const tag = isCe ? 'ce' : 'pe';
      const oiBase = oiBaseAt(key, K, tag, i, shape.strikes);
      const prevOi = Math.round(oiBase * (0.35 + hash(key, K, tag, 'poi') * 0.9));
      // Drift is PROPORTIONAL to the contract's own OI, not a flat 900/tick. A flat drift adds
      // the same absolute size to a 24 K wing strike as to a 3 M ATM strike, so the wings grew
      // ~4%/poll and every ratio taken against them (P7's OI-vs-peak) went nonsense within
      // minutes. 0.025%/poll is about +190% over a full session, which a busy strike really does.
      const oi = Math.round(oiBase * (1 + tick * 0.00025 * hash(key, K, tag, 'oid')));
      const volBase = Math.round(oi * (2 + hash(key, K, tag, 'vol') * 16));
      const prevVol = Math.round(volBase * (0.1 + hash(key, K, tag, 'pvol') * 0.7));
      const volume = volBase + Math.round(tick * 4200 * hash(key, K, tag, 'vd'));
      const prevClose = price * (0.7 + hash(key, K, tag, 'pc') * 0.85);
      const jitter = 1 + (hash(key, K, tag, `t${tick}`) - 0.5) * 0.02;
      const last = Math.round(price * jitter * 100) / 100;
      return {
        average_price: Math.round(price * 100) / 100,
        greeks: {
          delta: Math.round(delta * 100) / 100,
          theta: Math.round(theta * 100) / 100,
          gamma: Math.round(gamma * 100000) / 100000,
          vega: Math.round(vega * 100) / 100,
        },
        implied_volatility: Math.round(iv * 100) / 100,
        last_price: last,
        oi,
        previous_close_price: Math.round(prevClose * 100) / 100,
        previous_oi: prevOi,
        previous_volume: prevVol,
        top_ask_price: Math.round((last + 0.05) * 100) / 100,
        top_ask_quantity: 325,
        top_bid_price: Math.round((last - 0.05) * 100) / 100,
        top_bid_quantity: 650,
        volume,
      };
    };

    oc[K.toFixed(6)] = {
      ce: mk(true, cePrice, ncdf(d1)),
      pe: mk(false, pePrice, ncdf(d1) - 1),
    };
  }

  return { data: { last_price: Math.round(spot * 100) / 100, oc }, status: 'success' };
}

/** Where a replayed underlying's price sits, so synthetic ticks land in a believable range. */
export function replayBasePrice(key: string): number {
  return (SHAPES[key] ?? SHAPES.NIFTY!).spot;
}

/** Previous close for the underlying, so the header's spot change is exercised too. */
export function replayPrevClose(key: string): number {
  const shape = SHAPES[key] ?? SHAPES.NIFTY!;
  const movePct = (hash(key, 'prevclose') - 0.5) * 0.012;
  return Math.round(shape.spot * (1 - movePct) * 100) / 100;
}

/* ------------------------------------------------------------- peak OI (P7) */

/**
 * Which strikes are seeded to have ALREADY crossed yesterday's peak, as offsets from the static
 * ATM. Locked at 3 CE + 2 PE by peak-oi-v1.md row 19, and small enough to exist in a 31-strike
 * chain as well as a 41-strike one.
 */
const BREACH_OFFSETS: Record<'ce' | 'pe', number[]> = { ce: [-2, 1, 4], pe: [-3, 5] };

/** 09:15 to 15:29 IST inclusive. */
const SESSION_MINUTES = 375;

/**
 * Yesterday's peak OI for one replayed contract.
 *
 * Anchored to the SAME oiBase the chain uses, off the STATIC spot rather than the drifting one,
 * so the number is a fixed historical fact for the whole run - which is what a peak is.
 * f < 1 means today's OI is already above it (a breach); f > 1 means it is not.
 */
function replayPeakOi(key: string, strike: number, side: 'ce' | 'pe'): number {
  const shape = SHAPES[key] ?? SHAPES.NIFTY!;
  const atm = Math.round(shape.spot / shape.step) * shape.step;
  const i = Math.round((strike - atm) / shape.step);
  const base = oiBaseAt(key, strike, side, i, shape.strikes);
  const f = BREACH_OFFSETS[side].includes(i) ? 0.88 : 1.18 + hash(key, strike, side, 'peakf') * 0.45;
  return Math.round(base * f);
}

/** The IST dates a replayed exchange traded on, oldest first. Weekends only - no holiday table. */
export function replaySessionDates(today: string, days: number): string[] {
  const t = Date.parse(`${today}T00:00:00Z`);
  const out: string[] = [];
  for (let d = days; d >= 0; d--) {
    const dt = new Date(t - d * 86_400_000);
    const wd = dt.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

function istEpochSeconds(date: string, minuteOfSession: number): number {
  return Math.floor(Date.parse(`${date}T09:15:00+05:30`) / 1000) + minuteOfSession * 60;
}

/**
 * A full intraday candle payload in the endpoint's parallel-array shape, for ONE option contract.
 *
 * The peak is NOT handed over directly: the series is generated so that its maximum over the
 * previous session equals `replayPeakOi()` exactly, and `peakFrom()` in peakoi.ts recovers it
 * through the same max() the live path uses. Testing a peak we simply asserted would test nothing.
 *
 * Today's candles deliberately carry 1.4x the peak. If the reader ever stops discarding them,
 * every peak inflates by 40% and the seeded breaches disappear - a loud failure, not a quiet one.
 */
export function replayIntraday(
  key: string, strike: number, side: 'ce' | 'pe', sessionDate: string, today: string,
): Candles {
  const peak = replayPeakOi(key, strike, side);
  const pkAt = 90 + Math.floor(hash(key, strike, side, 'pkidx') * 200);   // 10:45 - 14:05 IST

  const timestamp: number[] = [];
  const open_interest: number[] = [];
  const volume: number[] = [];
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];

  const push = (date: string, m: number, oi: number) => {
    timestamp.push(istEpochSeconds(date, m));
    open_interest.push(oi);
    const px = 40 + hash(key, strike, side, `px${m}`) * 60;
    const o = Math.round(px * 100) / 100;
    open.push(o);
    high.push(Math.round(px * 1.01 * 100) / 100);
    low.push(Math.round(px * 0.99 * 100) / 100);
    close.push(o);
    volume.push(Math.round(1000 + hash(key, strike, side, `v${m}`) * 40_000));
  };

  for (let m = 0; m < SESSION_MINUTES; m++) {
    // Ramp up to the peak, then decay. Every factor except the peak candle's is < 1, and the
    // jitter only ever subtracts, so max(open_interest) lands on exactly one candle.
    let f: number;
    if (m === pkAt) f = 1;
    else if (m < pkAt) f = 0.55 + 0.44 * (m / pkAt);
    else f = 0.99 - 0.27 * ((m - pkAt) / (SESSION_MINUTES - 1 - pkAt));
    if (m !== pkAt) f *= 1 - hash(key, strike, side, `oi${m}`) * 0.02;
    push(sessionDate, m, Math.round(peak * f));
  }

  for (let m = 0; m < SESSION_MINUTES; m++) push(today, m, Math.round(peak * 1.4));

  return { open, high, low, close, volume, timestamp, open_interest };
}

/* --------------------------------------------------------- F&O scanner (P8) */

/**
 * scanner-v1.md row 15: the seeded replay universe must return EXACTLY 6 survivors - 4 long and
 * 2 short - or P8 has no acceptance test at all while the Data API plan is inactive.
 *
 * The seeding is deliberately indirect. Nothing here tells the scanner who passes: every stock
 * gets a % change and an OI change from the same hash the rest of replay uses, and the six are
 * designated BY RANK in the sorted list, not by name. The scanner still has to sort all 210
 * itself, cut its own top-50/bottom-50, apply both thresholds and recompute both percentages
 * from `last_price` / `net_change` / `open_interest`. Handing it the answer would test nothing -
 * the same reason P7 synthesises a candle series instead of a peak.
 */
const SCAN_GAINER_RANKS = [0, 3, 7, 12];    // inside the top 50 by construction
const SCAN_LOSER_RANKS = [2, 6];            // counted from the bottom of the sorted list
/** Row 14 must be exercised too: two stocks return no quote, one returns no OI baseline. */
const SCAN_NOQUOTE = 2;
const SCAN_NOBASELINE_RANK = 20;            // a top-50 gainer, so the baseline is actually attempted

export type ReplayScanQuote = {
  ltp: number;
  netChange: number;
  volume: number;
  /** Near-month futures OI as it stands "now". */
  futOi: number;
  /** Previous session's closing futures OI. Never handed to the scanner directly - it is the
   *  last candle of `replayFuturesCandles`, which the production reducer has to find. */
  baselineOi: number;
  /** Null means this stock quotes normally. */
  hide: 'quote' | 'baseline' | null;
};

export type ReplayScanPlan = Map<string, ReplayScanQuote>;

const scanPlans = new Map<string, ReplayScanPlan>();

/** Deterministic and memoised: two scans of the same universe must return the same six stocks. */
export function replayScanPlan(symbols: string[]): ReplayScanPlan {
  const cacheKey = symbols.join(',');
  const hit = scanPlans.get(cacheKey);
  if (hit) return hit;

  // Squared rather than uniform, so most stocks sit within +/-1% and only the tails reach +/-5%,
  // which is the shape a real session has. It also matters for the test: under a uniform spread
  // every one of the top 50 clears 2% and filter 2 rejects nothing, so the middle of the funnel
  // would never be exercised at all. At this scale it cuts the bottom ~9 of each side's 50 while
  // leaving the designated six - the worst of them at rank 12 - far above the threshold.
  const chg = new Map<string, number>();
  for (const s of symbols) {
    const v = hash(s, 'scan', 'chg') * 2 - 1;          // -1 .. 1
    chg.set(s, Math.sign(v) * 5 * v * v);
  }

  // The two no-quote stocks are taken from the flat middle of the distribution, so removing them
  // cannot disturb either tail and the six are unaffected.
  const hidden = new Set(
    symbols.filter(s => Math.abs(chg.get(s)!) < 0.5)
      .sort((a, b) => hash(a, 'scan', 'hide') - hash(b, 'scan', 'hide'))
      .slice(0, SCAN_NOQUOTE),
  );

  const ranked = symbols.filter(s => !hidden.has(s)).sort((a, b) => chg.get(b)! - chg.get(a)!);
  const n = ranked.length;

  const designated = new Set<string>();
  for (const r of SCAN_GAINER_RANKS) { const s = ranked[r]; if (s) designated.add(s); }
  for (const r of SCAN_LOSER_RANKS) { const s = ranked[n - 1 - r]; if (s) designated.add(s); }
  const noBaseline = ranked[SCAN_NOBASELINE_RANK] ?? null;

  const plan: ReplayScanPlan = new Map();
  for (const symbol of symbols) {
    const c = chg.get(symbol)!;
    const ltp = Math.round((40 + hash(symbol, 'scan', 'px') * 2400) * 100) / 100;
    // Round the change, not the close: the scanner derives prevClose as ltp - netChange, so
    // rounding it here is what keeps its recomputed % equal to the seeded one.
    const netChange = Math.round((ltp - ltp / (1 + c / 100)) * 100) / 100;

    // Designated stocks clear 7% with room; everyone else is capped well below it, so no
    // rounding or drift can push a non-designated stock over the line.
    const oiPct = designated.has(symbol)
      ? (hash(symbol, 'scan', 'oisign') > 0.5 ? 1 : -1) * (7.5 + hash(symbol, 'scan', 'oim') * 6)
      : Math.max(-5.5, Math.min(5.5, (hash(symbol, 'scan', 'oi') - 0.5) * 11));

    const baselineOi = Math.round(200_000 + hash(symbol, 'scan', 'boi') * 3_000_000);

    plan.set(symbol, {
      ltp,
      netChange,
      volume: Math.round(50_000 + hash(symbol, 'scan', 'vol') * 8_000_000),
      futOi: Math.round(baselineOi * (1 + oiPct / 100)),
      baselineOi,
      hide: hidden.has(symbol) ? 'quote' : symbol === noBaseline ? 'baseline' : null,
    });
  }

  scanPlans.set(cacheKey, plan);
  return plan;
}

/** 09:15 to 15:25 IST inclusive at 5-minute candles - scanner-v1.md row 7's interval. */
const SCAN_CANDLES = 75;

/**
 * A futures intraday payload for one stock, in the endpoint's parallel-array shape.
 *
 * The baseline is NOT handed over: the previous session's LAST candle carries it and
 * `closingOiOn()` in peakoi.ts has to find it. Today's candles carry the CURRENT OI, which is a
 * different number - so a reader that stops filtering by date reports every stock at 0% OI
 * change and the scan returns nothing, which is a loud failure rather than a quiet one.
 */
export function replayFuturesCandles(
  plan: ReplayScanPlan, symbol: string, sessionDate: string, today: string,
): Candles | null {
  const q = plan.get(symbol);
  if (!q || q.hide === 'baseline') return null;

  const timestamp: number[] = [];
  const open_interest: number[] = [];
  const volume: number[] = [];
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];

  const push = (date: string, i: number, oi: number) => {
    timestamp.push(istEpochSeconds(date, i * 5));
    open_interest.push(oi);
    const px = q.ltp * (0.97 + hash(symbol, 'scan', `c${i}`) * 0.06);
    const o = Math.round(px * 100) / 100;
    open.push(o);
    high.push(Math.round(px * 1.004 * 100) / 100);
    low.push(Math.round(px * 0.996 * 100) / 100);
    close.push(o);
    volume.push(Math.round(5_000 + hash(symbol, 'scan', `cv${i}`) * 200_000));
  };

  for (let i = 0; i < SCAN_CANDLES; i++) {
    // Wander around the close, then land exactly on it in the final candle.
    const f = i === SCAN_CANDLES - 1 ? 1 : 0.90 + hash(symbol, 'scan', `coi${i}`) * 0.16;
    push(sessionDate, i, Math.round(q.baselineOi * f));
  }
  for (let i = 0; i < SCAN_CANDLES; i++) push(today, i, q.futOi);

  return { open, high, low, close, volume, timestamp, open_interest };
}

/* ---------------------------------------------------- option candles (P9) */

/**
 * option-candles-v1.md row 18: the seeded replay day must contain EXACTLY 3 blue and 2 yellow
 * candles, or P9 has no acceptance test at all while the Data API plan is inactive.
 *
 * The seeding is indirect, the same way P7's and P8's are. Nothing here says "this candle is
 * blue": the generator sets a volume and an open interest, and `colourCandles()` in candles.ts
 * has to compute its own 20-candle median, its own dOI against the previous candle, and both
 * thresholds to arrive at the colour. In particular the volume spike is 8x the TOP of the
 * ordinary band rather than a multiple of the median this fixture computed - a fixture that
 * recomputed the production median would be testing itself.
 */

/** Designated by FRACTION of the session, so the counts hold identically at 1, 5 and 15 minutes
 *  and no index can ever land on the last candle, which row 11 keeps uncoloured. */
const BLUE_AT = [0.30, 0.55, 0.78];
const YELLOW_AT = [0.40, 0.88];
/** AC3 needs one candle that passes the volume test and FAILS the OI test. */
const VOLONLY_AT = [0.62];

/** Ordinary volume band. Narrow on purpose: the widest possible ordinary ratio is
 *  30,000 / 20,000 = 1.5, which cannot reach 3.0 however the median falls. */
const VOL_LO = 20_000;
const VOL_SPAN = 10_000;
/** 8x the top of the band. At most 5 spikes ever sit inside a 20-candle window, so the median
 *  stays inside the ordinary band and the ratio stays at or above 8. */
const VOL_SPIKE = 8 * (VOL_LO + VOL_SPAN);

/** Row 15's empty state has to be reachable in replay or it can never be screenshotted.
 *  Strikes this far from the money return no candles at all. */
const ILLIQUID_OFFSET = 15;

/** 09:15 to 15:30 IST is 375 minutes, so a session holds exactly 375/interval candles. */
function candlesPerDay(intervalMin: number): number {
  return Math.max(1, Math.floor(SESSION_MINUTES / intervalMin));
}

/**
 * A multi-day intraday payload for ONE option contract, in the endpoint's parallel-array shape.
 *
 * Earlier days are not decoration: row 12 exists so the first candle of the rendered session
 * already has 20 predecessors, and only the LAST day carries the designated candles.
 *
 * Open interest is anchored to the SAME `oiBaseAt` the chain and P7's peaks use, so a strike's
 * candle OI cannot disagree with its own row in the grid.
 */
export function replayOptionCandles(
  key: string, strike: number, side: 'ce' | 'pe', intervalMin: number, dates: string[],
): Candles | null {
  const shape = SHAPES[key] ?? SHAPES.NIFTY!;
  const atm = Math.round(shape.spot / shape.step) * shape.step;
  const off = Math.round((strike - atm) / shape.step);
  if (Math.abs(off) >= ILLIQUID_OFFSET) return null;         // row 15
  if (!dates.length) return null;

  const per = candlesPerDay(intervalMin);
  const lastDay = dates.length - 1;
  const at = (fracs: number[]) => new Set(fracs.map(f => Math.round(f * (per - 1))));
  const iBlue = at(BLUE_AT), iYellow = at(YELLOW_AT), iVolOnly = at(VOLONLY_AT);

  const timestamp: number[] = [];
  const open_interest: number[] = [];
  const volume: number[] = [];
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];

  const pxBase = 40 + hash(key, strike, side, 'px0') * 60;
  let px = pxBase;
  let oi = oiBaseAt(key, strike, side, off, shape.strikes) * 0.7;

  for (let d = 0; d < dates.length; d++) {
    for (let j = 0; j < per; j++) {
      const seeded = d === lastDay;
      const blue = seeded && iBlue.has(j);
      const yellow = seeded && iYellow.has(j);
      const volOnly = seeded && iVolOnly.has(j);

      // OI moves FIRST, because the rule reads it against the previous candle's value.
      if (blue) oi *= 1.12;                       // +12% - clears the 5% test with room
      else if (yellow) oi *= 0.86;                // -14%
      else if (volOnly) oi *= 1.01;               // +1% - fails the 5% test on purpose
      else oi *= 0.995 + hash(key, strike, side, `oi${d}-${j}`) * 0.01;   // +/-0.5%, never fires

      const vol = (blue || yellow || volOnly)
        ? VOL_SPIKE
        : Math.round(VOL_LO + hash(key, strike, side, `v${d}-${j}`) * VOL_SPAN);

      const drift = (hash(key, strike, side, `m${d}-${j}`) - 0.5) * 0.024;
      const next = Math.min(pxBase * 2.5, Math.max(0.05, px * (1 + drift)));
      const o = Math.round(px * 100) / 100;
      const c = Math.round(next * 100) / 100;
      px = next;

      timestamp.push(istEpochSeconds(dates[d]!, j * intervalMin));
      open_interest.push(Math.round(oi));
      volume.push(vol);
      open.push(o);
      close.push(c);
      high.push(Math.round(Math.max(o, c) * (1 + hash(key, strike, side, `h${d}-${j}`) * 0.008) * 100) / 100);
      low.push(Math.round(Math.min(o, c) * (1 - hash(key, strike, side, `l${d}-${j}`) * 0.008) * 100) / 100);
    }
  }

  return { open, high, low, close, volume, timestamp, open_interest };
}

/** Plausible network latency so the panel's percentiles and waterfall have real spread. */
export async function replayLatency(): Promise<number> {
  const base = 120 + Math.random() * 140;
  const spike = Math.random() < 0.07 ? 180 + Math.random() * 320 : 0;
  const ms = Math.round(base + spike);
  await new Promise(res => setTimeout(res, ms));
  return ms;
}
