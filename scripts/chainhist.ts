/**
 * `npm run chainhist` — P48 (`docs/spec/chain-rebuild-v1.md`). Rebuilds whatever NIFTY minute chains
 * are missing from `/v2/charts/rollingoption` into `.cache/history/chains/NIFTY/`. Read-only against
 * Dhan (a chart endpoint). Refuses in replay mode and below 2 GB free. Run it after 16:00 IST.
 */

import { readCredentials } from '../src/server/dhan.ts';
import { updateChainHistory, CHAIN_HIST_DIR, type FetchLog } from '../src/server/chainhist.ts';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function dirBytes(dir: string) {
  let n = 0;
  for (const f of await readdir(dir).catch(() => [] as string[])) n += (await stat(path.join(dir, f))).size;
  return n;
}

async function main() {
  const creds = readCredentials();
  if (!creds) throw new Error('no Dhan credentials in .env');
  const log: FetchLog = { calls: 0, failed: [], written: 0, bytes: 0 };
  const t0 = Date.now(), before = await dirBytes(CHAIN_HIST_DIR);
  const say = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)}Z ${m}`);
  // A skipped month is fetched again by the next pass. On 25 Sep, April and May 2024 each lost one
  // series to a transient failure and were whole on the very next try, so up to 3 passes are made,
  // and a pass that fails as many months as the one before it ends the run (a real outage, not noise).
  let r = await updateChainHistory(creds, Date.now(), log, say);
  let lastPassFailed = log.failed.length;
  for (let pass = 2, prevFailed = lastPassFailed; pass <= 3 && prevFailed > 0; pass++) {
    const failedBefore = log.failed.length;
    say(`pass ${pass}: fetching the ${prevFailed} skipped month(s) again`);
    r = await updateChainHistory(creds, Date.now(), log, say);
    const now = log.failed.length - failedBefore;
    lastPassFailed = now;
    if (now >= prevFailed) break;
    prevFailed = now;
  }
  const { lastDay, idx } = r;
  const after = await dirBytes(CHAIN_HIST_DIR);
  const inc = Object.keys(idx.incomplete).length;
  console.log(`chain history to ${lastDay}: ${log.calls} calls, ${log.failed.length} failed (${lastPassFailed} still missing), ${log.written} days written, ${inc} incomplete days listed, ` +
    `${((after - before) / 1e6).toFixed(1)} MB written (${(after / 1e6).toFixed(1)} MB total), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const f of log.failed) console.log(`  failed: ${f}`);
  for (const [d, why] of Object.entries(idx.incomplete)) console.log(`  incomplete: ${d} ${why}`);
  if (lastPassFailed) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
