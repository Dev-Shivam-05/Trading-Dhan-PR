/**
 * `npm run sleep:test` — the unit half of `docs/spec/sleep-proof-v1.md` (P36).
 *
 * AC1 replays Thursday 24 Sep through the trader, using the real Dhan candles P31 captured
 * (`test/fixtures/paper-2026-09-24/`). The laptop slept from 10:40:04 to 17:45:35. The expected exits
 * are derived here a second way, from the raw arrays by hand, and are not taken from the trader.
 * Every rule is also shown REJECTING: a gap under a minute, a gap with nothing due, a retry before
 * 60 s, a tick while awaiting. The clock is injected everywhere.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  PaperTrader, holdAwake, emptyLedger, ist, GAP_MS, RETRY_MS,
  type Bar, type CandleAnswer, type Ledger, type Position,
} from '../src/server/paper.ts';
import { toUCandles, inSession, type UCandle } from '../src/server/ucandles.ts';
import { dhanPost } from '../src/server/dhan.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

const FIX = 'test/fixtures/paper-2026-09-24';
const DAY = '2026-09-24';
const at = (hh: number, mm: number, ss = 0, day = DAY) => Date.parse(`${day}T00:00:00Z`) - 5.5 * 3600_000 + ((hh * 60 + mm) * 60 + ss) * 1000;
const load = async (name: string) => JSON.parse(await readFile(path.join(FIX, `${name}.json`), 'utf8'));
const paisePnl = (side: string, entry: number, exit: number, qty: number) =>
  ((Math.round(exit * 100) - Math.round(entry * 100)) * qty * (side === 'BUY' ? 1 : -1)) / 100;

const raw: Record<string, any> = {};
for (const n of ['MFSL-5m', 'MFSL-1m', 'MFSL-PE-1m', 'POLICYBZR-5m', 'POLICYBZR-1m', 'POLICYBZR-PE-1m']) raw[n] = await load(n);
const closed = await load('ledger-as-closed');

/** The ledger as it stood at 10:40:04, before the sleep: every leg open, nothing exited. */
function before(): Ledger {
  const l: Ledger = JSON.parse(JSON.stringify(closed));
  for (const p of l.positions as Position[]) {
    p.status = 'open'; p.exitPx = null; p.exitAt = null; p.reason = null; p.pnl = null; p.note = null;
  }
  l.aliveAt = at(10, 40, 4);
  return l;
}

const idToName = (securityId: number, leg: string) => {
  const p = (closed.positions as Position[]).find(x => x.securityId === securityId)!;
  return `${p.symbol}${leg === 'option' ? '-PE' : ''}`;
};

type Calls = { five: number; minute: number };
async function trader(l: Ledger, wall: { t: number }, opts: { failFive?: boolean; failMinute?: boolean } = {}, calls: Calls = { five: 0, minute: 0 }, awake: boolean[] = []) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sleep-test-'));
  const file = path.join(dir, 'ledger.json');
  await writeFile(file, JSON.stringify(l));
  const t = new PaperTrader({
    file, mode: 'live', wall: () => wall.t,
    lookup: () => undefined, scan: async () => { throw new Error('no scan in this test'); },
    candles: async (ask): Promise<CandleAnswer> => {
      calls.five++;
      if (opts.failFive) return { bars: [], why: 'network: fetch failed' };
      const p = (closed.positions as Position[]).find(x => x.securityId === ask.securityId)!;
      return { bars: toUCandles(raw[`${p.symbol}-5m`]), why: null };
    },
    minuteBars: async (ask): Promise<CandleAnswer> => {
      calls.minute++;
      if (opts.failMinute) return { bars: [], why: 'network: fetch failed' };
      return { bars: toUCandles(raw[`${idToName(ask.securityId, ask.leg)}-1m`]), why: null };
    },
    options: () => [], onWants: () => {}, onAwake: h => awake.push(h),
  });
  return { t, dir };
}

/* ------------------------------------------------ the expected exits, by hand */

