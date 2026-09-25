/**
 * `npm run chainhist:test`: P48's chain rebuild (`docs/spec/chain-rebuild-v1.md`) without the network.
 * `dhanPost` is faked; CACHE_DIR is a scratch directory. Every rule is also shown rejecting something.
 */

import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.CACHE_DIR = await mkdtemp(path.join(os.tmpdir(), 'chainhist-test-'));
delete process.env.REPLAY;
const H = await import('../src/server/chainhist.ts');

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const IST = 5.5 * 3600_000;
const sec = (date: string, hm: string) => (Date.parse(`${date}T${hm}:00Z`) - IST) / 1000;

/**
 * A fake rollingoption payload for one (offset, side) over `dates`: 3 minutes a day. The ATM is
 * 23,000 at 09:15 and 09:16 and 23,050 at 09:17, so strikes shift under the offsets in minute 3.
 * Each leg's numbers are a function of (strike, side, minute) only, so two offsets that show the
 * same strike in the same minute agree, as the real endpoint must.
 */
function series(off: number, side: 'CALL' | 'PUT', dates: string[], tamper = false) {
  const s = { timestamp: [] as number[], open: [] as number[], high: [] as number[], low: [] as number[], close: [] as number[], iv: [] as number[], volume: [] as number[], strike: [] as number[], oi: [] as number[], spot: [] as number[] };
  for (const d of dates) ['09:15', '09:16', '09:17'].forEach((hm, m) => {
    const atm = m < 2 ? 23000 : 23050, k = atm + off * 50, base = (side === 'CALL' ? 1 : 2) * 1000 + k / 100 + m;
    s.timestamp.push(sec(d, hm)); s.strike.push(k); s.spot.push(atm + 3);
    s.open.push(base); s.high.push(base + 2); s.low.push(base - 2); s.close.push(base + 1);
    s.volume.push(k + m + (tamper && m === 2 ? 1 : 0)); s.oi.push(k * 10 + m); s.iv.push(12);
  });
  return s;
}
function all42(dates: string[], opts: { drop?: string; tamperOff?: number } = {}) {
  const m = new Map<string, any>();
  for (const side of H.SIDES) for (const off of H.OFFSETS) {
    const name = `${off}|${side}`;
    m.set(name, name === opts.drop ? { timestamp: [] } : series(off, side, dates, off === opts.tamperOff && side === 'CALL'));
  }
  return m;
}

/* ------------------------------------------------------------ row 5: stitching */
{
  const { days, incomplete } = H.stitch(all42(['2026-09-24', '2026-09-25']), 1);
  ok('two dates stitched into two days', days.length === 2 && !Object.keys(incomplete).length, `${days.length} days`);
  const d = days[1]!;
  ok('each day has its 3 minutes', d.t.length === 3);
  // ATM-10..ATM+10 at ATM 23000 = 22500..23500 (21 strikes); minute 3 adds 23550 and drops 22500 -> 22 strikes per side
  ok('22 strikes per side, 44 legs', Object.keys(d.legs).length === 44, `${Object.keys(d.legs).length}`);
  ok('a strike that left the window is null for that minute', d.legs['22500CE']!.c[2] === null && d.legs['22500CE']!.c[0] !== null);
  ok('a strike that entered is null before it', d.legs['23550PE']!.c[0] === null && d.legs['23550PE']!.c[2] !== null);
  ok('atm[] is the offset-0 strike each minute', d.atm.join() === '23000,23000,23050');
  ok('values filed under their own strike', d.legs['23100CE']!.c[2] === 1000 + 231 + 2 + 1 && d.legs['23100PE']!.oi[0] === 231000);
  ok('no conflicts on consistent data', d.conflicts === 0);
  const s = H.summarise(d);
  ok('summary: 42 legs cover all 3 minutes, 2 do not', s.fullLegs === 40 && s.legs === 44, JSON.stringify(s));
}
{
  const { days } = H.stitch(all42(['2026-09-25'], { tamperOff: 1 }), 1);
  // at minute 3 offset +1 (23100) and offset 0 at minute 1-2 do not overlap, but offset +1 at minute 3 is strike 23100,
  // which offset +2 showed at minutes 1-2 only: no overlap in the same minute, so no conflict is possible from a
  // single offset. Tamper produces one only if the same (strike, minute) is reported twice:
  ok('a tampered value with no duplicate cell is not a conflict', days[0]!.conflicts === 0);
  const m = all42(['2026-09-25']);
  const dup = structuredClone(m.get('3|CALL'));
  dup.volume[0] += 7;
  m.set('2|CALL', { ...dup, strike: dup.strike });   // offset 2's name now reports offset 3's strikes, one volume off
  const r = H.stitch(m, 1);
  ok('the same strike and minute from two series that disagree is counted as a conflict', r.days[0]!.conflicts === 1, `${r.days[0]!.conflicts}`);
}
{
  const { days, incomplete } = H.stitch(all42(['2026-09-24', '2026-09-25'], { drop: '10|PUT' }), 1);
  ok('a day missing from one series is not written', days.length === 0);
  ok('...and is listed as incomplete, naming the series', /1 of 42 series missing \(10\|PUT\)/.test(incomplete['2026-09-25'] ?? ''), incomplete['2026-09-25']);
}
{
  const { days } = H.stitch(all42(['2026-09-24', '2026-09-25']), 1, d => d >= '2026-09-25');
  ok('a date filter keeps only the requested span', days.length === 1 && days[0]!.date === '2026-09-25');
}

