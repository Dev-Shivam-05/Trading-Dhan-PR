/**
 * DeriveEngine - every value in PRD section 4 that Dhan does NOT return.
 *
 * Rules that must not drift:
 *  - a percentage whose denominator is 0 or missing is null, never NaN/Infinity/0
 *  - greeks are passed through untouched; we never recompute what Dhan sent
 *  - PCR is computed over the WHOLE chain, not the visible rows
 */

import type { OptionChainResponse, OptionLeg } from './dhan.ts';

export type Side = {
  ltp: number | null;
  ltpChg: number | null;
  ltpChgPct: number | null;
  iv: number | null;
  volume: number | null;
  volChgPct: number | null;
  oi: number | null;
  oiChg: number | null;
  oiChgPct: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
};

export type Row = { strike: number; ce: Side; pe: Side };

export type Derived = {
  spot: number;
  rows: Row[];
  atmStrike: number | null;
  atmIV: number | null;
  pcr: number | null;
  totals: { ceOi: number; peOi: number };
  strikes: number;
};

const EMPTY: Side = {
  ltp: null, ltpChg: null, ltpChgPct: null, iv: null, volume: null, volChgPct: null,
  oi: null, oiChg: null, oiChgPct: null, delta: null, gamma: null, theta: null, vega: null,
};

/** Percentage that refuses to lie: null when the denominator cannot support one. */
function pct(delta: number, base: number | null | undefined): number | null {
  if (base === null || base === undefined || base === 0 || !Number.isFinite(base)) return null;
  const v = (delta / base) * 100;
  return Number.isFinite(v) ? v : null;
}

function n(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function side(leg: OptionLeg | undefined): Side {
  if (!leg) return { ...EMPTY };

  const ltp = n(leg.last_price);
  const prevClose = n(leg.previous_close_price);
  const oi = n(leg.oi);
  const prevOi = n(leg.previous_oi);
  const volume = n(leg.volume);
  const prevVol = n(leg.previous_volume);

  const ltpChg = ltp !== null && prevClose !== null ? ltp - prevClose : null;
  const oiChg = oi !== null && prevOi !== null ? oi - prevOi : null;
  const volChg = volume !== null && prevVol !== null ? volume - prevVol : null;

  return {
    ltp,
    ltpChg,
    ltpChgPct: ltpChg !== null ? pct(ltpChg, prevClose) : null,
    iv: n(leg.implied_volatility),
    volume,
    volChgPct: volChg !== null ? pct(volChg, prevVol) : null,
    oi,
    oiChg,
    oiChgPct: oiChg !== null ? pct(oiChg, prevOi) : null,
    delta: n(leg.greeks?.delta),
    gamma: n(leg.greeks?.gamma),
    theta: n(leg.greeks?.theta),
    vega: n(leg.greeks?.vega),
  };
}

export function derive(res: OptionChainResponse): Derived {
  const spot = n(res.data?.last_price) ?? 0;
  const oc = res.data?.oc ?? {};

  const rows: Row[] = Object.keys(oc)
    .map(k => ({ strike: Number(k), node: oc[k]! }))
    .filter(r => Number.isFinite(r.strike))
    .sort((a, b) => a.strike - b.strike)
    .map(r => ({ strike: r.strike, ce: side(r.node.ce), pe: side(r.node.pe) }));

  // A strike Dhan returns with zero OI on both sides and no LTP is padding, not a real strike.
  // We keep it: the acceptance criterion is row count === Object.keys(oc).length.

  let ceOi = 0, peOi = 0;
  for (const r of rows) {
    ceOi += r.ce.oi ?? 0;
    peOi += r.pe.oi ?? 0;
  }

  let atmStrike: number | null = null;
  let best = Infinity;
  for (const r of rows) {
    const d = Math.abs(r.strike - spot);
    if (d < best) { best = d; atmStrike = r.strike; }
  }

  const atmRow = rows.find(r => r.strike === atmStrike);
  const ceIv = atmRow?.ce.iv ?? null;
  const peIv = atmRow?.pe.iv ?? null;
  const atmIV =
    ceIv !== null && peIv !== null ? (ceIv + peIv) / 2
    : ceIv !== null ? ceIv
    : peIv !== null ? peIv
    : null;

  return {
    spot,
    rows,
    atmStrike,
    atmIV,
    pcr: ceOi > 0 ? peOi / ceOi : null,
    totals: { ceOi, peOi },
    strikes: rows.length,
  };
}

/* ------------------------------------------------------- IV change baseline */

/**
 * Dhan returns no previous IV, so "IV Change %" is measured against the first successful
 * snapshot of the session for this (date, instrument, expiry). Approximation by construction -
 * the UI says so and shows the baseline time on hover.
 */
export type Baseline = { atmIV: number; at: string };

export function ivChangePct(now: number | null, base: Baseline | undefined): number | null {
  if (now === null || !base || base.atmIV === 0) return null;
  return ((now - base.atmIV) / base.atmIV) * 100;
}
