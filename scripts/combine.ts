/**
 * `npm run combine` — P43 (`docs/spec/combine-v1.md`): does the NIFTY LTP scenario at a stock trade's entry separate
 * the 09:20 ORB trades that win from the ones that lose? P44's trades (both settings, both fills) against P49's verdict
 * at the minute BEFORE entry. Writes `.cache/history/combine-report.json`. No Dhan call, and nothing live changes.
 */

import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { HISTORY_DIR } from '../src/server/history.ts';
import { readDay } from '../src/server/chainhist.ts';
import { runDay } from '../src/server/ltp-state.ts';
import { loadStocks } from '../src/server/shadow.ts';
import { sessionsOf, dayPicks, runGrid, BASELINE, tkey, type TTrade, type FillModel, type TrainParams } from '../src/server/train.ts';
import { verdict, type Arm } from './lib/ltp-verdict.ts';
import { marketOf, alignment } from './lib/combine-lib.ts';

{
  const train = JSON.parse(await readFile(path.join(HISTORY_DIR, 'train-report.json'), 'utf8')) as { recommendation?: { key: string } };
  const PICK: TrainParams = { minChg: 0, dir: 'either', rangeBars: 3, sma: 20, closes: 3, stop: true, target: false, frozen: false };
  const { stocks } = await loadStocks();
  const sessions = sessionsOf(stocks);
  const picks = dayPicks(stocks, sessions);
  // The market's verdict per minute, per session: P49 on the rebuilt NIFTY chain.
  const verdicts = new Map<string, Map<number, { s: number | null; v: string | null }>>();
  for (const d of sessions) {
    const day = await readDay(d);
    if (!day) continue;
    verdicts.set(d, new Map(runDay(day).map(m => [m.t, { s: m.scenario, v: m.verdict }])));
  }
  console.log(`${sessions.length} sessions (${sessions[0]}..${sessions.at(-1)}), NIFTY verdicts for ${verdicts.size}; recommendation on file: ${train.recommendation?.key}`);
  const report: Record<string, unknown> = {};
  const inr = (x: number) => (x < 0 ? '−' : '+') + '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN');
  for (const [name, p] of [['baseline', BASELINE], ['pick', PICK]] as const) {
    const arms: Record<FillModel, Arm[]> = { level: [], late1m: [] };
    const rows: Record<string, unknown> = {};
    for (const fill of ['level', 'late1m'] as FillModel[]) {
      const { kept } = runGrid(stocks, sessions, picks, [p], new Set([tkey(p)]), fill);
      const trades: TTrade[] = kept.get(tkey(p)) ?? [];
      const by: Record<string, { trades: number; net: number }> = { with: { trades: 0, net: 0 }, against: { trades: 0, net: 0 }, other: { trades: 0, net: 0 } };
      const markets: Record<string, number> = {};
      for (const t of trades) {
        // Row 4: the verdict on screen BEFORE the entry minute.
        const m0 = Math.floor(t.entryT / 60_000) * 60_000 - 60_000;
        const at = verdicts.get(t.date)?.get(m0);
        const mk = marketOf(at?.s ?? null, at?.v ?? null);
        markets[mk] = (markets[mk] ?? 0) + 1;
        const a = alignment(t.side, mk);
        by[a]!.trades++; by[a]!.net += t.net;
      }
      const all = trades.reduce((s, t) => s + t.net, 0);
      const filtered = all - by.against!.net;
      console.log(`\n${name} (${fill}): ${trades.length} trades, net ${inr(all)}. NIFTY at entry: ${Object.entries(markets).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      for (const a of ['with', 'against', 'other'] as const) console.log(`  ${a.padEnd(8)} ${String(by[a]!.trades).padStart(5)} trades  net ${inr(by[a]!.net).padStart(12)}  ${inr(by[a]!.trades ? by[a]!.net / by[a]!.trades : 0).padStart(8)}/trade`);
      console.log(`  skipping the trades against the NIFTY scenario: ${inr(filtered)} (${trades.length - by.against!.trades} trades) vs ${inr(all)} unfiltered`);
      arms[fill] = [{ name: 'with the scenario', trades: by.with!.trades, net: by.with!.net }, { name: 'against the scenario', trades: by.against!.trades, net: by.against!.net }];
      rows[fill] = { trades: trades.length, net: Math.round(all), markets, by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { trades: v.trades, net: Math.round(v.net) }])), filteredNet: Math.round(filtered) };
    }
    const v = verdict(arms.level, arms.late1m);
    console.log(`  VERDICT (${name}): ${v.settled ? `SETTLED — ${v.answer} is better per trade` : 'not settled'} (${v.why})`);
    report[name] = { ...rows, verdict: v };
  }
  await writeFile(path.join(HISTORY_DIR, 'combine-report.json'), JSON.stringify(report, null, 1));
  console.log('\nreport written to .cache/history/combine-report.json');
}
