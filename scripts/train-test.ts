/**
 * `npm run train:test`: the unit half of `docs/spec/train-all-v1.md` (P44).
 *
 * AC2 holds the trainer's engine to P37's `replayDay` on Thursday 24 Sep's real futures candles.
 * `replayDay` is itself held to `paper.ts` by `backtest:test`. AC4 shows every rule rejecting
 * something, on hand-built candles where the right answer can be read off by eye.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PARAMS, at, capSignals, ist, replayDay, type Candle, type DataSource } from '../src/server/backtest.ts';
import type { Position } from '../src/server/paper.ts';
import {
  BASELINE, costOf, chgAt0920, fiveFromOne, makeStock, priceAt, selectDay, tradeOne, walkForwardTrain, runGrid, tkey,
  type TrainParams, type ComboResult,
} from '../src/server/train.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/* ------------------------------------------------------------ AC2 on 24 Sep */
{
  const DAY = '2026-09-24';
  const FIX = 'test/fixtures/paper-2026-09-24';
  const load = async (n: string) => JSON.parse(await readFile(path.join(FIX, `${n}.json`), 'utf8'));
  const toC = (raw: any): Candle[] => raw.timestamp.map((t: number, i: number) => ({ t: t * 1000, o: raw.open[i], h: raw.high[i], l: raw.low[i], c: raw.close[i] }));
  const ledger = await load('ledger-as-closed');
  const fut = (sym: string) => (ledger.positions as Position[]).find(p => p.symbol === sym && (p.leg ?? 'future') === 'future')!;
  const one = new Map<string, Candle[]>(), five = new Map<string, Candle[]>();
  for (const sym of ['MFSL', 'POLICYBZR']) { one.set(sym, toC(await load(`${sym}-1m`))); five.set(sym, toC(await load(`${sym}-5m`))); }
  const data: DataSource = {
    fut5: (sym, date) => (five.get(sym) ?? []).filter(b => b.t < at(date, 24 * 60)),
    contract: sym => ({ futureId: fut(sym).securityId, lot: fut(sym).lot, expiry: fut(sym).expiry }),
    m1: id => one.get(['MFSL', 'POLICYBZR'].find(s => fut(s).securityId === id)!) ?? null,
    options: () => [],
  };
  const signals = capSignals([], [{ symbol: 'POLICYBZR', chgPct: -10 }, { symbol: 'MFSL', chgPct: -9.99 }]);
  const p37 = replayDay(DAY, 'real', signals, DEFAULT_PARAMS, data, new Set());
  for (const sym of ['MFSL', 'POLICYBZR']) {
    const s = makeStock(sym, fut(sym).lot, one.get(sym)!, new Map(), five.get(sym)!);
    const a = tradeOne(s, DAY, { symbol: sym, chg: sym === 'MFSL' ? -9.99 : -10 }, BASELINE, new Map());
    const b = p37.find(x => x.symbol === sym);
    const same = !('skip' in a) && !!b && a.side === b.side && a.entryT === b.entryT && a.entryPx === b.entryPx
      && a.exitT === b.exitT && a.exitPx === b.exitPx && a.reason === b.reason && a.gross === b.futPnl;
    ok(`AC2: ${sym} trainer = P37 replayDay (side, entry minute and price, exit instant and price, reason, gross)`, same,
      'skip' in a ? a.skip : `${a.side} in ${ist(a.entryT).hm} ${a.entryPx} out ${ist(a.exitT).hm} ${a.exitPx} ${a.reason} ${a.gross} | P37 ${b ? `${ist(b.entryT).hm} ${b.entryPx} ${ist(b.exitT).hm} ${b.exitPx} ${b.reason} ${b.futPnl}` : 'none'}`);
  }
  // The trainer builds its own 5-minute bars from 1-minute candles for the share series. On the
  // future, where Dhan supplies both, the built bars must equal Dhan's inside the session.
  for (const sym of ['MFSL', 'POLICYBZR']) {
    const built = fiveFromOne(one.get(sym)!).filter(b => ist(b.t).date === DAY);
    const dhan = five.get(sym)!.filter(b => ist(b.t).date === DAY && ist(b.t).minutes <= 15 * 60 + 25);
    const eq = built.length === dhan.length && built.every((b, i) => b.t === dhan[i]!.t && b.o === dhan[i]!.o && b.h === dhan[i]!.h && b.l === dhan[i]!.l && b.c === dhan[i]!.c);
    ok(`AC2: ${sym} 5-minute bars built from 1-minute equal Dhan's own (${dhan.length} bars)`, eq, `${built.length} built vs ${dhan.length}`);
  }
}

