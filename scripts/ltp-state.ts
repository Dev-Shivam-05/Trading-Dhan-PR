/**
 * `npm run ltpstate [-- <YYYY-MM-DD>]` — P49's state machine (`docs/spec/ltp-state-v1.md`) over the rebuilt
 * NIFTY minute chains (P48). With a date: that day's transitions, one line each. Without: counts over every
 * stored day. Reads local files only; makes no Dhan call.
 */

import { readDay, storedDays } from '../src/server/chainhist.ts';
import { runDay, type MinuteOut, type SideOut } from '../src/server/ltp-state.ts';

const date = process.argv[2];

const side = (s: SideOut) =>
  `${s.strike ?? '-'} ${s.grade ?? '-'} ${s.state ?? '-'}${s.dir ? '-' + s.dir : ''} → ${s.pressure ?? '-'}` +
  `${s.pct === null ? '' : ` ${s.pct.toFixed(1)}%`}${s.soc ? ` SOC ${s.soc.stage} ${s.soc.minutes}m` : ''}` +
  `${s.shift ? ` [shift ${s.shift.dir} ${s.shift.cause}]` : ''}${s.partial ? ' partial' : ''}${s.edge ? ' edge' : ''}`;

if (date) {
  const day = await readDay(date);
  if (!day) { console.log(`no stored chain for ${date} (npm run chainhist fetches it)`); process.exitCode = 1; }
  else {
    const out = runDay(day);
    let last = '';
    for (const m of out) {
      const key = [m.res.state, m.res.dir, m.res.pressure, m.res.strike, m.sup.state, m.sup.dir, m.sup.pressure, m.sup.strike,
        m.verdict, m.gop, m.res.soc?.stage, m.sup.soc?.stage, m.iv.balance, m.iv.move, m.noRead].join('|');
      if (key === last) continue;
      last = key;
      console.log(`${m.hm}${m.noRead ? ' NO READ' : ''}${m.late ? ' late' : ''}  R: ${side(m.res)}  |  S: ${side(m.sup)}  ⇒ ${m.verdict ?? '-'}` +
        `${m.gop ? ` (GoP ${m.gop})` : ''}  IV ${m.iv.ce?.toFixed(2) ?? '-'}/${m.iv.pe?.toFixed(2) ?? '-'} ${m.iv.balance}, ${m.iv.move}`);
    }
    console.log(`${out.length} minutes`);
  }
} else {
  const days = await storedDays(1);
  const count = new Map<string, number>();
  const add = (k: string, n = 1) => count.set(k, (count.get(k) ?? 0) + n);
  const shiftsPerDay: number[] = [];
  const t0 = Date.now();
  for (const d of days) {
    const day = await readDay(d);
    if (!day) { add('days unreadable'); continue; }
    const out: MinuteOut[] = runDay(day);
    if (!out.length) { add('days with no 09:15-15:29 minutes'); continue; }
    add('days');
    let shifts = 0;
    const socDay = new Set<string>();
    for (const m of out) {
      add('minutes');
      if (m.noRead) add('no-read minutes');
      for (const [n, s] of [['R', m.res], ['S', m.sup]] as const) {
        if (s.state) add(`state ${s.state === 'stable' || s.state === 'weak' ? s.state : `${s.state}-${s.dir}`}`);
        if (s.shift) { shifts++; add(`shift ${s.shift.cause}`); }
        if (s.partial) add('partial side-minutes');
        if (s.edge) add('edge side-minutes');
        if (s.soc?.stage === 'confirmed') socDay.add(n);
        if (s.soc) add(`SOC ${s.soc.stage} side-minutes`);
      }
      if (m.scenario) add(`scenario ${m.scenario}`);
      if (m.gop) add(`GoP ${m.gop}`);
      add(`IV balance ${m.iv.balance}`);
      add(`IV move ${m.iv.move}`);
    }
    for (const n of socDay) add(`days with a confirmed ${n === 'R' ? 'resistance (bullish)' : 'support (bearish)'} SOC`);
    shiftsPerDay.push(shifts);
  }
  const s = [...shiftsPerDay].sort((a, b) => a - b);
  console.log(`${days.length} stored days, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const [k, v] of [...count].sort()) console.log(`${k.padEnd(48)} ${v}`);
  if (s.length) console.log(`shifts per day (both sides): median ${s[s.length >> 1]}, max ${s.at(-1)}`);
}
