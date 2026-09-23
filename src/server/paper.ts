/**
 * P32 — auto paper-trading from the front page. `docs/spec/paper-trading-v1.md`.
 *
 * PAPER MEANS PAPER. Nothing in this file places, modifies or cancels a real order, and it imports
 * nothing from `dhan.ts` (spec row 1, AC1 greps for it). A fill is this process writing a number
 * into a JSON file: the LTP of the first feed tick the app's own WebSocket carries for that future.
 *
 * Two halves:
 *  - the RULES are pure functions of (ledger, event, nowMs). No `Date.now()` in them — spec row 14.
 *    Almost every session on this project is outside 09:15-15:30, and a rule that reads the wall
 *    clock has a criterion nobody can run (CLAUDE.md: "now is an argument, not a clock").
 *  - `PaperTrader` is the I/O shell: the 1 s timer, the ledger file, the feed subscriptions.
 *
 * Everything the strategy decides is a named constant below, and every one of them is a row of the
 * spec. Rows 3, 4, 5, 7, 8 and 16 are the user-accepted GUESSES — change them there first.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './paths.ts';
import { isReplay } from './replay.ts';
import { nseDate } from './nse.ts';
import type { NseScanResult } from './scanner-nse.ts';
import type { Subscription, Tick } from './feed.ts';

/* ------------------------------------------------------------ spec values */

/** Row 3: the scan fires at 09:20 IST; entries only until 09:30. */
export const SCAN_AT_MIN = 9 * 60 + 20;
export const ENTRY_UNTIL_MIN = 9 * 60 + 30;
/** Row 3: NSE's prices must be stamped today at or after the 09:15 open. */
export const FRESH_FROM_MIN = 9 * 60 + 15;
/** Row 3 (GUESS): a failed or stale scan is retried this often until 09:30. */
export const RETRY_MS = 60_000;
/** Row 5 (GUESS): positions per day, highest |chg%| first. */
export const MAX_POSITIONS = 10;
/** Row 7 (GUESS): stop against / target in favour, in % of the entry fill. */
export const STOP_PCT = 1.0;
export const TARGET_PCT = 2.0;
/** Row 8 (GUESS): intraday square-off. */
export const SQUARE_OFF_MIN = 15 * 60 + 15;

const IST_MS = 5.5 * 3600_000;

/* ------------------------------------------------------------------ types */

export type Dir = 'BUY' | 'SELL';
export type ExitReason = 'target' | 'stop' | 'eod' | 'manual' | 'stale';

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

export type Position = {
  /** `${date}-${symbol}` — unique because row 9 allows one trade per symbol per day. */
  id: string;
  date: string;
  symbol: string;
  name: string;
  side: Dir;
  seg: 'NSE_FNO';
  securityId: number;
  expiry: string;
  lot: number;
  /** Row 5: one lot, so qty === lot. Kept separate so a later size rule is a one-line change. */
  qty: number;
  /** What the scan saw. `cashLtp` is the SHARE's price — never the fill (row 6). */
  signal: { chgPct: number; oiPct: number; cashLtp: number };
  status: 'pending' | 'open' | 'closed' | 'unfilled';
  createdAt: number;
  entryPx: number | null;
  entryAt: number | null;
  stopPx: number | null;
  targetPx: number | null;
  ltp: number | null;
  ltpAt: number | null;
  exitPx: number | null;
  exitAt: number | null;
  reason: ExitReason | null;
  /** Realised, gross, rupees, to the paisa. Null until closed. */
  pnl: number | null;
  /** Row 13: closed at boot because it was still open from an earlier date. */
  stale: boolean;
  note: string | null;
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
};

export type Ledger = {
  version: 1;
  mode: 'live' | 'replay';
  armed: boolean;
  armedAt: number | null;
  /**
   * Amendment row 19: replay's engine clock = wall clock + this. Run now sets it so the press lands
   * on 09:20:00 IST. Always 0 live. Persisted, so a restart does not jump the clock to 21:00 and
   * square everything off at once.
   */
  clockOffsetMs: number;
  days: Record<string, Day>;
  positions: Position[];
};

export function emptyLedger(mode: 'live' | 'replay'): Ledger {
  return { version: 1, mode, armed: false, armedAt: null, clockOffsetMs: 0, days: {}, positions: [] };
}

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

const tradingWeekday = (nowMs: number) => { const w = ist(nowMs).weekday; return w >= 1 && w <= 5; };

