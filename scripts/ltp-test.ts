/**
 * `npm run ltp:test` — the acceptance criteria of `docs/spec/ltp-calculator-v1.md`, AC1-AC13.
 *
 * Every filter is shown REJECTING something, not just accepting. P8's funnel reported
 * `reconciles: true` on every run of its whole verification because its self-check collapsed
 * algebraically; a fixture set that only ever agrees has not tested anything. So each rule here
 * gets a fixture designed to make it say no.
 *
 * Fixtures are hand-built, because the point is to construct cases the market rarely produces —
 * support two strikes in the money, a challenger at exactly 74.99%, all four directions of the
 * double-factor asymmetry. Real payloads are used where the claim is about real data
 * (`npm run oq1:live`, `npm run oq1:test`).
 */

import type { Row, Side } from '../src/server/derive.ts';
import {
  CHALLENGE_PCT, imaginaryLine, intrinsic, readChain, reversalPrice, timeValue,
} from '../src/server/ltp.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

const EMPTY: Side = {
  ltp: null, ltpChg: null, ltpChgPct: null, iv: null, volume: null, volChgPct: null,
  oi: null, oiChg: null, oiChgPct: null, delta: null, gamma: null, theta: null, vega: null,
};
const leg = (o: Partial<Side>): Side => ({ ...EMPTY, ...o });

/** A chain of `n` strikes stepping by `step` from `from`, with per-strike overrides. */
function chain(from: number, step: number, n: number,
  f: (k: number, i: number) => { ce?: Partial<Side>; pe?: Partial<Side> }): Row[] {
  return Array.from({ length: n }, (_, i) => {
    const strike = from + i * step;
    const o = f(strike, i);
    return { strike, ce: leg(o.ce ?? {}), pe: leg(o.pe ?? {}) };
  });
}

/* ------------------------------------------------------- AC1 / AC2: the line */

ok('AC1: the imaginary line brackets spot',
  JSON.stringify(imaginaryLine([100, 110, 120, 130], 117)) === JSON.stringify({ lower: 110, upper: 120 }),
  JSON.stringify(imaginaryLine([100, 110, 120, 130], 117)));

// V01's own three worked examples, verbatim.
ok('AC1: V01\'s worked examples reproduce',
  JSON.stringify(imaginaryLine([19350, 19400, 19550, 19600, 19750, 19800], 19553)) === JSON.stringify({ lower: 19550, upper: 19600 })
  && JSON.stringify(imaginaryLine([19350, 19400, 19550, 19600, 19750, 19800], 19753)) === JSON.stringify({ lower: 19750, upper: 19800 })
  && JSON.stringify(imaginaryLine([19350, 19400, 19550, 19600, 19750, 19800], 19353)) === JSON.stringify({ lower: 19350, upper: 19400 }),
  '19553 / 19753 / 19353');

// The line must RE-SEAT when spot crosses out of its band, and only then.
{
  const ks = [100, 110, 120, 130];
  const a = imaginaryLine(ks, 111), b = imaginaryLine(ks, 119), c = imaginaryLine(ks, 121);
  ok('AC1: the line re-seats only when spot crosses a strike',
    JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) !== JSON.stringify(c),
    `111 and 119 share ${JSON.stringify(a)}; 121 moves to ${JSON.stringify(c)}`);
}

ok('AC2: spot exactly on a strike returns null, it does not round or pick a side',
  imaginaryLine([100, 110, 120], 110) === null);

{
  // V08 by name: 257.50 produces nothing, 257.25 works.
  const ks = [255, 257.5, 260];
  ok('AC2: V08\'s Tata Power case — 257.50 nothing, 257.25 works',
    imaginaryLine(ks, 257.5) === null && imaginaryLine(ks, 257.25) !== null);
  const r = readChain({ spot: 257.5, rows: chain(255, 2.5, 3, () => ({})) });
  ok('AC2: the reading says WHY in words rather than returning an empty object',
    r.pair === null && !!r.note && /exactly on/.test(r.note), r.note ?? '(no note)');
}

