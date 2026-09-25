/**
 * `npm run ltpstate:test` — P49's state machine (`docs/spec/ltp-state-v1.md`).
 *
 * AC1-AC6 run on hand-built minutes, each rule also shown rejecting something. AC7-AC10 run on every stored
 * NIFTY day (P48's rebuild); without those files they print UNMEASURED and the run fails — an absent
 * measurement is not a pass. AC11 is the other suites and tsc, run separately.
 *
 * AC7's second implementation is deliberately built another way: the engine walks forward carrying state;
 * this one answers each minute by looking BACK over the day's readings, with its own tables.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readDay, storedDays } from '../src/server/chainhist.ts';
import * as L from '../src/server/ltp-state.ts';
import type { ObsMinute, SideObs, Obs, MinuteOut, Dir, Grade } from '../src/server/ltp-state.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/* ------------------------------------------------------------------ fixtures */

const IST = 5.5 * 3600_000;
const T0 = Date.parse('2026-09-24T09:15:00Z') - IST;
const tAt = (m: number) => T0 + m * 60_000;
type S = { k: number; g: Grade; pct?: number | null; ch?: Dir | null; scan?: number[] };
const SCAN = [22900, 22950, 23000, 23050, 23100, 23150, 23200, 23250, 23300];
const side = (s: S): SideObs => ({
  strike: s.k, grade: s.g, factor: 'volume', pct: s.pct ?? 50, chDir: s.ch === undefined ? 'up' : s.ch,
  scan: s.scan ?? SCAN, above: null, below: null, partial: false, edge: false,
});
function minute(m: number, r: S | null, s?: S, iv: [number, number] = [10, 10]): ObsMinute {
  const t = tAt(m), hm = L.hmOf(t);
  if (!r || !s) return { t, hm, obs: null };
  const obs: Obs = { t, hm, spot: 23100, ltpAtm: 23100, ceIv: iv[0], peIv: iv[1], res: side(r), sup: side(s) };
  return { t, hm, obs };
}
const STRONG_S: S = { k: 23000, g: 'strong' };
/** Resistance readings over consecutive minutes, support held strong. */
const resSeq = (rs: S[]) => L.stepDay(rs.map((r, m) => minute(m, r, STRONG_S)));
const last = (o: MinuteOut[]) => o.at(-1)!;

/* ------------------------------------------------------------------ AC1: the five states */

