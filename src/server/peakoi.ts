/**
 * Peak-OI store - yesterday's high-water OI for each option contract.
 *
 * Dhan's option chain returns `previous_oi`, which is yesterday's CLOSING open interest. A strike
 * that built 4.2 L of OI at 13:45 and closed at 2.1 L therefore reads as half as busy as it was.
 * The peak is only obtainable from the candle endpoint, one contract at a time.
 *
 * Spec: docs/spec/peak-oi-v1.md. Rules that must not drift:
 *  - the peak is the max over the PREVIOUS session's candles only; today's are fetched in the
 *    same window and discarded (row 5)
 *  - every call shares ONE rate-gate key, because dhan.ts gates per key and a key per contract
 *    would fire all 82 at once (row 7)
 *  - a peak is a historical fact, so it is cached to disk and never re-fetched (row 8)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { dhanPost, type Credentials } from './dhan.ts';
import {
  optionContracts, optionInstrument, underlyingInstrument, todayIso,
  type OptionContract, type ResolvedInstrument,
} from './instruments.ts';
import { isReplay, replayIntraday, replaySessionDates } from './replay.ts';

const CACHE_PATH = path.resolve(process.cwd(), '.cache', 'peak-oi.json');

/** Row 7. One key for every peak call so the backfill is strictly serial at 1 req/s. */
const SLOT_KEY = 'peak:oi';
const CADENCE_MS = 1000;
/** Row 3. Finest interval the endpoint offers - a coarser one could smooth the peak away. */
const INTERVAL = '1';
/** Row 2. Enough to clear a two-day exchange holiday plus a weekend. */
const WINDOW_DAYS = 7;
/** Row 8. */
const PRUNE_DAYS = 7;
const MAX_ATTEMPTS = 3;

/* ------------------------------------------------------------------- types */

/**
 * The intraday response is parallel arrays. Dhan documents them at the top level; some v2
 * endpoints wrap in `data`, so the reader accepts either. UNVERIFIED against a live plan -
 * see the risk row in the spec.
 */
export type Candles = {
  open?: number[];
  high?: number[];
  low?: number[];
  close?: number[];
  volume?: number[];
  timestamp?: number[];
  open_interest?: number[];
};

export type PeakEntry = {
  /** max(open_interest) over the previous session. */
  peak: number;
  /** IST HH:MM of the candle that held it. */
  at: string;
  /** How many candles of that session were seen. Hand-check aid, and a liquidity hint. */
  candles: number;
};

/** What one grid cell needs. Exactly one of `peak` / `why` is ever set. */
export type PeakCell = { peak: number | null; at: string | null; why: string | null };

export type PeakView = {
  sessionDate: string | null;
  /** Why there is no session date yet. Null once one is known - the two states read differently. */
  note: string | null;
  /** Keyed by strike, as the strike appears in the snapshot's rows. */
  peaks: Record<string, { ce: PeakCell; pe: PeakCell }>;
  progress: { done: number; total: number; skipped: number };
};

type Job = {
  cacheKey: string;
  sessionDate: string;
  securityId: number;
  seg: string;
  instrument: string;
  instrumentId: string;
  strike: number;
  side: 'ce' | 'pe';
  attempts: number;
};

const PENDING: PeakCell = { peak: null, at: null, why: 'not fetched yet' };

/* --------------------------------------------------------------- IST clock */

/**
 * India has no DST, so a fixed +05:30 is exact. Dhan documents epoch SECONDS; a millisecond
 * value would be ~1e12, so the normalisation below keeps a shape change from silently
 * bucketing every candle into 1970.
 */
function istParts(ts: number): { date: string; time: string } | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null;
  const ms = (ts > 1e11 ? ts : ts * 1000) + 5.5 * 3600 * 1000;
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function istToday(): string { return todayIso(); }

