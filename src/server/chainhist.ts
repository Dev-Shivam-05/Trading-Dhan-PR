/**
 * P48 — rebuild NIFTY's past minute chains from Dhan's Expired Options Data. `docs/spec/chain-rebuild-v1.md`.
 *
 * `POST /v2/charts/rollingoption` answers "the option that sat at ATM+n, minute by minute", not
 * "strike K". So one day's chain is stitched back together from 42 series (ATM-10..ATM+10 x CALL/PUT,
 * row 1): every candle carries its own `strike`, and the leg is filed under that strike. A strike that
 * sat outside ±10 for part of the day has `null` for those minutes (row 5).
 *
 * Rules that must not drift (the same ones as history.ts / train-data.ts):
 *  - every call shares ONE gate key, `history`, at 1100 ms (row 3)
 *  - only complete sessions: before 16:00 IST today is never fetched (row 4)
 *  - a day is written only when all 42 series returned it; a fetched month is never fetched again (row 7)
 *  - replay mode refuses: this directory holds real market data
 * The stitching and the recording comparison are pure, so `chainhist:test` runs without the network.
 */

import { readFile, writeFile, mkdir, rename, readdir, statfs } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dhanPost, type Credentials, type DhanCall } from './dhan.ts';
import { isReplay } from './replay.ts';
import { HISTORY_DIR, lastComplete } from './history.ts';

export const CHAIN_HIST_DIR = path.join(HISTORY_DIR, 'chains', 'NIFTY');
const KEY = 'history';
const CADENCE_MS = 1100;
/** Row 1: M3 measured the endpoint's ceiling at exactly ±10; ±11 answers ok with zero candles. */
export const OFFSETS = Array.from({ length: 21 }, (_, i) => i - 10);
export const SIDES = ['CALL', 'PUT'] as const;
export type Side = typeof SIDES[number];
/** Row 2: WEEK 1 over the whole history, WEEK 2 only where P47 records a second expiry. */
export const CODES = [{ code: 1, from: '2024-01-01' }, { code: 2, from: '2026-09-01' }] as const;
/** Row 6 (GUESS): the tick recorder's one-day need (~1.2 GB) plus margin. */
export const MIN_FREE_BYTES = 2e9;
const IST_MS = 5.5 * 3600_000;
const FIELDS = ['open', 'high', 'low', 'close', 'iv', 'volume', 'strike', 'oi', 'spot'];

export type RollSeries = { timestamp?: number[]; open?: number[]; high?: number[]; low?: number[]; close?: number[]; iv?: number[]; volume?: number[]; strike?: number[]; oi?: number[]; spot?: number[] };
type Col = (number | null)[];
export type Leg = { o: Col; h: Col; l: Col; c: Col; v: Col; oi: Col; iv: Col };
/** Row 5: one stored day. Every leg's arrays align to `t` (epoch ms, minute open). */
export type ChainDay = { date: string; code: number; t: number[]; spot: Col; atm: Col; legs: Record<string, Leg>; conflicts: number };
export type DaySummary = { candles: number; legs: number; fullLegs: number; conflicts: number };
export type ChainIndex = {
  /** `W<code>-<YYYY-MM>` -> the last date that month has been fetched to. */
  months: Record<string, string>;
  days: Record<string, Partial<Record<'W1' | 'W2', DaySummary>>>;
  /** Days some series did not return: never written, listed so they are seen. */
  incomplete: Record<string, string>;
  /** Row 8: date -> the WEEK 1 / WEEK 2 expiry, from the calendar rule. AC4 checks it against the data. */
  expiries: Record<string, { W1: string; W2: string }>;
};

export const offsetName = (o: number) => (o === 0 ? 'ATM' : o > 0 ? `ATM+${o}` : `ATM${o}`);
export const istDate = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const legKey = (strike: number, side: Side) => `${strike}${side === 'CALL' ? 'CE' : 'PE'}`;
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/* ------------------------------------------------------------------ stitching (pure) */

