/**
 * `npm run chainhist:verify -- <check>` — P48's acceptance checks on the stored chains
 * (`docs/spec/chain-rebuild-v1.md`). Reads files only; never calls Dhan.
 *   --bhav <BhavCopy_NSE_FO_..._<YYYYMMDD>_F_0000.csv>   AC2: summed minute volume vs NSE's official day volume
 *   --expiries                                          AC4: the calendar's expiry days vs the OI break the next morning
 *   --coverage                                          AC5: legs covered all day, and days that moved > 10 strikes
 *   --recording <YYYY-MM-DD>                            AC3: against P47's recording of that day
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { readDay, readIndex, storedDays, compareRecording, type ChainDay, type RecordedSnap } from '../src/server/chainhist.ts';
import { CHAIN_DIR } from '../src/server/chainrec.ts';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
let failed = false;
const verdict = (name: string, pass: boolean, detail: string) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`); if (!pass) failed = true; };
const STEP = 50;   // NIFTY's strike step near the money (M1's payloads: 23100, 23150, ...)
const lastOf = (xs: (number | null)[]) => { for (let i = xs.length - 1; i >= 0; i--) if (xs[i] !== null) return { i, x: xs[i]! }; return null; };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : NaN; };

/** AC2 (GUESS 0.05%, 5x M6's measured 0.0104%). */
async function bhav(file: string) {
  const ymd = /_(\d{8})_F_/.exec(path.basename(file))?.[1];
  if (!ymd) throw new Error('the bhavcopy file name carries its date: ..._YYYYMMDD_F_0000.csv');
  const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}`;
  const idx = await readIndex();
  const rows = new Map<string, { vol: number; lot: number }>();
  for (const line of (await readFile(file, 'utf8')).split(/\r?\n/).slice(1)) {
    const c = line.split(',');
    if (c[7] !== 'NIFTY' || c[4] !== 'IDO') continue;
    rows.set(`${c[9]}|${Number(c[11])}${c[12]}`, { vol: Number(c[24]), lot: Number(c[28]) });
  }
  for (const code of [1, 2] as const) {
    const day = await readDay(date, code), exp = idx.expiries[date]?.[`W${code}`];
    if (!day || !exp) { console.log(`W${code} ${date}: not stored`); continue; }
    let n = 0, worst = 0, worstLeg = '', missing = 0;
    for (const [k, leg] of Object.entries(day.legs)) {
      if (leg.v.some(x => x === null)) continue;
      const b = rows.get(`${exp}|${k}`);
      if (!b) { missing++; continue; }
      const sum = leg.v.reduce<number>((a, x) => a + x!, 0), want = b.vol * b.lot;
      const pct = want ? Math.abs(sum - want) / want * 100 : (sum ? Infinity : 0);
      n++;
      if (pct >= worst) { worst = pct; worstLeg = `${k} ${sum} vs ${b.vol} x ${b.lot}`; }
    }
    verdict(`AC2 W${code} ${date} (expiry ${exp}) summed volume`, n > 0 && missing === 0 && worst <= 0.05, `${n} legs covered all day, worst ${worst.toFixed(4)}% (${worstLeg}), ${missing} not in the bhavcopy`);
  }
}

/**
 * AC4 (amendment A3). Two independent signals vote on every stored session, and neither uses a chosen threshold:
 *  A. the cheaper leg of the ATM straddle at the last regular minute (15:29). On an expiry day it has
 *     minutes left and trades near 0.05; with a day or more left it carries time value.
 *  B. the OI break the next morning: first-minute OI at the next day's opening ATM ±3 strikes against
 *     this day's last OI at the same strikes. The same contract continues; after an expiry, WEEK 1 is a
 *     different contract.
 * Each signal is split into "expiry" and "not" at the largest gap in its own sorted log values, so the
 * data picks the cut. A calendar label is an ERROR only when BOTH signals contradict it; a day where one
 * signal alone disagrees is listed as noise. (The first version used B alone with "the groups must not
 * overlap": over 676 pairs one mislabelled Diwali day and a few gap-open mornings made that unpassable.)
 */
function splitAtLargestGap(xs: number[]): number {
  const s = [...xs].filter(x => x > 0).sort((a, b) => a - b);
  let best = 0, cut = NaN;
  for (let i = 1; i < s.length; i++) { const g = Math.log(s[i]!) - Math.log(s[i - 1]!); if (g > best) { best = g; cut = Math.sqrt(s[i]! * s[i - 1]!); } }
  return cut;
}
async function expiries() {
  const idx = await readIndex(), dates = await storedDays(1);
  type Pt = { d: string; cal: boolean; a: number | null; b: number | null; legs: number };
  const pts = new Map<string, Pt>();
  let prev: ChainDay | null = null;
  for (const date of dates) {
    const day = (await readDay(date, 1))!;
    let i = day.t.length - 1;
    while (i > 0 && ((day.t[i]! + 19_800_000) % 86_400_000) / 60_000 >= 930) i--;
    const K = day.atm[i], ce = K == null ? null : day.legs[`${K}CE`]?.c[i], pe = K == null ? null : day.legs[`${K}PE`]?.c[i];
    pts.set(date, { d: date, cal: idx.expiries[date]?.W1 === date, a: ce != null && pe != null ? Math.min(ce, pe) : null, b: null, legs: 0 });
    if (prev) {
      const atm0 = day.atm[0] ?? day.atm.find(x => x !== null);
      const jumps: number[] = [];
      if (atm0 != null) for (let s = -3; s <= 3; s++) for (const side of ['CE', 'PE']) {
        const k = `${atm0 + s * STEP}${side}`, a = prev.legs[k], b = day.legs[k];
        const last = a ? lastOf(a.oi) : null, first = b?.oi[0] ?? null;
        if (!last || last.i !== prev.t.length - 1 || !first || !last.x) continue;
        jumps.push(Math.abs(Math.log(first / last.x)));
      }
      const p = pts.get(prev.date)!;
      if (jumps.length) { p.b = median(jumps); p.legs = jumps.length; }
    }
    prev = day;
  }
  const all = [...pts.values()];
  const cutA = splitAtLargestGap(all.map(p => p.a ?? 0)), cutB = splitAtLargestGap(all.map(p => p.b ?? 0));
  const saysA = (p: Pt) => (p.a === null ? null : p.a < cutA), saysB = (p: Pt) => (p.b === null ? null : p.b > cutB);
  const fmt = (p: Pt) => `${p.d} ${new Date(p.d + 'T00:00:00Z').toUTCString().slice(0, 3)} (cheap leg ${p.a ?? '-'}, next-morning OI ${p.b === null ? '-' : (100 * (Math.exp(p.b) - 1)).toFixed(1) + '%'} over ${p.legs} legs)`;
  console.log(`sessions ${all.length}, calendar expiries ${all.filter(p => p.cal).length}; signal A cut ${cutA.toFixed(2)} (cheap leg), signal B cut ${(100 * (Math.exp(cutB) - 1)).toFixed(1)}% (OI break)`);
  const errors: Pt[] = [], noise: Pt[] = [];
  for (const p of all) {
    const a = saysA(p), b = saysB(p);
    const against = [a, b].filter(x => x !== null && x !== p.cal).length, voters = [a, b].filter(x => x !== null).length;
    if (voters && against === voters) errors.push(p); else if (against) noise.push(p);
  }
  for (const p of noise) console.log(`  one signal disagrees (kept): calendar says ${p.cal ? 'expiry' : 'not'} ${fmt(p)}`);
  for (const p of errors) console.log(`  ERROR: calendar says ${p.cal ? 'expiry' : 'not an expiry'}, every signal says otherwise: ${fmt(p)}`);
  verdict('AC4 expiry labels', errors.length === 0 && all.some(p => p.cal), `${errors.length} calendar errors, ${noise.length} days where one signal alone disagrees`);
}

/** AC5: printed, not thresholded. */
async function coverage() {
  const idx = await readIndex(), dates = await storedDays(1);
  const rows: { d: string; full: number; legs: number; drift: number; candles: number; conflicts: number }[] = [];
  for (const date of dates) {
    const day = (await readDay(date, 1))!;
    const a = day.atm.filter((x): x is number => x !== null), a0 = a[0] ?? 0;
    const drift = a.reduce((m, x) => Math.max(m, Math.abs(x - a0) / STEP), 0);
    // "Covered" is judged over 09:15-15:29 only. The candles after 15:29 (one at 15:30 in 2024, ten to 15:39
    // in 2026) come for some offsets and not others, which would count nearly every leg as not covered.
    const inSession = day.t.map(ms => { const m = ((ms + 19_800_000) % 86_400_000) / 60_000; return m >= 555 && m < 930; });
    const full = Object.values(day.legs).filter(l => l.c.every((x, i) => x !== null || !inSession[i])).length;
    rows.push({ d: date, full, legs: Object.keys(day.legs).length, drift, candles: day.t.length, conflicts: day.conflicts });
  }
  const full = rows.map(r => r.full), big = rows.filter(r => r.drift > 10);
  console.log(`W1 days ${rows.length} (${rows[0]?.d} .. ${rows.at(-1)?.d}); incomplete (not stored) ${Object.keys(idx.incomplete).length}`);
  console.log(`legs covered every minute 09:15-15:29 (42 if the ATM never moved): min ${Math.min(...full)}, median ${median(full)}, max ${Math.max(...full)}`);
  console.log(`candles per day: ${[...new Set(rows.map(r => r.candles))].sort((a, b) => a - b).join(', ')}; days with conflicts ${rows.filter(r => r.conflicts).length}`);
  console.log(`days the ATM moved more than 10 strikes from its opening strike: ${big.length} of ${rows.length} (${(100 * big.length / Math.max(1, rows.length)).toFixed(1)}%)`);
  for (const r of [...rows].sort((a, b) => a.full - b.full).slice(0, 5)) console.log(`  thinnest: ${r.d} ${r.full} full legs, drift ${r.drift} strikes`);
  for (const [d, why] of Object.entries(idx.incomplete)) console.log(`  incomplete: ${d} ${why}`);
}

/** AC3: 100% of LTPs inside the minute's range, >= 99% OI equal (GUESS), volume within 0.05%, no strike outside ±20. */
async function recording(date: string) {
  const idx = await readIndex(), dir = path.join(CHAIN_DIR, date);
  const files = await readdir(dir).catch(() => [] as string[]);
  for (const code of [1, 2] as const) {
    const exp = idx.expiries[date]?.[`W${code}`], day = await readDay(date, code);
    const f = files.find(x => x.endsWith(`-${exp}.jsonl`) || x.endsWith(`-${exp}.jsonl.gz`));
    if (!day || !exp || !f) { verdict(`AC3 W${code} ${date}`, false, `rebuilt ${day ? 'yes' : 'no'}, expiry ${exp ?? '?'}, recording ${f ?? 'none'} in ${files.join(', ') || '(empty)'}`); continue; }
    const raw = await readFile(path.join(dir, f));
    const snaps: RecordedSnap[] = (f.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const r = compareRecording(day, snaps);
    const oiPct = r.oi.checked ? 100 * r.oi.equal / r.oi.checked : 0;
    verdict(`AC3a W${code} strikes inside the recording`, r.strikesOutside === 0, `${r.strikesOutside} rebuilt legs outside`);
    verdict(`AC3b W${code} LTP inside the minute's range`, r.ltp.checked > 0 && r.ltp.inside === r.ltp.checked, `${r.ltp.inside}/${r.ltp.checked}${r.ltp.outside.length ? ': ' + r.ltp.outside.slice(0, 3).join(' | ') : ''}`);
    verdict(`AC3c W${code} OI equals minute M or M-1`, oiPct >= 99, `${oiPct.toFixed(2)}% of ${r.oi.checked}${r.oi.worst.length ? ': ' + r.oi.worst.slice(0, 3).join(' | ') : ''}`);
    verdict(`AC3d W${code} day volume`, r.vol.legs > 0 && r.vol.worstPct <= 0.05, `${r.vol.legs} legs, worst ${r.vol.worstPct.toFixed(4)}% (${r.vol.worst})`);
  }
}

const b = arg('--bhav'), rec = arg('--recording');
if (b) await bhav(b);
if (argv.includes('--expiries')) await expiries();
if (argv.includes('--coverage')) await coverage();
if (rec) await recording(rec);
if (!b && !rec && !argv.includes('--expiries') && !argv.includes('--coverage')) console.log('usage: --bhav <csv> | --expiries | --coverage | --recording <date>');
if (failed) process.exitCode = 1;
