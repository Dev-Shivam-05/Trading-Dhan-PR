/**
 * Pure readers for the P12 live probe. No network, no clock, no credentials - so every verdict
 * below can be exercised against replay payloads and deliberately broken ones before a live plan
 * exists, and the first live run only has to be run, not debugged.
 *
 * Where the question is "will the app accept this body", the app's own reader is used
 * (`shapeError`). Where the question is "is the app's number right" (peak, closing OI, previous
 * session), the answer is re-derived here WITHOUT the app's reader - IST dates through Intl instead
 * of the +05:30 arithmetic in peakoi.ts - because a check built from the code it checks is
 * decoration.
 */

import { shapeError } from '../src/server/candles.ts';
import { peakFrom, closingOiOn, previousSessionIn, type Candles } from '../src/server/peakoi.ts';

export type Verdict = 'PASS' | 'FAIL' | 'CHECK';
export type Line = { verdict: Verdict; label: string; detail: string };

const ARRAYS = ['open', 'high', 'low', 'close', 'volume', 'timestamp', 'open_interest'] as const;

const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});
const IST_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** Digit count, not a magnitude threshold, so this disagrees with istParts() if either is wrong. */
function epochMs(ts: number): number { return String(Math.trunc(ts)).length >= 13 ? ts : ts * 1000; }
function istDate(ts: number): string { return IST_DATE.format(new Date(epochMs(ts))); }
function istStamp(ts: number): string { return `${istDate(ts)} ${IST_TIME.format(new Date(epochMs(ts)))}`; }

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function num(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }
function pct(n: number, d: number): string { return d ? `${((n / d) * 100).toFixed(1)}%` : '-'; }

/* ----------------------------------------------------------- /v2/charts/intraday */

export type IntradayReport = {
  lines: Line[];
  candles: Candles | null;
  oiUnit: 'units' | 'contracts' | 'unclear';
};

