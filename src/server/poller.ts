/**
 * ChainPoller + TelemetryBus.
 *
 * One poller per (instrument, expiry). It owns the 3-second budget for that key so no number
 * of open browser tabs can trip DH-904. Scheduling is measured from RESPONSE COMPLETION, never
 * from dispatch, so a slow response can never stack two requests in flight.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CADENCE_MS, dhanPost, explain, fetchOptionChain,
  type CallTiming, type Credentials, type OptionChainResponse,
} from './dhan.ts';
import { derive, ivChangePct, type Baseline, type Derived } from './derive.ts';
import { PeakOiStore, type PeakView } from './peakoi.ts';
import { isReplay, replayChain, replayLatency, replayPrevClose } from './replay.ts';
import { daysToExpiry, sessionState, todayIso, type ResolvedInstrument } from './instruments.ts';

const BASELINE_PATH = path.resolve(process.cwd(), '.cache', 'iv-baseline.json');
const BACKOFF_MS = [3000, 6000, 12_000, 30_000];
const IDLE_RECHECK_MS = 60_000;
const UNSUBSCRIBE_GRACE_MS = 30_000;

/* ------------------------------------------------------------- telemetry */

export type Sample = {
  id: string;
  at: string;
  key: string;
  instrument: string;
  expiry: string;
  endpoint: string;
  ok: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  bytes: number;
  strikes: number;
  timing: CallTiming;
  replay: boolean;
};

export class TelemetryBus {
  private readonly buf: Sample[] = [];
  private readonly cap = 500;
  private readonly listeners = new Set<(s: Sample) => void>();

  push(s: Sample) {
    this.buf.push(s);
    if (this.buf.length > this.cap) this.buf.shift();
    for (const l of this.listeners) l(s);
  }
  recent(n = 60): Sample[] { return this.buf.slice(-n); }
  all(): Sample[] { return [...this.buf]; }
  on(fn: (s: Sample) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  stats() {
    const rt = this.buf.filter(s => s.ok && s.timing.roundTrip !== null).map(s => s.timing.roundTrip!);
    const sorted = [...rt].sort((a, b) => a - b);
    const q = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]! : null;
    return {
      count: this.buf.length,
      okRate: this.buf.length ? this.buf.filter(s => s.ok).length / this.buf.length : null,
      p50: q(0.5), p90: q(0.9), p99: q(0.99),
      max: sorted.length ? sorted[sorted.length - 1]! : null,
    };
  }
}

/* -------------------------------------------------------------- snapshot */

export type Snapshot = {
  key: string;
  instrument: {
    id: string; label: string; displayName: string;
    underlyingScrip: number | null; underlyingSeg: string; lot: number | null;
  };
  expiry: string;
  expiries: string[];
  daysToExpiry: number;
  spot: number;
  spotPrevClose: number | null;
  spotChange: number | null;
  spotChangePct: number | null;
  atmStrike: number | null;
  atmIV: number | null;
  ivChangePct: number | null;
  ivBaselineAt: string | null;
  pcr: number | null;
  totals: { ceOi: number; peOi: number };
  rows: Derived['rows'];
  strikes: number;
  /** P7. Yesterday's peak OI per strike, filled in progressively - see peakoi.ts. */
  peakSessionDate: PeakView['sessionDate'];
  peakNote: PeakView['note'];
  peaks: PeakView['peaks'];
  peakProgress: PeakView['progress'];
  receivedAt: number;
  session: ReturnType<typeof sessionState>;
  replay: boolean;
  requestId: string;
  timing: CallTiming;
};

export type PollerStatus =
  | { state: 'idle' }
  | { state: 'polling' }
  | { state: 'closed'; since: string }
  | { state: 'error'; code: string; message: string; explain: string; retryInMs: number | null };

type Listener = (ev: { type: 'snapshot'; data: Snapshot } | { type: 'status'; data: PollerStatus }) => void;

/* ---------------------------------------------------------------- poller */

class ChainPoller {
  readonly key: string;
  private timer: NodeJS.Timeout | null = null;
  private stopTimer: NodeJS.Timeout | null = null;
  private peakTimer: NodeJS.Timeout | null = null;
  private subscribers = 0;
  private failures = 0;
  private tick = 0;
  private running = false;

  last: Snapshot | null = null;
  status: PollerStatus = { state: 'idle' };

