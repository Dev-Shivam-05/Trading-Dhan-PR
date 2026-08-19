/**
 * Dhan instrument master: download, cache, and parse.
 *
 * We read the DETAILED csv only. It is the one that carries LOT_SIZE and
 * UNDERLYING_SYMBOL, which is everything the registry needs, so one file is enough.
 *
 * The file is ~35 MB and has ~200k rows, but we only ever care about a handful of
 * underlyings. So we filter while streaming instead of holding the whole file in memory.
 */

import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';

const DETAILED_URL = 'https://images.dhan.co/api-data/api-scrip-master-detailed.csv';

const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CSV_PATH = path.join(CACHE_DIR, 'api-scrip-master-detailed.csv');
const META_PATH = path.join(CACHE_DIR, 'master-meta.json');

/** One row of the detailed master, narrowed to the columns we use. */
export type MasterRow = {
  exchId: string;            // NSE | BSE | MCX
  segment: string;           // I index | E equity | D derivative | M commodity
  securityId: number;        // the id Dhan APIs speak in
  instrument: string;        // INDEX | EQUITY | OPTIDX | OPTSTK | OPTFUT | FUTCOM ...
  underlyingSecurityId: string; // exchange-side token, NOT a Dhan security id
  underlyingSymbol: string;  // NIFTY | RELIANCE | GOLD ...
  symbolName: string;
  displayName: string;
  lotSize: number;
  expiry: string | null;     // YYYY-MM-DD, null for cash/index rows
  strike: number | null;
  optionType: string | null; // CE | PE | null
};

export type MasterMeta = {
  fetchedAt: string;
  bytes: number;
  rowsKept: number;
  source: 'download' | 'cache';
};

/** Instruments we ever care about. Everything else is dropped while streaming. */
const KEEP_INSTRUMENTS = new Set([
  'INDEX', 'EQUITY', 'OPTIDX', 'OPTSTK', 'OPTFUT', 'FUTCOM',
]);

/**
 * Minimal RFC4180 field splitter.
 * Dhan's master is not quoted today, but a single company name with a comma in it
 * would silently shift every column, so we do not take the shortcut of String.split.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

function num(v: string | undefined): number {
  const n = Number((v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Master dates arrive as "2026-08-31" or "2026-08-31 23:30:00". We only want the date. */
function toIsoDate(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s || s.startsWith('0001-01-01')) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1]! : null;
}

async function isCacheFresh(): Promise<boolean> {
  try {
    const meta = JSON.parse(await readFile(META_PATH, 'utf8')) as MasterMeta;
    await stat(CSV_PATH);
    // Dhan publishes a new master each trading morning. Anything fetched before
    // today's 08:00 IST is treated as stale, which is the refresh time in the PRD.
    const cutoff = istCutoffToday(8, 0);
    return new Date(meta.fetchedAt).getTime() >= cutoff.getTime();
  } catch {
    return false;
  }
}

/** The instant of HH:MM IST today, as a real Date. India has no DST, so +05:30 is exact. */
export function istCutoffToday(hour: number, minute: number): Date {
  const nowIst = new Date(Date.now() + 5.5 * 3600_000);
  const y = nowIst.getUTCFullYear();
  const m = nowIst.getUTCMonth();
  const d = nowIst.getUTCDate();
  return new Date(Date.UTC(y, m, d, hour, minute) - 5.5 * 3600_000);
}

async function download(): Promise<number> {
  await mkdir(CACHE_DIR, { recursive: true });
  const res = await fetch(DETAILED_URL);
  if (!res.ok) throw new Error(`instrument master download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(CSV_PATH, buf);
  return buf.byteLength;
}

/**
 * Load the master, downloading it only if the cache is missing or older than 08:00 IST today.
 * Returns just the rows for instruments we track.
 */
export async function loadMaster(opts: { force?: boolean } = {}): Promise<{ rows: MasterRow[]; meta: MasterMeta }> {
  let source: MasterMeta['source'] = 'cache';
  let bytes = 0;

  if (opts.force || !(await isCacheFresh())) {
    bytes = await download();
    source = 'download';
  } else {
    bytes = (await stat(CSV_PATH)).size;
  }

  const rows: MasterRow[] = [];
  const rl = createInterface({ input: createReadStream(CSV_PATH, 'utf8'), crlfDelay: Infinity });

  let header: Record<string, number> | null = null;
  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = {};
      splitCsvLine(line).forEach((name, i) => { header![name.trim()] = i; });
      continue;
    }
    // Cheap pre-filter before paying for a full field split.
    if (!KEEP_INSTRUMENTS.has(quickField(line, header['INSTRUMENT']!))) continue;

    const f = splitCsvLine(line);
    const instrument = (f[header['INSTRUMENT']!] ?? '').trim();
    if (!KEEP_INSTRUMENTS.has(instrument)) continue;

    rows.push({
      exchId: (f[header['EXCH_ID']!] ?? '').trim(),
      segment: (f[header['SEGMENT']!] ?? '').trim(),
      securityId: num(f[header['SECURITY_ID']!]),
      instrument,
      underlyingSecurityId: (f[header['UNDERLYING_SECURITY_ID']!] ?? '').trim(),
      underlyingSymbol: (f[header['UNDERLYING_SYMBOL']!] ?? '').trim(),
      symbolName: (f[header['SYMBOL_NAME']!] ?? '').trim(),
      displayName: (f[header['DISPLAY_NAME']!] ?? '').trim(),
      lotSize: num(f[header['LOT_SIZE']!]),
      expiry: toIsoDate(f[header['SM_EXPIRY_DATE']!]),
      strike: header['STRIKE_PRICE'] !== undefined ? num(f[header['STRIKE_PRICE']!]) : null,
      optionType: ((f[header['OPTION_TYPE']!] ?? '').trim() || null),
    });
  }

  const meta: MasterMeta = {
    fetchedAt: source === 'download' ? new Date().toISOString() : (await readMetaFetchedAt()) ?? new Date().toISOString(),
    bytes,
    rowsKept: rows.length,
    source,
  };
  if (source === 'download') await writeFile(META_PATH, JSON.stringify(meta, null, 2));
  return { rows, meta };
}

async function readMetaFetchedAt(): Promise<string | null> {
  try {
    return (JSON.parse(await readFile(META_PATH, 'utf8')) as MasterMeta).fetchedAt;
  } catch { return null; }
}

/** Read the nth comma-separated field without allocating the whole row. */
function quickField(line: string, index: number): string {
  let start = 0;
  for (let i = 0; i < index; i++) {
    const next = line.indexOf(',', start);
    if (next === -1) return '';
    start = next + 1;
  }
  const end = line.indexOf(',', start);
  return (end === -1 ? line.slice(start) : line.slice(start, end)).trim();
}

// Allow `npm run master:refresh` to force a fresh download and print a summary.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const force = process.argv.includes('--refresh');
  const { rows, meta } = await loadMaster({ force });
  console.log(`master ${meta.source}: ${(meta.bytes / 1e6).toFixed(1)} MB, ${rows.length} tracked rows, fetched ${meta.fetchedAt}`);
}
