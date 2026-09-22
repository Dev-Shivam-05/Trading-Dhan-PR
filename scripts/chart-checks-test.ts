/**
 * Proves the arithmetic in `scripts/lib/chart-checks.ts` BEFORE the session opens.
 *
 * `npm run open:checks` on a shut market runs only its SKIP branch, so every measuring line in it
 * is unproven until 09:15 — and there is one session a day in which to find a bug. This drives
 * each function against the REAL payloads captured in `test/fixtures/chart-2026-09-22/` (one full
 * NSE session: 1125 one-minute underlying candles over three days, and 385 option candles with
 * their colour decisions) and against deliberately broken copies of them.
 *
 * Every check that can pass must also be shown to FAIL on bad input. A filter that has never
 * rejected anything has not been tested — the lesson P8's funnel taught this project.
 *
 *   node scripts/chart-checks-test.ts
 */

import { readFile } from 'node:fs/promises';
import {
  containment, medianOf, openingCounts, spacingErrors, toMs,
  type Tick, type UCandle,
} from './lib/chart-checks.ts';

const DIR = 'test/fixtures/chart-2026-09-22';
let pass = 0, fail = 0;

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/** Ticks that sit exactly inside each candle: open, high, low, then close last. */
function ticksInside(cs: UCandle[]): Tick[] {
  const out: Tick[] = [];
  for (const c of cs) {
    out.push({ p: c.o, t: c.t + 1_000 });
    out.push({ p: c.h, t: c.t + 20_000 });
    out.push({ p: c.l, t: c.t + 40_000 });
    out.push({ p: c.c, t: c.t + 59_000 });
  }
  return out;
}

