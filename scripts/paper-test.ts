/**
 * `npm run paper:test` — the unit half of `docs/spec/paper-trading-v1.md`: AC1-AC5, plus the
 * replay clock (amendment 19) and the ledger-per-mode rule (row 13).
 *
 * Every rule is shown REJECTING something, not only accepting: a tick 0.01 short of each level, a
 * scan at 59 s instead of 60, an arm at 09:31, a 12-signal day against a cap of 10. A fixture that
 * only ever agrees has not tested the filter (CLAUDE.md, P8's 210 -> 100 -> 100 -> 6).
 *
 * The clock is injected everywhere. Nothing here depends on when it is run.
 */

import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyScan, emptyLedger, exitFor, freshness, ist, istAt, ledgerPath, levels, onClock, onTick,
  planEntries, pnlOf, scanDue, arm, view, PaperTrader,
  ENTRY_UNTIL_MIN, MAX_POSITIONS, RETRY_MS, SCAN_AT_MIN, SQUARE_OFF_MIN,
  type Contract, type Ledger, type Position,
} from '../src/server/paper.ts';
import { fetchNseBundle } from '../src/server/nse.ts';
import { nseFunnel, parseFnoList, type NseScanResult, type NseScanRow } from '../src/server/scanner-nse.ts';
import { resolveRegistry, fnoUniverse, todayIso } from '../src/server/instruments.ts';
import { loadMaster } from '../src/server/master.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/** 09:20 IST on 17 Sep 2026 — the date the committed NSE fixture was captured. */
const DAY = '2026-09-17';
const at = (hh: number, mm: number, ss = 0) => Date.parse(`${DAY}T00:00:00Z`) - 5.5 * 3600_000 + ((hh * 60 + mm) * 60 + ss) * 1000;
const T0920 = at(9, 20);

/** Second implementation of P&L, in integer paise: no float multiply until the last divide. */
const paisePnl = (side: string, entry: number, exit: number, qty: number) =>
  ((Math.round(exit * 100) - Math.round(entry * 100)) * qty * (side === 'BUY' ? 1 : -1)) / 100;

/* ------------------------------------------------------------------ AC1 */

{
  const src = await readFile('src/server/paper.ts', 'utf8');
  const imports = src.split('\n').filter(l => /^import\b/.test(l));
  ok('AC1: paper.ts imports nothing from dhan.ts (or instruments.ts, which imports it)',
    !imports.some(l => /dhan\.ts|instruments\.ts/.test(l)), imports.map(l => l.replace(/^import .* from /, '')).join(' '));

  const { readdir } = await import('node:fs/promises');
  const files = (await readdir('src/server')).filter(f => f.endsWith('.ts'));
  const hits: string[] = [];
  for (const f of files) {
    const body = await readFile(path.join('src/server', f), 'utf8');
    for (const m of body.matchAll(/\/v2\/(super\/)?orders|\/v2\/forever|placeOrder|\/v2\/positions\/convert/gi)) hits.push(`${f}: ${m[0]}`);
  }
  ok('AC1: no Dhan order endpoint anywhere in src/server', hits.length === 0, hits.join(', ') || `${files.length} files clean`);
}

/* ------------------------------------------------------------------ AC2 */

process.env.REPLAY = '1';   // no GOLD auto-resolve network call from resolveRegistry
process.env.NSE_FIXTURE = 'test/fixtures/nse-2026-09-17';
await resolveRegistry({});
const lookup = (s: string): Contract | undefined => fnoUniverse(todayIso()).find(x => x.symbol === s);

const bundle = await fetchNseBundle();
const list = parseFnoList(await readFile('data/fno-list.txt', 'utf8'));
const fixtureScan = { ...nseFunnel(bundle, list, 20, T0920), reused: false } as NseScanResult;