/**
 * Row 5: 42 series of one span -> one ChainDay per session date. A day missing from any series is
 * reported, not written (row 7). A strike seen under two offsets in the same minute must agree on
 * every field; if not, `conflicts` counts it and the first value is kept.
 */
export function stitch(series: Map<string, RollSeries>, code: number, dates?: (d: string) => boolean): { days: ChainDay[]; incomplete: Record<string, string> } {
  const perDate = new Map<string, Set<number>>();          // date -> minute stamps (ms)
  const seriesDates = new Map<string, Set<string>>();       // series -> dates it has
  for (const [name, s] of series) {
    const got = new Set<string>();
    for (const t of s.timestamp ?? []) {
      const ms = t > 1e11 ? t : t * 1000, d = istDate(ms);
      if (dates && !dates(d)) continue;
      got.add(d);
      if (!perDate.has(d)) perDate.set(d, new Set());
      perDate.get(d)!.add(ms);
    }
    seriesDates.set(name, got);
  }
  const days: ChainDay[] = [], incomplete: Record<string, string> = {};
  for (const date of [...perDate.keys()].sort()) {
    const missing = [...series.keys()].filter(n => !seriesDates.get(n)!.has(date));
    if (missing.length || series.size < OFFSETS.length * SIDES.length) {
      incomplete[date] = `W${code}: ${missing.length + OFFSETS.length * SIDES.length - series.size} of ${OFFSETS.length * SIDES.length} series missing (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', ...' : ''})`;
      continue;
    }
    const t = [...perDate.get(date)!].sort((a, b) => a - b);
    const ix = new Map(t.map((ms, i) => [ms, i]));
    const day: ChainDay = { date, code, t, spot: t.map(() => null), atm: t.map(() => null), legs: {}, conflicts: 0 };
    for (const [name, s] of series) {
      const [off, side] = name.split('|') as [string, Side];
      (s.timestamp ?? []).forEach((raw, j) => {
        const ms = raw > 1e11 ? raw : raw * 1000, i = ix.get(ms);
        const strike = num(s.strike?.[j]);
        if (i === undefined || strike === null) return;
        if (day.spot[i] === null) day.spot[i] = num(s.spot?.[j]);
        if (off === '0' && side === 'CALL') day.atm[i] = strike;
        const k = legKey(strike, side);
        const leg = day.legs[k] ??= { o: t.map(() => null), h: t.map(() => null), l: t.map(() => null), c: t.map(() => null), v: t.map(() => null), oi: t.map(() => null), iv: t.map(() => null) };
        const vals: [keyof Leg, number | null][] = [['o', num(s.open?.[j])], ['h', num(s.high?.[j])], ['l', num(s.low?.[j])], ['c', num(s.close?.[j])], ['v', num(s.volume?.[j])], ['oi', num(s.oi?.[j])], ['iv', num(s.iv?.[j])]];
        if (leg.c[i] !== null) { if (vals.some(([f, x]) => leg[f][i] !== x)) day.conflicts++; return; }
        for (const [f, x] of vals) leg[f][i] = x;
      });
    }
    days.push(day);
  }
  return { days, incomplete };
}

export function summarise(d: ChainDay): DaySummary {
  const legs = Object.values(d.legs);
  return { candles: d.t.length, legs: legs.length, fullLegs: legs.filter(l => l.c.every(x => x !== null)).length, conflicts: d.conflicts };
}

/* ------------------------------------------------------------------ expiry calendar (row 8) */

/** Row 8 (GUESS, checked by AC4): NIFTY weeklies expired on Thursdays up to 2025-08-28, on Tuesdays from 2025-09-01. */
export const TUESDAY_FROM = '2025-09-01';
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

/**
 * The nominal weekly expiry on or after `d`, moved to the previous session when that day had no
 * session. `sessions` are the dates the data itself has; beyond the last one, a nominal day is assumed open.
 */
