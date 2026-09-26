/**
 * P50 row 2 — NIFTY's own 1-minute OHLC, so a line can be touched by the minute's low or high.
 * The chain rebuild (P48) carries only the index close per minute (its `spot`), and a close can sit
 * above a line whose low went through it.
 *
 * Same rules as history.ts / chainhist.ts: one gate key `history` at 1100 ms, only complete sessions
 * (before 16:00 IST today is never fetched), replay mode refuses (this file holds real market data).
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import type { Credentials } from './dhan.ts';
import { fetchIntraday } from './peakoi.ts';
import { isReplay } from './replay.ts';
import { HISTORY_DIR, lastComplete } from './history.ts';
import { istDate } from './chainhist.ts';

export const IDX_FILE = path.join(HISTORY_DIR, 'idx', 'NIFTY.json');
export const IDX_FROM = '2024-01-01';
const KEY = 'history';
const CADENCE_MS = 1100;
/** Dhan's intraday limit is 90 days per request (CLAUDE.md); 89 keeps `toDate`'s exclusivity inside it. */
const CHUNK_DAYS = 89;

export type IdxSeries = { fetchedTo: string | null; t: number[]; o: number[]; h: number[]; l: number[]; c: number[] };
/** One session's minutes, keyed by minute-open epoch ms. */
export type IdxDay = Map<number, { o: number; h: number; l: number; c: number }>;

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function readIdx(file = IDX_FILE): Promise<IdxSeries | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as IdxSeries; } catch { return null; }
}

/** Every stored minute grouped by IST date. */
export function byDate(s: IdxSeries): Map<string, IdxDay> {
  const out = new Map<string, IdxDay>();
  for (let i = 0; i < s.t.length; i++) {
    const d = istDate(s.t[i]!);
    let m = out.get(d);
    if (!m) out.set(d, (m = new Map()));
    m.set(s.t[i]!, { o: s.o[i]!, h: s.h[i]!, l: s.l[i]!, c: s.c[i]! });
  }
  return out;
}

export type IdxLog = { calls: number; failed: string[]; added: number };

/** Fetches the dates after `fetchedTo` up to the last complete session, in 89-day chunks. */
export async function updateIdx(creds: Credentials | null, nowMs: number, log: IdxLog, say: (m: string) => void = () => {}) {
  if (isReplay()) throw new Error('replay mode: the index history holds real market data, refusing to write it');
  const last = lastComplete(nowMs);
  const s = (await readIdx()) ?? { fetchedTo: null, t: [], o: [], h: [], l: [], c: [] };
  let from = s.fetchedTo ? addDays(s.fetchedTo, 1) : IDX_FROM;
  while (from <= last) {
    const toIncl = addDays(from, CHUNK_DAYS - 1) < last ? addDays(from, CHUNK_DAYS - 1) : last;
    log.calls++;
    // toDate is exclusive (CLAUDE.md, P48), so ask for the day after the last one wanted.
    const r = await fetchIntraday(creds, { securityId: '13', seg: 'IDX_I', instrument: 'INDEX', interval: '1', oi: false, fromDate: from, toDate: addDays(toIncl, 1), key: KEY, cadenceMs: CADENCE_MS });
    if (r.why) { log.failed.push(`${from}..${toIncl}: ${r.why}`); break; }
    const c = r.candles as { timestamp?: number[]; open?: number[]; high?: number[]; low?: number[]; close?: number[] } | null;
    const known = s.t.length ? s.t[s.t.length - 1]! : -Infinity;
    let n = 0;
    (c?.timestamp ?? []).forEach((raw, i) => {
      const ms = raw > 1e11 ? raw : raw * 1000;
      const o = c!.open?.[i], h = c!.high?.[i], l = c!.low?.[i], cl = c!.close?.[i];
      if (ms <= known || istDate(ms) > toIncl || ![o, h, l, cl].every(x => typeof x === 'number' && Number.isFinite(x))) return;
      s.t.push(ms); s.o.push(o!); s.h.push(h!); s.l.push(l!); s.c.push(cl!); n++;
    });
    log.added += n;
    s.fetchedTo = toIncl;
    say(`idx ${from} .. ${toIncl}: ${n} minutes`);
    from = addDays(toIncl, 1);
  }
  await mkdir(path.dirname(IDX_FILE), { recursive: true });
  await writeFile(IDX_FILE + '.tmp', JSON.stringify(s));
  await rename(IDX_FILE + '.tmp', IDX_FILE);
  return s;
}
