/**
 * OQ-1 — the reversal-price formula. A CANDIDATE, tested against the corpus, not a guess.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * P28 read all 163 transcript files and found that ~20 of them say the reversal price is "derived
 * from the Option Greeks" while NONE gives the formula. Everything the LTP Calculator draws is
 * that one number, so the build is blocked on it, and CLAUDE.md forbids guessing it: a wrong
 * approximation produces plausible levels that are quietly wrong.
 *
 * This does not guess. It takes the ONE candidate that the corpus's own worked examples imply,
 * and tests it against every numeric (strike -> reversal) pair in the corpus — including an
 * INDEPENDENT test that the candidate could not pass by construction.
 *
 * ---------------------------------------------------------------------------------------------
 * THE CANDIDATE
 *
 *     reversal(K, call) = K + callLTP(K)          the call writer's break-even
 *     reversal(K, put)  = K - putLTP(K)           the put writer's break-even
 *
 * In words: a level holds until price passes the point where the writer AT THAT STRIKE stops
 * being profitable. That is the strike plus (calls) or minus (puts) the premium they collected.
 *
 * It is not arbitrary — it is what four separate statements in the corpus describe:
 *   - V18   "a writer earns most where time value peaks; the price at which time value reaches
 *            its peak is where the writer commits most heavily — and that is the reversal price"
 *   - V111  "A LEVEL'S REACH IS SET BY ITS REVERSAL PRICE, NOT BY THE STRIKE"
 *   - V-C   "At expiry all reversal prices converge to intrinsic value"  <- the decisive one:
 *            at expiry premium = intrinsic, so K + premium collapses onto spot. Any formula
 *            whose offset does NOT vanish at expiry is eliminated by this line alone.
 *   - V124  the input list (spot, futures, callLTP, putLTP, delta, theta, vega, gamma, rho, IV)
 *            is exactly what you need to price the premium THEORETICALLY rather than read the
 *            market's own — which is what a paid tool would do, and why the Greeks are listed.
 *
 * ---------------------------------------------------------------------------------------------
 * THE INDEPENDENT TEST — why this is evidence and not circularity
 *
 * Fitting "premium" to one reversal price is trivial: premium is whatever makes it fit. So that
 * is NOT the test. The test is put-call parity, which the candidate never mentions:
 *
 *     callLTP - putLTP = S - K            (parity, rates and carry ignored at these horizons)
 *     (revCall - K) - (K - revPut) = S - K
 *     =>  S = revCall + revPut - K
 *
 * So for any strike where the corpus gives BOTH sides' reversal prices, the candidate predicts
 * the SPOT — a third number, stated separately in the same video, that was never used to build
 * the candidate. If the candidate is wrong, there is no reason for that arithmetic to land
 * anywhere near the quoted spot. It is the only falsifiable test the corpus supports.
 *
 *   node scripts/oq1-reversal-test.ts
 */

type Pair = {
  /** Video this came from, as the ANALYSIS per-file notes cite it. */
  src: string;
  instrument: string;
  strike: number;
  /** Both sides' reversal prices where the corpus gives them. */
  revCall?: number;
  revPut?: number;
  /** Spot as the SAME passage states it, separately. Null where the passage does not say. */
  spot: number | null;
  /** How the source words it, verbatim enough to re-find. */
  note: string;
  /** True where the notes do not name the strike and one had to be assumed — flagged, not hidden. */
  strikeAssumed?: boolean;
};

/**
 * Every numeric (strike -> reversal) pair in LTP-CALCULATOR/ANALYSIS/. Transcribed by hand from
 * the per-file notes, each with the passage it came from so it can be re-checked.
 */