export function weeklyExpiry(d: string, sessions: Set<string>, lastSession: string): string {
  let e = d;
  for (;;) {
    const wd = e < TUESDAY_FROM ? 4 : 2;
    if (weekday(e) === wd) break;
    e = addDays(e, 1);
  }
  if (e <= lastSession && !sessions.has(e)) {
    let p = addDays(e, -1);
    while (!sessions.has(p) && p > d) p = addDays(p, -1);
    // The holiday-moved expiry can not fall before the day being labelled: if it would, `d` IS that day.
    if (sessions.has(p) && p >= d) return p;
    return weeklyExpiry(addDays(e, 1), sessions, lastSession);
  }
  return e;
}

export function labelExpiries(sessionList: string[]): ChainIndex['expiries'] {
  const sessions = new Set(sessionList), last = [...sessions].sort().at(-1) ?? '';
  const out: ChainIndex['expiries'] = {};
  for (const d of [...sessions].sort()) {
    const w1 = weeklyExpiry(d, sessions, last);
    out[d] = { W1: w1, W2: weeklyExpiry(addDays(w1, 1), sessions, last) };
  }
  return out;
}

/* ------------------------------------------------------------------ files */

const dayFile = (date: string, code: number) => path.join(CHAIN_HIST_DIR, `${date}-W${code}.json.gz`);
const indexFile = () => path.join(CHAIN_HIST_DIR, 'index.json');

export async function readIndex(): Promise<ChainIndex> {
  try {
    const x = JSON.parse(await readFile(indexFile(), 'utf8')) as ChainIndex;
    return { months: x.months ?? {}, days: x.days ?? {}, incomplete: x.incomplete ?? {}, expiries: x.expiries ?? {} };
  } catch { return { months: {}, days: {}, incomplete: {}, expiries: {} }; }
}
async function atomic(file: string, data: string | Buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', data);
  await rename(file + '.tmp', file);
}
export const writeIndex = (x: ChainIndex) => atomic(indexFile(), JSON.stringify(x, null, 1));
export async function writeDay(d: ChainDay) { await atomic(dayFile(d.date, d.code), gzipSync(JSON.stringify(d))); }
export async function readDay(date: string, code = 1): Promise<ChainDay | null> {
  try { return JSON.parse(gunzipSync(await readFile(dayFile(date, code))).toString('utf8')) as ChainDay; } catch { return null; }
}
export async function storedDays(code = 1): Promise<string[]> {
  try {
    return (await readdir(CHAIN_HIST_DIR)).map(f => /^(\d{4}-\d\d-\d\d)-W(\d)\.json\.gz$/.exec(f)).filter(m => m && Number(m[2]) === code).map(m => m![1]!).sort();
  } catch { return []; }
}

/* ------------------------------------------------------------------ fetch */

export type Post = (body: Record<string, unknown>) => Promise<DhanCall<any>>;
export type FetchLog = { calls: number; failed: string[]; written: number; bytes: number };

/** Calendar months [from, to] (row 3): each is at most 31 days, inside M4's measured 32. */
export function months(from: string, to: string): { key: string; a: string; b: string }[] {
  const out = [];
  for (let m = from.slice(0, 7); `${m}-01` <= to;) {
    const a = `${m}-01` < from ? from : `${m}-01`;
    const [y, mo] = m.split('-').map(Number) as [number, number];
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    const end = addDays(`${next}-01`, -1);
    out.push({ key: m, a, b: end < to ? end : to });
    m = next;
  }
  return out;
}

/** P44's rule: a retryable failure (805, a timeout) gets two more tries, 3 s apart. */
async function withRetry(f: () => Promise<DhanCall<any>>, pauseMs: number): Promise<DhanCall<any>> {
  let r = await f();
  for (let i = 0; i < 2 && !r.ok && r.error?.retryable; i++) { await new Promise(res => setTimeout(res, pauseMs)); r = await f(); }
  return r;
}