export function intradayReport(
  raw: unknown, ctx: { lot: number | null; chainOi: number | null; today: string },
): IntradayReport {
  const lines: Line[] = [];
  const add = (verdict: Verdict, label: string, detail: string) => lines.push({ verdict, label, detail });

  // The app's reader (fetchIntraday) accepts the arrays at the top level or under `data`.
  let body: Record<string, unknown> | null = null;
  if (isObj(raw) && Array.isArray(raw.timestamp)) { body = raw; add('PASS', 'envelope', 'flat - arrays at the top level'); }
  else if (isObj(raw) && isObj(raw.data) && Array.isArray(raw.data.timestamp)) { body = raw.data; add('PASS', 'envelope', 'wrapped in `data`'); }
  else {
    const keys = isObj(raw) ? Object.keys(raw).join(', ') : typeof raw;
    add('FAIL', 'envelope', `no \`timestamp\` array at the top level or under \`data\` - keys: ${keys || '(none)'}`);
    return { lines, candles: null, oiUnit: 'unclear' };
  }

  const candles = body as Candles;
  const lens = ARRAYS.map(k => [k, Array.isArray(body![k]) ? (body![k] as unknown[]).length : null] as const);
  const n = candles.timestamp!.length;
  const bad = lens.filter(([, l]) => l !== n);
  add(bad.length ? 'FAIL' : 'PASS', 'arrays',
    bad.length
      ? `timestamp has ${n}; mismatched: ${bad.map(([k, l]) => `${k}=${l ?? 'missing'}`).join(', ')}`
      : `all 7 parallel arrays present, ${n} candles each`);

  const appShape = shapeError(candles);
  add(appShape ? 'FAIL' : 'PASS', 'app reader', appShape ?? 'candles.ts shapeError() accepts this body');

  if (n === 0) {
    add('CHECK', 'candles', 'empty payload - an illiquid contract, or a date range Dhan read differently');
    return { lines, candles, oiUnit: 'unclear' };
  }

  /* ---- timestamps ---- */
  const ts = candles.timestamp!;
  const digits = new Set(ts.map(t => (num(t) ? String(Math.trunc(t)).length : 0)));
  if (digits.size === 1 && digits.has(10)) add('PASS', 'timestamp unit', 'epoch seconds, as documented');
  else if (digits.size === 1 && digits.has(13)) add('CHECK', 'timestamp unit', 'epoch MILLISECONDS - istParts() handles >1e11, but the docs say seconds; record it');
  else add('FAIL', 'timestamp unit', `mixed or non-numeric digit counts: ${[...digits].join(', ')}`);

  let sorted = true;
  for (let i = 1; i < n; i++) if (!(ts[i]! > ts[i - 1]!)) { sorted = false; break; }
  add(sorted ? 'PASS' : 'CHECK', 'order', sorted
    ? `strictly ascending, ${istStamp(ts[0]!)} -> ${istStamp(ts[n - 1]!)} IST`
    : 'not strictly ascending - closingOiOn() already takes the latest timestamp, not the last index');

  const dates = [...new Set(ts.filter(num).map(istDate))].sort();
  add(dates.includes(ctx.today) ? 'PASS' : 'CHECK', 'today in window',
    dates.includes(ctx.today)
      ? `sessions ${dates.join(', ')}`
      : `sessions ${dates.join(', ')} - none dated ${ctx.today}. Normal on a holiday or before 09:15; ` +
        'on a trading day after 09:15 it means toDate is exclusive and P9 renders yesterday as today');

  /* ---- open_interest units ---- */
  const oi = candles.open_interest ?? [];
  const nonzero = oi.filter(v => num(v) && v > 0);
  let oiUnit: IntradayReport['oiUnit'] = 'unclear';
  if (!nonzero.length) {
    add('CHECK', 'OI units', 'no non-zero open_interest - pass `"oi": true`, or pick a liquid contract');
  } else if (!ctx.lot || ctx.lot <= 1) {
    add('CHECK', 'OI units', `lot is ${ctx.lot ?? 'unknown'} - divisibility cannot tell units from contracts`);
  } else {
    const mult = nonzero.filter(v => v % ctx.lot! === 0).length;
    const share = mult / nonzero.length;
    // A value in contracts is a multiple of the lot by chance 1 time in `lot`; a value in units
    // always is. 95% leaves room for a stray print without letting chance pass as a unit.
    if (share >= 0.95) {
      oiUnit = 'units';
      add('PASS', 'OI units', `UNITS - ${mult}/${nonzero.length} values are multiples of lot ${ctx.lot}; candles.ts floor 5 x lot stays`);
    } else if (share <= 0.2) {
      oiUnit = 'contracts';
      add('FAIL', 'OI units', `CONTRACTS - only ${mult}/${nonzero.length} are multiples of lot ${ctx.lot}; option-candles-v1 row 7 floor must become 5, not 5 x lot`);
    } else {
      add('CHECK', 'OI units', `${pct(mult, nonzero.length)} of values are multiples of lot ${ctx.lot} - neither pattern`);
    }
  }

  /* ---- same unit as the chain? P7's Pk % divides one by the other ---- */
  let lastIdx = -1;
  for (let i = 0; i < n; i++) if (num(oi[i]) && num(ts[i]) && (lastIdx < 0 || ts[i]! > ts[lastIdx]!)) lastIdx = i;
  if (ctx.chainOi && ctx.chainOi > 0 && lastIdx >= 0 && oi[lastIdx]! > 0) {
    const ratio = oi[lastIdx]! / ctx.chainOi;
    if (Math.abs(ratio - 1) <= 0.1) {
      add('PASS', 'OI vs chain', `latest candle ${oi[lastIdx]} vs chain ${ctx.chainOi} (x${ratio.toFixed(3)}) - Pk % compares like with like`);
    } else if (ctx.lot && ctx.lot > 1 && Math.abs(ratio * ctx.lot - 1) <= 0.1) {
      add('FAIL', 'OI vs chain', `candle OI = chain OI / lot (x${ratio.toFixed(4)}) - P7's Pk % would read 1/${ctx.lot} of the truth`);
    } else if (ctx.lot && ctx.lot > 1 && Math.abs(ratio / ctx.lot - 1) <= 0.1) {
      add('FAIL', 'OI vs chain', `candle OI = chain OI x lot (x${ratio.toFixed(1)}) - P7's Pk % would read ${ctx.lot}x the truth`);
    } else {
      add('CHECK', 'OI vs chain', `latest candle ${oi[lastIdx]} vs chain ${ctx.chainOi} (x${ratio.toFixed(3)}) - off by more than a lag, but not by a lot`);
    }
  } else {
    add('CHECK', 'OI vs chain', 'no chain OI or no candle OI to compare');
  }

  /* ---- P7 and P8 reductions, re-derived without the app's date code ---- */
  const prev = dates.filter(d => d < ctx.today).pop() ?? null;
  const appPrev = previousSessionIn(candles, ctx.today);
  if (prev !== appPrev) {
    add('FAIL', 'previous session', `hand ${prev ?? 'none'} vs app previousSessionIn() ${appPrev ?? 'none'}`);
  } else if (!prev) {
    add('CHECK', 'previous session', 'no session before today in the window');
  } else {
    add('PASS', 'previous session', `${prev} (hand and app agree)`);

    let hand = -1; let handAt = -1; let closeTs = -1; let handClose: number | null = null;
    for (let i = 0; i < n; i++) {
      if (!num(ts[i]) || istDate(ts[i]!) !== prev || !num(oi[i])) continue;
      if (oi[i]! > hand) { hand = oi[i]!; handAt = ts[i]!; }
      if (ts[i]! > closeTs) { closeTs = ts[i]!; handClose = oi[i]!; }
    }
    const appPeak = peakFrom(candles, prev);
    add(appPeak?.peak === hand ? 'PASS' : 'FAIL', 'P7 peak',
      `hand max ${hand} at ${handAt > 0 ? istStamp(handAt) : '-'} vs app peakFrom() ${appPeak?.peak ?? 'null'} at ${appPeak?.at ?? '-'}`);
    const appClose = closingOiOn(candles, prev);
    add(appClose === handClose ? 'PASS' : 'FAIL', 'P8 closing OI',
      `hand last-candle OI ${handClose ?? 'null'} vs app closingOiOn() ${appClose ?? 'null'}`);
  }

  return { lines, candles, oiUnit };
}