/* ------------------------------------------------------------ row 3: months */
{
  const m = H.months('2024-01-01', '2024-03-10');
  ok('calendar months, the last one cut at the last day', m.map(x => `${x.a}..${x.b}`).join(' ') === '2024-01-01..2024-01-31 2024-02-01..2024-02-29 2024-03-01..2024-03-10');
  ok('a month is at most 31 days', H.months('2024-01-01', '2026-09-25').every(x => (Date.parse(x.b) - Date.parse(x.a)) / 86_400_000 <= 30));
  ok('December rolls to January', H.months('2024-12-15', '2025-01-05').map(x => x.key).join() === '2024-12,2025-01');
}

/* ------------------------------------------------------------ row 8: the expiry calendar */
{
  const sessions = new Set(['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
    '2025-08-27', '2025-08-28', '2025-08-29', '2025-09-01', '2025-09-02', '2025-03-31', '2025-04-01', '2025-04-02', '2025-04-03', '2025-04-04', '2025-04-07', '2025-04-08', '2025-04-09', '2025-04-11', '2025-04-15', '2025-04-16', '2025-04-17']);
  const last = '2026-09-25';
  ok('Jan 2024: Thursday', H.weeklyExpiry('2024-01-08', sessions, last) === '2024-01-11');
  ok('the expiry day is its own expiry (M2)', H.weeklyExpiry('2024-01-11', sessions, last) === '2024-01-11');
  ok('the day after rolls to the next Thursday', H.weeklyExpiry('2024-01-12', sessions, '2024-01-12') === '2024-01-18');
  ok('Sep 2026: Tuesday', H.weeklyExpiry('2026-09-23', sessions, last) === '2026-09-29' && H.weeklyExpiry('2026-09-21', sessions, last) === '2026-09-22');
  ok('28 Aug 2025 is still a Thursday expiry', H.weeklyExpiry('2025-08-27', sessions, last) === '2025-08-28');
  ok('29 Aug 2025 rolls to Tuesday 2 Sep, not Thursday 4 Sep', H.weeklyExpiry('2025-08-29', sessions, last) === '2025-09-02');
  // 10 Apr 2025 (a Thursday) is absent from `sessions`: the expiry moves to Wednesday 9 Apr
  ok('a holiday on the expiry day moves it to the previous session', H.weeklyExpiry('2025-04-07', sessions, last) === '2025-04-09');
  ok('...and the session after it rolls on to the next week', H.weeklyExpiry('2025-04-11', sessions, last) === '2025-04-17');
  const lab = H.labelExpiries(['2026-09-22', '2026-09-23']);
  ok('WEEK 2 is the expiry after WEEK 1', lab['2026-09-22']!.W1 === '2026-09-22' && lab['2026-09-22']!.W2 === '2026-09-29' && lab['2026-09-23']!.W2 === '2026-10-06');
}

