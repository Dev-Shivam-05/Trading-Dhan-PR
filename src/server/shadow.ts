/**
 * P45 — shadow-trading P44's recommended setting on sessions it has never seen (`docs/spec/shadow-v1.md`).
 *
 * Not a second live trader: P44's own engine (`runGrid`) is run each evening on the new day's cash candles, with the
 * settings row 1 names, under both fill models. Nothing here changes a live or paper rule, and nothing can place an order.
 */

import { writeFile, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { Credentials } from './dhan.ts';
import { isReplay } from './replay.ts';
import { HISTORY_DIR } from './history.ts';
import { readJson, universe, updateTrainData, type Closes, type Series } from './train-data.ts';
import type { Candle } from './backtest.ts';
import { BASELINE, tkey, makeStock, sessionsOf, dayPicks, runGrid, type StockData, type TrainParams, type FillModel } from './train.ts';

/** Row 2: the last session the recommendation was trained on. Only later sessions are shadowed. */
export const SHADOW_AFTER = '2026-09-25';
/** Row 1. */
export const SHADOW_SETTINGS: { label: string; p: TrainParams }[] = [
  { label: 'baseline (live rules minus OI)', p: BASELINE },
  { label: 'recommended (P44)', p: { minChg: 0, dir: 'either', rangeBars: 3, sma: 20, closes: 3, stop: true, target: false, frozen: false } },
  { label: 'recommended, 2R target twin', p: { minChg: 0, dir: 'either', rangeBars: 3, sma: 20, closes: 3, stop: true, target: true, frozen: false } },
];
export const SHADOW_FILE = path.join(HISTORY_DIR, 'shadow-report.json');

const toC = (s: Series): Candle[] => s.t.map((t, i) => ({ t, o: s.o[i]!, h: s.h[i]!, l: s.l[i]!, c: s.c[i]! }));

export async function loadStocks(): Promise<{ stocks: StockData[]; missing: string[] }> {
  const stocks: StockData[] = [], missing: string[] = [];
  for (const u of await universe()) {
    const m = await readJson<Series>(`eq1/${u.symbol}.json`);
    const d = await readJson<Closes>(`eqd/${u.symbol}.json`);
    if (!m || !d || !m.t.length) { missing.push(u.symbol); continue; }
    stocks.push(makeStock(u.symbol, u.lot, toC(m), new Map(Object.entries(d.close))));
  }
  return { stocks, missing };
}

export type ShadowRow = {
  key: string; label: string; fill: FillModel;
  days: { date: string; trades: number; net: number }[];
  trades: number; wins: number; net: number;
};
export type ShadowReport = { ranAt: string | null; after: string; sessions: string[]; rows: ShadowRow[]; missing: string[] };

/** Rows 1-2, pure over loaded stocks: every setting x both fills, sessions strictly after `after`. */
export function computeShadow(stocks: StockData[], after = SHADOW_AFTER, settings = SHADOW_SETTINGS): { sessions: string[]; rows: ShadowRow[] } {
  const sessions = sessionsOf(stocks).filter(d => d > after);
  const rows: ShadowRow[] = [];
  if (!sessions.length) {
    for (const s of settings) for (const fill of ['level', 'late1m'] as FillModel[]) rows.push({ key: tkey(s.p), label: s.label, fill, days: [], trades: 0, wins: 0, net: 0 });
    return { sessions, rows };
  }
  const picks = dayPicks(stocks, sessions);
  for (const fill of ['level', 'late1m'] as FillModel[]) {
    const { results } = runGrid(stocks, sessions, picks, settings.map(s => s.p), new Set(), fill);
    for (const [i, r] of results.entries()) {
      rows.push({
        key: r.key, label: settings[i]!.label, fill,
        days: sessions.map((date, k) => ({ date, trades: r.tradesPerDay[k]!, net: r.perDay[k]! })),
        trades: r.trades, wins: r.wins, net: r.net,
      });
    }
  }
  return { sessions, rows };
}

export async function readShadow(): Promise<ShadowReport> {
  try { return JSON.parse(await readFile(SHADOW_FILE, 'utf8')) as ShadowReport; }
  catch { return { ranAt: null, after: SHADOW_AFTER, sessions: [], rows: [], missing: [] }; }
}

/** Row 4: fetch what is missing, compute, write. Live only. */
export async function runShadow(creds: Credentials, nowMs: number, say: (m: string) => void = () => {}): Promise<ShadowReport> {
  if (isReplay()) throw new Error('replay mode: the shadow reads real history and would compare it with nothing real');
  const log = { calls: 0, failed: [] as string[] };
  const r = await updateTrainData(creds, nowMs, log, say);
  say(`cash history to ${r.lastDay}: ${log.calls} calls, ${log.failed.length} failed`);
  const { stocks, missing } = await loadStocks();
  const { sessions, rows } = computeShadow(stocks);
  const report: ShadowReport = { ranAt: new Date(nowMs).toISOString(), after: SHADOW_AFTER, sessions, rows, missing };
  await writeFile(SHADOW_FILE + '.tmp', JSON.stringify(report));
  await rename(SHADOW_FILE + '.tmp', SHADOW_FILE);
  return report;
}
