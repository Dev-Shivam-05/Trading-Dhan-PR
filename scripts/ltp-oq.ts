/**
 * `npm run ltpoq` — P52: the LTP Calculator's open questions, answered on P51's backtest (`docs/spec/ltp-oq-v1.md`).
 * Every verdict follows the spec's one rule (both fills agree, every arm >= 20 trades, better = ₹ net per trade).
 * Writes `.cache/ltp-oq-report.json`. No Dhan call, and nothing here changes a live or paper setting.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from '../src/server/paths.ts';
import { loadBooks, type BookDay } from './lib/ltp-books.ts';
import { verdict, type Arm, type Verdict } from './lib/ltp-verdict.ts';
import { tradeDay, summarise, DEFAULT_CFG, type Cfg, type Fill, type Trade } from '../src/server/ltp-backtest.ts';

const FILLS: Fill[] = ['touch', 'late1m'];
const books = await loadBooks(console.log);
const report: Record<string, unknown> = { days: books.length, from: books[0]?.date, to: books.at(-1)?.date };
const inr = (x: number) => (x < 0 ? '-' : '') + '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN');

type ArmDef = { name: string; cfg: Cfg; day?: (b: BookDay) => boolean; trade?: (t: Trade) => boolean };
function trades(def: ArmDef, fill: Fill): Trade[] {
  const out: Trade[] = [];
  for (const b of books) if (!def.day || def.day(b)) out.push(...tradeDay(b, def.cfg, fill).trades.filter(t => !def.trade || def.trade(t)));
  return out;
}

function question(id: string, title: string, defs: ArmDef[], extra?: (name: string, ts: Trade[]) => string): Verdict {
  console.log(`\n=== ${id} — ${title}`);
  const arms: Record<Fill, Arm[]> = { touch: [], late1m: [] };
  const rows: Record<string, unknown> = {};
  for (const def of defs) {
    const cells: string[] = [];
    for (const fill of FILLS) {
      const ts = trades(def, fill), s = summarise(ts);
      arms[fill].push({ name: def.name, trades: s.trades, net: s.net });
      cells.push(`${fill} ${String(s.trades).padStart(4)} tr  tgt ${s.targetPct.toFixed(0).padStart(3)}%  net ${inr(s.net).padStart(10)}  ${inr(s.trades ? s.net / s.trades : 0).padStart(7)}/tr`);
      rows[`${def.name} ${fill}`] = { ...s, extra: extra ? extra(def.name, ts) : undefined };
      if (fill === 'touch' && extra) cells.push(extra(def.name, ts));
    }
    console.log(`  ${def.name.padEnd(26)} ${cells.join('  |  ')}`);
  }
  const v = verdict(arms.touch, arms.late1m);
  console.log(`  VERDICT: ${v.settled ? `SETTLED — ${v.answer}` : 'not settled'} (${v.why})`);
  report[id] = { title, arms: rows, verdict: v };
  return v;
}

const P34 = DEFAULT_CFG;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1]! : 0; };

// Q1 / Q1b — OQ-33.
const stopSize = (_: string, ts: Trade[]) => `median stop ${med(ts.map(t => Math.abs(t.entryLevel - t.stop))).toFixed(0)} pts`;
{
  const pool = (lines: string[], fill: Fill) => lines.flatMap(l => trades({ name: l, cfg: { ...P34, lines: l } }, fill));
  console.log(`
=== Q1 — OQ-33 safe vs risky, 920 (each line traded on its own, P34 rules; two lines pooled per arm)`);
  const arms: Record<Fill, Arm[]> = { touch: [], late1m: [] };
  for (const [name, lines] of [['inner (EOR+EOS)', ['EOR', 'EOS']], ['outer (EOR+1, EOS-1)', ['EOR+1', 'EOS-1']]] as const) {
    const cells: string[] = [];
    for (const fill of FILLS) {
      const ts = pool([...lines], fill), s = summarise(ts);
      arms[fill].push({ name, trades: s.trades, net: s.net });
      cells.push(`${fill} ${s.trades} tr, net ${inr(s.net)}, ${inr(s.trades ? s.net / s.trades : 0)}/tr`);
      if (fill === 'touch') cells.push(stopSize(name, ts));
    }
    console.log(`  ${name.padEnd(26)} ${cells.join('  |  ')}`);
  }
  const v = verdict(arms.touch, arms.late1m);
  console.log(`  VERDICT: ${v.settled ? `SETTLED — ${v.answer}` : 'not settled'} (${v.why})`);
  report['Q1'] = { arms, verdict: v };
}
{
  const pool = (lines: string[], fill: Fill) => lines.flatMap(l => trades({ name: l, cfg: { book: 'ai', lines: l, target: 'mech50', stop: 'mech50' } }, fill));
  console.log(`\n=== Q1b — OQ-33 for AI: Moderate vs Risky (each line on its own, 50/50)`);
  const arms: Record<Fill, Arm[]> = { touch: [], late1m: [] };
  for (const [name, lines] of [['Moderate', ['R Moderate', 'S Moderate']], ['Risky', ['R Risky', 'S Risky']]] as const) {
    const cells: string[] = [];
    for (const fill of FILLS) {
      const ts = pool([...lines], fill), s = summarise(ts);
      arms[fill].push({ name, trades: s.trades, net: s.net });
      cells.push(`${fill} ${s.trades} tr, net ${inr(s.net)}, ${inr(s.trades ? s.net / s.trades : 0)}/tr`);
    }
    console.log(`  ${name.padEnd(26)} ${cells.join('  |  ')}`);
  }
  const v = verdict(arms.touch, arms.late1m);
  console.log(`  VERDICT: ${v.settled ? `SETTLED — ${v.answer}` : 'not settled'} (${v.why})`);
  report['Q1b'] = { arms, verdict: v };
}

// Q2 — OQ-9 strike depth.
const capture = (_: string, ts: Trade[]) => {
  const moved = ts.filter(t => Math.abs(t.idxPoints) >= 1);
  return `premium per index point ${moved.length ? (moved.reduce((a, t) => a + t.points / t.idxPoints, 0) / moved.length).toFixed(2) : '—'}`;
};
question('Q2', 'OQ-9 strike depth (920, P34 rules)', [0, 1, 2, 4].map(d => ({ name: `ITM ${d}`, cfg: { ...P34, depth: d } })), capture);

// Q3 — OQ-2 volume vs OI.
question('Q3', 'OQ-2 the level\'s basis (920, P34 rules)', (['both', 'volume', 'oi'] as const).map(b => ({ name: b, cfg: P34, trade: (t: Trade) => t.basis === b })));

// Q4 — V99's stop-size grid.
question('Q4', 'stop size, V99 grid (920, all lines, index points target/stop)', [[10, 10], [20, 20], [30, 20], [30, 30], [50, 30], [50, 50]].map(([tp, sp]) => ({ name: `${tp}/${sp}`, cfg: { ...P34, target: 'mech50', stop: 'mech50', tgtPts: tp, stopPts: sp } as Cfg })));

// Q5 — the gap filter.
question('Q5', 'the gap filter (920, P34 rules; days with gap width <= X)', [150, 200, 250, 300, 400, Infinity].map(x => ({ name: x === Infinity ? 'no filter' : `<= ${x}`, cfg: P34, day: (b: BookDay) => b.gapWidth !== null && b.gapWidth <= x })));

// Q6 — time windows.
question('Q6', 'entry hour, 920 (P34 rules)', ['09', '10', '11'].map(h => ({ name: `${h}h`, cfg: P34, trade: (t: Trade) => t.hm.startsWith(h) })));
question('Q6b', 'entry hour, AI (50/50)', ['09', '10', '11', '12', '13', '14'].map(h => ({ name: `${h}h`, cfg: { book: 'ai', lines: 'all', target: 'mech50', stop: 'mech50' } as Cfg, trade: (t: Trade) => t.hm.startsWith(h) })));

// Q7.
console.log('\n=== Q7 — which indices\n  NOT MEASURABLE: only NIFTY chains are rebuilt (P48 is NIFTY-only by the user\'s decision of 2026-09-25).');
report['Q7'] = { verdict: { settled: false, answer: null, why: 'not measurable: NIFTY only' } };

// Q8 — OQ-15 the 920 target.
question('Q8', 'OQ-15 the 920 target (P34 stop)', [
  { name: 'next divergence (P34)', cfg: P34 },
  { name: 'next line (V48)', cfg: { ...P34, target: 'nextline' } },
  { name: '50 points (V117)', cfg: { ...P34, target: 'mech50' } },
]);

// Q9 — the IV gate.
question('Q9', 'the IV gate (AI, 50/50, all lines)', [
  { name: 'gate off', cfg: { book: 'ai', lines: 'all', target: 'mech50', stop: 'mech50' } },
  { name: 'gate on', cfg: { book: 'ai', lines: 'all', target: 'mech50', stop: 'mech50', ivGate: true } },
]);

// Q10 — OQ-22 the missing-line forecast.
{
  console.log('\n=== Q10 — OQ-22 the missing-line forecast');
  const res: Record<string, { days: number; forecastRight: number; list: string[] }> = {};
  for (const [name, missing, bullish] of [['upper lines missing -> bullish?', ['EOR+1', 'EOR'], true], ['lower lines missing -> bearish?', ['EOS', 'EOS-1'], false]] as const) {
    const r = { days: 0, forecastRight: 0, list: [] as string[] };
    for (const b of books) {
      if (b.R920 === null || !missing.every(n => b.l920[n] === null || (bullish ? b.c[b.hm.indexOf('09:20')]! >= b.l920[n]! : b.c[b.hm.indexOf('09:20')]! <= b.l920[n]!))) continue;
      // A line can also be missing for want of a stop leg: count only what the forecast is about (price past the line)
      // and the no-leg cases separately.
      const a = b.c[b.hm.indexOf('09:21')], z = b.c[b.hm.indexOf('15:29')] ?? b.c.at(-1);
      if (a === undefined || z === undefined) continue;
      r.days++; if (bullish ? z > a : z < a) r.forecastRight++;
      r.list.push(`${b.date} ${(z - a).toFixed(0)}`);
    }
    res[name] = r;
    console.log(`  ${name}: ${r.days} days, forecast right on ${r.forecastRight}${r.days ? ` (${(100 * r.forecastRight / r.days).toFixed(0)}%)` : ''}  ${r.list.slice(0, 8).join(', ')}`);
  }
  const all = Object.values(res);
  const settled = all.every(r => r.days >= 20);
  console.log(`  VERDICT: ${settled ? (all.every(r => r.forecastRight / r.days >= 0.6) ? 'SETTLED — the forecast holds' : 'SETTLED — the forecast does not hold') : `not settled (under 20 days: ${all.map(r => r.days).join(' and ')})`}`);
  report['Q10'] = res;
}

// Q11 — OQ-1: how far out the lines sit, against V09 and V117.
{
  console.log('\n=== Q11 — OQ-1: extension distance and gap width against the corpus\'s published numbers');
  const byYear = new Map<string, { ext: number[]; extPct: number[]; gap: number[] }>();
  for (const b of books) {
    if (b.R920 === null || b.S920 === null) continue;
    const y = b.date.slice(0, 4), lvl = b.c[b.hm.indexOf('09:20')] ?? b.c[0]!;
    const e = byYear.get(y) ?? { ext: [], extPct: [], gap: [] };
    const eor = b.l920['EOR'], eos = b.l920['EOS'];
    if (eor !== null && eor !== undefined) { e.ext.push(eor - b.R920); e.extPct.push(100 * (eor - b.R920) / lvl); }
    if (eos !== null && eos !== undefined) { e.ext.push(b.S920 - eos); e.extPct.push(100 * (b.S920 - eos) / lvl); }
    if (b.gapWidth !== null) e.gap.push(b.gapWidth);
    byYear.set(y, e);
  }
  const rows: Record<string, unknown> = {};
  for (const [y, e] of byYear) {
    const r = { extMedian: med(e.ext), extPctMedian: +med(e.extPct).toFixed(3), gapMedian: med(e.gap), gapLe100: e.gap.filter(g => g <= 100).length, days: e.gap.length };
    rows[y] = r;
    console.log(`  ${y}: extension median ${r.extMedian.toFixed(1)} pts (${r.extPctMedian}% of the index; V09 implies 0.125-0.175%), gap width median ${r.gapMedian.toFixed(0)}, <= 100 on ${r.gapLe100} of ${r.days} days`);
  }
  const allPct = [...byYear.values()].flatMap(e => e.extPct);
  const factor = med(allPct) / 0.15;
  console.log(`  RECORDED (never acted on): the median extension is ${factor.toFixed(1)}x V09's midpoint. P29 row 12 changes only with the user's word.`);
  report['Q11'] = { byYear: rows, factorOverV09: +factor.toFixed(2) };
}

await writeFile(path.join(CACHE_DIR, 'ltp-oq-report.json'), JSON.stringify(report, null, 1));
console.log('\nreport written to .cache/ltp-oq-report.json');
