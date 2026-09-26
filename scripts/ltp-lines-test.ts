/**
 * `npm run ltplines:test` — P50's line sets (`docs/spec/ltp-lines-v1.md`).
 *
 * AC1-AC5 run on hand-built chains and a hand-built day; AC1's order count, AC5's real-data half, AC6-AC8 run on
 * every stored NIFTY day (P48) with the index path (`npm run idxhist`). Without those files they print
 * UNMEASURED and the run fails — an absent measurement is not a pass. AC10 is the other suites and tsc.
 *
 * AC7's second implementation is built another way: the 920 lines straight from the raw legs of the 09:20
 * candle, and "is this the first touch?" answered by looking BACK over every earlier minute.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readDay, storedDays, type ChainDay, type Leg } from '../src/server/chainhist.ts';
import { readIdx, byDate, type IdxDay } from '../src/server/idxhist.ts';
import { readChain } from '../src/server/ltp.ts';
import { newAcc, accumulate, snapshotAt, hmOf } from '../src/server/ltp-state.ts';
import * as P from '../src/server/ltp-lines.ts';
import type { Row } from '../src/server/derive.ts';
import type { Signal, Veto, Buy } from '../src/server/ltp-lines.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const r2 = (x: number) => Math.round(x * 100) / 100;

/* ------------------------------------------------------------------ a hand-built chain */

// Spot 23210 sits between 23200 and 23250. Call volume/OI peak at 23350 (resistance), put at 23100 (support);
// everything else carries 30% of the leader, so both levels are strong and built on both factors.
const STRIKES = Array.from({ length: 13 }, (_, i) => 22900 + 50 * i);   // 22900 .. 23500
const SPOT = 23210;
const tv = (k: number) => Math.max(5, 120 - Math.abs(k - 23225) * 0.4);
const ceLtp = (k: number) => r2(Math.max(0, SPOT - k) + tv(k));
const peLtp = (k: number) => r2(Math.max(0, k - SPOT) + tv(k));
const R_K = 23350, S_K = 23100;
const cVol = (k: number) => (k === R_K ? 1000 : 300), pVol = (k: number) => (k === S_K ? 1000 : 300);
const EMPTYSIDE = { ltpChg: null, ltpChgPct: null, iv: null, volChgPct: null, oiChg: null, oiChgPct: null, delta: null, gamma: null, theta: null, vega: null };
const rows: Row[] = STRIKES.map(k => ({
  strike: k,
  ce: { ...EMPTYSIDE, ltp: ceLtp(k), volume: cVol(k), oi: cVol(k) * 10 },
  pe: { ...EMPTYSIDE, ltp: peLtp(k), volume: pVol(k), oi: pVol(k) * 10 },
}));
const reading = readChain({ spot: SPOT, rows });

/* ------------------------------------------------------------------ AC1: the arithmetic */

