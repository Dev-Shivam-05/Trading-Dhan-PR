/**
 * P53 — the NIFTY index paper book: P50's 920 and AI LTP lines traded live, on paper, with P34's rules (the user's).
 * `docs/spec/index-paper-v1.md` (every "row N" below is a row of that spec).
 *
 * The one idea that keeps live and history honest (row 2): the book does not re-implement the rules. It rebuilds the
 * day's MINUTE CHAIN from the live snapshots and the day's NIFTY bars from the feed's ticks, and at every minute close
 * runs P50's `daySignals()` over the day so far — the same function the backtest measured. The live part is only what
 * the minute chain cannot know yet: the first TICK that reaches a line inside the forming minute (row 3), and the ticks
 * that reach a stop or a target (row 6).
 *
 * Paper only. Nothing here can place an order: it imports no Dhan client, and the shell hands it no endpoint.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import type { ChainDay, Leg } from './chainhist.ts';
import type { IdxDay } from './idxhist.ts';
import { hmOf, FIRST_HM, LAST_HM } from './ltp-state.ts';
import { daySignals, vetoOf, L920_LAST_ENTRY_HM, AI_LAST_ENTRY_HM, AI_ENTRIES, type Buy, type DayLines, type Veto } from './ltp-lines.ts';
import { nearestStrike, costOf, BUDGET } from './ltp-backtest.ts';

/* ------------------------------------------------------------------ constants (each is a spec row) */

const IST_MS = 5.5 * 3600_000;
const MINUTE = 60_000;
/** Row 6 (V48): everything closed at 2:30. */
export const EXIT_AT_HM = '14:30';
/** Row 11: a tick gap this long while a position is open marks it blind. */
export const BLIND_MS = 60_000;

/* ------------------------------------------------------------------ the minute builder (row 2) */

/** The part of a live snapshot the builder reads. */
export type SnapLite = {
  t: number; spot: number; atm: number | null;
  rows: { strike: number; ce: { ltp: number | null; volume: number | null; oi: number | null; iv: number | null }; pe: { ltp: number | null; volume: number | null; oi: number | null; iv: number | null } }[];
};

const minuteOf = (t: number) => Math.floor(t / MINUTE) * MINUTE;
const istDate = (t: number) => new Date(t + IST_MS).toISOString().slice(0, 10);

/**
 * Snapshots in, one ChainDay column per minute out. A minute's column is its LAST snapshot; volume is turned back
 * into per-minute volume from the chain's cumulative, so P49's accumulation (row 2 of ltp-state-v1) gets the
 * cumulative back exactly.
 */
export class MinuteBuilder {
  day: ChainDay;
  private pending: SnapLite | null = null;
  private cum: Record<string, number> = {};

  constructor(date: string, restore?: ChainDay) {
    this.day = restore ?? { date, code: 1, t: [], spot: [], atm: [], legs: {}, conflicts: 0 };
    if (restore) for (const [k, l] of Object.entries(restore.legs)) this.cum[k] = l.v.reduce<number>((a, x) => a + (x ?? 0), 0);
  }

  /** Adds a snapshot; returns the minute it finalised, if this snapshot opened a new one. */
  add(s: SnapLite): number | null {
    const hm = hmOf(s.t);
    if (istDate(s.t) !== this.day.date || hm < FIRST_HM || hm > LAST_HM) return null;
    let done: number | null = null;
    if (this.pending && minuteOf(this.pending.t) !== minuteOf(s.t)) done = this.finalise();
    this.pending = s;
    return done;
  }

  /** Finalises the pending minute if the clock has left it (a minute with no later snapshot). */
  flush(nowMs: number): number | null {
    return this.pending && minuteOf(nowMs) > minuteOf(this.pending.t) ? this.finalise() : null;
  }

