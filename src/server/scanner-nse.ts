/**
 * P14 - the 9:20 F&O scanner, on NSE's own numbers.
 *
 * Spec: docs/spec/scanner-nse-v1.md.
 *
 *     your F&O list -> top N gainers + top N losers -> |chg| >= 2% -> OI Spurts OI chg >= +7%
 *
 * Rules that must not drift:
 *  - only symbols in data/fno-list.txt are ranked; NSE rows outside it are named, and list
 *    symbols NSE did not send are skipped with a reason (rows 2, 3)
 *  - N is 20, 25 or 30 and a side is exactly N - ties at the cut break by symbol A-Z (row 2)
 *  - the OI filter is rising OI only, `>= 7`, unlike P8's absolute rule (row 5)
 *  - prices and OI from different trading days fail the scan instead of mixing (row 10)
 *  - every rejection is counted where it happens, and the total is compared against the list
 *    size read separately - never against a number derived from the same counts (row 13)
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchNseBundle, type NseBundle, type NseStage } from './nse.ts';

const LIST_PATH = path.resolve(process.cwd(), 'data', 'fno-list.txt');

export const TOP_N_CHOICES = [20, 25, 30] as const;
export type TopN = typeof TOP_N_CHOICES[number];
export const DEFAULT_TOP_N: TopN = 20;
/** Row 4. */
export const CHG_MIN = 2.0;
/** Row 5. */
export const OI_MIN = 7.0;

/* ------------------------------------------------------------------- types */

export type NseScanRow = {
  symbol: string;
  name: string;
  ltp: number;
  prevClose: number;
  chgPct: number;
  volume: number | null;
  latestOi: number;
  prevOi: number;
  oiPct: number;
};

export type NseNamed = { symbol: string; name: string; reason: string };

/**
 * P15: why each ranked stock did or did not make the list. Only the daily log reads it - the panel
 * does not - so a morning's result can be audited after the fact without re-fetching NSE.
 */
export type NseTrace = {
  symbol: string;
  side: 'gainer' | 'loser' | 'both';
  chgPct: number;
  oiPct: number | null;
  outcome: 'pass' | 'chg below 2%' | 'OI chg below 7%' | string;
};

export type NseScanResult = {
  source: 'nse';
  mode: 'live' | 'fixture';
  at: string;
  n: TopN;
  /** True when this result re-ranked the previous fetch instead of loading NSE again (row 15). */
  reused: boolean;
  market: {
    status: string;
    priceAsOf: string;
    oiAsOf: string;
    tradeDate: string | null;
    prevTradingDate: string | null;
  };
  funnel: {
    /** Symbols in the user's F&O list. */
    list: number;
    /** Stocks with a usable NSE price row. */
    scored: number;
    /** Survivors of step 1 - top N gainers + top N losers. */
    ranked: number;
    /** Survivors of step 2 - |chg| >= 2%. */
    chg: number;
    /** Survivors of step 3 - OI chg >= +7%. The answer. */
    oi: number;
  };
  long: NseScanRow[];
  short: NseScanRow[];
  /** List symbols that could not be carried through a step, each with its reason. */
  skipped: NseNamed[];
  /** NSE F&O-feed rows that are not in the user's list. Never ranked. */
  excluded: NseNamed[];
  rejected: { rank: number; chg: number; oi: number };
  trace: NseTrace[];
  reconciles: boolean;
  elapsedMs: number;
  evidence: string[];
  error: string | null;
};

export type NseScanProgress = {
  running: boolean;
  stage: 'idle' | NseStage | 'funnel' | 'done' | 'failed';
  elapsedMs: number;
};

/* ------------------------------------------------------------ the F&O list */

/**
 * `data/fno-list.txt`: a header line, then `No.<TAB>UNDERLYING<TAB>SYMBOL` rows - the file the
 * user supplied, unchanged. A malformed line is an error, not something to guess around.
 */
export function parseFnoList(text: string): { symbols: string[]; names: Map<string, string>; rows: number } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const body = lines.slice(1);
  const names = new Map<string, string>();
  for (const [i, line] of body.entries()) {
    const cols = line.split('\t');
    const symbol = cols[2]?.trim() ?? '';
    if (cols.length !== 3 || !/^[A-Z0-9&-]{1,20}$/.test(symbol)) {
      throw new Error(`data/fno-list.txt line ${i + 2} is not "No.<TAB>UNDERLYING<TAB>SYMBOL"`);
    }
    if (names.has(symbol)) throw new Error(`data/fno-list.txt lists ${symbol} twice`);
    names.set(symbol, cols[1]!.trim());
  }
  return { symbols: [...names.keys()], names, rows: body.length };
}

/* -------------------------------------------------------------- the funnel */

