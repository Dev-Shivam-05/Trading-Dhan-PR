# SPEC LOCK — P9 option candle colouring

Status: **locked** 2026-08-31. Approved with `go`, no changes requested.
Not yet implemented — the build is blocked on the Data API plan (`dataPlan: Deactive`).

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

## Out of scope (will NOT build)
- A volume or OI subplot under the candles
- Drawings on the option candle chart
- Multi-contract or comparison view
- Alerts when a candle fires
- Colouring the spot / underlying chart by the same rule
- Backtesting the rule over history, or tuning its thresholds in the UI
- Building candles from the WebSocket tick feed

## Acceptance criteria (binary, testable in `REPLAY=1`)
- [ ] The seeded replay day renders **exactly 3 blue and 2 yellow** candles; every other candle is `--up` or `--down`.
- [ ] For one blue candle, the tooltip's `vol`, `median20`, `dOI` and `oi[i-1]` equal values recomputed by hand from the raw payload, and the rule applied to those four numbers yields blue.
- [ ] For one candle that passes the volume test but fails the OI test, the tooltip reads `fired: no` and the candle is green or red.
- [ ] The in-progress last candle is never blue or yellow.
- [ ] Switching interval 5 -> 1 -> 15 re-fetches and re-colours with no stale candles left on screen.
- [ ] Clicking a CE half and then the PE half of the same strike charts two different contracts with different security ids.
- [ ] `drawCandles()` p95 stays under 8 ms over 100+ frames at 375 candles.
- [ ] Screenshots in both themes: a blue candle, a yellow candle, the tooltip open, and the illiquid empty state.

## Risks
- **The unit of `open_interest` for options** (contracts vs units) is unverified, and row 7's lot floor depends on it. One live call settles it; if OI is reported in contracts, the floor becomes `5`, not `5 * lotSize`.
- **Whether Dhan retains 90 days of per-candle OI for option contracts** is still untested, as is how expired contracts behave — there is a separate "Expired Options Data" API for those.
- **Row 8 cannot be proven right from the recordings.** It is a reading of the user's intent. If a real session shows the colours inverted, change row 8 and nothing else — no other row depends on which way round it is.
- **A candlestick renderer is new to this project.** The chart strip only draws a line/area today, so the 8 ms budget in row 16 should be measured before anything is polished.
