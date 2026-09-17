/**
 * P15 - one NSE scan from the command line, written to a log folder a person or a later session can
 * read without running anything.
 *
 *   npm run scan:nse                                  # logs to logs/scans
 *   npm run scan:nse -- --runner github-ubuntu --out scan-logs
 *
 * Both schedulers run this: GitHub Actions (.github/workflows/nse-scan.yml) and the Windows task
 * on the user's machine (scripts/schedule-windows.ps1). Each runner writes its own file names, so
 * two runners pushing to the same `scan-logs` branch never edit the same file.
 *
 * Per run:
 *   <out>/<YYYY-MM-DD>/<HHmmss>-<runner>.json   the full result, trace included
 *   <out>/<YYYY-MM-DD>/<HHmmss>-<runner>.md     the same, readable on github.com from a phone
 *   <out>/LATEST-<runner>.md                    overwritten every run
 *   <out>/index-<runner>.csv                    one line per run, appended
 *
 * Exit code 1 only when the scan itself failed. A closed market or an exchange holiday is a valid
 * result and exits 0. process.exitCode, never process.exit() - see CLAUDE.md.
 */

import { mkdir, writeFile, appendFile, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { NseScanner, TOP_N_CHOICES, type NseScanResult, type TopN } from '../src/server/scanner-nse.ts';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const runner = arg('runner', process.env.SCAN_RUNNER ?? 'local').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'local';
const outDir = path.resolve(process.cwd(), arg('out', 'logs/scans'));

/** IST wall clock, from Intl rather than offset arithmetic. */
function ist(at: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(at);
  const g = (t: string) => p.find(x => x.type === t)?.value ?? '00';
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    time: `${g('hour')}:${g('minute')}:${g('second')}`,
    compact: `${g('hour')}${g('minute')}${g('second')}`,
    weekday: g('weekday'),
  };
}

const pct = (v: number | null) => v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Whether the numbers are from this morning. NSE's own dates decide it: a holiday shows the last
 * trading day, and a run before the open shows yesterday.
 */
function freshness(r: NseScanResult, today: string): { status: string; note: string } {
  if (r.error) return { status: 'error', note: r.error };
  if (r.market.tradeDate !== today) {
    return { status: 'not-today', note: `NSE's latest trading date is ${r.market.tradeDate} — a holiday, or the run was before NSE refreshed` };
  }
  return { status: 'ok', note: `NSE data for ${today}` };
}

function markdown(r: NseScanResult, others: NseScanResult[], meta: Record<string, string>): string {
  const lines: string[] = [];
  lines.push(`# NSE F&O scan — ${meta.date} ${meta.time} IST (${meta.weekday})`, '');
  lines.push(`| | |`, `|---|---|`);
  lines.push(`| Status | **${meta.status}** — ${meta.note} |`);
  lines.push(`| Runner | ${meta.runner} (${meta.host}, node ${process.version}) |`);
  lines.push(`| Market | ${r.market.status} |`);
  lines.push(`| NSE prices as of | ${r.market.priceAsOf || '—'} |`);
  lines.push(`| NSE OI Spurts as of | ${r.market.oiAsOf || '—'} |`);
  lines.push(`| Took | ${(r.elapsedMs / 1000).toFixed(1)} s |`, '');
  if (r.error) {
    lines.push(`## The scan could not run`, '', '```', r.error, '```', '');
    return lines.join('\n');
  }
  const f = r.funnel;
  lines.push(`## Top ${r.n}: ${f.list} → ${f.ranked} → ${f.chg} → **${f.oi}**`, '');
  lines.push(`F&O list → top ${r.n} gainers + top ${r.n} losers → |chg| ≥ 2% → OI chg ≥ +7%. ` +
    `Counts reconcile: **${r.reconciles ? 'yes' : 'NO'}**.`, '');
  const table = (title: string, rows: NseScanResult['long']) => {
    lines.push(`### ${title} (${rows.length})`, '');
    if (!rows.length) { lines.push('None.', ''); return; }
    lines.push('| Symbol | LTP | Chg % | OI chg % | Latest OI | Prev OI | Volume |', '|---|--:|--:|--:|--:|--:|--:|');
    for (const x of rows) {
      lines.push(`| **${x.symbol}** | ${x.ltp.toFixed(2)} | ${pct(x.chgPct)} | ${pct(x.oiPct)} | ${x.latestOi} | ${x.prevOi} | ${x.volume ?? '—'} |`);
    }
    lines.push('');
  };
  table('Long candidates', r.long);
  table('Short candidates', r.short);
  if (others.length) {
    lines.push('### Same fetch with a wider top N', '');
    for (const o of others) {
      lines.push(`- Top ${o.n}: ${o.funnel.list} → ${o.funnel.ranked} → ${o.funnel.chg} → **${o.funnel.oi}** — ` +
        `long ${o.long.map(x => x.symbol).join(', ') || 'none'}; short ${o.short.map(x => x.symbol).join(', ') || 'none'}`);
    }
    lines.push('');
  }
  if (r.skipped.length || r.excluded.length) {
    lines.push('### Skipped / not in your list', '');
    for (const s of r.skipped) lines.push(`- skipped **${s.symbol}** — ${s.reason}`);
    for (const s of r.excluded) lines.push(`- not in your list **${s.symbol}** — ${s.reason}`);
    lines.push('');
  }
  lines.push(`<details><summary>Why each of the ${r.trace.length} ranked stocks passed or failed</summary>`, '');
  lines.push('| Symbol | Side | Chg % | OI chg % | Outcome |', '|---|---|--:|--:|---|');
  for (const t of r.trace) lines.push(`| ${t.symbol} | ${t.side} | ${pct(t.chgPct)} | ${pct(t.oiPct)} | ${t.outcome} |`);
  lines.push('', '</details>', '');
  return lines.join('\n');
}