{
  const l = emptyLedger('replay');
  const r = applyScan(l, fixtureScan, lookup, T0920, true);
  const buys = l.positions.filter(p => p.side === 'BUY').map(p => p.symbol);
  const sells = l.positions.filter(p => p.side === 'SELL').map(p => p.symbol).sort();
  ok('AC2: the fixture scan is accepted at 09:20', r.ok, r.ok ? '' : r.reason);
  ok('AC2: exactly 1 BUY — MFSL', JSON.stringify(buys) === '["MFSL"]', JSON.stringify(buys));
  ok('AC2: exactly 3 SELL — FEDERALBNK, PNBHOUSING, POLICYBZR',
    JSON.stringify(sells) === '["FEDERALBNK","PNBHOUSING","POLICYBZR"]', JSON.stringify(sells));

  // Second implementation of "the master's lot": earliest live NSE FUTSTK for the symbol, read
  // straight from the master rows rather than through fnoUniverse().
  const { rows } = await loadMaster();
  const today = todayIso();
  const masterLot = (sym: string) => rows
    .filter(x => x.instrument === 'FUTSTK' && x.exchId === 'NSE' && x.underlyingSymbol === sym && x.expiry !== null && x.expiry >= today)
    .sort((a, b) => a.expiry!.localeCompare(b.expiry!))[0];
  const lots = l.positions.map(p => {
    const m = masterLot(p.symbol);
    return { sym: p.symbol, qty: p.qty, lot: p.lot, master: m?.lotSize, id: p.securityId, mid: m?.securityId };
  });
  ok('AC2: each position is 1 lot, equal to the master\'s lot, on the master\'s near-month future',
    lots.length === 4 && lots.every(x => x.qty === x.master && x.lot === x.master && x.id === x.mid),
    lots.map(x => `${x.sym} qty ${x.qty} master ${x.master}`).join(', '));
  ok('AC2: every position starts pending with no fill', l.positions.every(p => p.status === 'pending' && p.entryPx === null));
  ok('AC2: the day records the scan, its funnel and the NSE timestamp',
    l.days[DAY]?.status === 'done' && l.days[DAY]?.signals === 4 && l.days[DAY]?.funnel?.oi === 4,
    JSON.stringify(l.days[DAY]?.funnel));
}

/* ----------------------------------------------------- row 3: freshness */

ok('row 3: prices stamped today after the open are fresh', freshness('17-Sep-2026 09:19:58', T0920) === null);
ok('row 3: prices from yesterday are refused', (freshness('16-Sep-2026 15:30:00', T0920) ?? '').includes('2026-09-16'),
  freshness('16-Sep-2026 15:30:00', T0920) ?? 'accepted');
ok('row 3: prices stamped before 09:15 today are refused', freshness('17-Sep-2026 09:14:59', T0920) !== null);
ok('row 3: an unreadable timestamp is refused, not trusted', freshness('', T0920) !== null);

{
  const l = emptyLedger('live');
  arm(l, true, at(8, 0));
  ok('row 3: nothing is due at 09:19:59', !scanDue(l, at(9, 19, 59)));
  ok('row 3: the scan is due at 09:20:00', scanDue(l, T0920));
  const stale = { ...fixtureScan, market: { ...fixtureScan.market, priceAsOf: '16-Sep-2026 15:30:00' } };
  const r = applyScan(l, stale, lookup, T0920, true);
  ok('row 3: a stale scan takes no position', !r.ok && l.positions.length === 0, r.ok ? '' : r.reason);
  ok('row 3: retry is NOT due 59 s later', !scanDue(l, T0920 + RETRY_MS - 1000));
  ok('row 3: retry IS due 60 s later', scanDue(l, T0920 + RETRY_MS));
  const failed = { ...fixtureScan, error: 'NSE timed out', long: [], short: [] };
  applyScan(l, failed, lookup, T0920 + RETRY_MS, true);
  onClock(l, at(9, 30));
  ok('row 3: at 09:30 a day of failed scans says so in words',
    l.days[DAY]?.status === 'no-trades' && (l.days[DAY]?.note ?? '').includes('NSE timed out'), l.days[DAY]?.note ?? '');
  ok('row 3: no scan is due after 09:30', !scanDue(l, at(9, 30, 1)));
}

/* ------------------------------------------------------------------ AC3 */

function openPos(side: 'BUY' | 'SELL', entry: number, securityId = 1): { l: Ledger; p: Position } {
  const l = emptyLedger('replay');
  const row: NseScanRow = { symbol: `S${securityId}`, name: 'x', ltp: entry, prevClose: entry, chgPct: side === 'BUY' ? 3 : -3, volume: 1, latestOi: 1, prevOi: 1, oiPct: 8 };
  const scan = { ...fixtureScan, error: null, long: side === 'BUY' ? [row] : [], short: side === 'SELL' ? [row] : [] } as NseScanResult;
  const lk = (): Contract => ({ symbol: row.symbol, name: 'x', futureId: securityId, futureExpiry: '2026-09-29', lot: 100, problem: null });
  applyScan(l, scan, lk, T0920, false);
  onTick(l, securityId, entry, T0920 + 500);
  return { l, p: l.positions[0]! };
}

