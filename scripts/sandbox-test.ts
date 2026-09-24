/**
 * `npm run sandbox:test` — P41 rows 4-6 and P42 rows 8-12 of `docs/spec/phone-sandbox-v1.md`.
 *
 * The sandbox day is Thursday 24 Sep, built from the real Dhan 1-minute candles in
 * `test/fixtures/paper-2026-09-24/` turned into synthetic ticks (row 4). Row 6's proof that nothing
 * sees ahead: the same day cut at 11:00 must make exactly the same decisions before 11:00, and two
 * full runs must be identical. Each P42 rule is shown taking one trade and rejecting another.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(tmpdir(), 'sandbox-test-'));
process.env.CACHE_DIR = tmp;
const { SandboxRun, synthTicks } = await import('../src/server/sandbox.ts');
const { at, ist } = await import('../src/server/backtest.ts');
const { NO_RULES, onTick, applyBars, emptyLedger, LOSS_CAP } = await import('../src/server/paper.ts');
type SandboxDay = import('../src/server/sandbox.ts').SandboxDay;
type Ledger = import('../src/server/paper.ts').Ledger;
type Position = import('../src/server/paper.ts').Position;
type Bar = import('../src/server/paper.ts').Bar;

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const DAY = '2026-09-24';
const FIX = 'test/fixtures/paper-2026-09-24';
const load = async (n: string) => JSON.parse(await readFile(path.join(FIX, `${n}.json`), 'utf8'));
const toC = (raw: any) => raw.timestamp.map((t: number, i: number) => ({ t: t * 1000, o: raw.open[i], h: raw.high[i], l: raw.low[i], c: raw.close[i] }));

/* ------------------------------------------------------------ the 24-Sep sandbox day */

async function day(): Promise<SandboxDay> {
  const ledger = await load('ledger-as-closed');
  const legs = ledger.positions as Position[];
  const f = (s: string) => legs.find(p => p.symbol === s && (p.leg ?? 'future') === 'future')!;
  const o = (s: string) => legs.find(p => p.symbol === s && p.leg === 'option')!;
  const dayStart = at(DAY, 0);
  const ticks = [], context = new Map<number, Bar[]>(), contracts = new Map(), options = new Map();
  for (const s of ['MFSL', 'POLICYBZR']) {
    const fut = f(s), opt = o(s);
    contracts.set(s, { futureId: fut.securityId, lot: fut.lot, expiry: fut.expiry });
    context.set(fut.securityId, toC(await load(`${s}-5m`)).filter((b: Bar) => b.t < dayStart));
    options.set(s, [{ strike: opt.strike!, optionType: 'PE', securityId: opt.securityId, lot: opt.lot, expiry: opt.expiry }]);
    for (const k of toC(await load(`${s}-1m`))) ticks.push(...synthTicks(fut.securityId, k));
    for (const k of toC(await load(`${s}-PE-1m`))) ticks.push(...synthTicks(opt.securityId, k));
  }
  ticks.sort((a, b) => a.t - b.t || a.securityId - b.securityId);
  const row = (symbol: string, chgPct: number, oiPct: number, ltp: number) => ({ symbol, name: symbol, ltp, prevClose: 0, chgPct, volume: null, latestOi: 0, prevOi: 0, oiPct });
  const scan = {
    source: 'nse', mode: 'live', at: '', n: 20, reused: false,
    market: { status: 'Open', priceAsOf: '24-Sep-2026 09:20:10', oiAsOf: '24-Sep-2026 09:19:44', tradeDate: DAY, prevTradingDate: '2026-09-23' },
    evidence: [], funnel: { list: 210, scored: 210, ranked: 40, chg: 20, oi: 2 },
    long: [], short: [row('POLICYBZR', -10, 8.71, 1697.7), row('MFSL', -9.99, 7.82, 1406.7)],
    skipped: [], excluded: [], rejected: { rank: 0, chg: 0, oi: 0 }, trace: [], reconciles: true, elapsedMs: 0, error: null,
  } as any;
  return { date: DAY, source: 'synthetic', scan, scanKind: 'real', scanAt: at(DAY, 9 * 60 + 20) + 10_000, ticks, context, closedOi: new Map(), contracts, options };
}

