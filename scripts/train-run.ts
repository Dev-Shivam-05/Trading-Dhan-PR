/**
 * P44: the training run on what `train-data.ts` stored (`docs/spec/train-all-v1.md`, rows 4-17).
 * Imported by `scripts/train.ts`.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HISTORY_DIR } from '../src/server/history.ts';
import { readJson, universe, type Closes, type Series } from '../src/server/train-data.ts';
import { at, ist, type Candle } from '../src/server/backtest.ts';
import {
  BASELINE, TRAIN_GRID, WF_FIRST_TEST, WF_MIN_TRADES, COSTS, tkey, makeStock, sessionsOf, dayPicks, runGrid,
  walkForwardTrain, splitNet, marginals, tradeOne, type StockData, type TTrade, type ComboResult,
} from '../src/server/train.ts';

const inr = (x: number | null | undefined) => (x === null || x === undefined ? '—' : (x < 0 ? '−' : '+') + Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
const toC = (s: Series): Candle[] => s.t.map((t, i) => ({ t, o: s.o[i]!, h: s.h[i]!, l: s.l[i]!, c: s.c[i]! }));

export async function loadStocks(): Promise<{ stocks: StockData[]; missing: string[] }> {
  const stocks: StockData[] = [], missing: string[] = [];
  for (const u of await universe()) {
    const m = await readJson<Series>(`eq1/${u.symbol}.json`);
    const d = await readJson<Closes>(`eqd/${u.symbol}.json`);
    if (!m || !d || !m.t.length) { missing.push(u.symbol); continue; }
    stocks.push(makeStock(u.symbol, u.lot, toC(m), new Map(Object.entries(d.close))));
  }
  return { stocks, missing };
}

/** AC3: the baseline's cash trades replayed on 5-minute bars of the share and of its future. */
async function substitution(stocks: StockData[], trades: TTrade[]) {
  const contracts = (await readJson<Record<string, { futureId: number }[]>>('contracts.json')) ?? {};
  const cut = (c: Candle[]) => c.filter(b => { const m = ist(b.t).minutes; return m >= 9 * 60 + 15 && m <= 15 * 60 + 10; });
  const bySym = new Map(stocks.map(s => [s.symbol, s]));
  let n = 0, sameExitBar = 0, sameReason = 0, noFut = 0, diffSum = 0, absDiffSum = 0;
  const rows: { date: string; symbol: string; cashRet: number; futRet: number; cashExit: string; futExit: string }[] = [];
  const futCache = new Map<string, StockData | null>();
  for (const t of trades) {
    const cs = bySym.get(t.symbol)!;
    const fid = contracts[t.symbol]?.[0]?.futureId;
    let fs = futCache.get(t.symbol);
    if (fs === undefined) {
      const f = fid ? await readJson<Series & { oi?: number[] }>(`fut5/${fid}.json`) : null;
      fs = f ? makeStock(t.symbol, cs.lot, cut(toC(f)), cs.close, cut(toC(f))) : null;
      futCache.set(t.symbol, fs);
    }
    if (!fs || !fs.m1Day.has(t.date)) { noFut++; continue; }
    // Both sides on 5-minute resolution, so only the price series differs.
    const c5: Candle[] = Array.from(cs.b5.t, (tt, i) => ({ t: tt, o: cs.b5.o[i]!, h: cs.b5.h[i]!, l: cs.b5.l[i]!, c: cs.b5.c[i]! })).filter(b => ist(b.t).minutes <= 15 * 60 + 10);
    const cash5 = makeStock(t.symbol, cs.lot, c5, cs.close, c5);
    const pick = { symbol: t.symbol, chg: t.chg };
    const a = tradeOne(cash5, t.date, pick, BASELINE, new Map());
    const b = tradeOne(fs, t.date, pick, BASELINE, new Map());
    if ('skip' in a || 'skip' in b) { noFut++; continue; }
    n++;
    if (a.exitT === b.exitT) sameExitBar++;
    if (a.reason === b.reason) sameReason++;
    const ra = (a.exitPx - a.entryPx) / a.entryPx * 100 * (a.side === 'BUY' ? 1 : -1);
    const rb = (b.exitPx - b.entryPx) / b.entryPx * 100 * (b.side === 'BUY' ? 1 : -1);
    diffSum += rb - ra; absDiffSum += Math.abs(rb - ra);
    rows.push({ date: t.date, symbol: t.symbol, cashRet: Math.round(ra * 1000) / 1000, futRet: Math.round(rb * 1000) / 1000, cashExit: ist(a.exitT).hm, futExit: ist(b.exitT).hm });
  }
  return { compared: n, notComparable: noFut, sameExitBar, sameReason, meanDiffPct: n ? Math.round(diffSum / n * 1000) / 1000 : null, meanAbsDiffPct: n ? Math.round(absDiffSum / n * 1000) / 1000 : null, rows };
}