/* ---------------------------------------------------- AC3: ATM by time value */
{
  // Spot 100.5, strikes 100 and 101. Nearest-spot would pick 100 (0.5 away vs 0.5) — a tie —
  // so this fixture makes the TIME VALUE answer differ from the nearest-spot answer outright:
  // spot 100.2 is nearest 100, but 101 carries the higher time value.
  const rows = chain(100, 1, 2, (k) => k === 100
    ? { ce: { ltp: 1.2 }, pe: { ltp: 1.0 } }   // TV = (1.2 - 0.2) + 1.0 = 2.0
    : { ce: { ltp: 2.0 }, pe: { ltp: 2.6 } }); // TV = 2.0 + (2.6 - 0.8)   = 3.8
  const r = readChain({ spot: 100.2, rows });
  ok('AC3: ltpAtm is the higher-time-value strike, not the nearer one',
    r.ltpAtm === 101, `ltpAtm ${r.ltpAtm} (nearest spot would be 100)`);
  ok('AC3: intrinsic value is never negative (V99)',
    intrinsic(100, 'call', 90) === 0 && intrinsic(100, 'put', 110) === 0
    && intrinsic(100, 'call', 110) === 10 && intrinsic(100, 'put', 90) === 10);
  ok('AC3: time value is premium minus intrinsic',
    timeValue(100, 'call', 110, rows[0]) === 1.2 - 10);

  // A tie must be REPORTED, not silently broken — OQ-26 is still open.
  const tie = chain(100, 1, 2, () => ({ ce: { ltp: 1 }, pe: { ltp: 1 } }));
  const t = readChain({ spot: 100.5, rows: tie });
  ok('AC3: a time-value tie is flagged rather than silently broken',
    t.ltpAtmTie === true && t.ltpAtm === 100, `ltpAtm ${t.ltpAtm} tie=${t.ltpAtmTie}`);
}

/* ------------------------------------------- AC4 / AC5: the reversal price */
{
  const r: Row = { strike: 25_600, ce: leg({ ltp: 12 }), pe: leg({ ltp: 40 }) };
  ok('AC4: the corpus\'s 25,600 pair reproduces exactly',
    reversalPrice(25_600, 'call', r) === 25_612 && reversalPrice(25_600, 'put', r) === 25_560,
    `call ${reversalPrice(25_600, 'call', r)}, put ${reversalPrice(25_600, 'put', r)}`);

  // Parity: F = revCall + revPut - K. The corpus states spot 25,564 separately; the difference
  // is the basis, and must be small and (usually) positive.
  const F = reversalPrice(25_600, 'call', r)! + reversalPrice(25_600, 'put', r)! - 25_600;
  ok('AC4: parity recovers the forward to within a small positive basis',
    Math.abs(F - 25_564) <= 15 && F > 25_564, `F ${F} vs stated spot 25,564 -> basis +${F - 25_564}`);

  ok('AC4: a missing LTP gives null, never a number',
    reversalPrice(100, 'call', { strike: 100, ce: leg({}), pe: leg({}) }) === null);
  // A negative premium is not a price. It must not produce a level.
  ok('AC4: a negative LTP is refused rather than turned into a reversal price',
    reversalPrice(100, 'call', { strike: 100, ce: leg({ ltp: -5 }), pe: leg({}) }) === null);

  // AC5 — at expiry, premium = intrinsic, so the ladder collapses onto spot (ITM) or the strike
  // (OTM). This is the constraint that eliminates every rival formula.
  const spot = 23_329;
  const expiry = chain(23_050, 50, 13, (k) => ({
    ce: { ltp: Math.max(0, spot - k) }, pe: { ltp: Math.max(0, k - spot) },
  }));
  const lad = readChain({ spot, rows: expiry }).ladder;
  const itmCallsOnSpot = lad.filter(x => x.strike < spot).every(x => Math.abs(x.call! - spot) < 0.005);
  const otmCallsOnStrike = lad.filter(x => x.strike > spot).every(x => Math.abs(x.call! - x.strike) < 0.005);
  const itmPutsOnSpot = lad.filter(x => x.strike > spot).every(x => Math.abs(x.put! - spot) < 0.005);
  const otmPutsOnStrike = lad.filter(x => x.strike < spot).every(x => Math.abs(x.put! - x.strike) < 0.005);
  ok('AC5: at expiry every ITM reversal lands on spot and every OTM one on its own strike',
    itmCallsOnSpot && otmCallsOnStrike && itmPutsOnSpot && otmPutsOnStrike,
    `"at expiry all reversal prices converge to intrinsic value" over ${lad.length} strikes`);
}