type Ev = { t: number; title: string };
async function run(d: SandboxDay, name: string, opts: { cutAt?: number; rules?: typeof NO_RULES } = {}) {
  const events: Ev[] = [];
  const r = new SandboxRun(d, { id: name, file: path.join(tmp, name, 'ledger.json'), speed: 0, rules: opts.rules ?? NO_RULES, cutAt: opts.cutAt, onEvent: e => events.push({ t: r.state.simNow, title: e.title }) });
  await r.run();
  const l = JSON.parse(await readFile(path.join(tmp, name, 'ledger.json'), 'utf8')) as Ledger;
  return { r, l, events };
}

const d = await day();
const full = await run(d, 'full');
const P = (l: Ledger, id: string) => l.positions.find(p => p.id === id)!;
const pb = P(full.l, '2026-09-24-POLICYBZR'), mf = P(full.l, '2026-09-24-MFSL');
ok('row 5: the real scan is withheld until 09:20:10, so it lands on the 09:21:00 retry', full.l.days[DAY]?.scannedAt === at(DAY, 9 * 60 + 21), full.l.days[DAY]?.scannedAt ? ist(full.l.days[DAY]!.scannedAt!).hm : 'none');
ok('row 4: POLICYBZR enters at 1606 on the tick that jumped through the band (live filled 1606 too)', pb.entryPx === 1606 && ist(pb.entryAt!).hm === '09:30', `${pb.entryPx} at ${pb.entryAt ? ist(pb.entryAt).hm : '-'}`);
ok('row 4: MFSL enters on the 09:49 candle (live 1401.3; the synthetic first tick is the open)', mf.entryPx === 1402.4 && ist(mf.entryAt!).hm === '09:49', `${mf.entryPx}`);
ok('row 5: MFSL exits on 2 closes above SMA9, at the first tick after 10:55:05', mf.reason === 'sma' && mf.exitAt! > at(DAY, 10 * 60 + 55) && mf.exitAt! < at(DAY, 10 * 60 + 56), `${mf.reason} ${mf.exitAt ? ist(mf.exitAt).hm : '-'} @ ${mf.exitPx}`);
ok('row 5: POLICYBZR is squared off at 15:15', pb.reason === 'eod' && ist(pb.exitAt!).hm === '15:15', `${pb.reason} @ ${pb.exitPx}`);
ok('row 4: both option legs fill and close with their futures', full.l.positions.filter(p => p.leg === 'option' && p.status === 'closed').length === 2);
console.log('      sandbox 24 Sep:', full.l.positions.map(p => `${p.symbol}${p.leg === 'option' ? ' ' + p.strike + p.optionType : ''} ${p.entryPx}->${p.exitPx} ${p.pnl}`).join(' · '));

// Row 6: the same day cut at 11:00 decides exactly the same things before 11:00.
const T = at(DAY, 11 * 60);
const cut = await run(d, 'cut', { cutAt: T });
const before = (e: Ev[]) => e.filter(x => x.t < T).map(x => `${x.t} ${x.title}`);
ok('row 6: cut at 11:00 — every event before 11:00 is identical to the full run', JSON.stringify(before(cut.events)) === JSON.stringify(before(full.events)) && before(full.events).length >= 5,
  `${before(cut.events).length} events before 11:00`);
ok('row 6: cut at 11:00 — POLICYBZR is still open (nothing after 11:00 leaked in)', P(cut.l, '2026-09-24-POLICYBZR').status === 'open' && P(cut.l, '2026-09-24-MFSL').status === 'closed');
const again = await run(d, 'again');
const strip = (l: Ledger) => JSON.stringify(l.positions);
ok('row 6: a second full run is identical', strip(again.l) === strip(full.l));

