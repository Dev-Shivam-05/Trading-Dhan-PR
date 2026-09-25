/**
 * P41 (`docs/spec/phone-sandbox-v1.md` rows 4-7) — replay a past day tick by tick through the SAME
 * `PaperTrader` the live server uses, with no way to see ahead.
 *
 * How look-ahead is ruled out by construction, not by care:
 *  - the trader's clock is the sandbox clock, which only moves forward, one tick or one 1 s step
 *    at a time;
 *  - the only prices it ever receives are ticks already delivered;
 *  - the 5-minute candles it asks for are built from those delivered ticks. History supplies only
 *    candles of EARLIER sessions (SMA context), and a candle's OI only once that candle has closed;
 *  - the 09:20 scan is withheld until the sandbox clock reaches the scan's own timestamp.
 * `npm run sandbox:test` proves it: a day cut at time T makes identical decisions before T (row 6).
 */

import { readFile, mkdir, readdir, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { CACHE_DIR } from './paths.ts';
import {
  PaperTrader, emptyLedger, NO_RULES, CANDLE_MS,
  type Bar, type CandleAnswer, type Ledger, type OptionPick, type PaperEvent, type RiskRules,
} from './paper.ts';
import type { NseScanResult } from './scanner-nse.ts';
import type { Credentials } from './dhan.ts';
import { TICK_DIR, nearestStrikes, type RecInstrument } from './ticks.ts';
import { HistoryData, ensureM1, proxyInputs, realScan, readHistoryJson, HISTORY_DIR } from './history.ts';
import { at, ist, proxyScan, type Contract } from './backtest.ts';
import { parseFnoList } from './scanner-nse.ts';

export const SANDBOX_DIR = path.join(CACHE_DIR, 'sandbox');
/** Row 7. `0` means as fast as the machine allows. */
export const SPEEDS = [1, 10, 60, 0] as const;
export type Speed = (typeof SPEEDS)[number];
const FROM_MIN = 9 * 60 + 14;
const UNTIL_MIN = 15 * 60 + 31;
/** Row 4: a synthetic candle becomes four ticks this far apart. */
const SYNTH_STEP_MS = 15_000;
/** Row 5: a proxy scan is built from the 09:20 one-minute close, known at 09:21:00. */
const PROXY_SCAN_MIN = 9 * 60 + 21;

export type SandboxTick = { t: number; securityId: number; ltp: number; oi: number | null };
export type SandboxDay = {
  date: string;
  source: 'recorded' | 'synthetic';
  scan: NseScanResult;
  scanKind: 'real' | 'proxy';
  /** Row 5: the scan is not handed out before this instant. */
  scanAt: number;
  ticks: SandboxTick[];
  /** Earlier sessions' 5-minute candles per future (SMA context), and today's closed-candle OI. */
  context: Map<number, Bar[]>;
  closedOi: Map<number, Map<number, number>>;
  contracts: Map<string, Contract>;
  options: Map<string, OptionPick[]>;
};

/* ------------------------------------------------------------ synthetic ticks */

/**
 * Row 4: one 1-minute candle as four ticks, 15 s apart: open, then the extreme the candle's colour
 * implies first (an up candle dips before it rallies), then the other, then the close.
 */
export function synthTicks(securityId: number, c: { t: number; o: number; h: number; l: number; c: number }): SandboxTick[] {
  const path_ = c.c >= c.o ? [c.o, c.l, c.h, c.c] : [c.o, c.h, c.l, c.c];
  return path_.map((ltp, i) => ({ t: c.t + i * SYNTH_STEP_MS, securityId, ltp, oi: null }));
}

/* ------------------------------------------------------------ 5-minute candles from delivered ticks */

export class BarBook {
  private bars = new Map<number, Map<number, Bar>>();
  push(k: SandboxTick) {
    const t = Math.floor(k.t / CANDLE_MS) * CANDLE_MS;
    const m = this.bars.get(k.securityId) ?? new Map<number, Bar>();
    this.bars.set(k.securityId, m);
    const b = m.get(t);
    if (!b) m.set(t, { t, o: k.ltp, h: k.ltp, l: k.ltp, c: k.ltp });
    else { b.h = Math.max(b.h, k.ltp); b.l = Math.min(b.l, k.ltp); b.c = k.ltp; }
  }
  /** Earlier sessions (history) + today's candles so far, with OI only on candles already closed. */
  answer(day: SandboxDay, securityId: number, nowMs: number): Bar[] {
    const today = [...(this.bars.get(securityId)?.values() ?? [])].map(b => {
      const oi = b.t + CANDLE_MS <= nowMs ? day.closedOi.get(securityId)?.get(b.t) : undefined;
      return oi === undefined ? { ...b } : { ...b, oi };
    });
    return [...(day.context.get(securityId) ?? []), ...today].sort((a, b) => a.t - b.t);
  }
}

/* ------------------------------------------------------------ the run */

export type RunState = {
  id: string; date: string; source: SandboxDay['source']; scanKind: SandboxDay['scanKind'];
  status: 'running' | 'paused' | 'done' | 'failed' | 'stopped';
  speed: Speed; simNow: number; delivered: number; total: number; error: string | null; rules: RiskRules;
};

export type RunOpts = {
  id: string; file: string; speed: Speed; rules: RiskRules;
  onEvent?: (e: PaperEvent) => void;
  /** For the test: stop feeding at this instant (row 6's cut). */
  cutAt?: number;
};

export class SandboxRun {
  readonly state: RunState;
  trader: PaperTrader | null = null;
  private readonly day: SandboxDay;
  private readonly o: RunOpts;
  private paused = false;
  private stopped = false;
  private done: Promise<void> | null = null;

  constructor(day: SandboxDay, o: RunOpts) {
    this.day = day;
    this.o = o;
    this.state = {
      id: o.id, date: day.date, source: day.source, scanKind: day.scanKind, status: 'running', speed: o.speed,
      simNow: at(day.date, FROM_MIN), delivered: 0, total: day.ticks.length, error: null, rules: o.rules,
    };
  }

  pause() { if (this.state.status === 'running') { this.paused = true; this.state.status = 'paused'; } }
  resume() { if (this.state.status === 'paused') { this.paused = false; this.state.status = 'running'; } }
  stop() { this.stopped = true; this.paused = false; }
  setSpeed(s: Speed) { this.state.speed = s; }

  run(): Promise<void> {
    this.done ??= this.loop().catch(e => { this.state.status = 'failed'; this.state.error = (e as Error).message; });
    return this.done;
  }

  private async loop() {
    const day = this.day;
    const book = new BarBook();
    const end = Math.min(at(day.date, UNTIL_MIN), this.o.cutAt ?? Infinity);
    const s = this.state;

    // A fresh ledger in its own file: armed, with this run's rules. Never the live or replay file.
    await mkdir(path.dirname(this.o.file), { recursive: true });
    const l: Ledger = { ...emptyLedger('replay'), armed: true, armedAt: s.simNow, rules: this.o.rules };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(this.o.file, JSON.stringify(l));

    const trader = new PaperTrader({
      file: this.o.file, mode: 'replay', wall: () => s.simNow,
      lookup: (symbol) => {
        const c = day.contracts.get(symbol);
        return c ? { symbol, name: symbol, futureId: c.futureId, futureExpiry: c.expiry, lot: c.lot, problem: null } : undefined;
      },
      // Row 5: withheld until its own timestamp. Before that, the trader's retry rule (60 s) asks again.
      scan: async () => (s.simNow >= day.scanAt ? day.scan
        : ({ ...day.scan, error: `the ${day.scanKind} 09:20 scan is not available until ${ist(day.scanAt).hm}` } as NseScanResult)),
      candles: async (ask, nowMs): Promise<CandleAnswer> => ({ bars: book.answer(day, ask.securityId, nowMs), why: null }),
      options: (symbol) => day.options.get(symbol) ?? [],
      onWants: () => {},
      onEvent: this.o.onEvent,
    });
    this.trader = trader;
    await trader.load();

    let nextStep = s.simNow;
    let realStart = Date.now(), simStart = s.simNow, lastYield = Date.now();
    let i = 0;
    while (!this.stopped) {
      if (this.paused) { await sleep(200); realStart = Date.now(); simStart = s.simNow; continue; }
      const tick = day.ticks[i];
      const tickT = tick && tick.t < end ? tick.t : Infinity;
      const nextT = Math.min(nextStep, tickT);
      if (nextT >= end) break;
      // Pacing (row 7): hold the sandbox clock to `speed` x real time. 0 = no waiting.
      if (s.speed > 0) {
        const allowed = simStart + (Date.now() - realStart) * s.speed;
        if (nextT > allowed) { await sleep(Math.min(200, (nextT - allowed) / s.speed)); continue; }
      } else if (Date.now() - lastYield > 20) { await new Promise(r => setImmediate(r)); lastYield = Date.now(); }
      if (nextStep <= tickT) {
        s.simNow = nextStep;
        await trader.step();
        nextStep += 1000;
      } else {
        s.simNow = tick!.t;
        book.push(tick!);
        trader.onFeedTick({ seg: 'NSE_FNO', securityId: tick!.securityId, at: tick!.t, ltp: tick!.ltp, ltt: null, volume: null, oi: tick!.oi, open: null, high: null, low: null, close: null });
        i++;
        s.delivered = i;
      }
    }
    // The last clock step settles the day (15:15 square-off, unfilled at 15:00) unless it was cut.
    if (!this.stopped && this.o.cutAt === undefined) { s.simNow = end; await trader.step(); }
    s.status = this.stopped ? 'stopped' : 'done';
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------ building a day */

export async function recordedDates(): Promise<string[]> {
  try { return (await readdir(TICK_DIR)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort(); } catch { return []; }
}

/**
 * Rows 3-5: everything a sandbox day needs. Recorded ticks when the day was recorded; otherwise
 * synthetic ticks from 1-minute candles (fetched once into the P37 history store, which needs
 * `creds`). The scan is the real 09:20 scan when one was saved, else P37's proxy.
 */
export async function loadDay(date: string, creds: Credentials | null, say: (m: string) => void = () => {}): Promise<SandboxDay> {
  const data = await HistoryData.load();
  await data.preload();

  const real = await realScan(date);
  let scan: NseScanResult, scanKind: SandboxDay['scanKind'], scanAt: number;
  if (real) {
    scan = real.result; scanKind = 'real';
    const m = /(\d{2}):(\d{2}):(\d{2})\s*$/.exec(real.priceAsOf);
    scanAt = at(date, Number(m?.[1] ?? 9) * 60 + Number(m?.[2] ?? 20)) + Number(m?.[3] ?? 0) * 1000;
  } else {
    const list = parseFnoList(await readFile(path.resolve('data/fno-list.txt'), 'utf8'));
    const { rows, prevDate } = await proxyInputs(data, date);
    scan = proxyScan(date, prevDate ?? date, rows, list, 20);
    scan = { ...scan, market: { ...scan.market, priceAsOf: scan.market.priceAsOf.replace('09:20:00', '09:21:00') } };
    scanKind = 'proxy'; scanAt = at(date, PROXY_SCAN_MIN);
  }
  const symbols = [...scan.long, ...scan.short].map(r => r.symbol);

  const contracts = new Map<string, Contract>();
  const context = new Map<number, Bar[]>();
  const closedOi = new Map<number, Map<number, number>>();
  const options = new Map<string, OptionPick[]>();
  const dayStart = at(date, 0), dayEnd = at(date, 24 * 60);
  for (const sym of symbols) {
    const c = data.contract(sym, date);
    if (!c) continue;
    contracts.set(sym, c);
    const all = data.futAll(c.futureId);
    context.set(c.futureId, all.filter(b => b.t < dayStart).map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, ...(b.oi ? { oi: b.oi } : {}) })));
    closedOi.set(c.futureId, new Map(all.filter(b => b.t >= dayStart && b.t < dayEnd && b.oi).map(b => [b.t, b.oi!])));
  }

  let ticks: SandboxTick[] = [];
  let source: SandboxDay['source'] = 'synthetic';
  const recDir = path.join(TICK_DIR, date);
  // A closed day may be gzipped (`scripts/ticks-pack.ts`): a recorded day is ~1.2 GB as CSV, ~10x less packed.
  const exists = (f: string) => access(path.join(recDir, f)).then(() => true, () => false);
  const plain = await exists('ticks.csv');
  const recorded = plain || await exists('ticks.csv.gz');
  if (recorded) {
    source = 'recorded';
    const inst = JSON.parse(await readFile(path.join(recDir, 'instruments.json'), 'utf8')) as RecInstrument[];
    const want = new Set<number>();
    for (const sym of symbols) {
      const mine = inst.filter(i => i.symbol === sym);
      for (const i of mine) want.add(i.securityId);
      options.set(sym, mine.filter(i => i.kind !== 'FUT').map(i => ({ strike: i.strike!, optionType: i.kind as 'CE' | 'PE', securityId: i.securityId, lot: i.lot, expiry: i.expiry })));
    }
    const rl = createInterface({ input: plain ? createReadStream(path.join(recDir, 'ticks.csv')) : createReadStream(path.join(recDir, 'ticks.csv.gz')).pipe(createGunzip()) });
    for await (const line of rl) {
      const f = line.split(',');
      const id = Number(f[3]), ltp = Number(f[4]);
      if (!want.has(id) || !(ltp > 0)) continue;
      ticks.push({ t: Number(f[0]), securityId: id, ltp, oi: f[6] ? Number(f[6]) : null });
    }
  } else {
    if (!creds) throw new Error(`${date} was not recorded, and synthetic ticks need Dhan credentials to fetch 1-minute candles`);
    const log = { calls: 0, failed: [] as string[] };
    for (const sym of symbols) {
      const c = contracts.get(sym);
      if (!c) continue;
      await ensureM1(creds, log, c.futureId, 'FUTSTK', date, date);
      await data.loadM1([c.futureId]);
      const fm1 = (data.m1(c.futureId) ?? []).filter(k => k.t >= dayStart && k.t < dayEnd);
      // Row 3's rule, applied to the synthetic day: the 5 CE and 5 PE nearest the 09:20 price.
      const p0920 = fm1.find(k => ist(k.t).hm === '09:20')?.o;
      const opts = p0920 === undefined ? [] : [...nearestStrikes(data.options(sym, c.expiry), p0920, 'CE'), ...nearestStrikes(data.options(sym, c.expiry), p0920, 'PE')];
      options.set(sym, opts);
      for (const o of opts) await ensureM1(creds, log, o.securityId, 'OPTSTK', date, date);
      await data.loadM1(opts.map(o => o.securityId));
      for (const id of [c.futureId, ...opts.map(o => o.securityId)]) {
        for (const k of (data.m1(id) ?? []).filter(k => k.t >= dayStart && k.t < dayEnd)) ticks.push(...synthTicks(id, k));
      }
    }
    say(`sandbox ${date}: synthetic ticks for ${symbols.length} signals, ${log.calls} Dhan calls${log.failed.length ? `, failed: ${log.failed.join('; ')}` : ''}`);
  }
  ticks = ticks.sort((a, b) => a.t - b.t || a.securityId - b.securityId);
  return { date, source, scan, scanKind, scanAt, ticks, context, closedOi, contracts, options };
}

/* ------------------------------------------------------------ one run at a time, for the routes */

export class SandboxManager {
  private run_: SandboxRun | null = null;
  private seq = 0;
  private readonly deps: { creds: Credentials | null; onEvent?: (e: PaperEvent) => void };
  constructor(deps: { creds: Credentials | null; onEvent?: (e: PaperEvent) => void }) { this.deps = deps; }

  current() { return this.run_; }

  async start(date: string, speed: Speed, rules: RiskRules): Promise<RunState> {
    this.run_?.stop();
    const id = `${date}-${Date.now()}-${++this.seq}`;
    const day = await loadDay(date, this.deps.creds, m => console.log(`[sandbox] ${m}`));
    const run = new SandboxRun(day, { id, file: path.join(SANDBOX_DIR, id, 'ledger.json'), speed, rules, onEvent: this.deps.onEvent });
    this.run_ = run;
    void run.run();
    return run.state;
  }

  view() {
    const r = this.run_;
    if (!r) return { run: null, view: null };
    return { run: r.state, view: r.trader?.view() ?? null };
  }
}

/** Dates the sandbox can replay: recorded days, and every session the P37 history holds. */
export async function sandboxDates(): Promise<{ date: string; source: 'recorded' | 'synthetic' }[]> {
  const rec = new Set(await recordedDates());
  const hist = (await readHistoryJson<{ sessions: { date: string }[] }>('report.json'))?.sessions.map(s => s.date) ?? [];
  const all = [...new Set([...rec, ...hist])].sort().reverse();
  return all.map(date => ({ date, source: rec.has(date) ? 'recorded' as const : 'synthetic' as const }));
}

export { NO_RULES, HISTORY_DIR };