async function exists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  const startedAt = new Date();
  const when = ist(startedAt);
  const scanner = new NseScanner();

  const n: TopN = 20;
  const result = await scanner.run(n);
  // Same fetch, re-ranked: the recording says 20 first, "25 ya 30 bhi". Logging all three costs
  // no extra NSE calls and lets the choice be made from real mornings.
  const others = result.error ? [] : await Promise.all(
    TOP_N_CHOICES.filter(k => k !== n).map(k => scanner.run(k, true)),
  );

  const today = when.date;
  const fresh = freshness(result, today);
  const meta = {
    date: when.date, time: when.time, weekday: when.weekday, runner, host: os.hostname(),
    status: fresh.status, note: fresh.note,
  };

  const dayDir = path.join(outDir, when.date);
  await mkdir(dayDir, { recursive: true });
  const base = path.join(dayDir, `${when.compact}-${runner}`);
  await writeFile(`${base}.json`, JSON.stringify({ meta, result, wider: others.map(o => ({ n: o.n, funnel: o.funnel, long: o.long, short: o.short })) }, null, 2));
  const md = markdown(result, others, meta);
  await writeFile(`${base}.md`, md);
  await writeFile(path.join(outDir, `LATEST-${runner}.md`), md);

  const indexPath = path.join(outDir, `index-${runner}.csv`);
  if (!(await exists(indexPath))) {
    await writeFile(indexPath, 'date,time_ist,runner,status,market,prices_as_of,oi_as_of,list,ranked,chg,oi,long,short,elapsed_s,error\n');
  }
  await appendFile(indexPath, [
    when.date, when.time, runner, fresh.status, result.market.status, result.market.priceAsOf, result.market.oiAsOf,
    result.funnel.list, result.funnel.ranked, result.funnel.chg, result.funnel.oi,
    result.long.map(x => x.symbol).join(' '), result.short.map(x => x.symbol).join(' '),
    (result.elapsedMs / 1000).toFixed(1), result.error ?? '',
  ].map(csvCell).join(',') + '\n');

  console.log(`${when.date} ${when.time} IST  runner=${runner}  status=${fresh.status}`);
  console.log(result.error
    ? `ERROR ${result.error}`
    : `top ${n}: ${result.funnel.list} -> ${result.funnel.ranked} -> ${result.funnel.chg} -> ${result.funnel.oi}  ` +
      `long [${result.long.map(x => x.symbol).join(', ')}]  short [${result.short.map(x => x.symbol).join(', ')}]  ` +
      `prices ${result.market.priceAsOf}  OI ${result.market.oiAsOf}`);
  console.log(`log: ${path.relative(process.cwd(), base)}.md`);
  process.exitCode = result.error ? 1 : 0;
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