/** Pure: the whole scan from one fetch. Exported so a second implementation can be compared. */
export function nseFunnel(
  bundle: NseBundle, list: { symbols: string[]; names: Map<string, string>; rows: number },
  n: TopN, startedAt = Date.now(),
): NseScanResult {
  const listSet = new Set(list.symbols);
  const skipped: NseNamed[] = [];
  const excluded: NseNamed[] = [];
  const nameOf = (s: string) => list.names.get(s) ?? s;

  const base = {
    source: 'nse' as const,
    mode: bundle.mode,
    at: new Date().toISOString(),
    n,
    reused: false,
    market: {
      status: bundle.price.marketStatus,
      priceAsOf: bundle.price.timestamp,
      oiAsOf: bundle.oi.timestamp,
      tradeDate: bundle.oi.currTradingDate,
      prevTradingDate: bundle.oi.prevTradingDate,
    },
    evidence: bundle.evidence,
  };

  // Row 10. Both dates must exist and agree, or the lists would mix two sessions.
  if (!bundle.price.date || !bundle.oi.currTradingDate || bundle.price.date !== bundle.oi.currTradingDate) {
    return {
      ...base,
      funnel: { list: list.symbols.length, scored: 0, ranked: 0, chg: 0, oi: 0 },
      long: [], short: [], skipped, excluded,
      rejected: { rank: 0, chg: 0, oi: 0 },
      trace: [],
      reconciles: false,
      elapsedMs: Date.now() - startedAt,
      error: `NSE's price feed is dated ${bundle.price.date ?? 'unknown'} (${bundle.price.timestamp || 'no timestamp'}) ` +
        `but OI Spurts is dated ${bundle.oi.currTradingDate ?? 'unknown'} — refusing to mix two trading days`,
    };
  }

  /* ---- row 3: cross-verify NSE's F&O feed against the user's list ---- */

  const price = new Map(bundle.price.rows.map(r => [r.symbol, r]));
  const priceInvalid = new Map(bundle.price.invalid.map(r => [r.symbol, r.reason]));

  for (const r of bundle.price.rows) {
    if (!listSet.has(r.symbol)) excluded.push({ symbol: r.symbol, name: r.name, reason: 'in NSE’s F&O feed, not in your list' });
  }
  for (const r of bundle.price.invalid) {
    if (!listSet.has(r.symbol)) excluded.push({ symbol: r.symbol, name: r.symbol, reason: r.reason });
  }

  const scorable = [];
  for (const symbol of list.symbols) {
    const row = price.get(symbol);
    if (row) { scorable.push(row); continue; }
    skipped.push({ symbol, name: nameOf(symbol), reason: priceInvalid.get(symbol) ?? 'not in NSE’s F&O feed' });
  }

  /* ---- step 1: top N gainers + top N losers (row 2) ---- */

  const bySymbol = (a: { symbol: string }, b: { symbol: string }) => a.symbol.localeCompare(b.symbol);
  const gainers = [...scorable].sort((a, b) => b.chgPct - a.chgPct || bySymbol(a, b)).slice(0, n);
  const losers = [...scorable].sort((a, b) => a.chgPct - b.chgPct || bySymbol(a, b)).slice(0, n);
  // A Set: with fewer than 2N scorable stocks the two sides overlap, and a stock must not be
  // counted - or printed - twice.
  const ranked = [...new Set([...gainers, ...losers])];
  const rankedSet = new Set(ranked);
  let rejectedRank = 0;
  for (const r of scorable) if (!rankedSet.has(r)) rejectedRank++;

  const gainerSet = new Set(gainers);
  const loserSet = new Set(losers);
  const trace = new Map<string, NseTrace>(ranked.map(r => [r.symbol, {
    symbol: r.symbol,
    side: gainerSet.has(r) && loserSet.has(r) ? 'both' as const : gainerSet.has(r) ? 'gainer' as const : 'loser' as const,
    chgPct: r.chgPct,
    oiPct: null,
    outcome: 'pending',
  }]));

  /* ---- step 2: |chg| >= 2% (row 4) ---- */

  let rejectedChg = 0;
  const passedChg = ranked.filter(r => {
    const pass = Math.abs(r.chgPct) >= CHG_MIN;
    if (!pass) { rejectedChg++; trace.get(r.symbol)!.outcome = 'chg below 2%'; }
    return pass;
  });

  /* ---- step 3: OI Spurts OI change >= +7% (rows 5, 7) ---- */

  const oi = new Map(bundle.oi.rows.map(r => [r.symbol, r]));
  const oiInvalid = new Map(bundle.oi.invalid.map(r => [r.symbol, r.reason]));
  const survivors: NseScanRow[] = [];
  let rejectedOi = 0;

  for (const r of passedChg) {
    const o = oi.get(r.symbol);
    const t = trace.get(r.symbol)!;
    if (!o) {
      const reason = oiInvalid.get(r.symbol) ?? 'not in OI Spurts';
      skipped.push({ symbol: r.symbol, name: nameOf(r.symbol), reason });
      t.outcome = reason;
      continue;
    }
    t.oiPct = o.oiPct;
    if (o.oiPct < OI_MIN) { rejectedOi++; t.outcome = 'OI chg below 7%'; continue; }
    t.outcome = 'pass';
    survivors.push({
      symbol: r.symbol, name: nameOf(r.symbol), ltp: r.ltp, prevClose: r.prevClose, chgPct: r.chgPct,
      volume: r.volume, latestOi: o.latestOi, prevOi: o.prevOi, oiPct: o.oiPct,
    });
  }

  /* ---- row 6 and row 13 ---- */

  const byAbsChg = (a: NseScanRow, b: NseScanRow) => Math.abs(b.chgPct) - Math.abs(a.chgPct) || bySymbol(a, b);
  const long = survivors.filter(r => r.chgPct > 0).sort(byAbsChg);
  const short = survivors.filter(r => r.chgPct < 0).sort(byAbsChg);

  // `list.rows` is the number of data lines in the file, counted by the parser before any of the
  // arithmetic above - not a total rebuilt from these same counters.
  const reconciles = skipped.length + rejectedRank + rejectedChg + rejectedOi + survivors.length === list.rows;

  return {
    ...base,
    funnel: {
      list: list.symbols.length,
      scored: scorable.length,
      ranked: ranked.length,
      chg: passedChg.length,
      oi: survivors.length,
    },
    long, short,
    skipped: skipped.sort(bySymbol),
    excluded: excluded.sort(bySymbol),
    rejected: { rank: rejectedRank, chg: rejectedChg, oi: rejectedOi },
    trace: [...trace.values()],
    reconciles,
    elapsedMs: Date.now() - startedAt,
    error: null,
  };
}