export type UpdateDeps = { post?: Post; freeBytes?: () => Promise<number>; retryPauseMs?: number; codes?: readonly { code: number; from: string }[] };

/** Rows 2-8: fetch every month not yet fetched, stitch it, write its complete days, relabel expiries. */
export async function updateChainHistory(creds: Credentials | null, nowMs: number, log: FetchLog, say: (m: string) => void = () => {}, deps: UpdateDeps = {}) {
  if (isReplay()) throw new Error('the chain history is real market data - it refuses to run in replay mode');
  const free = await (deps.freeBytes ?? (async () => { await mkdir(CHAIN_HIST_DIR, { recursive: true }); const s = await statfs(CHAIN_HIST_DIR); return s.bavail * s.bsize; }))();
  if (free < MIN_FREE_BYTES) throw new Error(`only ${(free / 1e9).toFixed(2)} GB free on the cache disk; the chain rebuild needs ${MIN_FREE_BYTES / 1e9} GB (spec row 6)`);
  const post: Post = deps.post ?? (body => dhanPost<any>('/v2/charts/rollingoption', body, { creds: creds!, key: KEY, cadenceMs: CADENCE_MS, timeoutMs: 30_000 }));
  const lastDay = lastComplete(nowMs);
  const idx = await readIndex();
  for (const { code, from } of deps.codes ?? CODES) {
    for (const m of months(from, lastDay)) {
      const mk = `W${code}-${m.key}`;
      const done = idx.months[mk];
      if (done && done >= m.b) continue;
      const a = done ? addDays(done, 1) : m.a;
      const series = new Map<string, RollSeries>();
      let failed = false;
      for (const side of SIDES) for (const off of OFFSETS) {
        if (failed) continue;
        const body = { exchangeSegment: 'NSE_FNO', interval: '1', securityId: 13, instrument: 'OPTIDX', expiryFlag: 'WEEK', expiryCode: code,
          strike: offsetName(off), drvOptionType: side, requiredData: FIELDS, fromDate: a, toDate: addDays(m.b, 1) };
        log.calls++;
        const r = await withRetry(() => post(body), deps.retryPauseMs ?? 3000);
        if (!r.ok) { failed = true; log.failed.push(`${mk} ${offsetName(off)} ${side}: ${r.error?.code} ${r.error?.message ?? ''}`.trim()); continue; }
        const d = r.data?.data ?? r.data;
        series.set(`${off}|${side}`, (side === 'CALL' ? d?.ce : d?.pe) ?? {});
      }
      if (failed) { say(`${mk}: a series failed - month skipped, it is fetched again next run`); continue; }
      const { days, incomplete } = stitch(series, code, d => d >= a && d <= m.b);
      for (const day of days) {
        await writeDay(day);
        log.written++;
        (idx.days[day.date] ??= {})[`W${code}` as 'W1' | 'W2'] = summarise(day);
        delete idx.incomplete[`${day.date}-W${code}`];
      }
      for (const [d, why] of Object.entries(incomplete)) idx.incomplete[`${d}-W${code}`] = why;
      idx.months[mk] = m.b;
      idx.expiries = labelExpiries(Object.keys(idx.days));
      await writeIndex(idx);
      say(`${mk}: ${days.length} days written, ${Object.keys(incomplete).length} incomplete, ${log.calls} calls so far`);
    }
  }
  idx.expiries = labelExpiries(Object.keys(idx.days));
  await writeIndex(idx);
  return { lastDay, idx };
}

/* ------------------------------------------------------------------ AC3: against P47's recording (pure) */

/** P47's snapshot as recorded (`chainrec.ts` row 4). Tuples: strike, ceLtp, ceVol, ceOi, ceOiChg, ceIv, peLtp, peVol, peOi, peOiChg, peIv. */
export type RecordedSnap = { t: number; rows: (number | null)[][] };
export type RecordingCompare = {
  snaps: number; cells: number;
  strikesOutside: number;
  ltp: { checked: number; inside: number; outside: string[] };
  oi: { checked: number; equal: number; worst: string[] };
  vol: { legs: number; worstPct: number; worst: string };
};