{
  const L = P.lines920(reading, rows, SPOT);
  const v = Object.fromEntries(L.lines.map(l => [l.name, l.value]));
  ok('AC1 fixture levels are where they were built: R 23350, S 23100', L.R === R_K && L.S === S_K, `R ${L.R} S ${L.S}`);
  ok('AC1 EOR+1 = 23400 + C(23400)', v['EOR+1'] === 23400 + ceLtp(23400), `${v['EOR+1']}`);
  ok('AC1 EOR = 23350 + C(23350)', v['EOR'] === 23350 + ceLtp(23350), `${v['EOR']}`);
  ok('AC1 EOS = 23100 - P(23100)', v['EOS'] === 23100 - peLtp(23100), `${v['EOS']}`);
  ok('AC1 EOS-1 = 23050 - P(23050)', v['EOS-1'] === 23050 - peLtp(23050), `${v['EOS-1']}`);
  ok('AC1 stop for puts = EOR+2 = 23450 + C(23450)', L.stopPut === 23450 + ceLtp(23450), `${L.stopPut}`);
  ok('AC1 stop for calls = EOS-2 = 23000 - P(23000)', L.stopCall === 23000 - peLtp(23000), `${L.stopCall}`);
  const divs = [23150, 23200, 23250, 23300].flatMap(k => [k + ceLtp(k), k - peLtp(k)]).sort((a, b) => a - b);
  ok('AC1 divergences = both reversals of 23150..23300, nothing else', JSON.stringify(L.divergences) === JSON.stringify(divs));
  const eos = v['EOS']!, eor = v['EOR']!;
  ok('AC1 a call at EOS targets the nearest divergence above it', L.lines[2]!.target === divs.find(d => d > eos + 0.05), `${L.lines[2]!.target}`);
  ok('AC1 a put at EOR targets the nearest divergence below it', L.lines[1]!.target === [...divs].reverse().find(d => d < eor - 0.05), `${L.lines[1]!.target}`);
  ok('AC1 gap width = EOR - EOS', L.gapWidth === eor - eos);
  // With S and R on the same strike there is no divergence: the target falls back to the next line (V48, V11).
  const same = rows.map(r => (r.strike === 23250 ? { ...r, ce: { ...r.ce, volume: 5000, oi: 50000 }, pe: { ...r.pe, volume: 5000, oi: 50000 } } : r));
  const Ls = P.lines920(readChain({ spot: SPOT, rows: same }), same, SPOT);
  ok('AC1 same-strike S/R: no divergence, EOS targets EOR (the next line)', Ls.R === 23250 && Ls.S === 23250 && Ls.divergences.length === 0 && Ls.lines[2]!.target === Ls.lines[1]!.value);
}

/* ------------------------------------------------------------------ AC2: missing lines */

{
  const eor = 23350 + ceLtp(23350);
  const up = P.lines920(reading, rows, eor);      // 09:20 closed ON the extension of resistance
  ok('AC2 close >= EOR: EOR missing (beyond)', up.lines[1]!.missing === 'beyond');
  ok('AC2 close >= EOR: EOR+1 still drawn (close below it)', up.lines[0]!.missing === null);
  const up2 = P.lines920(reading, rows, 23400 + ceLtp(23400) + 1);
  ok('AC2 close above EOR+1: both upper lines missing, both lower drawn', up2.lines[0]!.missing === 'beyond' && up2.lines[1]!.missing === 'beyond' && !up2.lines[2]!.missing && !up2.lines[3]!.missing);
  const lo = P.lines920(reading, rows, SPOT);
  ok('AC2 close between the lines: all four drawn (the accepting branch)', lo.lines.every(l => l.missing === null));
  const eos = 23100 - peLtp(23100);
  ok('AC2 close <= EOS: EOS missing', P.lines920(reading, rows, eos).lines[2]!.missing === 'beyond');
  const noStop = rows.filter(r => r.strike !== 23450);
  ok('AC2 no EOR+2 leg: both put lines missing (no-stop), calls unaffected', (() => {
    const x = P.lines920(readChain({ spot: SPOT, rows: noStop }), noStop, SPOT);
    return x.lines[0]!.missing === 'no-stop' && x.lines[1]!.missing === 'no-stop' && !x.lines[2]!.missing;
  })());
}

/* ------------------------------------------------------------------ AC3: scenario -> line set */

{
  const S4 = ['S Max Gain', 'S Risky', 'S Moderate', 'S Max Pain'], R4 = ['R Max Pain', 'R Moderate', 'R Risky', 'R Max Gain'];
  const want: [number | null, string | null, string[], boolean, boolean][] = [
    [1, 'neutral', [], false, false],
    [2, 'slightly bearish', [...R4, 'S Risky', 'S Max Gain', 'S Max Pain'], false, true],
    [3, 'slightly bullish', [...S4, 'R Risky', 'R Max Gain', 'R Max Pain'], true, false],
    [4, 'slightly bearish', [...R4, 'S Risky', 'S Max Gain', 'S Max Pain'], false, true],
    [5, 'slightly bullish', [...S4, 'R Risky', 'R Max Gain', 'R Max Pain'], true, false],
    [6, 'blood bath', R4, false, true],
    [7, 'bull run', S4, true, false],
    [8, 'both sides risky (8)', [...S4, ...R4], true, true],
    [9, 'both sides risky (9)', [...S4, ...R4].filter(n => !n.includes('Moderate')), true, true],
    [9, 'bullish SOC 1R', S4, true, false],
    [8, 'bearish SOC 2R', R4, false, true],
  ];
  for (const [sc, verdict, lines, ce, pe] of want) {
    const d = P.drawnFor(sc, verdict);
    ok(`AC3 ${verdict} (${sc}): ${lines.length} lines, CE ${ce ? 'yes' : 'no'}, PE ${pe ? 'yes' : 'no'}`,
      JSON.stringify([...d.drawn].sort()) === JSON.stringify([...lines].sort()) && d.permit.CE === ce && d.permit.PE === pe);
  }
}