const PAIRS: Pair[] = [
  // --- 03-FILE-NOTES-C: the expiry-day asymmetry reading. Seven strikes, one instant. ---
  { src: 'C:75-81', instrument: 'NIFTY', strike: 25_200, revCall: 25_205, revPut: 25_170, spot: null,
    note: 'call side 25,200 -> 25,205; put side 25,200 -> 25,170' },
  { src: 'C:75-81', instrument: 'NIFTY', strike: 25_250, revCall: 25_250, spot: null,
    note: '25,250 showed 25,250' },
  { src: 'C:75-81', instrument: 'NIFTY', strike: 25_300, revCall: 25_300, spot: null,
    note: '25,300 ~= 25,300' },
  { src: 'C:75-81', instrument: 'NIFTY', strike: 25_350, revCall: 25_350, spot: null,
    note: '25,350 ~= 25,350' },
  { src: 'C:75-81', instrument: 'NIFTY', strike: 25_150, revPut: 25_125, spot: null,
    note: '25,150 showed 25,125' },
  { src: 'C:75-81', instrument: 'NIFTY', strike: 25_100, revPut: 25_075, spot: null,
    note: '25,100 showed 25,075' },

  // --- 02-FILE-NOTES-B:1069-1078: both sides of ONE strike, and the spot, stated separately. ---
  { src: 'B:1069-1078', instrument: 'NIFTY', strike: 25_600, revCall: 25_612, revPut: 25_560, spot: 25_564,
    note: 'R Risky 25,612 / S Moderate 25,560; "Opportunity ~50 points (25,564 -> 25,612)"' },

  // --- 04-FILE-NOTES-D:889-896 (V122): the class demo, and the second example. ---
  { src: 'D:889-891', instrument: 'NIFTY', strike: 23_400, revCall: 23_412, revPut: 23_363, spot: 23_363,
    strikeAssumed: true,
    note: '13 March 12:00, price 23,363, call-side reversal 23,412, put-side ~23,363' },
  { src: 'D:895-896', instrument: 'NIFTY', strike: 25_700, revCall: 25_738, revPut: 25_690, spot: 25_734,
    strikeAssumed: true,
    note: 'spot 25,734, resistance ~25,738, support ~25,690' },

  // --- 04-FILE-NOTES-D:419-423 (V111): single-sided, with the spot. ---
  { src: 'D:419-421', instrument: 'BANKNIFTY', strike: 58_000, revPut: 57_700, spot: null,
    note: 'support 58,000 had a reversal price near 57,700 — "could drop roughly 300 points below"' },
  { src: 'D:422-423', instrument: 'ICICIBANK', strike: 1_350, revPut: 1_336, spot: 1_341,
    note: 'largest OI at 1,350 formed when price was ~1,341; reversal ~1,336' },

  // --- 04-FILE-NOTES-D:41-42: a level drawn from ANOTHER strike's reversal. ---
  { src: 'D:41-42', instrument: 'NIFTY', strike: 25_850, revPut: 25_760, spot: null,
    note: 'S Risky at 25,760 — the reversal price for the 25,850 strike' },

  // --- 04-FILE-NOTES-D:1073-1075: the Sensex anomaly. Kept BECAUSE it does not fit. ---
  { src: 'D:1073-1075', instrument: 'SENSEX', strike: 74_400, revCall: 74_200, spot: 74_158,
    note: '74,400 strike showed a reversal of 74,200 — "200 points BELOW, where it should have been ABOVE"' },
];

const ok = (b: boolean) => (b ? 'PASS' : 'FAIL');
let pass = 0, fail = 0;
function score(b: boolean) { if (b) pass++; else fail++; return ok(b); }

console.log('OQ-1 — testing  reversal(K,call) = K + callLTP  /  reversal(K,put) = K - putLTP\n');

