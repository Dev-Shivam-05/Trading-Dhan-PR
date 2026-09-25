/**
 * P44 — the data the rule-trainer needs. `docs/spec/train-all-v1.md`.
 *
 * All Dhan calls of P44 live here; `train.ts` is pure. The rules mirror P37's store (history.ts):
 *  - one gate key, `history`, at 1100 ms — the same key the 16:00 job uses, so the two queue
 *  - only complete sessions: before 16:00 IST today is not fetched
 *  - a stored day is never fetched again; each series remembers `fetchedTo`
 *  - replay mode refuses: this directory holds real market data
 *
 * Why the CASH series and not the futures (row 2): the August futures contract expired on 25 Aug
 * and is gone from the master, while each share's own 1-minute candles go back ~90 days in one
 * call. A future moves with its share point for point except for the basis, which drifts by paise
 * inside a day; AC3 measures that substitution on the days both exist.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { dhanPost, type Credentials } from './dhan.ts';
import { fetchIntraday, istParts, type Candles } from './peakoi.ts';
import { isReplay } from './replay.ts';
import { HISTORY_DIR, lastComplete } from './history.ts';

const KEY = 'history';
const CADENCE_MS = 1100;
/**
 * Row 2 (amendment 22): the first session fetched. Dhan answers at most ~90 days per intraday
 * request, but the share's history goes back further: RELIANCE returned 60 sessions for each of
 * Jan–Mar and Apr–Jun 2026 (measured 2026-09-25). So older data is fetched in 90-day chunks.
 */
export const TRAIN_FROM = '2025-10-01';
/** Row 2: daily closes from a little earlier, so the first session has a previous close. */
const CLOSES_FROM = '2025-09-20';
const CHUNK_DAYS = 89;

export type Series = { fetchedTo: string | null; from?: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[] };
export type Closes = { fetchedTo: string | null; close: Record<string, number> };
type ContractsFile = Record<string, { futureId: number; lot: number; expiry: string; equityId: number; name: string }[]>;

