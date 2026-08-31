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

/** Plausible network latency so the panel's percentiles and waterfall have real spread. */
export async function replayLatency(): Promise<number> {
  const base = 120 + Math.random() * 140;
  const spike = Math.random() < 0.07 ? 180 + Math.random() * 320 : 0;
  const ms = Math.round(base + spike);
  await new Promise(res => setTimeout(res, ms));
  return ms;
}