  private readonly listeners = new Set<Listener>();

  // Node's native type-stripping does not support constructor parameter properties,
  // so these are declared and assigned explicitly.
  private readonly instrument: ResolvedInstrument;
  private readonly expiry: string;
  private readonly creds: Credentials | null;
  private readonly bus: TelemetryBus;
  private readonly baselines: BaselineStore;
  private readonly peaks: PeakOiStore;

  constructor(
    instrument: ResolvedInstrument,
    expiry: string,
    creds: Credentials | null,
    bus: TelemetryBus,
    baselines: BaselineStore,
    peaks: PeakOiStore,
  ) {
    this.instrument = instrument;
    this.expiry = expiry;
    this.creds = creds;
    this.bus = bus;
    this.baselines = baselines;
    this.peaks = peaks;
    this.key = `${instrument.id}|${expiry}`;
    this.peaks.onProgress(() => this.refreshPeaks());
  }

  /**
   * Re-emit the last snapshot with the peaks that have landed since. Throttled to 2 s, because
   * 82 contracts landing one per second must not become 82 grid re-renders - and because on a
   * closed market this is the ONLY thing that ever updates the column.
   */
  private refreshPeaks() {
    if (!this.last || this.peakTimer) return;
    this.peakTimer = setTimeout(() => {
      this.peakTimer = null;
      const prev = this.last;
      if (!prev) return;
      const pv = this.peaks.view(this.instrument, this.expiry, prev.rows.map(r => r.strike));

      /*
       * `onProgress` is a store-wide signal: every contract that lands for ANY instrument
       * notifies EVERY poller. Without this guard, one chip's backfill re-emits a full snapshot
       * on all of them, and every other open tab re-renders its whole grid for peaks that did
       * not move. Compare before emitting - `view()` is already computed, so this costs one
       * JSON.stringify of the peaks map and saves a 41-row re-render on each uninvolved tab.
       */
      const same = prev.peakSessionDate === pv.sessionDate
        && prev.peakNote === pv.note
        && JSON.stringify(prev.peakProgress) === JSON.stringify(pv.progress)
        && JSON.stringify(prev.peaks) === JSON.stringify(pv.peaks);
      if (same) return;

      this.last = {
        ...prev,
        peakSessionDate: pv.sessionDate, peakNote: pv.note,
        peaks: pv.peaks, peakProgress: pv.progress,
      };
      this.emit({ type: 'snapshot', data: this.last });
    }, 750);
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(ev: Parameters<Listener>[0]) { for (const l of this.listeners) l(ev); }

  private setStatus(s: PollerStatus) { this.status = s; this.emit({ type: 'status', data: s }); }

  subscribe() {
    this.subscribers++;
    if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null; }
    if (!this.running) { this.running = true; void this.loop(); }
  }

  unsubscribe() {
    this.subscribers = Math.max(0, this.subscribers - 1);
    if (this.subscribers === 0 && !this.stopTimer) {
      // Keep polling briefly so toggling back to this chip is instant.
      this.stopTimer = setTimeout(() => this.halt(), UNSUBSCRIBE_GRACE_MS);
    }
  }

  private halt() {
    this.running = false;
    this.stopTimer = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.setStatus({ state: 'idle' });
  }

