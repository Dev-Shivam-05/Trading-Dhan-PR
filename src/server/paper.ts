/**
 * P32 — auto paper-trading from the front page. `docs/spec/paper-trading-v1.md`.
 * P33 — its entry and exit replaced by the opening-range breakout and the 9 SMA exit.
 *       `docs/spec/orb-strategy-v1.md`. Where the two specs disagree, P33 wins.
 *
 * PAPER MEANS PAPER. Nothing in this file places, modifies or cancels a real order, and it imports
 * nothing from `dhan.ts` (spec row 1, AC1 greps for it). A fill is this process writing a number
 * into a JSON file: the LTP of a feed tick the app's own WebSocket carries for that contract.
 *
 * Two halves:
 *  - the RULES are pure functions of (ledger, event, nowMs). No `Date.now()` in them — spec row 14.
 *    Almost every session on this project is outside 09:15-15:30, and a rule that reads the wall
 *    clock has a criterion nobody can run (CLAUDE.md: "now is an argument, not a clock").
 *  - `PaperTrader` is the I/O shell: the 1 s timer, the ledger file, the feed subscriptions and the
 *    candle fetches. Candles come in through an injected function, so this file still never talks
 *    to Dhan itself.
 *
 * Everything the strategy decides is a named constant below, and every one of them is a spec row.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './paths.ts';
import { isReplay } from './replay.ts';
import { nseDate } from './nse.ts';
import type { NseScanResult } from './scanner-nse.ts';
import type { Subscription, Tick } from './feed.ts';

/* ------------------------------------------------------------ spec values */

/** P32 row 3: the scan fires at 09:20 IST and is retried until 09:30 (P33 amendment 14). */
export const SCAN_AT_MIN = 9 * 60 + 20;
export const SCAN_UNTIL_MIN = 9 * 60 + 30;
/** P32 row 3: NSE's prices must be stamped today at or after the 09:15 open. */
export const FRESH_FROM_MIN = 9 * 60 + 15;
/** P32 row 3 (GUESS): a failed or stale scan is retried this often. P33 amendment 15 reuses it
 *  for a failed candle fetch. */
export const RETRY_MS = 60_000;
/** P32 row 5 (GUESS): signals taken per day, highest |chg%| first. Option legs do not count. */
export const MAX_POSITIONS = 10;
/** P33 row 3: the range is the 09:15 and 09:20 five-minute candles, known once 09:25 has passed. */
export const CANDLE_MS = 5 * 60_000;
export const RANGE_FROM_MIN = 9 * 60 + 15;
export const RANGE_READY_MIN = 9 * 60 + 25;
/** P33 rows 3, 7: candles are fetched this long after a 5-minute boundary. */
export const FETCH_LAG_MS = 5_000;
/** P33 row 5 (GUESS): no break by 15:00 → not taken. */
export const ENTRY_UNTIL_MIN = 15 * 60;
/** P33 rows 7-9: two consecutive completed closes on the wrong side of the 9-period SMA. */
export const SMA_PERIOD = 9;
export const EXIT_CLOSES = 2;
/** P32 row 8 (GUESS): intraday square-off. */
export const SQUARE_OFF_MIN = 15 * 60 + 15;
/** P33 amendment 18: replay's synthetic option walk starts at this fraction of the future. */
export const REPLAY_OPTION_BASE = 0.02;

/**
 * P36 rows 1-2 (sleep-proof-v1.md): two of the shell's 1 s steps more than this far apart, or a
 * ledger loaded with an `aliveAt` this old, means the process was blind. GUESS derived from row 1:
 * the repricing source is a 1-minute candle, so a shorter gap cannot be priced better than the
 * live tick, and is left to the live rules.
 */
export const GAP_MS = 60_000;
export const MINUTE_MS = 60_000;
/** P36 row 3: the keep-awake window. */
export const AWAKE_FROM_MIN = 9 * 60 + 10;
export const AWAKE_UNTIL_MIN = 15 * 60 + 35;

const IST_MS = 5.5 * 3600_000;

/* ------------------------------------------------------------------ types */

export type Dir = 'BUY' | 'SELL';
/** `target` / `stop` survive only in P32 ledgers written before P33. */
export type ExitReason = 'sma' | 'eod' | 'manual' | 'stale' | 'target' | 'stop';
export type Leg = 'future' | 'option';

/** P36: a stretch of engine time in which the process saw nothing — asleep, or not running. */
export type Gap = { from: number; to: number };
/**
 * P36 rows 1-2: an open leg that was open through a gap. Ticks and the 15:15 rule leave it alone
 * until the catch-up has decided what came due while blind (`dueAt`) and priced it from candles.
 */
export type Awaiting = { from: number; to: number; dueAt: number | null; reason: 'sma' | 'eod' | null };

/** What the instrument master says about one F&O stock. Injected, so this file never reads it. */
export type Contract = {
  symbol: string;
  name: string;
  futureId: number | null;
  futureExpiry: string | null;
  lot: number | null;
  problem: string | null;
};
export type Lookup = (symbol: string) => Contract | undefined;

/** One stock option contract (P33 row 6). Injected, as `Contract` is. */
export type OptionPick = { strike: number; optionType: 'CE' | 'PE'; securityId: number; lot: number | null; expiry: string };
export type OptionsFor = (symbol: string) => OptionPick[];

/** A 5-minute candle. `t` is the candle's OPEN time, epoch ms. */
export type Bar = { t: number; o: number; h: number; l: number; c: number };

export type Position = {
  /** Future: `${date}-${symbol}`. Option: `${date}-${symbol}-CE|PE`. */
  id: string;
  date: string;
  symbol: string;
  name: string;
  /** The SIGNAL's direction. An option leg is always bought, so its own P&L uses `BUY`. */
  side: Dir;
  /** Missing on P32 ledgers: read as 'future'. */
  leg?: Leg;
  parentId?: string | null;
  optionType?: 'CE' | 'PE' | null;
  strike?: number | null;
  seg: 'NSE_FNO';
  securityId: number;
  expiry: string;
  lot: number;
  qty: number;
  /** What the scan saw. `cashLtp` is the SHARE's price — never the fill. */
  signal: { chgPct: number; oiPct: number; cashLtp: number };
  status: 'pending' | 'open' | 'closed' | 'unfilled';
  createdAt: number;
  /** P33 row 3. Null until the 09:15 and 09:20 candles have been read. */
  range?: { high: number; low: number } | null;
  /** Why there is no range yet, in words. Cleared once there is one. */
  rangeNote?: string | null;
  /** P33 row 9, as of the last completed candle evaluated. Display only; rules use the exact mean. */
  sma9?: number | null;
  /** P33 rows 7/8: consecutive completed closes on the wrong side of SMA9. */
  against?: number;
  /** Open time of the last completed candle the exit rule has seen. */
  lastBarT?: number | null;
  /** P33 row 7: the exit is decided; the leg closes at its next tick. */
  exitDue?: boolean;
  entryPx: number | null;
  entryAt: number | null;
  /** P32 only. Always null on a P33 position. */
  stopPx: number | null;
  targetPx: number | null;
  ltp: number | null;
  ltpAt: number | null;
  exitPx: number | null;
  exitAt: number | null;
  reason: ExitReason | null;
  /** Realised, gross, rupees, to the paisa. Null until closed. */
  pnl: number | null;
  /** P32 row 13: closed at boot because it was still open from an earlier date. */
  stale: boolean;
  note: string | null;
  /** P36 rows 1-2. Set while blind-time exits are being worked out; null otherwise. */
  awaiting?: Awaiting | null;
  /** P36 row 1: the exit price came from Dhan's 1-minute candle, not a live tick. */
  repriced?: boolean;
};

