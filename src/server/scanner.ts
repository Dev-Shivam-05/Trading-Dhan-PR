/**
 * P8 - the 9:20 F&O scanner.
 *
 * Spec: docs/spec/scanner-v1.md. One manually triggered pass over the 210-stock NSE F&O universe:
 *
 *     210 stocks -> top 50 gainers + top 50 losers -> |LTP change| >= 2% -> |OI change| >= 7%
 *
 * Rules that must not drift:
 *  - the universe is read from the instrument master, never hardcoded, and the 18 dummy NSETEST
 *    scrips are dropped (rows 1, 2)
 *  - equities carry no open interest, so the OI leg is each stock's near-month FUTSTK contract,
 *    quoted in the SAME request as the cash leg (rows 3, 4)
 *  - both percentages are absolute: direction is carried by the long/short split, and a
 *    positive-only filter would silently discard half the signal (rows 5, 6)
 *  - every call in a fan-out shares ONE rate-gate key. dhanPost gates per key, so a key per stock
 *    would dispatch all 100 baseline calls simultaneously (rows 4, 8)
 *  - a stock that cannot be scored is listed with its reason, never quietly dropped (row 14)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { dhanPost, type Credentials } from './dhan.ts';
import { fnoUniverse, sessionState, todayIso, type FnoStock } from './instruments.ts';
import { fetchIntraday, closingOiOn, previousSessionIn, type Candles } from './peakoi.ts';
import {
  isReplay, replayScanPlan, replayFuturesCandles, replaySessionDates, type ReplayScanPlan,
} from './replay.ts';

const CACHE_PATH = path.resolve(process.cwd(), '.cache', 'scan-oi.json');

/** Row 4. One key, so the 420-instrument quote never races anything else. */
const QUOTE_KEY = 'scan:quote';
/** Row 8. One key for the whole baseline fan-out - at most 100 calls, strictly serial at 1/s. */
const OI_KEY = 'scan:oi';
const CADENCE_MS = 1000;

/** Row 1. Top 50 of each side, taken from the user's own worked example. */
const SIDE_N = 50;
/** Row 5. */
const CHG_MIN = 2.0;
/** Row 6. */
const OI_MIN = 7.0;
/** Row 7. Coarser than P7's 1-minute because only the session's LAST candle is read. */
const OI_INTERVAL = '5';
/** Enough to clear a two-day exchange holiday plus a weekend. */
const WINDOW_DAYS = 7;
const PRUNE_DAYS = 7;

/**
 * Replay has no transport, so without a delay the whole baseline fan-out lands inside one tick
 * and the progress the panel exists to show could never be seen or tested. Live, dhanPost's
 * shared slot key spaces these at 1 req/s instead.
 */
const REPLAY_CALL_MS = 40;

/* ------------------------------------------------------------------- types */

export type ScanRow = {
  symbol: string;
  name: string;
  ltp: number;
  prevClose: number;
  chgPct: number;
  volume: number | null;
  /** Near-month futures OI now. */
  oi: number;
  /** Previous session's closing futures OI. */
  baselineOi: number;
  oiPct: number;
  futureExpiry: string | null;
  lot: number | null;
};

export type ScanSkip = { symbol: string; name: string; reason: string };

export type ScanFunnel = {
  universe: number;
  /** Stocks that produced a usable quote. */
  scored: number;
  /** Survivors of filter 1 - top 50 gainers + top 50 losers. */
  ranked: number;
  /** Survivors of filter 2 - |chgPct| >= 2. */
  chg: number;
  /** Survivors of filter 3 - |oiPct| >= 7. The answer. */
  oi: number;
};

export type ScanResult = {
  at: string;
  mode: 'live' | 'replay';
  sessionOpen: boolean;
  /** The previous trading session the OI baseline was read from. */
  baselineDate: string | null;
  funnel: ScanFunnel;
  long: ScanRow[];
  short: ScanRow[];
  skipped: ScanSkip[];
  /** Stocks that were scored and failed a filter. */
  rejected: number;
  /** AC4: skipped + survivors + rejected must equal the universe. */
  reconciles: boolean;
  elapsedMs: number;
  calls: { quote: number; oi: number; cached: number };
  error: string | null;
};

export type ScanProgress = {
  running: boolean;
  stage: 'idle' | 'universe' | 'quote' | 'baseline' | 'done' | 'failed';
  done: number;
  total: number;
  elapsedMs: number;
};

type QuoteLeg = {
  last_price?: number;
  net_change?: number;
  volume?: number;
  oi?: number;
  ohlc?: { close?: number };
};
type QuoteBody = Record<string, Record<string, QuoteLeg>>;