  private finalise(): number {
    const s = this.pending!;
    this.pending = null;
    const t = minuteOf(s.t);
    const k = this.day.t.length;
    this.day.t.push(t);
    this.day.spot.push(s.spot);
    this.day.atm.push(s.atm);
    const blank = (): Leg => ({ o: [], h: [], l: [], c: [], v: [], oi: [], iv: [] });
    for (const r of s.rows) {
      for (const [side, x] of [['CE', r.ce], ['PE', r.pe]] as const) {
        if (x.ltp === null) continue;
        const key = `${r.strike}${side}`;
        const leg = this.day.legs[key] ??= blank();
        for (const f of ['o', 'h', 'l', 'c', 'v', 'oi', 'iv'] as const) while (leg[f].length < k) leg[f].push(null);
        const cum = x.volume ?? this.cum[key] ?? 0;
        const v = Math.max(0, cum - (this.cum[key] ?? 0));
        this.cum[key] = Math.max(cum, this.cum[key] ?? 0);
        leg.o.push(x.ltp); leg.h.push(x.ltp); leg.l.push(x.ltp); leg.c.push(x.ltp);
        leg.v.push(v); leg.oi.push(x.oi); leg.iv.push(x.iv);
      }
    }
    for (const leg of Object.values(this.day.legs)) for (const f of ['o', 'h', 'l', 'c', 'v', 'oi', 'iv'] as const) while (leg[f].length <= k) leg[f].push(null);
    return t;
  }
}

/* ------------------------------------------------------------------ the ledger */

export type BookId = '920' | 'ai';

export type IPos = {
  id: string; date: string; book: BookId; line: string; buy: Buy;
  strike: number; securityId: number | null; expiry: string;
  lots: number; units: number; overBudget: boolean;
  /** Index levels. */
  entryLevel: number; stop: number; target: number;
  entryAt: number; entryPx: number; fill: 'feed' | 'chain';
  status: 'open' | 'closed';
  exitAt: number | null; exitPx: number | null; reason: 'target' | 'stop' | 'time' | 'state' | 'manual' | null;
  ltp: number;
  gross: number | null; cost: number | null; net: number | null;
  /** Row 11. */
  blind: boolean;
};

export type Touch = { at: number; hm: string; book: BookId; line: string; buy: Buy; level: number; outcome: Veto | 'busy' | 'no-price' | 'disarmed' | 'accepted' };

export type IDay = {
  date: string;
  lines920: { name: string; value: number | null; missing: string | null }[] | null;
  gapWidth: number | null;
  verdict: string | null;
  used: string[];
  touches: Touch[];
};

export type ILedger = { version: 1; mode: 'live' | 'replay'; armed: boolean; positions: IPos[]; days: Record<string, IDay> };
export const emptyILedger = (mode: 'live' | 'replay'): ILedger => ({ version: 1, mode, armed: true, positions: [], days: {} });

const r2 = (x: number) => Math.round(x * 100) / 100;

/* ------------------------------------------------------------------ the pure core */

export type CoreOpts = {
  mode: 'live' | 'replay';
  /** Row 7: the registry's NIFTY lot. */
  lot: () => number;
  expiry: () => string | null;
  /** Row 5: the nearest-expiry option's securityId, or null. */
  optionId: (expiry: string, strike: number, type: Buy) => number | null;
  indexId: number;
};

/**
 * Everything that decides. Pure except for the clock it is handed. The shell feeds it snapshots, ticks and the clock,
 * saves `ledger` and the builder's day, and forwards `events()` and `wants()`.
 */
export class IndexCore {
  ledger: ILedger;
  builder: MinuteBuilder | null = null;
  idx: IdxDay = new Map();
  dl: DayLines | null = null;
  private legLtp = new Map<number, { px: number; at: number }>();
  private lastSnap: SnapLite | null = null;
  private seenThisMinute = new Set<string>();
  private lastIdxTick: { px: number; at: number } | null = null;
  private evq: { kind: 'entry' | 'exit'; title: string; body: string }[] = [];
  private readonly o: CoreOpts;

  constructor(o: CoreOpts, ledger?: ILedger) {
    this.o = o;
    this.ledger = ledger ?? emptyILedger(o.mode);
  }

  day(date: string): IDay {
    return this.ledger.days[date] ??= { date, lines920: null, gapWidth: null, verdict: null, used: [], touches: [] };
  }

  /** Starts (or restores) the day's builder. */
  begin(date: string, restore?: ChainDay, idx?: IdxDay) {
    if (this.builder?.day.date === date) return;
    this.builder = new MinuteBuilder(date, restore);
    this.idx = idx ?? new Map();
    this.dl = null;
    this.seenThisMinute.clear();
    if (restore && restore.t.length) this.onMinute(restore.t.at(-1)! + MINUTE);
  }

  onSnapshot(s: SnapLite, now: number) {
    if (!this.builder || this.builder.day.date !== istDate(s.t)) this.begin(istDate(s.t));
    this.lastSnap = s;
    const done = this.builder!.add(s);
    if (done !== null) this.onMinute(now);
  }

