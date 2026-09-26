/**
 * `npm run ltpbt [-- <YYYY-MM-DD>]` — P51's index option backtest (`docs/spec/ltp-backtest-v1.md`).
 * With a date: that day's trades under the default configuration for both books and both fill models.
 * Without: the full report — both books, both fills, V117's shape scored claim by claim, and the walk-forward.
 * The report is also written to `.cache/ltp-backtest-report.json`. No Dhan call.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from '../src/server/paths.ts';
import { loadBooks, type BookDay } from './lib/ltp-books.ts';
import {
  tradeDay, summarise, walkForward, CONFIGS, DEFAULT_CFG, cfgKey,
  type Cfg, type Fill, type Trade, type Summary,
} from '../src/server/ltp-backtest.ts';

const FILLS: Fill[] = ['touch', 'late1m'];
const date = process.argv[2];
const books = await loadBooks(console.log);
const f2 = (x: number) => x.toFixed(2);
const inr = (x: number) => (x < 0 ? '-' : '') + '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN');
const line = (name: string, s: Summary) =>
  `${name.padEnd(34)} ${String(s.trades).padStart(4)} trades  target ${f2(s.targetPct).padStart(6)}%  +ve ${f2(s.positivePct).padStart(6)}%  ` +
  `prem ${f2(s.points).padStart(9)}  idx ${f2(s.idxPoints).padStart(9)}  gross ${inr(s.gross).padStart(11)}  costs ${inr(s.cost).padStart(9)}  net ${inr(s.net).padStart(11)}  maxDD ${inr(s.maxDrawdown).padStart(10)}  ${s.medianMinutes} min`;
const AI_DEFAULT: Cfg = { ...DEFAULT_CFG, book: 'ai' };

function run(bs: BookDay[], cfg: Cfg, fill: Fill) {
  const trades: Trade[] = [];
  let eligible = 0, busy = 0, noPrice = 0, priceVetoed = 0;
  for (const b of bs) {
    const r = tradeDay(b, cfg, fill);
    trades.push(...r.trades); eligible += r.eligible; busy += r.busy; noPrice += r.noPrice; priceVetoed += r.priceVetoed;
  }
  return { trades, eligible, busy, noPrice, priceVetoed };
}

if (date) {
  const b = books.find(x => x.date === date);
  if (!b) { console.log(`no prepared day ${date}`); process.exitCode = 1; }
  else for (const cfg of [DEFAULT_CFG, AI_DEFAULT]) for (const fill of FILLS) {
    const r = tradeDay(b, cfg, fill);
    console.log(`${cfgKey(cfg)} ${fill}: ${r.eligible} eligible, ${r.busy} busy, ${r.noPrice} no-price, ${r.priceVetoed} price-vetoed`);
    for (const t of r.trades) console.log(`  ${t.hm} ${t.line.padEnd(10)} buy ${t.strike}${t.buy} @ ${f2(t.entryPx)} (index ${f2(t.entryLevel)}, stop ${f2(t.stop)}, target ${f2(t.target)}) -> ${t.exitHm} ${t.reason} @ ${f2(t.exitPx)}  ${t.lots} lot(s)${t.overBudget ? ' OVER BUDGET' : ''}  net ${inr(t.net)}`);
  }
} else {
  const report: Record<string, unknown> = { generated: new Date().toISOString(), days: books.length, from: books[0]?.date, to: books.at(-1)?.date };
  console.log(`\n${books.length} days, ${books[0]?.date} .. ${books.at(-1)?.date}.  prem = option premium points per unit; idx = index points.\n`);

  // Row 9: both books, both fills, the default configuration.
  const main: Record<string, Summary & { eligible: number; busy: number; noPrice: number; priceVetoed: number }> = {};
  for (const cfg of [DEFAULT_CFG, AI_DEFAULT]) for (const fill of FILLS) {
    const r = run(books, cfg, fill), s = summarise(r.trades);
    main[`${cfgKey(cfg)} ${fill}`] = { ...s, eligible: r.eligible, busy: r.busy, noPrice: r.noPrice, priceVetoed: r.priceVetoed };
    console.log(line(`${cfgKey(cfg)} ${fill}`, s) + `   (eligible ${r.eligible}, busy ${r.busy}, no-price ${r.noPrice}, price-vetoed ${r.priceVetoed})`);
  }
  report.main = main;

  // Row 10: V117's shape. 920, mech50 both ways, touch fill, over V117's window and over all history.
  const V117: Cfg = { book: '920', lines: 'all', target: 'mech50', stop: 'mech50' };
  const wd = (d: string) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${d}T00:00:00Z`).getUTCDay()]!;
  const expiryPlace = new Map<string, string>();
  books.forEach((b, i) => expiryPlace.set(b.date, b.expiry === b.date ? 'expiry day' : i > 0 && books[i - 1]!.expiry === books[i - 1]!.date ? 'day after expiry' : 'other'));
  const shape: Record<string, unknown> = {};
  for (const [label, bs] of [['V117 window 2024-01-01..2024-04-07', books.filter(b => b.date <= '2024-04-07')], ['all history', books]] as const) {
    for (const fill of FILLS) {
      const ts = run(bs, V117, fill).trades;
      const by = (key: (t: Trade) => string) => {
        const m = new Map<string, Trade[]>();
        for (const t of ts) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
        return new Map([...m].sort().map(([k, v]) => [k, summarise(v)]));
      };
      const lines = by(t => t.line), gaps = by(t => (t.gapWidth === null ? 'n/a' : t.gapWidth <= 50 ? '<=50' : t.gapWidth <= 100 ? '51-100' : '>100'));
      const hours = by(t => t.hm.slice(0, 2)), days = by(t => wd(t.date)), place = by(t => expiryPlace.get(t.date)!);
      console.log(`\n--- V117 shape, ${label}, ${fill} fill (920, 50-point target and stop) ---`);
      console.log(line('all', summarise(ts)));
      for (const [name, m] of [['line', lines], ['gap width', gaps], ['entry hour', hours], ['weekday', days], ['expiry week', place]] as const)
        for (const [k, s] of m) console.log(line(`${name} ${k}`, s));
      // Each claim, scored. A bucket under 5 trades cannot carry a claim: not measurable.
      const hit = (k: string) => lines.get(k)?.targetPct ?? NaN, n = (m: Map<string, Summary>, k: string) => m.get(k)?.trades ?? 0;
      const score = (measurable: boolean, holds: boolean) => (!measurable ? 'not measurable' : holds ? 'REPRODUCED' : 'not reproduced');
      const claims: [string, string][] = [
        ['C1 the extension lines (EOR, EOS) hit more often than the +1/-1 lines',
          score(['EOR', 'EOS', 'EOR+1', 'EOS-1'].every(k => n(lines, k) >= 5), Math.min(hit('EOR'), hit('EOS')) > Math.max(hit('EOR+1'), hit('EOS-1')))],
        ['C2 gaps above 100 points lose (index points < 0) and do worse than gaps <= 100',
          score(n(gaps, '>100') >= 5 && n(gaps, '<=50') + n(gaps, '51-100') >= 5, (gaps.get('>100')?.idxPoints ?? 0) < 0
            && ((gaps.get('>100')?.idxPoints ?? 0) / n(gaps, '>100')) < (((gaps.get('<=50')?.idxPoints ?? 0) + (gaps.get('51-100')?.idxPoints ?? 0)) / (n(gaps, '<=50') + n(gaps, '51-100'))))],
        ['C3 NIFTY loses at 9 and at 12, earns 10-11', score(n(hours, '09') >= 5 && n(hours, '10') >= 5 && n(hours, '12') >= 5,
          (hours.get('09')?.idxPoints ?? 0) < 0 && (hours.get('10')?.idxPoints ?? 0) > 0 && (hours.get('12')?.idxPoints ?? 0) < 0)],
        ['C4 Thursday is the worst weekday', score([...days.values()].every(s => s.trades >= 5) && days.size >= 5,
          [...days].sort((a, b) => a[1].idxPoints - b[1].idxPoints)[0]?.[0] === 'Thu')],
        ['C5 the day after expiry is the strongest (index points per trade)', score([...place.values()].every(s => s.trades >= 5),
          [...place].sort((a, b) => b[1].idxPoints / b[1].trades - a[1].idxPoints / a[1].trades)[0]?.[0] === 'day after expiry')],
        ['C6 the 920 strategy is net positive on NIFTY (V117: +127 index points)', score(ts.length >= 5, summarise(ts).idxPoints > 0)],
      ];
      for (const [c, v] of claims) console.log(`  ${v.padEnd(15)} ${c}`);
      shape[`${label} ${fill}`] = { all: summarise(ts), claims: Object.fromEntries(claims), lines: Object.fromEntries(lines), gaps: Object.fromEntries(gaps), hours: Object.fromEntries(hours), weekdays: Object.fromEntries(days), expiryWeek: Object.fromEntries(place) };
    }
  }
  report.v117 = shape;

  // Row 11: the walk-forward, per fill model.
  const wf: Record<string, unknown> = {};
  for (const fill of FILLS) {
    const byMonth = new Map<string, Map<string, Trade[]>>();
    const insample: [string, Summary][] = [];
    for (const cfg of CONFIGS) {
      const ts = run(books, cfg, fill).trades;
      insample.push([cfgKey(cfg), summarise(ts)]);
      for (const t of ts) {
        const m = t.date.slice(0, 7);
        if (!byMonth.has(m)) byMonth.set(m, new Map());
        const mm = byMonth.get(m)!;
        if (!mm.has(cfgKey(cfg))) mm.set(cfgKey(cfg), []);
        mm.get(cfgKey(cfg))!.push(t);
      }
    }
    for (const b of books) if (!byMonth.has(b.date.slice(0, 7))) byMonth.set(b.date.slice(0, 7), new Map());
    const w = walkForward(byMonth);
    insample.sort((a, b) => b[1].net - a[1].net);
    console.log(`\n--- walk-forward, ${fill} fill: train 6 months, trade the next; ${w.months.length} test months ---`);
    console.log(`  out-of-sample: ${w.oosTrades} trades, net ${inr(w.oos)}.  In-sample best over all history: ${insample[0]![0]} net ${inr(insample[0]![1].net)} (${insample[0]![1].trades} trades)`);
    const picks = new Map<string, number>();
    for (const m of w.months) picks.set(m.chosen, (picks.get(m.chosen) ?? 0) + 1);
    console.log(`  chosen: ${[...picks].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(', ')}`);
    console.log('  all 24 configurations, in-sample:');
    for (const [k, s] of insample) console.log('   ' + line(k, s));
    wf[fill] = { ...w, insample: Object.fromEntries(insample) };
  }
  report.walkForward = wf;
  await writeFile(path.join(CACHE_DIR, 'ltp-backtest-report.json'), JSON.stringify(report, null, 1));
  console.log(`\nreport written to .cache/ltp-backtest-report.json`);
}