/* ------------------------------------------------------------ the scanner */

export class Scanner {
  private readonly creds: Credentials | null;
  /** `${sessionDate}|${securityId}` -> that session's closing futures OI. A historical fact. */
  private baselines: Record<string, number> = {};
  private loaded = false;
  private inFlight: Promise<ScanResult> | null = null;
  private startedAt = 0;
  private stage: ScanProgress['stage'] = 'idle';
  private done = 0;
  private total = 0;

  last: ScanResult | null = null;

  constructor(creds: Credentials | null) { this.creds = creds; }

  get progress(): ScanProgress {
    return {
      running: this.inFlight !== null,
      stage: this.stage,
      done: this.done,
      total: this.total,
      elapsedMs: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }

  /** Pressing Scan twice must not fire two fan-outs at the rate limit. */
  run(): Promise<ScanResult> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.scan().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  /* --------------------------------------------------------- baseline cache */

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as Record<string, number>;
      const cutoff = isoDaysAgo(PRUNE_DAYS);
      for (const [k, v] of Object.entries(raw)) {
        // Key is `${date}|${securityId}`: anything older than the window is dead weight.
        if ((k.split('|')[0] ?? '') >= cutoff) this.baselines[k] = v;
      }
    } catch { this.baselines = {}; }
  }

  private async save() {
    try {
      await mkdir(path.dirname(CACHE_PATH), { recursive: true });
      await writeFile(CACHE_PATH, JSON.stringify(this.baselines, null, 2));
    } catch { /* the cache is an optimisation; failing to write it must not fail the scan */ }
  }

  /* ------------------------------------------------------------------ scan */

  private async scan(): Promise<ScanResult> {
    this.startedAt = Date.now();
    this.stage = 'universe';
    this.done = 0;
    this.total = 0;
    await this.load();

    const today = todayIso();
    const mode = isReplay() ? 'replay' : 'live';
    const session = sessionState('NSE_BSE_FNO');
    const universe = fnoUniverse(today);
    const skipped: ScanSkip[] = [];
    const calls = { quote: 0, oi: 0, cached: 0 };

    const fail = (error: string): ScanResult => {
      this.stage = 'failed';
      const r: ScanResult = {
        at: new Date().toISOString(), mode, sessionOpen: session.openNow, baselineDate: null,
        funnel: { universe: universe.length, scored: 0, ranked: 0, chg: 0, oi: 0 },
        long: [], short: [], skipped, rejected: 0, reconciles: false,
        elapsedMs: Date.now() - this.startedAt, calls, error,
      };
      this.last = r;
      return r;
    };

    if (!universe.length) return fail('the instrument master has no NSE F&O stocks');
    if (!isReplay() && !this.creds) return fail('no Dhan credentials in .env');

    // Row 14: a stock the master cannot describe is skipped with its reason, before any call.
    const quotable = universe.filter(s => {
      if (s.problem || !s.futureId || !s.equityId) {
        skipped.push({ symbol: s.symbol, name: s.name, reason: s.problem ?? 'incomplete master rows' });
        return false;
      }
      return true;
    });

    /* ---- step 1: one quote call carrying both legs of every stock (row 4) ---- */

    this.stage = 'quote';
    const plan = isReplay() ? replayScanPlan(quotable.map(s => s.symbol)) : null;
    let eq: Record<string, QuoteLeg> = {};
    let fno: Record<string, QuoteLeg> = {};

    if (plan) {
      ({ eq, fno } = replayQuoteBody(quotable, plan));
    } else {
      const body = {
        NSE_EQ: quotable.map(s => s.equityId),
        NSE_FNO: quotable.map(s => s.futureId!),
      };
      const call = await dhanPost<unknown>('/v2/marketfeed/quote', body,
        { creds: this.creds!, key: QUOTE_KEY, cadenceMs: CADENCE_MS, timeoutMs: 20_000 });
      calls.quote = 1;
      if (!call.ok) {
        return fail(`quote request failed (${call.error?.code ?? 'UNKNOWN'}): ${call.error?.message ?? ''}`);
      }
      // Dhan returns some v2 bodies wrapped in `data` and others flat. Accept both.
      const raw = call.data as Record<string, unknown> | null;
      const b = ((raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw) ?? {}) as QuoteBody;
      eq = b.NSE_EQ ?? {};
      fno = b.NSE_FNO ?? {};
    }

    /* ---- score every stock against its previous close (row 5) ---- */

    type Scored = FnoStock & {
      ltp: number; prevClose: number; chgPct: number; volume: number | null; oi: number;
    };
    const scored: Scored[] = [];

    for (const s of quotable) {
      const cash = eq[String(s.equityId)];
      const fut = fno[String(s.futureId)];
      if (!cash || typeof cash.last_price !== 'number' || !Number.isFinite(cash.last_price)) {
        skipped.push({ symbol: s.symbol, name: s.name, reason: 'no quote' });
        continue;
      }
      // Row 5 locks prevClose = last_price - net_change. `ohlc.close` is the same number by a
      // different route; it is a fallback only so a missing net_change reads as "cannot score"
      // rather than as a silent 0.00% change.
      const net = cash.net_change;
      const prevClose = typeof net === 'number' && Number.isFinite(net)
        ? cash.last_price - net
        : (typeof cash.ohlc?.close === 'number' && cash.ohlc.close > 0 ? cash.ohlc.close : NaN);
      if (!Number.isFinite(prevClose) || prevClose <= 0) {
        skipped.push({ symbol: s.symbol, name: s.name, reason: 'no previous close' });
        continue;
      }
      const oi = fut?.oi;
      if (typeof oi !== 'number' || !Number.isFinite(oi) || oi <= 0) {
        skipped.push({ symbol: s.symbol, name: s.name, reason: 'no futures open interest' });
        continue;
      }
      scored.push({
        ...s,
        ltp: cash.last_price,
        prevClose,
        chgPct: ((cash.last_price - prevClose) / prevClose) * 100,
        volume: typeof cash.volume === 'number' ? cash.volume : null,
        oi,
      });
    }

    /* ---- filter 1: top 50 gainers + top 50 losers of the universe itself (row 1) ---- */

    const byChg = [...scored].sort((a, b) => b.chgPct - a.chgPct);
    // A Set, because with fewer than 100 scorable stocks the two slices overlap and the same
    // stock would be counted - and printed - twice.
    const ranked = [...new Set([...byChg.slice(0, SIDE_N), ...byChg.slice(-SIDE_N)])];

    /* ---- filter 2: |LTP change| >= 2% (row 5) ---- */

    const passedChg = ranked.filter(s => Math.abs(s.chgPct) >= CHG_MIN);

    /* ---- filter 3: |OI change| >= 7% against the previous session's close (rows 7, 8) ---- */

    this.stage = 'baseline';
    this.total = passedChg.length;

    const baselineDate = await this.previousSession(passedChg, today);

    const survivors: ScanRow[] = [];
    let skippedBaseline = 0;

    for (const s of passedChg) {
      let base: number | undefined;

      if (baselineDate) {
        const key = `${baselineDate}|${s.futureId}`;
        base = this.baselines[key];
        if (base === undefined) {
          const candles = await this.candlesFor(s, baselineDate, today, plan);
          calls.oi++;
          const closing = closingOiOn(candles, baselineDate);
          if (closing !== null && closing > 0) { base = closing; this.baselines[key] = closing; }
        } else {
          calls.cached++;
        }
      }
      this.done++;

      if (base === undefined) {
        skipped.push({ symbol: s.symbol, name: s.name, reason: 'no OI baseline' });
        skippedBaseline++;
        continue;
      }

      const oiPct = ((s.oi - base) / base) * 100;
      if (Math.abs(oiPct) < OI_MIN) continue;

      survivors.push({
        symbol: s.symbol, name: s.name, ltp: s.ltp, prevClose: s.prevClose, chgPct: s.chgPct,
        volume: s.volume, oi: s.oi, baselineOi: base, oiPct,
        futureExpiry: s.futureExpiry, lot: s.lot,
      });
    }

    await this.save();

    /* ---- the funnel has to add up (row 14 / AC4) ---- */

    const byAbsChg = (a: ScanRow, b: ScanRow) => Math.abs(b.chgPct) - Math.abs(a.chgPct);
    const long = survivors.filter(r => r.chgPct > 0).sort(byAbsChg);
    const short = survivors.filter(r => r.chgPct < 0).sort(byAbsChg);

    const rejected =
      (scored.length - ranked.length) +                        // failed filter 1
      (ranked.length - passedChg.length) +                     // failed filter 2
      (passedChg.length - skippedBaseline - survivors.length); // failed filter 3

    this.stage = 'done';
    const result: ScanResult = {
      at: new Date().toISOString(),
      mode,
      sessionOpen: session.openNow,
      baselineDate,
      funnel: {
        universe: universe.length,
        scored: scored.length,
        ranked: ranked.length,
        chg: passedChg.length,
        oi: survivors.length,
      },
      long,
      short,
      skipped: skipped.sort((a, b) => a.symbol.localeCompare(b.symbol)),
      rejected,
      reconciles: skipped.length + survivors.length + rejected === universe.length,
      elapsedMs: Date.now() - this.startedAt,
      calls,
      error: null,
    };
    this.last = result;
    return result;
  }

  /* --------------------------------------------------- the previous session */

  /**
   * Read off the candle data, never off a calendar: the latest IST date before today that
   * actually has candles. `today - 1` is wrong every Monday and every exchange holiday, and a
   * hardcoded holiday table is wrong the first time the exchange moves one. Same rule as P7,
   * and one probe call settles it for every stock because the calendar belongs to the exchange.
   */
  private async previousSession(
    stocks: { futureId: number | null }[], today: string,
  ): Promise<string | null> {
    if (isReplay()) {
      return replaySessionDates(today, WINDOW_DAYS).filter(d => d < today).pop() ?? null;
    }
    const probe = stocks.find(s => s.futureId);
    if (!probe || !this.creds) return null;
    const out = await fetchIntraday(this.creds, {
      securityId: String(probe.futureId), seg: 'NSE_FNO', instrument: 'FUTSTK',
      interval: OI_INTERVAL, oi: true,
      fromDate: isoDaysAgo(WINDOW_DAYS), toDate: today,
      key: OI_KEY, cadenceMs: CADENCE_MS,
    });
    return previousSessionIn(out.candles, today);
  }

  private async candlesFor(
    s: { symbol: string; futureId: number | null }, sessionDate: string, today: string,
    plan: ReplayScanPlan | null,
  ): Promise<Candles | null> {
    if (plan) {
      await new Promise(r => setTimeout(r, REPLAY_CALL_MS));
      return replayFuturesCandles(plan, s.symbol, sessionDate, today);
    }
    const out = await fetchIntraday(this.creds, {
      securityId: String(s.futureId), seg: 'NSE_FNO', instrument: 'FUTSTK',
      interval: OI_INTERVAL, oi: true,
      // The window deliberately includes today. `closingOiOn` filters by date, so a reader that
      // ever stops doing so reports every stock at 0% and the scan returns nothing - loudly.
      fromDate: sessionDate, toDate: today,
      key: OI_KEY, cadenceMs: CADENCE_MS,
    });
    return out.candles;
  }
}