/* ------------------------------------------------------------------ a hand-built day (AC4, AC5) */

const IST = 5.5 * 3600_000;
const T0 = Date.parse('2026-09-24T09:15:00Z') - IST;
const N = 120;                                    // 09:15 .. 11:14
const tAt = (m: number) => T0 + m * 60_000;
function buildDay(): ChainDay {
  const t = Array.from({ length: N }, (_, m) => tAt(m));
  const legs: Record<string, Leg> = {};
  const col = (x: number) => t.map(() => x);
  for (const k of STRIKES) {
    legs[`${k}CE`] = { o: col(ceLtp(k)), h: col(ceLtp(k)), l: col(ceLtp(k)), c: col(ceLtp(k)), v: col(cVol(k)), oi: col(cVol(k) * 10), iv: col(12) };
    legs[`${k}PE`] = { o: col(peLtp(k)), h: col(peLtp(k)), l: col(peLtp(k)), c: col(peLtp(k)), v: col(pVol(k)), oi: col(pVol(k) * 10), iv: col(12) };
  }
  return { date: '2026-09-24', code: 1, t, spot: col(SPOT), atm: col(23200), legs, conflicts: 0 };
}
function buildIdx(bars: Record<string, { h?: number; l?: number; c?: number }>): IdxDay {
  const m: IdxDay = new Map();
  for (let i = 0; i < N; i++) {
    const hm = hmOf(tAt(i)), b = bars[hm] ?? {};
    m.set(tAt(i), { o: SPOT, h: b.h ?? SPOT, l: b.l ?? SPOT, c: b.c ?? SPOT });
  }
  return m;
}

{
  const eos = 23100 - peLtp(23100), eor = 23350 + ceLtp(23350);
  const day = buildDay();
  const d = P.daySignals(day, buildIdx({
    '10:00': { l: eos - 1, c: SPOT - 5 },          // low pierces EOS, close stays far above it
    '10:10': { l: eos - 0.5 },                      // the second touch
    '10:20': { h: eor + 2 },                        // EOR touched from below
  }));
  const s920 = d.signals.filter(s => s.kind === '920');
  const at = (hm: string, line: string) => s920.find(s => s.hm === hm && s.line === line);
  ok('AC4 a low through the line with the close far above it IS a touch', !!at('10:00', 'EOS'), `close ${SPOT - 5} vs EOS ${eos}`);
  ok('AC4 the second touch of the same line is "used", not a trade', at('10:10', 'EOS')?.veto === 'used');
  ok('AC4 a high through an upper line is a touch (EOR from below)', !!at('10:20', 'EOR'));
  ok('AC4 nothing else touched: 3 signals', s920.length === 3, s920.map(s => `${s.hm} ${s.line}`).join(', '));
  // Price already below the line at the end of the previous minute: the low being under it is not a touch.
  ok('AC4 a line approached from the wrong side is never touched', !P.touched(eos - 10, { h: eos - 5, l: eos - 20 }, eos, 'CE') && P.touched(eos + 10, { h: eos + 12, l: eos - 1 }, eos, 'CE'));
  // A touch after 11:29 is outside the 920 window.
  const late = P.daySignals(buildDay(), buildIdx({ '11:05': { l: eos - 1 } }));
  ok('AC5 (a) window: a 920 touch at 11:05 is accepted-or-priced, at 11:30 it would be "window"', late.signals[0]?.veto !== 'window'
    && P.vetoOf({ hm: '11:30', lastHm: P.L920_LAST_ENTRY_HM, usedBefore: false, permitted: true, buy: 'CE', entry: 100, stop: 90, target: 120, ivBad: false }) === 'window');
}