async function main() {
  const uc = JSON.parse(await readFile(`${DIR}/ucandles-nifty-1m.json`, 'utf8'));
  const oc = JSON.parse(await readFile(`${DIR}/ocandles-nifty-23350ce-1m.json`, 'utf8'));
  const all: UCandle[] = uc.candles;
  const day = all[all.length - 1]!.d;
  const today = all.filter(c => c.d === day);
  console.log(`fixtures: ${all.length} underlying candles over `
    + `${new Set(all.map(c => c.d)).size} sessions (latest ${day}, ${today.length} candles)`
    + ` · ${oc.candles.length} option candles, ${oc.context} of context\n`);

  /* --------------------------------------------------------- spacingErrors */
  ok('spacing: a real 3-session 1-minute series is regular',
    spacingErrors(all, 60_000).length === 0,
    `${all.length} candles, ${new Set(all.map(c => c.d)).size} session boundaries skipped`);

  // Negative 1: drop one candle from the middle of the session. Exactly one 120,000 ms gap.
  const holed = [...today.slice(0, 100), ...today.slice(101)];
  const holeErrs = spacingErrors(holed, 60_000);
  ok('spacing: a missing candle is reported, once, as a 120,000 ms gap',
    holeErrs.length === 1 && holeErrs[0]!.includes('120000'), holeErrs[0] ?? 'nothing reported');

  // Negative 2: the same regular series judged against the wrong interval must reject nearly all.
  ok('spacing: a 1-minute series judged at 5 minutes rejects every pair',
    spacingErrors(today, 300_000).length === today.length - 1,
    `${spacingErrors(today, 300_000).length} of ${today.length - 1}`);

  // Negative 3: an out-of-order pair shows as a negative gap rather than being hidden.
  const swapped = [...today]; const tmp = swapped[10]!; swapped[10] = swapped[11]!; swapped[11] = tmp;
  ok('spacing: an out-of-order pair is reported, not hidden',
    spacingErrors(swapped, 60_000).some(e => e.includes('-60000')),
    spacingErrors(swapped, 60_000).slice(0, 2).join(' / '));

  // The session boundary itself must NOT be counted as a gap. Built as boundary-crossing PAIRS
  // only — the last candle of one day followed by the first of the next. (A first draft of this
  // test took every 09:15 and every 15:29 candle, which also puts a same-day 09:15 -> 15:29 pair
  // in the series: 375 minutes apart, correctly reported, and the test failed with the function
  // behaving exactly as specified.)
  const days = [...new Set(all.map(c => c.d))];
  const crossings: [UCandle, UCandle][] = [];
  for (let i = 1; i < days.length; i++) {
    const prev = all.filter(c => c.d === days[i - 1]);
    const next = all.filter(c => c.d === days[i]);
    crossings.push([prev[prev.length - 1]!, next[0]!]);
  }
  // Each crossing is judged on its own: a series of [last, first, last, first] would also contain
  // same-day 09:15 -> 15:29 pairs, which ARE 375 minutes apart and correctly reported.
  ok('spacing: a session boundary is not a gap',
    crossings.length > 0 && crossings.every(p => spacingErrors(p, 60_000).length === 0),
    `${crossings.length} overnight crossings across ${days.length} sessions`
    + ` (${crossings.map(p => `${p[0].d} ${p[0].at} -> ${p[1].d} ${p[1].at}`).join(', ')})`);

  /* ----------------------------------------------------------- containment */
  const slice = today.slice(0, 30);
  const good = ticksInside(slice);
  const c1 = containment(slice, good, 60_000);
  // The first and last candle fall outside the tick window by construction (the window opens at
  // t+1000 of the first and closes at t+59000 of the last), which is the rule being tested.
  ok('containment: ticks drawn from each candle\'s own OHLC are contained',
    c1.judged === slice.length - 2 && c1.contained === c1.judged && c1.misses.length === 0,
    `${c1.contained}/${c1.judged} of ${slice.length} candles judged`);
  ok('containment: the close equals the last tick of the interval',
    c1.closeAgrees === c1.judged, `${c1.closeAgrees}/${c1.judged}`);

  // Negative 1: one tick above a candle's high must break containment for exactly that candle.
  const broken = ticksInside(slice);
  broken[4 * 10 + 1] = { p: slice[10]!.h + 5, t: slice[10]!.t + 20_000 };
  const c2 = containment(slice, broken, 60_000);
  ok('containment: a tick above the high is caught, and only that candle',
    c2.contained === c2.judged - 1 && c2.misses.length === 1,
    c2.misses[0] ?? 'nothing reported');

  // Negative 2: one tick below a candle's low, same shape.
  const broken2 = ticksInside(slice);
  broken2[4 * 12 + 2] = { p: slice[12]!.l - 5, t: slice[12]!.t + 40_000 };
  const c3 = containment(slice, broken2, 60_000);
  ok('containment: a tick below the low is caught',
    c3.contained === c3.judged - 1 && c3.misses.length === 1, c3.misses[0] ?? 'nothing reported');

  // Negative 3: a close that disagrees is counted separately from containment.
  const broken3 = ticksInside(slice);
  broken3[4 * 15 + 3] = { p: slice[15]!.l, t: slice[15]!.t + 59_000 };
  const c4 = containment(slice, broken3, 60_000);
  ok('containment: a close disagreement does not fake a containment failure',
    c4.contained === c4.judged && c4.closeAgrees === c4.judged - 1,
    `contained ${c4.contained}/${c4.judged}, closes ${c4.closeAgrees}/${c4.judged}`);

  // Negative 4: no ticks, and no candles. Neither may report a pass.
  ok('containment: no ticks judges nothing rather than passing',
    containment(slice, [], 60_000).judged === 0);
  ok('containment: no candles judges nothing rather than passing',
    containment([], good, 60_000).judged === 0);

  // Negative 5: a tick window that covers only the middle must judge only the middle, and must
  // do it CONSERVATIVELY. Ticks land at +1s..+59s inside candles 10..20, so the covered window is
  // [c10.t+1000, c20.t+59000]: candle 10 starts 1 s before the first tick and candle 20 ends 1 s
  // after the last, so neither is fully covered and neither may be judged. That leaves 11..19.
  // A candle half of which happened before the subscription opened would otherwise be scored on
  // ticks this run never saw.
  const narrow = good.filter(t => t.t >= slice[10]!.t && t.t <= slice[20]!.t + 59_000);
  const c5 = containment(slice, narrow, 60_000);
  ok('containment: only candles whose whole minute is inside the window are judged',
    c5.judged === 9 && c5.contained === 9,
    `judged ${c5.judged} (candles 11..19) — 10 and 20 are only partly covered and are excluded`);

  /* --------------------------------------------------------- openingCounts */
  const o1 = openingCounts(oc.candles, 20);
  const handShipped = oc.candles.slice(0, 20).filter((c: any) => c.fired).length;
  const handWhole = oc.candles.filter((c: any) => c.fired).length;
  ok('opening: the counts match a hand count of the same payload',
    o1.shipped === handShipped && o1.whole === handWhole,
    `${o1.shipped} in the first 20 of ${o1.whole} all day (hand: ${handShipped}/${handWhole})`);
  ok('opening: the whole-day count matches the payload\'s own counts block',
    o1.whole === (oc.counts.blue + oc.counts.yellow),
    `${o1.whole} vs blue ${oc.counts.blue} + yellow ${oc.counts.yellow}`);
  ok('opening: median20 on the 09:15 candle comes from OUTSIDE the session',
    o1.firstMedian !== null && oc.context > 0 && o1.firstMedian !== o1.ownMedian,
    `09:15 median20 ${o1.firstMedian} (${oc.context} context candles) vs the session's own `
    + `first-20 median ${o1.ownMedian}`);
  ok('opening: a session-only rule cannot fire inside the window, by construction',
    o1.sessionOnly === 0);

  // Negative: a payload that DOES fire at the open must be counted.
  const forced = oc.candles.map((c: any, i: number) => (i === 0 ? { ...c, fired: 'blue' } : c));
  ok('opening: a signal on the 09:15 candle is counted',
    openingCounts(forced, 20).shipped === handShipped + 1,
    `${openingCounts(forced, 20).shipped} vs ${handShipped} + 1`);

  /* ---------------------------------------------------------------- median */
  ok('median: odd length takes the middle', medianOf([3, 1, 2]) === 2);
  ok('median: even length averages the two middles', medianOf([4, 1, 2, 3]) === 2.5);
  ok('median: empty is 0, as candles.ts defines it', medianOf([]) === 0);
  ok('median: the input is not mutated', (() => {
    const xs = [3, 1, 2]; medianOf(xs); return xs[0] === 3;
  })());
  // The project's own rule: a numeric claim is made numerically, never through toFixed strings.
  ok('median: agrees with the server\'s own median20 numerically, to 0.005',
    (() => {
      const c = oc.candles;
      for (let i = 20; i < c.length; i++) {
        const mine = medianOf(c.slice(i - 20, i).map((x: any) => x.volume));
        if (c[i].median20 === null) continue;
        if (Math.abs(mine - c[i].median20) > 0.005) return false;
      }
      return true;
    })(),
    `${oc.candles.length - 20} candles re-medianed independently`);

  /* ------------------------------------------------------------------ toMs */
  ok('toMs: epoch seconds are scaled', toMs(1790071680) === 1790071680000);
  ok('toMs: epoch milliseconds are left alone', toMs(1790071680000) === 1790071680000);

  console.log(`\n${pass} pass · ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

main().then(code => { process.exitCode = code; }).catch(err => {
  console.error(String(err));
  process.exitCode = 2;
});