/* ------------------------------------------------------------ P42 inside the sandbox */

const frozen = await run(d, 'frozen', { rules: { ...NO_RULES, frozenRange: true } });
ok('P42 row 10: frozen range — POLICYBZR (0.00% wide) is skipped, MFSL (1.64%) still trades',
  P(frozen.l, '2026-09-24-POLICYBZR').status === 'unfilled' && /frozen range 0\.00%/.test(P(frozen.l, '2026-09-24-POLICYBZR').note ?? '') && P(frozen.l, '2026-09-24-MFSL').status === 'closed',
  P(frozen.l, '2026-09-24-POLICYBZR').note ?? '');
const st = await run(d, 'stoptarget', { rules: { ...NO_RULES, stop: true, target: true } });
const mfs = P(st.l, '2026-09-24-MFSL');
ok('P42 rows 8-9: MFSL gets stop 1427.40 (range high) and target 1352.40 (entry - 2 x 25)', mfs.stopPx === 1427.4 && mfs.targetPx === 1352.4, `stop ${mfs.stopPx} target ${mfs.targetPx} -> ${mfs.reason} @ ${mfs.exitPx}`);
console.log('      with stop + target:', st.l.positions.map(p => `${p.symbol}${p.leg === 'option' ? ' ' + p.optionType : ''} ${p.reason} ${p.exitPx} ${p.pnl}`).join(' · '));

/* ------------------------------------------------------------ P42 rules, each taking and rejecting */