  private schedule(ms: number) {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.loop(), ms);
  }

  private async loop() {
    if (!this.running) return;

    const session = sessionState(this.instrument.session.id);

    // Market closed: take one snapshot so the screen has the last known chain, then idle.
    if (!session.openNow && this.last) {
      this.setStatus({ state: 'closed', since: session.reason });
      this.schedule(IDLE_RECHECK_MS);
      return;
    }

    const requestId = randomUUID();
    const scrip = this.instrument.underlyingScrip;

    let call: {
      ok: boolean; httpStatus: number | null; bytes: number;
      data: OptionChainResponse | null; error: { code: string; message: string } | null; timing: CallTiming;
    };

    if (isReplay()) {
      const queuedAt = new Date().toISOString();
      const t0 = performance.now();
      const ms = await replayLatency();
      const dte = daysToExpiry(this.expiry);
      const data = replayChain(this.instrument.id, this.expiry, dte, ++this.tick);
      const t1 = performance.now();
      const bytes = Buffer.byteLength(JSON.stringify(data));
      call = {
        ok: true, httpStatus: 200, bytes, data, error: null,
        timing: {
          queuedAt, queued: 0, dispatched: 0.2,
          ttfb: Math.round(ms * 0.78 * 10) / 10, downloaded: ms, parsed: Math.round((t1 - t0) * 10) / 10,
          roundTrip: ms, server: Math.round(ms * 0.78 * 10) / 10, download: Math.round(ms * 0.22 * 10) / 10,
          compute: Math.round((t1 - t0 - ms) * 10) / 10, gateWait: 0,
        },
      };
    } else if (!this.creds) {
      this.setStatus({ state: 'error', code: 'NO_CREDS', message: 'DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN not set',
        explain: 'Fill .env with a valid Dhan client id and access token, then restart.', retryInMs: null });
      this.schedule(IDLE_RECHECK_MS);
      return;
    } else if (scrip === null) {
      this.setStatus({ state: 'error', code: 'UNRESOLVED', message: `${this.instrument.id} has no UnderlyingScrip`,
        explain: 'Run npm run spike:gold to resolve it.', retryInMs: null });
      this.schedule(IDLE_RECHECK_MS);
      return;
    } else {
      call = await fetchOptionChain(this.creds, scrip, this.instrument.underlyingSeg, this.expiry);
    }

    const strikes = call.data ? Object.keys(call.data.data?.oc ?? {}).length : 0;

    this.bus.push({
      id: requestId,
      at: new Date().toISOString(),
      key: this.key,
      instrument: this.instrument.id,
      expiry: this.expiry,
      endpoint: 'POST /v2/optionchain',
      ok: call.ok,
      httpStatus: call.httpStatus,
      errorCode: call.error?.code ?? null,
      bytes: call.bytes,
      strikes,
      timing: call.timing,
      replay: isReplay(),
    });

    if (!call.ok || !call.data) {
      this.failures++;
      const code = call.error?.code ?? 'UNKNOWN';
      const wait = code === 'DH-904' || code === 'NETWORK' || code === 'TIMEOUT'
        ? BACKOFF_MS[Math.min(this.failures - 1, BACKOFF_MS.length - 1)]!
        : IDLE_RECHECK_MS;
      this.setStatus({
        state: 'error', code,
        message: call.error?.message ?? 'request failed',
        explain: explain(code),
        retryInMs: wait,
      });
      this.schedule(wait);
      return;
    }

    this.failures = 0;
    const d = derive(call.data);

    const baseline = await this.baselines.get(this.key, d.atmIV);
    const prevClose = await underlyingPrevClose(this.instrument, this.creds);
    const spotChange = prevClose !== null ? d.spot - prevClose : null;

    // P7: enqueue whatever peaks this strike list still needs and read what is already cached.
    // Deliberately NOT awaited - the backfill spends its own 1 req/s budget in the background and
    // must never push this poll past its 3 s cadence.
    const strikeList = d.rows.map(r => r.strike);
    void this.peaks.track(this.instrument, this.expiry, strikeList, d.atmStrike).catch(() => { /* the column degrades to a dash */ });
    const pv = this.peaks.view(this.instrument, this.expiry, strikeList);

    const snapshot: Snapshot = {
      key: this.key,
      instrument: {
        id: this.instrument.id, label: this.instrument.label, displayName: this.instrument.displayName,
        underlyingScrip: scrip, underlyingSeg: this.instrument.underlyingSeg, lot: this.instrument.lot,
      },
      expiry: this.expiry,
      expiries: this.instrument.expiries,
      daysToExpiry: daysToExpiry(this.expiry),
      spot: d.spot,
      spotPrevClose: prevClose,
      spotChange,
      spotChangePct: spotChange !== null && prevClose ? (spotChange / prevClose) * 100 : null,
      atmStrike: d.atmStrike,
      atmIV: d.atmIV,
      ivChangePct: ivChangePct(d.atmIV, baseline),
      ivBaselineAt: baseline?.at ?? null,
      pcr: d.pcr,
      totals: d.totals,
      rows: d.rows,
      strikes: d.strikes,
      peakSessionDate: pv.sessionDate,
      peakNote: pv.note,
      peaks: pv.peaks,
      peakProgress: pv.progress,
      receivedAt: Date.now(),
      session,
      replay: isReplay(),
      requestId,
      timing: call.timing,
    };

    this.last = snapshot;
    this.setStatus(session.openNow ? { state: 'polling' } : { state: 'closed', since: session.reason });
    this.emit({ type: 'snapshot', data: snapshot });

    this.schedule(session.openNow ? CADENCE_MS : IDLE_RECHECK_MS);
  }
}

