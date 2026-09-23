/**
 * `npm run paper:test` — the unit half of `docs/spec/paper-trading-v1.md` (P32) as amended by
 * `docs/spec/orb-strategy-v1.md` (P33): the opening-range breakout entry, the two-closes-against-
 * SMA9 exit, the option leg, the clock rules and the ledger-per-mode rule.
 *
 * Every rule is shown REJECTING something, not only accepting: a tick AT the high, a tick 0.01
 * inside it, a Long stock breaking its LOW, one close against SMA9, a below/above/below run, a
 * 12-signal day against a cap of 10. A fixture that only ever agrees has not tested the filter
 * (CLAUDE.md, P8's 210 -> 100 -> 100 -> 6).
 *
 * The clock is injected everywhere. Nothing here depends on when it is run.
 */

import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyBars, applyScan, candlesDue, emptyLedger, freshness, ist, istAt, ledgerPath, nearestOption,
  onClock, onTick, openingRange, planEntries, pnlOf, scanDue, smaAt, arm, view, PaperTrader,
  CANDLE_MS, ENTRY_UNTIL_MIN, MAX_POSITIONS, RANGE_READY_MIN, RETRY_MS, SCAN_AT_MIN, SCAN_UNTIL_MIN,
  SMA_PERIOD, SQUARE_OFF_MIN,
  type Bar, type Contract, type Ledger, type OptionPick, type Position,
} from '../src/server/paper.ts';
import { fetchNseBundle } from '../src/server/nse.ts';
import { nseFunnel, parseFnoList, type NseScanResult, type NseScanRow } from '../src/server/scanner-nse.ts';
import { resolveRegistry, fnoUniverse, stockOptions, todayIso } from '../src/server/instruments.ts';
import { loadMaster } from '../src/server/master.ts';
import { replayOrbCandles, REPLAY_ORB_EDGE, REPLAY_ORB_PLAN } from '../src/server/replay.ts';
import { toUCandles } from '../src/server/ucandles.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/** 17 Sep 2026 — the date the committed NSE fixture was captured (a Thursday). */
const DAY = '2026-09-17';
const at = (hh: number, mm: number, ss = 0) => Date.parse(`${DAY}T00:00:00Z`) - 5.5 * 3600_000 + ((hh * 60 + mm) * 60 + ss) * 1000;
const T0920 = at(9, 20);

/** Second implementation of P&L, in integer paise: no float multiply until the last divide. */
const paisePnl = (side: string, entry: number, exit: number, qty: number) =>
  ((Math.round(exit * 100) - Math.round(entry * 100)) * qty * (side === 'BUY' ? 1 : -1)) / 100;

/* ------------------------------------------------------------------ AC8 */

{
  const src = await readFile('src/server/paper.ts', 'utf8');
  const imports = src.split('\n').filter(l => /^import\b/.test(l));
  ok('AC8: paper.ts imports nothing from dhan.ts (or instruments.ts, which imports it)',
    !imports.some(l => /dhan\.ts|instruments\.ts|peakoi\.ts/.test(l)), imports.map(l => l.replace(/^import .* from /, '')).join(' '));

  const { readdir } = await import('node:fs/promises');
  const files = (await readdir('src/server')).filter(f => f.endsWith('.ts'));
  const hits: string[] = [];
  for (const f of files) {
    const body = await readFile(path.join('src/server', f), 'utf8');
    for (const m of body.matchAll(/\/v2\/(super\/)?orders|\/v2\/forever|placeOrder|\/v2\/positions\/convert/gi)) hits.push(`${f}: ${m[0]}`);
  }
  ok('AC8: no Dhan order endpoint anywhere in src/server', hits.length === 0, hits.join(', ') || `${files.length} files clean`);
}

