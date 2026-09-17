/**
 * P12 live probe - run this the first time `npm run check` says READY.
 *
 *     npm run live:probe
 *
 * Why it exists: P7, P8 and P9 were built and verified against synthetic payloads only, because
 * the account had no Data API plan. Their readers encode several guesses about Dhan's responses,
 * and a token lasts about a day. This settles them in one command, saves every raw body to
 * `.cache/live/` so the answers outlive the token, and prints one verdict line per question:
 *
 *   1. `/v2/charts/intraday` - envelope, array shape, timestamp unit, whether `open_interest` is
 *      units or contracts, whether it matches the chain's `oi`, and whether the date-only
 *      `fromDate`/`toDate` the app sends is accepted (Dhan's docs show "YYYY-MM-DD HH:MM:SS")
 *   2. P7's peak and P8's closing OI, re-derived by hand from that same payload
 *   3. `/v2/marketfeed/quote` with the scanner's real 420-instrument body - coverage, and what
 *      `net_change` and `ohlc.close` actually mean
 *
 * Five REST calls, strictly serial (six if the date format has to be retried). The binary feed is
 * `npm run feed:probe`; P8's AC5 still needs the market open.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  readCredentials, dhanPost, explain, fetchExpiryList, fetchOptionChain,
  type Credentials, type DhanCall,
} from '../src/server/dhan.ts';
import {
  resolveRegistry, optionContracts, optionInstrument, fnoUniverse, todayIso,
} from '../src/server/instruments.ts';
import { intradayReport, quoteReport, type Line, type QuoteRequest } from './live-shape.ts';

const OUT_DIR = path.resolve(process.cwd(), '.cache', 'live');
/** Same window as peakoi.ts: a two-day holiday plus a weekend. */
const WINDOW_DAYS = 7;

const today = todayIso();
const all: { section: string; lines: Line[] }[] = [];
const section = (name: string, lines: Line[]) => {
  all.push({ section: name, lines });
  console.log(`\n${name}`);
  for (const l of lines) console.log(`  ${l.verdict.padEnd(5)}  ${l.label.padEnd(20)} ${l.detail}`);
};

/**
 * Ends the run by throwing, never by process.exit(): exiting straight after a fetch trips a libuv
 * assertion on Windows (`!(handle->flags & UV_HANDLE_CLOSING)`) and the exit code becomes a crash
 * code instead of the verdict.
 */
class Stop extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode: number) { super(message); this.exitCode = exitCode; }
}

/** A gate failure is not a shape finding - stop, and say which of the two gates it is. */
function gate(what: string, call: DhanCall<unknown>): never {
  const code = call.error?.code ?? 'UNKNOWN';
  throw new Stop(`NOT READY at ${what} - ${code} ${call.error?.message ?? ''}\n  ${explain(code)}`, 1);
}

