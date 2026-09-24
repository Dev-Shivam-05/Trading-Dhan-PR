/**
 * `npm run backtest:test` — the unit half of `docs/spec/backtest-v1.md` (P37).
 *
 * AC2 and AC3 use Thursday 24 Sep's real Dhan candles (`test/fixtures/paper-2026-09-24/`, P36).
 * The engine's range, SMA and exit bar are checked against `paper.ts`'s own functions: the
 * backtest is a second implementation of the live rules, and the two must agree. Every rule is
 * also shown REJECTING something. The clock is injected everywhere.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_PARAMS, GRID, at, capSignals, ist, jobDue, keyOf, proxyScan, rangeOf, replayDay, summarise, walkForward, windowStart,
  type Candle, type DataSource, type Trade,
} from '../src/server/backtest.ts';
import { lastComplete, updateHistory } from '../src/server/history.ts';
import { applyBars, emptyLedger, openingRange, smaAt, type Position } from '../src/server/paper.ts';
import { resolveRegistry, stockOptions } from '../src/server/instruments.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const DAY = '2026-09-24';

/* ------------------------------------------------------------ clock rules */

ok('row 1: the 29-Sep contract window starts 26 Aug (after Tue 25 Aug)', windowStart('2026-09-29') === '2026-08-26', windowStart('2026-09-29'));
ok('row 1: the 27-Oct contract window starts 30 Sep (after Tue 29 Sep)', windowStart('2026-10-27') === '2026-09-30', windowStart('2026-10-27'));
ok('row 3: at 15:59 the last complete session is yesterday', lastComplete(at(DAY, 15 * 60 + 59)) === '2026-09-23');
ok('row 3: at 16:00 it is today', lastComplete(at(DAY, 16 * 60)) === DAY);
ok('AC7: 15:59 Thu -> not due', !jobDue(null, at(DAY, 15 * 60 + 59)));
ok('AC7: 16:00 Thu, never run -> due', jobDue(null, at(DAY, 16 * 60)));
ok('AC7: already run today -> not due twice', !jobDue(DAY, at(DAY, 20 * 60)));
ok('AC7: Saturday 17:00 -> not due', !jobDue('2026-09-24', at('2026-09-26', 17 * 60)));
ok('AC7: Monday 16:00 after a skipped Friday -> due (the fetch catches up)', jobDue('2026-09-24', at('2026-09-28', 16 * 60)));

/* ------------------------------------------------------------ the cap */

{
  const long = Array.from({ length: 7 }, (_, i) => ({ symbol: `L${i}`, chgPct: 3 + i }));
  const short = Array.from({ length: 6 }, (_, i) => ({ symbol: `S${i}`, chgPct: -(3.5 + i) }));
  const s = capSignals(long, short);
  ok('row 6: 13 signals are capped to 10, strongest |chg| first', s.length === 10 && s[0]!.symbol === 'L6' && s[1]!.symbol === 'S5' && !s.some(x => x.symbol === 'L0'), s.map(x => x.symbol).join(','));
}

/* ------------------------------------------------------------ the proxy funnel */

{
  const list = { symbols: ['AAA', 'BBB', 'CCC', 'DDD'], names: new Map([['AAA', 'A'], ['BBB', 'B'], ['CCC', 'C'], ['DDD', 'D']]), rows: 4 };
  const rows = [
    { symbol: 'AAA', name: 'A', px0920: 103, prevClose: 100, oi0920: 108, prevOi: 100 },   // +3%, OI +8  -> long
    { symbol: 'BBB', name: 'B', px0920: 97.5, prevClose: 100, oi0920: 110, prevOi: 100 },  // -2.5%, OI +10 -> short
    { symbol: 'CCC', name: 'C', px0920: 102.5, prevClose: 100, oi0920: 105, prevOi: 100 }, // +2.5%, OI +5 -> OI rejects
    { symbol: 'DDD', name: 'D', px0920: 101, prevClose: 100, oi0920: 150, prevOi: 100 },   // +1% -> chg rejects
  ];
  const r = proxyScan(DAY, '2026-09-23', rows, list, 20);
  ok('row 4: the proxy runs the live funnel — long AAA, short BBB; the 7% and 2% filters each reject one',
    r.long.map(x => x.symbol).join() === 'AAA' && r.short.map(x => x.symbol).join() === 'BBB' && r.rejected.oi === 1 && r.rejected.chg === 1,
    `L ${r.long.map(x => x.symbol)} S ${r.short.map(x => x.symbol)} rejected ${JSON.stringify(r.rejected)}`);
}

