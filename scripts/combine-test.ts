/**
 * `npm run combine:test` — P43 (`docs/spec/combine-v1.md`) rows 2-3 on every scenario and SOC verdict, and the
 * measurement's own accounting on the report `npm run combine` wrote.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { marketOf, alignment } from './lib/combine-lib.ts';
import { HISTORY_DIR } from '../src/server/history.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

const want: [number | null, string | null, string][] = [
  [1, 'neutral', 'neutral'], [2, 'slightly bearish', 'bearish'], [3, 'slightly bullish', 'bullish'], [4, 'slightly bearish', 'bearish'],
  [5, 'slightly bullish', 'bullish'], [6, 'blood bath', 'bearish'], [7, 'bull run', 'bullish'], [8, 'both sides risky (8)', 'mixed'],
  [9, 'both sides risky (9)', 'mixed'], [9, 'bullish SOC 1R', 'bullish'], [7, 'bearish SOC 2R', 'bearish'], [null, null, 'none'],
];
for (const [s, v, m] of want) ok(`row 2: ${v ?? 'no reading'} (${s}) -> ${m}`, marketOf(s, v) === m);
ok('row 3: BUY in a bullish market is with it, SELL is against it', alignment('BUY', 'bullish') === 'with' && alignment('SELL', 'bullish') === 'against');
ok('row 3: SELL in a bearish market is with it, BUY is against it', alignment('SELL', 'bearish') === 'with' && alignment('BUY', 'bearish') === 'against');
ok('row 3: mixed, neutral and no reading are "other"', ['mixed', 'neutral', 'none'].every(m => alignment('BUY', m as 'mixed') === 'other' && alignment('SELL', m as 'mixed') === 'other'));

const f = path.join(HISTORY_DIR, 'combine-report.json');
if (!existsSync(f)) ok('UNMEASURED: run npm run combine first', false);
else {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  for (const name of ['baseline', 'pick']) for (const fill of ['level', 'late1m']) {
    const x = r[name][fill];
    const n = x.by.with.trades + x.by.against.trades + x.by.other.trades;
    const markets = Object.values(x.markets as Record<string, number>).reduce((a, b) => a + b, 0);
    ok(`accounting ${name} ${fill}: with + against + other = every trade = the market counts`, n === x.trades && markets === x.trades, `${n} / ${markets} / ${x.trades}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