{
  const o = resSeq([{ k: 23200, g: 'strong' }, { k: 23200, g: 'strong' }, { k: 23200, g: 'strong' }]);
  ok('AC1 stable: strong at one strike all along -> neutral', last(o).res.state === 'stable' && last(o).res.pressure === 'neutral');

  const a = resSeq([{ k: 23200, g: 'strong' }, { k: 23200, g: 'wtt' }, { k: 23200, g: 'strong' }]);
  ok('AC1 WTT -> strong at the same strike = abandoned-up -> BEARISH', last(a).res.state === 'abandoned' && last(a).res.dir === 'up' && last(a).res.pressure === 'bearish');
  ok('AC1 near-miss: that is NOT shifted (no strike change)', last(a).res.state !== 'shifted' && !last(a).res.shiftDone);

  const b = resSeq([{ k: 23200, g: 'strong' }, { k: 23200, g: 'wtb' }, { k: 23200, g: 'strong' }]);
  ok('AC1 WTB -> strong = abandoned-down -> BULLISH', last(b).res.state === 'abandoned' && last(b).res.dir === 'down' && last(b).res.pressure === 'bullish');

  const c = resSeq([{ k: 23200, g: 'strong' }, { k: 23250, g: 'strong' }]);
  ok('AC1 completed move to a higher strike, strong there = shifted-up -> BULLISH', last(c).res.state === 'shifted' && last(c).res.dir === 'up' && last(c).res.pressure === 'bullish');
  ok('AC1 the shift is a volume shift when the old strike is still in range', last(c).res.shift?.cause === 'volume');

  const d = resSeq([{ k: 23200, g: 'strong' }, { k: 23150, g: 'strong' }]);
  ok('AC1 completed move to a lower strike = shifted-down -> BEARISH', last(d).res.state === 'shifted' && last(d).res.dir === 'down' && last(d).res.pressure === 'bearish');

  const e = resSeq([{ k: 23200, g: 'strong' }, { k: 23250, g: 'wtt' }, { k: 23250, g: 'strong' }]);
  ok('AC1 arrival by shift, weak, then strong = shifted (not abandoned)', last(e).res.state === 'shifted' && last(e).res.dir === 'up');
  const e2 = resSeq([{ k: 23200, g: 'strong' }, { k: 23250, g: 'wtt' }, { k: 23250, g: 'strong' }, { k: 23250, g: 'wtb' }, { k: 23250, g: 'strong' }]);
  ok('AC1 ...and a later attempt from the settled strike is abandoned again', last(e2).res.state === 'abandoned' && last(e2).res.dir === 'down');

  const f = resSeq([{ k: 23200, g: 'strong' }, { k: 23250, g: 'strong', scan: [23250, 23300] }]);
  ok('AC1 row 8: the old strike out of range = re-seat', last(f).res.shift?.cause === 'reseat' && last(f).res.state === 'shifted');

  const w1 = resSeq([{ k: 23200, g: 'strong' }, { k: 23200, g: 'wtt' }]);
  ok('AC1 row 10: WTT with no shift today -> bullish', last(w1).res.state === 'weak' && last(w1).res.pressure === 'bullish');
  const w2 = resSeq([{ k: 23200, g: 'strong' }, { k: 23150, g: 'strong' }, { k: 23150, g: 'wtt' }]);
  ok('AC1 row 10 / V112: WTT after a shift DOWN -> bearish', last(w2).res.pressure === 'bearish');
  const w3 = resSeq([{ k: 23200, g: 'strong' }, { k: 23250, g: 'strong' }, { k: 23250, g: 'wtb' }]);
  ok('AC1 row 10 / V112: WTB after a shift UP -> bullish ("and the reverse")', last(w3).res.pressure === 'bullish');

  const h = L.stepDay([minute(0, { k: 23200, g: 'strong' }, STRONG_S), minute(1, { k: 23200, g: 'wtt' }, STRONG_S), minute(2, null), minute(3, { k: 23200, g: 'wtt' }, STRONG_S)]);
  ok('AC1 row 5: a minute with no reading holds the state', h[2]!.noRead && h[2]!.res.state === 'weak' && h[2]!.res.pressure === 'bullish');
}

/* ------------------------------------------------------------------ AC2: COA 1.0 */

{
  const P = ['neutral', 'bearish', 'bullish'] as const;
  const want: Record<string, number> = { 'neutral/neutral': 1, 'bearish/neutral': 2, 'bullish/neutral': 3, 'neutral/bearish': 4, 'neutral/bullish': 5, 'bearish/bearish': 6, 'bullish/bullish': 7, 'bullish/bearish': 8, 'bearish/bullish': 9 };
  let seen = 0;
  for (const r of P) for (const s of P) if (L.scenarioOf(r, s) === want[`${r}/${s}`]) seen++;
  ok('AC2 all nine COA cells', seen === 9, `${seen}/9`);
  ok('AC2 row 13: both bearish = 6 (blood bath), not 9', L.scenarioOf('bearish', 'bearish') === 6 && L.SCENARIO_LABEL[6] === 'blood bath');
  ok('AC2 no scenario without both pressures', L.scenarioOf('bullish', null) === null);
  // Wired through the day: resistance WTB (bearish), support WTB (bearish) -> 6.
  const o = L.stepDay([minute(0, { k: 23200, g: 'wtb' }, { k: 23000, g: 'wtb' })]);
  ok('AC2 through stepDay: both WTB at the open -> blood bath', o[0]!.scenario === 6 && o[0]!.verdict === 'blood bath');
  const o9 = L.stepDay([minute(0, { k: 23200, g: 'wtb' }, { k: 23000, g: 'wtt' })]);
  ok('AC2 through stepDay: R bearish + S bullish -> 9', o9[0]!.scenario === 9);
}

/* ------------------------------------------------------------------ AC3: the Game of Percentage, use A */

