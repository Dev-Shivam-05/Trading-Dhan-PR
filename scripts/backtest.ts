/**
 * `npm run backtest` — P37's manual run (`docs/spec/backtest-v1.md` row 14). It does exactly what
 * the live server's 16:00 job does, then prints the report. Real market data only: it refuses in
 * replay mode (row 3). Read-only against Dhan — chart and daily-candle endpoints, no orders.
 */

import { readCredentials } from '../src/server/dhan.ts';
import { resolveRegistry } from '../src/server/instruments.ts';
import { runBacktest, type Report } from '../src/server/history.ts';
import { ist } from '../src/server/backtest.ts';

const inr = (x: number | null | undefined) => (x === null || x === undefined ? '—' : (x < 0 ? '−' : '+') + Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pad = (s: string, n: number) => s.padEnd(n);

function print(r: Report) {
  console.log(`\nBacktest ${r.ranAt} · sessions to ${r.lastDay} · ${r.calls} Dhan calls this run · ${r.failed.length} failed`);
  for (const f of r.failed.slice(0, 10)) console.log(`  failed: ${f}`);

  console.log('\n— sessions (row 4: real = a real 09:20 NSE scan, proxy = rebuilt; always reported apart) —');
  const byDate = new Map<string, number>();
  for (const t of r.current.trades) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.pnl);
  for (const s of r.sessions) console.log(`  ${s.date}  ${pad(s.kind, 5)}  ${String(s.signals).padStart(2)} signals  day P&L ${inr(byDate.get(s.date) ?? 0)}${s.priceAsOf ? `  (NSE ${s.priceAsOf})` : ''}`);

  console.log('\n— current rules (top 20 · SMA9 · 2 closes · 09:15+09:20 range) —');
  for (const [name, s] of [['REAL', r.current.real], ['PROXY', r.current.proxy], ['ALL', r.current.all]] as const) {
    console.log(`  ${pad(name, 5)} ${s.sessions} sessions · ${s.trades} trades · win ${s.winPct ?? '—'}% · gross ${inr(s.gross)} · avg win ${inr(s.avgWin)} · avg loss ${inr(s.avgLoss)} · worst day ${s.worstDay ? `${s.worstDay.date} ${inr(s.worstDay.pnl)}` : '—'} · max drop ${inr(-s.maxDrawdown)}`);
    console.log(`        BUY ${s.bySide.BUY.trades} ${inr(s.bySide.BUY.gross)} · SELL ${s.bySide.SELL.trades} ${inr(s.bySide.SELL.gross)} · SMA exits ${s.byReason.sma.trades} ${inr(s.byReason.sma.gross)} · 15:15 ${s.byReason.eod.trades} ${inr(s.byReason.eod.gross)} · future legs ${inr(s.legs.future)} · option legs ${inr(s.legs.option)} (${s.legs.optionsMissing} without an option)`);
  }

  console.log('\n— trades, current rules —');
  for (const t of r.current.trades) {
    console.log(`  ${t.date} ${pad(t.kind, 5)} ${pad(t.symbol, 11)} ${pad(t.side, 4)} range ${t.range.high}/${t.range.low}  in ${ist(t.entryT).hm} ${t.entryPx}  out ${ist(t.exitT).hm} ${t.exitPx} (${t.reason})  fut ${inr(t.futPnl)}  ${t.opt ? `${t.opt.strike}${t.opt.optionType} ${t.opt.entryPx}→${t.opt.exitPx} ${inr(t.opt.pnl)}` : `option: ${t.optNote}`}  = ${inr(t.pnl)}`);
  }

  console.log('\n— row 5: proxy vs the real 09:20 scan —');
  for (const c of r.proxyCheck) {
    console.log(`  ${c.date}  real L[${c.real.long.join(' ')}] S[${c.real.short.join(' ')}]   proxy L[${c.proxy.long.join(' ')}] S[${c.proxy.short.join(' ')}]`);
    const passed = c.rows.filter(x => Math.abs(x.realChg) >= 2);
    for (const x of passed) console.log(`      ${pad(x.symbol, 11)} chg real ${x.realChg} proxy ${x.proxyChg ?? '—'} · OI real ${x.realOi ?? '—'} proxy ${x.proxyOi ?? '—'}`);
  }

  console.log('\n— row 11: walk-forward (choose on days 1..k, score on day k+1) —');
  const w = r.walkForward;
  for (const s of w.steps) console.log(`  ${s.testDate}  trained on ${String(s.trainedOn).padStart(2)}  chose ${pad(s.chosen, 22)} ${inr(s.chosenPnl).padStart(14)}   current ${inr(s.currentPnl).padStart(14)}`);
  console.log(`  held-out total: chosen-each-day ${inr(w.heldOut)} vs current ${inr(w.current)}  (${w.steps.length} held-out days)`);
  console.log(`  whole window: best ${w.bestNow?.key} ${inr(w.bestNow?.gross)} vs current ${inr(w.currentGross)} — NOT applied (row 13)`);
  console.log('  top 5 of 108:');
  for (const g of r.grid.slice(0, 5)) console.log(`    ${pad(g.key, 22)} ${inr(g.gross).padStart(14)}  (${g.trades} trades; real ${inr(g.real)}, proxy ${inr(g.proxy)})`);

  console.log('\n— row 12: live entries vs the model fill —');
  if (!r.calibration.length) console.log('  no live paper entries on a cached day yet');
  for (const c of r.calibration) console.log(`  ${c.date} ${pad(c.symbol, 11)} ${c.side} live ${c.live} model ${c.model ?? '—'} diff ${c.diff ?? '—'}`);
  if (r.missing.length) console.log(`\n${r.missing.length} series still missing after the fetch passes: ${r.missing.slice(0, 8).join(', ')}`);
}

await resolveRegistry({});
const creds = readCredentials();
if (!creds) { console.log('no Dhan credentials in .env'); process.exitCode = 2; }
else {
  try { print(await runBacktest(creds, Date.now())); }
  catch (e) { console.log(`FAIL ${(e as Error).message}`); process.exitCode = 1; }
}
