/**
 * P41 row 3 (`docs/spec/phone-sandbox-v1.md`) — record every live tick the sandbox will need.
 *
 * Dhan has no historical ticks, only 1-minute candles, so the only free source of a tick-by-tick
 * day is to write it down while it happens. From 09:14 to 15:31 IST on a weekday this subscribes
 * all near-month F&O stock futures. Once each future has traded at or after 09:20, it also
 * subscribes the CE and PE at the 5 strikes nearest that price. That is about 2,310 instruments,
 * inside Dhan's 5,000 per socket. Each tick is appended to `.cache/ticks/<date>/ticks.csv`.
 *
 * Live only: replay ticks are synthetic, and a recording of them would be mistaken for the market.
 */

import { appendFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './paths.ts';
import type { Subscription, Tick } from './feed.ts';

export const TICK_DIR = path.join(CACHE_DIR, 'ticks');
/** Row 3: the recording window, minutes after IST midnight. */
export const RECORD_FROM_MIN = 9 * 60 + 14;
export const RECORD_UNTIL_MIN = 15 * 60 + 31;
export const OPTIONS_FROM_MIN = 9 * 60 + 20;
/** Row 3: strikes per option type (CE, PE) around each future's 09:20 price. */
export const STRIKES_PER_TYPE = 5;
const FLUSH_MS = 2000;
const IST_MS = 5.5 * 3600_000;

export type RecStock = {
  symbol: string; futureId: number; lot: number; expiry: string;
  options: { strike: number; optionType: 'CE' | 'PE'; securityId: number }[];
};
export type RecInstrument = { securityId: number; symbol: string; kind: 'FUT' | 'CE' | 'PE'; strike: number | null; expiry: string; lot: number };

const istOf = (ms: number) => {
  const d = new Date(ms + IST_MS);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: d.getUTCDay() };
};

/** Row 3: the N strikes nearest `price` for one option type, ties to the lower strike. */
export function nearestStrikes<T extends { strike: number; optionType: 'CE' | 'PE' }>(list: T[], price: number, type: 'CE' | 'PE', n = STRIKES_PER_TYPE): T[] {
  return list.filter(o => o.optionType === type)
    .sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price) || a.strike - b.strike)
    .slice(0, n);
}

export class TickRecorder {
  private readonly universe: () => RecStock[];
  private readonly onWants: (subs: Subscription[]) => void;
  private date: string | null = null;
  private stocks = new Map<number, RecStock>();          // futureId -> stock
  private chosen = new Set<number>();                      // futures whose options are chosen
  private set = new Map<number, RecInstrument>();          // everything being recorded
  private lastLtp = new Map<number, number>();
  private counts = new Map<number, number>();
  private buf: string[] = [];
  private writing: Promise<void> = Promise.resolve();
  private lastFlush = 0;
  private wantsKey = '';
  private stepping = false;

  constructor(o: { universe: () => RecStock[]; onWants: (subs: Subscription[]) => void }) {
    this.universe = o.universe;
    this.onWants = o.onWants;
  }

  private dir() { return path.join(TICK_DIR, this.date!); }

  /**
   * Called every second by the server. Measured 2026-09-25: at boot the event loop is busy, so
   * the 1 s timer fired a second `step()` while the first was still awaiting `mkdir` — the second
   * saw `this.date` already set, wrote `instruments.json` into a folder that did not exist yet,
   * and the unhandled ENOENT killed the whole live server (trader included). One step at a time.
   */
  async step(nowMs: number) {
    if (this.stepping) return;
    this.stepping = true;
    try { await this.stepOnce(nowMs); } finally { this.stepping = false; }
  }

