# P38 — The backtest panel on the Paper tab

**Locked 2026-09-26 by delegation.** `backtest-v1.md` row 15 boarded it: "per-day table, current vs suggested settings,
real/proxy split, the calibration table". It is read-only. It shows what the nightly jobs already wrote, recomputes nothing, and
changes no setting.

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | Sources | `.cache/history/report.json` (P37, nightly), `train-report.json` (P44, by hand) and `shadow-report.json` (P45, nightly). A missing file is shown as "not run yet", with the command that makes it | Three jobs, one place to read them |
| 2 | Route | `GET /api/backtest` returns the three, **trimmed**. It drops P37's per-trade list and all but the top 5 of its 108-cell grid, and P44's per-setting trade lists (megabytes). The panel then has a small, stable payload | The panel polls |
| 3 | P37 card | Its window (sessions, real vs proxy); the current settings' result split **all / real / proxy** (trades, win %, gross, max drawdown, worst day); the walk-forward held-out total next to the current settings'; the best cell now; a **per-day table** (date, real/proxy, signals, trades, gross) from its trades; the **calibration table** (live fill vs model fill) | backtest-v1 row 15, word for word |
| 4 | P44 card | The recommendation and its reason, and the baseline vs the recommendation (net, net per trade, both halves) under both fill models. The words "a recommendation, not a change" are shown | P37 row 13 / P44 row 17 |
| 5 | P45 card | 3 settings × 2 fills: forward sessions, trades and net. With no forward session it reads "first forward session: Mon 28 Sep, after 16:00" | shadow-v1 row 5 |
| 6 | Refresh | On opening the Paper tab, then every 60 s | The files change once a day |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | `/api/backtest` payload is < 200 KB and carries all three sources (or their "not run yet" state) |
| AC2 | Each number the panel prints for P37's current settings equals the one in `report.json`. The per-day table's gross sums to `current.all.gross` |
| AC3 | The panel renders on a replay server with zero console errors. **Screenshot**, read before calling it done |
| AC4 | No button on the panel changes anything: it holds no form controls, and no POST route is added |