  onClock(now: number) {
    const done = this.builder?.flush(now) ?? null;
    if (done !== null) this.onMinute(now);
    // Row 6: the time exit, at 14:30:00.
    if (hmOf(now) >= EXIT_AT_HM) for (const p of this.open()) if (p.date === istDate(now)) this.close(p, now, 'time', null);
    // Row 11: a gap in the index ticks while a position is open.
    if (this.lastIdxTick && now - this.lastIdxTick.at > BLIND_MS) for (const p of this.open()) p.blind = true;
    // An earlier day's position is never carried: closed at its last mark (paper, intraday only).
    for (const p of this.open()) if (p.date < istDate(now)) this.close(p, now, 'time', null);
  }

  /** Row 2: the minute chain grew; ask P50 again. Then AI state exits (row 6). */
  private onMinute(now: number) {
    if (!this.builder || !this.builder.day.t.length) return;
    this.dl = daySignals(this.builder.day, this.idx);
    this.seenThisMinute.clear();
    const d = this.day(this.builder.day.date);
    const L = this.dl.l920;
    if (L.ready && !d.lines920) {
      d.lines920 = L.lines.map(l => ({ name: l.name, value: l.value, missing: l.missing }));
      d.gapWidth = L.gapWidth;
    }
    d.verdict = this.dl.states.at(-1)?.verdict ?? null;
    // P50's own first touches (from the minute bars) use the line up, whatever the live path saw.
    const used = new Set(d.used);
    for (const s of this.dl.signals) used.add(`${s.kind}|${s.line}`);
    d.used = [...used];
    const last = this.dl.ai.at(-1);
    for (const p of this.open()) {
      if (p.book === 'ai' && p.date === d.date && last && !last.permit[p.buy]) this.close(p, now, 'state', null);
    }
    void now;
  }

  /** Legs to hold on the feed (row 5): every drawn entry line's strike and its fallback, plus open positions. */
  wants(): { securityId: number; strike: number; type: Buy }[] {
    const ex = this.o.expiry();
    const out = new Map<number, { securityId: number; strike: number; type: Buy }>();
    const add = (strike: number, type: Buy) => {
      if (!ex) return;
      const id = this.o.optionId(ex, strike, type);
      if (id !== null) out.set(id, { securityId: id, strike, type });
    };
    for (const c of this.candidates()) {
      const step = this.dl?.l920.step ?? 50;
      const k = nearestStrike(c.level, step);
      add(k, c.buy); add(k + (c.buy === 'CE' ? step : -step), c.buy);
    }
    for (const p of this.open()) if (p.securityId !== null) out.set(p.securityId, { securityId: p.securityId, strike: p.strike, type: p.buy });
    return [...out.values()];
  }

  /** The entry lines drawn right now: the 920 four and the AI entries drawn at the last completed minute. */
  candidates(): { book: BookId; line: string; buy: Buy; level: number; stop: number | null; target: number | null; permitted: boolean }[] {
    const out: ReturnType<IndexCore['candidates']> = [];
    if (!this.dl) return out;
    const L = this.dl.l920;
    if (L.ready) for (const l of L.lines) {
      if (l.missing || l.value === null) continue;
      out.push({ book: '920', line: l.name, buy: l.buy, level: l.value, stop: l.buy === 'PE' ? L.stopPut : L.stopCall, target: l.target, permitted: true });
    }
    const A = this.dl.ai.at(-1);
    if (A) for (const name of AI_ENTRIES) {
      const v = A.value[name];
      const buy: Buy = name.startsWith('S') ? 'CE' : 'PE';
      if (v === null || !A.drawn.has(name)) continue;
      out.push({ book: 'ai', line: name, buy, level: v, stop: buy === 'CE' ? A.value['S Max Pain'] : A.value['R Max Pain'], target: buy === 'CE' ? A.value['S Max Gain'] : A.value['R Max Gain'], permitted: A.permit[buy] });
    }
    return out;
  }

  open() { return this.ledger.positions.filter(p => p.status === 'open'); }