const file = (name: string) => path.join(HISTORY_DIR, name);
export async function readJson<T>(name: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file(name), 'utf8')) as T; } catch { return null; }
}
async function writeJson(name: string, v: unknown) {
  await mkdir(path.dirname(file(name)), { recursive: true });
  const tmp = file(name) + '.tmp';
  await writeFile(tmp, JSON.stringify(v));
  await rename(tmp, file(name));
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The stocks P37 already resolved: symbol -> share id and the current lot. */
export async function universe(): Promise<{ symbol: string; equityId: number; lot: number }[]> {
  const c = (await readJson<ContractsFile>('contracts.json')) ?? {};
  return Object.entries(c).map(([symbol, list]) => ({ symbol, equityId: list[0]!.equityId, lot: list.at(-1)!.lot }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** A retryable failure (805, a timeout) gets two more tries, 3 s apart. */
async function withRetry<T extends { why: string | null; retryable: boolean }>(f: () => Promise<T>): Promise<T> {
  let r = await f();
  for (let i = 0; i < 2 && r.why && r.retryable; i++) { await new Promise(res => setTimeout(res, 3000)); r = await f(); }
  return r;
}

export type FetchLog = { calls: number; failed: string[] };

/** Rows 2, 3: every stock's cash 1-minute candles and official daily closes, incrementally. */
export async function updateTrainData(creds: Credentials, nowMs: number, log: FetchLog, say: (m: string) => void = () => {}) {
  if (isReplay()) throw new Error('the training data is real market data - it refuses to run in replay mode');
  const lastDay = lastComplete(nowMs);
  const uni = await universe();
  if (!uni.length) throw new Error('no contracts in .cache/history/contracts.json - run `npm run backtest` once first');
  let n = 0;
  for (const u of uni) {
    n++;
    const mName = `eq1/${u.symbol}.json`;
    const s = (await readJson<Series>(mName)) ?? { fetchedTo: null, t: [], o: [], h: [], l: [], c: [] };
    const get = async (from: string, to: string) => {
      log.calls++;
      const r = await withRetry(() => fetchIntraday(creds, { securityId: String(u.equityId), seg: 'NSE_EQ', instrument: 'EQUITY', interval: '1', oi: false, fromDate: from, toDate: to, key: KEY, cadenceMs: CADENCE_MS }));
      if (r.why) log.failed.push(`${u.symbol} 1m ${from}..${to}: ${r.why}`);
      return r.why ? null : r.candles;
    };
    // Older than what is stored: 90-day chunks, prepended. `from` records how far back it reaches.
    const firstStored = s.from ?? (s.t.length ? istParts(s.t[0]!)!.date : null);
    if (firstStored !== null && firstStored > TRAIN_FROM) {
      const older: Series = { fetchedTo: null, t: [], o: [], h: [], l: [], c: [] };
      let ok = true;
      for (let a = TRAIN_FROM; a < firstStored; a = addDays(a, CHUNK_DAYS + 1)) {
        const b = addDays(a, CHUNK_DAYS) < firstStored ? addDays(a, CHUNK_DAYS) : addDays(firstStored, -1);
        const c = await get(a, addDays(b, 1));
        if (c === null) { ok = false; break; }
        mergeSeries(older, c, b);
      }
      if (ok) {
        for (const k of ['t', 'o', 'h', 'l', 'c'] as const) s[k] = [...older[k], ...s[k]];
        s.from = TRAIN_FROM;
        await writeJson(mName, s);
      }
    }
    if (s.fetchedTo === null || s.fetchedTo < lastDay) {
      const from = s.fetchedTo ? addDays(s.fetchedTo, 1) : TRAIN_FROM;
      // A first fetch longer than one chunk is split the same way.
      let ok = true;
      for (let a = from; a <= lastDay && ok; a = addDays(a, CHUNK_DAYS + 1)) {
        const b = addDays(a, CHUNK_DAYS) < lastDay ? addDays(a, CHUNK_DAYS) : lastDay;
        const c = await get(a, addDays(b, 1));
        if (c === null) ok = false; else mergeSeries(s, c, b);
      }
      if (ok) { s.from ??= TRAIN_FROM; await writeJson(mName, s); }
    }
    const dName = `eqd/${u.symbol}.json`;
    const d = (await readJson<Closes>(dName)) ?? { fetchedTo: null, close: {} };
    const closesReach = Object.keys(d.close).sort()[0];
    if (closesReach !== undefined && closesReach > TRAIN_FROM) d.fetchedTo = null;   // too short: fetch the whole span again
    if (d.fetchedTo === null || d.fetchedTo < lastDay) {
      log.calls++;
      const call = await dhanPost<Candles & { data?: Candles }>('/v2/charts/historical',
        { securityId: String(u.equityId), exchangeSegment: 'NSE_EQ', instrument: 'EQUITY', expiryCode: 0, oi: false, fromDate: d.fetchedTo ? addDays(d.fetchedTo, -7) : CLOSES_FROM, toDate: addDays(lastDay, 1) },
        { creds, key: KEY, cadenceMs: CADENCE_MS, timeoutMs: 20_000 });
      if (call.ok) {
        const body = call.data?.data ?? call.data;
        const ts = body?.timestamp ?? [];
        for (let i = 0; i < ts.length; i++) {
          const day = istParts(ts[i]!)?.date;
          const cl = body?.close?.[i];
          if (day && day <= lastDay && typeof cl === 'number' && cl > 0) d.close[day] = cl;
        }
        d.fetchedTo = lastDay;
        await writeJson(dName, d);
      } else log.failed.push(`${u.symbol} daily: ${call.error?.code}`);
    }
    if (n % 25 === 0) say(`train data: ${n}/${uni.length} stocks, ${log.calls} calls, ${log.failed.length} failed`);
  }
  return { lastDay, stocks: uni.length };
}

/** Appends candles of dates in (fetchedTo, lastDay]; the payload may overlap and is filtered. */
export function mergeSeries(s: Series, c: Candles | null, lastDay: string) {
  const ts = c?.timestamp ?? [];
  const known = s.t.length ? s.t[s.t.length - 1]! : -Infinity;
  for (let i = 0; i < ts.length; i++) {
    const ms = ts[i]! > 1e11 ? ts[i]! : ts[i]! * 1000;
    const d = istParts(ts[i]!)?.date;
    if (!d || d > lastDay || ms <= known) continue;
    const o = c!.open?.[i], h = c!.high?.[i], l = c!.low?.[i], cl = c!.close?.[i];
    if (![o, h, l, cl].every(x => typeof x === 'number' && Number.isFinite(x))) continue;
    s.t.push(ms); s.o.push(o!); s.h.push(h!); s.l.push(l!); s.c.push(cl!);
  }
  s.fetchedTo = lastDay;
}