/* ---------------------------------------------------------------- helpers */

function isoDaysAgo(days: number): string {
  const ms = Date.now() + 5.5 * 3600 * 1000 - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The replay universe in the exact shape `/v2/marketfeed/quote` returns, so the scoring code
 * above cannot tell the two modes apart. Row 15.
 */
function replayQuoteBody(
  stocks: FnoStock[], plan: ReplayScanPlan,
): { eq: Record<string, QuoteLeg>; fno: Record<string, QuoteLeg> } {
  const eq: Record<string, QuoteLeg> = {};
  const fno: Record<string, QuoteLeg> = {};
  for (const s of stocks) {
    const q = plan.get(s.symbol);
    if (!q || q.hide === 'quote') continue;      // a stock Dhan simply did not return
    eq[String(s.equityId)] = {
      last_price: q.ltp,
      net_change: q.netChange,
      volume: q.volume,
      ohlc: { close: Math.round((q.ltp - q.netChange) * 100) / 100 },
    };
    fno[String(s.futureId)] = { last_price: q.ltp, net_change: q.netChange, oi: q.futOi };
  }
  return { eq, fno };
}

/** CSV of one result, for the panel's export button (row 11). */
export function scanCsv(r: ScanResult): string {
  const head = 'side,symbol,name,ltp,prevClose,chgPct,volume,oi,baselineOi,oiPct,futureExpiry,lot';
  const rows = [
    ...r.long.map(x => ['long', x] as const),
    ...r.short.map(x => ['short', x] as const),
  ].map(([side, x]) => [
    side, x.symbol, `"${x.name.replace(/"/g, '""')}"`, x.ltp.toFixed(2), x.prevClose.toFixed(2),
    x.chgPct.toFixed(2), x.volume ?? '', x.oi, x.baselineOi, x.oiPct.toFixed(2),
    x.futureExpiry ?? '', x.lot ?? '',
  ].join(','));
  const funnel =
    `# funnel ${r.funnel.universe} -> ${r.funnel.ranked} -> ${r.funnel.chg} -> ${r.funnel.oi}` +
    `; skipped ${r.skipped.length}; rejected ${r.rejected}; baseline ${r.baselineDate ?? 'none'}` +
    `; mode ${r.mode}`;
  return [funnel, head, ...rows].join('\n');
}
