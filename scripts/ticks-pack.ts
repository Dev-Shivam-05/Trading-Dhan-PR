/**
 * `npm run ticks:pack` — gzip each CLOSED tick day (`.cache/ticks/<date>/ticks.csv` → `ticks.csv.gz`),
 * and each closed chain-recorder day (`.cache/chains/<date>/*.jsonl`, P47).
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
import { CHAIN_DIR } from '../src/server/chainrec.ts';

const exists = (f: string) => access(f).then(() => true, () => false);
async function sha(input: NodeJS.ReadableStream): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of input) h.update(chunk as Buffer);
  return h.digest('hex');
}

/** Gzip one closed file, verify the decompressed SHA-256, then delete the original. */
async function pack(label: string, file: string): Promise<void> {
  const gz = file + '.gz', tmp = gz + '.tmp';
  const before = (await stat(file)).size;
  await pipeline(createReadStream(file), createGzip({ level: 6 }), createWriteStream(tmp));
  const [a, b] = await Promise.all([sha(createReadStream(file)), sha(createReadStream(tmp).pipe(createGunzip()))]);
  if (a !== b) { await unlink(tmp); console.log(`${label}: FAILED — the packed file does not decompress to the same bytes; original kept`); process.exitCode = 1; return; }
  await rename(tmp, gz);
  await unlink(file);
  const after = (await stat(gz)).size;
  console.log(`${label}: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB (sha256 ${a.slice(0, 12)} verified)`);
}

const only = process.argv[2];
const dates = async (root: string) => only ? [only] : (await readdir(root).catch(() => [] as string[])).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();

for (const d of await dates(TICK_DIR)) {
  const dir = path.join(TICK_DIR, d), csv = path.join(dir, 'ticks.csv');
  if (!(await exists(csv))) { console.log(`ticks ${d}: no ticks.csv (already packed or never recorded)`); continue; }
  if (!(await exists(path.join(dir, 'summary.json')))) { console.log(`ticks ${d}: not closed yet (no summary.json) — left alone`); continue; }
  await pack(`ticks ${d}`, csv);
}

// P47: the chain recorder's days, packed the same way once its summary.json says the day closed.
for (const d of await dates(CHAIN_DIR)) {
  const dir = path.join(CHAIN_DIR, d);
  if (!(await exists(path.join(dir, 'summary.json')))) { console.log(`chains ${d}: not closed yet (no summary.json) — left alone`); continue; }
  for (const f of (await readdir(dir).catch(() => [] as string[])).filter(f => f.endsWith('.jsonl')).sort()) await pack(`chains ${d}/${f}`, path.join(dir, f));
}