/* ------------------------------------------------------- the 09:20 scan */

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
  ok('scan: the fixture scan is accepted at 09:20', r.ok, r.ok ? '' : r.reason);
  ok('scan: exactly 1 BUY — MFSL', JSON.stringify(buys) === '["MFSL"]', JSON.stringify(buys));
  ok('scan: exactly 3 SELL — FEDERALBNK, PNBHOUSING, POLICYBZR',
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
  ok('scan: each future is 1 lot, equal to the master\'s lot, on the master\'s near-month future',
    lots.length === 4 && lots.every(x => x.qty === x.master && x.lot === x.master && x.id === x.mid),
    lots.map(x => `${x.sym} qty ${x.qty} master ${x.master}`).join(', '));
  ok('scan: every future starts pending, no range, no fill', l.positions.every(p => p.status === 'pending' && p.entryPx === null && !p.range));

  // Second implementation of the near-month option list, straight off the master rows.
  const mfslOpts = rows.filter(x => x.instrument === 'OPTSTK' && x.exchId === 'NSE' && x.underlyingSymbol === 'MFSL' && x.expiry !== null && x.expiry >= today);
  const nearExp = mfslOpts.map(x => x.expiry!).sort()[0];
  const mine = stockOptions('MFSL', today);
  ok('row 6: stockOptions() is the master\'s earliest live OPTSTK expiry, every strike, both types',
    mine.length > 0 && mine.length === mfslOpts.filter(x => x.expiry === nearExp && x.strike !== null).length && mine.every(o => o.expiry === nearExp),
    `${mine.length} contracts, expiry ${nearExp}`);
}

/* ----------------------------------------------------- scan window + freshness */

ok('P32 row 3: prices stamped today after the open are fresh', freshness('17-Sep-2026 09:19:58', T0920) === null);
ok('P32 row 3: prices from yesterday are refused', (freshness('16-Sep-2026 15:30:00', T0920) ?? '').includes('2026-09-16'));
ok('P32 row 3: prices stamped before 09:15 today are refused', freshness('17-Sep-2026 09:14:59', T0920) !== null);
{
  const l = emptyLedger('live');
  arm(l, true, at(8, 0));
  ok('P32 row 3: nothing is due at 09:19:59', !scanDue(l, at(9, 19, 59)));
  ok('P32 row 3: the scan is due at 09:20:00', scanDue(l, T0920));
  const stale = { ...fixtureScan, market: { ...fixtureScan.market, priceAsOf: '16-Sep-2026 15:30:00' } };
  applyScan(l, stale, lookup, T0920, true);
  ok('P32 row 3: retry is NOT due 59 s later', !scanDue(l, T0920 + RETRY_MS - 1000));
  ok('P32 row 3: retry IS due 60 s later', scanDue(l, T0920 + RETRY_MS));
  onClock(l, at(9, 30));
  ok('amendment 14: the SCAN window still closes at 09:30', !scanDue(l, at(9, 30, 1)) && l.days[DAY]?.status === 'no-trades', l.days[DAY]?.note ?? '');
}
{
  const l = emptyLedger('live');
  arm(l, true, at(9, 31));
  onClock(l, at(9, 31));
  ok('P32 AC5: armed at 09:31 → the day says trading starts next trading day',
    (l.days[DAY]?.note ?? '').includes('next trading day') && l.positions.length === 0, l.days[DAY]?.note ?? '');
  const sat = Date.parse('2026-09-19T03:50:00Z');
  const l3 = emptyLedger('live'); arm(l3, true, sat - 3600_000);
  ok('P32 AC5: a Saturday 09:20 is not a trading day', ist(sat).weekday === 6 && !scanDue(l3, sat));
}

/* ------------------------------------------------------------------ helpers */