async function save(name: string, data: unknown) {
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${today}-${name}.json`);
  await writeFile(file, JSON.stringify(data, null, 2));
  return path.relative(process.cwd(), file);
}

function isoDaysAgo(days: number): string {
  const ms = Date.now() + 5.5 * 3600 * 1000 - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

async function main(creds: Credentials): Promise<number> {
  console.log(`\nP12 live probe - ${today}`);

  /* ---- 0. both gates, before anything is interpreted as a shape ---- */

  const profile = await dhanPost<{ dataPlan?: string }>('/v2/profile', null,
    { creds, key: 'probe:profile', cadenceMs: 0, method: 'GET' });
  if (!profile.ok) gate('profile', profile);
  console.log(`  profile ok, dataPlan: ${profile.data?.dataPlan ?? '(not reported)'}`);

  // No creds: with them, an unresolved GOLD chip would spend calls this probe does not report.
  const registry = await resolveRegistry({});
  const nifty = registry.instruments.find(i => i.id === 'NIFTY');
  if (!nifty || nifty.underlyingScrip === null) throw new Stop('NIFTY did not resolve from the instrument master.', 2);

  const expiries = await fetchExpiryList(creds, nifty.underlyingScrip, nifty.underlyingSeg);
  if (!expiries.ok) gate('expiry list', expiries);
  const expiry = expiries.data?.data?.[0];
  if (!expiry) throw new Stop('expiry list is empty.', 1);

  /* ---- 1. the chain gives the contract, and the OI the candles must agree with ---- */

  const chain = await fetchOptionChain(creds, nifty.underlyingScrip, nifty.underlyingSeg, expiry);
  if (!chain.ok) gate('option chain', chain);
  const spot = chain.data!.data.last_price;
  const strikeKeys = Object.keys(chain.data!.data.oc);
  if (!strikeKeys.length) throw new Stop(`the ${expiry} chain has no strikes.`, 1);
  const atmKey = strikeKeys.reduce((a, b) => Math.abs(Number(b) - spot) < Math.abs(Number(a) - spot) ? b : a);
  const atm = Number(atmKey);
  const leg = chain.data!.data.oc[atmKey]?.ce;
  const contract = optionContracts('NIFTY', expiry).find(c => c.strike === atm && c.optionType === 'CE');

  if (!leg || !contract) {
    section('chain', [{ verdict: 'FAIL', label: 'ATM contract',
      detail: `NIFTY ${expiry} ${atm} CE: chain leg ${leg ? 'present' : 'missing'}, master row ${contract ? 'present' : 'missing'}` }]);
    throw new Stop('no ATM contract to probe.', 1);
  }
  section('chain', [{
    verdict: leg.security_id === contract.securityId ? 'PASS' : 'FAIL', label: 'security_id',
    detail: `NIFTY ${expiry} ${atm} CE (spot ${spot}): chain ${leg.security_id ?? 'absent'} vs master ${contract.securityId}`,
  }]);

  /* ---- 2. intraday, exactly as fetchIntraday() sends it; the documented format only on DH-905 ---- */

  const from = isoDaysAgo(WINDOW_DAYS);
  const intradayBody = (fromDate: string, toDate: string) => ({
    securityId: String(contract.securityId), exchangeSegment: contract.seg,
    instrument: optionInstrument('NIFTY'), interval: '1', oi: true, fromDate, toDate,
  });

  const intraLines: Line[] = [];
  let intraday = await dhanPost<unknown>('/v2/charts/intraday', intradayBody(from, today),
    { creds, key: 'probe:intraday', cadenceMs: 1000, timeoutMs: 20_000 });
  if (intraday.ok) {
    intraLines.push({ verdict: 'PASS', label: 'date format', detail: `date-only "${from}" / "${today}" accepted, as peakoi.ts sends it` });
  } else if (intraday.error?.code === 'DH-905') {
    // The whole-day bounds only discriminate between the two formats; they are not a value the app uses.
    intraday = await dhanPost<unknown>('/v2/charts/intraday', intradayBody(`${from} 00:00:00`, `${today} 23:59:59`),
      { creds, key: 'probe:intraday', cadenceMs: 1000, timeoutMs: 20_000 });
    if (!intraday.ok) gate('intraday (both date formats)', intraday);
    intraLines.push({ verdict: 'FAIL', label: 'date format',
      detail: 'date-only REJECTED (DH-905), "YYYY-MM-DD HH:MM:SS" accepted - fetchIntraday() must send the documented format, or P7, P8 and P9 all fail live' });
  } else {
    gate('intraday', intraday);
  }
  const intraFile = await save('intraday-raw', intraday.data);
  const intra = intradayReport(intraday.data, { lot: contract.lotSize, chainOi: leg.oi, today });
  section(`intraday  (${intraFile}, ${intraday.bytes} bytes, ${intraday.timing.roundTrip} ms)`, [...intraLines, ...intra.lines]);

  /* ---- 3. the scanner's real quote body ---- */

  const quotable = fnoUniverse(today).filter(s => !s.problem && s.futureId && s.equityId);
  const quoteBody: QuoteRequest = {
    NSE_EQ: quotable.map(s => s.equityId),
    NSE_FNO: quotable.map(s => s.futureId!),
  };
  const quote = await dhanPost<unknown>('/v2/marketfeed/quote', quoteBody,
    { creds, key: 'probe:quote', cadenceMs: 1000, timeoutMs: 20_000 });
  if (!quote.ok) gate(`quote (${quoteBody.NSE_EQ.length + quoteBody.NSE_FNO.length} instruments)`, quote);
  const quoteFile = await save('quote-raw', quote.data);
  section(`quote  (${quoteBody.NSE_EQ.length} + ${quoteBody.NSE_FNO.length} instruments, ${quoteFile}, ${quote.bytes} bytes, ${quote.timing.roundTrip} ms)`,
    quoteReport(quote.data, quoteBody).lines);

  /* ---- verdict ---- */

  const flat = all.flatMap(s => s.lines);
  const count = (v: Line['verdict']) => flat.filter(l => l.verdict === v).length;
  await save('verdict', {
    at: new Date().toISOString(), expiry, atm, securityId: contract.securityId, lot: contract.lotSize,
    oiUnit: intra.oiUnit, sections: all,
  });
  console.log(`\n  ${count('PASS')} pass, ${count('CHECK')} to read, ${count('FAIL')} fail - oiUnit: ${intra.oiUnit}`);
  console.log('  next: npm run feed:probe, then npm run dev live for the P7/P8/P9 screens; AC5 needs 09:15-15:30 IST\n');
  return count('FAIL') ? 1 : 0;
}

const creds = readCredentials();
if (!creds) {
  console.error('\n  .env has no credentials. Fill it and run npm run check first.\n');
  process.exitCode = 2;
} else {
  try {
    process.exitCode = await main(creds);
  } catch (err) {
    if (!(err instanceof Stop)) throw err;
    console.log(`\n  ${err.message}\n`);
    process.exitCode = err.exitCode;
  }
}