/* ------------------------------------------------------------------ AC5: every veto on a fixture */

{
  const base = { hm: '10:00', lastHm: '11:29', usedBefore: false, permitted: true, buy: 'CE' as Buy, entry: 100, stop: 80 as number | null, target: 130 as number | null, ivBad: false };
  const cases: [string, Partial<typeof base>, Veto | null][] = [
    ['accepted: stop 20 below, target 30 above', {}, null],
    ['(a) window', { hm: '11:30' }, 'window'],
    ['(b) used', { usedBefore: true }, 'used'],
    ['(c) side', { permitted: false }, 'side'],
    ['(d) no stop', { stop: null }, 'no-stop'],
    ['(e) stop on the entry', { stop: 99.97 }, 'stop-on-entry'],
    ['(e) stop through the entry (a call stop above the entry)', { stop: 101 }, 'stop-on-entry'],
    ['(f) no target', { target: null }, 'target'],
    ['(f) target on the entry', { target: 100.02 }, 'target'],
    ['(g) ratio: stop 30 > target 20', { stop: 70, target: 120 }, 'ratio'],
    ['(g) boundary: stop 20 = target 20 passes', { stop: 80, target: 120 }, null],
    ['(h) IV gate on', { ivBad: true }, 'iv'],
    ['put mirror accepted', { buy: 'PE', stop: 120, target: 70 }, null],
    ['put mirror ratio', { buy: 'PE', stop: 140, target: 70 }, 'ratio'],
  ];
  for (const [name, over, want] of cases) {
    const got = P.vetoOf({ ...base, ...over });
    ok(`AC5 fixture ${name}`, got === want, `got ${got}`);
  }
}

/* ------------------------------------------------------------------ real data */

