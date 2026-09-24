/**
 * `npm run phone:test` — P40 (phone messages) and P41 row 3 (the tick recorder) of
 * `docs/spec/phone-sandbox-v1.md`. The clock is injected; the recorder writes to a temp CACHE_DIR.
 * Every rule is also shown NOT firing: a restart re-announces nothing, a second 09:30 or 15:20 does
 * not repeat, nothing is recorded before 09:14, and no option is chosen before 09:20.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(tmpdir(), 'phone-test-'));
process.env.CACHE_DIR = tmp;   // before any module reads it
const { PaperTrader, digestEvent, summaryEvent, statusMap, transitions, emptyLedger } = await import('../src/server/paper.ts');
const { TickRecorder, nearestStrikes } = await import('../src/server/ticks.ts');
type Ledger = import('../src/server/paper.ts').Ledger;
type Position = import('../src/server/paper.ts').Position;

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const DAY = '2026-09-24';
const at = (h: number, m: number, s = 0, d = DAY) => Date.parse(`${d}T00:00:00Z`) - 5.5 * 3600_000 + ((h * 60 + m) * 60 + s) * 1000;

/** 24 Sep's real ledger, rewound to "both futures pending, nothing entered". */
async function day(): Promise<Ledger> {
  const l = JSON.parse(await readFile('test/fixtures/paper-2026-09-24/ledger-as-closed.json', 'utf8')) as Ledger;
  l.positions = l.positions.filter(p => (p.leg ?? 'future') === 'future').map(p => ({ ...p, status: 'pending', entryPx: null, entryAt: null, exitPx: null, exitAt: null, reason: null, pnl: null, ltp: null, ltpAt: null } as Position));
  return l;
}

/* ------------------------------------------------------------ transitions */

{
  const l = await day();
  const before = statusMap(l);
  const mf = l.positions.find(p => p.symbol === 'MFSL')!;
  Object.assign(mf, { status: 'open', entryPx: 1401.3, entryAt: at(9, 49, 1) });
  const e1 = transitions(before, l);
  ok('P40: an entry is one message, with side, contract, price and why', e1.length === 1 && e1[0]!.title === 'SELL MFSL FUT @ 1401.30' && /broke below 1404.30 \(range 1427.40-1404.30\)/.test(e1[0]!.body), `${e1[0]?.title} | ${e1[0]?.body}`);
  ok('P40: no change -> no message', transitions(statusMap(l), l).length === 0);
  const b2 = statusMap(l);
  Object.assign(mf, { status: 'closed', exitPx: 1395.2, exitAt: at(10, 55), reason: 'sma', pnl: 2440 });
  const e2 = transitions(b2, l);
  ok('P40: an exit carries price, P&L in ASCII and the reason', e2.length === 1 && e2[0]!.title === 'EXIT MFSL FUT @ 1395.20 +Rs 2,440.00' && /closes against SMA9/.test(e2[0]!.body) && /^[\x20-\x7e]+$/.test(e2[0]!.title), e2[0]?.title);
}

/* ------------------------------------------------------------ 09:30 and 15:20 */

{
  const l = await day();
  ok('P40: no 09:30 message at 09:29', digestEvent(l, at(9, 29, 59)) === null);
  const d = digestEvent(l, at(9, 30));
  ok('P40: the 09:30 message lists both waiting stocks and their levels', !!d && /2 signals · 2 taken/.test(d.title) && /POLICYBZR SELL/.test(d.body) && /MFSL SELL/.test(d.body), d ? `${d.title} | ${d.body.replace(/\n/g, ' / ')}` : 'none');
  ok('P40: the 09:30 message is sent once', digestEvent(l, at(9, 45)) === null && l.days[DAY]!.pushed?.digest === true);
  ok('P40: no summary at 15:19', summaryEvent(l, at(15, 19)) === null);
  const s = summaryEvent(l, at(15, 20));
  ok('P40: the 15:20 summary goes out once', !!s && summaryEvent(l, at(15, 40)) === null, s?.title);
  const empty = emptyLedger('live');
  ok('P40: no scan that day -> no summary', summaryEvent(empty, at(15, 20)) === null);
}

/* ------------------------------------------------------------ restart does not re-announce */

