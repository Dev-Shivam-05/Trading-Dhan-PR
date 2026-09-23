# SPEC LOCK — P32 Auto paper-trading from the front page

Status: **LOCKED** 2026-09-23 — approved by the user with one `go` on the table below.

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table; a decision
found missing while building is added as an amendment row at the bottom and reported.

**Paper means paper.** Nothing in this phase places, modifies or cancels a real order. Fills are
simulated locally from the LTP the app's own WebSocket feed already carries.

The only piece of the strategy the user has written down is the **entry**: the voice note of
14-Sep (`docs/Recording-14-09-2026.md`) — the three-filter list is "for trade entry between 9:20 and
9:30". Exit, size and instrument were never stated; the rows marked **GUESS** are proposals the user
accepted with the table and can veto one row at a time.

---

## Decision table

| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | "Paper" | No Dhan order endpoint is ever called. `src/server/paper.ts` does not import `dhan.ts`. Fills are simulated locally. The screen always shows a **PAPER · no real orders** label | Handoff rule. Checked by grep, not by trust |
| 2 | Entry signal | The P14 NSE scan, `nseScanner.run(20)`: top 20 gainers + 20 losers → \|chg\| ≥ 2% → OI chg ≥ 7%. Its **Long** list → **BUY**, its **Short** list → **SELL** | The user's recording, steps 1–3. `DEFAULT_TOP_N`, `CHG_MIN`, `OI_MIN` already exist in `scanner-nse.ts` |
| 3 | When | When armed, the server itself runs the scan at **09:20:00 IST** on a day the NSE F&O session is open (`sessionState('NSE_BSE_FNO').openNow`). Entries are allowed only until **09:30:00**. If the scan errors, or NSE's `priceAsOf` is not **today at 09:15 or later**, it retries **every 60 s** until 09:30, then prints `no trades today: <reason>` | 9:20–9:30 is the recording's window. **The 60 s retry is a GUESS.** The freshness rule also catches an exchange holiday: there is no holiday list, but NSE's prices are then dated an earlier day |
| 4 | What is traded | The stock's **near-month future** (`fnoUniverse().futureId`, segment `NSE_FNO`) | The scanner measures OI on exactly this contract, and it trades long and short symmetrically. **GUESS** (alternative: buy the ATM CE/PE) |
| 5 | Size | **1 lot** per signal, lot size from the instrument master. At most **10 positions** per day, highest \|chg%\| first across both lists; the rest are listed as `not taken: cap` | 1 lot is a master value. **10 is a GUESS**, from the recording's "8-10 stock bache" |
| 6 | Entry fill | The LTP of the **first feed tick on that future** after the scan finishes — not the scan's own LTP, which is the **cash** price. No slippage or brokerage is modelled; every P&L is labelled **gross, before charges**. No tick by 09:30:00 → the position is `unfilled`, with the reason `no tick in window` | A visible caveat beats a silently wrong net number |
| 7 | Stop / target | **Stop 1.0%** against, **target 2.0%** in favour, measured from the entry fill, checked on every tick. The exit fills at the **LTP of the tick that crossed** the level, not at the level, so a gap-through is recorded as it happened | **GUESS.** 1:2 risk-reward. Nothing written down gives an exit |
| 8 | Time exit | Everything still open is squared off at **15:15:00 IST** at its last LTP | **GUESS.** Brokers force intraday square-off around 15:15–15:20 |
| 9 | Re-entry | One trade per symbol per day | Keeps the day's list meaning what the scan said |
| 10 | Arming | A UI toggle, persisted, default **DISARMED**. Arming after 09:30 applies from the next trading day, and the screen says so. Disarming does **not** close open positions, and the screen says so | Automation needs a deliberate step to start |
| 11 | Manual controls | An **Exit** button per open row (fills at the last LTP), **Square off all**, and **Run now** in **replay only** (live returns 409) | Replay needs a way to test outside 09:20 |
| 12 | Price feed | The futures are subscribed on the **existing WebSocket feed** in `quote` mode, as one extra `feedWants` entry that is emptied once nothing is pending or open. No REST polling | CLAUDE.md: a second Dhan call inside the poll loop is a cadence bug waiting to happen |
| 13 | Ledger | `CACHE_DIR/paper-ledger.json` live, `paper-ledger.replay.json` replay, chosen by `isReplay()`. Survives a restart; open positions resume. A position from an **earlier date** found still open is closed at its last known LTP, reason `stale`, flagged `stale: true` | Replay and live must never share a persisted cache (CLAUDE.md, P12b) |
| 14 | Clock | The engine is pure — every rule takes `nowMs`. Live passes the wall clock; tests inject it | Same as P9 / P29: otherwise nothing is testable outside 09:15–15:30 |
| 15 | UI | A **fourth workspace, "Paper"**, on the 48px nav, owned by `public/paper.js`. Top bar: Arm toggle · status line (`waiting for 09:20` / `scanned 09:20:04 · 4 signals` / …) · day P&L ₹ · Square off all · Run now. **Open** table: Symbol · Side · Qty · Entry · LTP · Stop · Target · P&L ₹ · P&L % · [Exit]. **Closed today**: Symbol · Side · Entry · Exit · Reason · P&L ₹. **Last 5 days**: date · trades · wins · P&L ₹. Existing up/down tokens, Inter, the 10/11/12/13/14/16/22/32 type scale | Same overlay pattern as P29's `ws=ltp` |
| 16 | Refresh | The client polls `GET /api/paper` every **1000 ms**, only while the Paper workspace is open | Standard and simple. **GUESS** on 1 s |
| 17 | Routes | `GET /api/paper`, `POST /api/paper/arm {armed}`, `POST /api/paper/exit {id}`, `POST /api/paper/exit-all`, `POST /api/paper/run` (replay only). Bodies validated at the boundary; an unknown field or wrong type → 400. Behind the existing `APP_PASSWORD` gate | POST routes change state |
| 18 | Test seam | `window.__paper` read-only: `state() positions() closed()` | Same convention as `__chart`, `__grid`, `__ltp` |