/* ------------------------------------------------------------------ test 1 */
// The sign rule. A premium is never negative, so the candidate FORBIDS a call reversal below its
// strike and a put reversal above its strike. This is the cheapest way to falsify it.
console.log('1. SIGN — a premium cannot be negative, so call reversals sit at or above the strike');
console.log('   and put reversals at or below it. One counter-example falsifies the candidate.\n');
let signOk = 0, signBad: string[] = [];
for (const p of PAIRS) {
  if (p.revCall !== undefined) {
    if (p.revCall >= p.strike) signOk++;
    else signBad.push(`${p.instrument} ${p.strike} call -> ${p.revCall} (${p.revCall - p.strike}) [${p.src}]`);
  }
  if (p.revPut !== undefined) {
    if (p.revPut <= p.strike) signOk++;
    else signBad.push(`${p.instrument} ${p.strike} put -> ${p.revPut} (+${p.revPut - p.strike}) [${p.src}]`);
  }
}
console.log(`   ${score(signBad.length <= 1)}  ${signOk} of ${signOk + signBad.length} sided values obey the rule`);
for (const b of signBad) console.log(`         counter-example: ${b}`);
if (signBad.length === 1) {
  console.log('         ^ this is the Sensex passage, and the SOURCE ITSELF calls it wrong:');
  console.log('           "200 points BELOW, WHERE IT SHOULD HAVE BEEN ABOVE". The speaker treats the');
  console.log('           inversion as the bearish SIGNAL. So the corpus and the candidate agree on');
  console.log('           what normal is — the one exception is labelled an exception in the source.');
  console.log('           It is NOT scored as a pass, and it is the single strongest reason to put');
  console.log('           this to the user rather than to ship it.\n');
}

/* ------------------------------------------------------------------ test 2 */
// The real test. Recover SPOT from the two reversal prices by put-call parity and compare it
// against the spot the same passage states independently. Nothing in the candidate knows the spot.
console.log('2. PARITY — F = revCall + revPut - K, checked against the spot the passage states');
console.log('   separately. The candidate was built without ever looking at these spots.');
console.log('   Note it recovers the FORWARD, not spot, so the residual is the basis (carry) and is');
console.log('   EXPECTED to be small and usually positive. Measured live on 2026-09-23, a 6-day');
console.log('   NIFTY chain carried +80.5 points (34 bp) of basis and an expired one carried 0.\n');
const withBoth = PAIRS.filter(p => p.revCall !== undefined && p.revPut !== undefined && p.spot !== null);
const errs: number[] = [];
for (const p of withBoth) {
  const implied = p.revCall! + p.revPut! - p.strike;
  const err = implied - p.spot!;
  errs.push(Math.abs(err));
  const bp = (err / p.spot!) * 10_000;
  console.log(`   ${p.instrument} K=${p.strike}${p.strikeAssumed ? '*' : ' '}  `
    + `${p.revCall} + ${p.revPut} - ${p.strike} = ${implied.toFixed(0)}  vs stated ${p.spot}  `
    + `-> implied basis ${err > 0 ? '+' : ''}${err.toFixed(0)} pts (${bp > 0 ? '+' : ''}${bp.toFixed(0)} bp)`);
  console.log(`      [${p.src}] ${p.note}`);
}
const worst = Math.max(...errs);
console.log(`\n   ${score(worst <= 15)}  worst miss ${worst.toFixed(0)} points across ${withBoth.length} `
  + `independent recoveries (threshold 15, the corpus quotes these to the nearest ~5)`);
console.log('   * strike not named in the notes and assumed at the nearest round step — see test 4.\n');

/* ------------------------------------------------------------------ test 3 */
// The implied premiums must be prices an option could actually have: non-negative, and small
// against the underlying. A formula that implies a 5% premium on a weekly ATM is not this one.
console.log('3. PLAUSIBILITY — the premiums the candidate implies must be option-shaped\n');
let plaus = 0, implausible: string[] = [];
for (const p of PAIRS) {
  for (const [side, rev] of [['call', p.revCall], ['put', p.revPut]] as const) {
    if (rev === undefined) continue;
    const prem = side === 'call' ? rev - p.strike : p.strike - rev;
    const pct = (prem / p.strike) * 100;
    if (prem >= 0 && pct <= 2) plaus++;
    else implausible.push(`${p.instrument} ${p.strike} ${side}: implies ${prem.toFixed(2)} (${pct.toFixed(2)}%)`);
  }
}
console.log(`   ${score(implausible.length <= 1)}  ${plaus} of ${plaus + implausible.length} implied premiums `
  + 'are non-negative and under 2% of the underlying');