/** Second implementation: raw arrays, no helpers from paper.ts or ucandles.ts. */
function handExit(sym: string, side: 'BUY' | 'SELL', entryAt: number) {
  const r = raw[`${sym}-5m`];
  const n = r.timestamp.length;
  const ms = (i: number) => r.timestamp[i] * 1000;
  const sq = at(15, 15);
  let against = 0;
  for (let i = 8; i < n; i++) {
    const t = ms(i);
    // Completed before 15:15 (the 15:10 candle completes AT 15:15, after the square-off).
    if (t < Math.floor(entryAt / 300_000) * 300_000 || t + 300_000 > sq - 1) continue;
    let s = 0; for (let k = i - 8; k <= i; k++) s += r.close[k];
    const sma = s / 9;
    const wrong = side === 'BUY' ? r.close[i] < sma : r.close[i] > sma;
    against = wrong ? against + 1 : 0;
    if (against >= 2) return { dueAt: t + 300_000, reason: 'sma' };
  }
  return { dueAt: sq, reason: 'eod' };
}
function handMinuteOpen(name: string, dueAt: number) {
  const r = raw[`${name}-1m`];
  const m = Math.floor(dueAt / 60_000) * 60_000;
  for (let i = 0; i < r.timestamp.length; i++) if (r.timestamp[i] * 1000 >= m) return r.open[i] as number;
  return null;
}

/* ------------------------------------------------------------------ AC1 */