{
  const rows: [string, string, string][] = [
    ['inc', 'stable', 'bullish'], ['dec', 'stable', 'bearish'], ['stable', 'stable', 'consolidation'],
    ['inc', 'inc', 'consolidation'], ['dec', 'inc', 'bearish'], ['stable', 'inc', 'bearish'],
    ['stable', 'dec', 'bullish'], ['inc', 'dec', 'bullish'], ['dec', 'dec', 'consolidation'],
  ];
  const good = rows.filter(([r, s, v]) => L.useA(r as any, s as any) === v).length;
  ok('AC3 all nine rows of V23\'s table', good === 9, `${good}/9`);
  ok('AC3 boundary: 0.99 is stable, 1.00 moves', L.trend(0.99) === 'stable' && L.trend(1.0) === 'inc' && L.trend(-0.99) === 'stable' && L.trend(-1.0) === 'dec');
  ok('AC3 no value five minutes back -> unknown', L.useA(null, 'inc') === 'unknown');
  // Wired: scenario 9 for 6 minutes, resistance % rising 80 -> 86, support flat -> bullish.
  const ms = Array.from({ length: 6 }, (_, m) => minute(m, { k: 23200, g: 'wtb', pct: 80 + m }, { k: 23000, g: 'wtt', pct: 90 }));
  const o = L.stepDay(ms);
  ok('AC3 through stepDay: 8/9 resolved at minute 5, unknown before', o[4]!.gop === 'unknown' && o[5]!.gop === 'bullish', `${o[4]!.gop} / ${o[5]!.gop}`);
  const o1 = L.stepDay([minute(0, { k: 23200, g: 'wtb' }, { k: 23000, g: 'wtb' })]);
  ok('AC3 use A is not applied outside scenarios 8 and 9', o1[0]!.gop === null);
}

/* ------------------------------------------------------------------ AC4: V109's inversion */

{
  ok('AC4 challenger above, % rising: up before a shift, DOWN after', L.useB('up', 'inc', false) === 'up' && L.useB('up', 'inc', true) === 'down');
  ok('AC4 challenger below, % rising: down before, UP after', L.useB('down', 'inc', false) === 'down' && L.useB('down', 'inc', true) === 'up');
  ok('AC4 stable reads flat either way', L.useB('up', 'stable', true) === 'flat');
  // Through the day: same rising % on the resistance side, once without and once after a shift.
  const before = L.stepDay(Array.from({ length: 6 }, (_, m) => minute(m, { k: 23200, g: 'wtt', pct: 80 + m }, STRONG_S)));
  const after = L.stepDay(Array.from({ length: 6 }, (_, m) => minute(m, { k: m === 0 ? 23150 : 23200, g: 'wtt', pct: 80 + m }, STRONG_S)));
  ok('AC4 through stepDay: the same rising % reads opposite after a shift', last(before).res.useB === 'up' && last(after).res.useB === 'down', `${last(before).res.useB} / ${last(after).res.useB}`);
}

/* ------------------------------------------------------------------ AC5: SOC */

{
  const weakR = (m: number): ObsMinute => minute(m, { k: 23200, g: 'wtt', pct: 85 }, STRONG_S);
  const o = L.stepDay(Array.from({ length: 121 }, (_, m) => weakR(m)));
  ok('AC5 59 min = warning', o[59]!.res.soc?.stage === 'warning' && o[59]!.res.soc?.minutes === 59);
  ok('AC5 60 min = confirmed 1R, verdict bullish SOC (resistance side)', o[60]!.res.soc?.stage === 'confirmed' && o[60]!.res.soc?.r === 1 && o[60]!.verdict === 'bullish SOC 1R', o[60]!.verdict ?? '');
  ok('AC5 120 min = 2R', o[120]!.res.soc?.r === 2);
  const sh = L.stepDay(Array.from({ length: 91 }, (_, m) => minute(m, { k: m < 30 ? 23200 : 23250, g: 'wtt', pct: 85 }, STRONG_S)));
  ok('AC5 a shift on the side restarts the clock', sh[60]!.res.soc?.stage === 'warning' && sh[60]!.res.soc?.minutes === 30 && sh[90]!.res.soc?.stage === 'confirmed', `${sh[60]!.res.soc?.minutes} min at 60`);
  const end = L.stepDay(Array.from({ length: 70 }, (_, m) => minute(m, { k: 23200, g: 'wtt', pct: 85 }, m < 65 ? STRONG_S : { k: 23000, g: 'wtb', pct: 76 })));
  ok('AC5 the other side reaching 75% ends it', end[64]!.res.soc?.stage === 'confirmed' && end[65]!.res.soc === null);
  const sup = L.stepDay(Array.from({ length: 61 }, (_, m) => minute(m, { k: 23200, g: 'strong' }, { k: 23000, g: 'wtt', pct: 85 })));
  ok('AC5 support-side SOC reads BEARISH', sup[60]!.verdict === 'bearish SOC 1R', sup[60]!.verdict ?? '');
  const both = L.stepDay(Array.from({ length: 70 }, (_, m) => minute(m, { k: 23200, g: 'wtt' }, { k: 23000, g: 'wtb' })));
  ok('AC5 both sides weak = no SOC clock', both.every(m => !m.res.soc && !m.sup.soc));
}