/* ------------------------------------------------------------ fills, synthetic */

{
  const c = (hm: string, o: number, h: number, l: number, cl: number): Candle => ({ t: at(DAY, Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3))), o, h, l, c: cl });
  // Previous day: 9 flat bars so SMA9 exists at 09:25.
  const prev: Candle[] = Array.from({ length: 9 }, (_, i) => ({ t: at('2026-09-23', 15 * 60 - 45 + 5 * i), o: 100, h: 100, l: 100, c: 100 }));
  const five = [...prev, c('09:15', 100, 101, 99, 100), c('09:20', 100, 101.5, 99.5, 100), c('09:25', 100, 100.5, 99.8, 100.2)];
  const mk = (m1: Candle[]): DataSource => ({
    fut5: () => five, contract: () => ({ futureId: 1, lot: 100, expiry: '2026-09-29' }),
    m1: id => (id === 1 ? m1 : null), options: () => [],
  });
  const base = [c('09:20', 100, 102, 100, 101), c('09:24', 101, 101.4, 101, 101.2)];   // beyond 101.5, but before 09:25
  const m1a = [...base, c('09:26', 101.4, 101.9, 101.3, 101.8), c('15:15', 101, 101, 101, 101)];
  const m1b = [...base, c('09:26', 101.6, 101.9, 101.5, 101.8), c('15:15', 101, 101, 101, 101)];
  const miss = new Set<string>();
  const ta = replayDay(DAY, 'proxy', [{ symbol: 'X', side: 'BUY', chgPct: 3 }], DEFAULT_PARAMS, mk(m1a), miss)[0];
  const tb = replayDay(DAY, 'proxy', [{ symbol: 'X', side: 'BUY', chgPct: 3 }], DEFAULT_PARAMS, mk(m1b), miss)[0];
  ok('row 7: a break before the range is ready (09:20, 09:24) is not an entry', ta?.entryT === at(DAY, 9 * 60 + 26), ta ? ist(ta.entryT).hm : 'none');
  ok('row 7: a candle that opens AT/below the level fills at level + 0.05', ta?.entryPx === 101.55, String(ta?.entryPx));
  ok('row 7: a candle that opens beyond the level fills at its open', tb?.entryPx === 101.6, String(tb?.entryPx));
  const m1c = [c('09:26', 101, 101.5, 100, 101), c('15:15', 101, 101, 101, 101)];   // touches 101.5, never above
  ok('row 6: a candle whose high only TOUCHES the level does not break', replayDay(DAY, 'proxy', [{ symbol: 'X', side: 'BUY', chgPct: 3 }], DEFAULT_PARAMS, mk(m1c), miss).length === 0);
  const m1d = [c('15:00', 101, 102, 101, 101.8), c('15:15', 101, 101, 101, 101)];
  ok('row 6: a break at 15:00 is too late', replayDay(DAY, 'proxy', [{ symbol: 'X', side: 'BUY', chgPct: 3 }], DEFAULT_PARAMS, mk(m1d), miss).length === 0);
  ok('row 6: no option list -> the future trades alone and says why', ta?.opt === null && /no CE/.test(ta?.optNote ?? ''), ta?.optNote ?? '');
}

/* ------------------------------------------------------------ AC2 / AC3 on 24 Sep */

