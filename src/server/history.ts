/**
 * P37 — the history store and the nightly job. `docs/spec/backtest-v1.md`.
 *
 * All the Dhan calls of the backtest live here; `backtest.ts` is pure. Rules that must not drift:
 *  - every call shares ONE gate key (`history`, 1100 ms, row 2). dhan.ts queues per key
 *  - only COMPLETE sessions are stored: before 16:00 IST today is not fetched (row 3)
 *  - a stored day is never fetched again; each series remembers `fetchedTo` (AC6)
 *  - replay mode refuses: replay writes synthetic prices under real ids, and this directory
 *    holds real market data (CLAUDE.md, "replay and live must never share a persisted cache")
 */

import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './paths.ts';
import { dhanPost, type Credentials } from './dhan.ts';
import { fetchIntraday, istParts, type Candles } from './peakoi.ts';
import { isReplay } from './replay.ts';
import { fnoUniverse, stockOptions, todayIso } from './instruments.ts';
import { parseFnoList, type NseScanResult } from './scanner-nse.ts';
import {
  DEFAULT_PARAMS, GRID, JOB_AT_MIN, REAL_SCAN_FROM_MIN, REAL_SCAN_UNTIL_MIN,
  at, capSignals, ist, keyOf, proxyScan, replayDay, summarise, walkForward, windowStart,
  type Candle, type Contract, type DataSource, type DayKind, type Params, type ProxyInput, type Signal, type Trade,
} from './backtest.ts';
import type { OptionPick, Position } from './paper.ts';

export const HISTORY_DIR = path.join(CACHE_DIR, 'history');
const KEY = 'history';
const CADENCE_MS = 1100;
/** Row 2: SMA context before the window. */
const CONTEXT_DAYS = 7;

/* ------------------------------------------------------------------ files */

type Series = { fetchedTo: string | null; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; oi?: number[] };
type EqFile = { symbol: string; equityId: number; fetchedTo: string | null; closesTo: string | null; px0920: Record<string, number>; close: Record<string, number> };
type ContractsFile = Record<string, (Contract & { equityId: number; name: string })[]>;

