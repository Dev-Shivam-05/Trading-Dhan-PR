# SPEC LOCK — P8 9:20 F&O scanner

Status: **locked** 2026-08-31. Approved with `go`, no changes requested.
Not yet implemented — the build is blocked on the Data API plan (`dataPlan: Deactive`).

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table.

Source: six voice recordings analysed 2026-08-28. Rec 03 and Rec 04 are word-for-word duplicates,
so the scanner has **three** filter steps, not four.

## What it is

A manually triggered scan over the 210-stock NSE F&O universe that funnels

    210 stocks  ->  top 50 gainers + top 50 losers  ->  |LTP change| >= 2%  ->  |OI change| >= 7%

and prints the survivors as two short named lists with counts.

## Decision table

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | **"top gainer/loser" — measured over what?** | The 210-stock F&O universe itself. Rank all 210 by % change vs previous close on the **NSE_EQ** leg; keep the **top 50 gainers** and **top 50 losers**. The three filters stay distinct: `210 -> 100 -> n -> m` | The user's own worked example was "maan lo 50 stock aaye". DhanHQ v2 has no gainer/loser endpoint and `nseindia.com` is unreachable from this machine, so an external list cannot be sourced anyway. 50/50 preserves the user's 3-step model instead of collapsing filters 1 and 2 into one |
| 2 | Universe source | `OPTSTK` underlyings from the cached instrument master = exactly **210**, with the 18 `NSETEST` scrips dropped | Verified 2026-08-28 against the real master. `FUTSTK` and `OPTSTK` underlying lists are identical once the dummies are dropped |
| 3 | Where stock OI comes from | The **near-month `FUTSTK`** contract for each stock. Requires adding `FUTSTK` to `KEEP_INSTRUMENTS` in `src/server/master.ts` (line 46) | Equities carry no OI. Futures are dropped at parse time today — this is the one-line unblock, and it is a prerequisite, not an optional extra |
| 4 | How many API calls for the quote step | **One** `POST /v2/marketfeed/quote` with `{ "NSE_EQ": [210 equity ids], "NSE_FNO": [210 near-month FUTSTK ids] }` = 420 instruments. Slot key `scan:quote`, `cadenceMs: 1000` | The per-request limit is 1000 instruments. The segment-keyed body shape is already used by the `ohlc` call in `src/server/poller.ts` (~line 333) |
| 5 | Is 2% measured against previous close or the 9:15 open? | Previous close. `prevClose = last_price - net_change`; `chgPct = net_change / prevClose * 100`; keep when **`abs(chgPct) >= 2.0`** | `net_change` is the absolute change from previous close and arrives in the same payload — no second call. It is also what "gainer/loser" means on every other screen the user reads |
| 6 | Is the 7% OI change positive-only or absolute? | **Absolute**: keep when `abs(oiPct) >= 7.0`. The sign is preserved and displayed in the row | Direction is already carried by the gainer/loser split. A gainer with OI *down* is short covering; a gainer with OI *up* is long build-up. Both are worth seeing, and a positive-only filter silently discards half the signal |
| 7 | OI change against which baseline | The previous session's **closing** OI of that FUTSTK contract: `POST /v2/charts/intraday` with `"oi": true`, `interval: 5`, the previous trading session — take the **last candle's** `open_interest`. Cached per `(securityId, sessionDate)` | Nothing else in DhanHQ v2 returns a prior-day OI for a futures contract. This is the same mechanism P7 uses, so the fetcher and the cache are shared |
| 8 | Cost of the baseline step | Fetched **only for filter-2 survivors** (at most 100 by construction). Slot key `scan:oi`, `cadenceMs: 1000` | Worst case 100 calls = 100 s, inside the 120 s criterion. A warm cache costs 0 calls. 1000 ms matches the existing `ohlc` cadence rather than a guessed rate limit |
| 9 | Does it run once at 9:20, or repeat? | **Manual only.** A `Scan` button in the top bar plus keyboard `S`. No timer, no auto-repeat, no 9:20 trigger. Enabled whenever the NSE equity session is open; a hint line under the heading reads `intended for 09:20 IST` | The board row already says "manually triggered". `S` collides with none of the taken keys (`1-9`, `/`, `L`, `T`, `E`, `C`, `Home`, and P6's `V D H R B Esc Delete`) |
| 10 | Does the output distinguish gainers from losers? | Yes — two sections, **`Long candidates (n)`** and **`Short candidates (m)`**. Columns: Symbol, LTP, Chg %, OI, OI Chg %, Volume. Sorted by `abs(chgPct)` descending within each section | Direction is load-bearing for the trade that follows, and splitting the list costs nothing |
| 11 | Screen only, or persisted / alerted? | Screen only, plus an `Export CSV` button reusing the `/api/telemetry.csv` pattern. No alerts, no database, no localStorage | Keeps the phase inside 7 files |
| 12 | Where it renders | A full-width overlay panel `#scan` above the grid, dismissed with `Esc` or its `✕`. Not a new page or route change | The app is a single screen; a route change would tear down the chain poll and the tick feed |
| 13 | Zero results | An expressive state printing the whole funnel — `210 -> 100 -> n -> 0` — so a legitimate zero reads as a zero rather than as a broken scan | P4's states rule. An empty sparkline on a closed market already read as broken once |
| 14 | Stocks that cannot be scored | Listed under a `skipped (n)` disclosure with the reason: `no near-month future`, `no OI baseline`, `no quote`. Never silently dropped | A silently shortened universe is exactly the "number that is quietly wrong" this project refuses |
| 15 | Replay behaviour | `REPLAY=1` synthesises all 210 stocks from a fixed seed such that **exactly 6** pass all three filters — **4 long, 2 short** | Live data is blocked on the Data API plan. Without a deterministic replay path this phase has no acceptance test at all |
| 16 | New code | `src/server/scanner.ts`, route `GET /api/scan`, `public/scan.js` **plus its row in the `STATIC` allow-list** in `src/server/index.ts` | A `public/*.js` file with no `STATIC` row 404s, and the failure looks like the whole client dying rather than a missing file |
| 17 | Interaction with the 3 s chain poll | Every scanner call goes through `dhanPost` with its own slot key. The chain poll's cadence is untouched and must not stall while a scan runs | The completion-scheduled 3000 ms cadence is a P1 acceptance criterion and must not regress |
| 18 | **AMENDED during the build.** Progress while a scan runs | `GET /api/scan/status` returns `{running, stage, done, total, elapsedMs}`; the panel polls it every 400 ms and shows the stage plus a `done / total` bar | The spec was silent, and a live cold scan is ~90 s of serial calls. A panel that says nothing for a minute and a half reads as hung. Same lesson as P7's `PEAK OI 9 / 82` chip |
| 19 | **AMENDED during the build.** The cash row of a stock | The `EQUITY` row must also have `SERIES = 'EQ'`; `MasterRow` grew a `series` field to carry it | `CHOLAFIN` and `MOTHERSON` each list an **NCD** under the same symbol with `INSTRUMENT = EQUITY`. Matching on symbol alone quotes a debenture's price as the share's — a silently wrong number on a trading screen, which is the one failure mode this project refuses |
| 20 | **AMENDED during the build.** When the button is enabled | Row 9's rule, **or** `REPLAY=1` | Row 9 as written makes the whole phase untestable outside 09:15-15:30 IST, and almost all work on this project happens outside it. Replay data is synthetic and has no session, so gating it on a real session gates it on nothing meaningful |

## Out of scope (will NOT build)
- Auto-running at 9:20, or any scheduler
- Alerts, notifications, sound, push
- Scanning indices, or anything outside the 210 F&O stocks
- Replaying a scan against a past date
- Charts inside the scan panel
- Any `nseindia.com` scraping — unreachable from here (HTTP 000) and it only publishes the top 25

## Acceptance criteria (binary, testable in `REPLAY=1`)
- [x] A scan of all 210 returns in under **120 s** cold, and under **5 s** with the OI baseline cache warm.
- [x] The seeded replay returns **exactly 6** stocks: 4 under `Long candidates`, 2 under `Short candidates`.
- [x] Every returned stock independently satisfies all three filters when recomputed by hand from the same payload: inside the top 50 of its side, `abs(chgPct) >= 2.0`, `abs(oiPct) >= 7.0`.
- [x] The funnel counts reconcile: `skipped + m + rejected = 210`.
- [ ] The chain poll's minimum gap stays at or above 3000 ms across a full scan, read from the telemetry log. — **NOT MEASURABLE on a closed market**, see below.
- [x] No `NSETEST` scrip appears in the universe, the results, or the skipped list.
- [x] Screenshots in both themes: results with both sections populated, the zero-result funnel state, the skipped disclosure open.

## Verification (replay, 2026-09-01)

`32/33` checks pass; the 33rd is not measurable in this mode and is reported as unverified rather
than as a pass. Three scripts, all throwaway in `.cache/`:

| What | Measured |
|---|---|
| Universe | **210** stocks from the master, 18 `NSETEST` scrips dropped, all 210 with one `EQ`-series cash row and a live near-month future |
| The funnel | `210 -> 208 scored -> 100 ranked -> 87 -> 6`. All three filters reject: 108 fail the rank cut, 13 fail 2%, 78 fail 7% |
| Survivors | **4 long, 2 short** — DRREDDY, ICICIGI, ASHOKLEY, BHARATFORG / MARICO, PAYTM |
| AC3, the hard way | A **second implementation** (`.cache/recompute-scan.ts`) rebuilds the whole funnel from the same replay payload with its own arithmetic and its own candle reducer, never importing `scanner.ts`. It agrees on all 10 comparisons: universe, scored, both filter counts, both candidate lists by name, the skipped set, the rejected count, and that every survivor sits inside the top 50 of its own side |
| AC1 | cold **4.2 s** (87 OI calls), warm **43 ms** (1 call, 86 cached) |
| AC4 | `3 skipped + 6 survivors + 201 rejected = 210`, computed independently and by the server |
| Row 14 | 3 skipped, each with a reason: `no OI baseline` (1), `no quote` (2) — all three seeded deliberately so the disclosure is exercised |
| Rate-gate keys | Static read of `scanner.ts`: only `scan:quote` and `scan:oi` appear, never a `chain:` key, and the whole OI fan-out shares **one** key |
| Server responsiveness under load | `/api/scan/status` probed every 100 ms throughout a cold scan: p50 **17.0** / p95 **17.9** / max **18.0 ms** |
| UI | 22/22 browser checks: `S` opens, `Esc` closes, headings match the payload, the on-screen percentages equal the payload's to 2 dp, the funnel is printed, the grid underneath still renders 41 rows, zero console errors |
| Screenshots | 5, reviewed in both themes: results, zero state, running state |

**AC5 is unverified.** The criterion needs two consecutive chain polls to measure a gap between,
and on a closed market `ChainPoller` emits one snapshot and then only re-checks every 60 s. Worse,
**replay makes no `dhanPost` calls at all**, so the rate gate — the mechanism by which a scan could
starve the poll — is not exercised in this mode even with the market open. What was measured
instead is the two things that would have to be true anyway: the scanner never touches a `chain:`
slot key, and the server stays responsive (max 18 ms) throughout a scan. **Re-run this one the
first time the market is open with a live plan.**

## Risks
- **The `/v2/charts/intraday` rate limit is unverified.** 1000 ms is assumed from the existing `ohlc` call. One live call settles it and may let step 3 run several times faster.
- **A daily historical endpoint carrying OI would collapse step 3 into a single call.** Also one call to check — worth checking before building the 100-call loop.
- ~~Adding `FUTSTK` to the master parse grows the retained row count.~~ **Measured**: +1,270 rows on ~170,465, a 0.7% increase. Not worth optimising.
- **`open_interest` units** (contracts vs units) affect only the displayed OI column, not the percentage — but confirm before labelling it.
- **A live cold scan is projected at ~90 s, not measured.** 87 baseline calls at the assumed 1 req/s plus the quote call. That is inside the 120 s criterion by only ~25%, and the projection rests on the unverified rate limit above. If the real limit is slower, this criterion fails on the first live run.
- **The `/v2/marketfeed/quote` response shape is unverified.** The reader accepts a flat body and a `data` wrapper, and reads `last_price` / `net_change` / `volume` / `oi` per segment-keyed map. Nothing has confirmed it against a live plan.