/**
 * AC3. A snapshot's time is its local receive time, and this PC's clock runs ~4.6 s behind the
 * exchange (CLAUDE.md, measured 24 Sep), so `skewMs` is added before a snapshot is put in a minute.
 * Snapshots within `guardMs` of a minute boundary are left out of (b) and (c): which candle they
 * belong to is not knowable to better than the skew plus the round trip.
 */
export function compareRecording(day: ChainDay, snaps: RecordedSnap[], skewMs = 4600, guardMs = 3000): RecordingCompare {
  const ix = new Map(day.t.map((ms, i) => [ms, i]));
  const out: RecordingCompare = { snaps: snaps.length, cells: 0, strikesOutside: 0, ltp: { checked: 0, inside: 0, outside: [] }, oi: { checked: 0, equal: 0, worst: [] }, vol: { legs: 0, worstPct: 0, worst: '' } };
  const recorded = new Set<number>();
  for (const s of snaps) for (const r of s.rows) if (r[0] !== null) recorded.add(r[0]!);
  // (a) every rebuilt strike lies inside what the recording carried that day
  for (const k of Object.keys(day.legs)) if (!recorded.has(Number(k.slice(0, -2)))) out.strikesOutside++;
  const hm = (ms: number) => new Date(ms + IST_MS).toISOString().slice(11, 19);
  for (const s of snaps) {
    const true_ = s.t + skewMs, m0 = true_ - (true_ % 60_000), into = true_ - m0;
    if (into < guardMs || into > 60_000 - guardMs) continue;
    const i = ix.get(m0);
    if (i === undefined) continue;
    for (const r of s.rows) {
      for (const [side, li, oii] of [['CE', 1, 3], ['PE', 6, 8]] as const) {
        const leg = day.legs[`${r[0]}${side}`];
        if (!leg || leg.c[i] === null) continue;
        out.cells++;
        const ltp = r[li], oi = r[oii];
        if (ltp !== null && ltp !== undefined && ltp > 0) {
          out.ltp.checked++;
          // (b) an invariant, not a tolerance: the traded price inside that minute's range
          if (ltp >= leg.l[i]! - 1e-9 && ltp <= leg.h[i]! + 1e-9) out.ltp.inside++;
          else if (out.ltp.outside.length < 10) out.ltp.outside.push(`${hm(s.t)} ${r[0]}${side} ltp ${ltp} vs [${leg.l[i]}, ${leg.h[i]}]`);
        }
        if (oi !== null && oi !== undefined) {
          out.oi.checked++;
          const prev = i > 0 ? leg.oi[i - 1] : null;
          if (oi === leg.oi[i] || (prev !== null && oi === prev)) out.oi.equal++;
          else if (out.oi.worst.length < 10) out.oi.worst.push(`${hm(s.t)} ${r[0]}${side} oi ${oi} vs ${leg.oi[i]} / ${prev}`);
        }
      }
    }
  }
  // (d) the day's last recorded cumulative volume against the summed minute volume, legs covered all day
  const last = snaps.at(-1);
  if (last) for (const r of last.rows) for (const [side, vi] of [['CE', 2], ['PE', 7]] as const) {
    const leg = day.legs[`${r[0]}${side}`], rv = r[vi];
    if (!leg || rv === null || rv === undefined || !rv || leg.v.some(x => x === null)) continue;
    const sum = leg.v.reduce<number>((a, x) => a + x!, 0), pct = Math.abs(sum - rv) / rv * 100;
    out.vol.legs++;
    if (pct >= out.vol.worstPct) { out.vol.worstPct = pct; out.vol.worst = `${r[0]}${side} summed ${sum} vs recorded ${rv}`; }
  }
  return out;
}
