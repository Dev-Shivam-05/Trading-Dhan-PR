/**
 * `npm run opthist [-- --all | --top N] [--from YYYY-MM] [--to YYYY-MM] [--no-fetch]` — P39 (`docs/spec/opthist-v1.md`).
 * Fetches expired stock options (rows 1-3), then prices the option leg of P44's kept trades (rows 4-5) on every
 * stock-month on disk, under both fills. Writes `.cache/history/optleg-report.json`. Read-only against Dhan.
 */

import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { readCredentials } from '../src/server/dhan.ts';
import { HISTORY_DIR } from '../src/server/history.ts';
import { universe } from '../src/server/train-data.ts';
import { fetchMonths, readMonth, priceLeg, type LegTrade, type Fill, type OptMonth } from '../src/server/opthist.ts';

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const all = argv.includes('--all'), noFetch = argv.includes('--no-fetch');
const top = Number(opt('--top') ?? 20), from = opt('--from') ?? '2026-06', to = opt('--to') ?? '2026-09';

type T = LegTrade & { net: number };
const train = JSON.parse(await readFile(path.join(HISTORY_DIR, 'train-report.json'), 'utf8')) as { recommendation?: { key: string }; trades: Record<string, T[]> };
const recKey = train.recommendation?.key ?? Object.keys(train.trades)[1]!;
const uni = await universe();
const bySym = new Map(uni.map(u => [u.symbol, u]));

// Row 3: the symbols with the most recommended-setting trades (or all of them), and the months asked for.
const counts = new Map<string, number>();
for (const t of train.trades[recKey] ?? []) counts.set(t.symbol, (counts.get(t.symbol) ?? 0) + 1);
const symbols = all ? uni.map(u => u.symbol) : [...counts].sort((a, b) => b[1] - a[1]).slice(0, top).map(([s]) => s);
const monthsWanted: string[] = [];
for (let m = all ? '2025-10' : from; m <= to;) {
  monthsWanted.push(m);
  const [y, mo] = m.split('-').map(Number) as [number, number];
  m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
}
const want = symbols.flatMap(s => monthsWanted.map(month => ({ symbol: s, equityId: bySym.get(s)?.equityId ?? 0, month }))).filter(w => w.equityId > 0);
console.log(`${symbols.length} symbols × ${monthsWanted.length} months = ${want.length} stock-months (${monthsWanted[0]}..${monthsWanted.at(-1)})`);

if (!noFetch) {
  const creds = readCredentials();
  if (!creds) throw new Error('no Dhan credentials in .env');
  const log = { calls: 0, failed: [] as string[], written: 0 };
  const t0 = Date.now();
  await fetchMonths(creds, Date.now(), want, log, console.log);
  console.log(`fetch: ${log.calls} calls, ${log.written} months written, ${log.failed.length} failed, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const f of log.failed) console.log(`  failed: ${f}`);
}

// Rows 4-5: price every kept trade whose stock-month is on disk.
const cache = new Map<string, OptMonth | null>();
const monthOf = async (s: string, m: string) => { const k = `${s}|${m}`; if (!cache.has(k)) cache.set(k, await readMonth(s, m)); return cache.get(k)!; };
const report: Record<string, unknown> = { recKey, symbols, months: monthsWanted, settings: {} };
const inr = (x: number) => (x < 0 ? '−' : '+') + '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN');
for (const [key, trades] of Object.entries(train.trades)) {
  for (const fill of ['level', 'late1m'] as Fill[]) {
    let onDisk = 0, priced = 0, fut = 0, optNet = 0, futPriced = 0;
    const why = new Map<string, number>();
    for (const t of trades) {
      const m = await monthOf(t.symbol, t.date.slice(0, 7));
      if (!m) continue;
      onDisk++;
      const r = priceLeg(t, m.days[t.date], fill);
      if ('noPrice' in r) { why.set(r.noPrice.replace(/\d+(CE|PE)/, 'K$1'), (why.get(r.noPrice.replace(/\d+(CE|PE)/, 'K$1')) ?? 0) + 1); continue; }
      priced++; optNet += r.net; futPriced += t.net;
    }
    for (const t of trades) if (cache.get(`${t.symbol}|${t.date.slice(0, 7)}`)) fut += t.net;
    (report.settings as Record<string, unknown>)[`${key} ${fill}`] = { onDisk, priced, noPrice: onDisk - priced, why: Object.fromEntries(why), futureNetOnDisk: Math.round(fut), futureNetPriced: Math.round(futPriced), optionNet: Math.round(optNet), combined: Math.round(futPriced + optNet) };
    console.log(`${key === recKey ? 'PICK    ' : key.startsWith('chg2/gap') ? 'BASELINE' : 'TWIN    '} ${fill.padEnd(6)} ${String(onDisk).padStart(4)} trades on disk, ${String(priced).padStart(4)} priced · future ${inr(futPriced)} · option ${inr(optNet)} · together ${inr(futPriced + optNet)}${why.size ? ` · no-price: ${[...why].map(([k, v]) => `${v} ${k}`).join('; ')}` : ''}`);
  }
}
// P44's own "futures leg" is priced from CASH candles (train-all-v1 row 3); the option leg here is the paper trader's CE/PE.
await writeFile(path.join(HISTORY_DIR, 'optleg-report.json'), JSON.stringify(report, null, 1));
console.log('report written to .cache/history/optleg-report.json');