/* ---------------------------------------------------------- the arithmetic */

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Row 7 + amendment 21: levels from the fill, rounded to 0.01 so AC3's "0.01 short" is exact. */
export function levels(side: Dir, entry: number): { stop: number; target: number } {
  return side === 'BUY'
    ? { stop: r2(entry * (100 - STOP_PCT) / 100), target: r2(entry * (100 + TARGET_PCT) / 100) }
    : { stop: r2(entry * (100 + STOP_PCT) / 100), target: r2(entry * (100 - TARGET_PCT) / 100) };
}

/** Gross rupees, to the paisa. A SELL gains when the price falls. */
export function pnlOf(side: Dir, entry: number, exit: number, qty: number): number {
  return r2((exit - entry) * qty * (side === 'BUY' ? 1 : -1));
}

/** Which exit, if any, this LTP triggers. Stop is checked first: a tick cannot be both. */
export function exitFor(p: Pick<Position, 'side' | 'stopPx' | 'targetPx'>, ltp: number): 'stop' | 'target' | null {
  if (p.stopPx === null || p.targetPx === null) return null;
  if (p.side === 'BUY') {
    if (ltp <= p.stopPx) return 'stop';
    if (ltp >= p.targetPx) return 'target';
  } else {
    if (ltp >= p.stopPx) return 'stop';
    if (ltp <= p.targetPx) return 'target';
  }
  return null;
}

function close(p: Position, px: number, at: number, reason: ExitReason) {
  p.status = 'closed';
  p.exitPx = px;
  p.exitAt = at;
  p.reason = reason;
  p.pnl = pnlOf(p.side, p.entryPx!, px, p.qty);
}

/* ------------------------------------------------------------ freshness */

/** NSE stamps its feed `17-Sep-2026 16:00:28`. Row 3: must be today, at or after 09:15. */
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
 * Rows 2, 4, 5, 9. Turns one scan into pending positions. Long -> BUY, Short -> SELL, both lists
 * merged and ranked by |chg%| so the cap keeps the strongest moves whichever side they are on.
 */
export function planEntries(l: Ledger, scan: NseScanResult, lookup: Lookup, nowMs: number): { added: Position[]; notTaken: NotTaken[] } {
  const date = ist(nowMs).date;
  const signals = [
    ...scan.long.map(r => ({ r, side: 'BUY' as Dir })),
    ...scan.short.map(r => ({ r, side: 'SELL' as Dir })),
  ].sort((a, b) => Math.abs(b.r.chgPct) - Math.abs(a.r.chgPct) || a.r.symbol.localeCompare(b.r.symbol));

  const today = l.positions.filter(p => p.date === date);
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
      seg: 'NSE_FNO', securityId: c.futureId, expiry: c.futureExpiry, lot: c.lot, qty: c.lot,
      signal: { chgPct: r.chgPct, oiPct: r.oiPct, cashLtp: r.ltp },
      status: 'pending', createdAt: nowMs,
      entryPx: null, entryAt: null, stopPx: null, targetPx: null, ltp: null, ltpAt: null,
      exitPx: null, exitAt: null, reason: null, pnl: null, stale: false, note: null,
    });
  }
  return { added, notTaken };
}

/**
 * Applies one scan result to the day. `checkFresh` is false only for replay's Run now (amendment
 * 23): the committed fixture is dated 17-Sep and would always be refused.
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

/** Row 3: is a timer scan due now? */
export function scanDue(l: Ledger, nowMs: number): boolean {
  if (!l.armed || !tradingWeekday(nowMs)) return false;
  const { date, minutes } = ist(nowMs);
  if (minutes < SCAN_AT_MIN || minutes >= ENTRY_UNTIL_MIN) return false;
  const d = l.days[date];
  if (!d) return true;
  if (d.status !== 'waiting') return false;
  return d.lastAttemptAt === null || nowMs - d.lastAttemptAt >= RETRY_MS;
}

/**
 * One feed tick. Rows 6 and 7: a pending position fills at this LTP (inside the entry window); an
 * open one updates its LTP and exits at THIS LTP if it crossed a level. Returns true when a
 * position changed status, so the caller can persist at once instead of on the next flush.
 */
