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

    const hump = Math.exp(-Math.pow(i / (shape.strikes / 6), 2));
    const lot = 1;

    const mk = (isCe: boolean, price: number, delta: number): OptionLeg => {
      const tag = isCe ? 'ce' : 'pe';
      const oiBase = Math.round((2_400_000 * hump + 60_000) * (0.4 + hash(key, K, tag, 'oi') * 1.4)) * lot;
      const prevOi = Math.round(oiBase * (0.35 + hash(key, K, tag, 'poi') * 0.9));
      const oi = oiBase + Math.round(tick * 900 * hash(key, K, tag, 'oid'));
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

/** Previous close for the underlying, so the header's spot change is exercised too. */
export function replayPrevClose(key: string): number {
  const shape = SHAPES[key] ?? SHAPES.NIFTY!;
  const movePct = (hash(key, 'prevclose') - 0.5) * 0.012;
  return Math.round(shape.spot * (1 - movePct) * 100) / 100;
}

/** Plausible network latency so the panel's percentiles and waterfall have real spread. */
export async function replayLatency(): Promise<number> {
  const base = 120 + Math.random() * 140;
  const spike = Math.random() < 0.07 ? 180 + Math.random() * 320 : 0;
  const ms = Math.round(base + spike);
  await new Promise(res => setTimeout(res, ms));
  return ms;
}