  onTick(securityId: number, ltp: number, now: number) {
    const px = Math.round(ltp * 100) / 100;               // CLAUDE.md: the feed is float32
    if (securityId !== this.o.indexId) {
      this.legLtp.set(securityId, { px, at: now });
      for (const p of this.open()) if (p.securityId === securityId) p.ltp = px;
      return;
    }
    const hm = hmOf(now);
    // The minute's NIFTY bar (row 2), built from the same ticks.
    if (this.builder && istDate(now) === this.builder.day.date && hm >= FIRST_HM && hm <= LAST_HM) {
      const t = minuteOf(now), b = this.idx.get(t);
      if (b) { b.h = Math.max(b.h, px); b.l = Math.min(b.l, px); b.c = px; } else this.idx.set(t, { o: px, h: px, l: px, c: px });
    }
    this.lastIdxTick = { px, at: now };
    // Row 6: stops and targets, stop first.
    for (const p of this.open()) {
      const up = p.buy === 'CE';
      if (up ? px <= p.stop : px >= p.stop) this.close(p, now, 'stop', p.stop);
      else if (up ? px >= p.target : px <= p.target) this.close(p, now, 'target', p.target);
    }
    this.entries(px, now);
  }

  /** Row 3: the first tick of the minute that reaches a drawn line from the side the last minute closed on. */
  private entries(px: number, now: number) {
    if (!this.dl || !this.builder) return;
    const lastMinute = this.dl.minutes.at(-1);
    if (!lastMinute) return;
    const prevClose = lastMinute.c;
    const hm = hmOf(now);
    if (hm < '09:21' || istDate(now) !== this.builder.day.date) return;
    const d = this.day(this.builder.day.date);
    const minute = minuteOf(now);
    for (const c of this.candidates()) {
      const reached = c.buy === 'CE' ? prevClose > c.level && px <= c.level : prevClose < c.level && px >= c.level;
      const once = `${c.book}|${c.line}|${minute}`;
      if (!reached || this.seenThisMinute.has(once)) continue;
      this.seenThisMinute.add(once);
      const key = `${c.book}|${c.line}`;
      const veto = vetoOf({
        hm, lastHm: c.book === '920' ? L920_LAST_ENTRY_HM : AI_LAST_ENTRY_HM, usedBefore: d.used.includes(key),
        permitted: c.permitted, buy: c.buy, entry: c.level, stop: c.stop, target: c.target, ivBad: false,
      });
      if (!d.used.includes(key)) d.used.push(key);
      let outcome: Touch['outcome'] = veto ?? 'accepted';
      if (!veto && this.open().some(p => p.book === c.book)) outcome = 'busy';
      else if (!veto && !this.ledger.armed) outcome = 'disarmed';
      else if (!veto) outcome = this.openPosition(c, now) ? 'accepted' : 'no-price';
      d.touches.push({ at: now, hm, book: c.book, line: c.line, buy: c.buy, level: c.level, outcome });
    }
  }

  /** Row 5 and row 7. */
  private openPosition(c: ReturnType<IndexCore['candidates']>[number], now: number): boolean {
    const ex = this.o.expiry();
    if (!ex || !this.dl) return false;
    const step = this.dl.l920.step;
    const k0 = nearestStrike(c.level, step);
    for (const strike of [k0, k0 + (c.buy === 'CE' ? step : -step)]) {
      const id = this.o.optionId(ex, strike, c.buy);
      const feed = id !== null ? this.legLtp.get(id) : undefined;
      const row = this.lastSnap?.rows.find(r => r.strike === strike);
      const chain = row ? (c.buy === 'CE' ? row.ce.ltp : row.pe.ltp) : null;
      const px = feed?.px ?? chain;
      if (px === null || px === undefined || px <= 0) continue;
      const lot = this.o.lot();
      const one = px * lot;
      const lots = Math.max(1, Math.floor(BUDGET / one));
      const p: IPos = {
        id: `${istDate(now)}-${c.book}-${c.line.replace(/\s+/g, '')}-${now}`, date: istDate(now), book: c.book, line: c.line, buy: c.buy,
        strike, securityId: id, expiry: ex, lots, units: lots * lot, overBudget: one > BUDGET,
        entryLevel: c.level, stop: c.stop!, target: c.target!, entryAt: now, entryPx: px, fill: feed ? 'feed' : 'chain',
        status: 'open', exitAt: null, exitPx: null, reason: null, ltp: px, gross: null, cost: null, net: null, blind: false,
      };
      this.ledger.positions.push(p);
      this.evq.push({ kind: 'entry', title: `NIFTY ${c.book === '920' ? '920' : 'AI'} BUY ${strike} ${c.buy}`, body: `${c.line} touched at ${hmOf(now)}: bought ${p.lots} lot(s) at ${px}. Stop ${r2(p.stop)}, target ${r2(p.target)} (index).` });
      return true;
    }
    return false;
  }

