/**
 * P9 - option candle colouring.
 *
 * Spec: docs/spec/option-candles-v1.md. One option contract's OWN candles, recoloured where a
 * big player is entering or exiting that strike:
 *
 *     fired  = volume test AND OI test                                    (row 5)
 *     volume = vol[i] >= 3.0 * median(vol[i-20 .. i-1])                   (row 6)
 *     OI     = abs(dOI) >= 5% of oi[i-1]  AND  abs(dOI) >= 5 * lotSize    (row 7)
 *     blue   = fired and dOI > 0   -> entering the strike                 (row 8)
 *     yellow = fired and dOI < 0   -> exiting the strike
 *
 * Rules that must not drift:
 *  - the median is a MEDIAN, not a mean (row 6) - a mean is dragged upward by the very spike the
 *    test is looking for
 *  - the OI baseline is the PREVIOUS CANDLE, not the day's open (row 7)
 *  - the in-progress candle is never coloured (row 11); a colour that appears and then vanishes
 *    mid-candle is a false signal on a trading screen
 *  - the window reaches 5 calendar days back so today's 09:15 candle already has 20 predecessors
 *    (row 12), but only the LATEST session is rendered (row 20) - the earlier days are context
 *  - the rate-gate key is per (contract, interval); dhanPost gates per key, and sharing one key
 *    across intervals would hold a 5 -> 1 switch behind the interval it replaced
 */

import type { Credentials } from './dhan.ts';
import {
  optionContracts, optionInstrument, todayIso,
  type OptionContract, type ResolvedInstrument,
} from './instruments.ts';
import { fetchIntraday, istParts, type Candles } from './peakoi.ts';
import { isReplay, replayOptionCandles, replaySessionDates } from './replay.ts';

/** Row 6. */
const VOL_MULT = 3.0;
/** Row 6/12. */
const LOOKBACK = 20;
/** Row 7. */
const OI_PCT = 0.05;
const OI_LOT_MULT = 5;
/** Row 3. */
const WINDOW_DAYS = 5;
/** Row 4. Anything else is rejected rather than silently coerced. */
export const INTERVALS = ['1', '5', '15'] as const;
export type Interval = (typeof INTERVALS)[number];
/** Row 14. */
const CADENCE_MS = 1000;

/* ------------------------------------------------------------------- types */

export type OptionCandle = {
  /** Candle OPEN time, epoch ms. */
  t: number;
  /** IST HH:MM of the open, so the tooltip never has to re-derive the clock. */
  at: string;
  o: number; h: number; l: number; c: number;
  volume: number;
  oi: number;
  /** Null for a candle with fewer than 20 predecessors in the window (row 12). */
  median20: number | null;
  volRatio: number | null;
  /** oi[i] - oi[i-1]. Null on the first candle of the whole window. */
  dOi: number | null;
  dOiPct: number | null;
  volPass: boolean;
  oiPass: boolean;
  /** Row 11: always null while the candle is still forming. */
  fired: 'blue' | 'yellow' | null;
  inProgress: boolean;
};

export type CandleResult = {
  mode: 'live' | 'replay';
  instrument: string;
  label: string;
  expiry: string;
  strike: number;
  side: 'ce' | 'pe';
  securityId: number | null;
  seg: string | null;
  lot: number | null;
  /** The floor row 7 actually applied, so the tooltip's arithmetic is reproducible by hand. */
  oiFloor: number;
  interval: Interval;
  /** The session the rendered candles belong to. */
  sessionDate: string | null;
  from: string;
  to: string;
  candles: OptionCandle[];
  /** How many earlier-session candles fed median20 for the first rendered one. */
  context: number;
  counts: { blue: number; yellow: number };
  /** Row 15. An illiquid contract is a note, never an error. */
  note: string | null;
  error: string | null;
  elapsedMs: number;
};

/* ------------------------------------------------------------------- clock */

