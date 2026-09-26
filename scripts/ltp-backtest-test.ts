/**
 * `npm run ltpbt:test` — P51's index option backtest (`docs/spec/ltp-backtest-v1.md`).
 *
 * AC1-AC3 run on hand-built days. AC4-AC6 and AC8's determinism run on every prepared NIFTY day
 * (`scripts/lib/ltp-books.ts`); without the stored chains and index history they print UNMEASURED and fail.
 *
 * AC6's second implementation walks the CLOCK (minute by minute: exits first, then entries) where the engine walks
 * the SIGNALS (each one priced forward to its exit).
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as B from '../src/server/ltp-backtest.ts';
import type { DayBook, Cfg, Fill, Trade } from '../src/server/ltp-backtest.ts';
import type { Signal, Veto } from '../src/server/ltp-lines.ts';
import { loadBooks } from './lib/ltp-books.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const r2 = (x: number) => Math.round(x * 100) / 100;

/* ------------------------------------------------------------------ a hand-built day */

const HMS = Array.from({ length: 316 }, (_, i) => { const m = 9 * 60 + 15 + i; return `${String(m / 60 | 0).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }); // 09:15 .. 14:30
const at = (hm: string) => HMS.indexOf(hm);
function day(opts: { bars?: Record<string, { h?: number; l?: number; c?: number }>; signals: Partial<Signal>[]; permit?: (hm: string) => { CE: boolean; PE: boolean }; px?: (hm: string) => number | null }): DayBook {
  const bars = opts.bars ?? {};
  const px = opts.px ?? ((hm: string) => 100 + at(hm) * 0.1);
  const col = HMS.map(hm => { const v = px(hm); return v === null ? null : r2(v); });
  return {
    date: '2026-09-24', hm: HMS,
    h: HMS.map(hm => bars[hm]?.h ?? 23200), l: HMS.map(hm => bars[hm]?.l ?? 23200), c: HMS.map(hm => bars[hm]?.c ?? 23200),
    permit: HMS.map(hm => opts.permit?.(hm) ?? { CE: true, PE: true }),
    signals: opts.signals.map(s => ({ kind: '920', line: 'EOS', i: at(s.hm!), t: 0, hm: s.hm!, buy: 'CE', entry: 23150, stop: 23100, target: 23250, scenario: 7, verdict: 'bull run', veto: null, ...s } as Signal)),
    step: 50, gapWidth: 120,
    legs: { '23150CE': col, '23200CE': col, '23150PE': col, '23100PE': col, '23250PE': col },
  };
}
const DEF: Cfg = B.DEFAULT_CFG;
const one = (b: DayBook, cfg: Cfg = DEF, fill: Fill = 'touch') => B.tradeDay(b, cfg, fill);

/* ------------------------------------------------------------------ AC1: every exit */

{
  const t = one(day({ signals: [{ hm: '10:00' }], bars: { '10:30': { h: 23260 } } })).trades[0]!;
  ok('AC1 target: the index high reaches it -> exit at that minute\'s option close', t.reason === 'target' && t.exitHm === '10:30' && t.exitPx === r2(100 + at('10:30') * 0.1) && t.entryPx === r2(100 + at('10:00') * 0.1), `${t.reason} ${t.exitHm} ${t.exitPx}`);
  ok('AC1 target: index points = target - entry', t.idxPoints === 100);
  const s = one(day({ signals: [{ hm: '10:00' }], bars: { '10:20': { l: 23090 } } })).trades[0]!;
  ok('AC1 stop: the index low reaches it', s.reason === 'stop' && s.exitHm === '10:20' && s.idxPoints === -50);
  const both = one(day({ signals: [{ hm: '10:00' }], bars: { '10:20': { l: 23090, h: 23300 } } })).trades[0]!;
  ok('AC1 stop and target in one minute -> stop', both.reason === 'stop');
  const tm = one(day({ signals: [{ hm: '10:00' }] })).trades[0]!;
  ok('AC1 nothing reached -> time exit at the close of 14:29', tm.reason === 'time' && tm.exitHm === '14:29' && tm.exitPx === r2(100 + at('14:29') * 0.1));
  const sameMin = one(day({ signals: [{ hm: '10:00' }], bars: { '10:00': { l: 23000 } } })).trades[0]!;
  ok('AC1 the touch minute itself is not an exit minute (exits start the minute after the fill)', sameMin.reason === 'time');
  const ai = one(day({ signals: [{ hm: '10:00', kind: 'ai', line: 'S Moderate' }], permit: hm => ({ CE: hm < '11:00', PE: true }) }), { ...DEF, book: 'ai' }).trades[0]!;
  ok('AC1 AI state change: the first minute that no longer permits CE ends the trade', ai.reason === 'state' && ai.exitHm === '11:00');
  const ai920 = one(day({ signals: [{ hm: '10:00' }], permit: hm => ({ CE: hm < '11:00', PE: true }) })).trades[0]!;
  ok('AC1 the 920 book ignores the scenario (V117: standalone)', ai920.reason === 'time');
  const late = one(day({ signals: [{ hm: '10:00' }], bars: { '10:30': { h: 23260 } } }), DEF, 'late1m').trades[0]!;
  ok('AC1 late1m: entry at the next minute\'s close, exit one minute after the exit minute', late.entryPx === r2(100 + at('10:01') * 0.1) && late.exitPx === r2(100 + at('10:31') * 0.1) && late.exitHm === '10:30');
  const m50 = one(day({ signals: [{ hm: '10:00', entry: 23160, stop: 23000, target: 23400 }], bars: { '10:40': { h: 23210.5 } } }), { ...DEF, target: 'mech50', stop: 'mech50' }).trades[0]!;
  ok('AC1 mech50: target entry+50 and stop entry-50 replace the structure', m50.target === 23210 && m50.stop === 23110 && m50.reason === 'target' && m50.exitHm === '10:40', `${m50.target} ${m50.stop} ${m50.reason} ${m50.exitHm}`);
  const gap = one(day({ signals: [{ hm: '10:00' }], px: hm => (hm === '10:00' ? null : 100) }));
  ok('AC1 no close at the fill minute on either strike -> no-price, no trade', gap.noPrice === 1 && gap.trades.length === 0);
  const strike = one(day({ signals: [{ hm: '10:00', entry: 23175 }] })).trades[0]!;
  ok('AC1 row 3: an exact half-step goes to the lower strike', strike.strike === 23150);
}

/* ------------------------------------------------------------------ AC2: costs and size */

{
  // Worked by hand: entry 100, exit 120, 130 units. buy 13,000, sell 15,600, turnover 28,600.
  const brokerage = 40, stt = 15.6, exch = 28600 * 0.0003503, sebi = 28600 * 0.000001, stamp = 13000 * 0.00003;
  const want = r2(brokerage + stt + exch + sebi + stamp + 0.18 * (brokerage + exch + sebi));
  ok('AC2 costs to the paisa (entry 100, exit 120, 130 units)', B.costOf(100, 120, 130) === want && want === 75.05, `${B.costOf(100, 120, 130)} vs ${want}`);
  ok('AC2 lots at the boundary: 20,000 / (153.85 x 65) = 2.0000 -> 2', B.lotsFor(20000 / 130).lots === 2);
  ok('AC2 lots just past it: premium 154 -> 1', B.lotsFor(154).lots === 1 && !B.lotsFor(154).overBudget);
  ok('AC2 one lot over budget: premium 308 -> 1 lot, overBudget', B.lotsFor(308).lots === 1 && B.lotsFor(308).overBudget);
  ok('AC2 exactly on budget is not over it: 20,000 / 65', !B.lotsFor(20000 / 65).overBudget && B.lotsFor(20000 / 65).lots === 1);
}

/* ------------------------------------------------------------------ AC3: busy */

{
  const r = one(day({ signals: [{ hm: '10:00' }, { hm: '10:05', line: 'EOS-1' }, { hm: '10:40', line: 'EOR', buy: 'PE', entry: 23250, stop: 23300, target: 23150 }], bars: { '10:30': { h: 23260 } } }));
  ok('AC3 a second signal while the book is open is busy', r.busy === 1 && r.trades[0]!.line === 'EOS');
  ok('AC3 a signal after the exit trades', r.trades.length === 2 && r.trades[1]!.line === 'EOR' && r.trades[1]!.buy === 'PE');
  const onExit = one(day({ signals: [{ hm: '10:00' }, { hm: '10:30', line: 'EOS-1' }], bars: { '10:30': { h: 23260 } } }));
  ok('AC3 a signal in the exit minute itself is still busy', onExit.busy === 1 && onExit.trades.length === 1);
}

/* ------------------------------------------------------------------ real data */

let books: Awaited<ReturnType<typeof loadBooks>> = [];
try { books = await loadBooks(console.log); } catch (e) { console.log(String(e)); }
if (!books.length) ok('AC4-AC6 UNMEASURED: no prepared days (npm run chainhist, npm run idxhist)', false);
else {
  const PRICE: Veto[] = ['no-stop', 'stop-on-entry', 'target', 'ratio'];
  const LINES: Record<string, string[]> = { '920': ['EOR+1', 'EOR', 'EOS', 'EOS-1'], ai: ['R Risky', 'R Moderate', 'S Risky', 'S Moderate'] };

  // AC4: accounting, over every configuration and both fills.
  let bad = 0, total = 0, eligibleAll = 0;
  for (const cfg of B.CONFIGS) for (const fill of ['touch', 'late1m'] as Fill[]) {
    let t = 0, busy = 0, np = 0, pv = 0, indep = 0;
    for (const b of books) {
      const r = B.tradeDay(b, cfg, fill);
      t += r.trades.length; busy += r.busy; np += r.noPrice; pv += r.priceVetoed;
      const sub = cfg.lines === 'all' ? LINES[cfg.book]! : cfg.lines === 'ext' ? LINES[cfg.book]!.filter(x => /^(EOR|EOS)$|Moderate/.test(x)) : LINES[cfg.book]!.filter(x => /[+-]1|Risky/.test(x));
      for (const s of b.signals) if (s.kind === cfg.book && sub.includes(s.line) && (s.veto === null || PRICE.includes(s.veto))) indep++;
    }
    total++; eligibleAll += indep;
    if (t + busy + np + pv !== indep) { bad++; console.log(`      ${B.cfgKey(cfg)} ${fill}: ${t}+${busy}+${np}+${pv} vs ${indep}`); }
  }
  ok('AC4 trades + busy + no-price + price-vetoed = eligible (counted independently) in all 48 runs', bad === 0, `${total - bad}/${total} runs, ${eligibleAll} eligible signals in all`);

  // AC5: no look-ahead past the exit.
  let checked = 0, moved = 0;
  for (const b of books) for (const fill of ['touch', 'late1m'] as Fill[]) {
    for (const t of B.tradeDay(b, B.DEFAULT_CFG, fill).trades) {
      const legs = Object.fromEntries(Object.entries(b.legs).map(([k, col]) => [k, col.map((v, j) => (v !== null && j > t.exitI + 1 ? v * 2 : v))]));
      const again = B.tradeDay({ ...b, legs }, B.DEFAULT_CFG, fill).trades.find(x => x.i === t.i && x.line === t.line);
      checked++;
      if (JSON.stringify(again) !== JSON.stringify(t)) moved++;
    }
  }
  ok('AC5 every option close after a trade\'s exit (and its late1m fill) x2 leaves the trade identical', checked > 0 && moved === 0, `${checked} trades checked, ${moved} moved`);

  // AC6: a clock-driven second implementation of the 920 book (touch fill, structure).
  function second(b: DayBook, swap = false): string[] {
    const out: string[] = [];
    const sigs = b.signals.filter(s => s.kind === '920' && (s.veto === null || PRICE.includes(s.veto)));
    type Open = { s: Signal; strike: number; px: number; fi: number };
    let open: Open | null = null;
    // The swapped rule the comparison must catch: no 14:29 time exit (the trade runs to the last minute).
    const last = b.hm.length - 1, end = swap || b.hm.indexOf('14:29') < 0 ? last : b.hm.indexOf('14:29');
    const closeAt = (col: (number | null)[], j: number) => { for (let k = j; k < col.length; k++) if (col[k] !== null) return col[k]!; return null; };
    const finish = (o: Open, j: number, why: string) => {
      const col = b.legs[`${o.strike}${o.s.buy}`]!;
      const ex = closeAt(col, j) ?? o.px;
      out.push(`${o.s.hm} ${o.s.line} ${o.strike} ${o.px} -> ${b.hm[j]} ${why} ${ex}`);
    };
    for (let j = 0; j <= end; j++) {
      if (open && j > open.fi) {
        const ce = open.s.buy === 'CE', st = open.s.stop!, tg = open.s.target!;
        const hs = ce ? b.l[j]! <= st : b.h[j]! >= st, ht = ce ? b.h[j]! >= tg : b.l[j]! <= tg;
        const first = hs ? 'stop' : ht ? 'target' : null;
        if (first) { finish(open, j, first); open = null; continue; }
      }
      if (open && j === end) { finish(open, j, 'time'); open = null; continue; }
      if (open) continue;
      for (const s of sigs.filter(x => x.i === j)) {
        if (open) break;
        const ce = s.buy === 'CE';
        if (s.stop === null || s.target === null) continue;
        const sd = ce ? s.entry - s.stop : s.stop - s.entry, td = ce ? s.target - s.entry : s.entry - s.target;
        if (sd < 0.05 - 1e-9 || td < 0.05 - 1e-9 || sd > td + 1e-9) continue;
        const k0 = Math.floor(s.entry / b.step) * b.step + (s.entry - Math.floor(s.entry / b.step) * b.step > b.step / 2 ? b.step : 0);
        let k = k0, px = b.legs[`${k}${s.buy}`]?.[j] ?? null;
        if (px === null) { k = k0 + (ce ? b.step : -b.step); px = b.legs[`${k}${s.buy}`]?.[j] ?? null; }
        if (px === null || px <= 0) continue;
        open = { s, strike: k, px, fi: j };
        if (j === end) { finish(open, j, 'time'); open = null; }
      }
    }
    return out;
  }
  const eng = (b: DayBook) => B.tradeDay(b, B.DEFAULT_CFG, 'touch').trades.map(t => `${t.hm} ${t.line} ${t.strike} ${t.entryPx} -> ${t.exitHm} ${t.reason} ${t.exitPx}`);
  let mism = 0, swapDiff = 0, n = 0; const ex: string[] = [];
  for (const b of books) {
    const a = eng(b), c = second(b);
    n += a.length;
    if (JSON.stringify(a) !== JSON.stringify(c)) { mism++; if (ex.length < 3) ex.push(`${b.date}: ${a.join(' | ')} vs ${c.join(' | ')}`); }
    if (JSON.stringify(second(b, true)) !== JSON.stringify(c)) swapDiff++;
  }
  ok('AC6 a clock-driven second implementation agrees on every 920 trade', mism === 0, `${n} trades, ${mism} mismatching days${ex.length ? ': ' + ex.join(' ;; ') : ''}`);
  ok('AC6 the comparison catches a changed rule (no 14:29 time exit)', swapDiff > 0, `${swapDiff} days differ`);

  // AC8: determinism.
  const h = () => { const x = createHash('sha256'); for (const b of books) for (const c of B.CONFIGS) x.update(JSON.stringify(B.tradeDay(b, c, 'touch'))); return x.digest('hex'); };
  ok('AC8 two runs over all days and all 24 configurations are byte-identical', h() === h());
}

const src = readFileSync(new URL('../src/server/ltp-backtest.ts', import.meta.url), 'utf8');
ok('AC8 ltp-backtest.ts imports nothing from dhan.ts', !/from '\.\/dhan\.ts'/.test(src));
ok('AC8 ltp-backtest.ts never calls Date.now()', !/Date\.now\(\)/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
