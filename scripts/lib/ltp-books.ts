/**
 * Every stored NIFTY day as a P51 `DayBook`, with its W1 expiry, for the backtest scripts (P51, P52).
 *
 * Building them runs P50's `daySignals()` over all days (~85 s), so the result is cached in
 * `.cache/ltp-books.json.gz`. The cache is keyed on the SOURCE of every engine it depends on, the day list and the
 * index file's `fetchedTo`, so an edit to any rule rebuilds it — a stale cache would be a measurement of old code.
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { CACHE_DIR } from '../../src/server/paths.ts';
import { readDay, storedDays, readIndex } from '../../src/server/chainhist.ts';
import { readIdx, byDate } from '../../src/server/idxhist.ts';
import { daySignals } from '../../src/server/ltp-lines.ts';
import { prepareDay, type DayBook } from '../../src/server/ltp-backtest.ts';

export type BookDay = DayBook & { expiry: string | null };
const FILE = path.join(CACHE_DIR, 'ltp-books.json.gz');
const SOURCES = ['ltp.ts', 'ltp-state.ts', 'ltp-lines.ts', 'ltp-backtest.ts', 'chainhist.ts', 'idxhist.ts'];

export async function loadBooks(say: (m: string) => void = () => {}): Promise<BookDay[]> {
  const days = await storedDays(1);
  const idxS = await readIdx();
  if (!idxS) throw new Error('no index history: run `npm run idxhist` first');
  const h = createHash('sha256');
  for (const f of SOURCES) h.update(await readFile(new URL(`../../src/server/${f}`, import.meta.url)));
  h.update(days.join(',')); h.update(String(idxS.fetchedTo));
  const key = h.digest('hex');
  try {
    const c = JSON.parse(gunzipSync(await readFile(FILE)).toString('utf8')) as { key: string; books: BookDay[] };
    if (c.key === key) { say(`(${c.books.length} prepared days from cache)`); return c.books; }
  } catch { /* no cache yet */ }
  const idx = byDate(idxS);
  const ix = await readIndex();
  const books: BookDay[] = [];
  const t0 = Date.now();
  for (const date of days) {
    const day = await readDay(date);
    if (!day) continue;
    const dl = daySignals(day, idx.get(date));
    if (!dl.minutes.length) continue;
    books.push({ ...prepareDay(dl, day), expiry: ix.expiries[date]?.W1 ?? null });
  }
  say(`(${books.length} days prepared in ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  await writeFile(FILE + '.tmp', gzipSync(JSON.stringify({ key, books })));
  await rename(FILE + '.tmp', FILE);
  return books;
}