/* ------------------------------------------------------------ /v2/marketfeed/quote */

type Leg = { last_price?: unknown; net_change?: unknown; oi?: unknown; ohlc?: { close?: unknown } };
export type QuoteRequest = { NSE_EQ: number[]; NSE_FNO: number[] };

export function quoteReport(raw: unknown, requested: QuoteRequest): { lines: Line[] } {
  const lines: Line[] = [];
  const add = (verdict: Verdict, label: string, detail: string) => lines.push({ verdict, label, detail });

  // The scanner's reader accepts the segments at the top level or under `data`.
  let body: Record<string, unknown> | null = null;
  if (isObj(raw) && isObj(raw.data) && (isObj(raw.data.NSE_EQ) || isObj(raw.data.NSE_FNO))) { body = raw.data; add('PASS', 'envelope', 'wrapped in `data`, as documented'); }
  else if (isObj(raw) && (isObj(raw.NSE_EQ) || isObj(raw.NSE_FNO))) { body = raw; add('CHECK', 'envelope', 'flat - the scanner accepts it, but the docs show a `data` wrapper'); }
  else {
    const keys = isObj(raw) ? Object.keys(raw).join(', ') : typeof raw;
    add('FAIL', 'envelope', `no NSE_EQ / NSE_FNO object at the top level or under \`data\` - keys: ${keys || '(none)'}`);
    return { lines };
  }

  const legsOf = (seg: keyof QuoteRequest): Leg[] => {
    const map = body![seg];
    const ids = requested[seg];
    if (!isObj(map)) { add('FAIL', `${seg} coverage`, `segment absent - ${ids.length} requested`); return []; }
    const want = new Set(ids.map(String));
    const missing = ids.filter(id => !isObj(map[String(id)]));
    const extra = Object.keys(map).filter(k => !want.has(k));
    const verdict: Verdict = !missing.length && !extra.length ? 'PASS'
      : missing.length <= ids.length * 0.05 && !extra.length ? 'CHECK' : 'FAIL';
    add(verdict, `${seg} coverage`,
      `${ids.length - missing.length}/${ids.length} returned` +
      (missing.length ? `; missing ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' ...' : ''} (scanner lists these as skipped)` : '') +
      (extra.length ? `; ${extra.length} ids NOT requested: ${extra.slice(0, 8).join(', ')}` : ''));
    return ids.map(id => map[String(id)]).filter(isObj) as Leg[];
  };

  /* ---- cash legs: the scanner's % change ---- */
  const eq = legsOf('NSE_EQ');
  if (eq.length) {
    const nLast = eq.filter(l => num(l.last_price)).length;
    const nNet = eq.filter(l => num(l.net_change)).length;
    add(nLast === eq.length && nNet === eq.length ? 'PASS' : 'FAIL', 'NSE_EQ fields',
      `last_price numeric on ${nLast}/${eq.length}, net_change on ${nNet}/${eq.length}`);

    // Scanner row 5: prevClose = last_price - net_change, with ohlc.close as the fallback it
    // claims is "the same number by a different route". This tests both claims at once.
    const cmp = eq.filter(l => num(l.last_price) && num(l.net_change) && num(l.ohlc?.close) && (l.ohlc!.close as number) > 0)
      .map(l => ({ last: l.last_price as number, net: l.net_change as number, close: l.ohlc!.close as number }));
    const moving = cmp.filter(c => Math.abs(c.net) > 0);
    if (moving.length < 10) {
      add('CHECK', 'net_change meaning', `only ${moving.length} legs with a non-zero net_change - too few to tell`);
    } else {
      const abs = moving.filter(c => Math.abs(c.last - c.net - c.close) <= Math.max(0.05, c.close * 0.0005)).length;
      const closeIsLast = moving.filter(c => Math.abs(c.close - c.last) <= 0.005).length;
      const asPct = moving.filter(c => c.close !== c.last && Math.abs(((c.last - c.close) / c.close) * 100 - c.net) <= 0.02).length;
      if (abs >= moving.length * 0.95) {
        add('PASS', 'net_change meaning', `absolute, and ohlc.close is the previous close on ${abs}/${moving.length} - row 5 and its fallback agree`);
      } else if (closeIsLast >= moving.length * 0.95) {
        add('CHECK', 'net_change meaning', `ohlc.close equals last_price on ${closeIsLast}/${moving.length} - close is TODAY's, so the scanner's ohlc.close fallback would score 0.00%`);
      } else if (asPct >= moving.length * 0.95) {
        add('FAIL', 'net_change meaning', `net_change is a PERCENT on ${asPct}/${moving.length} - scanner row 5's prevClose = last_price - net_change is wrong`);
      } else {
        add('CHECK', 'net_change meaning', `absolute ${abs}, close=last ${closeIsLast}, percent ${asPct} of ${moving.length} - no single reading`);
      }
    }
  }

  /* ---- futures legs: the scanner's OI ---- */
  const fno = legsOf('NSE_FNO');
  if (fno.length) {
    const nOi = fno.filter(l => num(l.oi) && l.oi > 0).length;
    add(nOi === fno.length ? 'PASS' : 'CHECK', 'NSE_FNO oi',
      `oi > 0 on ${nOi}/${fno.length}` + (nOi < fno.length ? ' (scanner skips the rest as "no futures open interest")' : ''));
  }

  return { lines };
}