function isoDaysAgo(days: number): string {
  const ms = Date.now() + 5.5 * 3600 * 1000 - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- the rule */

/**
 * Median of a slice. Even length averages the two middles - stated here because the tooltip
 * prints `median20` and anyone hand-checking a colour has to know which convention was used.
 */
export function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Dhan documents epoch SECONDS. A millisecond value would be ~1e12, so normalise rather than
 *  bucket a shape change into 1970 - the same guard `istParts` uses. */
function toMs(ts: number): number {
  return ts > 1e11 ? ts : ts * 1000;
}

/**
 * The whole colour rule, in one place, over the WHOLE window - the first candle of today has to
 * see yesterday's last 20, which is the only reason the window is 5 days wide (row 12).
 *
 * `nowMs` is injected rather than read off the clock so the in-progress candle stays decidable
 * in replay, where the synthetic session is not happening right now. See `nowForReplay`.
 */
export function colourCandles(
  c: Candles | null | undefined,
  opts: { intervalMs: number; oiFloor: number; nowMs: number },
): OptionCandle[] {
  const ts = c?.timestamp;
  if (!Array.isArray(ts) || !ts.length) return [];
  const o = c?.open ?? [], h = c?.high ?? [], l = c?.low ?? [], cl = c?.close ?? [];
  const vol = c?.volume ?? [], oi = c?.open_interest ?? [];

  const n = Math.min(ts.length, o.length, h.length, l.length, cl.length, vol.length, oi.length);
  const out: OptionCandle[] = [];

  for (let i = 0; i < n; i++) {
    const tMs = toMs(ts[i]!);
    const volume = num(vol[i]);
    const openInt = num(oi[i]);

    // Row 12. Fewer than 20 predecessors inside the window means the test cannot run at all -
    // that is an unavailable test, not a failed one, so median20 reads as null rather than 0.
    const median20 = i >= LOOKBACK
      ? medianOf(vol.slice(i - LOOKBACK, i).map(v => num(v)))
      : null;
    const volRatio = median20 !== null && median20 > 0 ? volume / median20 : null;
    const volPass = volRatio !== null && volRatio >= VOL_MULT;

    const prevOi = i > 0 ? num(oi[i - 1]) : null;
    const dOi = prevOi === null ? null : openInt - prevOi;
    const dOiPct = dOi !== null && prevOi ? (dOi / prevOi) * 100 : null;
    // Row 7. Both halves. The lot floor is what stops a strike holding 200 units from firing
    // on noise that a percentage alone would wave through.
    const oiPass = dOi !== null && prevOi !== null && prevOi > 0
      && Math.abs(dOi) >= OI_PCT * prevOi
      && Math.abs(dOi) >= opts.oiFloor;

    // Only the newest candle can still be forming, and only while its close time is ahead.
    const inProgress = i === n - 1 && tMs + opts.intervalMs > opts.nowMs;

    const fired: 'blue' | 'yellow' | null =
      (!inProgress && volPass && oiPass && dOi !== null && dOi !== 0)
        ? (dOi > 0 ? 'blue' : 'yellow')
        : null;

    out.push({
      t: tMs,
      at: istParts(ts[i]!)?.time ?? '',
      o: num(o[i]), h: num(h[i]), l: num(l[i]), c: num(cl[i]),
      volume, oi: openInt,
      median20, volRatio, dOi, dOiPct, volPass, oiPass, fired, inProgress,
    });
  }
  return out;
}

/**
 * Replay's session is synthetic, so "now" is not the wall clock: the last candle of the seeded
 * day is declared to be the one still forming. Without this the in-progress branch - and AC4
 * with it - would be untestable outside 09:15-15:30 IST, which is when almost no work on this
 * project happens. Live, `now` is the wall clock and nothing here runs.
 */
function nowForReplay(c: Candles | null): number {
  const ts = c?.timestamp;
  if (!Array.isArray(ts) || !ts.length) return Date.now();
  return toMs(ts[ts.length - 1]!) + 1000;
}

/* ----------------------------------------------------------------- service */

export class CandleService {
  private readonly creds: Credentials | null;
  /** `${instrumentId}|${expiry}` -> contracts. optionContracts() scans ~170k master rows. */
  private readonly contracts = new Map<string, Map<string, OptionContract>>();
  /** Two requests for the same contract inside one fetch share the call rather than racing it. */
  private readonly inFlight = new Map<string, Promise<CandleResult>>();

  constructor(creds: Credentials | null) { this.creds = creds; }

  private contractsFor(inst: ResolvedInstrument, expiry: string): Map<string, OptionContract> {
    const key = `${inst.id}|${expiry}`;
    let m = this.contracts.get(key);
    if (!m) {
      m = new Map<string, OptionContract>();
      for (const c of optionContracts(inst.id, expiry)) m.set(`${c.strike}|${c.optionType}`, c);
      this.contracts.set(key, m);
    }
    return m;
  }

  get(
    inst: ResolvedInstrument, expiry: string, strike: number,
    side: 'ce' | 'pe', interval: Interval,
  ): Promise<CandleResult> {
    const contract = this.contractsFor(inst, expiry).get(`${strike}|${side.toUpperCase()}`) ?? null;
    const key = `${inst.id}|${expiry}|${strike}|${side}|${interval}`;
    const hit = this.inFlight.get(key);
    if (hit) return hit;
    const p = this.load(inst, expiry, strike, side, interval, contract)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  private async load(
    inst: ResolvedInstrument, expiry: string, strike: number, side: 'ce' | 'pe',
    interval: Interval, contract: OptionContract | null,
  ): Promise<CandleResult> {
    const started = Date.now();
    const to = todayIso();
    const from = isoDaysAgo(WINDOW_DAYS);
    const intervalMs = Number(interval) * 60_000;
    // Row 7's floor. A null lot means the master carried none; 5 contracts is then the weakest
    // floor that still kills a 200-unit strike. The spec's risk row says one live call settles
    // whether `open_interest` is quoted in units or in contracts at all.
    const oiFloor = OI_LOT_MULT * (inst.lot ?? 1);

    const base: CandleResult = {
      mode: isReplay() ? 'replay' : 'live',
      instrument: inst.id, label: inst.label, expiry, strike, side,
      securityId: contract?.securityId ?? null, seg: contract?.seg ?? null,
      lot: inst.lot, oiFloor, interval, sessionDate: null, from, to,
      candles: [], context: 0, counts: { blue: 0, yellow: 0 },
      note: null, error: null, elapsedMs: 0,
    };
    const illiquid = `no trades in this contract today - ${inst.label} ${strike} ${side.toUpperCase()}`;

    if (!contract) {
      return {
        ...base,
        error: `no ${side.toUpperCase()} contract at ${strike} for ${expiry} in the instrument master`,
        elapsedMs: Date.now() - started,
      };
    }

    let raw: Candles | null = null;
    if (isReplay()) {
      raw = replayOptionCandles(
        inst.id, strike, side, Number(interval), replaySessionDates(to, WINDOW_DAYS));
    } else {
      const optInst = optionInstrument(inst.id);
      if (!optInst) {
        return {
          ...base,
          error: `${inst.id} has no option instrument type in the registry`,
          elapsedMs: Date.now() - started,
        };
      }
      const res = await fetchIntraday(this.creds, {
        securityId: String(contract.securityId), seg: contract.seg, instrument: optInst,
        interval, oi: true, fromDate: from, toDate: to,
        key: `candles:${contract.securityId}:${interval}`, cadenceMs: CADENCE_MS,
      });
      if (res.why) return { ...base, error: res.why, elapsedMs: Date.now() - started };
      raw = res.candles;
    }

    const nowMs = isReplay() ? nowForReplay(raw) : Date.now();
    const all = colourCandles(raw, { intervalMs, oiFloor, nowMs });
    if (!all.length) return { ...base, note: illiquid, elapsedMs: Date.now() - started };

    // Row 20. Only the latest session is rendered; the earlier days exist so that session's
    // first candle already has its 20 predecessors.
    const sessionDate = istParts(all[all.length - 1]!.t)?.date ?? null;
    const rendered = sessionDate === null
      ? all
      : all.filter(k => istParts(k.t)?.date === sessionDate);

    let blue = 0, yellow = 0;
    for (const k of rendered) {
      if (k.fired === 'blue') blue++;
      else if (k.fired === 'yellow') yellow++;
    }

    return {
      ...base,
      sessionDate,
      candles: rendered,
      context: all.length - rendered.length,
      counts: { blue, yellow },
      note: rendered.length ? null : illiquid,
      elapsedMs: Date.now() - started,
    };
  }
}
