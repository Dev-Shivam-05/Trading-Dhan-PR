/**
 * Every stored NIFTY week with its two ranges, its index path and its expiry close (P54), for `ltprange` and its test.
 */

import { readDay, storedDays, readIndex } from '../../src/server/chainhist.ts';
import { readIdx, byDate } from '../../src/server/idxhist.ts';
import { weeksOf, rangeAt, minuteIndex, RANGE_HM, type Range, type Week } from '../../src/server/ltp-range.ts';

export type WeekData = Week & { range: Range | null; why: string | null; path: { t: number; h: number; l: number }[]; close: number | null; expiryInData: boolean };

export async function loadWeeks(): Promise<{ weeks: WeekData[]; dropped: Week | null; sessions: string[] }> {
  const sessions = await storedDays(1);
  const ix = await readIndex();
  const idxS = await readIdx();
  if (!idxS) throw new Error('no index history: run `npm run idxhist` first');
  const idx = byDate(idxS);
  const { weeks, dropped } = weeksOf(ix.expiries, sessions);
  const out: WeekData[] = [];
  for (const w of weeks) {
    // Row 3: the week's first REGULAR session. A Muhurat evening (1 Nov 2024, 21 Oct 2025) opens a week with no 09:15.
    let first = w.sessions[0]!, day = await readDay(first), i = day ? minuteIndex(day, RANGE_HM) : -1;
    for (const d of w.sessions.slice(1)) {
      if (i >= 0) break;
      first = d; day = await readDay(d); i = day ? minuteIndex(day, RANGE_HM) : -1;
    }
    const bar = day && i >= 0 ? idx.get(first)?.get(day.t[i]!) : undefined;
    const range = day && i >= 0 && bar ? rangeAt(day, i, bar.c, w.expiry) : null;
    const why = !day ? 'no chain' : i < 0 ? 'no 09:15 minute' : !bar ? 'no index bar at 09:15' : !range ? 'no strike with both legs' : null;
    const path: WeekData['path'] = [];
    let close: number | null = null;
    for (const d of w.sessions) {
      const m = idx.get(d);
      if (!m) continue;
      for (const [t, b] of [...m].sort((a, c) => a[0] - c[0])) {
        const hm = new Date(t + 5.5 * 3600_000).toISOString().slice(11, 16);
        if (hm > '15:29' || (range && t <= range.t)) continue;
        path.push({ t, h: b.h, l: b.l });
        if (d === w.expiry && hm === '15:29') close = b.c;
      }
    }
    out.push({ ...w, range, why, path, close, expiryInData: w.sessions.includes(w.expiry) });
  }
  return { weeks: out, dropped, sessions };
}
