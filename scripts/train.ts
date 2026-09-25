/**
 * `npm run train` — P44 (`docs/spec/train-all-v1.md`). Fetches whatever cash history is missing,
 * then trains. `--fetch-only` stops after the fetch; `--no-fetch` trains on what is on disk.
 * Read-only against Dhan (chart endpoints only). Refuses in replay mode.
 */

import { readCredentials } from '../src/server/dhan.ts';
import { updateTrainData, type FetchLog } from '../src/server/train-data.ts';

const args = new Set(process.argv.slice(2));

async function main() {
  if (!args.has('--no-fetch')) {
    const creds = readCredentials();
    if (!creds) throw new Error('no Dhan credentials in .env');
    const log: FetchLog = { calls: 0, failed: [] };
    const t0 = Date.now();
    const r = await updateTrainData(creds, Date.now(), log, m => console.log(m));
    console.log(`train data to ${r.lastDay}: ${r.stocks} stocks, ${log.calls} calls, ${log.failed.length} failed, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    for (const f of log.failed) console.log(`  failed: ${f}`);
  }
  if (args.has('--fetch-only')) return;
  const { runTraining } = await import('./train-run.ts');
  await runTraining();
}

main().catch(e => { console.error(e); process.exitCode = 1; });