{
  const { p } = openPos('BUY', 1000);
  ok('AC3: BUY 1000 → stop 990, target 1020', p.stopPx === 990 && p.targetPx === 1020, `${p.stopPx} / ${p.targetPx}`);
  const { p: s } = openPos('SELL', 500);
  ok('AC3: SELL 500 → stop 505, target 490', s.stopPx === 505 && s.targetPx === 490, `${s.stopPx} / ${s.targetPx}`);
  const lv = levels('BUY', 1234.55);
  ok('AC3: levels round to 0.01 (amendment 21)', lv.stop === 1222.2 && lv.target === 1259.24, JSON.stringify(lv));
  ok('AC3: exitFor is null inside the band', exitFor(p, 1000) === null);
}

const cases: [string, 'BUY' | 'SELL', number, number, number, 'stop' | 'target'][] = [
  // name, side, entry, 0.01-short tick, crossing tick, expected
  ['BUY stop', 'BUY', 1000, 990.01, 990.0, 'stop'],
  ['BUY target', 'BUY', 1000, 1019.99, 1020.0, 'target'],
  ['SELL stop', 'SELL', 500, 504.99, 505.0, 'stop'],
  ['SELL target', 'SELL', 500, 490.01, 490.0, 'target'],
];
for (const [name, side, entry, short, cross, want] of cases) {
  const { l, p } = openPos(side, entry);
  onTick(l, 1, short, T0920 + 1000);
  ok(`AC3: ${name} — 0.01 short of the level does NOT fire`, p.status === 'open', `ltp ${short}, status ${p.status}`);
  onTick(l, 1, cross, T0920 + 2000);
  ok(`AC3: ${name} — the crossing tick fires`, p.status === 'closed' && p.reason === want && p.exitPx === cross,
    `${p.status} ${p.reason} @ ${p.exitPx}`);
}
{
  // Gap-through: the exit is the tick's LTP, not the level (row 7).
  const { l, p } = openPos('BUY', 1000);
  onTick(l, 1, 981.5, T0920 + 1000);
  ok('AC3: a gap through the stop exits at the tick (981.50), not the level (990)', p.exitPx === 981.5 && p.reason === 'stop', `${p.exitPx}`);
  ok('AC3: …and its P&L is (981.50 − 1000) × 100 = −1,850.00', p.pnl === -1850, `${p.pnl}`);
}
for (const side of ['BUY', 'SELL'] as const) {
  const { l, p } = openPos(side, 800);
  onTick(l, 1, side === 'BUY' ? 801.25 : 798.75, at(15, 0));
  onClock(l, at(15, 14, 59));
  ok(`AC3: ${side} is still open at 15:14:59`, p.status === 'open');
  onClock(l, at(15, 15));
  ok(`AC3: ${side} squares off at 15:15:00 at the last LTP`, p.status === 'closed' && p.reason === 'eod' && p.exitPx === p.ltp,
    `${p.reason} @ ${p.exitPx}, pnl ${p.pnl}`);
}

/* ------------------------------------------------------------------ AC5 */

