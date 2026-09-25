/**
 * `npm run chainrec:test`: P47's chain recorder (`docs/spec/chain-recorder-v1.md`), clock injected,
 * pollers faked. Every rule is also shown rejecting something.
 */

import { ChainRecorder, toRecord, ROW_FIELDS, STRIKES_EACH_SIDE, type PollerLike } from '../src/server/chainrec.ts';
import type { Snapshot } from '../src/server/poller.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const IST = 5.5 * 3600_000;
const at = (date: string, hm: string, s = 0) => Date.parse(`${date}T${hm}:00Z`) - IST + s * 1000;

/** A NIFTY-like snapshot: strikes 23,000 … 27,000 step 50 (81 rows), ATM at the strike nearest `spot`. */
function snap(t: number, req: string, spot = 25012, replay = false): Snapshot {
  const rows = [];
  for (let k = 23000; k <= 27000; k += 50) {
    const side = (o: number) => ({ ltp: k / 100 + o, ltpChg: null, ltpChgPct: null, iv: 10 + o / 10, volume: k * 3 + o, volChgPct: null, oi: k * 2 + o, oiChg: o - 5, oiChgPct: null, delta: null, gamma: null, theta: null, vega: null });
    rows.push({ strike: k, ce: side(1), pe: side(2) });
  }
  const atm = Math.round(spot / 50) * 50;
  return { rows, atmStrike: atm, receivedAt: t, spot, spotSource: 'quote', atmIV: 11.2, requestId: req, replay } as unknown as Snapshot;
}

class FakePoller implements PollerLike {
  subs = 0;
  private fns = new Set<(ev: any) => void>();
  subscribe() { this.subs++; }
  unsubscribe() { this.subs--; }
  on(fn: (ev: any) => void) { this.fns.add(fn); return () => { this.fns.delete(fn); }; }
  emit(s: Snapshot) { for (const f of this.fns) f({ type: 'snapshot', data: s }); }
  listeners() { return this.fns.size; }
}

/* ------------------------------------------------------------ rows 3-4: the record */
{
  const s = snap(1, 'r1');
  const r = toRecord(s);
  const i = s.rows.findIndex(x => x.strike === s.atmStrike);
  ok(`row 3: ±${STRIKES_EACH_SIDE} strikes around the ATM (41 of ${s.rows.length} rows)`, s.rows.length === 81 && r.rows.length === 2 * STRIKES_EACH_SIDE + 1 && r.rows[0]![0] === s.rows[i - 20]!.strike && r.rows.at(-1)![0] === s.rows[i + 20]!.strike, `${r.rows.length} rows ${r.rows[0]![0]}..${r.rows.at(-1)![0]}`);
  ok('row 3: the ATM row sits in the middle', r.rows[STRIKES_EACH_SIDE]![0] === s.atmStrike);
  // Second implementation: look each value up by strike and field name, not by position.
  let same = true;
  for (const t of r.rows) {
    const row = s.rows.find(x => x.strike === t[0])!;
    const want = [row.strike, row.ce.ltp, row.ce.volume, row.ce.oi, row.ce.oiChg, row.ce.iv, row.pe.ltp, row.pe.volume, row.pe.oi, row.pe.oiChg, row.pe.iv];
    if (want.length !== ROW_FIELDS.length || want.some((v, k) => v !== t[k])) same = false;
  }
  ok('row 4: every tuple equals the snapshot, field by field', same);
  ok('row 4: time, spot, source, ATM, ATM IV and the request id are kept', r.t === 1 && r.spot === 25012 && r.src === 'quote' && r.atm === 25000 && r.atmIv === 11.2 && r.req === 'r1');
  const edge = toRecord(snap(1, 'e', 23010));
  ok('row 3: near the ladder\'s end the window is cut, not padded', edge.rows[0]![0] === 23000 && edge.rows.length === 21, `${edge.rows.length} rows`);
}

