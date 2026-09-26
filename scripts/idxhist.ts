/**
 * `npm run idxhist` — fetch NIFTY's 1-minute OHLC (P50 row 2) up to the last complete session.
 * Only the days not stored yet are asked for; a full history from 2024-01-01 is about 12 calls.
 */

import { readCredentials } from '../src/server/dhan.ts';
import { updateIdx, IDX_FILE } from '../src/server/idxhist.ts';

const log = { calls: 0, failed: [] as string[], added: 0 };
const s = await updateIdx(readCredentials(), Date.now(), log, console.log);
console.log(`${log.calls} calls, ${log.added} minutes added, ${s.t.length} stored to ${s.fetchedTo} in ${IDX_FILE}`);
if (log.failed.length) { console.log(`FAILED: ${log.failed.join('; ')}`); process.exitCode = 1; }
