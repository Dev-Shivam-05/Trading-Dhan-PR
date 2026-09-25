/**
 * P47 — record NIFTY's option chain all session. `docs/spec/chain-recorder-v1.md`.
 *
 * The LTP Calculator's pressure, SOC and Game of Percentage rules read a level's HISTORY through
 * the day, never one snapshot (05-CONSOLIDATED-LOGIC §6.1), and Dhan sells no historical chain
 * snapshots. So from 09:14 to 15:31 on a weekday this keeps the existing `ChainPoller` for the
 * current and the next expiry running, and appends every snapshot it emits to
 * `.cache/chains/<date>/NIFTY-<expiry>.jsonl`. No new Dhan endpoint is called: the recorder is one
 * more subscriber of the poller the Option Chain screen already uses (row 2).
 *
 * Live only: replay chains are synthetic, and a recording of them would be mistaken for the market.
 */

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './paths.ts';
import type { Snapshot } from './poller.ts';

export const CHAIN_DIR = path.join(CACHE_DIR, 'chains');
/** Row 1: the recording window, minutes after IST midnight (the tick recorder's). */
export const CHAIN_FROM_MIN = 9 * 60 + 14;
export const CHAIN_UNTIL_MIN = 15 * 60 + 31;
/** Row 3: strikes kept each side of the ATM (the strike nearest spot). */
export const STRIKES_EACH_SIDE = 20;
const IST_MS = 5.5 * 3600_000;

/** Row 4: one row as a tuple, in this order. */
export const ROW_FIELDS = ['strike', 'ceLtp', 'ceVol', 'ceOi', 'ceOiChg', 'ceIv', 'peLtp', 'peVol', 'peOi', 'peOiChg', 'peIv'] as const;
export type RowTuple = (number | null)[];
export type ChainRecord = { t: number; spot: number; src: string; atm: number | null; atmIv: number | null; req: string; rows: RowTuple[] };

/** The part of `ChainPoller` the recorder uses; a fake in tests. */
export type PollerLike = {
  subscribe(): void;
  unsubscribe(): void;
  on(fn: (ev: { type: 'snapshot'; data: Snapshot } | { type: 'status'; data: unknown }) => void): () => void;
};

const istOf = (ms: number) => {
  const d = new Date(ms + IST_MS);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: d.getUTCDay() };
};

/** Rows 3-4: the snapshot reduced to ±`each` strikes around its ATM, as tuples. */
export function toRecord(s: Snapshot, each = STRIKES_EACH_SIDE): ChainRecord {
  const i = s.atmStrike === null ? -1 : s.rows.findIndex(r => r.strike === s.atmStrike);
  const rows = i < 0 ? s.rows : s.rows.slice(Math.max(0, i - each), i + each + 1);
  return {
    t: s.receivedAt, spot: s.spot, src: s.spotSource, atm: s.atmStrike, atmIv: s.atmIV, req: s.requestId,
    rows: rows.map(r => [r.strike, r.ce.ltp, r.ce.volume, r.ce.oi, r.ce.oiChg, r.ce.iv, r.pe.ltp, r.pe.volume, r.pe.oi, r.pe.oiChg, r.pe.iv]),
  };
}

type Stream = { expiry: string; poller: PollerLike; off: () => void; lastReq: string | null; count: number; first: number | null; last: number | null; maxGap: number };

export class ChainRecorder {
  private readonly instrumentId: string;
  private readonly expiries: () => string[];
  private readonly pollerFor: (expiry: string) => PollerLike;
  private readonly write: (file: string, text: string) => Promise<void>;
  private date: string | null = null;
  private streams: Stream[] = [];
  private buf = new Map<string, string[]>();
  private writing: Promise<void> = Promise.resolve();
  private stepping = false;

  constructor(o: { instrumentId: string; expiries: () => string[]; pollerFor: (expiry: string) => PollerLike; write?: (file: string, text: string) => Promise<void> }) {
    this.instrumentId = o.instrumentId;
    this.expiries = o.expiries;
    this.pollerFor = o.pollerFor;
    this.write = o.write ?? (async (file, text) => { await mkdir(path.dirname(file), { recursive: true }); await appendFile(file, text); });
  }