/* ------------------------------------------------------------ AC4 on hand-built candles */

const D = '2026-09-21', PREV = '2026-09-18';
/** A flat day at `px` from 09:15 to 15:14, with the given minutes overridden as [o, h, l, c]. */
function day(px: number, over: Record<string, [number, number, number, number]> = {}, until = '15:14'): Candle[] {
  const out: Candle[] = [];
  const [uh, um] = until.split(':').map(Number) as [number, number];
  for (let m = 9 * 60 + 15; m <= uh * 60 + um; m++) {
    const hm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const [o, h, l, c] = over[hm] ?? [px, px, px, px];
    out.push({ t: at(D, m), o, h, l, c });
  }
  return out;
}
/** 09:15-09:24 forms a range of [99, 101] around 100 (two 5-minute bars). */
const RANGE: Record<string, [number, number, number, number]> = { '09:16': [100, 101, 99, 100], '09:21': [100, 100.5, 99.5, 100] };
const stock = (c: Candle[], sym = 'X') => makeStock(sym, 100, c, new Map([[PREV, 95]]));
const P = (x: Partial<TrainParams> = {}): TrainParams => ({ ...BASELINE, ...x });

// Row 5: chg at 09:20:00 is the 09:19 close against the previous official close.
{
  const s = stock(day(100, { ...RANGE, '09:19': [100, 100, 100, 99.75] }));
  ok('row 5: chg uses the 09:19 close (99.75) against the previous close (95)', chgAt0920(s, D, PREV) === 5, String(chgAt0920(s, D, PREV)));
  ok('row 5: no previous close, no chg', chgAt0920(s, D, null) === null);
}
// Row 5: minChg and the cap of 10.
{
  const picks = [{ symbol: 'A', chg: 1.5 }, { symbol: 'B', chg: -2.5 }, { symbol: 'C', chg: 2 }];
  ok('row 5: minChg 2 rejects 1.5 and keeps -2.5 and 2', selectDay(picks, 2, 'gap').map(p => p.symbol).join() === 'B,C');
  ok('row 5: minChg 1 keeps 1.5', selectDay(picks, 1, 'gap').length === 3);
  const many = Array.from({ length: 15 }, (_, i) => ({ symbol: `S${String(i).padStart(2, '0')}`, chg: 3 + i }));
  const top = selectDay(many, 2, 'gap');
  ok('row 5: the cap takes the 10 strongest', top.length === 10 && top[0]!.chg === 17 && top[9]!.chg === 8);
  ok('row 6: gap mode rejects a stock at exactly 0%', selectDay([{ symbol: 'Z', chg: 0 }], 0, 'gap').length === 0 && selectDay([{ symbol: 'Z', chg: 0 }], 0, 'either').length === 1);
}
// Row 7: a strict break, the gap direction, the double break, the 15:00 cut-off, the frozen range.
{
  const down = stock(day(100, { ...RANGE, '10:00': [99, 99, 98.9, 98.95] }));
  const g = tradeOne(down, D, { symbol: 'X', chg: 3 }, P(), new Map());
  ok('row 6: a GAINER that only breaks down is not traded in gap mode', 'skip' in g && g.skip === 'no-break', 'skip' in g ? g.skip : g.side);
  const e = tradeOne(down, D, { symbol: 'X', chg: 3 }, P({ dir: 'either' }), new Map());
  ok('row 6: the same stock is SOLD in either mode, at the level − 0.05', !('skip' in e) && e.side === 'SELL' && e.entryPx === 98.95 && ist(e.entryT).hm === '10:00', 'skip' in e ? e.skip : `${e.side} ${e.entryPx}`);
  const touch = stock(day(100, { ...RANGE, '10:00': [100, 101, 100, 101] }));
  const tt = tradeOne(touch, D, { symbol: 'X', chg: 3 }, P(), new Map());
  ok('row 7: a touch AT the high is not a break', 'skip' in tt && tt.skip === 'no-break');
  const both = stock(day(100, { ...RANGE, '10:00': [100, 101.5, 98.5, 100] }));
  const bb = tradeOne(both, D, { symbol: 'X', chg: 3 }, P({ dir: 'either' }), new Map());
  ok('row 6: both sides broken in one minute is skipped in either mode', 'skip' in bb && bb.skip === 'double-break');
  const bg = tradeOne(both, D, { symbol: 'X', chg: 3 }, P(), new Map());
  ok('row 6: … and bought in gap mode (only the up side counts)', !('skip' in bg) && bg.side === 'BUY' && bg.entryPx === 101.05);
  const late = stock(day(100, { ...RANGE, '15:00': [100, 102, 100, 102] }));
  ok('row 7: a break at 15:00 is too late', (r => 'skip' in r && r.skip === 'no-break')(tradeOne(late, D, { symbol: 'X', chg: 3 }, P(), new Map())));
  const inTime = stock(day(100, { ...RANGE, '14:59': [100, 102, 100, 102] }));
  ok('row 7: a break at 14:59 is taken', !('skip' in tradeOne(inTime, D, { symbol: 'X', chg: 3 }, P(), new Map())));
  const gapOpen = stock(day(100, { ...RANGE, '10:00': [101.6, 101.8, 101.5, 101.7] }));
  ok('row 7: a candle that OPENS beyond fills at its open', (r => !('skip' in r) && r.entryPx === 101.6)(tradeOne(gapOpen, D, { symbol: 'X', chg: 3 }, P(), new Map())));
  const narrow = stock(day(100, { '09:16': [100, 100.1, 99.9, 100], '10:00': [100, 100.3, 100, 100.3] }));
  const fz = tradeOne(narrow, D, { symbol: 'X', chg: 3 }, P({ frozen: true }), new Map());
  ok('row 11: a 0.2% range is skipped with the frozen rule on', 'skip' in fz && fz.skip === 'frozen');
  ok('row 11: … and traded with it off', !('skip' in tradeOne(narrow, D, { symbol: 'X', chg: 3 }, P({ frozen: false }), new Map())));
}
// Row 8: stop, target, SMA and the 15:15 price.
{
  // Long at 101.05; range low 99 is the stop (risk 2.05); the target is 101.05 + 4.1 = 105.15.
  const base = { ...RANGE, '10:00': [100, 101.2, 100, 101.1] as [number, number, number, number] };
  const fall = stock(day(101, { ...base, '10:30': [100, 100, 98.5, 98.6] }));
  const st = tradeOne(fall, D, { symbol: 'X', chg: 3 }, P({ stop: true, sma: 20, closes: 3 }), new Map());
  ok('row 8: the stop exits at the range low (99)', !('skip' in st) && st.reason === 'stop' && st.exitPx === 99 && ist(st.exitT).hm === '10:30', 'skip' in st ? st.skip : `${st.reason} ${st.exitPx} ${ist(st.exitT).hm}`);
  const gapDown = stock(day(101, { ...base, '10:30': [98, 98.2, 97.5, 98] }));
  ok('row 8: a candle that opens through the stop fills at its open (98)', (r => !('skip' in r) && r.reason === 'stop' && r.exitPx === 98)(tradeOne(gapDown, D, { symbol: 'X', chg: 3 }, P({ stop: true, sma: 20, closes: 3 }), new Map())));
  const noStop = tradeOne(fall, D, { symbol: 'X', chg: 3 }, P({ stop: false, sma: 20, closes: 3 }), new Map());
  ok('row 8: with the stop off the same dip does not exit at 10:30', !('skip' in noStop) && noStop.reason !== 'stop');
  const rise = stock(day(101, { ...base, '11:00': [104, 105.5, 104, 105] }));
  const tg = tradeOne(rise, D, { symbol: 'X', chg: 3 }, P({ target: true, sma: 20, closes: 3 }), new Map());
  ok('row 8: the 2R target exits at 105.15', !('skip' in tg) && tg.reason === 'target' && tg.exitPx === 105.15, 'skip' in tg ? tg.skip : `${tg.reason} ${tg.exitPx}`);
  const bothHit = stock(day(101, { ...base, '11:00': [101, 106, 98, 101] }));
  ok('row 8: stop and target in one candle: the stop wins', (r => !('skip' in r) && r.reason === 'stop')(tradeOne(bothHit, D, { symbol: 'X', chg: 3 }, P({ stop: true, target: true, sma: 20, closes: 3 }), new Map())));
  const entryDip = stock(day(101, { ...RANGE, '10:00': [100, 101.2, 98, 101.1] }));
  ok('row 8: a stop touched inside the ENTRY minute is not seen (order unknown)', (r => !('skip' in r) && r.reason !== 'stop')(tradeOne(entryDip, D, { symbol: 'X', chg: 3 }, P({ stop: true, sma: 20, closes: 3 }), new Map())));
  // SMA: flat 101 after entry, then two 5-minute closes at 100.5 (below the SMA of ~101).
  const sm = stock(day(101, { ...base, '11:04': [101, 101, 100.5, 100.5], '11:09': [100.5, 100.5, 100.5, 100.5] }));
  const s2 = tradeOne(sm, D, { symbol: 'X', chg: 3 }, P({ sma: 5, closes: 2 }), new Map());
  ok('row 8: two closes below SMA5 exit at 11:10, priced at the 11:10 open', !('skip' in s2) && s2.reason === 'sma' && ist(s2.exitT).hm === '11:10' && s2.exitPx === 101, 'skip' in s2 ? s2.skip : `${s2.reason} ${ist(s2.exitT).hm} ${s2.exitPx}`);
  const s3 = tradeOne(sm, D, { symbol: 'X', chg: 3 }, P({ sma: 5, closes: 3 }), new Map());
  ok('row 8: … but not with 3 closes required', !('skip' in s3) && s3.reason === 'eod');
  // 15:15: the series ends at 15:14 (Dhan's cash series since August); the price is that candle's close.
  const end = stock(day(101, { ...base, '15:14': [101, 101.4, 101, 101.3] }));
  const eo = tradeOne(end, D, { symbol: 'X', chg: 3 }, P({ sma: 20, closes: 3 }), new Map());
  ok('row 8: square-off at 15:15 takes the 15:14 close when no 15:15 candle exists', !('skip' in eo) && eo.reason === 'eod' && eo.exitPx === 101.3, 'skip' in eo ? eo.skip : `${eo.reason} ${eo.exitPx}`);
  ok('row 8: … and the 15:15 open when there is one', priceAt(stock(day(101, { '15:15': [102, 102, 102, 102] }, '15:29')), D, at(D, 15 * 60 + 15)) === 102);
  ok('row 8: no candle at or before the instant, no price', priceAt(end, D, at(D, 9 * 60 + 15)) === 101 && priceAt(end, D, at(D, 9 * 60 + 14)) === null);
}
// Row 9: costs, by hand. BUY 100 → 101, qty 100: buy 10,000, sell 10,100, turnover 20,100.
{
  const exch = 0.0000173 * 20100, sebi = 0.000001 * 20100;
  const hand = Math.round((40 + 0.0002 * 10100 + exch + sebi + 0.00002 * 10000 + 0.18 * (40 + exch + sebi)) * 100) / 100;
  ok('row 9: a round trip costs what the hand sum says', costOf('BUY', 100, 101, 100) === hand, `${costOf('BUY', 100, 101, 100)} vs ${hand}`);
  ok('row 9: a SELL pays STT on its ENTRY (the sell)', costOf('SELL', 101, 100, 100) === hand);
  const t = tradeOne(stock(day(101, { ...RANGE, '10:00': [100, 101.2, 100, 101.1] })), D, { symbol: 'X', chg: 3 }, P({ sma: 20, closes: 3 }), new Map());
  ok('row 9: net = gross − cost', !('skip' in t) && Math.abs(t.net - (t.gross - t.cost)) < 0.005 && t.cost > 0);
}
// Row 13: the walk-forward's trade floor and its tie rule.
{
  const sessions = Array.from({ length: 12 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
  const mk = (key: string, perDay: number[], trades: number[]): ComboResult => ({
    key, p: BASELINE, perDay: Float64Array.from(perDay), tradesPerDay: Int32Array.from(trades), trades: trades.reduce((s, x) => s + x, 0), wins: 0, gross: 0, cost: 0, net: perDay.reduce((s, x) => s + x, 0),
    skips: { 'no-day': 0, 'no-range': 0, frozen: 0, 'no-break': 0, 'double-break': 0, 'no-exit-price': 0 },
  });
  const baseKey = tkey(BASELINE);
  const lucky = mk('lucky', Array(12).fill(1000), Array(12).fill(1));        // 10 trades in 10 sessions: below the floor
  const solid = mk('solid', Array(12).fill(100), Array(12).fill(3));         // 30 trades
  const base = mk(baseKey, Array(12).fill(50), Array(12).fill(3));
  const wf = walkForwardTrain(sessions, [lucky, solid, base], baseKey);
  ok('row 13: a setting under 20 training trades is never chosen, however good', wf.steps.every(s => s.chosen === 'solid'), wf.steps.map(s => s.chosen).join());
  ok('row 13: the first test session is the 11th', wf.steps.length === 2 && wf.steps[0]!.testDate === sessions[10]);
  const tie = walkForwardTrain(sessions, [mk('aaa', Array(12).fill(50), Array(12).fill(3)), base], baseKey);
  ok('row 13: a tie goes to the baseline', tie.steps.every(s => s.chosen === baseKey));
}
// Row 11: the grid runs end to end on two hand-built stocks and counts its skips.
{
  const a = makeStock('A', 100, day(101, { ...RANGE, '10:00': [100, 101.2, 100, 101.1] }), new Map([[PREV, 95]]));
  const b = makeStock('B', 100, day(100, { '09:16': [100, 100.1, 99.9, 100] }), new Map([[PREV, 110]]));
  const picks = new Map([[D, [{ symbol: 'A', chg: 6.32 }, { symbol: 'B', chg: -9.09 }]]]);
  const g = runGrid([a, b], [D], picks, [P(), P({ frozen: true })]);
  ok('row 11: A trades, B never breaks (baseline)', g.results[0]!.trades === 1 && g.results[0]!.skips['no-break'] === 1, JSON.stringify(g.results[0]!.skips));
  ok('row 11: with the frozen rule, B is counted as frozen instead', g.results[1]!.skips.frozen === 1);
}

// Row 18: the one-minute-late fill model.
{
  const s = stock(day(101, { ...RANGE, '10:00': [100, 101.2, 100, 101.1], '10:30': [100, 100, 98.5, 98.6] }));
  const lv = tradeOne(s, D, { symbol: 'X', chg: 3 }, P({ stop: true, sma: 20, closes: 3 }), new Map(), 'level');
  const lt = tradeOne(s, D, { symbol: 'X', chg: 3 }, P({ stop: true, sma: 20, closes: 3 }), new Map(), 'late1m');
  ok('row 18: late fill enters at the break candle close (101.1, not 101.05)', !('skip' in lt) && lt.entryPx === 101.1 && !('skip' in lv) && lv.entryPx === 101.05);
  ok('row 18: late fill stops at the stop candle close (98.6, not 99)', !('skip' in lt) && lt.reason === 'stop' && lt.exitPx === 98.6);
  const e = stock(day(101, { ...RANGE, '10:00': [100, 101.2, 100, 101.1], '15:14': [101, 101.4, 101, 101.3] }));
  ok('row 18: with no 15:15 candle the late fill falls back to the 15:14 close', (r => !('skip' in r) && r.exitPx === 101.3)(tradeOne(e, D, { symbol: 'X', chg: 3 }, P({ sma: 20, closes: 3 }), new Map(), 'late1m')));
  const e2 = stock(day(101, { ...RANGE, '10:00': [100, 101.2, 100, 101.1], '15:15': [101, 102, 101, 101.8] }, '15:29'));
  ok('row 18: … and takes the 15:15 candle close when it exists', (r => !('skip' in r) && r.exitPx === 101.8)(tradeOne(e2, D, { symbol: 'X', chg: 3 }, P({ sma: 20, closes: 3 }), new Map(), 'late1m')));
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
