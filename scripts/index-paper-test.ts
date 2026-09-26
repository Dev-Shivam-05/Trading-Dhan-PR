/**
 * `npm run ipaper:test` — P53's live index book (`docs/spec/index-paper-v1.md`).
 *
 * Real stored days (P48 chains + P50 index bars) are replayed through the LIVE core with an injected clock: one
 * snapshot per minute at :59 (the minute's last), the minute's index bar walked as ticks (open, then the low and the
 * high in the order the candle implies, then the close), and the clock ticked at each minute's start. Option legs tick
 * at their minute close. AC6 (the replay server) and AC8 (Monday live) are measured elsewhere.
 */

import { readFileSync } from 'node:fs';
import { readDay, storedDays, type ChainDay } from '../src/server/chainhist.ts';
import { readIdx, byDate, type IdxDay } from '../src/server/idxhist.ts';
import { daySignals } from '../src/server/ltp-lines.ts';
import { tradeDay, prepareDay, DEFAULT_CFG } from '../src/server/ltp-backtest.ts';
import { hmOf } from '../src/server/ltp-state.ts';
import { IndexCore, MinuteBuilder, type SnapLite, type Touch } from '../src/server/index-paper.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

const INDEX_ID = 13;
/** Session minutes of a stored day as live snapshots: cumulative volume, the minute's last reading. */
function snapshotsOf(day: ChainDay): SnapLite[] {
  const cum: Record<string, number> = {};
  const out: SnapLite[] = [];
  for (let i = 0; i < day.t.length; i++) {
    for (const [k, l] of Object.entries(day.legs)) cum[k] = (cum[k] ?? 0) + (l.v[i] ?? 0);
    const hm = hmOf(day.t[i]!);
    if (hm < '09:15' || hm > '15:29') continue;
    const strikes = [...new Set(Object.keys(day.legs).map(k => Number(k.slice(0, -2))))].sort((a, b) => a - b);
    const side = (k: string) => {
      const l = day.legs[k];
      const c = l?.c[i] ?? null;
      return { ltp: c, volume: c === null ? null : cum[k] ?? 0, oi: c === null ? null : l!.oi[i] ?? null, iv: c === null ? null : l!.iv[i] ?? null };
    };
    out.push({ t: day.t[i]! + 59_000, spot: day.spot[i] ?? NaN, atm: day.atm[i] ?? null, rows: strikes.map(s => ({ strike: s, ce: side(`${s}CE`), pe: side(`${s}PE`) })) });
  }
  return out;
}
/** A stand-in for the instrument master: a strike's securityId is strike*10 + (PE ? 1 : 0). */
const optionId = (_: string, strike: number, type: 'CE' | 'PE') => strike * 10 + (type === 'PE' ? 1 : 0);

/** Replays one day through a live core; returns the core. `stopAt` (hm) ends the replay early (AC5). */
function replay(day: ChainDay, idx: IdxDay | undefined, core = new IndexCore({ mode: 'replay', lot: () => 65, expiry: () => '2099-01-01', optionId, indexId: INDEX_ID }), stopAt = '99:99') {
  core.begin(day.date);
  const snaps = snapshotsOf(day);
  for (const s of snaps) {
    const t0 = s.t - 59_000;
    if (hmOf(t0) >= stopAt) break;
    core.onClock(t0 + 500);                          // the previous minute is finalised a moment into this one
    const bar = idx?.get(t0) ?? { o: s.spot, h: s.spot, l: s.spot, c: s.spot };
    const path = bar.c >= bar.o ? [bar.o, bar.l, bar.h, bar.c] : [bar.o, bar.h, bar.l, bar.c];
    // The option legs tick at the minute's close, just before the index path starts moving (so a touch has a price).
    for (const r of s.rows) for (const [side, x] of [['CE', r.ce], ['PE', r.pe]] as const) {
      if (x.ltp !== null) core.onTick(optionId('', r.strike, side), x.ltp, t0 + 900);
    }
    path.forEach((px, k) => core.onTick(INDEX_ID, px, t0 + 1_000 + k * 15_000));
    core.onSnapshot(s, s.t);
  }
  core.onClock(Date.parse(`${day.date}T15:31:00Z`) - 5.5 * 3600_000);
  return core;
}