export function onTick(l: Ledger, securityId: number, ltp: number, nowMs: number): boolean {
  if (!(ltp > 0) || !Number.isFinite(ltp)) return false;
  const { date, minutes } = ist(nowMs);
  let changed = false;
  for (const p of l.positions) {
    if (p.securityId !== securityId) continue;
    if (p.status === 'pending') {
      if (p.date !== date || minutes >= ENTRY_UNTIL_MIN) continue;   // onClock marks it unfilled
      const { stop, target } = levels(p.side, ltp);
      p.status = 'open';
      p.entryPx = ltp;
      p.entryAt = nowMs;
      p.stopPx = stop;
      p.targetPx = target;
      p.ltp = ltp;
      p.ltpAt = nowMs;
      changed = true;
    } else if (p.status === 'open') {
      p.ltp = ltp;
      p.ltpAt = nowMs;
      // An open position from an earlier date is onClock's to close as stale, not the tick's.
      if (p.date !== date) continue;
      const hit = exitFor(p, ltp);
      if (hit) { close(p, ltp, nowMs, hit); changed = true; }
    }
  }
  return changed;
}

/**
 * The clock's own rules: 09:30 expires unfilled entries (row 6), 15:15 squares off (row 8), an
 * earlier date's open position is closed as stale (row 13), and a day the window passed without a
 * scan gets a sentence saying why (rows 3 and 10).
 */
export function onClock(l: Ledger, nowMs: number): boolean {
  const { date, minutes } = ist(nowMs);
  let changed = false;
  for (const p of l.positions) {
    if (p.status === 'pending' && (p.date < date || minutes >= ENTRY_UNTIL_MIN)) {
      p.status = 'unfilled';
      p.note = 'no tick in window';
      changed = true;
    } else if (p.status === 'open' && p.date < date) {
      close(p, p.ltp ?? p.entryPx!, nowMs, 'stale');
      p.stale = true;
      changed = true;
    } else if (p.status === 'open' && minutes >= SQUARE_OFF_MIN) {
      close(p, p.ltp ?? p.entryPx!, nowMs, 'eod');
      changed = true;
    }
  }

  if (l.armed && tradingWeekday(nowMs) && minutes >= ENTRY_UNTIL_MIN) {
    const d = l.days[date];
    if (!d || d.status === 'waiting') {
      const day = dayOf(l, date);
      day.status = 'no-trades';
      const armedLate = l.armedAt !== null && ist(l.armedAt).date === date
        && ist(l.armedAt).minutes >= ENTRY_UNTIL_MIN;
      day.note = armedLate
        ? `armed at ${ist(l.armedAt!).hms.slice(0, 5)}, after the 09:20-09:30 window — trading starts on the next trading day`
        : day.attempts > 0
          ? `no trades today: ${day.lastError ?? 'the scan never succeeded'}`
          : 'no trades today: missed the 09:20-09:30 window — the server was not running or the machine was asleep';
      changed = true;
    }
  }
  return changed;
}

/** Row 11: manual exit at the last LTP. A position still pending is cancelled instead. */
export function exitByHand(l: Ledger, id: string, nowMs: number): Position | null {
  const p = l.positions.find(x => x.id === id);
  if (!p) return null;
  if (p.status === 'open') close(p, p.ltp ?? p.entryPx!, nowMs, 'manual');
  else if (p.status === 'pending') { p.status = 'unfilled'; p.note = 'cancelled by hand'; }
  return p;
}

/** Row 10. Arming stamps the time, so a late arm can be named at 09:30 rather than guessed. */
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
  const dir = p.side === 'BUY' ? 1 : -1;
  return { pnl: pnlOf(p.side, p.entryPx, px, p.qty), pnlPct: r2(((px - p.entryPx) / p.entryPx) * 100 * dir) };
}

export function statusLine(l: Ledger, nowMs: number): string {
  const { date, minutes } = ist(nowMs);
  const d = l.days[date];
  const opens = l.positions.filter(p => live(p)).length;
  const still = opens ? ` · ${opens} position${opens === 1 ? '' : 's'} still open` : '';

  if (d?.status === 'scanning') return `scanning NSE… (attempt ${d.attempts + 1})`;
  if (d?.status === 'done') {
    const taken = l.positions.filter(p => p.date === date).length;
    return `scanned ${ist(d.scannedAt!).hms} · ${d.signals} signal${d.signals === 1 ? '' : 's'} · ${taken} taken` +
      (l.armed ? '' : ' · disarmed — nothing more will be traded');
  }
  if (d?.status === 'no-trades') return d.note ?? 'no trades today';
  if (!l.armed) return `disarmed — nothing will be traded${still}`;
  if (d?.status === 'waiting' && d.lastError) {
    const next = ist((d.lastAttemptAt ?? nowMs) + RETRY_MS).hms;
    return `scan failed: ${d.lastError} · retrying at ${next}`;
  }
  if (!tradingWeekday(nowMs) || minutes >= ENTRY_UNTIL_MIN) return 'armed · waiting for 09:20 on the next trading day';
  return 'armed · waiting for 09:20';
}