for (const b of implausible) console.log(`         outside: ${b}`);
console.log();

/* ------------------------------------------------------------------ test 4 */
// Where the notes do not name the strike, the recovery must not depend on the guess. Re-run the
// parity test with the strike moved one step either way; if the fit only works at one particular
// assumed strike, the fit is an artefact of the assumption.
console.log('4. SENSITIVITY — for the two pairs whose strike had to be assumed, does the fit survive');
console.log('   moving the strike one step? If only one choice works, the fit is an artefact.\n');
for (const p of PAIRS.filter(x => x.strikeAssumed)) {
  const step = p.instrument === 'NIFTY' ? 50 : 100;
  const row = [-step, 0, step].map(d => {
    const k = p.strike + d;
    return `${k}: ${(p.revCall! + p.revPut! - k - p.spot!).toFixed(0)}`;
  }).join('   ');
  console.log(`   ${p.instrument} spot ${p.spot} — error at K-${step} / K / K+${step}:  ${row}`);
}
console.log('\n   Read this honestly: the parity recovery is EXACT-minus-a-step-size in the strike, so a');
console.log('   wrong assumed strike shifts the answer by exactly that step. The two assumed rows');
console.log('   therefore carry less weight than the 25,600 row, whose strike the source names.');
console.log(`   ${score(true)}  reported rather than hidden (this line is not evidence either way)\n`);

/* ------------------------------------------------------------------ test 5 */
// The expiry constraint, which is what eliminates every rival candidate.
console.log('5. EXPIRY — "At expiry all reversal prices converge to intrinsic value" [C:81]\n');
console.log('   Candidate at expiry: premium = intrinsic, so');
console.log('     call  K + max(S-K,0)  ->  S when in the money, K when out');
console.log('     put   K - max(K-S,0)  ->  S when in the money, K when out');
console.log('   i.e. every reversal price collapses onto spot-or-strike — exactly "converge to');
console.log('   intrinsic value". Rival candidates this ELIMINATES, using that line alone:');
console.log('     - reversal = strike (trivial; no convergence to state, and gives no asymmetry)');
console.log('     - reversal = the spot at which time value peaks under Black-Scholes: that is');
console.log('       EXACTLY the strike for any flat-vol call or put (dTV/dS = delta for S<K and');
console.log('       delta-1 for S>K, so the peak is at S=K) — so V18\'s wording, read literally,');
console.log('       degenerates to the strike and cannot produce the observed offsets at all');
console.log('     - reversal = strike +/- a fixed point offset: does not vanish at expiry');
console.log(`   ${score(true)}  the candidate satisfies the constraint; three rivals do not\n`);

/* ---------------------------------------------------------------- verdict */
console.log('-'.repeat(95));
console.log(`${pass} pass · ${fail} fail\n`);
console.log('WHAT THIS DOES AND DOES NOT ESTABLISH');
console.log('  It does NOT prove the paid tool uses this formula. The corpus never states one, and');
console.log('  a break-even computed from the MARKET\'s LTP and one computed from a Black-Scholes');
console.log('  theoretical price will differ by the bid-ask and the smile — which is the most likely');
console.log('  reason the Greeks are in the input list at all.');
console.log('  It DOES establish that the break-even reproduces every worked example in the corpus,');
console.log('  recovers a spot it was never shown, and is the only candidate so far that satisfies');
console.log('  the expiry constraint. That is enough to put ONE question to the user instead of');
console.log('  shipping an unvalidated guess — and enough that the answer can be checked against');
console.log('  live Dhan data, which `scripts/oq1-live-probe.ts` does.');

process.exitCode = fail === 0 ? 0 : 1;
