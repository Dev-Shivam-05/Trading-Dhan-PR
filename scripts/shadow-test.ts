/**
 * `npm run shadow:test` — P45 (`docs/spec/shadow-v1.md`). AC1 and AC2 on the stored cash history; AC4 by reading the
 * source. AC3 is the replay-server check; AC5 is Monday's live evening.
 */

import { readFileSync } from 'node:fs';
import { loadStocks, computeShadow, SHADOW_AFTER, SHADOW_SETTINGS } from '../src/server/shadow.ts';
import { sessionsOf, dayPicks, runGrid, type FillModel } from '../src/server/train.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

const { stocks } = await loadStocks();
if (!stocks.length) ok('UNMEASURED: no stored cash history (npm run train --fetch-only)', false);
else {
  // AC1: a past range, against runGrid called directly.
  const after = '2026-09-10';
  const sh = computeShadow(stocks, after);
  const sessions = sessionsOf(stocks).filter(d => d > after);
  const picks = dayPicks(stocks, sessions);
  let same = true, n = 0;
  for (const fill of ['level', 'late1m'] as FillModel[]) {
    const { results } = runGrid(stocks, sessions, picks, SHADOW_SETTINGS.map(s => s.p), new Set(), fill);
    for (const r of results) {
      const row = sh.rows.find(x => x.key === r.key && x.fill === fill)!;
      n += r.trades;
      if (!row || row.net !== r.net || row.trades !== r.trades || row.days.some((d, k) => d.net !== r.perDay[k] || d.trades !== r.tradesPerDay[k])) same = false;
    }
  }
  ok(`AC1 computeShadow over ${sessions[0]}..${sessions.at(-1)} equals runGrid for 3 settings x 2 fills, to the paisa`, same && sh.rows.length === 6, `${sessions.length} sessions, ${n} trades`);
  ok('AC1 the settings are the baseline, the recommended pick and its 2R twin', sh.rows.map(r => r.key).filter((k, i, a) => a.indexOf(k) === i).join(' | ') ===
    'chg2/gap/r2/sma9/x2/noSL/noT/nofrz | chg0/either/r3/sma20/x3/SL/noT/nofrz | chg0/either/r3/sma20/x3/SL/T2R/nofrz');
  // AC2.
  ok('AC2 a past since-date includes only later sessions', sh.sessions.every(d => d > after) && sh.sessions.length === sessions.length);
  const real = computeShadow(stocks);
  ok(`AC2 with the real since-date (${SHADOW_AFTER}) nothing on or before it enters`, real.sessions.every(d => d > SHADOW_AFTER), `${real.sessions.length} forward session(s) on disk`);
}

const src = readFileSync(new URL('../src/server/shadow.ts', import.meta.url), 'utf8');
ok('AC4 shadow.ts imports only a type from dhan.ts (no call can place an order)', !/import \{[^}]*\} from '\.\/dhan\.ts'/.test(src.replace(/import type \{[^}]*\} from '\.\/dhan\.ts';/, '')));
ok('AC4 the nightly step refuses replay mode', /if \(isReplay\(\)\) throw/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