/* ----------------------------------------------- AC7: the scan, not the highlight */
{
  // V111/V112's counter-example, built: the highest volume of the whole side sits DEEP ITM, and a
  // nearer qualifying strike is the real level. The scan direction must win.
  // OI is left at 0 so that VOLUME alone places the level. A first draft gave every strike the
  // same OI, which made readFactor crown an arbitrary OI "leader" nearest the line, and that won
  // the distance tie-break — the fixture, not the engine, chose the answer.
  const rows = chain(100, 10, 11, (k) => ({
    ce: { ltp: 5, volume: k === 100 ? 9_999_999 : (k === 150 ? 500_000 : 1_000), oi: 0 },
    pe: { ltp: 5, volume: 1_000, oi: 0 },
  }));
  const r = readChain({ spot: 145, rows });
  ok('AC7: the deep-ITM highlight is not the level — the outward scan wins',
    r.resistance?.strike === 150,
    `resistance ${r.resistance?.strike} (a 9,999,999-volume strike sits at 100, behind the line)`);
}

/* ----------------------------------------- AC8: support never more than 1 strike ITM */
{
  // V111's bound turns out to be EMERGENT, not an independent filter, and that is worth stating.
  // The support scan starts at `pair.upper`, which is by definition the FIRST strike above spot,
  // so the deepest a put support can ever sit is that strike — at most one step in the money.
  // The guard in readChain is therefore defence-in-depth (an irregular ladder, or a pair supplied
  // from elsewhere), and its rejection branch is unreachable through `locate()`.
  //
  // So the honest test is the INVARIANT, swept across every spot on a ladder, rather than a
  // fixture engineered to reach a branch that real inputs cannot.
  const step = 10;
  const ladder = Array.from({ length: 21 }, (_, i) => 100 + i * step);
  let worst = 0, worstAt: number | null = null, checked = 0;
  for (let spot = 101; spot <= 295; spot += 1) {
    if (ladder.includes(spot)) continue;
    const rows = chain(100, step, 21, (k) => ({
      ce: { ltp: 5, volume: 1_000, oi: 0 },
      pe: { ltp: 5, volume: k === 110 ? 900_000 : 1_000, oi: 0 },
    }));
    const s = readChain({ spot, rows }).support;
    if (!s) continue;
    checked++;
    if (s.itmBy > worst) { worst = s.itmBy; worstAt = spot; }
  }
  ok('AC8: support is never more than one strike in the money — swept, not asserted',
    worst <= 1 && checked > 100,
    `${checked} spot positions, deepest support ${worst} strike(s) ITM${worstAt ? ` (at spot ${worstAt})` : ''}`);

  // And exactly one strike ITM must still be ACCEPTED, or the rule collapses into "never ITM".
  const rows2 = chain(100, 10, 11, (k) => ({
    ce: { ltp: 5, volume: 1_000, oi: 0 },
    pe: { ltp: 5, volume: k === 150 ? 900_000 : 1_000, oi: 0 },
  }));
  const r2 = readChain({ spot: 145, rows: rows2 });
  ok('AC8: exactly one strike in the money is still accepted (V06 — "whichever you meet first")',
    !!r2.support && !/REJECTED/.test(r2.support.why) && r2.support.itmBy === 1,
    r2.support ? `support ${r2.support.strike}, itmBy ${r2.support.itmBy}` : '(no support)');
}

/* ------------------------------------------------- AC9: 75% is a threshold */
{
  const mk = (challengerVol: number) => chain(100, 10, 6, (k) => ({
    ce: { ltp: 5, volume: k === 120 ? 100_000 : (k === 130 ? challengerVol : 10), oi: 0 },
    pe: { ltp: 5, volume: 10, oi: 0 },
  }));
  const below = readChain({ spot: 105, rows: mk(74_990) }).resistance;
  const at = readChain({ spot: 105, rows: mk(75_000) }).resistance;
  ok('AC9: 74.99% is Strong and 75.00% is not — both sides of the threshold exercised',
    below?.grade === 'strong' && at?.grade === 'wtt',
    `74.99% -> ${below?.grade} (${below?.volume?.challenger?.pct.toFixed(2)}%), `
    + `75.00% -> ${at?.grade} (${at?.volume?.challenger?.pct.toFixed(2)}%)`);
  ok('AC9: the threshold is the named constant, not a literal',
    CHALLENGE_PCT === 75);
}