/** A bar opening at hh:mm on DAY (or on `date`). */
const bar = (hh: number, mm: number, o: number, h: number, lo: number, c: number, date = DAY): Bar =>
  ({ t: Date.parse(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`), o, h, l: lo, c });

/** Nine flat bars of the previous session closing at `px`, so SMA9 starts the day at `px`. */
const prevDay = (px: number): Bar[] => Array.from({ length: SMA_PERIOD }, (_, i) =>
  ({ t: Date.parse('2026-09-16T14:45:00+05:30') + i * CANDLE_MS, o: px, h: px, l: px, c: px }));

const OPTS: OptionPick[] = [990, 1000, 1010, 1020].flatMap(k => (['CE', 'PE'] as const).map((t, j) =>
  ({ strike: k, optionType: t, securityId: 90000 + k * 2 + j, lot: 100, expiry: '2026-09-29' })));
const optsFor = () => OPTS;

/** One future, scanned at 09:20, its range read from the two opening bars. */
function withRange(side: 'BUY' | 'SELL', hi = 1005, lo = 995, securityId = 1) {
  const l = emptyLedger('replay');
  const row: NseScanRow = { symbol: `S${securityId}`, name: 'x', ltp: 1000, prevClose: 1000, chgPct: side === 'BUY' ? 3 : -3, volume: 1, latestOi: 1, prevOi: 1, oiPct: 8 };
  const scan = { ...fixtureScan, error: null, long: side === 'BUY' ? [row] : [], short: side === 'SELL' ? [row] : [] } as NseScanResult;
  const lk = (): Contract => ({ symbol: row.symbol, name: 'x', futureId: securityId, futureExpiry: '2026-09-29', lot: 100, problem: null });
  applyScan(l, scan, lk, T0920, false);
  const p = l.positions[0]!;
  const bars = [...prevDay(1000), bar(9, 15, 1000, hi, 998, 1001), bar(9, 20, 1001, 1003, lo, 1000)];
  return { l, p, bars };
}

/* ------------------------------------------------------------------ AC1 */

{
  const { l, p, bars } = withRange('BUY', 1004.4, 996.1);
  ok('AC1: candles are not due before 09:25:05', candlesDue(p, at(9, 25, 4)) === null);
  ok('AC1: candles ARE due at 09:25:05', candlesDue(p, at(9, 25, 5)) === 'range');
  // Hand values: 09:15 high 1004.40 vs 09:20 high 1003 → 1004.40; lows 998 vs 996.10 → 996.10.
  applyBars(l, p.id, bars, at(9, 25, 5));
  ok('AC1: range = max of the two highs, min of the two lows (1004.40 / 996.10 by hand)',
    p.range?.high === 1004.4 && p.range?.low === 996.1, JSON.stringify(p.range));
  const one = openingRange([bar(9, 15, 1, 2, 0.5, 1)], DAY);
  ok('AC1: ONE opening candle is not a range', 'error' in one && one.error.includes('09:20'), JSON.stringify(one));
  ok('AC1: a 09:20 candle from ANOTHER day does not count', 'error' in openingRange([bar(9, 15, 1, 2, 0.5, 1), bar(9, 20, 1, 2, 0.5, 1, '2026-09-16')], DAY));

  onTick(l, 1, 1004.39, at(9, 26), optsFor);
  ok('AC1: a tick 0.01 inside the high does not enter', p.status === 'pending');
  onTick(l, 1, 1004.4, at(9, 26, 1), optsFor);
  ok('AC1: a tick AT the high does not enter (strictly above)', p.status === 'pending');
  onTick(l, 1, 990, at(9, 26, 2), optsFor);
  ok('AC1: a LONG-list stock breaking its LOW does not enter', p.status === 'pending' && p.ltp === 990);
  onTick(l, 1, 1004.41, at(9, 26, 3), optsFor);
  ok('AC1: the first tick strictly above the high enters, at that tick', p.status === 'open' && p.entryPx === 1004.41, `${p.status} @ ${p.entryPx}`);
  const opt = l.positions.find(x => x.parentId === p.id);
  ok('row 6: the break opens a CE leg on the strike nearest 1004.41 → 1000', opt?.optionType === 'CE' && opt.strike === 1000 && opt.status === 'pending' && opt.side === 'BUY',
    `${opt?.optionType} ${opt?.strike} ${opt?.status}`);
  onTick(l, opt!.securityId, 12.35, at(9, 26, 4), optsFor);
  ok('row 6: the option fills at its own first tick', opt!.status === 'open' && opt!.entryPx === 12.35);
}
{
  const { l, p, bars } = withRange('SELL', 1005, 995);
  applyBars(l, p.id, bars, at(9, 25, 5));
  onTick(l, 1, 1006, at(9, 30), optsFor);
  ok('AC1: a SHORT-list stock breaking its HIGH does not enter', p.status === 'pending');
  onTick(l, 1, 995, at(9, 30, 1), optsFor);
  ok('AC1: a tick AT the low does not enter', p.status === 'pending');
  onTick(l, 1, 994.99, at(9, 30, 2), optsFor);
  ok('AC1: the first tick strictly below the low enters short', p.status === 'open' && p.entryPx === 994.99);
  const opt = l.positions.find(x => x.parentId === p.id);
  ok('row 6: a short opens a PE leg (nearest 994.99 → 990)', opt?.optionType === 'PE' && opt.strike === 990, `${opt?.optionType} ${opt?.strike}`);
}
{
  ok('amendment 16: a tie between two strikes goes to the LOWER one', nearestOption(OPTS, 1005, 'CE')?.strike === 1000);
  ok('row 6: no contract of that type → null, not a guess', nearestOption(OPTS.filter(o => o.optionType === 'PE'), 1000, 'CE') === null);
  const { l, p } = withRange('BUY');
  p.range = { high: 1005, low: 995 };
  onTick(l, 1, 1010, at(9, 24, 59), optsFor);
  ok('row 5: a break before 09:25 does not enter', p.status === 'pending');
  onTick(l, 1, 1010, at(15, 0), optsFor);
  ok('row 5: a break at 15:00:00 does not enter', p.status === 'pending');
  onTick(l, 1, 1010, at(14, 59, 59), () => []);
  ok('row 6: no option in the master → the future still enters, and says so', p.status === 'open' && (p.note ?? '').includes('no CE'), p.note ?? '');
}

/* ------------------------------------------------------------------ AC2 */

/** A long entered at 09:26 on a range 995-1005, then the closes given, one per 5-minute bar from 09:25. */
function runCloses(side: 'BUY' | 'SELL', closes: number[]) {
  const { l, p, bars } = withRange(side);
  applyBars(l, p.id, bars, at(9, 25, 5));
  onTick(l, 1, side === 'BUY' ? 1005.5 : 994.5, at(9, 26), optsFor);
  const opt = l.positions.find(x => x.parentId === p.id)!;
  onTick(l, opt.securityId, 10, at(9, 26, 1), optsFor);
  const all = [...bars];
  const log: string[] = [];
  closes.forEach((c, i) => {
    const b = bar(9, 25 + i * 5, c, c, c, c);
    all.push(b);
    const now = b.t + CANDLE_MS + 5000;
    applyBars(l, p.id, all, now);
    log.push(`${ist(b.t).hms.slice(0, 5)} c${c} sma${p.sma9} a${p.against}${p.exitDue ? ' EXIT' : ''}`);
  });
  return { l, p, opt, all, log };
}
{
  // SMA9 by hand at the 09:25 bar: seven 1000s from yesterday + 1001 + 1000 (the range bars' closes)
  // is not what is summed — the window is the LAST 9 completed closes ending at 09:25:
  // yesterday's last six (1000 x 6) + 1001 + 1000 + 999 = 9000 → 1000.00. 999 < 1000 → against 1.
  const a = runCloses('BUY', [999]);
  ok('AC2: SMA9 at 09:25 = 1000.00 by hand, and ONE close below does NOT exit', a.p.sma9 === 1000 && a.p.against === 1 && !a.p.exitDue && a.p.status === 'open', a.log.join(' | '));
  const completed = a.all.filter(b => b.t + CANDLE_MS <= at(9, 30, 5)).sort((x, y) => x.t - y.t);
  const hand = completed.slice(-9).reduce((s, b) => s + b.c, 0) / 9;
  ok('AC2: smaAt() equals an independent mean of the last 9 completed closes', Math.abs(smaAt(completed, completed.length - 1)! - hand) < 1e-9, `${hand}`);

  const b = runCloses('BUY', [999, 999]);
  ok('AC2: the SECOND consecutive close below SMA9 marks the exit', b.p.exitDue === true && b.p.status === 'open', b.log.join(' | '));
  ok('AC2: …and marks the option leg too', b.opt.exitDue === true);
  onTick(b.l, 1, 1001.25, at(9, 35, 7), optsFor);
  ok('row 7: the future exits at its next tick, reason sma', b.p.status === 'closed' && b.p.reason === 'sma' && b.p.exitPx === 1001.25, `${b.p.reason} @ ${b.p.exitPx}`);
  ok('row 7: the option is still open until ITS next tick', b.opt.status === 'open');
  onTick(b.l, b.opt.securityId, 8.5, at(9, 35, 8), optsFor);
  ok('row 7: the option exits at its own next tick', b.opt.status === 'closed' && b.opt.reason === 'sma' && b.opt.pnl === paisePnl('BUY', 10, 8.5, b.opt.qty), `${b.opt.pnl}`);

  const c = runCloses('BUY', [999, 1003, 999]);
  ok('AC2: below / above / below does NOT exit (the count resets)', !c.p.exitDue && c.p.against === 1, c.log.join(' | '));
  const eq = runCloses('BUY', [999, 1000]);
  ok('AC2: a close EQUAL to SMA9 is not below it — the count resets', !eq.p.exitDue && eq.p.against === 0, eq.log.join(' | '));

  const s1 = runCloses('SELL', [1001]);
  ok('AC2: short — one close ABOVE SMA9 does not exit', s1.p.against === 1 && !s1.p.exitDue, s1.log.join(' | '));
  const s2 = runCloses('SELL', [1001, 1001]);
  ok('AC2: short — two consecutive closes above SMA9 exit', s2.p.exitDue === true, s2.log.join(' | '));
  const s3 = runCloses('SELL', [999, 998, 997]);
  ok('AC2: short — closes BELOW SMA9 are the right side and never count', !s3.p.exitDue && s3.p.against === 0, s3.log.join(' | '));
}
{
  // The forming candle is never counted, whatever position it has in the payload.
  const { l, p, bars } = withRange('BUY');
  applyBars(l, p.id, bars, at(9, 25, 5));
  onTick(l, 1, 1006, at(9, 26), optsFor);
  const all = [...bars, bar(9, 25, 999, 999, 999, 999), bar(9, 30, 999, 999, 999, 999)];
  applyBars(l, p.id, all, at(9, 34, 59));
  ok('rows 7/9: the forming 09:30 candle does not count at 09:34:59', p.against === 1 && !p.exitDue, `against ${p.against}`);
  applyBars(l, p.id, all, at(9, 35, 5));
  ok('rows 7/9: …it counts once completed, and exits', p.against === 2 && p.exitDue === true);
  const few = withRange('BUY');
  ok('row 9: fewer than 9 completed closes → no SMA, no count', smaAt(few.bars.slice(-3), 2) === null);
}
{
  // Candles due exactly once per completed bar.
  const { l, p, bars } = withRange('BUY');
  applyBars(l, p.id, bars, at(9, 25, 5));
  onTick(l, 1, 1006, at(9, 26), optsFor);
  ok('row 7: exit candles are not due before the entry candle has closed (09:30:04)', candlesDue(p, at(9, 30, 4)) === null);
  ok('row 7: …and due at 09:30:05', candlesDue(p, at(9, 30, 5)) === 'exit');
  applyBars(l, p.id, [...bars, bar(9, 25, 1006, 1007, 1005, 1006)], at(9, 30, 5));
  ok('row 7: once read, not due again until the next boundary', candlesDue(p, at(9, 34, 59)) === null && candlesDue(p, at(9, 35, 5)) === 'exit');
}

/* ------------------------------------------------------------------ AC3 */

{
  const { l, p, bars } = withRange('BUY');
  applyBars(l, p.id, bars, at(9, 25, 5));
  onClock(l, at(14, 59, 59));
  ok('AC3: a future that never broke is still waiting at 14:59:59', p.status === 'pending');
  onClock(l, at(15, 0));
  ok('AC3: at 15:00 it is unfilled, "no break by 15:00"', p.status === 'unfilled' && p.note === 'no break by 15:00', `${p.status} ${p.note}`);

  const n = withRange('SELL');
  applyBars(n.l, n.p.id, n.bars.slice(0, -1), at(9, 25, 5));
  ok('row 3: a missing 09:20 candle leaves no range and names it', !n.p.range && (n.p.rangeNote ?? '').includes('09:20'), n.p.rangeNote ?? '');
  onClock(n.l, at(15, 0));
  ok('AC3: …and at 15:00 it reads "no range: …", not "no break"', (n.p.note ?? '').startsWith('no range:'), n.p.note ?? '');
}
for (const side of ['BUY', 'SELL'] as const) {
  const { l, p, bars } = withRange(side);
  applyBars(l, p.id, bars, at(9, 25, 5));
  onTick(l, 1, side === 'BUY' ? 1006 : 994, at(10, 0), optsFor);
  const opt = l.positions.find(x => x.parentId === p.id)!;
  onTick(l, opt.securityId, 15, at(10, 0, 1), optsFor);
  onTick(l, 1, side === 'BUY' ? 1011.5 : 988.5, at(15, 0), optsFor);
  onTick(l, opt.securityId, 21.05, at(15, 0, 1), optsFor);
  onClock(l, at(15, 14, 59));
  ok(`AC3: ${side} — both legs still open at 15:14:59`, p.status === 'open' && opt.status === 'open');
  onClock(l, at(15, 15));
  ok(`AC3: ${side} — both legs square off at 15:15 at their last LTP`,
    p.reason === 'eod' && opt.reason === 'eod' && p.exitPx === p.ltp && opt.exitPx === 21.05, `${p.exitPx} / ${opt.exitPx}`);
  ok(`AC4: ${side} — future P&L equals the paise implementation`, p.pnl === paisePnl(side, p.entryPx!, p.exitPx!, p.qty), `${p.pnl}`);
  ok(`AC4: ${side} — the option leg is a BOUGHT option: (21.05 − 15) × 100 = +605`, opt.pnl === 605 && opt.pnl === paisePnl('BUY', 15, 21.05, opt.qty), `${opt.pnl}`);
}
{
  // Amendment 19: the future exits before the option's first tick.
  const { l, p, bars } = withRange('BUY');
  applyBars(l, p.id, bars, at(9, 25, 5));
  onTick(l, 1, 1006, at(9, 26), optsFor);
  const opt = l.positions.find(x => x.parentId === p.id)!;
  p.exitDue = true; opt.exitDue = true;
  onTick(l, 1, 1004, at(9, 40), optsFor);
  onTick(l, opt.securityId, 9, at(9, 40, 1), optsFor);
  ok('amendment 19: an option whose future already exited is not filled', opt.status === 'unfilled' && opt.note === 'future exited first', `${opt.status} ${opt.note}`);
}

/* ------------------------------------------------------------ cap + re-entry */

{
  const mk = (i: number, chg: number): NseScanRow => ({ symbol: `SYM${String(i).padStart(2, '0')}`, name: 'x', ltp: 100 + i, prevClose: 100, chgPct: chg, volume: 1, latestOi: 1, prevOi: 1, oiPct: 9 });
  const long = Array.from({ length: 7 }, (_, i) => mk(i, 2 + i));
  const short = Array.from({ length: 5 }, (_, i) => mk(10 + i, -(2.5 + i)));
  const scan = { ...fixtureScan, error: null, long, short } as NseScanResult;
  const lk = (s: string): Contract => ({ symbol: s, name: s, futureId: 1000 + Number(s.slice(3)), futureExpiry: '2026-09-29', lot: 50, problem: null });
  const l = emptyLedger('replay');
  const { added, notTaken } = planEntries(l, scan, lk, T0920);
  ok(`P32 row 5: 12 signals → ${MAX_POSITIONS} taken, 2 "cap"`, added.length === MAX_POSITIONS && notTaken.filter(n => n.reason === 'cap').length === 2);
  l.positions.push(...added);
  // Option legs must not eat into the cap: add one per future and re-plan a fresh 11th signal.
  for (const f of added) l.positions.push({ ...f, id: `${f.id}-CE`, leg: 'option', parentId: f.id });
  const again = planEntries(l, scan, lk, T0920 + 60_000);
  ok('P32 row 9: a second scan the same day re-enters nothing', again.added.length === 0);
  const fresh = planEntries(emptyLedger('replay'), { ...scan, long: long.slice(0, 3), short: [] } as NseScanResult, lk, T0920);
  ok('row 6: option legs are not counted against the cap of 10', fresh.added.length === 3);
}
{
  const { l, p, bars } = withRange('BUY');
  applyBars(l, p.id, bars, at(9, 25, 5));
  onTick(l, 1, 1006, at(9, 26), optsFor);
  onTick(l, 1, 1007, at(9, 27), optsFor);
  onClock(l, at(9, 20) + 86_400_000);
  ok('P32 row 13: yesterday\'s open future is closed "stale" at its last LTP', p.status === 'closed' && p.reason === 'stale' && p.exitPx === 1007);
}

/* ------------------------------------------ AC4 + AC5 (engine half) — the shell */

{
  const dir = await mkdtemp(path.join(tmpdir(), 'p33-'));
  const file = path.join(dir, 'paper-ledger.replay.json');
  let wall = at(21, 13, 7);
  let wants: number[] = [];
  let calls = 0;
  const t = new PaperTrader({
    file, mode: 'replay', lookup, wall: () => wall,
    scan: async () => fixtureScan,
    candles: async (ask, nowMs) => { calls++; return { bars: toUCandles(replayOrbCandles(ask.symbol, ask.side, ask.base, nowMs)), why: null }; },
    options: (s) => stockOptions(s, todayIso()),
    onWants: s => { wants = s.map(x => x.securityId); },
  });
  await t.load();
  const r = await t.runNow();
  ok('amendment 17: Run now puts the engine clock on 09:25:00 IST', r.ok && ist(t.now()).hms === '09:25:00', ist(t.now()).hms);
  const futs = () => t.ledger.positions.filter(p => (p.leg ?? 'future') === 'future');
  ok('P32 row 12: the trader asks the feed for its 4 futures', wants.length === 4, wants.join(','));

  await t.step();
  ok('rows 3/7: no candle read before 09:25:05', calls === 0 && futs().every(p => !p.range));
  wall += 5000;
  await t.step();
  ok('row 3: at 09:25:05 all four ranges are read, one call each', calls === 4 && futs().every(p => p.range), `${calls} calls`);
  // Hand value from the seeded plan: high = base × (1 + 0.0005), low = base × (1 − 0.0005).
  const mfsl = futs().find(p => p.symbol === 'MFSL')!;
  const b = mfsl.signal.cashLtp;
  ok('row 13: MFSL\'s range is its share price ± 0.05% (seeded, recomputed by hand)',
    mfsl.range!.high === Math.round(b * (1 + REPLAY_ORB_EDGE) * 100) / 100 && mfsl.range!.low === Math.round(b * (1 - REPLAY_ORB_EDGE) * 100) / 100,
    `${b} → ${JSON.stringify(mfsl.range)}`);
  await t.step();
  ok('rows 3/7: the range is not re-read every second', calls === 4, `${calls}`);

  const tick = (id: number, ltp: number) => t.onFeedTick({ seg: 'NSE_FNO', securityId: id, at: 0, ltp, ltt: null, volume: null, oi: null, open: null, high: null, low: null, close: null });
  wall += 20_000;
  for (const p of futs()) {
    if (REPLAY_ORB_PLAN[p.symbol] === 'never') { tick(p.securityId, p.signal.cashLtp + 1); tick(p.securityId, p.signal.cashLtp - 1); continue; }
    tick(p.securityId, p.side === 'BUY' ? p.range!.high + 0.01 : p.range!.low - 0.01);
  }
  const pnb = futs().find(p => p.symbol === 'PNBHOUSING')!;
  ok('row 13: PNBHOUSING (±50% range) does not break on ±1 either side', pnb.status === 'pending');
  ok('row 13: MFSL, POLICYBZR, FEDERALBNK break and enter', futs().filter(p => p.status === 'open').map(p => p.symbol).sort().join(',') === 'FEDERALBNK,MFSL,POLICYBZR');
  const legs = t.ledger.positions.filter(p => p.leg === 'option');
  ok('row 6: three option legs, CE for MFSL, PE for the two shorts', legs.length === 3
    && legs.find(o => o.symbol === 'MFSL')?.optionType === 'CE' && legs.filter(o => o.optionType === 'PE').length === 2,
    legs.map(o => `${o.symbol} ${o.strike}${o.optionType}`).join(', '));
  ok('P32 row 12: the feed now carries 4 futures + 3 options', wants.length === 7, `${wants.length}`);
  legs.forEach((o, i) => tick(o.securityId, [11.1, 7.45, 3.2][i]!));
  ok('row 6: each option fills at its first tick', legs.every(o => o.status === 'open'));

  // Walk the replay clock across two candle closes, stepping every 5 s.
  for (const target of [at(9, 30, 5), at(9, 35, 5)]) {
    wall += target - t.now();
    await t.step();
  }
  const fed = futs().find(p => p.symbol === 'FEDERALBNK')!;
  ok('row 13: FEDERALBNK — two closes above SMA9 mark the exit at 09:35:05', fed.exitDue === true && fed.against === 2, `${fed.note}`);
  ok('row 13: MFSL and POLICYBZR hold (against 0)', ['MFSL', 'POLICYBZR'].every(s => { const p = futs().find(x => x.symbol === s)!; return p.status === 'open' && p.against === 0 && !p.exitDue; }));
  const callsAfter = calls;
  wall += 30_000;
  await t.step();
  ok('row 7: between boundaries, no further candle calls', calls === callsAfter, `${calls - callsAfter}`);

  tick(fed.securityId, fed.entryPx! + 1.35);
  const fedOpt = legs.find(o => o.symbol === 'FEDERALBNK')!;
  tick(fedOpt.securityId, 2.6);
  ok('row 7: FEDERALBNK future and option both close on their next tick, reason sma',
    fed.status === 'closed' && fed.reason === 'sma' && fedOpt.status === 'closed' && fedOpt.reason === 'sma');

  wall += at(15, 0) - t.now();
  await t.step();
  ok('AC3: PNBHOUSING is unfilled at 15:00 — "no break by 15:00"', pnb.status === 'unfilled' && pnb.note === 'no break by 15:00');
  wall += at(15, 15) - t.now();
  await t.step();
  ok('AC3: everything else squares off at 15:15', t.ledger.positions.every(p => p.status === 'closed' || p.status === 'unfilled'));
  ok('P32 row 12: once nothing is live the feed is released', wants.length === 0, wants.join(','));

  const saved = JSON.parse(await readFile(file, 'utf8')) as Ledger;
  const closed = saved.positions.filter(p => p.status === 'closed');
  const diffs = closed.map(p => ({ id: p.id, stored: p.pnl, again: paisePnl(p.leg === 'option' ? 'BUY' : p.side, p.entryPx!, p.exitPx!, p.qty) }));
  ok('AC4: 6 closed legs in the ledger FILE (3 futures + 3 options)', closed.length === 6, closed.map(p => `${p.symbol}${p.leg === 'option' ? '-' + p.optionType : ''}:${p.reason}`).join(','));
  ok('AC4: every stored P&L equals a second, integer-paise implementation', diffs.every(x => x.stored === x.again),
    diffs.map(x => `${x.id.slice(11)} ${x.stored}/${x.again}`).join(', '));
  const v = t.view();
  const sum = Math.round(closed.reduce((s, p) => s + paisePnl(p.leg === 'option' ? 'BUY' : p.side, p.entryPx!, p.exitPx!, p.qty) * 100, 0)) / 100;
  ok('AC4: the view\'s day P&L equals the sum recomputed from the file', v.dayPnl.total === sum, `${v.dayPnl.total} vs ${sum}`);

  // Restart: a fresh trader on the same file keeps the clock and the history.
  const t2 = new PaperTrader({ file, mode: 'replay', lookup, wall: () => wall, scan: async () => fixtureScan, candles: async () => ({ bars: [], why: 'x' }), options: () => [], onWants: () => {} });
  await t2.load();
  ok('P32 AC7: the replay clock and the ledger survive a restart', Math.abs(t2.now() - t.now()) < 1000 && t2.ledger.positions.length === t.ledger.positions.length);

  // A failed candle read is retried after RETRY_MS, not every second (amendment 15).
  let failCalls = 0;
  const t3 = new PaperTrader({
    file: path.join(dir, 'x.json'), mode: 'replay', lookup, wall: () => wall, scan: async () => fixtureScan,
    candles: async () => { failCalls++; return { bars: [], why: 'request failed (DH-904)' }; }, options: () => [], onWants: () => {},
  });
  await t3.load();
  await t3.runNow();
  wall += 5000; await t3.step();
  const first = failCalls;
  wall += RETRY_MS - 1000; await t3.step();
  ok('amendment 15: a failed read is NOT retried 59 s later', failCalls === first, `${failCalls}`);
  wall += 1000; await t3.step();
  ok('amendment 15: …and IS retried at 60 s', failCalls === first * 2, `${first} → ${failCalls}`);
  ok('row 3: the failure is named on the waiting row', t3.ledger.positions.every(p => p.rangeNote === 'request failed (DH-904)'));
  const refused = await t3.runNow();
  ok('P32 amendment 20: Run now refuses while positions are pending or open', !refused.ok);
  await rm(dir, { recursive: true, force: true });
}

/* ------------------------------------------------------------- constants */

ok('P32 row 13: replay and live keep separate ledger files',
  ledgerPath(true).endsWith('paper-ledger.replay.json') && ledgerPath(false).endsWith('paper-ledger.json'));
ok('spec constants: scan 09:20–09:30, range ready 09:25, entries until 15:00, square-off 15:15, SMA 9',
  SCAN_AT_MIN === 560 && SCAN_UNTIL_MIN === 570 && RANGE_READY_MIN === 565 && ENTRY_UNTIL_MIN === 900 && SQUARE_OFF_MIN === 915 && SMA_PERIOD === 9);
ok('view(): a fresh ledger reads DISARMED', view(emptyLedger('live'), T0920).status.startsWith('disarmed'));
ok('pnlOf: SELL gains when the price falls', pnlOf('SELL', 100, 98, 10) === 20 && pnlOf('BUY', 100, 98, 10) === -20);
ok('istAt: 09:25 IST is 03:55 UTC', new Date(istAt(T0920, RANGE_READY_MIN)).toISOString().endsWith('03:55:00.000Z'));

console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
