/**
 * P13 - nseindia.com as a data source for the scanner.
 *
 * Spec: docs/spec/scanner-nse-v1.md. Two JSON endpoints, the same two a user reads by hand:
 *  - the "Securities in F&O" price feed (every F&O stock with NSE's own pChange), and
 *  - OI Spurts by underlying (latest vs previous OI, with the % change NSE prints).
 *
 * Rules that must not drift:
 *  - NSE's bot wall rejects curl, headless Chromium AND headless Chrome (measured 2026-09-17:
 *    HTTP 000 / ERR_HTTP2_PROTOCOL_ERROR). Only a headed Chrome passes, so the window is placed
 *    off-screen rather than hidden (row 1)
 *  - every row is validated here, at the boundary, and a row whose own numbers do not agree with
 *    each other is reported, never used (row 11)
 *  - every raw body is saved before it is parsed, so a wrong number can be traced to what NSE
 *    actually sent (row 14)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const HOME = 'https://www.nseindia.com/';
export const PRICE_URL =
  'https://www.nseindia.com/api/NextApi/apiClient/marketWatchApi?functionName=getIndicesData&symbol=SECURITIES%20IN%20F%26O';
export const OI_URL = 'https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings';

const EVIDENCE_DIR = path.resolve(process.cwd(), '.cache', 'nse');
const PAGE_TIMEOUT_MS = 30_000;

/** Row 11. NSE rounds to 2 dp, so an honest row recomputes to within 0.005. */
export const CONSISTENCY_TOLERANCE = 0.01;
const SYMBOL_RE = /^[A-Z0-9&-]{1,20}$/;

/* ------------------------------------------------------------------- types */

export type NsePriceRow = {
  symbol: string;
  name: string;
  ltp: number;
  prevClose: number;
  /** NSE's own figure, the one printed on its page. */
  chgPct: number;
  volume: number | null;
};

export type NseOiRow = {
  symbol: string;
  latestOi: number;
  prevOi: number;
  /** NSE's `avgInOI`, which is the OI change % (verified 216/216 on 2026-09-17). */
  oiPct: number;
};

export type NseInvalid = { symbol: string; reason: string };

export type NsePriceFeed = {
  timestamp: string;
  /** ISO date of `timestamp`. */
  date: string | null;
  marketStatus: string;
  rows: NsePriceRow[];
  invalid: NseInvalid[];
};

export type NseOiFeed = {
  timestamp: string;
  currTradingDate: string | null;
  prevTradingDate: string | null;
  rows: NseOiRow[];
  invalid: NseInvalid[];
};

export type NseBundle = {
  mode: 'live' | 'fixture';
  fetchedAt: string;
  price: NsePriceFeed;
  oi: NseOiFeed;
  evidence: string[];
};

export class NseShapeError extends Error {}

/* ----------------------------------------------------------------- parsing */

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** `17-Sep-2026` or `17-Sep-2026 16:00:28` -> `2026-09-17`. Anything else -> null. */
export function nseDate(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{2})-([A-Z][a-z]{2})-(\d{4})\b/.exec(s.trim());
  if (!m || !MONTHS[m[2]!]) return null;
  return `${m[3]}-${MONTHS[m[2]!]}-${m[1]}`;
}