export function view(l: Ledger, nowMs: number) {
  const { date, hms } = ist(nowMs);
  const withMark = (p: Position) => ({ ...p, ...markOf(p) });
  const open = l.positions.filter(live).map(withMark);
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
    open,
    closed,
    history,
    dayPnl: { realised, unrealised, total: r2(realised + unrealised) },
    rules: {
      scanAt: '09:20', entryUntil: '09:30', squareOffAt: '15:15',
      stopPct: STOP_PCT, targetPct: TARGET_PCT, maxPositions: MAX_POSITIONS, size: '1 lot',
    },
    canRunNow: l.mode === 'replay',
  };
}

/* --------------------------------------------------------- the I/O shell */

/** Row 13. Each mode has its own file — replay's synthetic fills must never reach the live P&L. */
export function ledgerPath(replay = isReplay()): string {
  return path.join(CACHE_DIR, replay ? 'paper-ledger.replay.json' : 'paper-ledger.json');
}

type TraderOpts = {
  file: string;
  mode: 'live' | 'replay';
  lookup: Lookup;
  scan: () => Promise<NseScanResult>;
  /** Called with the futures this trader needs ticks for; an empty list releases them. */
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
    // Row 13: an earlier date's open position is closed as stale before anything else happens.
    if (onClock(this.ledger, this.now())) this.dirty = true;
    this.syncWants();
    await this.flush(true);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.step(), 1000);
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  private async step() {
    const now = this.now();
    if (onClock(this.ledger, now)) { this.dirty = true; this.syncWants(); await this.flush(true); }
    if (!this.scanning && scanDue(this.ledger, now)) await this.runScan(true);
    await this.flush(false);
  }

  /** Row 3's timer path (checkFresh) and replay's Run now (no freshness, amendment 23). */
  private async runScan(checkFresh: boolean) {
    this.scanning = true;
    const day = dayOf(this.ledger, ist(this.now()).date);
    day.status = 'scanning';
    try {
      let scan: NseScanResult;
      try { scan = await this.o.scan(); } catch (e) {
        scan = { error: (e as Error).message, long: [], short: [], market: { priceAsOf: '' } } as unknown as NseScanResult;
      }
      applyScan(this.ledger, scan, this.o.lookup, this.now(), checkFresh);
    } finally {
      this.scanning = false;
      this.syncWants();
      await this.flush(true);
    }
  }

  onFeedTick(t: Tick) {
    if (t.seg !== 'NSE_FNO' || t.ltp === null) return;
    if (!this.ledger.positions.some(p => p.securityId === t.securityId && live(p))) return;
    if (onTick(this.ledger, t.securityId, t.ltp, this.now())) {
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

  /** Replay only (row 11; the route refuses live). Amendments 19 and 20. */
  async runNow(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.ledger.positions.some(live)) return { ok: false, error: 'square off first — positions are still pending or open' };
    if (this.scanning) return { ok: false, error: 'a scan is already running' };
    const wall = this.wall();
    this.ledger.clockOffsetMs = istAt(wall, SCAN_AT_MIN) - wall;
    // Nothing is deleted: a second press on the same date meets row 9 and lists every symbol as
    // "already traded today", which is the rule doing its job, not a bug.
    await this.runScan(false);
    return { ok: true };
  }

  view() { return view(this.ledger, this.now()); }

  /** Row 12: one feed entry for everything pending or open; empty once nothing is. */
  private syncWants() {
    const subs = new Map<number, Subscription>();
    for (const p of this.ledger.positions) {
      if (!live(p)) continue;
      subs.set(p.securityId, {
        seg: p.seg, securityId: p.securityId, mode: 'quote',
        // Replay: the synthetic walk starts at the share's own price, so the future does not
        // print 24,000 for a 1,400 stock. Ignored on the live feed.
        base: this.o.mode === 'replay' ? p.signal.cashLtp : undefined,
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
    if (urgent) this.dirty = true;
    if (!this.dirty || (!urgent && this.wall() - this.lastSave < 5000)) return this.saving;
    this.dirty = false;
    this.lastSave = this.wall();
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