const idxS = await readIdx();
const days = await storedDays(1);
if (!idxS || !days.length) ok('UNMEASURED: no stored chains or index history', false);
else {
  const idx = byDate(idxS);

  /* AC1: the minute builder */
  {
    const date = '2024-06-04';
    const day = (await readDay(date))!;
    const b = new MinuteBuilder(date);
    for (const s of snapshotsOf(day)) b.add(s);
    b.flush(Date.parse(`${date}T23:00:00Z`));
    const a = daySignals(day, idx.get(date)), c = daySignals(b.day, idx.get(date));
    const pick = (d: typeof a) => JSON.stringify({ l920: d.l920, sig: d.signals, ai: d.ai.map(x => x && { R: x.R, S: x.S, v: x.value, d: [...x.drawn] }), v: d.states.map(s => s.verdict) });
    ok('AC1 the minute builder\'s ChainDay gives the same 920 lines, AI lines, verdicts and signals as the stored day (4 Jun 2024)', pick(a) === pick(c), `${a.signals.length} signals, ${b.day.t.length} minutes`);
    let vOk = true;
    for (const [k, l] of Object.entries(b.day.legs)) {
      const orig = day.legs[k]!, off = day.t.indexOf(b.day.t[0]!);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < l.v.length; i++) { s1 += l.v[i] ?? 0; s2 += orig.v[off + i] ?? 0; if (Math.abs(s1 - s2) > 1e-6 && l.c[i] !== null) vOk = false; }
    }
    ok('AC1 per-minute volume recovered from the cumulative, to the unit, on every leg', vOk);
  }

  /* AC2-AC4 over a month of real days */
  // Picked from P51's own trades (the data's rule, not the screen's): days where the backtest records a 920 target,
  // an AI target and an AI state exit, two 920 time exits, a busy day, plus an ordinary week (1-7 Aug 2026).
  const picked = ['2026-05-05', '2026-05-12', '2026-05-26', '2024-04-25', '2024-11-14', '2025-08-07', '2025-09-22', '2026-08-24', '2026-08-25', '2026-08-31', '2026-09-15'];
  const month = [...new Set([...picked, ...days.filter(d => d >= '2026-08-01' && d <= '2026-08-07')])].filter(d => days.includes(d)).sort();
  const outcomes = new Map<string, number>(), reasons = new Map<string, number>();
  let firstSame = 0, firstTotal = 0; const firstDiff: string[] = [];
  let allSame = 0, allTotal = 0;
  const t0 = Date.now();
  for (const date of month) {
    const day = (await readDay(date))!;
    const core = replay(day, idx.get(date));
    const touches: Touch[] = core.ledger.days[date]?.touches ?? [];
    for (const t of touches) outcomes.set(t.outcome, (outcomes.get(t.outcome) ?? 0) + 1);
    for (const p of core.ledger.positions) reasons.set(p.reason ?? 'open', (reasons.get(p.reason ?? 'open') ?? 0) + 1);
    // AC4: the live book's entries against P51's `touch` trades.
    const dl = daySignals(day, idx.get(date));
    const book = prepareDay(dl, day);
    for (const [bk, cfg] of [['920', DEFAULT_CFG], ['ai', { ...DEFAULT_CFG, book: 'ai' as const }]] as const) {
      const bt = tradeDay(book, cfg, 'touch').trades.map(t => `${t.line}@${t.hm}`);
      const lv = core.ledger.positions.filter(p => p.book === bk).map(p => `${p.line}@${hmOf(p.entryAt)}`);
      if (bt.length || lv.length) {
        firstTotal++;
        if (bt[0] === lv[0]) firstSame++; else if (firstDiff.length < 6) firstDiff.push(`${date} ${bk}: backtest ${bt[0] ?? '-'} vs live ${lv[0] ?? '-'}`);
        allTotal++; if (JSON.stringify(bt) === JSON.stringify(lv)) allSame++;
      }
    }
  }
  console.log(`      (${month.length} days replayed through the live core in ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(`      touches by outcome: ${[...outcomes].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`      exits by reason: ${[...reasons].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  ok('AC2 the live book opens positions from tick touches', (outcomes.get('accepted') ?? 0) > 0, `${outcomes.get('accepted') ?? 0} accepted`);
  ok('AC2 a second touch of a used line is refused as "used"', (outcomes.get('used') ?? 0) > 0);
  for (const v of ['window', 'ratio']) ok(`AC3 veto "${v}" rejects a touch`, (outcomes.get(v) ?? 0) > 0, `${outcomes.get(v) ?? 0}`);
  for (const r of ['target', 'stop', 'time', 'state']) ok(`AC3 exit "${r}" occurs`, (reasons.get(r) ?? 0) > 0, `${reasons.get(r) ?? 0}`);
  ok('AC2 a touch while the book is open is "busy"', (outcomes.get('busy') ?? 0) > 0, `${outcomes.get('busy') ?? 0}`);
  console.log(`      INFO  "side" ${outcomes.get('side') ?? 0} (P50 measured 2 in 680 days)`);
  ok('AC4 the first entry of each book each day is the backtest\'s (line and minute)', firstTotal > 0 && firstSame === firstTotal, `${firstSame}/${firstTotal}${firstDiff.length ? ': ' + firstDiff.join('; ') : ''}`);
  console.log(`      INFO  whole entry lists identical on ${allSame}/${allTotal} book-days (the rest differ in busy/exit timing: live exits on ticks inside the entry minute)`);

  /* AC5: a restart at 11:00 */
  {
    const date = month[3]!;
    const day = (await readDay(date))!;
    const I = idx.get(date);
    const full = replay(day, I, undefined, '11:00');
    const saved = JSON.parse(JSON.stringify(full.builder!.day)) as ChainDay;
    const savedIdx = new Map([...full.idx].map(([k, v]) => [k, { ...v }]));
    const again = new IndexCore({ mode: 'replay', lot: () => 65, expiry: () => '2099-01-01', optionId, indexId: INDEX_ID }, JSON.parse(JSON.stringify(full.ledger)));
    again.begin(date, saved, savedIdx);
    const pick = (c: IndexCore) => JSON.stringify({ l: c.dl?.l920, ai: c.dl?.ai.at(-1) && { v: c.dl.ai.at(-1)!.value, d: [...c.dl.ai.at(-1)!.drawn] }, verdict: c.dl?.states.at(-1)?.verdict, used: c.ledger.days[date]?.used });
    ok(`AC5 a book rebuilt at 11:00 from the saved minute columns matches the one that never stopped (${date})`, pick(full) === pick(again), `${saved.t.length} minutes`);
  }

  /* AC7 */
  const src = readFileSync(new URL('../src/server/index-paper.ts', import.meta.url), 'utf8');
  ok('AC7 index-paper.ts imports nothing from dhan.ts (no order endpoint exists to reach)', !/from '\.\/dhan\.ts'/.test(src));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