function json(raw: string, what: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // An HTML block page arrives as a 200 often enough that "not JSON" is its own failure.
    throw new NseShapeError(`${what}: NSE did not return JSON (${raw.slice(0, 60).replace(/\s+/g, ' ')}…)`);
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

export function parsePriceFeed(raw: string): NsePriceFeed {
  const body = json(raw, 'F&O price feed') as { data?: { data?: unknown; timestamp?: unknown; marketStatus?: { marketStatus?: unknown } } };
  const list = body?.data?.data;
  if (!Array.isArray(list)) throw new NseShapeError('F&O price feed: no data.data array');

  const rows: NsePriceRow[] = [];
  const invalid: NseInvalid[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const symbol = typeof r?.symbol === 'string' ? r.symbol.trim() : '';
    if (!SYMBOL_RE.test(symbol)) { invalid.push({ symbol: String(r?.symbol ?? '?').slice(0, 30), reason: 'malformed symbol' }); continue; }
    // The index itself can appear as a row in some NSE index feeds; only shares are ranked.
    if (r.series !== 'EQ') { invalid.push({ symbol, reason: `series ${String(r.series)} is not EQ` }); continue; }
    const ltp = num(r.lastPrice);
    const prevClose = num(r.previousClose);
    const chgPct = num(r.pChange);
    if (!(ltp > 0) || !(prevClose > 0) || Number.isNaN(chgPct)) {
      invalid.push({ symbol, reason: 'NSE figures missing' });
      continue;
    }
    const recomputed = ((ltp - prevClose) / prevClose) * 100;
    if (Math.abs(recomputed - chgPct) > CONSISTENCY_TOLERANCE) {
      invalid.push({ symbol, reason: 'NSE figures inconsistent' });
      continue;
    }
    const vol = num(r.totalTradedVolume);
    rows.push({
      symbol,
      name: typeof r.companyName === 'string' ? r.companyName : symbol,
      ltp, prevClose, chgPct,
      volume: Number.isNaN(vol) ? null : vol,
    });
  }
  const timestamp = typeof body.data?.timestamp === 'string' ? body.data.timestamp : '';
  return {
    timestamp,
    date: nseDate(timestamp),
    marketStatus: typeof body.data?.marketStatus?.marketStatus === 'string' ? body.data.marketStatus.marketStatus : 'unknown',
    rows, invalid,
  };
}

export function parseOiSpurts(raw: string): NseOiFeed {
  const body = json(raw, 'OI Spurts') as { data?: unknown; timestamp?: unknown; currTradingDate?: unknown; prevTradingDate?: unknown };
  if (!Array.isArray(body?.data)) throw new NseShapeError('OI Spurts: no data array');

  const rows: NseOiRow[] = [];
  const invalid: NseInvalid[] = [];
  for (const r of body.data as Record<string, unknown>[]) {
    const symbol = typeof r?.symbol === 'string' ? r.symbol.trim() : '';
    if (!SYMBOL_RE.test(symbol)) { invalid.push({ symbol: String(r?.symbol ?? '?').slice(0, 30), reason: 'malformed symbol' }); continue; }
    const latestOi = num(r.latestOI);
    const prevOi = num(r.prevOI);
    const oiPct = num(r.avgInOI);
    if (!(latestOi >= 0) || !(prevOi > 0) || Number.isNaN(oiPct)) {
      invalid.push({ symbol, reason: 'NSE figures missing' });
      continue;
    }
    if (Math.abs(((latestOi - prevOi) / prevOi) * 100 - oiPct) > CONSISTENCY_TOLERANCE) {
      invalid.push({ symbol, reason: 'NSE figures inconsistent' });
      continue;
    }
    rows.push({ symbol, latestOi, prevOi, oiPct });
  }
  return {
    timestamp: typeof body.timestamp === 'string' ? body.timestamp : '',
    currTradingDate: nseDate(body.currTradingDate),
    prevTradingDate: nseDate(body.prevTradingDate),
    rows, invalid,
  };
}

/* ---------------------------------------------------------------- fetching */

export type NseStage = 'browser' | 'price' | 'oi';

/** IST wall clock as `YYYY-MM-DD-HHmmss`, for evidence file names. */
function istStamp(at = new Date()): string {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(at);
  const g = (t: string) => p.find(x => x.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}-${g('hour')}${g('minute')}${g('second')}`;
}

async function saveEvidence(stamp: string, name: string, body: string): Promise<string | null> {
  try {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    const file = path.join(EVIDENCE_DIR, `${stamp}-${name}.json`);
    await writeFile(file, body);
    return path.relative(process.cwd(), file);
  } catch {
    return null;   // evidence is for tracing; failing to write it must not fail the scan
  }
}

/**
 * Row 1 and row 15: one headed Chrome, off-screen, three page loads - the homepage for NSE's
 * cookies, then the two feeds. The browser is closed on every path, including a failure.
 */
async function fetchLive(onStage: (s: NseStage) => void): Promise<{ price: string; oi: string; evidence: string[] }> {
  // Imported lazily: playwright is heavy, and nothing else in the server needs it at boot.
  const { chromium } = await import('playwright');
  onStage('browser');
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--window-position=-32000,-32000', '--window-size=800,600'],
    });
  } catch (e) {
    throw new Error(`could not start Google Chrome for NSE (${String((e as Error).message).split('\n')[0]})`);
  }
  try {
    const page = await browser.newPage();
    const get = async (url: string, what: string): Promise<string> => {
      const res = await page.goto(url, { timeout: PAGE_TIMEOUT_MS, waitUntil: 'domcontentloaded' })
        .catch((e: Error) => { throw new Error(`${what}: ${String(e.message).split('\n')[0]}`); });
      if (!res) throw new Error(`${what}: no response`);
      if (res.status() !== 200) throw new Error(`${what}: NSE returned HTTP ${res.status()}`);
      return res.text();
    };
    await get(HOME, 'NSE homepage');
    const stamp = istStamp();
    onStage('price');
    const price = await get(PRICE_URL, 'F&O price feed');
    onStage('oi');
    const oi = await get(OI_URL, 'OI Spurts');
    const evidence = (await Promise.all([
      saveEvidence(stamp, 'fno-securities', price),
      saveEvidence(stamp, 'oi-spurts', oi),
    ])).filter((f): f is string => f !== null);
    return { price, oi, evidence };
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Row 16. A committed directory holding `fno-securities.json` and `spurts.json`. */
async function fetchFixture(dir: string): Promise<{ price: string; oi: string; evidence: string[] }> {
  const base = path.resolve(process.cwd(), dir);
  const price = await readFile(path.join(base, 'fno-securities.json'), 'utf8');
  const oi = await readFile(path.join(base, 'spurts.json'), 'utf8');
  return { price, oi, evidence: [path.relative(process.cwd(), base)] };
}

export function nseFixtureDir(): string | null {
  const d = process.env.NSE_FIXTURE?.trim();
  return d ? d : null;
}

export async function fetchNseBundle(onStage: (s: NseStage) => void = () => {}): Promise<NseBundle> {
  const fixture = nseFixtureDir();
  const raw = fixture ? await fetchFixture(fixture) : await fetchLive(onStage);
  return {
    mode: fixture ? 'fixture' : 'live',
    fetchedAt: new Date().toISOString(),
    price: parsePriceFeed(raw.price),
    oi: parseOiSpurts(raw.oi),
    evidence: raw.evidence,
  };
}