  private async stepOnce(nowMs: number) {
    const { date, minutes, weekday } = istOf(nowMs);
    const inWindow = weekday >= 1 && weekday <= 5 && minutes >= RECORD_FROM_MIN && minutes < RECORD_UNTIL_MIN;
    if (!inWindow) {
      if (this.date) await this.finish();
      return;
    }
    if (this.date !== date) {
      if (this.date) await this.finish();
      // The folder first: if the universe or mkdir throws, `date` stays unset and the next step retries.
      const stocks = this.universe();
      await mkdir(path.join(TICK_DIR, date), { recursive: true });
      this.date = date;
      this.stocks = new Map(stocks.map(s => [s.futureId, s]));
      this.set = new Map([...this.stocks.values()].map(s => [s.futureId, { securityId: s.futureId, symbol: s.symbol, kind: 'FUT' as const, strike: null, expiry: s.expiry, lot: s.lot }]));
      this.chosen.clear(); this.counts.clear(); this.lastLtp.clear();
      await mkdir(this.dir(), { recursive: true });
      // A restart mid-session appends to the same file; the header is written once.
      const file = path.join(this.dir(), 'ticks.csv');
      if (!(await access(file).then(() => true, () => false))) await appendFile(file, 'recv_ms,ltt,seg,security_id,ltp,volume,oi\n');
    }
    // Options: once a future has a price at or after 09:20, take its 5 nearest CE and PE.
    if (minutes >= OPTIONS_FROM_MIN) {
      for (const [id, s] of this.stocks) {
        if (this.chosen.has(id)) continue;
        const p = this.lastLtp.get(id);
        if (p === undefined) continue;
        for (const t of ['CE', 'PE'] as const) {
          for (const o of nearestStrikes(s.options, p, t)) {
            this.set.set(o.securityId, { securityId: o.securityId, symbol: s.symbol, kind: t, strike: o.strike, expiry: s.expiry, lot: s.lot });
          }
        }
        this.chosen.add(id);
      }
    }
    const key = `${this.date}:${this.set.size}`;
    if (key !== this.wantsKey) {
      this.wantsKey = key;
      this.onWants([...this.set.keys()].map(securityId => ({ seg: 'NSE_FNO', securityId, mode: 'quote' as const })));
      await writeFile(path.join(this.dir(), 'instruments.json'), JSON.stringify([...this.set.values()]));
    }
    if (nowMs - this.lastFlush >= FLUSH_MS) await this.flush(nowMs);
  }

  /**
   * Also record whatever the live paper trader holds. Seen in the first sandbox run: POLICYBZR fell
   * through its band to 1606, so the option it bought (1600 PE) was outside the 5 strikes around
   * its 09:20 price, and a recorded day would not have that option's ticks to replay.
   */
  watch(list: RecInstrument[]) {
    if (!this.date) return;
    for (const i of list) if (!this.set.has(i.securityId)) this.set.set(i.securityId, i);
  }

  onTick(t: Tick) {
    if (!this.date || t.seg !== 'NSE_FNO' || !this.set.has(t.securityId)) return;
    if (t.ltp !== null) this.lastLtp.set(t.securityId, t.ltp);
    this.counts.set(t.securityId, (this.counts.get(t.securityId) ?? 0) + 1);
    this.buf.push(`${t.at},${t.ltt ?? ''},${t.seg},${t.securityId},${t.ltp ?? ''},${t.volume ?? ''},${t.oi ?? ''}`);
  }

  private flush(nowMs: number): Promise<void> {
    this.lastFlush = nowMs;
    if (!this.buf.length || !this.date) return this.writing;
    const lines = this.buf.join('\n') + '\n';
    this.buf = [];
    const file = path.join(this.dir(), 'ticks.csv');
    this.writing = this.writing.then(() => appendFile(file, lines)).catch(e => console.error(`[ticks] write failed: ${(e as Error).message}`));
    return this.writing;
  }

  /** The window closed: write what is buffered, the per-instrument counts, and release the feed. */
  private async finish() {
    await this.flush(Date.now());
    const rows = [...this.set.values()].map(i => ({ ...i, ticks: this.counts.get(i.securityId) ?? 0 }));
    await writeFile(path.join(this.dir(), 'summary.json'), JSON.stringify({
      date: this.date, instruments: rows.length, ticks: rows.reduce((s, r) => s + r.ticks, 0),
      silent: rows.filter(r => r.ticks === 0).length, rows,
    }, null, 1));
    console.log(`[ticks] ${this.date}: ${rows.reduce((s, r) => s + r.ticks, 0)} ticks from ${rows.length} instruments (${rows.filter(r => r.ticks === 0).length} silent)`);
    this.date = null;
    this.wantsKey = '';
    this.onWants([]);
  }

  status() {
    return { date: this.date, instruments: this.set.size, optionsChosenFor: this.chosen.size, ticks: [...this.counts.values()].reduce((s, n) => s + n, 0) };
  }
}