export type NotTaken = { symbol: string; side: Dir; reason: string };

export type Day = {
  date: string;
  status: 'waiting' | 'scanning' | 'done' | 'no-trades';
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  scannedAt: number | null;
  priceAsOf: string | null;
  signals: number;
  notTaken: NotTaken[];
  funnel: NseScanResult['funnel'] | null;
  note: string | null;
  /** P40 row 2: which once-a-day phone messages have gone out, so a restart does not repeat them. */
  pushed?: { digest?: boolean; summary?: boolean };
};

export type Ledger = {
  version: 1;
  mode: 'live' | 'replay';
  armed: boolean;
  armedAt: number | null;
  /**
   * Replay's engine clock = wall clock + this. Run now sets it so the press lands on 09:25:00 IST
   * (P33 amendment 17). Always 0 live. Persisted, so a restart does not jump the clock.
   */
  clockOffsetMs: number;
  /** P36: engine time of the last ledger write. A restart measures its blind gap from here. */
  aliveAt?: number | null;
  days: Record<string, Day>;
  positions: Position[];
};

export function emptyLedger(mode: 'live' | 'replay'): Ledger {
  return { version: 1, mode, armed: false, armedAt: null, clockOffsetMs: 0, days: {}, positions: [] };
}

const legOf = (p: Position): Leg => p.leg ?? 'future';

/* ------------------------------------------------------------- the clock */

export function ist(nowMs: number) {
  const d = new Date(nowMs + IST_MS);
  return {
    date: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    hms: d.toISOString().slice(11, 19),
    weekday: d.getUTCDay(),
  };
}

/** Epoch ms of `hh:mm` IST on the IST date of `nowMs`. */
export function istAt(nowMs: number, minutes: number): number {
  const { date } = ist(nowMs);
  return Date.parse(`${date}T00:00:00Z`) - IST_MS + minutes * 60_000;
}

/** Open time of the 5-minute candle containing `ms`. IST is UTC+05:30, so the grids coincide. */
export const barOpen = (ms: number) => Math.floor(ms / CANDLE_MS) * CANDLE_MS;

const tradingWeekday = (nowMs: number) => { const w = ist(nowMs).weekday; return w >= 1 && w <= 5; };

/* ---------------------------------------------------------- the arithmetic */

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Gross rupees, to the paisa. A SELL gains when the price falls. */
export function pnlOf(side: Dir, entry: number, exit: number, qty: number): number {
  return r2((exit - entry) * qty * (side === 'BUY' ? 1 : -1));
}

/** The direction a leg's own P&L runs in: an option leg is always a bought option. */
const pnlSide = (p: Position): Dir => (legOf(p) === 'option' ? 'BUY' : p.side);

function close(p: Position, px: number, at: number, reason: ExitReason) {
  p.awaiting = null;
  p.status = 'closed';
  p.exitPx = px;
  p.exitAt = at;
  p.reason = reason;
  p.pnl = pnlOf(pnlSide(p), p.entryPx!, px, p.qty);
}

/**
 * P33 row 3. The high and low of the 09:15 and 09:20 candles on `date`. Both candles must be
 * present — one candle is not "the first two", and a range from it would be a different rule.
 */
