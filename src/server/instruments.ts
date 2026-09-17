/**
 * The six-instrument registry (spec lock row 3) and everything derived from the master.
 *
 * Nothing here is hardcoded except the five underlying security ids, which are the API's
 * primary keys. Lot sizes, expiries and the GOLD futures contract are read from the master
 * on every boot, because they change on roll days.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadMaster, type MasterRow, type MasterMeta } from './master.ts';
import { isReplay } from './replay.ts';
import { fetchExpiryList, type Credentials } from './dhan.ts';

export type Seg = 'IDX_I' | 'NSE_EQ' | 'NSE_FNO' | 'BSE_EQ' | 'BSE_FNO' | 'MCX_COMM';

type RegistryEntry = {
  id: string;
  label: string;
  displayName: string;
  /** Dhan security id of the UNDERLYING, sent as UnderlyingScrip. null = must be resolved. */
  underlyingScrip: number | null;
  underlyingSeg: Seg;
  /** How to find this underlying's option contracts inside the master. */
  options: { exchId: string; instrument: string; underlyingSymbol: string };
  /** How to assert the hardcoded underlyingScrip still exists in the master. */
  assert: { exchId: string; instrument: string; underlyingSymbol: string } | null;
  session: SessionId;
};

type SessionId = 'NSE_BSE_FNO' | 'MCX';

const REGISTRY: RegistryEntry[] = [
  {
    id: 'NIFTY', label: 'NIFTY 50', displayName: 'NIFTY 50 IDX',
    underlyingScrip: 13, underlyingSeg: 'IDX_I',
    options: { exchId: 'NSE', instrument: 'OPTIDX', underlyingSymbol: 'NIFTY' },
    assert: { exchId: 'NSE', instrument: 'INDEX', underlyingSymbol: 'NIFTY' },
    session: 'NSE_BSE_FNO',
  },
  {
    id: 'BANKNIFTY', label: 'BANK NIFTY', displayName: 'NIFTY BANK IDX',
    underlyingScrip: 25, underlyingSeg: 'IDX_I',
    options: { exchId: 'NSE', instrument: 'OPTIDX', underlyingSymbol: 'BANKNIFTY' },
    assert: { exchId: 'NSE', instrument: 'INDEX', underlyingSymbol: 'BANKNIFTY' },
    session: 'NSE_BSE_FNO',
  },
  {
    id: 'SENSEX', label: 'SENSEX', displayName: 'SENSEX IDX',
    underlyingScrip: 51, underlyingSeg: 'IDX_I',
    options: { exchId: 'BSE', instrument: 'OPTIDX', underlyingSymbol: 'SENSEX' },
    assert: { exchId: 'BSE', instrument: 'INDEX', underlyingSymbol: 'SENSEX' },
    session: 'NSE_BSE_FNO',
  },
  {
    id: 'RELIANCE', label: 'RELIANCE', displayName: 'RELIANCE INDUSTRIES',
    underlyingScrip: 2885, underlyingSeg: 'NSE_EQ',
    options: { exchId: 'NSE', instrument: 'OPTSTK', underlyingSymbol: 'RELIANCE' },
    assert: { exchId: 'NSE', instrument: 'EQUITY', underlyingSymbol: 'RELIANCE' },
    session: 'NSE_BSE_FNO',
  },
  {
    id: 'HDFCBANK', label: 'HDFCBANK', displayName: 'HDFC BANK',
    underlyingScrip: 1333, underlyingSeg: 'NSE_EQ',
    options: { exchId: 'NSE', instrument: 'OPTSTK', underlyingSymbol: 'HDFCBANK' },
    assert: { exchId: 'NSE', instrument: 'EQUITY', underlyingSymbol: 'HDFCBANK' },
    session: 'NSE_BSE_FNO',
  },
  {
    id: 'GOLD', label: 'GOLD', displayName: 'GOLD MCX',
    // SPIKE-01: MCX commodity options hang off a futures contract, not a spot index,
    // and Dhan's docs only document index examples. Resolved by scripts/spike-gold.ts.
    underlyingScrip: null, underlyingSeg: 'MCX_COMM',
    options: { exchId: 'MCX', instrument: 'OPTFUT', underlyingSymbol: 'GOLD' },
    assert: null,
    session: 'MCX',
  },
];