## Out of scope

- Real orders of any kind; option buying; brokerage / STT modelling; trailing stops; re-entries;
  phone notifications of fills; backtesting.
- Entries from the LTP Calculator's levels (L10 is unspecified) or from P9's blue/yellow candles.

## Acceptance criteria

| # | Criterion | How it is measured |
|---|---|---|
| AC1 | No order endpoint anywhere in `src/`; `paper.ts` imports nothing from `dhan.ts` | Grep, in `npm run paper:test` |
| AC2 | The P14 fixture (Long MFSL; Short POLICYBZR, PNBHOUSING, FEDERALBNK) at an injected 09:20 gives exactly **1 BUY + 3 SELL**, each 1 lot = the master's lot | Unit; lot recomputed from the master by a second implementation |
| AC3 | Stop, target and 15:15 each fire for long **and** short (6 cases); a tick 0.01 short of a level does **not** fire; the exit price is the crossing tick's LTP | Unit |
| AC4 | Every closed trade's P&L, recomputed from the ledger file by a second implementation, matches to the paisa | Unit + browser |
| AC5 | Every filter rejects something: no tick by 09:30 → unfilled; arming at 09:31 → nothing today; a 12-signal fixture → 10 taken, 2 `cap` | Unit |
| AC6 | A replay run writes only `paper-ledger.replay.json`; the live file's mtime is unchanged | Replay server |
| AC7 | Kill the server by PID with positions open, restart: the same positions come back and the next tick moves their LTP | Replay server |
| AC8 | Browser, replay: arm persists across a reload; Run now puts positions on screen whose P&L equals the one recomputed from `__paper`; Exit and Square off all work; screenshots of 5 states (disarmed, armed waiting, open, all closed, scan failed) are taken **and read** | `.cache/p32-verify.js` |
| AC9 | `/paper.js` returns 200 from a freshly started server | curl |
| AC10 | Live, the next trading day, armed at 09:20: the real scan's signals are entered 09:20–09:30 | **Unverified until measured** — recorded as open, never as a pass |
| AC11 | Every earlier suite re-run and green | Suites in `.cache/` |

## Risks

- NSE's freshness at 09:20 has never been measured (P14 open). Stale → row 3 refuses and says so.
- The laptop sleeps after 3 min idle on AC. Asleep at 09:20 → the timer does not run; the status
  line shows the missed window.
- The Windows task `DhanNseScan0920` also loads NSE at 09:20 — two headed Chromes on NSE at once.
  A collision shows up as a scan error, not as a wrong trade.
- Live needs a live server started the evening before so the token renews (P31).

---

## Amendments found while building

| # | When | Change | Why |
|---|---|---|---|
| 19 | during build | **Replay clock.** In replay, `Run now` maps the moment it is pressed to **09:20:00 IST today**, and the engine's clock runs on from there (`clockOffsetMs`, persisted in the replay ledger only; always 0 live). The status line prints the replay clock | Without it, a Run now pressed at 21:00 would meet row 8's 15:15 rule at once and square everything off in the same second, and row 6's 09:30 cutoff would be unreachable. Same shape as P9's injected `nowMs`. Persisted so AC7's restart does not jump the clock to the wall time |
| 20 | during build | `Run now` returns 409 `square off first` while any position is pending or open | A second press would move the replay clock back to 09:20 under positions that are already running |
| 21 | during build | Stop and target levels are rounded to **0.01** at fill time | Makes "0.01 short of the level" (AC3) an exact statement instead of a float comparison |
| 22 | during build | The Paper tab has **no single-key shortcut**; `P` is already the breach toggle (`app.js:727`). Clicking **Option chain** closes the Paper workspace | Rule 3: match the codebase. A clash would make `P` do two things |
| 23 | during build | Freshness (row 3) is checked only on the **timer** path. Replay's `Run now` skips it | The committed NSE fixture is dated 17-Sep 16:00 and would always be refused. Live has no Run now, so live is never exempt |
