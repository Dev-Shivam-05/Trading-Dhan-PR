/**
 * `npm run ticks:pack` — gzip each CLOSED tick day (`.cache/ticks/<date>/ticks.csv` → `ticks.csv.gz`).
 *
 * Measured 2026-09-25: one recorded day is ~1.2 GB of CSV, and drive D: had 4.9 GB free, so an
 * unpacked recorder fills the disk in about four trading days — and with it the live paper
 * ledger's writes. A day is packed only once the recorder has closed it (`summary.json` exists),
 * and the CSV is deleted only after the packed file decompresses to the same SHA-256.
 * The sandbox reads either form (`sandbox.ts`).
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { access, readdir, rename, stat, unlink } from 'node:fs/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { TICK_DIR } from '../src/server/ticks.ts';

const exists = (f: string) => access(f).then(() => true, () => false);
async function sha(input: NodeJS.ReadableStream): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of input) h.update(chunk as Buffer);
  return h.digest('hex');
}

const only = process.argv[2];
const days = only ? [only] : (await readdir(TICK_DIR).catch(() => [] as string[])).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
for (const d of days) {
  const dir = path.join(TICK_DIR, d), csv = path.join(dir, 'ticks.csv'), gz = csv + '.gz', tmp = gz + '.tmp';
  if (!(await exists(csv))) { console.log(`${d}: no ticks.csv (already packed or never recorded)`); continue; }
  if (!(await exists(path.join(dir, 'summary.json')))) { console.log(`${d}: not closed yet (no summary.json) — left alone`); continue; }
  const before = (await stat(csv)).size;
  await pipeline(createReadStream(csv), createGzip({ level: 6 }), createWriteStream(tmp));
  const [a, b] = await Promise.all([sha(createReadStream(csv)), sha(createReadStream(tmp).pipe(createGunzip()))]);
  if (a !== b) { await unlink(tmp); console.log(`${d}: FAILED — the packed file does not decompress to the same bytes; CSV kept`); process.exitCode = 1; continue; }
  await rename(tmp, gz);
  await unlink(csv);
  const after = (await stat(gz)).size;
  console.log(`${d}: ${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(0)} MB (sha256 ${a.slice(0, 12)} verified)`);
}
