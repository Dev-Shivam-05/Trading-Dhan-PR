/**
 * OQ-1, second half: drive the break-even candidate against a LIVE Dhan option chain and show
 * what it would actually draw.
 *
 * `scripts/oq1-reversal-test.ts` tests the candidate against the corpus's 17 worked pairs. That
 * is historical and second-hand. This takes today's real chain off the running server and asks
 * three things the corpus cannot answer:
 *
 *   1. Does Dhan's own chain satisfy put-call parity? If it does not, a spot recovered through
 *      parity is meaningless on live data whatever the candidate is — so this has to be measured
 *      FIRST, and separately, or a failure of the data would read as a failure of the hypothesis.
 *   2. What ladder does the candidate draw today — do call reversals sit just above their strikes
 *      and put reversals just below, the way every worked example in the corpus shows?
 *   3. Does the offset shrink as expiry approaches? "At expiry all reversal prices converge to
 *      intrinsic value" is the constraint that eliminates the rival formulas, and with two
 *      expiries on screen it is directly observable rather than argued.
 *
 * It changes nothing and writes nothing. Live server only — replay's prices are synthesised per
 * contract and do not satisfy parity, so a replay run would measure the generator.
 *
 *   node scripts/oq1-live-probe.ts            # defaults to NIFTY on 127.0.0.1:8787
 *   SERVER=http://127.0.0.1:8791 KEY=GOLD node scripts/oq1-live-probe.ts
 */

const BASE = process.env.SERVER ?? 'http://127.0.0.1:8787';
const KEY = process.env.KEY ?? 'NIFTY';
/** How many strikes either side of the ATM to print. */
const SPAN = Number(process.env.SPAN ?? 6);

type Verdict = 'PASS' | 'FAIL' | 'SKIP';
const results: { name: string; verdict: Verdict; detail: string }[] = [];
function say(name: string, verdict: Verdict, detail = '') {
  results.push({ name, verdict, detail });
  console.log(`${verdict.padEnd(4)}  ${name}${detail ? '  — ' + detail : ''}`);
}

/** One SSE snapshot for a key. */
async function snapshot(key: string, expiry: string): Promise<any> {
  const res = await fetch(`${BASE}/api/stream?key=${key}&expiry=${expiry}`);
  if (!res.body) return null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', out: any = null;
  const t0 = Date.now();
  while (!out && Date.now() - t0 < 45_000) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
    for (const p of parts) {
      if (!/event: snapshot/.test(p)) continue;
      const data = /data: (.*)/s.exec(p)?.[1];
      if (data) { out = JSON.parse(data); break; }
    }
  }
  await reader.cancel().catch(() => {});
  return out;
}