const idxS = await readIdx();
const days = await storedDays(1);
if (!idxS || !days.length) {
  ok('AC1/AC5-real/AC6/AC7/AC8 UNMEASURED: no index history or no stored chains (npm run idxhist, npm run chainhist)', false);
} else {
  const idx = byDate(idxS);

  /** AC7: the second implementation. Raw legs at the 09:20 candle; first touch by looking back. */
  function second(day: ChainDay, I: IdxDay | undefined, swap = false): string[] {
    const acc = newAcc();
    let i0 = -1;
    for (let i = 0; i < day.t.length; i++) { accumulate(acc, day, i); if (hmOf(day.t[i]!) === '09:20') { i0 = i; break; } }
    if (i0 < 0) return ['not ready'];
    const rd = readChain(snapshotAt(day, i0, acc));
    if (!rd.pair || !rd.resistance || !rd.support) return ['not ready'];
    const R = rd.resistance.strike, S = rd.support.strike;
    const ks = Object.keys(day.legs).map(k => Number(k.slice(0, -2))).filter((k, j, a) => a.indexOf(k) === j).sort((a, b) => a - b);
    const stepGaps = ks.slice(1).map((k, j) => k - ks[j]!).sort((a, b) => a - b);
    const hasC = (k: number, s: 'CE' | 'PE') => day.legs[`${k}${s}`]?.c[i0] ?? null;
    // The ladder the engine sees is the strikes with a close at 09:20, so the step is taken from those.
    const live = ks.filter(k => hasC(k, 'CE') !== null || hasC(k, 'PE') !== null);
    const g = live.slice(1).map((k, j) => k - live[j]!).sort((a, b) => a - b);
    const step = g.length ? g[g.length >> 1]! : (stepGaps[stepGaps.length >> 1] ?? 50);
    const rc = (k: number) => { const c = hasC(k, 'CE'); return c === null ? null : k + c; };
    const rp = (k: number) => { const c = hasC(k, 'PE'); return c === null ? null : k - c; };
    const lines = [
      { n: 'EOR+1', v: rc(R + step), up: true }, { n: 'EOR', v: rc(R), up: true },
      { n: 'EOS', v: rp(S), up: false }, { n: 'EOS-1', v: rp(S - step), up: false },
    ];
    const stopUp = swap ? rp(S - 2 * step) : rc(R + 2 * step), stopDn = swap ? rc(R + 2 * step) : rp(S - 2 * step);
    const divs: number[] = [];
    for (const k of live) if (k > Math.min(S, R) && k < Math.max(S, R)) for (const v of [rc(k), rp(k)]) if (v !== null) divs.push(v);
    const vals = lines.map(l => l.v).filter((v): v is number => v !== null);
    // The session minutes with their index bars, exactly as the engine assembles them.
    const mins: { t: number; hm: string; h: number; l: number; c: number }[] = [];
    for (let i = 0; i < day.t.length; i++) {
      const t = day.t[i]!, hm = hmOf(t);
      if (hm > '15:29') break;
      if (hm < '09:15') continue;
      const b = I?.get(t), sp = day.spot[i] ?? NaN;
      mins.push({ t, hm, h: b?.h ?? sp, l: b?.l ?? sp, c: b?.c ?? sp });
    }
    const c920 = mins.find(m => m.hm === '09:20')?.c ?? null;
    const out: string[] = [];
    for (const L of lines) {
      const stop = L.up ? stopUp : stopDn;
      if (L.v === null || stop === null || (c920 !== null && (L.up ? c920 >= L.v : c920 <= L.v))) continue;
      const beyond = (L.up ? divs.filter(d => d < L.v! - 0.05 + 1e-9) : divs.filter(d => d > L.v! + 0.05 - 1e-9));
      const nextLine = L.up ? vals.filter(v => v < L.v! - 0.05 + 1e-9) : vals.filter(v => v > L.v! + 0.05 - 1e-9);
      const pick = (xs: number[]) => (xs.length ? (L.up ? Math.max(...xs) : Math.min(...xs)) : null);
      const target = pick(beyond) ?? pick(nextLine);
      const isTouch = (j: number) => j > 0 && mins[j]!.hm >= '09:21' && (L.up ? mins[j - 1]!.c < L.v! && mins[j]!.h >= L.v! : mins[j - 1]!.c > L.v! && mins[j]!.l <= L.v!);
      for (let j = 1; j < mins.length; j++) {
        if (!isTouch(j)) continue;
        let before = false;
        for (let k = j - 1; k >= 1; k--) if (isTouch(k)) { before = true; break; }
        let veto: string;
        if (mins[j]!.hm > '11:29') veto = 'window';
        else if (before) veto = 'used';
        else {
          const sd = L.up ? stop - L.v : L.v - stop, td = target === null ? null : L.up ? L.v - target : target - L.v;
          veto = sd < 0.05 - 1e-9 ? 'stop-on-entry' : td === null || td < 0.05 - 1e-9 ? 'target' : sd > td + 1e-9 ? 'ratio' : 'ACCEPTED';
        }
        out.push(`${mins[j]!.hm} ${L.n} ${L.v.toFixed(2)} ${stop.toFixed(2)} ${target?.toFixed(2)} ${veto}`);
      }
    }
    return out.sort();
  }
  const engine920 = (sg: Signal[]) => sg.filter(s => s.kind === '920').map(s => `${s.hm} ${s.line} ${s.entry.toFixed(2)} ${s.stop!.toFixed(2)} ${s.target?.toFixed(2)} ${s.veto ?? 'ACCEPTED'}`).sort();

  let orderBad = 0, orderDays: string[] = [], shared = 0, equal = 0, inside = 0, sharedOld = 0, mismatch = 0, mismatchDays: string[] = [], swapDiff = 0;
  let candidates = 0, independent = 0, perVeto = new Map<string, number>();
  const hash = createHash('sha256');
  let aiDay: { date: string; i: number } | null = null;
  const t0 = Date.now();
  for (const date of days) {
    const day = await readDay(date);
    if (!day) continue;
    const I = idx.get(date);
    const d = P.daySignals(day, I);
    if (!d.minutes.length) continue;
    hash.update(JSON.stringify([d.l920, d.signals]));
    // AC8 (amended): the index path against the chain's spot — inside the bar everywhere, the close up to Oct 2025.
    for (let i = 0; i < day.t.length; i++) {
      const b = I?.get(day.t[i]!), sp = day.spot[i];
      if (!b || sp === null || sp === undefined) continue;
      shared++;
      if (sp >= b.l - 0.005 && sp <= b.h + 0.005) inside++;
      if (date < '2025-10-01') { sharedOld++; if (Math.abs(b.c - sp) < 0.005) equal++; }
    }
    // AC1: the monotonic order.
    const v = Object.fromEntries(d.l920.lines.map(l => [l.name, l.value]));
    if ((v['EOR+1'] != null && v['EOR'] != null && v['EOR+1'] <= v['EOR']) || (v['EOS-1'] != null && v['EOS'] != null && v['EOS-1'] >= v['EOS'])) { orderBad++; orderDays.push(date); }
    // AC5: count at the point of rejection, and count touches in a separate loop.
    for (const s of d.signals) { candidates++; perVeto.set(s.veto ?? 'ACCEPTED', (perVeto.get(s.veto ?? 'ACCEPTED') ?? 0) + 1); }
    for (let i = 1; i < d.minutes.length; i++) {
      const m = d.minutes[i]!, p = d.minutes[i - 1]!;
      if (m.hm < '09:21') continue;
      if (d.l920.ready) for (const L of d.l920.lines) if (!L.missing && L.value !== null && (L.buy === 'CE' ? p.c > L.value && m.l <= L.value : p.c < L.value && m.h >= L.value)) independent++;
      const A = d.ai[i - 1];
      if (A) for (const n of P.AI_ENTRIES) {
        const x = A.value[n], ce = n.startsWith('S');
        if (x !== null && A.drawn.has(n) && (ce ? p.c > x && m.l <= x : p.c < x && m.h >= x)) independent++;
      }
    }
    // AC7.
    const a = engine920(d.signals), b = second(day, I);
    if (!(b.length === 1 && b[0] === 'not ready' && !d.l920.ready) && JSON.stringify(a) !== JSON.stringify(b)) { mismatch++; if (mismatchDays.length < 5) mismatchDays.push(`${date}: engine ${a.length} vs second ${b.length}`); }
    if (JSON.stringify(second(day, I, true)) !== JSON.stringify(b)) swapDiff++;
    if (!aiDay) { const s = d.signals.find(x => x.kind === 'ai'); if (s) aiDay = { date, i: s.i }; }
  }
  console.log(`(real data: ${days.length} days in ${((Date.now() - t0) / 1000).toFixed(0)} s)`);

  ok('AC1 real data: EOR+1 > EOR and EOS-1 < EOS on every day', orderBad === 0, `${orderBad} days${orderDays.length ? ': ' + orderDays.slice(0, 5).join(', ') : ''}`);
  const pv = (k: string) => perVeto.get(k) ?? 0;
  ok('AC5 real data: accepted + every rejection = candidates counted independently', candidates === independent, `${candidates} signals vs ${independent} touches counted separately`);
  console.log(`      by veto: ${[...perVeto].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const k of ['window', 'used', 'side', 'ratio'] as Veto[]) ok(`AC5 real data: (${k}) rejects at least once`, pv(k) > 0, `${pv(k)}`);
  // AC5 as amended at build (spec, "Amendments"): (d) (e) (f) never fire on the 680 days. (e) cannot: Max Pain is two
  // strikes out and reversal prices rise with the strike, so the stop is always beyond the entry. (d) needs the leg
  // two strikes past a TOUCHED AI level to be missing, and (f) needs a Max Gain behind its entry, which the
  // other-side-Moderate fallback prevents. They stay as defence-in-depth, exercised by the fixtures above; their
  // real-data counts are printed so a change in the data shows up here.
  console.log(`      INFO  (no-stop) ${pv('no-stop')}, (stop-on-entry) ${pv('stop-on-entry')}, (target) ${pv('target')} on real data — fixtures only (amended AC5)`);
  ok('AC5 real data: some candidates are accepted', pv('ACCEPTED') > 0, `${pv('ACCEPTED')}`);

  // AC6: perturb minute i's chain; the AI signals AT minute i must not move.
  if (aiDay) {
    const day = (await readDay(aiDay.date))!;
    const I = idx.get(aiDay.date);
    const before = P.daySignals(day, I).signals.filter(s => s.kind === 'ai' && s.i === aiDay!.i);
    const tI = P.daySignals(day, I).minutes[aiDay.i]!.t;
    const raw = day.t.indexOf(tI);
    for (const l of Object.values(day.legs)) if (l.c[raw] !== null && l.c[raw] !== undefined) l.c[raw] = l.c[raw]! * 1.5;
    const after = P.daySignals(day, I).signals.filter(s => s.kind === 'ai' && s.i === aiDay!.i);
    ok('AC6 no look-ahead: every LTP of minute i x1.5 leaves minute i\'s AI signals unchanged', before.length > 0 && JSON.stringify(before) === JSON.stringify(after), `${aiDay.date} ${before[0]?.hm}: ${before.length} signal(s)`);
    // And the same perturbation one minute EARLIER does move them — the test can see a change.
    const day2 = (await readDay(aiDay.date))!;
    for (const l of Object.values(day2.legs)) if (l.c[raw - 1] !== null && l.c[raw - 1] !== undefined) l.c[raw - 1] = l.c[raw - 1]! * 1.5;
    const moved = P.daySignals(day2, I).signals.filter(s => s.kind === 'ai' && s.i === aiDay!.i);
    ok('AC6 control: the same change to minute i-1 does change them', JSON.stringify(moved) !== JSON.stringify(before));
  } else ok('AC6 UNMEASURED: no AI signal on any day', false);

  ok('AC7 a second implementation agrees on every day\'s 920 lines and touches', mismatch === 0, `${mismatch} mismatching days${mismatchDays.length ? ': ' + mismatchDays.join('; ') : ''}`);
  ok('AC7 the comparison catches a swapped rule (stops swapped between sides)', swapDiff > 0, `${swapDiff} days differ`);
  ok('AC8 up to Sep 2025 the chain spot IS the index close (>= 99.9% of minutes)', sharedOld > 0 && equal / sharedOld >= 0.999, `${equal} / ${sharedOld} = ${(100 * equal / sharedOld).toFixed(3)}%`);
  ok('AC8 on every day the chain spot sits inside the index bar (>= 99% of minutes)', shared > 0 && inside / shared >= 0.99, `${inside} / ${shared} = ${(100 * inside / shared).toFixed(3)}%`);

  // AC9: determinism over the whole history, and the imports.
  const hash2 = createHash('sha256');
  for (const date of days.slice(0, 40)) { const day = await readDay(date); if (day) { const d = P.daySignals(day, idx.get(date)); if (d.minutes.length) hash2.update(JSON.stringify([d.l920, d.signals])); } }
  const hashA = createHash('sha256');
  for (const date of days.slice(0, 40)) { const day = await readDay(date); if (day) { const d = P.daySignals(day, idx.get(date)); if (d.minutes.length) hashA.update(JSON.stringify([d.l920, d.signals])); } }
  ok('AC9 two runs give byte-identical output (40 days)', hash2.digest('hex') === hashA.digest('hex'));
  void hash;
}

const src = readFileSync(new URL('../src/server/ltp-lines.ts', import.meta.url), 'utf8');
ok('AC9 ltp-lines.ts imports nothing from dhan.ts', !/from '\.\/dhan\.ts'/.test(src));
ok('AC9 ltp-lines.ts never calls Date.now()', !/Date\.now\(\)/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
