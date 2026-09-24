/**
 * P19 - underlying candles.
 *
 * Spec: docs/spec/underlying-candles-v1.md. The chip's OWN underlying (index, share, or the GOLD
 * future) as plain OHLC candles for the main chart strip. No colour rule lives here - the client
 * paints up/down from o/c with the saved Chart Style.
 *
 * Rules that must not drift:
 *  - the window is 5 calendar days (row 2) but only the LATEST session is marked for drawing; the
 *    earlier days ride along so an SMA 20/50 already has a full window at 09:15 (row 12)
 *  - nothing is persisted: replay writes synthetic prices under real security ids, and a file
 *    shared between the modes would hand live a replayed history (CLAUDE.md, P12b)
 *  - the rate-gate key is per (underlying, interval), the same shape as P9's
 */

import type { Credentials } from './dhan.ts';
import { sessionCloseMin, todayIso, underlyingInstrument, type ResolvedInstrument, type SessionId } from './instruments.ts';
import { fetchIntraday, istParts, type Candles } from './peakoi.ts';
import { isReplay, replaySessionDates, replayUnderlyingCandles } from './replay.ts';
import { INTERVALS, shapeError, type Interval } from './candles.ts';

export { INTERVALS };

/** Row 2. */
const WINDOW_DAYS = 5;
/** P9 row 14's cadence for the same endpoint. */
const CADENCE_MS = 1000;
/** P36 row 5: a candle opening this long after the session close is not part of the session.
 *  10 min keeps Dhan's own 15:30-15:39 F&O tail (385 one-minute candles a day). */
const TAIL_MIN = 10;

/**
 * P36 row 5 (sleep-proof-v1.md). Dhan's NIFTY `IDX_I` intraday for 24 Sep carried a flat 17:55
 * candle (direct call, P31), and the chart drew a 2.5 h gap to it. Judged on each candle's OWN
 * date, because MCX's close moves with US daylight saving.
 */
export function inSession(list: UCandle[], id: SessionId): UCandle[] {
  return list.filter(k => {
    const [h, m] = k.at.split(':').map(Number);
    return h! * 60 + m! < sessionCloseMin(id, k.d) + TAIL_MIN;
  });
}

export type UCandle = {
  /** Candle OPEN time, epoch ms. */
  t: number;
  /** IST HH:MM of the open. */
  at: string;
  /** IST date of the open, so the client can tell the drawn session from context days. */
  d: string;
  o: number; h: number; l: number; c: number;
};

export type UCandleResult = {
  mode: 'live' | 'replay';
  instrument: string;
  label: string;
  displayName: string;
  interval: Interval;
  /** IST date of the session that is drawn - the latest one in the window. */
  sessionDate: string | null;
  /** Index into `candles` where the drawn session starts. Everything before it is SMA context. */
  sessionStart: number;
  from: string;
  to: string;
  candles: UCandle[];
  note: string | null;
  error: string | null;
  elapsedMs: number;
};

function isoDaysAgo(days: number): string {
  const ms = Date.now() + 5.5 * 3600 * 1000 - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const toMs = (ts: number) => (ts > 1e11 ? ts : ts * 1000);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/** The parallel arrays as candle objects. A row with any non-finite price is dropped, not zeroed:
 *  a 0 low would stretch the whole price axis down to zero. */
export function toUCandles(c: Candles | null | undefined): UCandle[] {
  const ts = c?.timestamp;
  if (!Array.isArray(ts) || !ts.length) return [];
  const o = c?.open ?? [], h = c?.high ?? [], l = c?.low ?? [], cl = c?.close ?? [];
  const n = Math.min(ts.length, o.length, h.length, l.length, cl.length);
  const out: UCandle[] = [];
  for (let i = 0; i < n; i++) {
    const k = { o: num(o[i]), h: num(h[i]), l: num(l[i]), c: num(cl[i]) };
    if (![k.o, k.h, k.l, k.c].every(Number.isFinite)) continue;
    const p = istParts(ts[i]!);
    out.push({ t: toMs(ts[i]!), at: p?.time ?? '', d: p?.date ?? '', ...k });
  }
  return out;
}

export class UnderlyingCandleService {
  private readonly creds: Credentials | null;
  private readonly inFlight = new Map<string, Promise<UCandleResult>>();

  constructor(creds: Credentials | null) { this.creds = creds; }

  get(inst: ResolvedInstrument, interval: Interval): Promise<UCandleResult> {
    const key = `${inst.id}|${interval}`;
    const hit = this.inFlight.get(key);
    if (hit) return hit;
    const p = this.load(inst, interval).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  private async load(inst: ResolvedInstrument, interval: Interval): Promise<UCandleResult> {
    const started = Date.now();
    const to = todayIso();
    const from = isoDaysAgo(WINDOW_DAYS);
    const base: UCandleResult = {
      mode: isReplay() ? 'replay' : 'live',
      instrument: inst.id, label: inst.label, displayName: inst.displayName, interval,
      sessionDate: null, sessionStart: 0, from, to, candles: [],
      note: null, error: null, elapsedMs: 0,
    };
    const done = (patch: Partial<UCandleResult>): UCandleResult =>
      ({ ...base, ...patch, elapsedMs: Date.now() - started });

    let raw: Candles | null;
    if (isReplay()) {
      raw = replayUnderlyingCandles(inst.id, Number(interval), replaySessionDates(to, WINDOW_DAYS));
    } else {
      const instrument = underlyingInstrument(inst.id);
      if (!instrument || inst.underlyingScrip === null) {
        return done({ error: `${inst.id} has no resolved underlying to chart` });
      }
      const res = await fetchIntraday(this.creds, {
        securityId: String(inst.underlyingScrip), seg: inst.underlyingSeg, instrument,
        interval, oi: false, fromDate: from, toDate: to,
        key: `ucandles:${inst.id}:${interval}`, cadenceMs: CADENCE_MS,
      });
      if (res.why) return done({ error: res.why });
      raw = res.candles;
    }

    // `shapeError` asks for open_interest too (P9 needs it); an underlying has none, so only the
    // price arrays are checked here.
    const shape = shapeError(raw ? { ...raw, volume: raw.timestamp, open_interest: raw.timestamp } : raw);
    if (shape) return done({ error: shape });

    const all = inSession(toUCandles(raw), inst.session.id);
    if (!all.length) return done({ note: `no candles for ${inst.label} in the last ${WINDOW_DAYS} days` });

    const sessionDate = all[all.length - 1]!.d || null;
    const sessionStart = sessionDate === null ? 0 : all.findIndex(k => k.d === sessionDate);
    return done({ sessionDate, sessionStart: Math.max(0, sessionStart), candles: all });
  }
}
