# SPEC LOCK — P9 option candle colouring

Status: **locked** 2026-08-31, **built and verified in replay** 2026-09-01 (22/22 checks — see the
verification table). Three amendment rows were added during the build (20, 21, 22), all marked as
such. **The live path has never run**: the account still has no Data API plan, so every number
below came from synthetic candles.

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table.

Source: six voice recordings analysed 2026-08-28. Rec 01 said volume triggers the colour, Rec 02
said OI — row 5 resolves that contradiction.

## What it is

A candlestick chart of **one option contract's own** price — not the spot chart. Candles are green
or red as usual, and are recoloured **blue** or **yellow** on the candles where a big player is
entering or exiting that strike, so the move is visible on the chart instead of being inferred from
the chain.

    fired = volume test AND OI test
    blue  = fired and dOI > 0   ->  big player ENTERING the strike   ->  buy side
    yellow= fired and dOI < 0   ->  big player EXITING the strike    ->  sell side

## Decision table

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | Which contracts get charted | **Exactly one at a time**, chosen by clicking the CE half or the PE half of a strike row. Delegated click on `#ocBody`; rows already carry `data-strike`. Expiry is the one already selected in the header | No row click handler exists today, so nothing conflicts. ATM +/- N would mean N charts and N candle fetches on every repaint |
| 2 | Where it renders | The existing chart strip switches mode. Its header reads `NIFTY 24500 CE · 04 Sep` with a `← underlying` button back. The selected half of the row carries a `var(--ring)` outline | One chart strip, one grip, one resize path. A second chart doubles the paint budget for no new information |
| 3 | Candle source | `POST /v2/charts/intraday`, `exchangeSegment: NSE_FNO`, `instrument: OPTIDX` or `OPTSTK` by underlying type, `"oi": true`, `fromDate` = 5 calendar days back, `toDate` = today | The only endpoint that carries per-candle `open_interest`, verified 2026-08-28 |
| 4 | Candle interval | **5 min** default; switchable `1 / 5 / 15` in the existing `.range` button group style. Persisted as `localStorage.candleInterval` | 1-min option candles are mostly empty on anything but ATM. 5 min gives 75 candles for a full session, which is readable at the strip's height |
| 5 | **Volume or OI triggers the colour?** | **AND** — a candle is flagged only if the volume test *and* the OI test both pass | OI cannot move without volume, so `OR` degenerates into the OI test alone. Volume with no OI change is intraday churn, which is the opposite of a big player taking a position. Resolves the Rec 01 / Rec 02 contradiction rather than picking a side |
| 6 | What "vibration" means numerically | The volume test: **`vol[i] >= 3.0 * median(vol[i-20 … i-1])`**. Median, not mean | Binds the user's word to one number instead of leaving it undefined. A median is not dragged upward by the very spike being tested for |
| 7 | OI threshold and its baseline | `dOI = oi[i] - oi[i-1]`. The OI test passes when **`abs(dOI) >= 0.05 * oi[i-1]`** *and* **`abs(dOI) >= 5 * lotSize`** | A percentage alone lets a strike holding 200 units fire on noise; the lot floor kills that. The baseline is the previous candle, so it measures this candle's move rather than the whole day's |
| 8 | **What separates blue from yellow** | `dOI > 0` -> **blue** = big player **entering** the strike -> buy side. `dOI < 0` -> **yellow** = big player **exiting** -> sell side | Read off the board's own sentence, "so a big player entering or exiting a strike is visible", combined with the user's blue -> buy / yellow -> sell. This is a reading of intent, not a measurement — it is the row to revisit first if the screen ever looks backwards |
| 9 | The two colours | New tokens `--big-in` / `--big-out`. Light `#1E5FD8` / `#D9A400`; dark `#5C93F0` / `#F2C438`. Filled body, 1px darker stroke, plus two legend chips in the chart header | They must not read as `--up`/`--down` or as the `--accent` gold, which already means "drawing" and "OI bar". The legend chips mean the colour is never guessed |
| 10 | Ordinary candles | `--up` / `--down`, filled body, 1px wick | Already the project's up/down tokens |
| 11 | Coloured on close, or during formation? | **Closed candles only.** The in-progress candle is always plain green/red and is re-evaluated when it closes | A colour that appears and then vanishes mid-candle is a false signal on a trading screen |
| 12 | The first 20 candles | The fetch window starts 5 calendar days back, so today's 09:15 candle already has 20 predecessors. A candle with fewer than 20 predecessors inside the window never fires | Otherwise the rule is dead until 10:55 on a 5-min chart — exactly the half of the day the user cares about |
| 13 | Hand-checkability | Hovering a candle shows O/H/L/C, volume, OI, `median20`, `vol / median`, `dOI`, `dOI %`, and `fired: blue / yellow / no` | This is what makes the done-when checkable at all: the tooltip prints the exact inputs the colour was computed from |
| 14 | Refresh cadence | Re-fetch on contract change, on interval change, and every **60 s** while an option chart is open. Slot key `candles:<securityId>:<interval>`, `cadenceMs: 1000` | Candles close every 5 min, so 60 s is at most 60 s stale and costs one call a minute |
| 15 | Illiquid contract | Empty state reading `no trades in this contract today`, with the strike named. Not an error, not a blank chart | A far OTM strike with zero volume is normal, not a failure |
| 16 | Performance | Up to **375** candles drawn (a full 1-min session). `drawCandles()` **p95 under 8 ms** over 100+ frames | p95, never max — see the P6 AC8 amendment and `CLAUDE.md` |
| 17 | P6 drawing tools on this chart | **Not built.** The tools stay bound to the underlying tick chart and are disabled in option-candle mode | `chart-tools-v1.md` deferred this to P9; deciding "not here either" keeps P9 inside 8 files. Anchors are `(t, p)`, so it stays possible later without rework |
| 18 | Replay behaviour | `REPLAY=1` synthesises a 75-candle 5-min day from a fixed seed containing **exactly 3 blue and 2 yellow** candles | Live data is blocked. Replay is the only test surface this phase has |
| 19 | New code | `src/server/candles.ts`, route `GET /api/candles`, `public/candles.js` **plus its row in the `STATIC` allow-list** in `src/server/index.ts` | Same 404 trap as the scanner spec's row 16 |
| 20 | **AMENDMENT (build, 2026-09-01)** — which of the fetched days is drawn | The chart renders **only the latest session in the payload**. The earlier days are fetched and fed through the rule so the session's first candle already has its 20 predecessors, and are then dropped; `context` in the response says how many were used | Row 12 already says the 5-day window exists *so that* today's 09:15 candle has 20 predecessors, and row 18 speaks of "a 75-candle 5-min day". Drawing all five days would put 375 candles on a 5-min chart and make row 18's count ambiguous. Stated as its own row because it was implied, not written |
| 21 | **AMENDMENT (build, 2026-09-01)** — how row 11 is testable at all | The rule takes `now` as an argument. Live it is the wall clock. In `REPLAY=1` it is the **last seeded candle's open + 1 s**, so that candle — and only that candle — is the one still forming | Row 11 and AC4 are otherwise unmeasurable outside 09:15–15:30 IST, which is when almost no work on this project happens. Same deviation, and the same reason, as `scanner-v1.md` row 20 |
| 22 | **AMENDMENT (build, 2026-09-01)** — reaching row 15 in replay | Replay returns **no candles at all** for a strike **15 or more steps from the money**. Every chip's chain is at least 31 strikes wide, so the state is one click away in all six | Row 15's empty state cannot be screenshotted, and the "note, not error" distinction cannot be tested, if the fixture always returns a full day |