/* ------------------------------------------------------------ rows 3, 4, 6, 7: the fetch */
function fakeDhan(opts: { fail?: (b: any) => boolean } = {}) {
  const calls: any[] = [];
  const post = async (b: any) => {
    calls.push(b);
    if (opts.fail?.(b)) return { ok: false, httpStatus: 500, bytes: 0, data: null, error: { code: 'X', type: '', message: 'boom', httpStatus: 500, retryable: false }, timing: {} as any };
    const off = b.strike === 'ATM' ? 0 : Number(b.strike.slice(3));
    // sessions: the weekdays of the span
    const dates: string[] = [];
    for (let d = b.fromDate; d < b.toDate; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
      const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (wd !== 0 && wd !== 6) dates.push(d);
    }
    const s = series(off, b.drvOptionType, dates);
    return { ok: true, httpStatus: 200, bytes: 1, data: { data: b.drvOptionType === 'CALL' ? { ce: s, pe: null } : { ce: null, pe: s } }, error: null, timing: {} as any };
  };
  return { calls, post };
}
const now = Date.parse('2026-09-25T17:00:00Z') - IST;   // 17:00 IST: 25 Sep is complete
const codes = [{ code: 1, from: '2026-08-20' }, { code: 2, from: '2026-09-21' }];
const big = async () => 10e9;
{
  process.env.REPLAY = '1';
  let err = '';
  try { await H.updateChainHistory(null, now, { calls: 0, failed: [], written: 0, bytes: 0 }, undefined, { post: fakeDhan().post, freeBytes: big, codes }); } catch (e) { err = String(e); }
  ok('replay mode refuses', /refuses to run in replay/.test(err));
  delete process.env.REPLAY;
  err = '';
  try { await H.updateChainHistory(null, now, { calls: 0, failed: [], written: 0, bytes: 0 }, undefined, { post: fakeDhan().post, freeBytes: async () => 1.5e9, codes }); } catch (e) { err = String(e); }
  ok('below 2 GB free it refuses', /only 1.50 GB free/.test(err), err.slice(0, 80));
}
{
  // a failing series skips its month and writes nothing for it
  const f = fakeDhan({ fail: b => b.fromDate.startsWith('2026-09') && b.strike === 'ATM+4' && b.drvOptionType === 'PUT' && b.expiryCode === 1 });
  const log = { calls: 0, failed: [] as string[], written: 0, bytes: 0 };
  const r = await H.updateChainHistory(null, now, log, undefined, { post: f.post, freeBytes: big, codes, retryPauseMs: 1 });
  ok('a failed series is logged and its month skipped', log.failed.length === 1 && !r.idx.months['W1-2026-09'] && r.idx.months['W1-2026-08'] === '2026-08-31', log.failed[0]);
  ok('the month after a failed series stops calling (no wasted 37 calls)', f.calls.filter(b => b.expiryCode === 1 && b.fromDate.startsWith('2026-09')).length === 21 + 15);
  ok('August W1 written: 8 weekdays 20-31 Aug', (await H.storedDays(1)).filter(d => d.startsWith('2026-08')).length === 8);
  // the next run fetches only the failed month
  const g = fakeDhan();
  const log2 = { calls: 0, failed: [] as string[], written: 0, bytes: 0 };
  const r2 = await H.updateChainHistory(null, now, log2, undefined, { post: g.post, freeBytes: big, codes });
  ok('resume: only the missing month is fetched (42 calls)', log2.calls === 42 && g.calls.every(b => b.fromDate === '2026-09-01' && b.expiryCode === 1), `${log2.calls} calls`);
  ok('September W1 to the 25th: 19 weekdays', (await H.storedDays(1)).filter(d => d.startsWith('2026-09')).length === 19);
  ok('W2 from 21 Sep: 5 days', (await H.storedDays(2)).length === 5);
  const g3 = fakeDhan();
  const log3 = { calls: 0, failed: [] as string[], written: 0, bytes: 0 };
  await H.updateChainHistory(null, now, log3, undefined, { post: g3.post, freeBytes: big, codes });
  ok('a second full run makes 0 calls (AC6)', log3.calls === 0);
  // before 16:00 the day is not complete: 26 Sep at 15:00 fetches only up to the 25th, so nothing
  const g4 = fakeDhan();
  const log4 = { calls: 0, failed: [] as string[], written: 0, bytes: 0 };
  await H.updateChainHistory(null, Date.parse('2026-09-28T15:00:00Z') - IST, log4, undefined, { post: g4.post, freeBytes: big, codes });
  ok('before 16:00 on Mon 28 Sep, only 26-27 Sep (no sessions) are asked for, never the 28th', g4.calls.length > 0 && g4.calls.every(b => b.fromDate === '2026-09-26' && b.toDate === '2026-09-28'), `${g4.calls[0]?.fromDate}..${g4.calls[0]?.toDate}`);
  const d = await H.readDay('2026-09-25', 1);
  ok('a stored day reads back with 44 legs', d !== null && Object.keys(d.legs).length === 44);
  const idx = await H.readIndex();
  ok('the index carries the summary and the expiry labels', idx.days['2026-09-25']?.W1?.fullLegs === 40 && idx.expiries['2026-09-25']?.W1 === '2026-09-29');
  ok('every request is ±10, all 9 fields, NIFTY OPTIDX', [...f.calls, ...g.calls].every(b => b.securityId === 13 && b.instrument === 'OPTIDX' && b.requiredData.length === 9 && /^ATM([+-]([1-9]|10))?$/.test(b.strike)));
}