/* ------------------------------------------------------------ rows 1, 5, 6: the day */
{
  const D = '2026-09-28';   // a Monday
  const writes: { file: string; text: string }[] = [];
  const pollers = new Map<string, FakePoller>();
  let expiries: string[] = [];
  const rec = new ChainRecorder({
    instrumentId: 'NIFTY', expiries: () => expiries,
    pollerFor: e => { let p = pollers.get(e); if (!p) { p = new FakePoller(); pollers.set(e, p); } return p; },
    write: async (file, text) => { writes.push({ file, text }); },
  });

  await rec.step(at(D, '09:13', 59));
  ok('row 1: nothing starts at 09:13:59', pollers.size === 0 && rec.status().date === null);
  await rec.step(at(D, '09:14'));
  ok('row 1: with no expiry known yet (registry resolving) nothing starts, and it retries', pollers.size === 0 && rec.status().date === null);
  expiries = ['2026-09-22', '2026-10-13', '2026-09-29', '2026-10-06'];
  await rec.step(at(D, '09:14', 1));
  const keys = [...pollers.keys()];
  ok('row 1: at 09:14 it subscribes the current and the next expiry, skipping a passed one', keys.join() === '2026-09-29,2026-10-06' && [...pollers.values()].every(p => p.subs === 1), keys.join());

  const p = pollers.get('2026-09-29')!;
  p.emit(snap(at(D, '09:15', 3), 'a'));
  p.emit(snap(at(D, '09:15', 3), 'a'));           // P7's peak refresh re-emits the same reading
  p.emit(snap(at(D, '09:15', 6), 'b'));
  p.emit(snap(at(D, '09:15', 9), 'c', 25012, true));  // a replay snapshot must never land in a live file
  p.emit(snap(at(D, '09:15', 21), 'd'));
  await rec.step(at(D, '09:16'));
  const lines = writes.filter(w => w.file.includes('NIFTY-2026-09-29.jsonl')).flatMap(w => w.text.trim().split('\n'));
  ok('row 5: a re-emitted snapshot (same request id) is written once', lines.length === 3 && lines.map(l => JSON.parse(l).req).join() === 'a,b,d', lines.map(l => JSON.parse(l).req).join());
  ok('row 5: a replay snapshot is dropped', !lines.some(l => JSON.parse(l).req === 'c'));
  ok('row 6: the file is .cache/chains/<date>/NIFTY-<expiry>.jsonl', /chains[\\/]2026-09-28[\\/]NIFTY-2026-09-29\.jsonl$/.test(writes[0]!.file), writes[0]!.file);

  await rec.step(at(D, '15:30', 59));
  ok('row 1: still recording at 15:30:59', rec.status().date === D);
  await rec.step(at(D, '15:31'));
  ok('row 1: at 15:31 both pollers are released and their listeners removed', [...pollers.values()].every(x => x.subs === 0 && x.listeners() === 0));
  const { readFile } = await import('node:fs/promises');
  const { CHAIN_DIR } = await import('../src/server/chainrec.ts');
  const sum = JSON.parse(await readFile(`${CHAIN_DIR}/${D}/summary.json`, 'utf8'));
  const s29 = sum.streams.find((x: any) => x.expiry === '2026-09-29');
  ok('row 7: summary.json counts 3 snapshots and the 15 s largest gap', rec.status().date === null && s29.snapshots === 3 && s29.maxGapMs === 15000, JSON.stringify(s29));
  const st = rec.status();
  ok('row 7: status is empty once closed', st.streams.length === 0);

  pollers.clear(); writes.length = 0;
  await rec.step(at('2026-10-03', '10:00'));  // a Saturday
  ok('row 1: nothing on a Saturday', pollers.size === 0);
  await rec.step(at('2026-09-29', '09:14'));  // Tuesday: expiry day itself is still "current"
  ok('row 1: on expiry day that expiry is still the current one', [...pollers.keys()].join() === '2026-09-29,2026-10-06', [...pollers.keys()].join());
  await rec.step(at('2026-09-30', '09:14'));  // the date changes inside the window: close yesterday, open today
  ok('row 1: a new date inside the window closes the old day and opens the new one', [...pollers.keys()].includes('2026-10-13') && pollers.get('2026-09-29')!.subs === 0, [...pollers.entries()].map(([k, v]) => `${k}:${v.subs}`).join(' '));
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