  private close(p: IPos, now: number, reason: NonNullable<IPos['reason']>, _level: number | null) {
    const feed = p.securityId !== null ? this.legLtp.get(p.securityId) : undefined;
    const row = this.lastSnap?.rows.find(r => r.strike === p.strike);
    const chain = row ? (p.buy === 'CE' ? row.ce.ltp : row.pe.ltp) : null;
    const px = feed?.px ?? chain ?? p.ltp;
    p.status = 'closed'; p.exitAt = now; p.exitPx = px; p.reason = reason; p.ltp = px;
    p.gross = r2((px - p.entryPx) * p.units);
    p.cost = costOf(p.entryPx, px, p.units);
    p.net = r2(p.gross - p.cost);
    this.evq.push({ kind: 'exit', title: `NIFTY ${p.book === '920' ? '920' : 'AI'} EXIT ${p.strike} ${p.buy}`, body: `${reason} at ${hmOf(now)}: ${p.entryPx} -> ${px}, gross ${p.gross}, net ${p.net}.` });
  }

  exitAll(now: number) { for (const p of this.open()) this.close(p, now, 'manual', null); }

  events() { const e = this.evq; this.evq = []; return e; }
}

/* ------------------------------------------------------------------ files */

export const indexLedgerPath = (dir: string, replay: boolean) => path.join(dir, replay ? 'index-paper.replay.json' : 'index-paper.json');
export const dayChainPath = (dir: string, replay: boolean, date: string) => path.join(dir, replay ? 'index-paper.replay' : 'index-paper', `${date}.json`);

export async function readJsonFile<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; } catch { return null; }
}
export async function writeJsonFile(file: string, v: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(v));
  await rename(file + '.tmp', file);
}

/* ------------------------------------------------------------------ the shell (row 13) */

/** The part of `ChainPoller` the book uses (the same shape the P47 recorder takes). */
export type PollerLike = {
  subscribe(): void;
  unsubscribe(): void;
  on(fn: (ev: { type: 'snapshot'; data: { receivedAt: number; spot: number; atmStrike: number | null; rows: SnapLite['rows'] } } | { type: 'status'; data: unknown }) => void): () => void;
};
export type WantSub = { seg: string; securityId: number; mode: 'ticker' | 'quote' | 'full'; base?: number };

type ShellOpts = CoreOpts & {
  dir: string;
  /** The nearest-expiry NIFTY poller, or null while the registry is still resolving. */
  poller: () => PollerLike | null;
  onWants: (subs: WantSub[]) => void;
  onEvent?: (e: { kind: 'entry' | 'exit'; title: string; body: string }) => void;
  wall?: () => number;
};

/** Row 1: the poller is held 09:14-15:31 on weekdays, the P47 recorder's window. */
const WINDOW_FROM = 9 * 60 + 14, WINDOW_UNTIL = 15 * 60 + 31;

export class IndexPaper {
  core: IndexCore;
  private readonly o: ShellOpts;
  private timer: NodeJS.Timeout | null = null;
  private off: (() => void) | null = null;
  private held: PollerLike | null = null;
  private savedCols = -1;
  private wantsKey = '';
  private lastSave = 0;
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();

  constructor(o: ShellOpts) {
    this.o = o;
    this.core = new IndexCore(o);
  }

  private now() { return (this.o.wall ?? Date.now)(); }
  private get replay() { return this.o.mode === 'replay'; }

  async load() {
    const l = await readJsonFile<ILedger>(indexLedgerPath(this.o.dir, this.replay));
    if (l?.version === 1 && Array.isArray(l.positions)) this.core.ledger = { ...emptyILedger(this.o.mode), ...l, mode: this.o.mode };
    // Row 10: a restart mid-day rebuilds the minute chain, so the AI state does not restart at "stable".
    const date = istDate(this.now());
    const saved = await readJsonFile<{ day: ChainDay; idx: [number, { o: number; h: number; l: number; c: number }][] }>(dayChainPath(this.o.dir, this.replay, date));
    if (saved?.day?.t?.length) {
      this.core.begin(date, saved.day, new Map(saved.idx));
      this.savedCols = saved.day.t.length;
    }
  }

  start() { if (!this.timer) this.timer = setInterval(() => void this.step().catch(e => console.error(`[index-paper] ${(e as Error).message}`)), 1000); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.release(); }

