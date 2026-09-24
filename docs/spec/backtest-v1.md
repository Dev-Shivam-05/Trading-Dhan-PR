# P37 — Backtest and nightly learning for the paper auto-trader

**Locked 2026-09-24 with `go`.** Rows 4 and 5 were then amended and row 18 added, all approved with a second `go`,
after a measurement showed that NSE's OI figure cannot be rebuilt from Dhan's history (below).
The strategy under test is P33 (`orb-strategy-v1.md`), with the exit pricing of P36 (`sleep-proof-v1.md`).

## What was measured before locking
- Dhan's `/v2/charts/intraday` returns **58 sessions (1 Jul – 24 Sep)** of 1-minute and 5-minute candles with OI for the
  September MFSL future in one call. The September 1400 PE starts on 3 Aug.
- **NSE's OI Spurts figure is not futures OI.** 24 Sep, previous session → 09:19:

  | | NSE | Dhan near-month future |
  |---|---|---|
  | MFSL | 23,496 → 25,334 (+7.82%) | 60,06,400 → 61,78,000 (+2.86%) |
  | POLICYBZR | 48,099 → 52,288 (+8.71%) | 79,40,800 → 68,70,500 (−13.5%) |

  Summing all three futures expiries gives MFSL +6.4%, which does not match either. NSE's number evidently includes
  options OI, and rebuilding that for past days would need every strike's 1-minute OI.
- Only **two real scans were taken at 09:20**: 21 Sep (0 signals) and 24 Sep (POLICYBZR, MFSL), both in
  `logs/scans/`. The GitHub runs started at 14:16, so their prices are not 09:20 prices.

## Rows

| # | Row | Value |
|---|---|---|
| 1 | Window | Sessions where the contract in today's master was the near month: from the day after the previous monthly expiry (the last Tuesday of the month before the near expiry, so **26 Aug** for the 29-Sep contract) to the latest completed session. A new session is added nightly. Sessions already cached are kept after their contract expires. |
| 2 | Data | For each of the 210 stocks in `data/fno-list.txt`: cash 1-minute candles (reduced to the 09:20 close per day), the daily previous close from `/v2/charts/historical`, and future 5-minute candles with OI (from 7 days before the window, for SMA context). 1-minute candles of a future or option are fetched **only when a replayed trade needs them**. One gate key, `history`, at 1100 ms. |
| 3 | Storage | `.cache/history/`. Fetched once and never re-fetched. Incremental from the last cached day. **Refused in replay mode.** |
| 4 | Which stocks trade each day | If a **real 09:20 NSE scan** exists for the day (`logs/scans/<date>/*-local-pc.json` with prices stamped 09:15–09:30, or `.cache/history/scans/<date>.json` from row 18), its exact Long/Short lists are used, with `wider` for top 25/30. Otherwise a **proxy** is built: the cash 09:20 close against the official previous close, run through the same funnel (`nseFunnel`: top N gainers + top N losers, \|chg\| ≥ 2%, OI ≥ +7%), where OI = the near-month future's OI at 09:20 (its 09:15 five-minute candle) against its last OI of the previous session. Proxy days are labelled `proxy`, and their results are **always reported separately** from real-scan days. |
| 5 | Checking the proxy | On every day with a real 09:20 scan, the proxy's picks and its chg% / OI% per ranked stock are printed next to NSE's. |
| 6 | Replay | Each session on its own, in date order, on a minute clock from 09:15 to 15:30, with the live rules: the range, a strict break, the nearest CE/PE (a tie goes to the lower strike), N closes against SMA, square-off at 15:15, entries until 15:00, max 10 signals ranked by \|chg%\|, one trade per stock per day. |
| 7 | Entry fill | The first 1-minute candle from the range-ready minute until 15:00 that trades beyond the level. If it **opens** beyond the level, the fill is that open; otherwise the level ± **0.05**. The option fills at the (high + low) / 2 of the first 1-minute candle at or after that minute. **GUESS**, calibrated by row 12. |
| 8 | Exit fill | The open of the first 1-minute candle at or after the instant the exit came due (SMA exit or 15:15). This is P36's rule. |
| 9 | Measures | Trades (a trade is one signal: future plus option), win %, gross P&L, average win and average loss, worst day, largest peak-to-trough drop of cumulative daily P&L. Also split by side, exit reason, and future leg vs option leg. The sample size is printed with every figure. |
| 10 | Grid | top N {20, 25, 30} × SMA period {5, 9, 13, 20} × closes against {1, 2, 3} × range candles {1: 09:15; 2: 09:15+09:20; 3: 09:15–09:25}. That is 108 combinations. The 2% / 7% filters are fixed. |
| 11 | Walk-forward | For k = 1 … n−1: choose the combination with the best gross P&L on sessions 1…k, then score it on session k+1. The report shows the sum of those held-out scores next to the current settings' score on the same days, and the combination that the full window would choose now. **No machine-learning model.** |
| 12 | Calibration from live | Every live paper future entry in `.cache/paper-ledger.json` on a cached day is compared with row 7's model fill for the same symbol, day and level. The per-trade difference and the mean are reported. |
| 13 | Applying it to live | **Never automatic.** The live rules change only on the user's one-word approval. |
| 14 | Schedule | Inside the live server: once per weekday at or after **16:00 IST**, if the last run is older than today. A missed day is caught up by the incremental fetch. Manual run: `npm run backtest`. |
| 15 | Output | Console and `.cache/history/report.json`. A Backtest panel on the Paper tab is **P38**. |
| 16 | Older than the window | Boarded as P39 (Dhan's expired-contract data). |
| 17 | Spec | This file. |
| 18 | Real scans keep growing | Each live 09:20 paper scan is saved to `.cache/history/scans/<date>.json`, with the top-25 and top-30 re-ranks from the same fetch. |

## Out of scope
Brokerage, STT and charges (P&L is gross). FII/DII, news, full option-chain history. Any automatic change to the live
rules. Any real order.

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | `npm run backtest` fetches the window, replays every session and prints one row per day plus totals, with real and proxy days separated. |
| AC2 | With the default parameters, every replayed trade's range, SMA at the exit bar and exit bar equal those from `paper.ts`'s own `openingRange` / `smaAt` / `applyBars` (checked by a second implementation). |
| AC3 | 24 Sep, replayed with the real scan: MFSL exits at 10:55 (SMA) and POLICYBZR at 15:15. The entry difference from the live ledger is printed. |
| AC4 | The proxy and real picks are printed for every real-scan day. |
| AC5 | The walk-forward prints the held-out sum next to the current settings, and the best combination on the full window. |
| AC6 | A second run makes **0** Dhan calls for cached days. Replay mode refuses to run it. |
| AC7 | The 16:00 due-rule, with the clock injected: not before 16:00, not twice in a day, not at weekends, and a catch-up after a skipped day. |