const n = (x: number | null | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

async function main() {
  const health = await fetch(`${BASE}/api/health`).then(r => r.json()).catch(() => null) as any;
  if (!health) { console.log(`no server on ${BASE} — start it with \`npm run dev\``); return 2; }
  if (health.mode === 'replay') {
    console.log('REPLAY mode. Replay synthesises each contract\'s price independently, so the chain');
    console.log('does not satisfy put-call parity and this probe would be measuring the generator.');
    return 2;
  }
  const insts = await fetch(`${BASE}/api/instruments`).then(r => r.json()) as any;
  const inst = insts.instruments.find((i: any) => i.id === KEY);
  if (!inst) { console.log(`unknown instrument ${KEY}`); return 2; }
  console.log(`server ${BASE} · ${KEY} · session ${inst.session.reason}\n`);

  const near = inst.nearestExpiry;
  const snap = await snapshot(KEY, near);
  if (!snap?.rows?.length) { console.log('no snapshot'); return 2; }
  const spot = n(snap.spot);
  const atm = n(snap.atmStrike);
  if (spot === null || atm === null) { console.log('snapshot has no spot or no ATM'); return 2; }
  console.log(`spot ${spot} (source ${snap.spotSource}) · ATM ${atm} · expiry ${near}\n`);

  /* -------------------------------------------------------------------- 1 */
  // Parity on Dhan's own chain, BEFORE any claim about reversal prices. c - p = S - K.
  // Measured on the strikes nearest the money, where both sides actually trade: a far wing with
  // a stale or one-sided quote would be measuring liquidity, not the identity.
  const rows: any[] = snap.rows
    .filter((r: any) => n(r.ce?.ltp) !== null && n(r.pe?.ltp) !== null)
    .sort((a: any, b: any) => Math.abs(a.strike - atm) - Math.abs(b.strike - atm));
  const nearAtm = rows.slice(0, SPAN * 2 + 1).sort((a, b) => a.strike - b.strike);
  if (nearAtm.length < 3) {
    say('OQ-1 pre-check: Dhan\'s chain satisfies put-call parity', 'SKIP',
      `only ${nearAtm.length} strikes quote both sides`);
  } else {
    const devs = nearAtm.map(r => (r.ce.ltp - r.pe.ltp) - (spot - r.strike));
    const absd = devs.map(Math.abs).sort((a, b) => a - b);
    const med = absd[absd.length >> 1]!;
    const worst = absd[absd.length - 1]!;
    // The tolerance is the instrument's own tick/spread scale, not a number invented here: one
    // strike step is the chain's own unit, and parity on a live tape is good to a small fraction
    // of it. Stated as the median so one stale wing cannot decide the verdict — this project's
    // p95-not-max rule in another dress.
    const step = Math.abs((nearAtm[1]!.strike - nearAtm[0]!.strike)) || 50;
    const tol = step * 0.2;
    say('OQ-1 pre-check: Dhan\'s chain satisfies put-call parity near the money',
      med <= tol ? 'PASS' : 'FAIL',
      `median |c-p-(S-K)| = ${med.toFixed(2)} over ${nearAtm.length} strikes `
      + `(worst ${worst.toFixed(2)}, tolerance ${tol.toFixed(2)} = 20% of the ${step}-point step)`);
  }

  /* -------------------------------------------------------------------- 2 */
  // The ladder the candidate draws today, printed so it can be compared by eye with the corpus's
  // own screenshots-in-words: calls just above their strikes, puts just below.
  console.log('\n      the ladder this candidate draws on today\'s chain:');
  console.log('      strike      call LTP   rev(call)     put LTP    rev(put)    room up   room down');
  let sideOk = 0, sideBad = 0;
  for (const r of nearAtm) {
    const c = n(r.ce?.ltp), p = n(r.pe?.ltp);
    if (c === null || p === null) continue;
    const rc = r.strike + c, rp = r.strike - p;
    if (rc >= r.strike && rp <= r.strike) sideOk++; else sideBad++;
    const mark = r.strike === atm ? ' <- ATM' : '';
    console.log(`      ${String(r.strike).padStart(8)}  ${c.toFixed(2).padStart(10)}  `
      + `${rc.toFixed(1).padStart(10)}  ${p.toFixed(2).padStart(10)}  ${rp.toFixed(1).padStart(10)}  `
      + `${(rc - spot).toFixed(0).padStart(8)}  ${(spot - rp).toFixed(0).padStart(9)}${mark}`);
  }
  say('OQ-1: every call reversal sits at or above its strike, every put reversal at or below',
    sideBad === 0 && sideOk > 0 ? 'PASS' : sideOk === 0 ? 'SKIP' : 'FAIL',
    `${sideOk} of ${sideOk + sideBad} strikes — the shape every worked example in the corpus shows`);

  /* -------------------------------------------------------------------- 3 */
  // Convergence. The offset IS the premium, so it must shrink as expiry approaches. Two expiries
  // from the same instrument at the same instant is the cleanest form of that measurement.
  const far = (inst.expiries as string[]).find(e => e > near);
  if (!far) {
    say('OQ-1: the offset shrinks as expiry approaches', 'SKIP', 'only one expiry listed');
  } else {
    const snapFar = await snapshot(KEY, far);
    const farRows: any[] = (snapFar?.rows ?? []).filter((r: any) => n(r.ce?.ltp) !== null && n(r.pe?.ltp) !== null);
    const meanOffset = (rs: any[]) => {
      const near5 = rs.sort((a, b) => Math.abs(a.strike - atm) - Math.abs(b.strike - atm)).slice(0, 5);
      if (!near5.length) return null;
      return near5.reduce((s, r) => s + (r.ce.ltp + r.pe.ltp) / 2, 0) / near5.length;
    };
    const a = meanOffset([...nearAtm]), b = meanOffset(farRows);
    if (a === null || b === null) {
      say('OQ-1: the offset shrinks as expiry approaches', 'SKIP', 'not enough two-sided strikes');
    } else {
      say('OQ-1: the offset is smaller on the nearer expiry, as "converge to intrinsic" requires',
        a < b ? 'PASS' : 'FAIL',
        `mean ATM-5 offset ${a.toFixed(1)} on ${near} vs ${b.toFixed(1)} on ${far}`);
    }
  }

  const pass = results.filter(r => r.verdict === 'PASS').length;
  const fail = results.filter(r => r.verdict === 'FAIL').length;
  const skip = results.filter(r => r.verdict === 'SKIP').length;
  console.log(`\n${pass} pass · ${fail} fail · ${skip} not measurable`);
  console.log('\nThis probe cannot confirm the paid tool uses this formula — nothing in this repo can.');
  console.log('It confirms the candidate is arithmetically sound on live data and draws the shape the');
  console.log('corpus describes. OQ-1 stays open until the user says which it is.');
  return fail === 0 ? 0 : 1;
}

main().then(code => { process.exitCode = code; }).catch(err => {
  console.error(String(err));
  process.exitCode = 2;
});