for (const path_ of ['restart', 'sleep'] as const) {
  const wall = { t: path_ === 'restart' ? at(17, 45, 35) : at(10, 40, 3) };
  const l = before();
  if (path_ === 'sleep') l.aliveAt = at(10, 40, 3);
  const calls = { five: 0, minute: 0 };
  const { t, dir } = await trader(l, wall, {}, calls);
  await t.load();
  if (path_ === 'sleep') {
    await t.step();                       // 10:40:03, awake: nothing is due
    ok(`AC3 [${path_}]: an awake step marks nothing`, t.ledger.positions.every(p => !p.awaiting && p.status === 'open'));
    wall.t = at(17, 45, 35);
  }
  await t.step();                         // wake
  let total = 0, handTotal = 0;
  for (const p of t.ledger.positions) {
    const fut = (t.ledger.positions.find(x => x.id === (p.parentId ?? p.id)))!;
    const e = handExit(fut.symbol, fut.side, fut.entryAt!);
    const name = `${p.symbol}${p.leg === 'option' ? '-PE' : ''}`;
    const px = handMinuteOpen(name, e.dueAt);
    const side = p.leg === 'option' ? 'BUY' : p.side;
    const hand = px === null ? null : paisePnl(side, p.entryPx!, px, p.qty);
    total += p.pnl ?? NaN; handTotal += hand ?? NaN;
    ok(`AC1 [${path_}]: ${name} closes at its due minute's open`,
      p.status === 'closed' && p.repriced === true && p.exitAt === e.dueAt && p.reason === e.reason && p.exitPx === px && p.pnl === hand,
      `${p.status} ${p.reason} at ${p.exitAt ? ist(p.exitAt).hms : '—'} ${p.exitPx} pnl ${p.pnl} · hand ${e.reason} ${ist(e.dueAt).hms} ${px} ${hand}`);
  }
  ok(`AC1 [${path_}]: total equals the hand total and P31's 2,28,672.50`,
    Math.abs(total - handTotal) < 0.005 && Math.abs(total - 228672.5) < 0.005, `${total.toFixed(2)} vs hand ${handTotal.toFixed(2)}`);
  const mf = t.ledger.positions.find(p => p.id === '2026-09-24-MFSL')!;
  ok(`AC1 [${path_}]: the note names the gap and the minute`, /asleep 10:40–17:45 · priced from Dhan's 10:55 1-minute candle open/.test(mf.note ?? ''), mf.note ?? '');
  ok(`AC1 [${path_}]: one 5-minute read per future, one 1-minute read per leg`, calls.five === 2 && calls.minute === 4, JSON.stringify(calls));
  await rm(dir, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ AC2 */

{
  const wall = { t: at(17, 45, 35) };
  const calls = { five: 0, minute: 0 };
  const { t, dir } = await trader(before(), wall, { failFive: true }, calls);
  await t.load();
  await t.step();
  const open = () => t.ledger.positions.filter(p => p.status === 'open');
  ok('AC2: a failed read leaves all four legs open and awaiting', open().length === 4 && open().every(p => p.awaiting), `${open().length} open, calls ${calls.five}`);
  t.onFeedTick({ seg: 'NSE_FNO', securityId: 68691, ltp: 1300 } as any);
  ok('AC2: a tick does not close an awaiting leg', t.ledger.positions.find(p => p.id === '2026-09-24-MFSL')!.status === 'open');
  wall.t += RETRY_MS - 1000; await t.step();
  // One attempt reads both futures' 5-minute candles, so an attempt is 2 reads.
  ok('AC2: no retry before 60 s', calls.five === 2, `${calls.five} reads`);
  wall.t += 1000; await t.step();
  ok('AC2: a retry at 60 s', calls.five === 4, `${calls.five} reads`);
  ok('AC2: 15:15 has passed and still nothing closed at a tick', open().length === 4);
  wall.t = at(9, 0, 0, '2026-09-25'); await t.step();
  const mf = t.ledger.positions.find(p => p.id === '2026-09-24-MFSL')!;
  ok('AC2: the date change closes them stale, naming the gap and the last tick',
    t.ledger.positions.every(p => p.status === 'closed' && p.stale && p.reason === 'stale') && /machine asleep from 10:40.*last tick \(1\d:\d\d\)/.test(mf.note ?? ''), mf.note ?? '');
  await rm(dir, { recursive: true, force: true });
}
{
  // The 5-minute read works but a 1-minute read fails: the signal stays whole — no leg is priced alone.
  const wall = { t: at(17, 45, 35) };
  const { t, dir } = await trader(before(), wall, { failMinute: true });
  await t.load();
  await t.step();
  ok('AC2: a failed 1-minute read prices no leg, and dueAt is kept for the retry',
    t.ledger.positions.every(p => p.status === 'open' && p.awaiting?.dueAt), t.ledger.positions.map(p => p.awaiting?.reason).join(','));
  await rm(dir, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ AC3 */

{
  const wall = { t: at(10, 40, 0) };
  const l = before(); l.aliveAt = at(10, 40, 0);
  const calls = { five: 0, minute: 0 };
  const { t, dir } = await trader(l, wall, {}, calls);
  await t.load(); await t.step();
  wall.t += GAP_MS - 1000; await t.step();
  ok('AC3: a 59 s gap marks nothing', t.ledger.positions.every(p => !p.awaiting), `${calls.five} reads`);
  await rm(dir, { recursive: true, force: true });
}
{
  // Asleep 10:40 -> 10:50:30: MFSL's 10:45 close is the FIRST against (the 10:50 candle is still forming).
  const wall = { t: at(10, 40, 0) };
  const l = before(); l.aliveAt = at(10, 40, 0);
  const calls = { five: 0, minute: 0 };
  const { t, dir } = await trader(l, wall, {}, calls);
  await t.load(); await t.step();
  wall.t = at(10, 50, 30); await t.step();
  const mf = t.ledger.positions.find(p => p.id === '2026-09-24-MFSL')!;
  ok('AC3: a gap with nothing due releases every leg to the live rules',
    t.ledger.positions.every(p => p.status === 'open' && !p.awaiting) && mf.against === 1 && calls.minute === 0,
    `MFSL against ${mf.against}, 1m reads ${calls.minute}`);
  await rm(dir, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ AC4 */

{
  const l = emptyLedger('live');
  l.armed = true;
  ok('AC4: 09:09:59 armed, no scan yet -> no hold', !holdAwake(l, at(9, 9, 59)));
  ok('AC4: 09:10:00 armed, no scan yet -> hold', holdAwake(l, at(9, 10)));
  l.armed = false;
  ok('AC4: disarmed -> no hold', !holdAwake(l, at(9, 30)));
  l.armed = true;
  ok('AC4: Saturday -> no hold', !holdAwake(l, at(10, 0, 0, '2026-09-26')));
  const done = before(); done.armed = true;
  ok('AC4: scan done, legs open, 15:34:59 -> hold', holdAwake(done, at(15, 34, 59)));
  ok('AC4: 15:35 -> released', !holdAwake(done, at(15, 35)));
  for (const p of done.positions) p.status = 'closed';
  ok('AC4: scan done and every leg closed -> released', !holdAwake(done, at(11, 0)));
  done.days[DAY]!.status = 'no-trades';
  ok('AC4: a no-trades day -> released', !holdAwake(done, at(11, 0)));

  const wall = { t: at(10, 40, 0) };
  const l2 = before(); l2.aliveAt = at(10, 40, 0);
  const seen: boolean[] = [];
  const { t, dir } = await trader(l2, wall, {}, undefined, seen);
  await t.load(); await t.step();
  wall.t = at(17, 45, 35); await t.step();
  ok('AC4: the shell asks for the hold at 10:40 and releases it after', seen.join(',') === 'true,false', seen.join(','));
  await rm(dir, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ AC5 */

{
  const realFetch = globalThis.fetch;
  const log: { i: number; start: number; end: number }[] = [];
  let n = 0;
  globalThis.fetch = (async () => {
    const i = n++; const start = performance.now();
    await new Promise(r => setTimeout(r, 300));
    log.push({ i, start, end: performance.now() });
    return new Response('{"data":{}}', { status: 200 });
  }) as typeof fetch;
  const creds = { clientId: 'x', accessToken: 'y' };
  await Promise.all([
    dhanPost('/v2/marketfeed/quote', {}, { creds, key: 'ac5', cadenceMs: 1000 }),
    dhanPost('/v2/marketfeed/quote', {}, { creds, key: 'ac5', cadenceMs: 1000 }),
  ]);
  globalThis.fetch = realFetch;
  const [a, b] = log.sort((x, y) => x.i - y.i);
  ok('AC5: two calls issued together on one key: the second leaves >= 1000 ms after the first completes',
    !!a && !!b && b.start - a.end >= 999, a && b ? `gap ${(b.start - a.end).toFixed(0)} ms` : 'missing');

  const poller = await readFile('src/server/poller.ts', 'utf8');
  const scanner = await readFile('src/server/scanner.ts', 'utf8');
  ok('AC5: the spot quote and the scanner quote share MARKETFEED_KEY',
    /const SPOT_KEY = MARKETFEED_KEY/.test(poller) && /const QUOTE_KEY = MARKETFEED_KEY/.test(scanner));
}

/* ------------------------------------------------------------ row 5, unit */

{
  const k = (d: string, hhmm: string): UCandle => ({ t: 0, at: hhmm, d, o: 1, h: 1, l: 1, c: 1, v: 0 });
  const nse = inSession([k(DAY, '15:25'), k(DAY, '15:39'), k(DAY, '15:40'), k(DAY, '17:55')], 'NSE_BSE_FNO').map(x => x.at);
  ok('row 5: NSE keeps 15:25 and 15:39, drops 15:40 and 17:55', nse.join(',') === '15:25,15:39', nse.join(','));
  // MCX closes 23:30 in US summer time (Sep) and 23:55 in winter (Dec).
  const sep = inSession([k(DAY, '23:35'), k(DAY, '23:40')], 'MCX').map(x => x.at);
  const dec = inSession([k('2026-12-10', '23:59')], 'MCX').map(x => x.at);
  ok('row 5: MCX in September keeps 23:35, drops 23:40; December keeps 23:59', sep.join(',') === '23:35' && dec.length === 1, `${sep.join(',')} / ${dec.length}`);
}

console.log(`\n${pass} pass · ${fail} fail`);
process.exitCode = fail ? 1 : 0;