export async function runTraining() {
  const t0 = Date.now();
  const { stocks, missing } = await loadStocks();
  const sessions = sessionsOf(stocks);
  const picks = dayPicks(stocks, sessions);
  console.log(`\nP44 training · ${stocks.length} stocks (${missing.length} without data${missing.length ? ': ' + missing.join(' ') : ''}) · ${sessions.length} sessions ${sessions[0]} → ${sessions.at(-1)} · ${TRAIN_GRID.length} settings`);

  const baseKey = tkey(BASELINE);
  const first = runGrid(stocks, sessions, picks, TRAIN_GRID, new Set([baseKey]));
  const results = first.results;
  const wf = walkForwardTrain(sessions, results, baseKey);
  const eligible = results.filter(r => r.trades >= WF_MIN_TRADES).sort((a, b) => b.net - a.net);
  const best = eligible[0]!;
  const base = results.find(r => r.key === baseKey)!;
  // The setting the walk-forward chose most often, and the last one it chose.
  const mostChosen = Object.entries(wf.chosenCounts).sort((a, b) => b[1] - a[1])[0]![0];
  const lastChosen = wf.steps.at(-1)?.chosen ?? baseKey;
  const detail = runGrid(stocks, sessions, picks, TRAIN_GRID.filter(p => [best.key, mostChosen, lastChosen].includes(tkey(p))), new Set([best.key, mostChosen, lastChosen]));
  const trades = new Map<string, TTrade[]>([[baseKey, first.kept.get(baseKey)!], ...detail.kept]);
  const byKey = new Map(results.map(r => [r.key, r]));

  const describe = (r: ComboResult) => ({
    key: r.key, trades: r.trades, wins: r.wins, winPct: r.trades ? Math.round(r.wins / r.trades * 1000) / 10 : null,
    gross: r.gross, cost: r.cost, net: r.net, netPerTrade: r.trades ? Math.round(r.net / r.trades) : null,
    ...splitNet(r, sessions), skips: r.skips,
  });
  const sub = await substitution(stocks, trades.get(baseKey)!);

  // Row 17: recommend only on held-out evidence, and only a setting positive in both halves.
  const rec = byKey.get(lastChosen)!;
  const recSplit = splitNet(rec, sessions);
  const recommend = wf.heldOut > wf.baseline && recSplit.firstHalf > 0 && recSplit.secondHalf > 0;

  const report = {
    ranAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000),
    stocks: stocks.length, missing, sessions, costs: COSTS,
    walkForward: { firstTest: sessions[WF_FIRST_TEST] ?? null, minTrades: WF_MIN_TRADES, ...wf },
    baseline: describe(base), bestInSample: describe(best), mostChosen: describe(byKey.get(mostChosen)!), lastChosen: describe(rec),
    top20: eligible.slice(0, 20).map(r => ({ key: r.key, trades: r.trades, winPct: Math.round(r.wins / r.trades * 1000) / 10, net: r.net, gross: r.gross, ...(({ firstHalf, secondHalf }) => ({ firstHalf, secondHalf }))(splitNet(r, sessions)) })),
    bottom5: eligible.slice(-5).map(r => ({ key: r.key, trades: r.trades, net: r.net })),
    positiveSettings: eligible.filter(r => r.net > 0).length, eligibleSettings: eligible.length,
    marginals: marginals(results),
    substitution: sub,
    recommendation: recommend
      ? { key: rec.key, why: `walk-forward held-out ${wf.heldOut} beats the baseline's ${wf.baseline} on the same ${wf.steps.length} sessions, and ${rec.key} is positive in both halves (${recSplit.firstHalf} / ${recSplit.secondHalf})` }
      : { key: null, why: `no setting qualifies: held-out ${wf.heldOut} vs baseline ${wf.baseline}; last choice ${rec.key} halves ${recSplit.firstHalf} / ${recSplit.secondHalf}` },
    trades: Object.fromEntries(trades),
  };
  await writeFile(path.join(HISTORY_DIR, 'train-report.json'), JSON.stringify(report));

  // ---- print
  const line = (name: string, d: ReturnType<typeof describe>) =>
    console.log(`  ${name.padEnd(12)} ${d.key}\n  ${''.padEnd(12)} ${d.trades} trades · win ${d.winPct}% · gross ${inr(d.gross)} · costs ${inr(-d.cost)} · NET ${inr(d.net)} · per trade ${inr(d.netPerTrade)} · halves ${inr(d.firstHalf)} / ${inr(d.secondHalf)} · worst day ${d.worstDay.date} ${inr(d.worstDay.net)} · max drop ${inr(-d.maxDrawdown)} · green days ${d.positiveDays}/${sessions.length}`);
  console.log('\n— settings —');
  line('baseline', report.baseline);
  line('best (bias)', report.bestInSample);
  line('most chosen', report.mostChosen);
  line('last chosen', report.lastChosen);
  console.log(`\n— walk-forward (row 13): ${wf.steps.length} held-out sessions from ${report.walkForward.firstTest}, ${wf.switches} switches —`);
  console.log(`  held-out NET ${inr(wf.heldOut)}   vs baseline on the same days ${inr(wf.baseline)}`);
  for (const s of wf.steps) console.log(`  ${s.testDate}  chose ${s.chosen.padEnd(44)} ${inr(s.chosenNet).padStart(10)}   baseline ${inr(s.baselineNet).padStart(10)}`);
  console.log(`\n— ${report.positiveSettings} of ${report.eligibleSettings} settings with ≥ ${WF_MIN_TRADES} trades are net positive over the whole window (in-sample) —`);
  for (const r of report.top20.slice(0, 10)) console.log(`  ${r.key.padEnd(44)} ${String(r.trades).padStart(4)} trades  win ${r.winPct}%  NET ${inr(r.net).padStart(10)}  halves ${inr(r.firstHalf)} / ${inr(r.secondHalf)}`);
  console.log('\n— what each knob is worth (row 15; net per trade, averaged over everything else) —');
  for (const [d, vals] of Object.entries(report.marginals)) console.log(`  ${d.padEnd(9)} ${vals.map(v => `${v.value}: ${inr(v.netPerTrade)}`).join('   ')}`);
  console.log(`\n— AC3 substitution (baseline trades, share vs future, 5-minute bars): ${sub.compared} compared, ${sub.notComparable} without a future series —`);
  console.log(`  same exit bar ${sub.sameExitBar}/${sub.compared} · same exit reason ${sub.sameReason}/${sub.compared} · mean (future − share) return ${sub.meanDiffPct} pp · mean |diff| ${sub.meanAbsDiffPct} pp`);
  console.log(`\n— recommendation (row 17) —\n  ${report.recommendation.key ?? 'NONE'}: ${report.recommendation.why}`);
  console.log(`\nwritten .cache/history/train-report.json · ${report.seconds} s`);
  return report;
}