/* --------------------------------- AC10: the double-factor asymmetry, all four ways */
{
  // Level at 120 on BOTH factors. The challenger sits at 130 (outward, away from the line at ~105)
  // or at 110 (inward, towards it). Resistance: inward=WTB needs one, outward=WTT needs both.
  const mk = (volCh: number, oiCh: number) => chain(100, 10, 6, (k) => ({
    ce: {
      ltp: 5,
      volume: k === 120 ? 100_000 : (k === volCh ? 80_000 : 10),
      oi: k === 120 ? 100_000 : (k === oiCh ? 80_000 : 10),
    },
    pe: { ltp: 5, volume: 10, oi: 1 },
  }));
  const bothOut = readChain({ spot: 105, rows: mk(130, 130) }).resistance;
  const oneIn = readChain({ spot: 105, rows: mk(110, 130) }).resistance;
  ok('AC10: resistance — BOTH factors outward gives WTT',
    bothOut?.grade === 'wtt', `${bothOut?.grade} · ${bothOut?.why}`);
  ok('AC10: resistance — EITHER factor inward gives WTB (one is enough)',
    oneIn?.grade === 'wtb', `${oneIn?.grade} · ${oneIn?.why}`);

  // Support mirrors it: level at 110, line at ~145, inward (towards the line) is a HIGHER strike.
  const mkP = (volCh: number, oiCh: number) => chain(100, 10, 6, (k) => ({
    ce: { ltp: 5, volume: 10, oi: 1 },
    pe: {
      ltp: 5,
      volume: k === 110 ? 100_000 : (k === volCh ? 80_000 : 10),
      oi: k === 110 ? 100_000 : (k === oiCh ? 80_000 : 10),
    },
  }));
  const sBothOut = readChain({ spot: 145, rows: mkP(100, 100) }).support;
  const sOneIn = readChain({ spot: 145, rows: mkP(120, 100) }).support;
  ok('AC10: support — BOTH factors outward gives WTB',
    sBothOut?.grade === 'wtb', `${sBothOut?.grade} · ${sBothOut?.why}`);
  ok('AC10: support — EITHER factor inward gives WTT (one is enough)',
    sOneIn?.grade === 'wtt', `${sOneIn?.grade} · ${sOneIn?.why}`);
}

/* ------------------------------------------------ AC11: no screen terms in the engine */
{
  const src = await (await import('node:fs/promises')).readFile('src/server/ltp.ts', 'utf8');
  // The engine may DISCUSS orientation in comments; what it must not do is branch on it.
  const code = src.split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  const screeny = /\b(screenDir|above|below|upward|downward|topOfScreen)\b/.exec(code);
  ok('AC11: no rule in the engine is written in screen terms',
    screeny === null, screeny ? `found "${screeny[0]}" in code` : 'strike space only');
}

/* --------------------------------------------------- AC13: the engine is pure */
{
  const src = await (await import('node:fs/promises')).readFile('src/server/ltp.ts', 'utf8');
  // Strip comments first, as AC11 does. The engine's own header explains that it reads no
  // Date.now(), and the first draft of this check matched that sentence and failed on the
  // documentation rather than on the code.
  const code = src.split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  ok('AC13: the engine makes no Dhan call and reads no clock',
    !/from '\.\/dhan\.ts'/.test(code) && !/Date\.now\(\)/.test(code) && !/fetch\(/.test(code));
}

/* --------------------------------------------------------------- the forward */
{
  const rows = chain(23_050, 50, 13, (k) => ({
    ce: { ltp: Math.max(0.05, 23_409.5 - k) }, pe: { ltp: Math.max(0.05, k - 23_409.5) },
  }));
  const r = readChain({ spot: 23_329, rows });
  ok('the implied forward is recovered from the chain, and the basis reported',
    r.impliedForward !== null && Math.abs(r.impliedForward - 23_409.5) < 0.6
    && r.basis !== null && Math.abs(r.basis - 80.5) < 0.6,
    `forward ${r.impliedForward?.toFixed(1)}, basis ${r.basis?.toFixed(1)}`);
}

/* ------------------------------------------------------- degenerate inputs */
ok('an empty chain says so rather than throwing',
  readChain({ spot: 100, rows: [] }).note !== null);
ok('a nonsense spot says so rather than throwing',
  readChain({ spot: 0, rows: chain(100, 10, 3, () => ({})) }).note !== null);

console.log(`\n${pass} pass · ${fail} fail`);
process.exitCode = fail === 0 ? 0 : 1;