export function openingRange(bars: Bar[], date: string): { high: number; low: number } | { error: string } {
  const want = [RANGE_FROM_MIN, RANGE_FROM_MIN + 5];
  const found = want.map(m => bars.find(b => ist(b.t).date === date && ist(b.t).minutes === m));
  const missing = want.filter((_, i) => !found[i]).map(m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  if (missing.length) return { error: `no ${missing.join(' / ')} candle for ${date} yet` };
  return { high: Math.max(found[0]!.h, found[1]!.h), low: Math.min(found[0]!.l, found[1]!.l) };
}

/** P33 row 9: the mean of the `SMA_PERIOD` completed closes ending at index `i`. Null if fewer. */
export function smaAt(completed: Bar[], i: number): number | null {
  if (i + 1 < SMA_PERIOD) return null;
  let s = 0;
  for (let k = i - SMA_PERIOD + 1; k <= i; k++) s += completed[k]!.c;
  return s / SMA_PERIOD;
}

/**
 * P33 row 6: the option nearest the future's price. CE for a long, PE for a short. A tie between
 * two strikes goes to the LOWER one (amendment 16).
 */
export function nearestOption(list: OptionPick[], px: number, type: 'CE' | 'PE'): OptionPick | null {
  let best: OptionPick | null = null;
  for (const o of list) {
    if (o.optionType !== type) continue;
    if (!best) { best = o; continue; }
    const d = Math.abs(o.strike - px), bd = Math.abs(best.strike - px);
    if (d < bd || (d === bd && o.strike < best.strike)) best = o;
  }
  return best;
}

/* ------------------------------------------------------------ freshness */

/** NSE stamps its feed `17-Sep-2026 16:00:28`. P32 row 3: must be today, at or after 09:15. */
export function freshness(priceAsOf: string, nowMs: number): string | null {
  const date = nseDate(priceAsOf);
  const m = /\b(\d{2}):(\d{2})(?::\d{2})?\s*$/.exec(priceAsOf.trim());
  const today = ist(nowMs).date;
  if (!date || !m) return `NSE's price feed has no readable timestamp (${priceAsOf || 'empty'})`;
  if (date !== today) return `NSE's prices are dated ${date}, not today (${today}) — a holiday, or the feed has not rolled`;
  if (Number(m[1]) * 60 + Number(m[2]) < FRESH_FROM_MIN) return `NSE's prices are stamped ${priceAsOf}, before the 09:15 open`;
  return null;
}

/* ------------------------------------------------------------ the rules */

function dayOf(l: Ledger, date: string): Day {
  return (l.days[date] ??= {
    date, status: 'waiting', attempts: 0, lastAttemptAt: null, lastError: null, scannedAt: null,
    priceAsOf: null, signals: 0, notTaken: [], funnel: null, note: null,
  });
}

/**
 * P32 rows 2, 4, 5, 9. Turns one scan into pending futures. Long -> BUY, Short -> SELL, both lists
 * merged and ranked by |chg%| so the cap keeps the strongest moves whichever side they are on.
 */
export function planEntries(l: Ledger, scan: NseScanResult, lookup: Lookup, nowMs: number): { added: Position[]; notTaken: NotTaken[] } {
  const date = ist(nowMs).date;
  const signals = [
    ...scan.long.map(r => ({ r, side: 'BUY' as Dir })),
    ...scan.short.map(r => ({ r, side: 'SELL' as Dir })),
  ].sort((a, b) => Math.abs(b.r.chgPct) - Math.abs(a.r.chgPct) || a.r.symbol.localeCompare(b.r.symbol));

  const today = l.positions.filter(p => p.date === date && legOf(p) === 'future');
  let count = today.length;
  const added: Position[] = [];
  const notTaken: NotTaken[] = [];

  for (const { r, side } of signals) {
    if (today.some(p => p.symbol === r.symbol) || added.some(p => p.symbol === r.symbol)) {
      notTaken.push({ symbol: r.symbol, side, reason: 'already traded today' });
      continue;
    }
    const c = lookup(r.symbol);
    if (!c || c.problem || c.futureId === null || c.lot === null || !c.futureExpiry) {
      notTaken.push({ symbol: r.symbol, side, reason: c?.problem ?? 'no near-month future in the instrument master' });
      continue;
    }
    if (count >= MAX_POSITIONS) {
      notTaken.push({ symbol: r.symbol, side, reason: 'cap' });
      continue;
    }
    count++;
    added.push({
      id: `${date}-${r.symbol}`, date, symbol: r.symbol, name: c.name, side,
      leg: 'future', parentId: null, optionType: null, strike: null,
      seg: 'NSE_FNO', securityId: c.futureId, expiry: c.futureExpiry, lot: c.lot, qty: c.lot,
      signal: { chgPct: r.chgPct, oiPct: r.oiPct, cashLtp: r.ltp },
      status: 'pending', createdAt: nowMs,
      range: null, rangeNote: null, sma9: null, against: 0, lastBarT: null, exitDue: false,
      entryPx: null, entryAt: null, stopPx: null, targetPx: null, ltp: null, ltpAt: null,
      exitPx: null, exitAt: null, reason: null, pnl: null, stale: false, note: null,
    });
  }
  return { added, notTaken };
}

/**
 * Applies one scan result to the day. `checkFresh` is false only for replay's Run now (P32
 * amendment 23): the committed fixture is dated 17-Sep and would always be refused.
 */
export function applyScan(
  l: Ledger, scan: NseScanResult, lookup: Lookup, nowMs: number, checkFresh: boolean,
): { ok: true; added: Position[] } | { ok: false; reason: string } {
  const day = dayOf(l, ist(nowMs).date);
  day.attempts++;
  day.lastAttemptAt = nowMs;
  const reason = scan.error ?? (checkFresh ? freshness(scan.market.priceAsOf, nowMs) : null);
  if (reason) {
    day.status = 'waiting';
    day.lastError = reason;
    return { ok: false, reason };
  }
  const { added, notTaken } = planEntries(l, scan, lookup, nowMs);
  l.positions.push(...added);
  day.status = 'done';
  day.lastError = null;
  day.scannedAt = nowMs;
  day.priceAsOf = scan.market.priceAsOf;
  day.signals = scan.long.length + scan.short.length;
  day.notTaken = notTaken;
  day.funnel = scan.funnel;
  return { ok: true, added };
}

/** P32 row 3: is a timer scan due now? */
export function scanDue(l: Ledger, nowMs: number): boolean {
  if (!l.armed || !tradingWeekday(nowMs)) return false;
  const { date, minutes } = ist(nowMs);
  if (minutes < SCAN_AT_MIN || minutes >= SCAN_UNTIL_MIN) return false;
  const d = l.days[date];
  if (!d) return true;
  if (d.status !== 'waiting') return false;
  return d.lastAttemptAt === null || nowMs - d.lastAttemptAt >= RETRY_MS;
}

/** Does this future need a candle read now: its range (row 3), or a close for the exit (row 7)? */
export function candlesDue(p: Position, nowMs: number): 'range' | 'exit' | null {
  if (legOf(p) !== 'future' || p.date !== ist(nowMs).date || p.awaiting) return null;
  const { minutes } = ist(nowMs);
  if (p.status === 'pending' && !p.range) {
    if (minutes >= ENTRY_UNTIL_MIN) return null;
    return nowMs >= istAt(nowMs, RANGE_READY_MIN) + FETCH_LAG_MS ? 'range' : null;
  }
  if (p.status === 'open' && !p.exitDue && minutes < SQUARE_OFF_MIN) {
    // The newest candle that has COMPLETED: its open is one period before the latest boundary.
    const lastDone = barOpen(nowMs - FETCH_LAG_MS) - CANDLE_MS;
    return (p.lastBarT ?? -Infinity) < lastDone && lastDone >= barOpen(p.entryAt!) ? 'exit' : null;
  }
  return null;
}

/**
 * P33 rows 3, 7-9. Applies one candle payload to one future. Sets the range on a pending future;
 * on an open one walks every newly COMPLETED candle from the entry candle on, and marks the exit
 * due on the second consecutive close against SMA9. Returns true if anything changed.
 *
 * "Completed" is decided by time (`t + 5 min <= now`), never by position: Dhan may or may not send
 * the forming candle, and the rule must not care which (spec risk 3).
 */
export function applyBars(l: Ledger, id: string, bars: Bar[], nowMs: number): boolean {
  const p = l.positions.find(x => x.id === id);
  if (!p || legOf(p) !== 'future') return false;

  if (p.status === 'pending' && !p.range) {
    const r = openingRange(bars, p.date);
    if ('error' in r) { const changed = p.rangeNote !== r.error; p.rangeNote = r.error; return changed; }
    p.range = r;
    p.rangeNote = null;
    return true;
  }

  if (p.status !== 'open' || p.exitDue || p.entryAt === null) return false;
  const completed = bars.filter(b => b.t + CANDLE_MS <= nowMs).sort((a, b) => a.t - b.t);
  const from = barOpen(p.entryAt);
  let changed = false;
  for (let i = 0; i < completed.length; i++) {
    const b = completed[i]!;
    if (b.t < from || (p.lastBarT != null && b.t <= p.lastBarT)) continue;
    const sma = smaAt(completed, i);
    p.lastBarT = b.t;
    changed = true;
    if (sma === null) { p.sma9 = null; p.against = 0; continue; }
    p.sma9 = r2(sma);
    const wrong = p.side === 'BUY' ? b.c < sma : b.c > sma;
    p.against = wrong ? (p.against ?? 0) + 1 : 0;
    if (p.against >= EXIT_CLOSES) {
      p.exitDue = true;
      p.note = `2 closes ${p.side === 'BUY' ? 'below' : 'above'} SMA9 — last ${ist(b.t).hms.slice(0, 5)} close ${b.c} vs ${p.sma9}`;
      for (const c of l.positions) if (c.parentId === p.id && (c.status === 'open' || c.status === 'pending')) c.exitDue = true;
      break;
    }
  }
  return changed;
}

/**
 * One feed tick. A pending future enters on a strict break of its range (P33 rows 4, 5) and opens
 * its option leg (row 6); a pending option fills at its first tick (row 6); an open leg whose exit
 * is due closes at THIS tick (row 7). Returns true when a position changed status.
 */
export function onTick(l: Ledger, securityId: number, ltp: number, nowMs: number, optionsFor: OptionsFor = () => []): boolean {
  if (!(ltp > 0) || !Number.isFinite(ltp)) return false;
  const { date, minutes } = ist(nowMs);
  let changed = false;
  const spawned: Position[] = [];

  for (const p of l.positions) {
    if (p.securityId !== securityId) continue;
    if (p.status === 'pending') {
      if (p.date !== date) continue;   // onClock marks it unfilled
      if (legOf(p) === 'option') {
        const parent = l.positions.find(x => x.id === p.parentId);
        if (parent?.awaiting) continue;   // P36: the future is being priced from candles
        if (!parent || parent.status !== 'open' || parent.exitDue || p.exitDue) {
          p.status = 'unfilled';
          p.note = 'future exited first';   // amendment 19
        } else {
          p.status = 'open';
          p.entryPx = ltp;
          p.entryAt = nowMs;
          p.ltp = ltp;
          p.ltpAt = nowMs;
        }
        changed = true;
        continue;
      }
      p.ltp = ltp;
      p.ltpAt = nowMs;
      if (!p.range || minutes < RANGE_READY_MIN || minutes >= ENTRY_UNTIL_MIN) continue;
      const broke = p.side === 'BUY' ? ltp > p.range.high : ltp < p.range.low;
      if (!broke) continue;
      p.status = 'open';
      p.entryPx = ltp;
      p.entryAt = nowMs;
      p.note = null;
      changed = true;
      const type = p.side === 'BUY' ? 'CE' : 'PE';
      const o = nearestOption(optionsFor(p.symbol), ltp, type);
      if (!o) { p.note = `no ${type} in the instrument master — future leg only`; continue; }
      const lot = o.lot ?? p.lot;
      spawned.push({
        ...p, id: `${p.id}-${type}`, leg: 'option', parentId: p.id, optionType: type, strike: o.strike,
        securityId: o.securityId, expiry: o.expiry, lot, qty: lot,
        status: 'pending', createdAt: nowMs, range: null, rangeNote: null, sma9: null, against: 0,
        lastBarT: null, exitDue: false, entryPx: null, entryAt: null, ltp: null, ltpAt: null, note: null,
      });
    } else if (p.status === 'open') {
      p.ltp = ltp;
      p.ltpAt = nowMs;
      // An open position from an earlier date is onClock's to close as stale, not the tick's.
      if (p.date !== date) continue;
      if (p.exitDue && !p.awaiting) { close(p, ltp, nowMs, 'sma'); changed = true; }
    }
  }
  l.positions.push(...spawned);
  return changed;
}

/**
 * The clock's own rules: no break by 15:00 → unfilled (P33 row 5), 15:15 squares off both legs
 * (P32 row 8), an earlier date's open position is closed as stale (P32 row 13), and a day the scan
 * window passed without a scan gets a sentence saying why (P32 rows 3 and 10).
 */
export function onClock(l: Ledger, nowMs: number): boolean {
  const { date, minutes } = ist(nowMs);
  let changed = false;
  for (const p of l.positions) {
    if (p.status === 'pending') {
      const opt = legOf(p) === 'option';
      const parent = opt ? l.positions.find(x => x.id === p.parentId) : undefined;
      if (opt && (p.date < date || minutes >= SQUARE_OFF_MIN || !parent || parent.status !== 'open')) {
        p.status = 'unfilled';
        p.note = parent && parent.status !== 'open' ? 'future exited first' : 'no tick before 15:15';
        changed = true;
      } else if (!opt && (p.date < date || minutes >= ENTRY_UNTIL_MIN)) {
        p.status = 'unfilled';
        p.note = p.range ? 'no break by 15:00' : `no range: ${p.rangeNote ?? 'candles never arrived'}`;
        changed = true;
      }
    } else if (p.status === 'open' && p.date < date) {
      const blind = p.awaiting;
      close(p, p.ltp ?? p.entryPx!, nowMs, 'stale');
      p.stale = true;
      // P36 row 2: never a silent close — say what the price is and why it is not better.
      if (blind) p.note = `machine asleep from ${hm(blind.from)}; no candle price before the date changed — closed at the last tick${p.ltpAt ? ` (${hm(p.ltpAt)})` : ''}`;
      changed = true;
    } else if (p.status === 'open' && minutes >= SQUARE_OFF_MIN && !p.awaiting) {
      close(p, p.ltp ?? p.entryPx!, nowMs, 'eod');
      changed = true;
    }
  }

  if (l.armed && tradingWeekday(nowMs) && minutes >= SCAN_UNTIL_MIN) {
    const d = l.days[date];
    if (!d || d.status === 'waiting') {
      const day = dayOf(l, date);
      day.status = 'no-trades';
      const armedLate = l.armedAt !== null && ist(l.armedAt).date === date
        && ist(l.armedAt).minutes >= SCAN_UNTIL_MIN;
      day.note = armedLate
        ? `armed at ${ist(l.armedAt!).hms.slice(0, 5)}, after the 09:20-09:30 scan window — trading starts on the next trading day`
        : day.attempts > 0
          ? `no trades today: ${day.lastError ?? 'the scan never succeeded'}`
          : 'no trades today: missed the 09:20-09:30 scan window — the server was not running or the machine was asleep';
      changed = true;
    }
  }
  return changed;
}

/* ------------------------------------------------ P36: blind time, keep awake */

const hm = (ms: number) => ist(ms).hms.slice(0, 5);

/**
 * P36 rows 1-2. A gap was found: every leg of the gap's date that is still open stops trading on
 * ticks and on the 15:15 rule until `decideLate` / `closeRepriced` have dealt with it.
 */
export function markBlind(l: Ledger, gap: Gap): boolean {
  const date = ist(gap.to).date;
  let changed = false;
  for (const p of l.positions) {
    if (p.status !== 'open' || p.date !== date) continue;
    // A second gap before the first is settled extends it; a decided `dueAt` stands.
    p.awaiting = p.awaiting ? { ...p.awaiting, to: gap.to } : { from: gap.from, to: gap.to, dueAt: null, reason: null };
    changed = true;
  }
  return changed;
}

/**
 * P36 catch-up steps 1-2, for one awaiting FUTURE and its option legs. Walks its 5-minute candles
 * with the clock capped just before 15:15 (the 15:10 candle completes at 15:15 exactly, and live
 * the square-off comes first). If an exit came due more than `GAP_MS` ago, every leg gets that
 * `dueAt`; otherwise the legs are released to the live rules. Returns true when anything changed.
 */
export function decideLate(l: Ledger, id: string, bars: Bar[], nowMs: number): boolean {
  const p = l.positions.find(x => x.id === id);
  if (!p || legOf(p) !== 'future' || p.status !== 'open' || !p.awaiting || p.awaiting.dueAt !== null) return false;
  const sq = istAt(nowMs, SQUARE_OFF_MIN);
  applyBars(l, id, bars, Math.min(nowMs, sq - 1));
  let dueAt: number | null = null;
  let reason: 'sma' | 'eod' | null = null;
  if (p.exitDue && p.lastBarT != null) { dueAt = p.lastBarT + CANDLE_MS; reason = 'sma'; }
  else if (nowMs >= sq) { dueAt = sq; reason = 'eod'; }
  const legs = [p, ...l.positions.filter(c => c.parentId === p.id && c.status === 'open')];
  const gap = p.awaiting;
  for (const x of legs) {
    x.awaiting = dueAt === null || nowMs - dueAt <= GAP_MS
      ? null
      : { from: x.awaiting?.from ?? gap.from, to: x.awaiting?.to ?? gap.to, dueAt, reason };
  }
  return true;
}

/**
 * P36 row 1: the price of the minute holding `dueAt` — the open of the first 1-minute candle at or
 * after that minute's start, on the same date. "At or after", because an illiquid option may not
 * trade in that minute, and live its first tick would be the fill. Null when nothing traded after.
 */
export function minuteOpen(bars: Bar[], dueAt: number): { px: number; t: number } | null {
  const m = Math.floor(dueAt / MINUTE_MS) * MINUTE_MS;
  const day = ist(dueAt).date;
  const b = bars.filter(x => x.t >= m && ist(x.t).date === day).sort((a, b) => a.t - b.t)[0];
  return b ? { px: b.o, t: b.t } : null;
}

/** P36 row 1: close an awaiting leg at its candle price, stamped at the instant it came due. */
export function closeRepriced(l: Ledger, id: string, px: number, candleT: number): boolean {
  const p = l.positions.find(x => x.id === id);
  const a = p?.awaiting;
  if (!p || p.status !== 'open' || !a || a.dueAt === null || !a.reason) return false;
  close(p, px, a.dueAt, a.reason);
  p.repriced = true;
  p.note = `machine asleep ${hm(a.from)}–${hm(a.to)} · priced from Dhan's ${hm(candleT)} 1-minute candle open`;
  return true;
}

/**
 * P36 row 3: hold the machine awake while armed on a weekday 09:10-15:35 IST, and either today's
 * scan has not finished or a leg of today is pending or open.
 */
export function holdAwake(l: Ledger, nowMs: number): boolean {
  if (!l.armed || !tradingWeekday(nowMs)) return false;
  const { date, minutes } = ist(nowMs);
  if (minutes < AWAKE_FROM_MIN || minutes >= AWAKE_UNTIL_MIN) return false;
  const d = l.days[date];
  const scanPending = !d || d.status === 'waiting' || d.status === 'scanning';
  return scanPending || l.positions.some(p => p.date === date && live(p));
}

/* ------------------------------------------------ P40: messages for the phone */

/** P40 rows 1-2 (sleep-proof and backtest specs' sibling, `docs/spec/phone-sandbox-v1.md`). */
export const DIGEST_MIN = 9 * 60 + 30;
export const SUMMARY_MIN = 15 * 60 + 20;

export type PaperEvent = { kind: 'entry' | 'exit' | 'digest' | 'summary'; title: string; body: string };

const px = (x: number | null | undefined) => (x === null || x === undefined ? '-' : x.toFixed(2));
/** ASCII only: ntfy titles are HTTP headers (notify.ts). */
const rs = (x: number | null | undefined) => (x === null || x === undefined ? '-' : `${x < 0 ? '-' : '+'}Rs ${Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const legName = (p: Position) => (legOf(p) === 'option' ? `${p.strike} ${p.optionType}` : 'FUT');
const REASON_TEXT: Record<string, string> = {
  sma: 'closes against SMA9', eod: '15:15 square-off', manual: 'exited by hand', stale: 'stale close', target: 'target', stop: 'stop-loss',
};

/** The status of every position, to diff against after a change. */
export function statusMap(l: Ledger): Map<string, Position['status']> {
  return new Map(l.positions.map(p => [p.id, p.status]));
}

/** P40 row 2: an entry (pending -> open) or an exit (open -> closed) since `before`. */
export function transitions(before: Map<string, Position['status']>, l: Ledger): PaperEvent[] {
  const out: PaperEvent[] = [];
  for (const p of l.positions) {
    const was = before.get(p.id);
    if (p.status === 'open' && was !== 'open' && p.entryPx !== null) {
      const opt = legOf(p) === 'option';
      const side = opt ? 'BUY' : p.side;
      const why = opt ? `option leg of the ${p.symbol} ${p.side}`
        : p.range ? `broke ${p.side === 'BUY' ? 'above' : 'below'} ${px(p.side === 'BUY' ? p.range.high : p.range.low)} (range ${px(p.range.high)}-${px(p.range.low)})` : 'entered';
      out.push({ kind: 'entry', title: `${side} ${p.symbol} ${legName(p)} @ ${px(p.entryPx)}`, body: `${ist(p.entryAt!).hms} · ${why} · qty ${p.qty}` });
    } else if (p.status === 'closed' && was === 'open') {
      const reason = REASON_TEXT[p.reason ?? ''] ?? p.reason ?? '';
      out.push({
        kind: 'exit',
        title: `EXIT ${p.symbol} ${legName(p)} @ ${px(p.exitPx)} ${rs(p.pnl)}`,
        body: `${ist(p.exitAt!).hms} · ${reason}${p.repriced ? ' (repriced)' : ''} · entry ${px(p.entryPx)}${p.note ? ` · ${p.note}` : ''}`,
      });
    }
  }
  return out;
}

/** P40 row 2: the 09:30 list — what was scanned, what waits for a break, what was not taken and why. */
export function digestEvent(l: Ledger, nowMs: number): PaperEvent | null {
  const { date, minutes } = ist(nowMs);
  const d = l.days[date];
  if (!d || minutes < DIGEST_MIN || d.pushed?.digest || (d.status !== 'done' && d.status !== 'no-trades')) return null;
  (d.pushed ??= {}).digest = true;
  if (d.status === 'no-trades') return { kind: 'digest', title: `09:30 · no trades today`, body: d.note ?? d.lastError ?? '' };
  const futs = l.positions.filter(p => p.date === date && legOf(p) === 'future');
  const lines = futs.map(p => `${p.symbol} ${p.side} · ${p.status === 'pending'
    ? (p.range ? `waiting for ${p.side === 'BUY' ? 'above' : 'below'} ${px(p.side === 'BUY' ? p.range.high : p.range.low)}` : `no range yet${p.rangeNote ? ` (${p.rangeNote})` : ''}`)
    : `${p.status} @ ${px(p.entryPx)}`}`);
  for (const n of d.notTaken) lines.push(`not taken: ${n.symbol} ${n.side} · ${n.reason}`);
  return { kind: 'digest', title: `09:30 · ${d.signals} signal${d.signals === 1 ? '' : 's'} · ${futs.length} taken`, body: lines.join('\n') || 'nothing to trade' };
}

/** P40 row 2: the 15:20 day summary, once, when the day had a scan. */
export function summaryEvent(l: Ledger, nowMs: number): PaperEvent | null {
  const { date, minutes } = ist(nowMs);
  const d = l.days[date];
  if (!d || minutes < SUMMARY_MIN || d.pushed?.summary || d.status === 'waiting' || d.status === 'scanning') return null;
  (d.pushed ??= {}).summary = true;
  const legs = l.positions.filter(p => p.date === date);
  const closed = legs.filter(p => p.status === 'closed');
  const total = r2(closed.reduce((s, p) => s + (p.pnl ?? 0), 0));
  const lines = legs.map(p => p.status === 'closed'
    ? `${p.symbol} ${legName(p)} ${rs(p.pnl)} · ${REASON_TEXT[p.reason ?? ''] ?? p.reason}${p.repriced ? ' (repriced)' : ''}`
    : `${p.symbol} ${legName(p)} ${p.status}${p.note ? ` · ${p.note}` : ''}`);
  return { kind: 'summary', title: `Day ${date} · ${closed.length} closed · gross ${rs(total)}`, body: lines.join('\n') || 'no positions today' };
}

/**
 * P32 row 11: manual exit at the last LTP; a pending leg is cancelled instead. Exiting a FUTURE
 * takes its option leg with it — they are one signal, and an option left behind would be a trade
 * with no rule to close it but 15:15.
 */
export function exitByHand(l: Ledger, id: string, nowMs: number): Position | null {
  const p = l.positions.find(x => x.id === id);
  if (!p) return null;
  const one = (x: Position) => {
    if (x.status === 'open') close(x, x.ltp ?? x.entryPx!, nowMs, 'manual');
    else if (x.status === 'pending') { x.status = 'unfilled'; x.note = 'cancelled by hand'; }
  };
  one(p);
  if (legOf(p) === 'future') for (const c of l.positions) if (c.parentId === p.id) one(c);
  return p;
}

/** P32 row 10. Arming stamps the time, so a late arm can be named rather than guessed. */
export function arm(l: Ledger, armed: boolean, nowMs: number) {
  if (l.armed === armed) return;
  l.armed = armed;
  l.armedAt = armed ? nowMs : l.armedAt;
}

/* --------------------------------------------------------------- the view */

const live = (p: Position) => p.status === 'pending' || p.status === 'open';

/** Unrealised P&L and % for an open position; realised for a closed one. */
export function markOf(p: Position): { pnl: number | null; pnlPct: number | null } {
  if (p.entryPx === null) return { pnl: null, pnlPct: null };
  const px = p.status === 'closed' ? p.exitPx : p.ltp;
  if (px === null) return { pnl: null, pnlPct: null };
  const side = pnlSide(p);
  const dir = side === 'BUY' ? 1 : -1;
  return { pnl: pnlOf(side, p.entryPx, px, p.qty), pnlPct: r2(((px - p.entryPx) / p.entryPx) * 100 * dir) };
}

export function statusLine(l: Ledger, nowMs: number): string {
  const { date, minutes } = ist(nowMs);
  const d = l.days[date];
  const opens = l.positions.filter(p => live(p)).length;
  const still = opens ? ` · ${opens} position${opens === 1 ? '' : 's'} still open` : '';

  if (d?.status === 'scanning') return `scanning NSE… (attempt ${d.attempts + 1})`;
  if (d?.status === 'done') {
    const futs = l.positions.filter(p => p.date === date && legOf(p) === 'future');
    const waiting = futs.filter(p => p.status === 'pending').length;
    const phase = minutes < RANGE_READY_MIN ? ' · range forms 09:15–09:25'
      : waiting ? ` · ${waiting} waiting for a break` : '';
    return `scanned ${ist(d.scannedAt!).hms} · ${d.signals} signal${d.signals === 1 ? '' : 's'} · ${futs.length} taken${phase}` +
      (l.armed ? '' : ' · disarmed — nothing more will be traded');
  }
  if (d?.status === 'waiting' && d.lastError) {
    // Named even when disarmed: replay's Run now can fail with the toggle off.
    if (!l.armed) return `scan failed: ${d.lastError} · disarmed, no retry`;
    const next = ist((d.lastAttemptAt ?? nowMs) + RETRY_MS).hms;
    return `scan failed: ${d.lastError} · retrying at ${next}`;
  }
  // Disarmed outranks the day's no-trades note: "armed at 20:36 …" must not survive a disarm.
  if (!l.armed) return `disarmed — nothing will be traded${still}`;
  if (d?.status === 'no-trades') return d.note ?? 'no trades today';
  if (!tradingWeekday(nowMs) || minutes >= SCAN_UNTIL_MIN) return 'armed · waiting for 09:20 on the next trading day';
  return 'armed · waiting for 09:20';
}

export function view(l: Ledger, nowMs: number) {
  const { date, hms } = ist(nowMs);
  const withMark = (p: Position) => ({ ...p, leg: legOf(p), ...markOf(p) });
  const liveRows = l.positions.filter(live).map(withMark);
  // P33 row 12: a future still waiting for its break is not a position yet.
  const waiting = liveRows.filter(p => p.leg === 'future' && p.status === 'pending');
  const open = liveRows.filter(p => !(p.leg === 'future' && p.status === 'pending'));
  const closed = l.positions
    .filter(p => p.date === date && (p.status === 'closed' || p.status === 'unfilled'))
    .sort((a, b) => (b.exitAt ?? b.createdAt) - (a.exitAt ?? a.createdAt))
    .map(withMark);

  const byDate = new Map<string, { date: string; trades: number; wins: number; pnl: number }>();
  for (const p of l.positions) {
    if (p.status !== 'closed') continue;
    const row = byDate.get(p.date) ?? { date: p.date, trades: 0, wins: 0, pnl: 0 };
    row.trades++;
    if ((p.pnl ?? 0) > 0) row.wins++;
    row.pnl = r2(row.pnl + (p.pnl ?? 0));
    byDate.set(p.date, row);
  }
  const history = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const realised = r2(l.positions.filter(p => p.date === date && p.status === 'closed').reduce((s, p) => s + (p.pnl ?? 0), 0));
  const unrealised = r2(open.filter(p => p.date === date).reduce((s, p) => s + (p.pnl ?? 0), 0));

  return {
    paper: true as const,
    mode: l.mode,
    armed: l.armed,
    armedAt: l.armedAt,
    now: nowMs,
    clock: hms,
    date,
    replayClock: l.clockOffsetMs !== 0,
    status: statusLine(l, nowMs),
    day: l.days[date] ?? null,
    waiting,
    open,
    closed,
    history,
    dayPnl: { realised, unrealised, total: r2(realised + unrealised) },
    rules: {
      strategy: 'orb-sma9',
      scanAt: '09:20', rangeFrom: '09:15', rangeReady: '09:25', entryUntil: '15:00', squareOffAt: '15:15',
      smaPeriod: SMA_PERIOD, exitCloses: EXIT_CLOSES, maxPositions: MAX_POSITIONS, size: '1 lot',
      legs: 'future + nearest CE/PE',
    },
    canRunNow: l.mode === 'replay',
  };
}

/* --------------------------------------------------------- the I/O shell */

/** P32 row 13. Each mode has its own file — replay's synthetic fills must never reach the live P&L. */
export function ledgerPath(replay = isReplay()): string {
  return path.join(CACHE_DIR, replay ? 'paper-ledger.replay.json' : 'paper-ledger.json');
}

/** What the shell asks for when it needs a future's 5-minute candles. */
export type CandleAsk = { symbol: string; side: Dir; securityId: number; base: number };
export type CandleAnswer = { bars: Bar[]; why: string | null };

type TraderOpts = {
  file: string;
  mode: 'live' | 'replay';
  lookup: Lookup;
  scan: () => Promise<NseScanResult>;
  /** P33 rows 3, 7: the future's 5-minute candles, previous session included. */
  candles: (ask: CandleAsk, nowMs: number) => Promise<CandleAnswer>;
  /** P36 row 1: one contract's 1-minute candles for today (future or option). */
  minuteBars?: (ask: { securityId: number; leg: Leg }, nowMs: number) => Promise<CandleAnswer>;
  /** P36 row 3: called when the keep-awake hold should start (true) or end (false). */
  onAwake?: (hold: boolean) => void;
  /** P40: entries, exits and the two daily messages, for the phone. */
  onEvent?: (e: PaperEvent) => void;
  /** P33 row 6: the symbol's near-month stock options. */
  options: OptionsFor;
  /** Called with the contracts this trader needs ticks for; an empty list releases them. */
  onWants: (subs: Subscription[]) => void;
  wall?: () => number;
};

export class PaperTrader {
  ledger: Ledger;
  private readonly o: TraderOpts;
  private timer: NodeJS.Timeout | null = null;
  private dirty = false;
  private lastSave = 0;
  private saving: Promise<void> = Promise.resolve();
  private wantsKey = '';
  private scanning = false;
  private fetching = false;
  /** Amendment 15: a failed candle fetch is not retried before this time. In memory only. */
  private retryAt = new Map<string, number>();
  /** P36: wall time of the previous step, to see a gap in them. */
  private lastStepWall = 0;
  private catching = false;
  private catchRetryAt = 0;
  private awake = false;
  /** P40: statuses as last announced. Seeded at load, so a restart re-announces nothing. */
  private announced = new Map<string, Position['status']>();

  constructor(o: TraderOpts) {
    this.o = o;
    this.ledger = emptyLedger(o.mode);
  }

  private wall() { return (this.o.wall ?? Date.now)(); }
  now() { return this.wall() + this.ledger.clockOffsetMs; }

  async load() {
    let raw: string | null = null;
    try { raw = await readFile(this.o.file, 'utf8'); } catch { /* first run: no file yet */ }
    if (raw !== null) {
      let l: Ledger | null = null;
      try { l = JSON.parse(raw) as Ledger; } catch { /* handled below */ }
      if (l?.version === 1 && Array.isArray(l.positions)) {
        this.ledger = { ...emptyLedger(this.o.mode), ...l, mode: this.o.mode };
      } else {
        // Unreadable: keep it aside rather than overwrite a trade history with an empty ledger.
        const aside = `${this.o.file}.unreadable-${Date.now()}`;
        await rename(this.o.file, aside).catch(() => {});
        console.error(`paper ledger was unreadable - moved to ${aside}, starting empty`);
      }
    }
    // A process that died mid-scan left the day at 'scanning', which scanDue() never retries.
    for (const d of Object.values(this.ledger.days)) if (d.status === 'scanning') d.status = 'waiting';
    // P36: a restart is a gap too, measured from the last write. It must be marked BEFORE onClock,
    // or a restart after 15:15 squares off at the pre-gap tick — the 24 Sep failure by another road.
    const now = this.now();
    const alive = this.ledger.aliveAt;
    if (alive != null && now - alive > GAP_MS && markBlind(this.ledger, { from: alive, to: now })) this.dirty = true;
    // P32 row 13: an earlier date's open position is closed as stale before anything else happens.
    if (onClock(this.ledger, this.now())) this.dirty = true;
    this.syncWants();
    this.announced = statusMap(this.ledger);
    await this.flush(true);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.step(), 1000);
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  /** One pass of the clock. Exposed for the unit test, which drives it with an injected wall. */
  async step() {
    const wall = this.wall();
    const now = this.now();
    // P36: marked before onClock, for the same reason as in load().
    if (this.lastStepWall && wall - this.lastStepWall > GAP_MS
      && markBlind(this.ledger, { from: this.lastStepWall + this.ledger.clockOffsetMs, to: now })) {
      await this.flush(true);
    }
    this.lastStepWall = wall;
    const hold = holdAwake(this.ledger, now);
    if (hold !== this.awake) { this.awake = hold; this.o.onAwake?.(hold); }
    if (onClock(this.ledger, now)) { this.dirty = true; this.syncWants(); await this.flush(true); }
    if (!this.catching && now >= this.catchRetryAt && this.ledger.positions.some(p => p.status === 'open' && p.awaiting)) {
      await this.catchUp();
    }
    // P40 row 2: the once-a-day messages. Marked in the ledger, so a restart does not repeat them.
    for (const e of [digestEvent(this.ledger, now), summaryEvent(this.ledger, now)]) {
      if (e) { this.o.onEvent?.(e); await this.flush(true); }
    }
    if (!this.scanning && scanDue(this.ledger, now)) await this.runScan(true);
    if (!this.fetching) await this.readCandles();
    await this.flush(false);
  }

  /**
   * P36 catch-up (sleep-proof-v1.md). For each awaiting future: decide what came due while blind,
   * then price every leg from its own 1-minute candles. Any failed read leaves the whole signal
   * awaiting and retries after `RETRY_MS` (row 2) — the network is often still down at wake.
   */
  private async catchUp() {
    this.catching = true;
    let failed = false;
    const ask = async (f: () => Promise<CandleAnswer>): Promise<CandleAnswer> => {
      try { return await f(); } catch (e) { return { bars: [], why: (e as Error).message }; }
    };
    try {
      const futures = this.ledger.positions.filter(p => legOf(p) === 'future' && p.status === 'open' && p.awaiting);
      for (const f of futures) {
        if (f.awaiting!.dueAt === null) {
          const five = await ask(() => this.o.candles({ symbol: f.symbol, side: f.side, securityId: f.securityId, base: f.signal.cashLtp }, this.now()));
          if (five.why) { failed = true; continue; }
          if (decideLate(this.ledger, f.id, five.bars, this.now())) this.dirty = true;
          if (!f.awaiting) { this.syncWants(); await this.flush(true); continue; }
        }
        const dueAt = f.awaiting!.dueAt!;
        const legs = [f, ...this.ledger.positions.filter(c => c.parentId === f.id && c.status === 'open' && c.awaiting)];
        const priced: { id: string; px: number; t: number }[] = [];
        for (const x of legs) {
          if (!this.o.minuteBars) break;
          const ans = await ask(() => this.o.minuteBars!({ securityId: x.securityId, leg: legOf(x) }, this.now()));
          const m = ans.why ? null : minuteOpen(ans.bars, dueAt);
          if (!m) break;
          priced.push({ id: x.id, ...m });
        }
        if (priced.length !== legs.length) { failed = true; continue; }
        for (const q of priced) closeRepriced(this.ledger, q.id, q.px, q.t);
        this.syncWants();
        await this.flush(true);
      }
    } finally {
      this.catchRetryAt = failed ? this.now() + RETRY_MS : 0;
      this.catching = false;
    }
  }

  /**
   * P33 rows 3 and 7. Serial on purpose: every call shares one gate key in dhan.ts anyway, so
   * firing them together would only queue them there.
   */
  private async readCandles() {
    this.fetching = true;
    try {
      for (const p of this.ledger.positions) {
        const now = this.now();
        if (!candlesDue(p, now) || (this.retryAt.get(p.id) ?? 0) > now) continue;
        let ans: CandleAnswer;
        try {
          ans = await this.o.candles({ symbol: p.symbol, side: p.side, securityId: p.securityId, base: p.signal.cashLtp }, now);
        } catch (e) { ans = { bars: [], why: (e as Error).message }; }
        const after = this.now();
        if (ans.why) {
          this.retryAt.set(p.id, after + RETRY_MS);
          if (p.status === 'pending' && p.rangeNote !== ans.why) { p.rangeNote = ans.why; this.dirty = true; }
          continue;
        }
        const changed = applyBars(this.ledger, p.id, ans.bars, after);
        // Still due after a successful read means Dhan has not published the candle yet — the
        // 09:20 one for the range, or the one that just closed. Wait, rather than re-ask each second.
        if (candlesDue(p, after)) this.retryAt.set(p.id, after + RETRY_MS);
        else this.retryAt.delete(p.id);
        if (changed) { this.syncWants(); await this.flush(true); }
      }
    } finally {
      this.fetching = false;
    }
  }

  /** P32 row 3's timer path (checkFresh) and replay's Run now (no freshness, P32 amendment 23). */
  private async runScan(checkFresh: boolean): Promise<ReturnType<typeof applyScan>> {
    this.scanning = true;
    const day = dayOf(this.ledger, ist(this.now()).date);
    day.status = 'scanning';
    try {
      let scan: NseScanResult;
      try { scan = await this.o.scan(); } catch (e) {
        scan = { error: (e as Error).message, long: [], short: [], market: { priceAsOf: '' } } as unknown as NseScanResult;
      }
      return applyScan(this.ledger, scan, this.o.lookup, this.now(), checkFresh);
    } finally {
      this.scanning = false;
      this.syncWants();
      await this.flush(true);
    }
  }

  onFeedTick(t: Tick) {
    if (t.seg !== 'NSE_FNO' || t.ltp === null) return;
    if (!this.ledger.positions.some(p => p.securityId === t.securityId && live(p))) return;
    // The feed decodes a float32: 1259.24 arrives as 1259.2399902…, which would miss a 1259.24
    // level by a hair. Exchange prices are whole paise, so round the decoding noise away here.
    const ltp = Math.round(t.ltp * 100) / 100;
    if (onTick(this.ledger, t.securityId, ltp, this.now(), this.o.options)) {
      this.syncWants();
      void this.flush(true);
    } else this.dirty = true;
  }

  async setArmed(armed: boolean) {
    arm(this.ledger, armed, this.now());
    await this.flush(true);
  }

  async exit(id: string): Promise<Position | null> {
    const p = exitByHand(this.ledger, id, this.now());
    if (p) { this.syncWants(); await this.flush(true); }
    return p;
  }

  async exitAll(): Promise<number> {
    const ids = this.ledger.positions.filter(live).map(p => p.id);
    for (const id of ids) exitByHand(this.ledger, id, this.now());
    this.syncWants();
    await this.flush(true);
    return ids.length;
  }

  /** Replay only (P32 row 11; the route refuses live). P33 amendment 17, P32 amendment 20. */
  async runNow(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.ledger.positions.some(live)) return { ok: false, error: 'square off first — positions are still pending or open' };
    if (this.scanning) return { ok: false, error: 'a scan is already running' };
    const wall = this.wall();
    this.ledger.clockOffsetMs = istAt(wall, RANGE_READY_MIN) - wall;
    this.retryAt.clear();
    // Nothing is deleted: a second press on the same date meets row 9 and lists every symbol as
    // "already traded today", which is the rule doing its job, not a bug.
    const r = await this.runScan(false);
    return r.ok ? { ok: true } : { ok: false, error: `scan failed: ${r.reason}` };
  }

  view() { return view(this.ledger, this.now()); }

  /** P40 row 2: every status change since the last call, once. Runs on each urgent flush. */
  private announce() {
    if (!this.o.onEvent) return;
    for (const e of transitions(this.announced, this.ledger)) this.o.onEvent(e);
    this.announced = statusMap(this.ledger);
  }

  /** P32 row 12: one feed entry for everything pending or open; empty once nothing is. */
  private syncWants() {
    const subs = new Map<number, Subscription>();
    for (const p of this.ledger.positions) {
      if (!live(p)) continue;
      const parent = legOf(p) === 'option' ? this.ledger.positions.find(x => x.id === p.parentId) : undefined;
      subs.set(p.securityId, {
        seg: p.seg, securityId: p.securityId, mode: 'quote',
        // Replay: the synthetic walk starts at the share's own price, so the future does not print
        // 24,000 for a 1,400 stock; an option starts at a fraction of its future (amendment 18).
        // Ignored on the live feed.
        base: this.o.mode !== 'replay' ? undefined
          : parent ? r2((parent.entryPx ?? parent.signal.cashLtp) * REPLAY_OPTION_BASE)
          : p.signal.cashLtp,
      });
    }
    const key = [...subs.keys()].sort().join(',');
    if (key === this.wantsKey) return;
    this.wantsKey = key;
    this.o.onWants([...subs.values()]);
  }

  /**
   * Status changes are written at once; LTP-only drift at most every 5 s. Written to a temp file
   * and renamed, so a crash mid-write cannot leave half a ledger behind.
   */
  private flush(urgent: boolean): Promise<void> {
    if (urgent) { this.dirty = true; this.announce(); }
    if (!this.dirty || (!urgent && this.wall() - this.lastSave < 5000)) return this.saving;
    this.dirty = false;
    this.lastSave = this.wall();
    this.ledger.aliveAt = this.now();
    const body = JSON.stringify(this.ledger, null, 1);
    this.saving = this.saving.then(async () => {
      await mkdir(path.dirname(this.o.file), { recursive: true });
      const tmp = `${this.o.file}.tmp`;
      await writeFile(tmp, body);
      await rename(tmp, this.o.file);
    }).catch(e => { this.dirty = true; console.error(`paper ledger write failed: ${(e as Error).message}`); });
    return this.saving;
  }
}
