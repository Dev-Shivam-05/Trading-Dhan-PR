/**
 * `npm run ltpoq:test` — P52 (`docs/spec/ltp-oq-v1.md`): the verdict rule (AC2) and that the engine additions are
 * neutral when unused (AC3). AC1 is `npm run ltpoq` printing a verdict for every question; AC4-AC5 are the other suites.
 */

import { verdict, MIN_TRADES } from './lib/ltp-verdict.ts';
import { loadBooks } from './lib/ltp-books.ts';
import { tradeDay, summarise, DEFAULT_CFG, type Fill } from '../src/server/ltp-backtest.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/* AC2 */
{
  const A = (name: string, trades: number, net: number) => ({ name, trades, net });
  const s = verdict([A('x', 20, 2000), A('y', 30, 1500)], [A('x', 20, 1000), A('y', 30, 600)]);
  ok('AC2 fills agree, both arms >= 20 -> settled on the higher net PER TRADE (x: 100/tr beats y: 50/tr)', s.settled && s.answer === 'x', s.why);
  const d = verdict([A('x', 20, 2000), A('y', 30, 1500)], [A('x', 20, 100), A('y', 30, 1500)]);
  ok('AC2 fills disagree -> not settled', !d.settled && /disagree/.test(d.why), d.why);
  const m = verdict([A('x', MIN_TRADES - 1, 5000), A('y', 30, 10)], [A('x', MIN_TRADES - 1, 5000), A('y', 30, 10)]);
  ok('AC2 an arm of 19 trades -> not settled', !m.settled && /under 20/.test(m.why), m.why);
  const e = verdict([A('x', 20, 0), A('y', 20, 0)], [A('x', 20, 0), A('y', 20, 0)]);
  ok('AC2 a tie resolves to the first arm listed, the same under both fills', e.settled && e.answer === 'x');
}

/* AC3 */
{
  let books: Awaited<ReturnType<typeof loadBooks>> = [];
  try { books = await loadBooks(console.log); } catch (e) { console.log(String(e)); }
  if (!books.length) ok('AC3 UNMEASURED: no prepared days', false);
  else for (const fill of ['touch', 'late1m'] as Fill[]) {
    let same = true;
    const all = [];
    for (const b of books) {
      const a = tradeDay(b, DEFAULT_CFG, fill), c = tradeDay(b, { ...DEFAULT_CFG, depth: 0, ivGate: false }, fill);
      if (JSON.stringify(a) !== JSON.stringify(c)) same = false;
      all.push(...a.trades);
    }
    const s = summarise(all);
    const want = fill === 'touch' ? -61375 : -85917;       // P51's recorded P34-rules result (ltp-backtest-v1.md, Result)
    ok(`AC3 ${fill}: depth 0 / gate off is byte-identical to P51's default, and still 157 trades, net ₹${want}`, same && s.trades === 157 && Math.round(s.net) === want, `${s.trades} trades, net ${s.net}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
