/**
 * `npm run ltprange:test` — P54's weekly range (`docs/spec/ltp-range-v1.md`). AC1 and AC3 on hand-built data; AC2 and
 * AC4 on the stored history (UNMEASURED, and failing, without it). AC4's second implementation reads the index file's
 * raw arrays itself instead of the engine's week objects.
 */

import { readFileSync } from 'node:fs';
import type { ChainDay, Leg } from '../src/server/chainhist.ts';
import { readIndex } from '../src/server/chainhist.ts';
import { readIdx } from '../src/server/idxhist.ts';
import * as R from '../src/server/ltp-range.ts';
import { loadWeeks } from './lib/ltp-weeks.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const IST = 5.5 * 3600_000;

/* AC1 */
{
  const t = Date.parse('2026-09-22T09:15:00Z') - IST;
  const leg = (c: number, iv: number): Leg => ({ o: [c], h: [c], l: [c], c: [c], v: [1], oi: [1], iv: [iv] });
  const day: ChainDay = { date: '2026-09-22', code: 1, t: [t], spot: [23010], atm: [23000], conflicts: 0,
    legs: { '23000CE': leg(150, 12), '23000PE': leg(140, 13), '23050CE': leg(120, 11.5), '23050PE': leg(160, 13.5) } };
  const r = R.rangeAt(day, 0, 23010, '2026-09-29')!;
  // By hand: nearest strike 23000; IV (12 + 13) / 2 = 12.5; T from 09:16 on the 22nd to 15:30 on the 29th =
  // 7 days + 6 h 14 min = 7 + 374/1440 days; sigma = 23010 x 0.125 x sqrt(T / 365); straddle 290 x 0.9 = 261.
  const T = 7 + 374 / 1440, sigma = 23010 * 0.125 * Math.sqrt(T / 365);
  ok('AC1 the strike nearest the centre (23000, not 23050)', r.strike === 23000);
  ok('AC1 IV = the mean of the CE and PE IV there (12.5)', r.iv === 12.5);
  ok('AC1 T = 7 days 6 h 14 min', Math.abs(r.T - T) < 1e-9, `${r.T}`);
  ok('AC1 sigma L1 to the paisa', Math.abs(r.l1.sigma! - sigma) < 0.005, `${r.l1.sigma!.toFixed(4)} vs ${sigma.toFixed(4)}`);
  ok('AC1 straddle L1 = (150 + 140) x 0.90 = 261', Math.abs(r.l1.straddle! - 261) < 1e-9);
  const noIv: ChainDay = { ...day, legs: { ...day.legs, '23000PE': leg(140, 0) } };
  ok('AC1 a missing IV leaves the sigma band null, the straddle band intact', R.rangeAt(noIv, 0, 23010, '2026-09-29')!.l1.sigma === null && R.rangeAt(noIv, 0, 23010, '2026-09-29')!.l1.straddle !== null);
}

/* AC3 */
{
  const c = 23000, d = 100;
  ok('AC3 a high 0.05 above RL is a breach', !R.scoreWeek([{ h: 23100.05, l: 23000 }], 23000, c, d).pathInside);
  ok('AC3 a high exactly on RL is not', R.scoreWeek([{ h: 23100, l: 22900 }], 23000, c, d).pathInside);
  const s = R.scoreWeek([{ h: 23150, l: 22950 }], 23050, c, d);
  ok('AC3 the close is scored apart from the path (path out, close in)', !s.pathInside && s.closeInside === true && s.upTouched && !s.dnTouched);
  ok('AC3 no expiry close -> closeInside null, not false', R.scoreWeek([], null, c, d).closeInside === null);
  ok('AC3 claim scoring: 69 matches 65, 45 is narrower, 99.3 matches 99', R.scoreClaim(69, 1) === 'matches' && R.scoreClaim(45, 1) === 'narrower than claimed' && R.scoreClaim(99.3, 3) === 'matches');
}

/* AC2, AC4 */
let data: Awaited<ReturnType<typeof loadWeeks>> | null = null;
try { data = await loadWeeks(); } catch (e) { console.log(String(e)); }
if (!data) ok('AC2/AC4 UNMEASURED: no stored chains or index history', false);
else {
  const { weeks, dropped, sessions } = data;
  const seen = new Map<string, number>();
  for (const w of [...weeks, ...(dropped ? [dropped] : [])]) for (const d of w.sessions) seen.set(d, (seen.get(d) ?? 0) + 1);
  ok('AC2 every stored session is in exactly one week', sessions.every(d => seen.get(d) === 1) && seen.size === sessions.length, `${seen.size} of ${sessions.length}`);
  ok('AC2 the partial first week is dropped', dropped?.sessions[0] === sessions[0] && !weeks.some(w => w.sessions.includes(sessions[0]!)));
  const diwali = weeks.find(w => w.expiry === '2025-10-20');
  ok('AC2 Diwali 2025: the week closes on Monday 20 Oct, and the Muhurat 21 Oct opens the next one', !!diwali && diwali.sessions.at(-1) === '2025-10-20' && !!weeks.find(w => w.sessions[0] === '2025-10-21'));

  // AC4: the second implementation.
  const idx = (await readIdx())!;
  const ix = await readIndex();
  const scored = weeks.filter(w => w.range && w.expiryInData && w.path.length);
  let agree = 0, total = 0; const diffs: string[] = [];
  for (const m of ['sigma', 'straddle'] as R.Method[]) for (const k of R.BANDS) {
    let eP = 0, eC = 0, sP = 0, sC = 0;
    for (const w of scored) {
      const dist = w.range!.l1[m];
      if (dist === null) continue;
      const e = R.scoreWeek(w.path, w.close, w.range!.centre, k * dist);
      if (e.pathInside) eP++; if (e.closeInside) eC++;
      // Raw arrays: every minute after the range's minute, on a date whose W1 is this week's expiry, up to 15:29.
      const up = w.range!.centre + k * dist, dn = w.range!.centre - k * dist;
      let inside = true, close: number | null = null;
      for (let j = 0; j < idx.t.length; j++) {
        const t = idx.t[j]!;
        if (t <= w.range!.t) continue;
        const iso = new Date(t + IST).toISOString(), date = iso.slice(0, 10), hm = iso.slice(11, 16);
        if (ix.expiries[date]?.W1 !== w.expiry || hm > '15:29') continue;
        if (idx.h[j]! > up || idx.l[j]! < dn) inside = false;
        if (date === w.expiry && hm === '15:29') close = idx.c[j]!;
      }
      if (inside) sP++; if (close !== null && close <= up && close >= dn) sC++;
    }
    total++;
    if (eP === sP && eC === sC) agree++; else diffs.push(`${m} L${k}: engine ${eP}/${eC} vs second ${sP}/${sC}`);
  }
  ok('AC4 a second implementation agrees on every band, method and measure', agree === total, `${agree}/${total}${diffs.length ? ': ' + diffs.join('; ') : ''}`);
}

/* AC6 */
const src = readFileSync(new URL('../src/server/ltp-range.ts', import.meta.url), 'utf8');
ok('AC6 ltp-range.ts imports nothing from dhan.ts and never calls Date.now()', !/from '\.\/dhan\.ts'/.test(src) && !/Date\.now\(\)/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
