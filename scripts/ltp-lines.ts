/**
 * `npm run ltplines [-- <YYYY-MM-DD>]` — P50's line sets (`docs/spec/ltp-lines-v1.md`) over the rebuilt NIFTY
 * chains (P48) and the index's own minutes (`npm run idxhist`). With a date: that day's 920 lines, its AI lines
 * every 30 minutes, and every touch with its veto. Without: counts over every stored day. No Dhan call.
 */

import { readDay, storedDays } from '../src/server/chainhist.ts';
import { readIdx, byDate } from '../src/server/idxhist.ts';
import { daySignals, AI_NAMES, VETOES, type Signal } from '../src/server/ltp-lines.ts';

const date = process.argv[2];
const idxS = await readIdx();
if (!idxS) console.log('WARNING: no index history (npm run idxhist) — touches fall back to the chain close');
const idx = idxS ? byDate(idxS) : new Map();
const f = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toFixed(2));
const sig = (s: Signal) => `${s.hm} ${s.kind.padEnd(3)} ${s.line.padEnd(10)} buy ${s.buy} at ${f(s.entry)}  stop ${f(s.stop)}  target ${f(s.target)}  [${s.verdict ?? '-'}]  ${s.veto ? 'VETO ' + s.veto : 'ACCEPTED'}`;

if (date) {
  const day = await readDay(date);
  if (!day) { console.log(`no stored chain for ${date}`); process.exitCode = 1; }
  else {
    const d = daySignals(day, idx.get(date));
    const L = d.l920;
    console.log(`${date}  920 lines (09:20 candle): ${L.ready ? `R ${L.R} / S ${L.S}, step ${L.step}, close ${f(L.close)}, gap width ${f(L.gapWidth)}` : L.note}`);
    for (const l of L.lines) console.log(`  ${l.name.padEnd(6)} ${l.strike} buy ${l.buy}  ${f(l.value)}${l.missing ? `  MISSING (${l.missing})` : ''}  target ${f(l.target)}`);
    if (L.ready) console.log(`  stop for puts (EOR+2) ${f(L.stopPut)}, for calls (EOS-2) ${f(L.stopCall)}; divergences ${L.divergences.map(f).join(' ') || 'none'}${L.coincide.length ? `; coincide ${L.coincide.join(', ')}` : ''}`);
    for (let i = 0; i < d.minutes.length; i += 30) {
      const a = d.ai[i], m = d.minutes[i]!;
      if (!a) { console.log(`  ${m.hm} AI: no reading`); continue; }
      console.log(`  ${m.hm} AI [${d.states[i]?.verdict ?? '-'}] R ${a.R} S ${a.S}: ` + AI_NAMES.map(n => `${n} ${a.drawn.has(n) ? f(a.value[n]) : '·'}`).join(' | '));
    }
    for (const s of d.signals) console.log('  ' + sig(s));
    console.log(`${d.signals.length} touches, ${d.signals.filter(s => !s.veto).length} accepted; index bars missing ${d.minutes.filter(m => m.idxMissing).length}`);
  }
} else {
  const days = await storedDays(1);
  const n = new Map<string, number>();
  const add = (k: string, v = 1) => n.set(k, (n.get(k) ?? 0) + v);
  const t0 = Date.now();
  for (const date of days) {
    const day = await readDay(date);
    if (!day) continue;
    const d = daySignals(day, idx.get(date));
    if (!d.minutes.length) continue;
    add('days');
    for (const m of d.minutes) { add('minutes'); if (m.idxMissing) add('minutes without an index bar'); }
    const L = d.l920;
    if (!L.ready) { add('920 not ready'); continue; }
    const present = L.lines.filter(l => !l.missing).length;
    add(`920 lines present: ${present}`);
    for (const l of L.lines) if (l.missing) add(`920 missing ${l.name} (${l.missing})`);
    if (L.coincide.length) add('920 days with coinciding lines');
    const v = Object.fromEntries(L.lines.map(l => [l.name, l.value]));
    if (v['EOR+1'] !== null && v['EOR'] !== null && v['EOR+1']! <= v['EOR']!) add('AC1 EOR+1 <= EOR');
    if (v['EOS-1'] !== null && v['EOS'] !== null && v['EOS-1']! >= v['EOS']!) add('AC1 EOS-1 >= EOS');
    const upper = L.lines.slice(0, 2).every(l => l.missing), lower = L.lines.slice(2).every(l => l.missing);
    if (upper) add('920 no upper line'); if (lower) add('920 no lower line');
    if (L.gapWidth !== null) add(L.gapWidth <= 50 ? 'gap width <= 50' : L.gapWidth <= 100 ? 'gap width 51-100' : 'gap width > 100');
    for (const s of d.signals) add(`${s.kind} ${s.line} ${s.veto ?? 'ACCEPTED'}`);
    for (const s of d.signals) add(`${s.kind} total ${s.veto ?? 'ACCEPTED'}`);
  }
  console.log(`${days.length} stored days, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const [k, v] of [...n].sort()) console.log(`${k.padEnd(44)} ${v}`);
  void VETOES;
}