export type ResolvedInstrument = {
  id: string;
  label: string;
  displayName: string;
  underlyingScrip: number | null;
  underlyingSeg: Seg;
  lot: number | null;
  nearestExpiry: string | null;
  expiries: string[];
  optionContracts: number;
  session: SessionState;
  /** True only when this chip can be polled right now with no open questions. */
  resolved: boolean;
  /** Things that block `resolved`. Empty means nothing is wrong. */
  problems: string[];
  /** Informational only. */
  notes: string[];
  /** Only present while SPIKE-01 is unresolved. */
  scripCandidates?: { value: number; why: string }[];
};

export type SessionState = {
  id: SessionId;
  window: string;
  openNow: boolean;
  reason: string;
};

/* ------------------------------------------------------------------ sessions */

/** IST clock parts. India has no DST, so a fixed +05:30 offset is exact. */
function istParts(at = new Date()) {
  const ist = new Date(at.getTime() + 5.5 * 3600_000);
  return {
    weekday: ist.getUTCDay(),                        // 0 Sun .. 6 Sat
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
    hhmm: `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`,
    date: ist,
  };
}

/**
 * MCX shifts its evening close twice a year because the US observes DST and India does not:
 * 23:30 IST while the US is on DST, 23:55 IST otherwise. US DST runs from the second Sunday
 * of March to the first Sunday of November.
 */
function isUsDst(d: Date): boolean {
  const y = d.getUTCFullYear();
  const secondSundayMarch = nthWeekdayUtc(y, 2, 0, 2);
  const firstSundayNov = nthWeekdayUtc(y, 10, 0, 1);
  return d >= secondSundayMarch && d < firstSundayNov;
}

function nthWeekdayUtc(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (nth - 1) * 7));
}

export function sessionState(id: SessionId, at = new Date()): SessionState {
  const { weekday, minutes, hhmm, date } = istParts(at);
  const weekend = weekday === 0 || weekday === 6;

  const open = id === 'MCX' ? 9 * 60 : 9 * 60 + 15;
  const close = id === 'MCX' ? (isUsDst(date) ? 23 * 60 + 30 : 23 * 60 + 55) : 15 * 60 + 30;
  const window = `${fmt(open)}-${fmt(close)} IST Mon-Fri`;

  if (weekend) return { id, window, openNow: false, reason: `weekend (${hhmm} IST)` };
  if (minutes < open) return { id, window, openNow: false, reason: `pre-open, opens ${fmt(open)} IST` };
  if (minutes >= close) return { id, window, openNow: false, reason: `closed at ${fmt(close)} IST` };
  return { id, window, openNow: true, reason: `open (${hhmm} IST)` };
}