/* ------------------------------------------------------------- the scanner */

export class NseScanner {
  private inFlight: Promise<NseBundle> | null = null;
  private bundle: NseBundle | null = null;
  private startedAt = 0;
  private stage: NseScanProgress['stage'] = 'idle';

  last: NseScanResult | null = null;

  get progress(): NseScanProgress {
    return {
      running: this.inFlight !== null,
      stage: this.stage,
      elapsedMs: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }

  /**
   * Row 15. A Run always loads NSE again; `reuse` re-ranks the last fetch for a different N, so
   * switching 20 -> 25 -> 30 compares the same numbers. A request that arrives while a fetch is
   * running joins it rather than opening a second browser.
   */
  async run(n: TopN, reuse = false): Promise<NseScanResult> {
    const startedAt = Date.now();
    let list;
    try {
      list = parseFnoList(await readFile(LIST_PATH, 'utf8'));
    } catch (e) {
      return this.failed(n, `could not read your F&O list: ${(e as Error).message}`, startedAt);
    }

    let bundle: NseBundle;
    let reused = false;
    try {
      if (reuse && this.bundle && !this.inFlight) {
        bundle = this.bundle;
        reused = true;
      } else {
        if (!this.inFlight) {
          this.startedAt = startedAt;
          this.inFlight = fetchNseBundle(s => { this.stage = s; })
            .finally(() => { this.inFlight = null; });
        }
        bundle = await this.inFlight;
        this.bundle = bundle;
      }
    } catch (e) {
      return this.failed(n, (e as Error).message, startedAt);
    }

    this.stage = 'funnel';
    const result = { ...nseFunnel(bundle, list, n, startedAt), reused };
    this.stage = result.error ? 'failed' : 'done';
    this.last = result;
    return result;
  }

  private failed(n: TopN, error: string, startedAt: number): NseScanResult {
    this.stage = 'failed';
    const r: NseScanResult = {
      source: 'nse', mode: process.env.NSE_FIXTURE ? 'fixture' : 'live', at: new Date().toISOString(), n,
      reused: false,
      market: { status: 'unknown', priceAsOf: '', oiAsOf: '', tradeDate: null, prevTradingDate: null },
      funnel: { list: 0, scored: 0, ranked: 0, chg: 0, oi: 0 },
      long: [], short: [], skipped: [], excluded: [],
      rejected: { rank: 0, chg: 0, oi: 0 }, trace: [], reconciles: false,
      elapsedMs: Date.now() - startedAt, evidence: [], error,
    };
    this.last = r;
    return r;
  }
}

/** CSV of one result, for the panel's export button. */
export function nseScanCsv(r: NseScanResult): string {
  const head = 'side,symbol,name,ltp,prevClose,chgPct,volume,latestOi,prevOi,oiPct';
  const rows = [
    ...r.long.map(x => ['long', x] as const),
    ...r.short.map(x => ['short', x] as const),
  ].map(([side, x]) => [
    side, x.symbol, `"${x.name.replace(/"/g, '""')}"`, x.ltp.toFixed(2), x.prevClose.toFixed(2),
    x.chgPct.toFixed(2), x.volume ?? '', x.latestOi, x.prevOi, x.oiPct.toFixed(2),
  ].join(','));
  const meta =
    `# source NSE (${r.mode}); top ${r.n}; funnel ${r.funnel.list} -> ${r.funnel.ranked} -> ${r.funnel.chg} -> ${r.funnel.oi}` +
    `; skipped ${r.skipped.length}; prices as of ${r.market.priceAsOf}; OI as of ${r.market.oiAsOf}`;
  return [meta, head, ...rows].join('\n');
}
