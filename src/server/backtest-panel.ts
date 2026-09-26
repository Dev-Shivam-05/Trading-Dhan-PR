/**
 * P38 — the backtest panel's payload (`docs/spec/backtest-panel-v1.md` rows 2-5): the nightly P37 report, P44's
 * training report and P45's shadow, trimmed to what the Paper tab prints. Pure: it reshapes, it recomputes nothing
 * except the per-day grouping of P37's own trades (row 3).
 */

type Any = Record<string, any>;

/** Row 3. */
export function trimReport(r: Any | null) {
  if (!r) return null;
  const trades: Any[] = r.current?.trades ?? [];
  const byDay = new Map<string, { trades: number; gross: number }>();
  for (const t of trades) {
    const d = byDay.get(t.date) ?? { trades: 0, gross: 0 };
    d.trades++; d.gross = Math.round((d.gross + (t.pnl ?? 0)) * 100) / 100;
    byDay.set(t.date, d);
  }
  const perDay = (r.sessions ?? []).map((s: Any) => ({ date: s.date, kind: s.kind, signals: s.signals, trades: byDay.get(s.date)?.trades ?? 0, gross: byDay.get(s.date)?.gross ?? 0 }));
  const top = [...(r.grid ?? [])].sort((a: Any, b: Any) => b.gross - a.gross).slice(0, 5);
  const strip = (x: Any | undefined) => x && { sessions: x.sessions, trades: x.trades, wins: x.wins, winPct: x.winPct, gross: x.gross, maxDrawdown: x.maxDrawdown, worstDay: x.worstDay };
  return {
    ranAt: r.ranAt, lastDay: r.lastDay,
    window: { sessions: (r.sessions ?? []).length, real: (r.sessions ?? []).filter((s: Any) => s.kind === 'real').length, proxy: (r.sessions ?? []).filter((s: Any) => s.kind === 'proxy').length },
    params: r.current?.params ?? null,
    all: strip(r.current?.all), real: strip(r.current?.real), proxy: strip(r.current?.proxy),
    walkForward: r.walkForward ? { heldOut: r.walkForward.heldOut, current: r.walkForward.current, bestNow: r.walkForward.bestNow } : null,
    gridTop: top.map((g: Any) => ({ key: g.key, trades: g.trades, gross: g.gross, real: g.real, proxy: g.proxy })),
    perDay,
    calibration: r.calibration ?? [],
  };
}

/** Row 4. */
export function trimTrain(t: Any | null) {
  if (!t) return null;
  const pick = (x: Any | undefined) => x && { key: x.key, trades: x.trades, winPct: x.winPct, net: x.net, netPerTrade: x.netPerTrade, firstHalf: x.firstHalf, secondHalf: x.secondHalf, maxDrawdown: x.maxDrawdown };
  const recKey = t.recommendation?.key ?? null;
  const rec = [t.bestInSample, t.mostChosen, t.lastChosen].find((x: Any | undefined) => x?.key === recKey);
  return {
    ranAt: t.ranAt, sessions: Array.isArray(t.sessions) ? t.sessions.length : t.sessions, stocks: t.stocks,
    recommendation: t.recommendation ?? null,
    baseline: pick(t.baseline), recommended: pick(rec),
    walkForward: t.walkForward ? { heldOut: t.walkForward.heldOut, baseline: t.walkForward.baseline } : null,
    late1m: t.late1m ? { walkForward: t.late1m.walkForward ? { heldOut: t.late1m.walkForward.heldOut, baseline: t.late1m.walkForward.baseline } : null, baseline: pick(t.late1m.baseline) } : null,
  };
}