/* ------------------------------------------------------------------ AC6: the IV gate */

{
  ok('AC6 1.00 apart = settled, 1.01 = unbalanced', L.ivBalance(10, 11.0) === 'settled' && L.ivBalance(10, 11.01) === 'unbalanced');
  ok('AC6 1.99 from 09:20 = steady, 2.00 = moving', L.ivMove(11.99, 10) === 'steady' && L.ivMove(12.0, 10) === 'moving' && L.ivMove(8.0, 10) === 'moving');
  ok('AC6 missing IV = unknown', L.ivBalance(null, 10) === 'unknown' && L.ivMove(10, null) === 'unknown');
  const o = L.stepDay(Array.from({ length: 12 }, (_, m) => minute(m, { k: 23200, g: 'strong' }, STRONG_S, m < 11 ? [10, 10] : [12, 12])));
  ok('AC6 through stepDay: unknown before 09:20, then measured from the 09:20 value', o[4]!.iv.move === 'unknown' && o[5]!.iv.move === 'steady' && o[11]!.iv.move === 'moving');
}

/* ------------------------------------------------------------------ AC7: a second implementation */

/** State of one side at minute m, by looking back over the readings (no carried state). */
function lookBack(ms: ObsMinute[], m: number, pick: (o: Obs) => SideObs) {
  const valid: number[] = [];
  for (let j = 0; j <= m; j++) if (ms[j]!.obs) valid.push(j);
  if (!valid.length) return null;
  const at = (v: number) => pick(ms[valid[v]!]!.obs!);
  const isShift = (v: number) => v > 0 && at(v).strike !== at(v - 1).strike;
  const shiftDir = (v: number): Dir => (at(v).strike > at(v - 1).strike ? 'up' : 'down');
  const weak = (g: Grade): Dir | null => (g === 'wtt' ? 'up' : g === 'wtb' ? 'down' : null);
  let lastShift: Dir | null = null;
  for (let v = valid.length - 1; v > 0; v--) if (isShift(v)) { lastShift = shiftDir(v); break; }
  const n = valid.length - 1, cur = at(n);
  let state: string, dir: Dir | null;
  if (weak(cur.grade)) { state = 'weak'; dir = weak(cur.grade); }
  else {
    let v = n;
    while (v >= 0 && !weak(at(v).grade) && !isShift(v)) v--;
    if (v < 0) { state = 'stable'; dir = null; }
    else if (!weak(at(v).grade)) { state = 'shifted'; dir = shiftDir(v); }        // a shift into a strong reading
    else {
      const label = weak(at(v).grade)!;
      let a = v;
      while (a >= 0 && weak(at(a).grade) && !isShift(a)) a--;
      // a stopped on a shift that landed weak -> it arrived by that shift; otherwise the attempt was given up.
      if (a >= 0 && weak(at(a).grade) && isShift(a)) { state = 'shifted'; dir = shiftDir(a); }
      else { state = 'abandoned'; dir = label; }
    }
  }
  const P: Record<string, 'bullish' | 'bearish' | 'neutral'> = {
    'stable': 'neutral', 'abandoned-up': 'bearish', 'abandoned-down': 'bullish', 'shifted-up': 'bullish', 'shifted-down': 'bearish',
  };
  const pressure = state === 'weak' ? ((lastShift ?? dir) === 'up' ? 'bullish' : 'bearish') : P[dir ? `${state}-${dir}` : state]!;
  return { state, dir, pressure, lastShiftAt: (v: number) => isShift(v), valid, at };
}