{
  const l = emptyLedger('replay');
  applyScan(l, fixtureScan, lookup, T0920, true);
  const p = l.positions[0]!;
  onClock(l, at(9, 29, 59));
  ok('AC5: an entry with no tick is still pending at 09:29:59', p.status === 'pending');
  onTick(l, p.securityId, 1000, at(9, 30));
  ok('AC5: a tick at 09:30:00 does NOT fill it', p.status === 'pending' && p.entryPx === null);
  onClock(l, at(9, 30));
  ok('AC5: at 09:30:00 it is unfilled, "no tick in window"', p.status === 'unfilled' && p.note === 'no tick in window', `${p.status} ${p.note}`);
}
{
  const l = emptyLedger('live');
  arm(l, true, at(9, 31));
  ok('AC5: armed at 09:31 → no scan is due at 09:31', !scanDue(l, at(9, 31)));
  onClock(l, at(9, 31));
  ok('AC5: armed at 09:31 → the day says trading starts next trading day',
    l.days[DAY]?.status === 'no-trades' && (l.days[DAY]?.note ?? '').includes('next trading day'), l.days[DAY]?.note ?? '');
  ok('AC5: …and nothing was traded', l.positions.length === 0);

  const l2 = emptyLedger('live');
  arm(l2, true, at(9, 25));
  ok('AC5: armed at 09:25 → the scan IS due (the accept side of the same rule)', scanDue(l2, at(9, 25)));
  ok('AC5: disarmed → never due', !scanDue(emptyLedger('live'), T0920));
  const sat = Date.parse('2026-09-19T03:50:00Z');
  const l3 = emptyLedger('live'); arm(l3, true, sat - 3600_000);
  ok('AC5: a Saturday 09:20 is not a trading day', ist(sat).weekday === 6 && !scanDue(l3, sat));

  const l4 = emptyLedger('live'); arm(l4, true, at(8, 0));
  onClock(l4, at(9, 30));
  ok('AC5: armed but never scanned (asleep) → the missed window is named',
    (l4.days[DAY]?.note ?? '').includes('missed the 09:20-09:30 window'), l4.days[DAY]?.note ?? '');
}
{
  // 12 signals against a cap of 10, plus one with no future and one duplicate.
  const mk = (i: number, chg: number): NseScanRow => ({ symbol: `SYM${String(i).padStart(2, '0')}`, name: 'x', ltp: 100 + i, prevClose: 100, chgPct: chg, volume: 1, latestOi: 1, prevOi: 1, oiPct: 9 });
  const long = Array.from({ length: 7 }, (_, i) => mk(i, 2 + i));
  const short = Array.from({ length: 5 }, (_, i) => mk(10 + i, -(2.5 + i)));
  short.push({ ...mk(99, -20), symbol: 'NOFUT' });
  const scan = { ...fixtureScan, error: null, long, short } as NseScanResult;
  const lk = (s: string): Contract | undefined => s === 'NOFUT' ? undefined
    : { symbol: s, name: s, futureId: 1000 + Number(s.slice(3)), futureExpiry: '2026-09-29', lot: 50, problem: null };
  const l = emptyLedger('replay');
  const { added, notTaken } = planEntries(l, scan, lk, T0920);
  ok(`AC5: 12 tradable signals → ${MAX_POSITIONS} taken`, added.length === MAX_POSITIONS, `${added.length}`);
  const caps = notTaken.filter(n => n.reason === 'cap');
  ok('AC5: …and 2 listed as "cap"', caps.length === 2, caps.map(c => c.symbol).join(','));
  const smallest = [...long, ...short.filter(r => r.symbol !== 'NOFUT')].sort((a, b) => Math.abs(a.chgPct) - Math.abs(b.chgPct)).slice(0, 2).map(r => r.symbol).sort();
  ok('AC5: the two capped are the two smallest |chg%|', JSON.stringify(caps.map(c => c.symbol).sort()) === JSON.stringify(smallest), JSON.stringify(smallest));
  ok('AC5: a signal with no future in the master is not taken, with a reason',
    notTaken.some(n => n.symbol === 'NOFUT' && n.reason.includes('no near-month future')));
  l.positions.push(...added);
  const again = planEntries(l, scan, lk, T0920 + 60_000);
  ok('row 9: a second scan the same day re-enters nothing', again.added.length === 0
    && again.notTaken.filter(n => n.reason === 'already traded today').length === 10);
}
{
  // Row 13: an open position from an earlier date is closed as stale.
  const { l, p } = openPos('BUY', 700);
  onTick(l, 1, 707, T0920 + 5000);
  onClock(l, T0920 + 86_400_000);
  ok('row 13: yesterday\'s open position is closed "stale" at its last LTP', p.status === 'closed' && p.reason === 'stale' && p.stale && p.exitPx === 707,
    `${p.reason} @ ${p.exitPx}`);
}

/* ---------------------------------------------- AC4 + the shell, end to end */