await resolveRegistry({});
{
  const FIX = 'test/fixtures/paper-2026-09-24';
  const load = async (n: string) => JSON.parse(await readFile(path.join(FIX, `${n}.json`), 'utf8'));
  const toC = (raw: any): Candle[] => raw.timestamp.map((t: number, i: number) => ({ t: t * 1000, o: raw.open[i], h: raw.high[i], l: raw.low[i], c: raw.close[i] }));
  const ledger = await load('ledger-as-closed');
  const fut = (sym: string) => (ledger.positions as Position[]).find(p => p.symbol === sym && (p.leg ?? 'future') === 'future')!;
  const series = new Map<number, Candle[]>();
  const five = new Map<string, Candle[]>();
  for (const sym of ['MFSL', 'POLICYBZR']) {
    const f = fut(sym);
    five.set(sym, toC(await load(`${sym}-5m`)));
    series.set(f.securityId, toC(await load(`${sym}-1m`)));
    const pe = (ledger.positions as Position[]).find(p => p.symbol === sym && p.leg === 'option')!;
    series.set(pe.securityId, toC(await load(`${sym}-PE-1m`)));
  }
  const data: DataSource = {
    fut5: (sym, date) => (five.get(sym) ?? []).filter(b => b.t < at(date, 24 * 60)),
    contract: sym => ({ futureId: fut(sym).securityId, lot: fut(sym).lot, expiry: fut(sym).expiry }),
    m1: id => series.get(id) ?? null,
    options: (sym) => stockOptions(sym, DAY),
  };
  const signals = capSignals([], [{ symbol: 'POLICYBZR', chgPct: -10 }, { symbol: 'MFSL', chgPct: -9.99 }]);
  const missing = new Set<string>();
  const trades = replayDay(DAY, 'real', signals, DEFAULT_PARAMS, data, missing);
  const t = (s: string) => trades.find(x => x.symbol === s);
  const mf = t('MFSL'), pb = t('POLICYBZR');
  ok('AC3: MFSL exits at 10:55 on 2 closes above SMA9, at 1395.2', mf?.reason === 'sma' && ist(mf.exitT).hm === '10:55' && mf.exitPx === 1395.2, mf ? `${mf.reason} ${ist(mf.exitT).hm} ${mf.exitPx}` : 'no trade');
  ok('AC3: POLICYBZR is squared off at 15:15, at 1243.2', pb?.reason === 'eod' && ist(pb.exitT).hm === '15:15' && pb.exitPx === 1243.2, pb ? `${pb.reason} ${ist(pb.exitT).hm} ${pb.exitPx}` : 'no trade');
  ok('AC3: MFSL takes the live option strike (1400 PE)', mf?.opt?.strike === 1400, `${mf?.opt?.strike}`);
  // POLICYBZR's live fill was 1606 (a jump through the price band); row 7's model fills at 1700.45,
  // so the nearest PE is 1700, not the live 1600 — and the fixture holds no 1700 PE candles. The
  // engine must say so and ask for that series, not price the leg from the wrong contract.
  const pe1700 = stockOptions('POLICYBZR', DAY).find(o => o.strike === 1700 && o.optionType === 'PE');
  ok('AC3: POLICYBZR asks for the 1700 PE its model entry implies, and prices no leg without it',
    !pb?.opt && pb?.optNote === 'option candles not fetched yet' && !!pe1700 && missing.has(`m1:${pe1700.securityId}`), pb?.optNote ?? '');
  for (const x of trades) {
    const live = fut(x.symbol);
    console.log(`      entry ${x.symbol}: model ${x.entryPx} at ${ist(x.entryT).hm} vs live ${live.entryPx} (diff ${(x.entryPx - live.entryPx!).toFixed(2)}) — row 7's error, measured`);
  }

  // AC2: the second implementation agrees with paper.ts on range, SMA and the exit bar.
  for (const x of trades) {
    const bars = data.fut5(x.symbol, DAY)!;
    const r = openingRange(bars, DAY);
    ok(`AC2: ${x.symbol} range equals paper.ts openingRange`, !('error' in r) && r.high === x.range.high && r.low === x.range.low, JSON.stringify(r));
    const l = emptyLedger('live');
    const p = { ...fut(x.symbol), status: 'open', entryAt: x.entryT, lastBarT: null, against: 0, exitDue: false, sma9: null, note: null } as Position;
    l.positions.push(p);
    applyBars(l, p.id, bars, x.reason === 'sma' ? x.exitT : at(DAY, 15 * 60 + 15) - 1);
    if (x.reason === 'sma') {
      const i = bars.findIndex(b => b.t === x.exitBarT);
      ok(`AC2: ${x.symbol} paper.ts marks the exit due on the same candle, same SMA`,
        p.exitDue === true && p.lastBarT === x.exitBarT && Math.abs(smaAt(bars, i)! - x.smaAtExit!) < 1e-9, `${p.exitDue} ${p.lastBarT === x.exitBarT} ${p.note}`);
    } else {
      ok(`AC2: ${x.symbol} paper.ts sees no SMA exit before 15:15 either`, p.exitDue === false, `against ${p.against}`);
    }
  }

  // The grid changes something: a 1-close exit leaves POLICYBZR earlier than 15:15 on this day.
  const one = replayDay(DAY, 'real', signals, { ...DEFAULT_PARAMS, closes: 1 }, data, missing);
  ok('row 10: the grid is 108 distinct combinations, and a knob changes the result',
    GRID.length === 108 && new Set(GRID.map(keyOf)).size === 108 && one.some(x => x.reason === 'sma' && ist(x.exitT).hm !== '10:55'),
    one.map(x => `${x.symbol} ${x.reason} ${ist(x.exitT).hm}`).join(', '));
  ok('row 9: summary of 24 Sep adds up to the legs', (() => { const s = summarise(trades, [DAY]); return Math.abs(s.gross - (s.legs.future + s.legs.option)) < 0.01 && s.trades === 2; })());
  void rangeOf;
}