function socBack(ms: ObsMinute[], m: number, me: (o: Obs) => SideObs, other: (o: Obs) => SideObs): { stage: string; r: number } | null {
  // The clock is decided at the last minute with a reading; a no-read minute only lets time pass.
  let lastValid = m;
  while (lastValid >= 0 && !ms[lastValid]!.obs) lastValid--;
  if (lastValid < 0) return null;
  const cond = (j: number) => me(ms[j]!.obs!).grade !== 'strong' && other(ms[j]!.obs!).grade === 'strong';
  if (!cond(lastValid)) return null;
  let start = ms[lastValid]!.t;
  let prevStrike: number | null = null;
  for (let j = lastValid; j >= 0; j--) {
    if (!ms[j]!.obs) continue;
    if (!cond(j)) break;
    start = ms[j]!.t;
    // Was j itself a shift minute? Find the previous reading's strike.
    let p = j - 1;
    while (p >= 0 && !ms[p]!.obs) p--;
    prevStrike = p >= 0 ? me(ms[p]!.obs!).strike : null;
    if (prevStrike !== null && prevStrike !== me(ms[j]!.obs!).strike) break;
  }
  const min = Math.round((ms[m]!.t - start) / 60_000);
  return min >= 60 ? { stage: 'confirmed', r: Math.floor(min / 60) } : { stage: 'warning', r: 0 };
}

const COA = [ // rows: resistance neutral/bullish/bearish; columns: support neutral/bullish/bearish
  [1, 5, 4],
  [3, 7, 8],
  [2, 9, 6],
];
const PIX = { neutral: 0, bullish: 1, bearish: 2 } as const;
const USE_A: Record<string, string> = { // resistance trend + support trend, V23
  '+0': 'bullish', '-0': 'bearish', '00': 'consolidation', '++': 'consolidation', '-+': 'bearish',
  '0+': 'bearish', '0-': 'bullish', '+-': 'bullish', '--': 'consolidation',
};

function second(ms: ObsMinute[]) {
  const byT = new Map(ms.map((x, i) => [x.t, i]));
  return ms.map((x, m) => {
    const r = lookBack(ms, m, o => o.res), s = lookBack(ms, m, o => o.sup);
    const scen = r && s ? COA[PIX[r.pressure]]![PIX[s.pressure]]! : null;
    const rs = socBack(ms, m, o => o.res, o => o.sup), ss = socBack(ms, m, o => o.sup, o => o.res);
    let verdict = scen === null ? null : L.SCENARIO_LABEL[scen]!;
    if (rs?.stage === 'confirmed') verdict = `bullish SOC ${rs.r}R`;
    else if (ss?.stage === 'confirmed') verdict = `bearish SOC ${ss.r}R`;
    let gop: string | null = null;
    if (scen === 8 || scen === 9) {
      const j = byT.get(x.t - 5 * 60_000);
      const then = j === undefined ? null : ms[j]!.obs;
      const sign = (a: number | null | undefined, b: number | null | undefined) => {
        if (a == null || b == null) return null;
        const dlt = a - b;
        return Math.abs(dlt) < 1 - 1e-9 ? '0' : dlt > 0 ? '+' : '-';
      };
      const a = sign(x.obs?.res.pct, then?.res.pct), b = sign(x.obs?.sup.pct, then?.sup.pct);
      gop = a && b ? USE_A[a + b]! : 'unknown';
    }
    return { r, s, scen, verdict, rs, ss, gop };
  });
}

