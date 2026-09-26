/**
 * `npm run shadow` — P45 by hand (`docs/spec/shadow-v1.md`): fetch the missing cash history, run P44's engine on every
 * session after 2026-09-25 for the baseline, the recommended setting and its 2R twin, under both fills, and write
 * `.cache/history/shadow-report.json`. `--no-fetch` computes on what is on disk. Read-only against Dhan.
 */

import { readCredentials } from '../src/server/dhan.ts';
import { runShadow, loadStocks, computeShadow, SHADOW_AFTER } from '../src/server/shadow.ts';

const inr = (x: number) => (x < 0 ? '−' : '+') + '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN');
let rows, sessions;
if (process.argv.includes('--no-fetch')) {
  ({ rows, sessions } = computeShadow((await loadStocks()).stocks));
} else {
  const creds = readCredentials();
  if (!creds) throw new Error('no Dhan credentials in .env');
  ({ rows, sessions } = await runShadow(creds, Date.now(), console.log));
}
console.log(`\n${sessions.length} forward session(s) after ${SHADOW_AFTER}${sessions.length ? `: ${sessions.join(', ')}` : ' — the first is Mon 28 Sep, after 16:00'}`);
for (const r of rows) console.log(`  ${r.fill.padEnd(6)} ${r.label.padEnd(32)} ${String(r.trades).padStart(4)} trades  net ${inr(r.net)}`);