{
  const l = await day();
  const mf = l.positions.find(p => p.symbol === 'MFSL')!;
  Object.assign(mf, { status: 'open', entryPx: 1401.3, entryAt: at(9, 49, 1) });
  const file = path.join(tmp, 'ledger.json');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(file, JSON.stringify(l));
  const events: string[] = [];
  let wall = at(9, 50);
  const t = new PaperTrader({
    file, mode: 'live', wall: () => wall, lookup: () => undefined, scan: async () => { throw new Error('x'); },
    candles: async () => ({ bars: [], why: 'x' }), options: () => [], onWants: () => {}, onEvent: e => events.push(e.title),
  });
  await t.load();
  ok('P40: a restart with MFSL already open sends nothing', events.length === 0, events.join(' | '));
  t.onFeedTick({ seg: 'NSE_FNO', securityId: 68768, ltp: 1700.4 } as any);   // POLICYBZR breaks its 1700.5 low
  await new Promise(r => setTimeout(r, 50));
  ok('P40: the next real entry goes out through the shell', events.includes('SELL POLICYBZR FUT @ 1700.40'), events.join(' | '));
}

/* ------------------------------------------------------------ the recorder */

{
  const options = [1350, 1375, 1400, 1425, 1450, 1475, 1500].flatMap((k, i) => (['CE', 'PE'] as const).map((t, j) => ({ strike: k, optionType: t, securityId: 9000 + i * 2 + j })));
  const n = nearestStrikes(options, 1410, 'CE');
  ok('P41 row 3: the 5 CE strikes nearest 1410 are 1400, 1425, 1375, 1450, 1350', n.map(o => o.strike).join() === '1400,1425,1375,1450,1350', n.map(o => o.strike).join());
  let wants: number[] = [];
  const r = new TickRecorder({ universe: () => [{ symbol: 'MFSL', futureId: 68691, lot: 400, expiry: '2026-09-29', options }], onWants: s => { wants = s.map(x => x.securityId); } });
  await r.step(at(9, 13, 59));
  ok('P41 row 3: nothing before 09:14', wants.length === 0);
  await r.step(at(9, 14));
  ok('P41 row 3: 09:14 subscribes the future only', wants.join() === '68691');
  r.onTick({ seg: 'NSE_FNO', securityId: 68691, at: at(9, 15, 1), ltp: 1410, ltt: null, volume: 10, oi: 5, open: null, high: null, low: null, close: null });
  await r.step(at(9, 19, 59));
  ok('P41 row 3: no options before 09:20', wants.length === 1);
  await r.step(at(9, 20));
  ok('P41 row 3: at 09:20 the future + 5 CE + 5 PE are recorded', wants.length === 11 && r.status().optionsChosenFor === 1, `${wants.length}`);
  r.onTick({ seg: 'NSE_FNO', securityId: 9004, at: at(9, 20, 3), ltp: 22.5, ltt: null, volume: 1, oi: null, open: null, high: null, low: null, close: null });
  r.onTick({ seg: 'NSE_EQ', securityId: 2142, at: at(9, 20, 3), ltp: 1400, ltt: null, volume: 1, oi: null, open: null, high: null, low: null, close: null });
  r.onTick({ seg: 'NSE_FNO', securityId: 1, at: at(9, 20, 3), ltp: 1, ltt: null, volume: 1, oi: null, open: null, high: null, low: null, close: null });
  await r.step(at(15, 31));
  const csv = (await readFile(path.join(tmp, 'ticks', DAY, 'ticks.csv'), 'utf8')).trim().split('\n');
  const sum = JSON.parse(await readFile(path.join(tmp, 'ticks', DAY, 'summary.json'), 'utf8'));
  ok('P41 row 3: only recorded instruments are written (the cash tick and a stranger are not)', csv.length === 3 && csv[0]!.startsWith('recv_ms,') && csv[2]!.includes(',9004,22.5,'), csv.join(' / '));
  ok('P41 row 3: 15:31 closes the day — counts written, the feed released', sum.ticks === 2 && sum.instruments === 11 && sum.silent === 9 && wants.length === 0, `${sum.ticks} ticks, ${sum.silent} silent`);
}

await rm(tmp, { recursive: true, force: true });
console.log(`\n${pass} pass · ${fail} fail`);
process.exitCode = fail ? 1 : 0;