const days = await storedDays(1);
if (!days.length) {
  ok('AC7-AC10 need the stored chains (npm run chainhist)', false, 'UNMEASURED: no stored days');
} else {
  let minutes = 0, mism = 0;
  const shown: string[] = [];
  const seen = new Set<string>();
  const hash1 = createHash('sha256');
  for (const d of days) {
    const day = (await readDay(d))!;
    const ms = L.observeDay(day);
    const a = L.stepDay(ms);
    hash1.update(JSON.stringify(a));
    const b = second(ms);
    for (let m = 0; m < a.length; m++) {
      minutes++;
      const x = a[m]!, y = b[m]!;
      const mine = [x.res.state, x.res.dir, x.res.pressure, x.sup.state, x.sup.dir, x.sup.pressure, x.scenario, x.verdict,
        x.res.soc?.stage ?? null, x.res.soc?.r ?? null, x.sup.soc?.stage ?? null, x.sup.soc?.r ?? null, x.gop];
      const theirs = [y.r?.state ?? null, y.r?.dir ?? null, y.r?.pressure ?? null, y.s?.state ?? null, y.s?.dir ?? null, y.s?.pressure ?? null,
        y.scen, y.verdict, y.rs?.stage ?? null, y.rs?.r ?? null, y.ss?.stage ?? null, y.ss?.r ?? null, y.gop];
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
        mism++;
        if (shown.length < 5) shown.push(`${d} ${x.hm}: engine ${JSON.stringify(mine)} vs look-back ${JSON.stringify(theirs)}`);
      }
      // AC8's census, counted at the point each thing happens.
      for (const s of [x.res, x.sup]) {
        if (s.state) seen.add(`state ${s.state === 'abandoned' || s.state === 'shifted' ? `${s.state}-${s.dir}` : s.state}`);
        if (s.shift) seen.add(`shift ${s.shift.cause}`);
        if (s.soc) seen.add(`SOC ${s.soc.stage}`);
      }
      if (x.scenario) seen.add(`scenario ${x.scenario}`);
      if (x.gop && x.gop !== 'unknown') seen.add(`GoP ${x.gop}`);
      seen.add(`IV ${x.iv.balance}`); seen.add(`IV ${x.iv.move}`);
    }
  }
  for (const s of shown) console.log('      ' + s);
  // The comparison must be able to fail: swap the two abandoned pressures in the engine's own output for one day.
  const probe = L.stepDay(L.observeDay((await readDay(days.at(-1)!))!));
  const probeB = second(L.observeDay((await readDay(days.at(-1)!))!));
  const tampered = probe.filter((x, m) => x.res.state === 'abandoned'
    && (x.res.pressure === 'bullish' ? 'bearish' : 'bullish') !== probeB[m]!.r?.pressure).length;
  ok('AC7 the comparison catches a swapped rule (abandoned pressures inverted on the last day)', tampered > 0, `${tampered} minutes would differ`);
  ok('AC7 the look-back implementation agrees minute for minute on every stored day', mism === 0, `${minutes} minutes over ${days.length} days, ${mism} mismatches`);

  const need = ['state stable', 'state weak', 'state abandoned-up', 'state abandoned-down', 'state shifted-up', 'state shifted-down',
    ...Array.from({ length: 9 }, (_, i) => `scenario ${i + 1}`), 'SOC warning', 'SOC confirmed', 'shift volume', 'shift reseat',
    'GoP bullish', 'GoP bearish', 'GoP consolidation', 'IV settled', 'IV unbalanced', 'IV steady', 'IV moving'];
  const missing = need.filter(k => !seen.has(k));
  ok('AC8 every state, scenario, SOC stage, shift cause, GoP and IV value occurs on real data', !missing.length, missing.length ? `never seen: ${missing.join(', ')}` : `${need.length}/${need.length}`);

  const jun4 = await readDay('2024-06-04');
  if (!jun4) ok('AC9 4 Jun 2024 is stored', false, 'UNMEASURED');
  else {
    const o = L.runDay(jun4);
    const first = o.find(m => m.iv.move === 'moving');
    ok('AC9 4 Jun 2024 (election results) reads IV moving', !!first, first ? `first at ${first.hm}, ATM IV ${first.iv.atm?.toFixed(2)}` : 'never');
  }

  const src = readFileSync(new URL('../src/server/ltp-state.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok('AC10 no runtime import of dhan.ts or chainhist.ts, no Date.now()',
    !/^import (?!type)[^;]*from '\.\/(dhan|chainhist)\.ts'/m.test(code) && !/Date\.now\s*\(/.test(code));
  const hash2 = createHash('sha256');
  for (const d of days) hash2.update(JSON.stringify(L.runDay((await readDay(d))!)));
  const h1 = hash1.digest('hex'), h2 = hash2.digest('hex');
  ok('AC10 two runs over every stored day are byte-identical', h1 === h2, h1.slice(0, 12));
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
