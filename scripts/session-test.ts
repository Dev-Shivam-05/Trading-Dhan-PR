/**
 * `npm run session:test` — P30. The registry is resolved once at boot, so the `session` it carries
 * is the state at boot. On 23 Sep a server started at 06:10 IST reported "pre-open" on /api/health
 * until 15:00, and the armed open-session run waited behind it all day. `withLiveSession()` is the
 * fix; this proves it with an injected clock, and shows the frozen registry giving the WRONG answer
 * at the same instant, so a regression back to the raw registry fails here instead of on a
 * trading morning.
 */

import { sessionState, withLiveSession, type SessionState } from '../src/server/instruments.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/** An IST wall-clock instant as a Date. */
const ist = (iso: string) => new Date(`${iso}+05:30`);

// Wed 23 Sep 2026 06:10 IST — when the server that caused this was started.
const BOOT = ist('2026-09-23T06:10:00');
const ids: SessionState['id'][] = ['NSE_BSE_FNO', 'NSE_BSE_FNO', 'NSE_BSE_FNO', 'NSE_BSE_FNO', 'NSE_BSE_FNO', 'MCX'];
const registry = ids.map((id, n) => ({ id: `chip${n}`, session: sessionState(id, BOOT) }));

ok('boot snapshot is pre-open for every chip',
  registry.every(i => !i.session.openNow && i.session.reason.startsWith('pre-open')),
  registry.map(i => i.session.reason).join(' | '));

const cases: [string, Date, boolean, boolean][] = [
  // label, instant, NSE open?, MCX open?
  ['Wed 10:00 IST', ist('2026-09-23T10:00:00'), true, true],
  ['Wed 09:15 IST (bell)', ist('2026-09-23T09:15:00'), true, true],
  ['Wed 09:14 IST', ist('2026-09-23T09:14:00'), false, true],
  ['Wed 15:30 IST (close)', ist('2026-09-23T15:30:00'), false, true],
  ['Wed 23:31 IST (MCX DST close)', ist('2026-09-23T23:31:00'), false, false],
  ['Sat 10:00 IST', ist('2026-09-26T10:00:00'), false, false],
];

for (const [label, at, nse, mcx] of cases) {
  const live = withLiveSession(registry, at);
  const want = (id: string | undefined) => id === 'MCX' ? mcx : nse;
  ok(`${label}: every chip matches sessionState(now)`,
    live.every((i, n) => i.session.openNow === want(ids[n]) &&
      JSON.stringify(i.session) === JSON.stringify(sessionState(ids[n]!, at))),
    live.map(i => `${i.session.id}:${i.session.openNow}`).join(' '));
}

// The rejector: at 10:00 the frozen registry is wrong, and the fix must disagree with it.
const at10 = ist('2026-09-23T10:00:00');
ok('frozen registry at 10:00 says shut (the 23-Sep bug, reproduced)', registry.every(i => !i.session.openNow));
ok('withLiveSession at 10:00 disagrees with it on all 6 chips',
  withLiveSession(registry, at10).every((i, n) => i.session.openNow !== registry[n]!.session.openNow));
ok('withLiveSession does not mutate the registry', registry.every(i => !i.session.openNow));
ok('other fields are carried through', withLiveSession(registry, at10).every((i, n) => i.id === registry[n]!.id));

console.log(`\n${pass} pass / ${fail} fail`);
process.exitCode = fail ? 1 : 0;