const file = (name: string) => path.join(HISTORY_DIR, name);
async function readJson<T>(name: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file(name), 'utf8')) as T; } catch { return null; }
}
/** A file under the history directory, parsed, or null. For the sandbox (P41). */
export const readHistoryJson = readJson;
async function writeJson(name: string, v: unknown) {
  await mkdir(path.dirname(file(name)), { recursive: true });
  const tmp = file(name) + '.tmp';
  await writeFile(tmp, JSON.stringify(v));
  await rename(tmp, file(name));
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const toCandles = (s: Series): Candle[] => s.t.map((t, i) => ({ t, o: s.o[i]!, h: s.h[i]!, l: s.l[i]!, c: s.c[i]!, ...(s.oi ? { oi: s.oi[i]! } : {}) }));

/** Row 3: the last session that is complete. Before 16:00 IST, today is still being written. */
export function lastComplete(nowMs: number): string {
  const { date, minutes } = ist(nowMs);
  return minutes >= JOB_AT_MIN ? date : addDays(date, -1);
}

/* ------------------------------------------------------------------ fetch */

export type FetchLog = { calls: number; failed: string[] };

/** Appends candles of dates in (fetchedTo, upto] to a series. The payload may overlap; it is filtered. */
function merge(s: Series, c: Candles | null, upto: number | null, withOi: boolean, lastDay: string) {
  const ts = c?.timestamp ?? [];
  const known = s.t.length ? s.t[s.t.length - 1]! : -Infinity;
  for (let i = 0; i < ts.length; i++) {
    const ms = ts[i]! > 1e11 ? ts[i]! : ts[i]! * 1000;
    const d = istParts(ts[i]!)?.date;
    if (!d || d > lastDay || ms <= known || (upto !== null && ms > upto)) continue;
    const o = c!.open?.[i], h = c!.high?.[i], l = c!.low?.[i], cl = c!.close?.[i];
    if (![o, h, l, cl].every(x => typeof x === 'number' && Number.isFinite(x))) continue;
    s.t.push(ms); s.o.push(o!); s.h.push(h!); s.l.push(l!); s.c.push(cl!);
    if (withOi) s.oi!.push(Number(c!.open_interest?.[i] ?? 0));
  }
  s.fetchedTo = lastDay;
}

async function intraday(creds: Credentials, log: FetchLog, securityId: number, seg: string, instrument: string, interval: string, oi: boolean, from: string, to: string) {
  log.calls++;
  const r = await fetchIntraday(creds, { securityId: String(securityId), seg, instrument, interval, oi, fromDate: from, toDate: to, key: KEY, cadenceMs: CADENCE_MS });
  if (r.why) { log.failed.push(`${instrument} ${securityId} ${interval}m: ${r.why}`); return null; }
  return r.candles;
}

/** A 1-minute series, fetched from `from` on the first ask and then only for new days (row 2). */
export async function ensureM1(creds: Credentials, log: FetchLog, securityId: number, instrument: 'FUTSTK' | 'OPTSTK', from: string, lastDay: string): Promise<boolean> {
  const name = `m1/${securityId}.json`;
  const s = (await readJson<Series>(name)) ?? { fetchedTo: null, t: [], o: [], h: [], l: [], c: [] };
  if (s.fetchedTo !== null && s.fetchedTo >= lastDay) return true;
  const c = await intraday(creds, log, securityId, 'NSE_FNO', instrument, '1', false, s.fetchedTo ? addDays(s.fetchedTo, 1) : from, lastDay);
  if (c === null) return false;
  merge(s, c, null, false, lastDay);
  await writeJson(name, s);
  return true;
}

/**
 * Rows 1-3 for the whole universe: the cash 09:20 close, the daily closes and the near-month
 * future's 5-minute candles with OI, each only for days not stored yet.
 */
export async function updateHistory(creds: Credentials, nowMs: number, log: FetchLog, say: (m: string) => void = () => {}) {
  if (isReplay()) throw new Error('the backtest history holds real market data - it refuses to run in replay mode');
  const lastDay = lastComplete(nowMs);
  const list = parseFnoList(await readFile(path.resolve('data/fno-list.txt'), 'utf8'));
  const uni = new Map(fnoUniverse(todayIso()).map(s => [s.symbol, s]));
  const contracts = (await readJson<ContractsFile>('contracts.json')) ?? {};
  let n = 0;
  for (const symbol of list.symbols) {
    n++;
    const u = uni.get(symbol);
    if (!u || u.problem || u.futureId === null || u.lot === null || !u.futureExpiry || !u.equityId) { log.failed.push(`${symbol}: ${u?.problem ?? 'not in the master'}`); continue; }
    const start = windowStart(u.futureExpiry);
    const ctxFrom = addDays(start, -CONTEXT_DAYS);

    // The contract, and its option list, recorded while the master still has them (row 1).
    const list_ = contracts[symbol] ??= [];
    if (!list_.some(c => c.futureId === u.futureId)) list_.push({ futureId: u.futureId, lot: u.lot, expiry: u.futureExpiry, equityId: u.equityId, name: list.names.get(symbol) ?? symbol });
    const optName = `options/${symbol}-${u.futureExpiry}.json`;
    if (!(await readJson(optName))) await writeJson(optName, stockOptions(symbol, todayIso()).filter(o => o.expiry === u.futureExpiry));

    // Future 5-minute candles with OI.
    const fName = `fut5/${u.futureId}.json`;
    const f = (await readJson<Series>(fName)) ?? { fetchedTo: null, t: [], o: [], h: [], l: [], c: [], oi: [] };
    if (f.fetchedTo === null || f.fetchedTo < lastDay) {
      const c = await intraday(creds, log, u.futureId, 'NSE_FNO', 'FUTSTK', '5', true, f.fetchedTo ? addDays(f.fetchedTo, 1) : ctxFrom, lastDay);
      if (c !== null) { merge(f, c, null, true, lastDay); await writeJson(fName, f); }
    }

    // Cash: the 09:20 one-minute close per day (row 4), and the official daily closes.
    const eName = `eq/${symbol}.json`;
    const e = (await readJson<EqFile>(eName)) ?? { symbol, equityId: u.equityId, fetchedTo: null, closesTo: null, px0920: {}, close: {} };
    if (e.fetchedTo === null || e.fetchedTo < lastDay) {
      const c = await intraday(creds, log, u.equityId, 'NSE_EQ', 'EQUITY', '1', false, e.fetchedTo ? addDays(e.fetchedTo, 1) : start, lastDay);
      if (c !== null) {
        const ts = c.timestamp ?? [];
        for (let i = 0; i < ts.length; i++) {
          const p = istParts(ts[i]!);
          if (p && p.time === '09:20' && p.date <= lastDay && typeof c.close?.[i] === 'number') e.px0920[p.date] = c.close[i]!;
        }
        e.fetchedTo = lastDay;
      }
    }
    if (e.closesTo === null || e.closesTo < lastDay) {
      log.calls++;
      const d = await dhanPost<Candles & { data?: Candles }>('/v2/charts/historical',
        { securityId: String(u.equityId), exchangeSegment: 'NSE_EQ', instrument: 'EQUITY', expiryCode: 0, oi: false, fromDate: e.closesTo ? addDays(e.closesTo, -7) : ctxFrom, toDate: addDays(lastDay, 1) },
        { creds, key: KEY, cadenceMs: CADENCE_MS, timeoutMs: 20_000 });
      if (d.ok) {
        const body = d.data?.data ?? d.data;
        const ts = body?.timestamp ?? [];
        for (let i = 0; i < ts.length; i++) {
          const day = istParts(ts[i]!)?.date;
          const cl = body?.close?.[i];
          if (day && day <= lastDay && typeof cl === 'number' && cl > 0) e.close[day] = cl;
        }
        e.closesTo = lastDay;
      } else log.failed.push(`EQUITY ${u.equityId} daily: ${d.error?.code}`);
    }
    await writeJson(eName, e);
    if (n % 25 === 0) say(`history: ${n}/${list.symbols.length} stocks, ${log.calls} calls`);
  }
  await writeJson('contracts.json', contracts);
  return { lastDay, list };
}

/* ------------------------------------------------------------ real scans */

export type RealScan = { result: NseScanResult; priceAsOf: string; byN: Record<number, { long: { symbol: string; chgPct: number }[]; short: { symbol: string; chgPct: number }[] }>; trace: NseScanResult['trace'] };

/** "24-Sep-2026 09:20:10" -> minutes after midnight, or null. */
function stampMinutes(s: string): number | null {
  const m = /\b(\d{2}):(\d{2})(?::\d{2})?\s*$/.exec(s ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Row 4: a real 09:20 scan for `date` — the Windows task's log, or the paper trader's (row 18). */
export async function realScan(date: string): Promise<RealScan | null> {
  const candidates: { result: NseScanResult; wider?: { n: number; long: any[]; short: any[] }[] }[] = [];
  const own = await readJson<{ result: NseScanResult; wider?: any[] }>(`scans/${date}.json`);
  if (own) candidates.push(own);
  try {
    const dir = path.resolve('logs/scans', date);
    for (const f of (await readdir(dir)).filter(f => /-local-pc\.json$/.test(f)).sort()) {
      candidates.push(JSON.parse(await readFile(path.join(dir, f), 'utf8')));
    }
  } catch { /* no log for this date */ }
  for (const c of candidates) {
    const r = c.result;
    if (!r || r.error) continue;
    const stamp = r.market?.priceAsOf ?? '';
    const mins = stampMinutes(stamp);
    if (r.market?.tradeDate !== date || mins === null || mins < REAL_SCAN_FROM_MIN || mins > REAL_SCAN_UNTIL_MIN) continue;
    const byN: RealScan['byN'] = { [r.n]: { long: r.long, short: r.short } };
    for (const w of c.wider ?? []) byN[w.n] = { long: w.long, short: w.short };
    return { result: r, priceAsOf: stamp, byN, trace: r.trace };
  }
  return null;
}

/** Row 18: keep each live 09:20 scan, with its wider re-ranks from the same fetch. */
export async function saveScan(date: string, result: NseScanResult, wider: NseScanResult[]) {
  if (isReplay()) return;
  await writeJson(`scans/${date}.json`, { result, wider: wider.map(w => ({ n: w.n, funnel: w.funnel, long: w.long, short: w.short })) });
}

/* ------------------------------------------------------------ the dataset */

export class HistoryData implements DataSource {
  private fut = new Map<number, Candle[]>();
  private m1s = new Map<number, Candle[] | null>();
  private opts = new Map<string, OptionPick[]>();
  private readonly contracts: ContractsFile;
  constructor(contracts: ContractsFile) { this.contracts = contracts; }

  static async load(): Promise<HistoryData> {
    return new HistoryData((await readJson<ContractsFile>('contracts.json')) ?? {});
  }

  /** The contract that was near-month on `date`: expires on or after it, and its window has begun. */
  contract(symbol: string, date: string): Contract | null {
    const c = (this.contracts[symbol] ?? []).filter(x => x.expiry >= date && windowStart(x.expiry) <= date).sort((a, b) => a.expiry.localeCompare(b.expiry))[0];
    return c ? { futureId: c.futureId, lot: c.lot, expiry: c.expiry } : null;
  }
  equityOf(symbol: string) { return this.contracts[symbol]?.[0] ?? null; }
  symbols() { return Object.keys(this.contracts); }

  async preload(): Promise<void> {
    for (const [symbol, list] of Object.entries(this.contracts)) for (const c of list) {
      const s = await readJson<Series>(`fut5/${c.futureId}.json`);
      if (s) this.fut.set(c.futureId, toCandles(s));
      const o = await readJson<OptionPick[]>(`options/${symbol}-${c.expiry}.json`);
      if (o) this.opts.set(`${c.futureId}`, o);
    }
  }
  async loadM1(ids: Iterable<number>) {
    for (const id of ids) {
      const s = await readJson<Series>(`m1/${id}.json`);
      this.m1s.set(id, s ? toCandles(s) : null);
    }
  }
  fut5(symbol: string, date: string): Candle[] | null {
    const c = this.contract(symbol, date);
    if (!c) return null;
    const end = at(date, 24 * 60);
    return (this.fut.get(c.futureId) ?? []).filter(b => b.t < end);
  }
  futAll(futureId: number) { return this.fut.get(futureId) ?? []; }
  m1(id: number): Candle[] | null { return this.m1s.get(id) ?? null; }
  options(symbol: string, expiry: string): OptionPick[] {
    const c = (this.contracts[symbol] ?? []).find(x => x.expiry === expiry);
    return c ? this.opts.get(`${c.futureId}`) ?? [] : [];
  }
  /** Every trading date the futures data covers inside a contract window, ascending. */
  sessions(): string[] {
    const set = new Set<string>();
    for (const list of Object.values(this.contracts)) for (const c of list) {
      const from = windowStart(c.expiry);
      for (const b of this.fut.get(c.futureId) ?? []) { const d = ist(b.t).date; if (d >= from && d <= c.expiry) set.add(d); }
    }
    return [...set].sort();
  }
}

/** Row 4's proxy inputs for one date. */
export async function proxyInputs(data: HistoryData, date: string): Promise<{ rows: ProxyInput[]; prevDate: string | null }> {
  const rows: ProxyInput[] = [];
  let prevDate: string | null = null;
  for (const symbol of data.symbols()) {
    const e = await readJson<EqFile>(`eq/${symbol}.json`);
    const eqName = data.equityOf(symbol)?.name ?? symbol;
    const closeDays = Object.keys(e?.close ?? {}).filter(d => d < date).sort();
    const prevClose = closeDays.length ? e!.close[closeDays.at(-1)!]! : null;
    const c = data.contract(symbol, date);
    let oi0920: number | null = null, prevOi: number | null = null;
    if (c) {
      const bars = data.futAll(c.futureId);
      const b0915 = bars.find(b => b.t === at(date, 9 * 60 + 15));
      oi0920 = b0915?.oi || null;
      const before = bars.filter(b => b.t < at(date, 0));
      const last = before.at(-1);
      if (last) { prevOi = last.oi || null; prevDate ??= ist(last.t).date; }
    }
    rows.push({ symbol, name: eqName, px0920: e?.px0920[date] ?? null, prevClose, oi0920, prevOi });
  }
  return { rows, prevDate };
}

/* ------------------------------------------------------------ the job */

export type Report = {
  ranAt: string; ranDate: string; lastDay: string; calls: number; failed: string[];
  sessions: { date: string; kind: DayKind; signals: number; priceAsOf: string | null }[];
  current: { params: Params; all: ReturnType<typeof summarise>; real: ReturnType<typeof summarise>; proxy: ReturnType<typeof summarise>; trades: Trade[] };
  grid: { key: string; gross: number; trades: number; real: number; proxy: number }[];
  walkForward: ReturnType<typeof walkForward>;
  proxyCheck: { date: string; real: { long: string[]; short: string[] }; proxy: { long: string[]; short: string[] }; rows: { symbol: string; realChg: number; proxyChg: number | null; realOi: number | null; proxyOi: number | null }[] }[];
  calibration: { date: string; symbol: string; side: string; live: number; model: number | null; diff: number | null }[];
  missing: string[];
};

/**
 * The whole nightly run (rows 1-12, 14): update the store, choose each day's signals, replay the
 * grid, fetch whatever 1-minute series the replay asked for, replay again, then measure.
 */
export async function runBacktest(creds: Credentials, nowMs: number, say: (m: string) => void = console.log): Promise<Report> {
  const log: FetchLog = { calls: 0, failed: [] };
  const { lastDay, list } = await updateHistory(creds, nowMs, log, say);
  const data = await HistoryData.load();
  await data.preload();
  const dates = data.sessions().filter(d => d <= lastDay);

  // Rows 4, 5: each day's signals per top N, real where a real 09:20 scan exists.
  type Day = { date: string; kind: DayKind; priceAsOf: string | null; byN: Record<number, Signal[]> };
  const days: Day[] = [];
  const proxyCheck: Report['proxyCheck'] = [];
  for (const date of dates) {
    const real = await realScan(date);
    const { rows, prevDate } = await proxyInputs(data, date);
    const proxyBy: Record<number, ReturnType<typeof proxyScan>> = {};
    for (const n of [20, 25, 30]) proxyBy[n] = proxyScan(date, prevDate ?? addDays(date, -1), rows, list, n);
    if (real) {
      const byN: Record<number, Signal[]> = {};
      for (const n of [20, 25, 30]) { const r = real.byN[n]; if (r) byN[n] = capSignals(r.long, r.short); }
      days.push({ date, kind: 'real', priceAsOf: real.priceAsOf, byN });
      const pr = new Map(rows.map(r => [r.symbol, r]));
      const pct = (a: number | null, b: number | null) => (a && b ? Math.round((a - b) / b * 10000) / 100 : null);
      proxyCheck.push({
        date,
        real: { long: real.byN[20]?.long.map(r => r.symbol) ?? [], short: real.byN[20]?.short.map(r => r.symbol) ?? [] },
        proxy: { long: proxyBy[20]!.long.map(r => r.symbol), short: proxyBy[20]!.short.map(r => r.symbol) },
        rows: (real.trace ?? []).map(t => ({ symbol: t.symbol, realChg: t.chgPct, proxyChg: pct(pr.get(t.symbol)?.px0920 ?? null, pr.get(t.symbol)?.prevClose ?? null), realOi: t.oiPct, proxyOi: pct(pr.get(t.symbol)?.oi0920 ?? null, pr.get(t.symbol)?.prevOi ?? null) })),
      });
    } else {
      const byN: Record<number, Signal[]> = {};
      for (const n of [20, 25, 30]) byN[n] = capSignals(proxyBy[n]!.long, proxyBy[n]!.short);
      days.push({ date, kind: 'proxy', priceAsOf: null, byN });
    }
  }

  // The grid, re-run until no series is missing (a fetched future reveals which option is needed).
  const runGrid = () => {
    const missing = new Set<string>();
    const out = new Map<string, Trade[]>();
    for (const p of GRID) {
      const trades: Trade[] = [];
      for (const d of days) trades.push(...replayDay(d.date, d.kind, d.byN[p.topN] ?? [], p, data, missing));
      out.set(keyOf(p), trades);
    }
    return { out, missing };
  };
  let res = runGrid();
  for (let pass = 0; pass < 4 && res.missing.size; pass++) {
    say(`backtest: fetching ${res.missing.size} one-minute series`);
    const ids = [...res.missing].map(k => Number(k.slice(3)));
    const contracts = await readJson<ContractsFile>('contracts.json') ?? {};
    const futIds = new Set(Object.values(contracts).flat().map(c => c.futureId));
    for (const id of ids) await ensureM1(creds, log, id, futIds.has(id) ? 'FUTSTK' : 'OPTSTK', dates[0] ?? lastDay, lastDay);
    await data.loadM1(ids);
    res = runGrid();
  }

  const byKind = (ts: Trade[], k: DayKind) => ts.filter(t => t.kind === k);
  const kindDates = (k: DayKind) => days.filter(d => d.kind === k).map(d => d.date);
  const cur = res.out.get(keyOf(DEFAULT_PARAMS)) ?? [];
  const perDay = new Map<string, number[]>();
  for (const [k, ts] of res.out) perDay.set(k, dates.map(d => Math.round(ts.filter(t => t.date === d).reduce((s, t) => s + t.pnl, 0) * 100) / 100));
  const grid = [...res.out].map(([key, ts]) => ({
    key, trades: ts.length,
    gross: summarise(ts, dates).gross, real: summarise(byKind(ts, 'real'), kindDates('real')).gross, proxy: summarise(byKind(ts, 'proxy'), kindDates('proxy')).gross,
  })).sort((a, b) => b.gross - a.gross);

  // Row 12: live entries against the model's entry for the same signal and day.
  const calibration: Report['calibration'] = [];
  const ledger = await readFile(path.join(CACHE_DIR, 'paper-ledger.json'), 'utf8').then(s => JSON.parse(s) as { positions: Position[] }).catch(() => null);
  for (const p of ledger?.positions ?? []) {
    if ((p.leg ?? 'future') !== 'future' || p.entryPx === null || !dates.includes(p.date)) continue;
    const t = replayDay(p.date, 'real', [{ symbol: p.symbol, side: p.side, chgPct: p.signal.chgPct }], DEFAULT_PARAMS, data, new Set())[0];
    calibration.push({ date: p.date, symbol: p.symbol, side: p.side, live: p.entryPx, model: t?.entryPx ?? null, diff: t ? Math.round((t.entryPx - p.entryPx) * 100) / 100 : null });
  }

  const report: Report = {
    ranAt: new Date(nowMs).toISOString(), ranDate: ist(nowMs).date, lastDay, calls: log.calls, failed: log.failed,
    sessions: days.map(d => ({ date: d.date, kind: d.kind, signals: d.byN[20]?.length ?? 0, priceAsOf: d.priceAsOf })),
    current: {
      params: DEFAULT_PARAMS, all: summarise(cur, dates),
      real: summarise(byKind(cur, 'real'), kindDates('real')), proxy: summarise(byKind(cur, 'proxy'), kindDates('proxy')),
      trades: cur,
    },
    grid, walkForward: walkForward(dates, perDay, keyOf(DEFAULT_PARAMS)), proxyCheck, calibration,
    missing: [...res.missing],
  };
  await writeJson('report.json', report);
  return report;
}

/** Row 14: the date of the last completed run, from the report on disk. */
export async function lastRunDate(): Promise<string | null> {
  return (await readJson<Report>('report.json'))?.ranDate ?? null;
}