## Out of scope (will NOT build)
- A volume or OI subplot under the candles
- Drawings on the option candle chart
- Multi-contract or comparison view
- Alerts when a candle fires
- Colouring the spot / underlying chart by the same rule
- Backtesting the rule over history, or tuning its thresholds in the UI
- Building candles from the WebSocket tick feed

## Acceptance criteria (binary, testable in `REPLAY=1`)
- [x] The seeded replay day renders **exactly 3 blue and 2 yellow** candles; every other candle is `--up` or `--down`.
- [x] For one blue candle, the tooltip's `vol`, `median20`, `dOI` and `oi[i-1]` equal values recomputed by hand from the raw payload, and the rule applied to those four numbers yields blue.
- [x] For one candle that passes the volume test but fails the OI test, the tooltip reads `fired: no` and the candle is green or red.
- [x] The in-progress last candle is never blue or yellow.
- [x] Switching interval 5 -> 1 -> 15 re-fetches and re-colours with no stale candles left on screen.
- [x] Clicking a CE half and then the PE half of the same strike charts two different contracts with different security ids.
- [x] `drawCandles()` p95 stays under 8 ms over 100+ frames at 375 candles.
- [x] Screenshots in both themes: a blue candle, a yellow candle, the tooltip open, and the illiquid empty state.

## Verification — `REPLAY=1`, 2026-09-01, NIFTY 24,100, 1440x900

22/22 checks pass, zero console errors. Driver: `.cache/p9-verify.js` (throwaway, gitignored).
`npm run shots` was **not** run — the 17 committed reference images are untouched.