/* ------------------------------------------------------------ AC3: the recording comparison */
{
  const { days } = H.stitch(all42(['2026-09-28']), 1);
  const day = days[0]!;
  const ms = (hm: string, s: number) => Date.parse(`2026-09-28T${hm}:00Z`) - IST + s * 1000;
  // recorded row for strike 23000: CE ltp inside [low, high] of minute 09:15, oi of minute 09:15; volume = the day's sum
  const leg = day.legs['23000CE']!, pl = day.legs['23000PE']!;
  const sum = (l: typeof leg) => l.v.reduce<number>((a, x) => a + (x ?? 0), 0);
  const row = (i: number, ltp: number, oi: number, v: number | null) => [23000, ltp, v, oi, 0, 12, pl.c[i]!, sum(pl), pl.oi[i]!, 0, 12];
  const good = [
    { t: ms('09:15', 20) - 4600, rows: [row(0, leg.c[0]!, leg.oi[0]!, null)] },
    { t: ms('09:16', 10) - 4600, rows: [row(1, leg.l[1]!, leg.oi[0]!, null)] },        // OI of M-1 still counts
    { t: ms('09:17', 30) - 4600, rows: [row(2, leg.h[2]!, leg.oi[2]!, sum(leg))] },
  ];
  const r = H.compareRecording(day, good);
  ok('consistent recording: every LTP inside the range', r.ltp.checked === 6 && r.ltp.inside === 6, JSON.stringify(r.ltp));
  ok('consistent recording: OI equal to M or M-1', r.oi.checked === 6 && r.oi.equal === 6);
  ok('consistent recording: volume 0%', r.vol.legs === 2 && r.vol.worstPct === 0);
  const bad = [
    { t: ms('09:15', 20) - 4600, rows: [row(0, leg.h[0]! + 0.05, leg.oi[0]! + 65, null)] },
    { t: ms('09:16', 59) - 4600, rows: [row(1, 9999, 1, null)] },                       // inside the boundary guard: not judged
    { t: ms('09:17', 30) - 4600, rows: [row(2, leg.c[2]!, leg.oi[0]!, sum(leg) * 1.001)] }, // OI of M-2: a miss
  ];
  const b = H.compareRecording(day, bad);
  ok('an LTP 0.05 above the high is caught', b.ltp.inside === b.ltp.checked - 1 && b.ltp.outside.length === 1, b.ltp.outside[0]);
  ok('OI off by one lot, and OI two minutes old, are both caught', b.oi.checked - b.oi.equal === 2, b.oi.worst.join(' | '));
  ok('a snapshot within 3 s of a boundary is not judged', b.ltp.checked === 4);
  ok('0.1% volume gap is measured', Math.abs(b.vol.worstPct - 0.0999) < 0.001, b.vol.worst);
  const st = H.compareRecording(day, [{ t: ms('09:15', 20) - 4600, rows: [[23000, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1]] }]);
  ok('(a) rebuilt strikes the recording never carried are counted', st.strikesOutside === 42, `${st.strikesOutside}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exitCode = 1;
