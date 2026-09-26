/**
 * P39 — expired stock options, rebuilt from Dhan's Expired Options Data, and the option leg P44 did not model.
 * `docs/spec/opthist-v1.md` (every "row N" below is a row of that spec).
 *
 * `rollingoption` answers "the option at ATM+n, minute by minute", not "strike K", so each candle is filed under its
 * own `strike` (P48 row 5's idea). A month is written only when all six series returned (row 2). The pricing is pure.
 */

import { readFile, writeFile, mkdir, rename, statfs } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dhanPost, type Credentials, type DhanCall } from './dhan.ts';
import { isReplay } from './replay.ts';
import { HISTORY_DIR, lastComplete } from './history.ts';
import { months, istDate } from './chainhist.ts';
import { costOf } from './ltp-backtest.ts';

export const OPT_DIR = path.join(HISTORY_DIR, 'optstk');
/** Row 1. */
export const OPT_OFFSETS = [-1, 0, 1];
const SIDES = ['CALL', 'PUT'] as const;
const KEY = 'history';
const CADENCE_MS = 1100;
const MIN_FREE_BYTES = 2e9;
const FIELDS = ['open', 'high', 'low', 'close', 'volume', 'oi', 'strike', 'spot'];

export type OptMonth = {
  symbol: string; month: string; fetchedTo: string;
  /** date -> minute-open ms -> `${strike}CE|PE` -> close */
  days: Record<string, Record<string, Record<string, number>>>;
};
type Roll = { timestamp?: number[]; close?: number[]; strike?: number[] };

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Row 1 / AC1: six series -> each minute's close filed under the candle's own strike. First value wins. */
export function stitchMonth(series: Map<string, Roll>): OptMonth['days'] {
  const days: OptMonth['days'] = {};
  for (const [name, s] of series) {
    const side = name.split('|')[1] === 'CALL' ? 'CE' : 'PE';
    (s.timestamp ?? []).forEach((raw, j) => {
      const ms = raw > 1e11 ? raw : raw * 1000;
      const k = num(s.strike?.[j]), c = num(s.close?.[j]);
      if (k === null || c === null) return;
      const d = istDate(ms);
      const min = ((days[d] ??= {})[String(ms)] ??= {});
      min[`${k}${side}`] ??= c;
    });
  }
  return days;
}

const file = (symbol: string, month: string) => path.join(OPT_DIR, symbol.replace(/[^A-Za-z0-9&-]/g, '_'), `${month}.json.gz`);
export async function readMonth(symbol: string, month: string): Promise<OptMonth | null> {
  try { return JSON.parse(gunzipSync(await readFile(file(symbol, month))).toString('utf8')) as OptMonth; } catch { return null; }
}
async function writeMonth(m: OptMonth) {
  const f = file(m.symbol, m.month);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f + '.tmp', gzipSync(JSON.stringify(m)));
  await rename(f + '.tmp', f);
}

export type Post = (body: Record<string, unknown>) => Promise<DhanCall<any>>;
export type OptLog = { calls: number; failed: string[]; written: number };