| # | Criterion | Measured | Verdict |
|---|---|---|---|
| AC1 | 3 blue + 2 yellow in the payload | `blue=3 yellow=2` of 75 candles | pass |
| AC1 | …and the same counted off the **DOM** | body sub-paths `{blue:3, yellow:2, up:34, down:36}`, 70 = 75 − 5 | pass |
| AC2 | a **second implementation** agrees | its own median, its own thresholds, imports nothing from `candles.ts`: agrees on all **55** candles whose 20-window lies inside the rendered session | pass |
| AC2 | one blue candle, recomputed by hand | i=22, 11:05 — `vol 240,000`, `median20 25,367` (recomputed 25,367), `dOI +280,887` (recomputed +280,887), `oi[i−1] 2,340,724`; ratio **9.46×** ≥ 3.00, `dOI` **12.00%** ≥ 5% and 280,887 ≥ 325 → **blue** | pass |
| AC3 | volume passes, OI fails | i=46 — ratio **9.46×**, `dOI` **1.00%**; `fired: no`, drawn red | pass |
| AC4 | the forming candle is never coloured | exactly one `inProgress` (15:25, the last), `fired: null` | pass |
| AC5 | 5 → 1 → 15 → 5 | 75 → 375 → 25 → 75 candles, **bodies drawn == candle count** at every step, counts stay 3/2, `localStorage.candleInterval = '5'` | pass |
| AC6 | CE vs PE | `ce=46989`, `pe=46990` on the same strike | pass |
| AC7 | `drawCandles()` p95 < 8 ms at 375 | 130 frames: **p50 2.20 / p95 3.70 / max 8.00 ms** — eight `<path>` nodes for the whole series, one per colour group | pass |
| AC8 | screenshots, both themes | 8 images: candles / blue tooltip / yellow tooltip / illiquid, in dark and light. Reviewed | pass |
| row 13 | the tooltip prints the rule's inputs | `11:05 · 5m · O/H · L/C · Volume 2.4 L · median20 25.37 K · vol/median 9.46× ✓ ≥ 3.00× · OI 26.22 L · oi[i−1] 23.41 L · ΔOI +2.81 L (+12.00%) ✓ ≥ 5% and ≥ 325 · fired blue` | pass |
| row 14 | re-fetch every 60 s while open | `/api/candles` at **+5 ms** and **+60,016 ms**; **0** further calls after leaving option mode | pass |
| row 15 | illiquid contract | 23,100 PE (offset 20) → `no trades in this contract today — NIFTY 50 23,100 PE`, `error: null` | pass |
| row 17 | tools disabled on this chart | all `[data-tool]` buttons disabled, and `#chartTools` / `#chartSurface` / `#chartAxis` all `display:none` | pass |
| row 2 | the charted half is outlined | `tr.selpe` present, `tr.selce` absent; survives a 3 s snapshot re-render of the tbody | pass |
| — | leaving option mode | `Esc` restores the tick chart and drops the outline; switching chip drops back to the underlying | pass |

**One real bug found by testing.** `app.js` reassigns `className` wholesale on `#chartChg`
(`paintSpot`) and `#feedPill` (`onFeed`), which silently dropped the `tickonly` class that hides
them in option mode — so the underlying's price change and the feed pill stayed on screen beside
an option's candle header, reading as that option's numbers. Both assignments now carry the class,
with a comment saying why.

## Risks
- **The unit of `open_interest` for options** (contracts vs units) is unverified, and row 7's lot floor depends on it. One live call settles it; if OI is reported in contracts, the floor becomes `5`, not `5 * lotSize`.
- **Whether Dhan retains 90 days of per-candle OI for option contracts** is still untested, as is how expired contracts behave — there is a separate "Expired Options Data" API for those.
- **Row 8 cannot be proven right from the recordings.** It is a reading of the user's intent. If a real session shows the colours inverted, change row 8 and nothing else — no other row depends on which way round it is.
- **A candlestick renderer is new to this project.** The chart strip only draws a line/area today, so the 8 ms budget in row 16 should be measured before anything is polished. *(Measured: p95 3.70 ms at 375 candles. The budget was never in danger once the series was batched into one `<path>` per colour group.)*
- **The live path has never run.** Every number above came from synthetic candles. Three unverified assumptions ride on the first live call: the `/v2/charts/intraday` response shape for `OPTIDX`/`OPTSTK` (the reader accepts a flat body *and* a `data` wrapper), that Dhan really retains 5 days of per-candle OI for an option contract, and the `open_interest` unit — row 7's `5 * lotSize` floor is 325 for NIFTY if OI is in units and should be **5** if it is in contracts.
- **A fired candle with a flat body is a one-pixel mark.** The colour is carried by the wick as well as the body, so it is visible, but a doji that fires reads as a thin line rather than a coloured candle. In the seeded fixture the price walk is independent of the OI seeding, so this happens; on live data a 12% OI move usually carries a real price move too. Worth a second look with live data before deciding it needs a minimum body height.