  private file(expiry: string) { return path.join(CHAIN_DIR, this.date!, `${this.instrumentId}-${expiry}.jsonl`); }

  /** Called every second by the server. One step at a time (the tick recorder's 25-Sep lesson). */
  async step(nowMs: number) {
    if (this.stepping) return;
    this.stepping = true;
    try { await this.stepOnce(nowMs); } finally { this.stepping = false; }
  }

  private async stepOnce(nowMs: number) {
    const { date, minutes, weekday } = istOf(nowMs);
    const inWindow = weekday >= 1 && weekday <= 5 && minutes >= CHAIN_FROM_MIN && minutes < CHAIN_UNTIL_MIN;
    if (!inWindow || (this.date && this.date !== date)) { if (this.date) await this.finish(); if (!inWindow) return; }
    if (!this.date && !this.begin(date)) return;
    await this.flush();
  }

  /**
   * Row 1: the current and the next expiry that have not passed, as of `date`. With no expiry
   * known yet (the registry still resolving at boot) nothing starts, and the next step retries.
   */
  private begin(date: string): boolean {
    const want = this.expiries().filter(e => e >= date).sort().slice(0, 2);
    if (!want.length) return false;
    this.date = date;
    this.streams = want.map(expiry => {
      const poller = this.pollerFor(expiry);
      const s: Stream = { expiry, poller, off: () => {}, lastReq: null, count: 0, first: null, last: null, maxGap: 0 };
      s.off = poller.on(ev => { if (ev.type === 'snapshot') this.onSnapshot(s, ev.data); });
      poller.subscribe();
      return s;
    });
    return true;
  }

  /** Row 5: a snapshot re-emitted with the same request id (P7's peaks refresh) is not a new reading. */
  private onSnapshot(s: Stream, snap: Snapshot) {
    if (!this.date || snap.requestId === s.lastReq || snap.replay) return;
    s.lastReq = snap.requestId;
    const rec = toRecord(snap);
    if (s.last !== null) s.maxGap = Math.max(s.maxGap, rec.t - s.last);
    s.first ??= rec.t;
    s.last = rec.t;
    s.count++;
    const f = this.file(s.expiry);
    const b = this.buf.get(f) ?? [];
    b.push(JSON.stringify(rec));
    this.buf.set(f, b);
  }

  private flush(): Promise<void> {
    for (const [f, lines] of this.buf) {
      if (!lines.length) continue;
      const text = lines.join('\n') + '\n';
      this.buf.set(f, []);
      this.writing = this.writing.then(() => this.write(f, text)).catch(e => console.error(`[chains] write failed: ${(e as Error).message}`));
    }
    return this.writing;
  }

  /** The window closed: write what is buffered, the counts, and let the pollers go. */
  private async finish() {
    await this.flush();
    const rows = this.streams.map(s => ({ expiry: s.expiry, snapshots: s.count, first: s.first, last: s.last, maxGapMs: s.maxGap }));
    try {
      await mkdir(path.join(CHAIN_DIR, this.date!), { recursive: true });
      await writeFile(path.join(CHAIN_DIR, this.date!, 'summary.json'), JSON.stringify({ date: this.date, instrument: this.instrumentId, fields: ROW_FIELDS, strikesEachSide: STRIKES_EACH_SIDE, streams: rows }, null, 1));
    } catch (e) { console.error(`[chains] summary failed: ${(e as Error).message}`); }
    console.log(`[chains] ${this.date}: ${rows.map(r => `${r.expiry} ${r.snapshots} snapshots, max gap ${Math.round(r.maxGapMs / 1000)} s`).join('; ')}`);
    for (const s of this.streams) { s.off(); s.poller.unsubscribe(); }
    this.streams = [];
    this.date = null;
  }

  status() {
    return { date: this.date, streams: this.streams.map(s => ({ expiry: s.expiry, snapshots: s.count, lastAt: s.last })) };
  }
}