function isoDaysAgo(days: number): string {
  const ms = Date.now() + 5.5 * 3600 * 1000 - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------- the parser */

/** Row 5. The one place a peak is computed, shared by the live and the replay path. */
export function peakFrom(c: Candles | null | undefined, sessionDate: string): PeakEntry | null {
  const oi = c?.open_interest;
  const ts = c?.timestamp;
  if (!Array.isArray(oi) || !Array.isArray(ts)) return null;

  let peak = -1;
  let at = '';
  let candles = 0;
  const n = Math.min(oi.length, ts.length);
  for (let i = 0; i < n; i++) {
    const p = istParts(ts[i]!);
    if (!p || p.date !== sessionDate) continue;      // today's candles never count
    candles++;
    const v = oi[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (v > peak) { peak = v; at = p.time; }
  }
  if (peak < 0) return null;
  return { peak, at, candles };
}

/** The IST dates present in a candle payload, newest last. */
function datesIn(c: Candles | null | undefined): string[] {
  const ts = c?.timestamp;
  if (!Array.isArray(ts)) return [];
  const set = new Set<string>();
  for (const t of ts) {
    const p = istParts(t);
    if (p) set.add(p.date);
  }
  return [...set].sort();
}

/* ---------------------------------------------------------------- the store */

export class PeakOiStore {
  /** `${sessionDate}|${securityId}` -> entry. Persisted; a peak cannot change after the fact. */
  private cache: Record<string, PeakEntry> = {};
  /** Same key -> why there is no peak. Memory only: a failure today may succeed tomorrow. */
  private readonly failed = new Map<string, string>();
  /** `${today}|${instrumentId}` -> previous trading session, or null once proven unavailable. */
  private readonly calendar = new Map<string, string | null>();
  private readonly calendarPending = new Set<string>();
  /** `${instrumentId}|${expiry}` -> contracts. optionContracts() scans 185k master rows. */
  private readonly contracts = new Map<string, Map<string, OptionContract>>();

  private readonly queue: Job[] = [];
  private readonly queued = new Set<string>();
  private draining = false;
  private loaded = false;
  private saveTimer: NodeJS.Timeout | null = null;

  /**
   * Fired as contracts land. Without it the column would never fill on a closed market: the
   * poller stops emitting after its one snapshot, so nothing would carry the peaks to the screen.
   */
  private readonly listeners = new Set<() => void>();

  private readonly creds: Credentials | null;

  constructor(creds: Credentials | null) { this.creds = creds; }

  onProgress(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /* ------------------------------------------------------------ persistence */

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as Record<string, PeakEntry>;
      const cutoff = isoDaysAgo(PRUNE_DAYS);
      for (const [k, v] of Object.entries(raw)) {
        // Key is `${date}|${securityId}`: anything older than the window is dead weight.
        if ((k.split('|')[0] ?? '') >= cutoff) this.cache[k] = v;
      }
    } catch { this.cache = {}; }
  }

  /** Debounced: a cold backfill writes 82 entries and does not need 82 disk writes. */
  private save() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void (async () => {
        try {
          await mkdir(path.dirname(CACHE_PATH), { recursive: true });
          await writeFile(CACHE_PATH, JSON.stringify(this.cache, null, 2));
        } catch { /* a missing cache file is not worth failing a poll over */ }
      })();
    }, 2000);
  }

  /* -------------------------------------------------------------- contracts */

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

  /* --------------------------------------------------------------- calendar */

  /**
   * Row 1/2. The previous trading session, read off the data rather than off a calendar:
   * the latest IST date strictly before today that actually has candles.
   */
  private async previousSession(inst: ResolvedInstrument, expiry: string): Promise<string | null> {
    const key = `${istToday()}|${inst.id}`;
    if (this.calendar.has(key)) return this.calendar.get(key)!;
    if (this.calendarPending.has(key)) return null;
    this.calendarPending.add(key);

    const today = istToday();
    const from = isoDaysAgo(WINDOW_DAYS);
    let dates: string[] = [];

    if (isReplay()) {
      dates = replaySessionDates(today, WINDOW_DAYS);
    } else {
      // The underlying: one call per instrument per day, and the trading calendar is identical
      // for every contract on the same exchange.
      const und = underlyingInstrument(inst.id);
      if (this.creds && inst.underlyingScrip !== null && und) {
        const c = await this.fetchCandles(String(inst.underlyingScrip), inst.underlyingSeg, und, from, today, false);
        dates = datesIn(c.candles);
      }
      // Fallback (row 2): the same window on the first contract we know about.
      if (!dates.length && this.creds) {
        const first = [...this.contractsFor(inst, expiry).values()][0];
        const optInst = optionInstrument(inst.id);
        if (first && optInst) {
          const c = await this.fetchCandles(String(first.securityId), first.seg, optInst, from, today, true);
          dates = datesIn(c.candles);
        }
      }
    }

    const prev = dates.filter(d => d < today).pop() ?? null;
    this.calendar.set(key, prev);
    this.calendarPending.delete(key);
    return prev;
  }

  /* ------------------------------------------------------------------ fetch */

  private async fetchCandles(
    securityId: string, seg: string, instrument: string,
    fromDate: string, toDate: string, oi: boolean,
  ): Promise<{ candles: Candles | null; why: string | null; retryable: boolean }> {
    if (!this.creds) return { candles: null, why: 'no credentials', retryable: false };

    const call = await dhanPost<unknown>('/v2/charts/intraday', {
      securityId, exchangeSegment: seg, instrument,
      interval: INTERVAL, oi,
      fromDate, toDate,
    }, { creds: this.creds, key: SLOT_KEY, cadenceMs: CADENCE_MS, timeoutMs: 20_000 });

    if (!call.ok) {
      return {
        candles: null,
        why: `request failed (${call.error?.code ?? 'UNKNOWN'})`,
        retryable: call.error?.retryable ?? false,
      };
    }
    // Dhan wraps some v2 responses in `data` and returns others flat. Accept both rather than
    // guessing - the arrays are the contract, not the envelope.
    const raw = call.data as Record<string, unknown> | null;
    const body = (raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw) as Candles | null;
    return { candles: body, why: null, retryable: false };
  }

  /* -------------------------------------------------------------- the queue */

  /**
   * Row 6/9. Non-blocking: enqueue whatever this snapshot's strikes still need, ATM-outward,
   * and let the drain loop spend the rate limit. Never awaited by the poller.
   */
  async track(inst: ResolvedInstrument, expiry: string, strikes: number[], atmStrike: number | null): Promise<void> {
    await this.load();
    const sessionDate = await this.previousSession(inst, expiry);
    if (!sessionDate) return;

    const contracts = this.contractsFor(inst, expiry);
    const optInst = optionInstrument(inst.id);
    if (!optInst) return;

    const atm = atmStrike ?? strikes[Math.floor(strikes.length / 2)] ?? 0;
    const ordered = [...strikes].sort((a, b) => Math.abs(a - atm) - Math.abs(b - atm));

    for (const strike of ordered) {
      for (const side of ['ce', 'pe'] as const) {
        const c = contracts.get(`${strike}|${side.toUpperCase()}`);
        if (!c) continue;
        const cacheKey = `${sessionDate}|${c.securityId}`;
        if (this.cache[cacheKey] || this.failed.has(cacheKey) || this.queued.has(cacheKey)) continue;
        this.queued.add(cacheKey);
        this.queue.push({
          cacheKey, sessionDate, securityId: c.securityId, seg: c.seg, instrument: optInst,
          instrumentId: inst.id, strike, side, attempts: 0,
        });
      }
    }

    // Fire even when nothing was enqueued: on a warm cache the calendar has only just resolved,
    // and the poll that called us read `view()` before it did.
    for (const l of this.listeners) l();
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        job.attempts++;

        let candles: Candles | null = null;
        let why: string | null = null;
        let retryable = false;

        if (isReplay()) {
          // Live, `dhanPost`'s shared slot key spaces these at 1 req/s. Replay has no transport,
          // so without a delay the whole backfill would land inside one tick and the progressive
          // fill - the thing the progress chip exists for - could never be seen or tested.
          await new Promise(r => setTimeout(r, 60));
          candles = replayIntraday(job.instrumentId, job.strike, job.side, job.sessionDate, istToday());
        } else {
          const out = await this.fetchCandles(
            String(job.securityId), job.seg, job.instrument, job.sessionDate, istToday(), true);
          candles = out.candles; why = out.why; retryable = out.retryable;
        }

        if (retryable && job.attempts < MAX_ATTEMPTS) {
          this.queue.push(job);                    // tail, so one dead contract cannot block the rest
          continue;
        }

        const entry = peakFrom(candles, job.sessionDate);
        if (entry) {
          this.cache[job.cacheKey] = entry;
          this.save();
        } else {
          this.failed.set(job.cacheKey, why ?? `no candles for ${job.sessionDate}`);
        }
        this.queued.delete(job.cacheKey);
        for (const l of this.listeners) l();
      }
    } finally {
      this.draining = false;
    }
  }

  /* ------------------------------------------------------------------- read */

  /** Synchronous by design: the 3 s poll must never wait on the backfill. */
  view(inst: ResolvedInstrument, expiry: string, strikes: number[]): PeakView {
    const calKey = `${istToday()}|${inst.id}`;
    const sessionDate = this.calendar.get(calKey) ?? null;
    const peaks: PeakView['peaks'] = {};
    let done = 0, skipped = 0, total = 0;

    if (!sessionDate) {
      // "Not looked up yet" and "looked up, and there is none" are different screens.
      const note = this.calendar.has(calKey)
        ? 'no earlier trading day in the last 7 days of candles'
        : 'resolving the previous trading session';
      for (const s of strikes) peaks[s] = { ce: { ...PENDING }, pe: { ...PENDING } };
      return { sessionDate: null, note, peaks, progress: { done: 0, total: 0, skipped: 0 } };
    }

    const contracts = this.contractsFor(inst, expiry);
    for (const strike of strikes) {
      const cell = { ce: { ...PENDING }, pe: { ...PENDING } };
      for (const side of ['ce', 'pe'] as const) {
        const c = contracts.get(`${strike}|${side.toUpperCase()}`);
        if (!c) { cell[side] = { peak: null, at: null, why: 'no contract in the master' }; continue; }
        total++;
        const key = `${sessionDate}|${c.securityId}`;
        const hit = this.cache[key];
        if (hit) { cell[side] = { peak: hit.peak, at: hit.at, why: null }; done++; continue; }
        const bad = this.failed.get(key);
        if (bad) { cell[side] = { peak: null, at: null, why: bad }; skipped++; }
      }
      peaks[strike] = cell;
    }

    return { sessionDate, note: null, peaks, progress: { done, total, skipped } };
  }
}