function ledgerWith(rules: Partial<typeof NO_RULES>, side: 'BUY' | 'SELL', range: { high: number; low: number }): Ledger {
  const l = emptyLedger('live');
  l.rules = { ...NO_RULES, ...rules };
  l.positions.push({
    id: `${DAY}-X`, date: DAY, symbol: 'X', name: 'X', side, leg: 'future', parentId: null, optionType: null, strike: null,
    seg: 'NSE_FNO', securityId: 1, expiry: '2026-09-29', lot: 100, qty: 100, signal: { chgPct: 3, oiPct: 8, cashLtp: 100 },
    status: 'pending', createdAt: 0, range, rangeNote: null, sma9: null, against: 0, lastBarT: null, exitDue: false,
    entryPx: null, entryAt: null, stopPx: null, targetPx: null, ltp: null, ltpAt: null, exitPx: null, exitAt: null, reason: null, pnl: null, stale: false, note: null,
  } as Position);
  return l;
}
const t0 = at(DAY, 10 * 60);
{
  const a = ledgerWith({ stop: true }, 'BUY', { high: 101, low: 99 });
  onTick(a, 1, 101.5, t0); onTick(a, 1, 99.5, t0 + 1000);
  const b = ledgerWith({ stop: true }, 'BUY', { high: 101, low: 99 });
  onTick(b, 1, 101.5, t0); onTick(b, 1, 99, t0 + 1000);
  ok('P42 row 8: a long above its stop stays open; at the range low it closes as stop', a.positions[0]!.status === 'open' && b.positions[0]!.reason === 'stop' && b.positions[0]!.exitPx === 99);
}
{
  const a = ledgerWith({ target: true }, 'SELL', { high: 101, low: 99 });
  onTick(a, 1, 98.5, t0); onTick(a, 1, 94.1, t0 + 1000);    // risk 2.5 -> target 93.5
  const b = ledgerWith({ target: true }, 'SELL', { high: 101, low: 99 });
  onTick(b, 1, 98.5, t0); onTick(b, 1, 93.5, t0 + 1000);
  ok('P42 row 9: a short 0.6 short of its 93.50 target stays open; at 93.50 it closes as target', a.positions[0]!.status === 'open' && b.positions[0]!.targetPx === 93.5 && b.positions[0]!.reason === 'target');
}
{
  const a = ledgerWith({ frozenRange: true }, 'BUY', { high: 0, low: 0 });
  a.positions[0]!.range = null;
  const bars = (w: number): Bar[] => [{ t: at(DAY, 9 * 60 + 15), o: 100, h: 100 + w, l: 100, c: 100 }, { t: at(DAY, 9 * 60 + 20), o: 100, h: 100, l: 100, c: 100 }];
  applyBars(a, a.positions[0]!.id, bars(0.29), at(DAY, 9 * 60 + 25, ) + 5000);
  const b = ledgerWith({ frozenRange: true }, 'BUY', { high: 0, low: 0 });
  b.positions[0]!.range = null;
  applyBars(b, b.positions[0]!.id, bars(0.31), at(DAY, 9 * 60 + 25) + 5000);
  ok('P42 row 10: 0.29% wide is skipped, 0.31% is kept', a.positions[0]!.status === 'unfilled' && b.positions[0]!.status === 'pending' && !!b.positions[0]!.range, `${a.positions[0]!.note} | ${b.positions[0]!.status}`);
}
{
  const mk = (oi15: number) => {
    const l = ledgerWith({ oiFlag: true }, 'BUY', { high: 0, low: 0 });
    l.positions[0]!.range = null;
    applyBars(l, l.positions[0]!.id, [
      { t: at('2026-09-23', 15 * 60 + 25), o: 100, h: 100, l: 100, c: 100, oi: 1000 },
      { t: at(DAY, 9 * 60 + 15), o: 100, h: 102, l: 99, c: 100, oi: oi15 },
      { t: at(DAY, 9 * 60 + 20), o: 100, h: 101, l: 99, c: 100 },
    ], at(DAY, 9 * 60 + 25) + 5000);
    return l.positions[0]!;
  };
  const agree = mk(1050), disagree = mk(900);
  ok('P42 row 11: NSE +8% vs futures +5% raises no flag; vs futures -10% flags it, and the trade stays pending',
    !agree.flags?.length && disagree.flags?.[0] === 'OI disagrees: NSE 8% vs futures -10%' && disagree.status === 'pending', disagree.flags?.join());
}
{
  const l = ledgerWith({ lossCap: true }, 'BUY', { high: 101, low: 99 });
  // A closed loser from earlier the same day, at exactly the cap.
  l.positions.push({ ...l.positions[0]!, id: `${DAY}-Y`, symbol: 'Y', securityId: 2, status: 'closed', entryPx: 100, exitPx: 100 + LOSS_CAP / 100, pnl: LOSS_CAP } as Position);
  onTick(l, 1, 101.5, t0);
  const k = ledgerWith({ lossCap: true }, 'BUY', { high: 101, low: 99 });
  k.positions.push({ ...k.positions[0]!, id: `${DAY}-Y`, symbol: 'Y', securityId: 2, status: 'closed', entryPx: 100, exitPx: 100 + LOSS_CAP / 100 + 0.01, pnl: LOSS_CAP + 1 } as Position);
  onTick(k, 1, 101.5, t0);
  ok('P42 row 12: at -50,000 the next break is refused; at -49,999 it is taken',
    l.positions[0]!.status === 'unfilled' && /daily loss cap/.test(l.positions[0]!.note ?? '') && k.positions[0]!.status === 'open', l.positions[0]!.note ?? '');
}
{
  const l = ledgerWith({}, 'BUY', { high: 101, low: 99 });
  onTick(l, 1, 101.5, t0); onTick(l, 1, 50, t0 + 1000);
  ok('P42 row 13: with every rule off (live today) a crash does not close it — P33 behaviour', l.positions[0]!.status === 'open' && l.positions[0]!.stopPx === null);
}

await rm(tmp, { recursive: true, force: true });
console.log(`\n${pass} pass · ${fail} fail`);
process.exitCode = fail ? 1 : 0;
