/**
 * `npm run ltprange` — P54: NIFTY's weekly range (`docs/spec/ltp-range-v1.md`), both methods, scored against the
 * hit rates §16.1 claims (L1 ~65%, L2 ~95%, L3 >99%). Writes `.cache/ltp-range-report.json`. No Dhan call.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from '../src/server/paths.ts';
import { loadWeeks } from './lib/ltp-weeks.ts';
import { scoreWeek, scoreClaim, BANDS, CLAIMS, type Method } from '../src/server/ltp-range.ts';

const { weeks, dropped, sessions } = await loadWeeks();
const scored = weeks.filter(w => w.range && w.expiryInData && w.path.length);
const skipped = weeks.filter(w => !scored.includes(w));
console.log(`${sessions.length} sessions -> ${weeks.length + (dropped ? 1 : 0)} weeks; dropped the partial first week (${dropped?.sessions[0]}..${dropped?.expiry}); ` +
  `${scored.length} scored, ${skipped.length} skipped (${skipped.map(w => `${w.expiry}: ${w.why ?? (w.expiryInData ? 'no path' : 'expiry not in the data yet')}`).join('; ')})`);

const report: Record<string, unknown> = { weeks: scored.length };
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1]! : NaN; };
for (const m of ['sigma', 'straddle'] as Method[]) {
  const ws = scored.filter(w => w.range!.l1[m] !== null);
  const size = med(ws.map(w => 2 * w.range!.l1[m]!));
  console.log(`\n=== method ${m} (${ws.length} weeks; median week size RL1 - SL1 = ${size.toFixed(0)} points, ${(100 * med(ws.map(w => 2 * w.range!.l1[m]! / w.range!.centre))).toFixed(2)}% of the index)`);
  const rows: Record<string, unknown> = {};
  for (const k of BANDS) {
    let pathIn = 0, closeIn = 0, closeN = 0, up = 0, dn = 0;
    for (const w of ws) {
      const s = scoreWeek(w.path, w.close, w.range!.centre, k * w.range!.l1[m]!);
      if (s.pathInside) pathIn++;
      if (s.closeInside !== null) { closeN++; if (s.closeInside) closeIn++; }
      if (s.upTouched) up++; if (s.dnTouched) dn++;
    }
    const p = 100 * pathIn / ws.length, c = 100 * closeIn / closeN;
    console.log(`  L${k} (claim ~${CLAIMS[k]}%): path inside ${p.toFixed(1)}% -> ${scoreClaim(p, k)};  expiry close inside ${c.toFixed(1)}% -> ${scoreClaim(c, k)};  RL${k} crossed ${up}, SL${k} crossed ${dn} of ${ws.length} weeks`);
    rows[`L${k}`] = { pathInsidePct: +p.toFixed(2), pathVerdict: scoreClaim(p, k), closeInsidePct: +c.toFixed(2), closeVerdict: scoreClaim(c, k), upCrossed: up, dnCrossed: dn, weeks: ws.length };
  }
  report[m] = { weekSizeMedian: size, bands: rows };
}
await writeFile(path.join(CACHE_DIR, 'ltp-range-report.json'), JSON.stringify(report, null, 1));
console.log('\nreport written to .cache/ltp-range-report.json');