function fmt(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/* -------------------------------------------------------------- gold spike */

const GOLD_RESOLUTION_PATH = path.resolve(process.cwd(), '.cache', 'gold-resolution.json');

export type GoldResolution = { underlyingScrip: number; via: string; confirmedAt: string };

export async function readGoldResolution(): Promise<GoldResolution | null> {
  try { return JSON.parse(await readFile(GOLD_RESOLUTION_PATH, 'utf8')) as GoldResolution; }
  catch { return null; }
}

export const GOLD_RESOLUTION_FILE = GOLD_RESOLUTION_PATH;

async function writeGoldResolution(r: GoldResolution): Promise<void> {
  try {
    await mkdir(path.dirname(GOLD_RESOLUTION_PATH), { recursive: true });
    await writeFile(GOLD_RESOLUTION_PATH, JSON.stringify(r, null, 2));
  } catch { /* the cache is an optimisation; failing to write it must not break boot */ }
}

/**
 * SPIKE-01, run automatically at boot instead of as a manual step.
 *
 * MCX commodity options hang off a futures contract rather than a spot index and Dhan documents
 * index examples only, so the right UnderlyingScrip has to be proven with a real call. Trying it
 * here means swapping the token in .env is the only thing a user ever has to do.
 */
async function autoResolveGold(
  rows: MasterRow[], creds: Credentials, today: string,
): Promise<{ resolution: GoldResolution | null; tried: string[] }> {
  const tried: string[] = [];
  const future = nearMonthGoldFuture(rows, today);
  const optfut = rows.find(r =>
    r.exchId === 'MCX' && r.instrument === 'OPTFUT' && r.underlyingSymbol === 'GOLD' && r.expiry && r.expiry >= today);

  const candidates: { value: number; why: string }[] = [];
  if (future) candidates.push({ value: future.securityId, why: `near-month FUTCOM ${future.displayName}` });
  const token = Number(optfut?.underlyingSecurityId ?? 0);
  if (token > 0) candidates.push({ value: token, why: 'UNDERLYING_SECURITY_ID on GOLD OPTFUT rows' });

  for (const c of candidates) {
    const call = await fetchExpiryList(creds, c.value, 'MCX_COMM');
    if (call.ok && Array.isArray(call.data?.data) && call.data!.data.length > 0) {
      const resolution: GoldResolution = { underlyingScrip: c.value, via: c.why, confirmedAt: new Date().toISOString() };
      await writeGoldResolution(resolution);
      return { resolution, tried };
    }
    tried.push(`${c.value} (${c.why}) -> ${call.error?.code ?? 'no expiries'}`);
    // A rejected token will reject every candidate identically; stop rather than hammer.
    if (call.error && !call.error.retryable && call.error.code !== 'DH-905') break;
  }
  return { resolution: null, tried };
}

/** Near-month GOLD futures contract: the first FUTCOM whose expiry has not passed. */
export function nearMonthGoldFuture(rows: MasterRow[], today = todayIso()): MasterRow | null {
  return rows
    .filter(r => r.exchId === 'MCX' && r.instrument === 'FUTCOM' && r.underlyingSymbol === 'GOLD' && r.expiry && r.expiry >= today)
    .sort((a, b) => (a.expiry! < b.expiry! ? -1 : 1))[0] ?? null;
}

export function todayIso(at = new Date()): string {
  return istParts(at).date.toISOString().slice(0, 10);
}

/** Whole calendar days from today to an expiry date, both in IST. */
export function daysToExpiry(expiry: string, at = new Date()): number {
  const t = Date.parse(`${todayIso(at)}T00:00:00Z`);
  const e = Date.parse(`${expiry}T00:00:00Z`);
  return Math.round((e - t) / 86_400_000);
}

/* ------------------------------------------------------------- resolution */

/**
 * The feed subscribes per contract, so it needs each strike's Dhan security id. The option chain
 * REST response does not carry them, but the instrument master does - so the parsed rows are kept
 * after resolution rather than thrown away.
 */
let cachedRows: MasterRow[] = [];

/** `lotSize` is per EXPIRY, never a constant - see the nearest-expiry note in resolveRegistry.
 *  Carried on the contract so a caller charting a far month does not have to fall back to the
 *  instrument's lot, which is only ever the nearest expiry's. */
export type OptionContract = {
  strike: number; optionType: 'CE' | 'PE'; securityId: number; seg: Seg; lotSize: number | null;
};

/**
 * The master's own instrument type for this chip's option contracts - OPTIDX / OPTSTK / OPTFUT.
 * Read from the registry rather than re-derived from the segment, so the two cannot drift.
 * `/v2/charts/intraday` needs it alongside the exchange segment.
 */
export function optionInstrument(instrumentId: string): string | null {
  return REGISTRY.find(e => e.id === instrumentId)?.options.instrument ?? null;
}

/**
 * The instrument type of the UNDERLYING itself - INDEX or EQUITY, and FUTCOM for MCX, whose
 * options hang off a futures contract rather than a spot index (SPIKE-01).
 */
export function underlyingInstrument(instrumentId: string): string | null {
  const e = REGISTRY.find(x => x.id === instrumentId);
  if (!e) return null;
  return e.assert?.instrument ?? (e.underlyingSeg === 'MCX_COMM' ? 'FUTCOM' : null);
}

/** Every live option contract for one instrument and expiry, with the segment to subscribe on. */
export function optionContracts(instrumentId: string, expiry: string): OptionContract[] {
  const entry = REGISTRY.find(e => e.id === instrumentId);
  if (!entry) return [];

  // Options trade on the derivative segment, not the underlying's segment.
  const seg: Seg =
    entry.options.exchId === 'BSE' ? 'BSE_FNO'
    : entry.options.exchId === 'MCX' ? 'MCX_COMM'
    : 'NSE_FNO';

  return cachedRows
    .filter(r =>
      r.exchId === entry.options.exchId &&
      r.instrument === entry.options.instrument &&
      r.underlyingSymbol === entry.options.underlyingSymbol &&
      r.expiry === expiry &&
      (r.optionType === 'CE' || r.optionType === 'PE') &&
      r.strike !== null && r.securityId > 0)
    .map(r => ({
      strike: r.strike!, optionType: r.optionType as 'CE' | 'PE',
      securityId: r.securityId, seg, lotSize: r.lotSize ?? null,
    }));
}

/* ------------------------------------------------------- F&O stock universe (P8) */

/**
 * One scannable NSE F&O stock: the cash leg the % change is measured on, and the near-month
 * futures leg the open interest is measured on. Equities carry no OI, which is the whole
 * reason the futures leg exists.
 */
export type FnoStock = {
  symbol: string;
  name: string;
  /** NSE_EQ security id of the share itself. */
  equityId: number;
  /** NSE_FNO security id of the near-month FUTSTK contract. */
  futureId: number | null;
  futureExpiry: string | null;
  lot: number | null;
  /** Non-null means this stock cannot be scored. Never silently dropped - scanner-v1 row 14. */
  problem: string | null;
};

const fnoUniverseCache = new Map<string, FnoStock[]>();

/**
 * The NSE F&O stock universe, from the master rather than a hardcoded list.
 *
 * Verified 2026-08-28 and again 2026-09-01 against the real master: the OPTSTK and FUTSTK
 * underlying lists are identical once the 18 dummy NSETEST scrips are dropped, and the count is
 * exactly 210. `scanner-v1.md` row 2 locks OPTSTK as the source of truth.
 */
export function fnoUniverse(today = todayIso()): FnoStock[] {
  const hit = fnoUniverseCache.get(today);
  if (hit) return hit;

  const live = (r: MasterRow) => r.expiry !== null && r.expiry >= today;
  const real = (r: MasterRow) => r.exchId === 'NSE' && !r.underlyingSymbol.includes('NSETEST');

  const symbols = [...new Set(
    cachedRows.filter(r => r.instrument === 'OPTSTK' && real(r) && live(r)).map(r => r.underlyingSymbol),
  )].sort();

  // The cash row must be the SHARE. CHOLAFIN and MOTHERSON each also list an NCD under the same
  // symbol as instrument EQUITY, and quoting a debenture's price as the stock's would be exactly
  // the kind of silently-wrong number this project refuses.
  const equity = new Map<string, MasterRow>();
  for (const r of cachedRows) {
    if (r.instrument === 'EQUITY' && r.exchId === 'NSE' && r.series === 'EQ') equity.set(r.underlyingSymbol, r);
  }

  // Near month = the earliest FUTSTK expiry that has not passed. Stock futures roll monthly, so
  // this is re-read every day rather than frozen.
  const future = new Map<string, MasterRow>();
  for (const r of cachedRows) {
    if (r.instrument !== 'FUTSTK' || !real(r) || !live(r)) continue;
    const prev = future.get(r.underlyingSymbol);
    if (!prev || r.expiry! < prev.expiry!) future.set(r.underlyingSymbol, r);
  }

  const out = symbols.map<FnoStock>(symbol => {
    const eq = equity.get(symbol);
    const fut = future.get(symbol);
    const problems: string[] = [];
    if (!eq) problems.push('no NSE EQ-series cash row');
    if (!fut) problems.push('no near-month future');
    return {
      symbol,
      name: eq?.displayName || fut?.displayName || symbol,
      equityId: eq?.securityId ?? 0,
      futureId: fut?.securityId ?? null,
      futureExpiry: fut?.expiry ?? null,
      lot: fut?.lotSize ?? null,
      problem: problems.length ? problems.join('; ') : null,
    };
  });

  fnoUniverseCache.set(today, out);
  return out;
}

export type Registry = {
  instruments: ResolvedInstrument[];
  meta: MasterMeta;
  allResolved: boolean;
};

export async function resolveRegistry(
  opts: { force?: boolean; creds?: Credentials | null } = {},
): Promise<Registry> {
  const { rows, meta } = await loadMaster(opts);
  cachedRows = rows;
  const today = todayIso();

  let gold = await readGoldResolution();
  let goldTried: string[] = [];
  // Nothing cached and we have credentials: prove the value now so the GOLD chip just works.
  if (!gold && opts.creds && !isReplay()) {
    const out = await autoResolveGold(rows, opts.creds, today);
    gold = out.resolution;
    goldTried = out.tried;
  }

  const instruments = REGISTRY.map<ResolvedInstrument>(entry => {
    const notes: string[] = [];
    const problems: string[] = [];

    // Startup assertion: the hardcoded underlying id must still exist in today's master.
    if (entry.assert) {
      const hit = rows.find(r =>
        r.exchId === entry.assert!.exchId &&
        r.instrument === entry.assert!.instrument &&
        r.underlyingSymbol === entry.assert!.underlyingSymbol);
      if (!hit) problems.push(`master has no ${entry.assert.instrument} row for ${entry.assert.underlyingSymbol}`);
      else if (hit.securityId !== entry.underlyingScrip) {
        problems.push(`master says securityId ${hit.securityId}, registry says ${entry.underlyingScrip}`);
      }
    }

    const contracts = rows.filter(r =>
      r.exchId === entry.options.exchId &&
      r.instrument === entry.options.instrument &&
      r.underlyingSymbol === entry.options.underlyingSymbol &&
      r.expiry && r.expiry >= today);

    const expiries = [...new Set(contracts.map(c => c.expiry!))].sort();
    const nearestExpiry = expiries[0] ?? null;
    // Lot size is per expiry; take it from the nearest expiry's contracts, never a constant.
    const lot = nearestExpiry
      ? (contracts.find(c => c.expiry === nearestExpiry)?.lotSize ?? null)
      : null;

    let underlyingScrip = entry.underlyingScrip;
    let scripCandidates: ResolvedInstrument['scripCandidates'];

    if (entry.id === 'GOLD') {
      if (gold?.via.includes('FUTCOM')) {
        // The underlying is a futures contract, and gold futures roll. Re-read the
        // near-month contract every boot rather than reusing the id the spike froze.
        const fut = nearMonthGoldFuture(rows, today);
        underlyingScrip = fut?.securityId ?? gold.underlyingScrip;
        if (!fut) problems.push('no live GOLD futures contract in the master');
        else notes.push(`underlying is the near-month future ${fut.displayName} (exp ${fut.expiry}), re-resolved daily`);
      } else if (gold) {
        underlyingScrip = gold.underlyingScrip;
        notes.push(`SPIKE-01 resolved via ${gold.via} on ${gold.confirmedAt}`);
      } else {
        const fut = nearMonthGoldFuture(rows, today);
        scripCandidates = [];
        if (fut) scripCandidates.push({ value: fut.securityId, why: `near-month FUTCOM ${fut.displayName} exp ${fut.expiry}` });
        const tok = contracts[0]?.underlyingSecurityId;
        if (tok && Number(tok) > 0) scripCandidates.push({ value: Number(tok), why: 'UNDERLYING_SECURITY_ID on GOLD OPTFUT rows' });
        // In replay the chain is synthetic, so an unresolved live scrip does not block the chip.
        if (isReplay()) {
          underlyingScrip = scripCandidates[0]?.value ?? 0;
          notes.push('SPIKE-01 pending; replay mode uses a synthetic chain');
        } else {
          problems.push(goldTried.length
          ? `Dhan rejected every GOLD underlying candidate: ${goldTried.join('; ')}`
          : 'GOLD underlying unresolved: no valid Dhan credentials in .env');
        }
      }
    }

    if (contracts.length === 0) problems.push('no live option contracts found in master');
    if (lot === null) problems.push('lot size could not be read from the master');

    return {
      id: entry.id,
      label: entry.label,
      displayName: entry.displayName,
      underlyingScrip,
      underlyingSeg: entry.underlyingSeg,
      lot,
      nearestExpiry,
      expiries: expiries.slice(0, 12),
      optionContracts: contracts.length,
      session: sessionState(entry.session),
      resolved: underlyingScrip !== null && problems.length === 0,
      problems,
      notes,
      ...(scripCandidates ? { scripCandidates } : {}),
    };
  });

  return { instruments, meta, allResolved: instruments.every(i => i.resolved) };
}