/** Rows 1-3: fetch the given stock-months that are not complete on disk. Replay refuses. */
export async function fetchMonths(creds: Credentials | null, nowMs: number, want: { symbol: string; equityId: number; month: string }[], log: OptLog, say: (m: string) => void = () => {}, post?: Post) {
  if (isReplay()) throw new Error('the option history is real market data - it refuses to run in replay mode');
  await mkdir(OPT_DIR, { recursive: true });
  const s = await statfs(OPT_DIR);
  if (s.bavail * s.bsize < MIN_FREE_BYTES) throw new Error(`under ${MIN_FREE_BYTES / 1e9} GB free on the cache disk (row 2)`);
  const call: Post = post ?? (body => dhanPost<any>('/v2/charts/rollingoption', body, { creds: creds!, key: KEY, cadenceMs: CADENCE_MS, timeoutMs: 30_000 }));
  const last = lastComplete(nowMs);
  for (const w of want) {
    const [range] = months(`${w.month}-01`, last).filter(m => m.key === w.month);
    if (!range) continue;
    const have = await readMonth(w.symbol, w.month);
    if (have && have.fetchedTo >= range.b) continue;
    const series = new Map<string, Roll>();
    let failed = false;
    for (const side of SIDES) for (const off of OPT_OFFSETS) {
      if (failed) continue;
      log.calls++;
      const body = { exchangeSegment: 'NSE_FNO', interval: '1', securityId: w.equityId, instrument: 'OPTSTK', expiryFlag: 'MONTH', expiryCode: 1,
        strike: off === 0 ? 'ATM' : off > 0 ? `ATM+${off}` : `ATM${off}`, drvOptionType: side, requiredData: FIELDS, fromDate: range.a, toDate: addDays(range.b, 1) };
      let r = await call(body);
      // P44's rule: a retryable failure (805, a timeout) gets two more tries, 3 s apart.
      for (let i = 0; i < 2 && !r.ok && r.error?.retryable; i++) { await new Promise(res => setTimeout(res, 3000)); r = await call(body); }
      if (!r.ok) { failed = true; log.failed.push(`${w.symbol} ${w.month} ${off} ${side}: ${r.error?.code ?? ''} ${r.error?.message ?? ''}`.trim()); continue; }
      const d = r.data?.data ?? r.data;
      series.set(`${off}|${side}`, (side === 'CALL' ? d?.ce : d?.pe) ?? {});
    }
    if (failed) { say(`${w.symbol} ${w.month}: ${log.failed.at(-1)} — skipped, fetched again next run`); continue; }
    await writeMonth({ symbol: w.symbol, month: w.month, fetchedTo: range.b, days: stitchMonth(series) });
    log.written++;
    say(`${w.symbol} ${w.month}: written (${log.calls} calls so far)`);
  }
}

/* ------------------------------------------------------------------ row 4: pricing a trade's option leg (pure) */

export type LegTrade = { date: string; symbol: string; side: 'BUY' | 'SELL'; lot: number; entryT: number; entryPx: number; exitT: number };
export type LegResult = { strike: number; type: 'CE' | 'PE'; entry: number; exit: number; gross: number; cost: number; net: number } | { noPrice: string };
export type Fill = 'level' | 'late1m';

const MIN = 60_000;
/** Row 4: the strike nearest the entry price among those quoted in the entry minute; a tie goes to the lower. */
function nearest(strikes: number[], px: number): number | null {
  let best: number | null = null;
  for (const k of strikes) if (best === null || Math.abs(k - px) < Math.abs(best - px) || (Math.abs(k - px) === Math.abs(best - px) && k < best)) best = k;
  return best;
}

export function priceLeg(t: LegTrade, day: Record<string, Record<string, number>> | undefined, fill: Fill): LegResult {
  if (!day) return { noPrice: 'no option data for the day' };
  const type = t.side === 'BUY' ? 'CE' : 'PE';
  const eMin = Math.floor(t.entryT / MIN) * MIN + (fill === 'late1m' ? MIN : 0);
  const xMin = Math.floor(t.exitT / MIN) * MIN + (fill === 'late1m' ? MIN : 0);
  const atEntry = day[String(eMin)];
  if (!atEntry) return { noPrice: 'no option minute at entry' };
  const strikes = Object.keys(atEntry).filter(k => k.endsWith(type)).map(k => Number(k.slice(0, -2)));
  const strike = nearest(strikes, t.entryPx);
  if (strike === null) return { noPrice: `no ${type} quoted at entry` };
  const entry = atEntry[`${strike}${type}`]!;
  const exit = day[String(xMin)]?.[`${strike}${type}`];
  if (exit === undefined) return { noPrice: `${strike}${type} not quoted at exit (outside ATM±1 by then)` };
  const gross = Math.round((exit - entry) * t.lot * 100) / 100;
  const cost = costOf(entry, exit, t.lot);
  return { strike, type, entry, exit, gross, cost, net: Math.round((gross - cost) * 100) / 100 };
}