/* ------------------------------------------------------ underlying prev close */

/**
 * Previous close of the UNDERLYING, for the header's spot change. It does not move intraday,
 * so one call per instrument per day is enough. Dhan's OHLC `close` is the reference close for
 * the instrument; if it ever comes back equal to spot during a live session, this assumption
 * needs revisiting against a live token.
 */
const prevCloseCache = new Map<string, number | null>();

async function underlyingPrevClose(inst: ResolvedInstrument, creds: Credentials | null): Promise<number | null> {
  const id = `${todayIso()}|${inst.id}`;
  if (prevCloseCache.has(id)) return prevCloseCache.get(id)!;

  if (isReplay()) {
    const v = replayPrevClose(inst.id);
    prevCloseCache.set(id, v);
    return v;
  }
  if (!creds || inst.underlyingScrip === null) { prevCloseCache.set(id, null); return null; }

  type OhlcResponse = { data: Record<string, Record<string, { ohlc?: { close?: number } }>> };
  const call = await dhanPost<OhlcResponse>('/v2/marketfeed/ohlc',
    { [inst.underlyingSeg]: [inst.underlyingScrip] },
    { creds, key: `ohlc:${inst.id}`, cadenceMs: 1000 });

  /*
   * A FAILED call is not an answer. Caching its null under today's date makes one 10 s timeout at
   * 09:15 hide the header's spot change and change % for the entire session, even though every
   * chain poll afterwards succeeds - `prevCloseCache` is module-level and nothing invalidates it,
   * so only a restart clears it. Leave the key absent and let the next poll retry.
   */
  if (!call.ok) return null;

  const close = call.data?.data?.[inst.underlyingSeg]?.[String(inst.underlyingScrip)]?.ohlc?.close ?? null;
  const value = typeof close === 'number' && Number.isFinite(close) && close > 0 ? close : null;
  prevCloseCache.set(id, value);
  return value;
}

/* --------------------------------------------------------- baseline store */

class BaselineStore {
  private map: Record<string, Baseline> = {};
  private loaded = false;

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try { this.map = JSON.parse(await readFile(BASELINE_PATH, 'utf8')) as Record<string, Baseline>; }
    catch { this.map = {}; }
  }

  /** First successful ATM IV of the day for a key becomes that day's baseline, and persists. */
  async get(key: string, atmIV: number | null): Promise<Baseline | undefined> {
    await this.load();
    const id = `${todayIso()}|${key}`;
    if (this.map[id]) return this.map[id];
    if (atmIV === null) return undefined;
    const b: Baseline = { atmIV, at: new Date().toISOString() };
    this.map[id] = b;
    try {
      await mkdir(path.dirname(BASELINE_PATH), { recursive: true });
      await writeFile(BASELINE_PATH, JSON.stringify(this.map, null, 2));
    } catch { /* a missing baseline file is not worth failing a poll over */ }
    return b;
  }
}

/* ------------------------------------------------------------------- hub */

export class PollerHub {
  readonly bus = new TelemetryBus();
  private readonly pollers = new Map<string, ChainPoller>();
  private readonly baselines = new BaselineStore();
  private readonly peaks: PeakOiStore;

  private readonly creds: Credentials | null;

  constructor(creds: Credentials | null) {
    this.creds = creds;
    // One store for the whole process: the peak cache and its single 1 req/s slot are shared by
    // every instrument, and P8 will reuse the same fetcher for its OI baseline.
    this.peaks = new PeakOiStore(creds);
  }

  get(instrument: ResolvedInstrument, expiry: string): ChainPoller {
    const key = `${instrument.id}|${expiry}`;
    let p = this.pollers.get(key);
    if (!p) {
      p = new ChainPoller(instrument, expiry, this.creds, this.bus, this.baselines, this.peaks);
      this.pollers.set(key, p);
    }
    return p;
  }

  snapshotOf(key: string): Snapshot | null { return this.pollers.get(key)?.last ?? null; }
}

export type { ChainPoller };
