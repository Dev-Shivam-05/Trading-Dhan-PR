/**
 * `npm run opthist:test` — P39 (`docs/spec/opthist-v1.md`): AC1-AC4 on hand-built series; AC3 and AC5 also on what
 * `npm run opthist` stored (UNMEASURED, and failing, without it).
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { stitchMonth, priceLeg, readMonth, type LegTrade } from '../src/server/opthist.ts';
import { HISTORY_DIR } from '../src/server/history.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const IST = 5.5 * 3600_000;
const T = (hm: string) => Date.parse(`2026-07-01T${hm}:00Z`) - IST;

/* AC1: ATM moves from 1300 to 1310 at 10:02; the 1300 strike comes from ATM, then from ATM-1. */
{
  const ts = ['10:00', '10:01', '10:02', '10:03'].map(h => T(h) / 1000);
  const series = new Map([
    ['0|CALL', { timestamp: ts, strike: [1300, 1300, 1310, 1310], close: [20, 21, 16, 17] }],
    ['-1|CALL', { timestamp: ts, strike: [1290, 1290, 1300, 1300], close: [27, 28, 22.5, 23] }],
    ['1|CALL', { timestamp: ts, strike: [1310, 1310, 1320, 1320], close: [15, 15.5, 12, 12.5] }],
  ]);
  const d = stitchMonth(series)['2026-07-01']!;
  const k1300 = ['10:00', '10:01', '10:02', '10:03'].map(h => d[String(T(h))]!['1300CE']);
  ok('AC1 the 1300 CE reads 20, 21 from the ATM series, then 22.5, 23 from ATM-1 after ATM moved', JSON.stringify(k1300) === JSON.stringify([20, 21, 22.5, 23]), JSON.stringify(k1300));
  ok('AC1 the 1310 CE comes from ATM+1 first (15, 15.5), then ATM (16, 17)', JSON.stringify(['10:00', '10:01', '10:02', '10:03'].map(h => d[String(T(h))]!['1310CE'])) === JSON.stringify([15, 15.5, 16, 17]));
}

/* AC2: pricing. */
{
  const day: Record<string, Record<string, number>> = {};
  for (const [hm, v] of [['10:00', { '1300CE': 20, '1310CE': 15, '1300PE': 18, '1290PE': 12 }], ['10:01', { '1300CE': 21, '1310CE': 16, '1300PE': 17, '1290PE': 11 }],
    ['11:00', { '1300CE': 30, '1310CE': 24, '1300PE': 10 }], ['11:01', { '1300CE': 31, '1310CE': 25, '1300PE': 9 }]] as const) day[String(T(hm))] = { ...v };
  const buy: LegTrade = { date: '2026-07-01', symbol: 'X', side: 'BUY', lot: 500, entryT: T('10:00') + 20_000, entryPx: 1304, exitT: T('11:00') + 5_000 };
  const a = priceLeg(buy, day, 'level');
  ok('AC2 a BUY buys the CE at the strike nearest the entry (1304 -> 1300)', 'strike' in a && a.type === 'CE' && a.strike === 1300 && a.entry === 20 && a.exit === 30 && a.gross === 5000, JSON.stringify(a));
  const b = priceLeg(buy, day, 'late1m');
  ok('AC2 late1m prices one minute later at both ends (21 -> 31)', 'strike' in b && b.entry === 21 && b.exit === 31);
  const tie = priceLeg({ ...buy, entryPx: 1305 }, day, 'level');
  ok('AC2 an exact tie (1305) goes to the lower strike', 'strike' in tie && tie.strike === 1300);
  const sell = priceLeg({ ...buy, side: 'SELL', entryPx: 1296 }, day, 'level');
  ok('AC2 a SELL buys the PE (1296 -> 1300 PE, 18 -> 10)', 'strike' in sell && sell.type === 'PE' && sell.strike === 1300 && sell.gross === -4000);
  const gone = priceLeg({ ...buy, side: 'SELL', entryPx: 1291 }, day, 'level');
  ok('AC2 a strike not quoted at the exit is no-price, never guessed', 'noPrice' in gone, JSON.stringify(gone));
  ok('AC2 no data for the day is no-price', 'noPrice' in priceLeg(buy, undefined, 'level'));
  ok('AC4 two pricing runs are identical', JSON.stringify(priceLeg(buy, day, 'level')) === JSON.stringify(a));
}

/* AC3/AC5 on stored data. */
const rep = path.join(HISTORY_DIR, 'optleg-report.json');
if (!existsSync(rep)) ok('AC3/AC5 UNMEASURED: run npm run opthist first', false);
else {
  const r = JSON.parse(readFileSync(rep, 'utf8'));
  const train = JSON.parse(readFileSync(path.join(HISTORY_DIR, 'train-report.json'), 'utf8'));
  let indep = 0;
  const onDisk = new Map<string, boolean>();
  for (const t of train.trades[r.recKey] as LegTrade[]) {
    const k = `${t.symbol}|${t.date.slice(0, 7)}`;
    if (!onDisk.has(k)) onDisk.set(k, !!(await readMonth(t.symbol, t.date.slice(0, 7))));
    if (onDisk.get(k)) indep++;
  }
  const lv = r.settings[`${r.recKey} level`];
  ok('AC3 priced + no-price = the pick\'s trades on stored stock-months, counted independently', lv && lv.priced + lv.noPrice === indep && lv.onDisk === indep, `${lv?.priced} + ${lv?.noPrice} vs ${indep}`);
  ok('AC5 the report prints the pick and the baseline under both fills', ['level', 'late1m'].every(f => r.settings[`${r.recKey} ${f}`] && Object.keys(r.settings).some(k => k.startsWith('chg2/gap') && k.endsWith(f))));
}
const src = readFileSync(new URL('../src/server/opthist.ts', import.meta.url), 'utf8');
ok('AC4 the fetch refuses replay mode', /if \(isReplay\(\)\) throw/.test(src));
ok('AC4 the only Dhan call is the chart endpoint (no order route exists in dhan.ts to reach)', !/\/orders|placeOrder/.test(src) && /\/v2\/charts\/rollingoption/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