  private release() { this.off?.(); this.off = null; this.held?.unsubscribe(); this.held = null; }

  async step() {
    const now = this.now();
    const d = new Date(now + IST_MS), min = d.getUTCHours() * 60 + d.getUTCMinutes(), wd = d.getUTCDay();
    const inWindow = wd >= 1 && wd <= 5 && min >= WINDOW_FROM && min < WINDOW_UNTIL;
    if (inWindow && !this.held) {
      const p = this.o.poller();
      if (p) {
        this.held = p;
        this.off = p.on(ev => {
          if (ev.type !== 'snapshot') return;
          const s = ev.data;
          this.core.onSnapshot({ t: s.receivedAt, spot: s.spot, atm: s.atmStrike, rows: s.rows }, this.now());
        });
        p.subscribe();
      }
    } else if (!inWindow && this.held) this.release();
    this.core.onClock(now);
    await this.after();
  }

  onFeedTick(t: { seg: string; securityId: number; ltp: number | null }) {
    if (t.ltp === null) return;
    if (t.seg === 'IDX_I' ? t.securityId !== this.o.indexId : t.seg !== 'NSE_FNO') return;
    this.core.onTick(t.securityId, t.ltp, this.now());
    this.dirty = true;
    const ev = this.core.events();
    if (ev.length) { for (const e of ev) this.o.onEvent?.(e); void this.after(true); }
  }

  /** Events out, feed wants in sync, and the two files written. */
  private async after(urgent = false) {
    for (const e of this.core.events()) { this.o.onEvent?.(e); urgent = true; }
    const subs: WantSub[] = [];
    const b = this.core.builder;
    if (b && this.held) {
      const spot = b.day.spot.at(-1) ?? undefined;
      subs.push({ seg: 'IDX_I', securityId: this.o.indexId, mode: 'ticker', base: this.replay ? spot ?? undefined : undefined });
      for (const w of this.core.wants()) subs.push({ seg: 'NSE_FNO', securityId: w.securityId, mode: 'quote' });
    }
    const key = subs.map(s => s.securityId).sort().join(',');
    if (key !== this.wantsKey) { this.wantsKey = key; this.o.onWants(subs); }
    const cols = b?.day.t.length ?? -1;
    if (b && cols !== this.savedCols) {
      this.savedCols = cols;
      urgent = true;
      await writeJsonFile(dayChainPath(this.o.dir, this.replay, b.day.date), { day: b.day, idx: [...this.core.idx] });
    }
    if (urgent || (this.dirty && this.now() - this.lastSave > 5000)) {
      this.dirty = false;
      this.lastSave = this.now();
      const body = this.core.ledger;
      this.saving = this.saving.then(() => writeJsonFile(indexLedgerPath(this.o.dir, this.replay), body))
        .catch(e => console.error(`[index-paper] ledger write failed: ${(e as Error).message}`));
      await this.saving;
    }
  }

  async setArmed(armed: boolean) { this.core.ledger.armed = armed; await this.after(true); }
  async exitAll() { this.core.exitAll(this.now()); await this.after(true); }

  view() {
    const now = this.now(), date = istDate(now);
    const d = this.core.ledger.days[date] ?? null;
    const pos = this.core.ledger.positions.filter(p => p.date === date);
    const sum = (f: (p: IPos) => number | null) => r2(pos.reduce((a, p) => a + (f(p) ?? 0), 0));
    const history = Object.values(this.core.ledger.days).filter(x => x.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(x => {
      const ps = this.core.ledger.positions.filter(p => p.date === x.date);
      return { date: x.date, trades: ps.length, net: r2(ps.reduce((a, p) => a + (p.net ?? 0), 0)), touches: x.touches.length };
    });
    return {
      mode: this.o.mode, armed: this.core.ledger.armed, date, holding: !!this.held,
      minutes: this.core.builder?.day.date === date ? this.core.builder.day.t.length : 0,
      lines920: d?.lines920 ?? null, gapWidth: d?.gapWidth ?? null, verdict: d?.verdict ?? null,
      drawn: this.core.candidates().map(c => ({ book: c.book, line: c.line, buy: c.buy, level: r2(c.level), permitted: c.permitted })),
      touches: d?.touches ?? [],
      positions: pos,
      totals: { trades: pos.length, gross: sum(p => p.gross), cost: sum(p => p.cost), net: sum(p => p.net) },
      history,
    };
  }
}