{
  const dir = await mkdtemp(path.join(tmpdir(), 'p32-'));
  const file = path.join(dir, 'paper-ledger.replay.json');
  let wall = at(21, 13, 7);
  let wants: number[] = [];
  const t = new PaperTrader({
    file, mode: 'replay', lookup, wall: () => wall,
    scan: async () => fixtureScan,
    onWants: s => { wants = s.map(x => x.securityId); },
  });
  await t.load();
  const r = await t.runNow();
  ok('amendment 19: Run now puts the engine clock on 09:20:00 IST', r.ok && ist(t.now()).hms === '09:20:00', ist(t.now()).hms);
  ok('row 12: the trader asks the feed for exactly its 4 futures', wants.length === 4, wants.join(','));

  // Fill all four, then walk each to an exit by a different route.
  const ps = t.ledger.positions;
  const entry = [1510.4, 1733.35, 1102.05, 211.87];
  ps.forEach((p, i) => t.onFeedTick({ seg: 'NSE_FNO', securityId: p.securityId, at: 0, ltp: entry[i]!, ltt: null, volume: null, oi: null, open: null, high: null, low: null, close: null }));
  ok('row 6: each fills at its first tick', ps.every((p, i) => p.status === 'open' && p.entryPx === entry[i]));
  const tick = (p: Position, ltp: number) => t.onFeedTick({ seg: 'NSE_FNO', securityId: p.securityId, at: 0, ltp, ltt: null, volume: null, oi: null, open: null, high: null, low: null, close: null });
  const [a, b, c, d] = ps as [Position, Position, Position, Position];
  // Exactly the target, as the feed's float32 decodes it (e.g. 1259.24 → 1259.2399902…).
  tick(a, Math.fround(a.targetPx!));
  ok('row 7: a float32-decoded tick AT the target still fires it', a.status === 'closed' && a.reason === 'target',
    `${Math.fround(a.targetPx!)} vs ${a.targetPx} → ${a.reason}`);
  tick(b, b.side === 'BUY' ? b.stopPx! - 0.05 : b.stopPx! + 0.05);
  await t.exit(c.id);
  wall += 30_000;
  tick(d, d.entryPx! * (d.side === 'BUY' ? 1.004 : 0.996));
  await t.exitAll();
  ok('row 12: once nothing is open the feed is released', wants.length === 0, wants.join(','));

  const saved = JSON.parse(await readFile(file, 'utf8')) as Ledger;
  const closed = saved.positions.filter(p => p.status === 'closed');
  const diffs = closed.map(p => ({ id: p.id, stored: p.pnl, again: paisePnl(p.side, p.entryPx!, p.exitPx!, p.qty) }));
  ok('AC4: 4 trades closed in the ledger FILE by 4 routes (target, stop, manual, square-off-all)',
    closed.length === 4 && new Set(closed.map(p => p.reason)).size === 3, closed.map(p => p.reason).join(','));
  ok('AC4: every stored P&L equals a second, integer-paise implementation to the paisa',
    diffs.every(x => x.stored === x.again), diffs.map(x => `${x.id.slice(11)} ${x.stored}/${x.again}`).join(', '));
  const v = t.view();
  const sum = Math.round(closed.reduce((s, p) => s + paisePnl(p.side, p.entryPx!, p.exitPx!, p.qty), 0) * 100) / 100;
  ok('AC4: the day P&L on the view equals the sum recomputed from the file', v.dayPnl.total === sum, `${v.dayPnl.total} vs ${sum}`);
  ok('AC4: the view carries the 5-day history row for this date', v.history[0]?.date === ist(t.now()).date && v.history[0]?.trades === 4);

  const again = await t.runNow();
  ok('row 9: a second Run now the same day re-enters nothing', again.ok && t.ledger.positions.length === 4,
    `${t.ledger.days[ist(t.now()).date]?.notTaken.map(n => n.reason).join(',')}`);

  // Restart: a fresh trader on the same file keeps the replay clock and the history.
  const t2 = new PaperTrader({ file, mode: 'replay', lookup, wall: () => wall, scan: async () => fixtureScan, onWants: () => {} });
  await t2.load();
  ok('amendment 19: the replay clock survives a restart', Math.abs(t2.now() - t.now()) < 1000 && t2.ledger.positions.length === 4,
    `${ist(t2.now()).hms}`);

  // Run now refuses while anything is live (amendment 20).
  const t3 = new PaperTrader({ file: path.join(dir, 'x.json'), mode: 'replay', lookup, wall: () => wall, scan: async () => fixtureScan, onWants: () => {} });
  await t3.load();
  await t3.runNow();
  const refused = await t3.runNow();
  ok('amendment 20: Run now refuses while positions are pending or open', !refused.ok, refused.ok ? '' : refused.error);
  await rm(dir, { recursive: true, force: true });
}

/* ------------------------------------------------------------- row 13 */

ok('row 13: replay and live keep separate ledger files',
  ledgerPath(true).endsWith('paper-ledger.replay.json') && ledgerPath(false).endsWith('paper-ledger.json') && ledgerPath(true) !== ledgerPath(false));
ok('spec constants: 09:20 / 09:30 / 15:15', SCAN_AT_MIN === 560 && ENTRY_UNTIL_MIN === 570 && SQUARE_OFF_MIN === 915);
ok('view(): a fresh ledger reads DISARMED', view(emptyLedger('live'), T0920).status.startsWith('disarmed'));
ok('pnlOf: SELL gains when the price falls', pnlOf('SELL', 100, 98, 10) === 20 && pnlOf('BUY', 100, 98, 10) === -20);
ok('istAt: 09:20 IST is 03:50 UTC', new Date(istAt(T0920, SCAN_AT_MIN)).toISOString().endsWith('03:50:00.000Z'));

console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