/* ------------------------------------------------------------ walk-forward, by hand */

{
  const dates = ['d1', 'd2', 'd3'];
  const pnl = new Map([['A', [10, -5, 7]], ['B', [5, 20, -3]]]);
  const w = walkForward(dates, pnl, 'A');
  ok('row 11: day 2 is scored with the day-1 winner (A), day 3 with the day-1..2 winner (B)',
    w.steps.map(s => s.chosen).join() === 'A,B' && w.heldOut === -8 && w.current === 2, `${w.steps.map(s => s.chosen)} held-out ${w.heldOut} current ${w.current}`);
  ok('row 11: whole window picks B (22 vs 12), and a tie goes to the current settings',
    w.bestNow?.key === 'B' && walkForward(['d1', 'd2'], new Map([['A', [1, 0]], ['B', [1, 5]]]), 'A').steps[0]!.chosen === 'A');
}

{
  const tr = (date: string, pnl: number) => ({ date, pnl, side: 'BUY', reason: 'eod', futPnl: pnl, opt: null }) as unknown as Trade;
  const s = summarise([tr('d1', 100), tr('d2', -300), tr('d3', 50), tr('d3', -20)], ['d1', 'd2', 'd3', 'd4']);
  ok('row 9: win %, worst day and the largest drop from a peak', s.winPct === 50 && s.worstDay?.date === 'd2' && s.maxDrawdown === 300 && s.sessions === 4 && s.gross === -170,
    `win ${s.winPct} worst ${s.worstDay?.date} dd ${s.maxDrawdown}`);
}

/* ------------------------------------------------------------ AC6: replay refuses */

{
  process.env.REPLAY = '1';
  let refused = '';
  try { await updateHistory({ clientId: 'x', accessToken: 'y' }, Date.now(), { calls: 0, failed: [] }); } catch (e) { refused = (e as Error).message; }
  delete process.env.REPLAY;
  ok('AC6: replay mode refuses to touch the history', /refuses to run in replay mode/.test(refused), refused);
}

console.log(`\n${pass} pass · ${fail} fail`);
process.exitCode = fail ? 1 : 0;
