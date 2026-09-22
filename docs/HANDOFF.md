# HANDOFF — Dhan Terminal — P25 — 2026-09-22

## Done
- **P25 — TradingView-style chart navigation**, on the main strip *and* the option window.
  Wheel zooms time about the cursor (0.85/notch, the time under the pointer held to 0.5px), a
  trackpad pinch does the same without the page zooming, a plot drag and a horizontal wheel pan,
  alt+wheel and the 76px price gutter zoom the scale, double-click or `0` resets, and a `⟩` arrow
  appears the moment the view leaves its default. **The price scale auto-fits to the candles
  inside the window**, so a zoom shows that window's range instead of the whole session flattened.
  The option window works in **index** space, because P9 draws option candles indexed.
  Spec: `docs/spec/chart-nav-v1.md`, 20 rows + amendments 21–28.
  **44/44** in replay (60 s soak), **11/11** live on the open MCX session, 4/4 note, 6/6 pop-out.
- **Three defects found by measuring, not by reading the code:**
  1. `ucandles.onTick()` grew a candle on a **shut** session. In replay at 21:15 the chart held one
     bar **5 h 50 min** after the 15:25 close with an empty 21,000,000 ms stretch in front of it —
     while `/api/ucandles` had returned 76 clean candles. The client drew the gap. The server's
     `openNow` decides now; verified live that this does not block an open session.
  2. The option window stored its right edge as a **rounded** candle index, so eight drag steps of
     0.12 candles each rounded back and a **slow** drag panned nothing. A fast flick worked, which
     is what made it look like a dropped event.
  3. "At the live edge" was measured in **milliseconds**. Six notches with the cursor one pixel
     short of the right edge drifted 144,450 ms — invisible — and silently un-pinned the chart
     from live data. It is one pixel now (half a candle in the option window).
- **GOLD's header is fixed, and the board's diagnosis was wrong.** It never "mixed two contracts".
  Dhan's option-chain `last_price` is **hours stale on MCX** while the rest of the same payload is
  live: the chain returned a 13:20–14:05 print (151,879) at 21:35 while `/v2/marketfeed/quote` on
  the same securityId returned 152,396, and 57 of 174 strikes moved LTP/IV/OI across two calls
  70 s apart. The spot — and the ATM — now come from a quote of the underlying securityId.
  Live: **GOLD 6/6, NIFTY 6/6**. The header reads −847 (−0.52%), equal to Dhan's own `net_change`.
- **P19's forming candle, verified live** for the first time since 2026-09-01, on the open MCX
  session: 395 ticks in 60 s, the forming candle's close equal to the last underlying tick in
  12 of 12 samples, its high/low containing every tick, new candles opening exactly 60,000 ms
  apart.
- **`npm run open:checks`** — the five measurements that need a live NSE session, in one command.
  A criterion it cannot reach prints SKIP and is named in the summary; it is never scored as a
  pass. Tonight on MCX: 4 pass, 0 fail, 3 not measurable.
- Branch `p25-chart-nav` is pushed (7 commits).

## Files changed
- `public/chart-tools.js` — the time window (`tSpan`, `tEnd`), `pShift`, every wheel and drag
  gesture, `applyTime()`, `resetView()`, `crossX()`, the `+`/`-`/`0` keys, `__chart.view()`.
- `public/ucandles.js` — `buildView()` takes a time window and fits price to it; the shut-session
  guard in `onTick()`; the OHLC readout defaults to the last candle **inside** the window.
- `public/candles.js` — the option window's index-space navigation and its own `⟩`.
- `public/app.js` — `applyTime` wired in, the tick line windowed, the view reset on chip / mode /
  interval / range changes, the spot tooltip, `__feedTicks()`, the note yielding to the crosshair.
- `public/index.html`, `app.css` — the two `⟩` buttons and their `[hidden]` rule.
- `src/server/poller.ts`, `src/server/derive.ts` — the spot (and the ATM) from a quote of the
  underlying, refreshed **without** blocking the poll; `spotSource` and `spotChainLast` on the wire.
- `scripts/open-checks.ts`, `package.json` — `npm run open:checks`.
- `docs/spec/chart-nav-v1.md` (new), `docs/PHASES.md`, `docs/DECISIONS.md`, `CLAUDE.md`.

## Decisions made
- "Same as TradingView" and "other things" are locked to 20 numbered rows; the user can veto any
  row in one word and the build follows the table, not the phrase.
- The view is **never persisted**: a time window in yesterday's epoch ms, restored onto today's
  candles, is an empty chart.
- The spot comes from a quote of the underlying securityId, not from the chain payload, and
  `derive()` measures the ATM against it — otherwise the spot marker sits four rows from the ATM
  row on a 500-point ladder. `spotSource` says which number is on screen.

## Known broken / deliberately skipped
- **Three measurements still need the NSE session** (09:15–15:30 on a trading day): P8 driven
  live, P8's AC5, and the clock time `NSE_EQ` `net_change` leaves zero. `npm run open:checks`
  takes all three plus two more in one command.
- **One question P25 opened and could not close:** whether NSE's option-chain `last_price` lags
  its own quote the way MCX's does. It agrees on a shut market. `open:checks` asks it at 09:15.
- **The row count at the 1440x900 floor.** In replay only **14 of 16** strike rows are fully on
  screen (15 live); all 16 fit at 1440x960. No spec row ever promised 16 at 900 — the check had
  inferred it — so the suites now assert every row reachable with the spine pinned and print the
  real count. Shrinking the 200px plot would buy the two rows back, and that height is the user's
  own P22 choice, so it is a decision, not a fix.
- **P16's two funnel checks stay red** — they compare live NSE numbers with a fixed fixture.
- A popped-out **chart** window keeps the app header, replay bar and instrument strip above it
  (276px of plot in a 560px window). Measured identical on the pre-P25 build, so it is P26's
  shape, not a regression — but it is worth a decision.
- `LTP-CALCULATOR/` and `assets/` are untracked empty directories in the working tree. Not mine;
  left alone.

## P27 — done in the same session
Re-baselining the verification suites onto the current specs. **p19 48/62 -> 62/62, p20 19/29 ->
30/30, p22 20/22 -> 23/23, p23 18/19 -> 19/19, p10a 32/42 -> 42/42, the P2-P9 re-proof 36/37 ->
37/37.** Every replacement is a value the current spec states, or the criterion's own invariant
where the spec states no number, each with a comment naming the row that superseded it.

**Two of the red lines were real defects**, not stale expectations, and had been read as stale for
weeks: the chart header genuinely wrapped to **76px at 1024** (P22 claimed to have fixed that and
its own suite had reported the 76px ever since), and P26's blip-vs-refusal split had dropped
row 21's promise that the error state says when it will retry — a refusal showed
`request failed (DH-904)` and nothing else while it was coming back in 60 s.

**Three measurement bugs fixed rather than claims loosened:** a `toFixed(2)` string comparison of
two float means flipping at a `.xx5` boundary; a check reading `#uSpot` (10 Hz) against a window
that re-anchors on a 3 s snapshot, which made P23's rule unmeasurable from outside until
`window.__grid.spot()` was added; and "one line" written as a 28px ceiling when P26's icons make
a one-line header 34px.

## Next session starts here
- **First command: `npm run dev`, then `npm run open:checks`** — and do it inside 09:15–15:30 IST
  on a trading day, or it will print five SKIPs and tell you so.
- P27 is done. The lesson it exists for is in CLAUDE.md: P19 sat at 48/62 for three weeks while
  everyone read its reds as the known ones. **A suite that is not re-run is not green, it is
  unmeasured** — re-run the whole set at the end of every phase.
- **One decision waiting:** 14 of 16 strike rows fit at 1440x900 in replay. Shrink the 200px plot
  to get all 16, or keep the chart and accept the scroll?
- Watch out for: three servers may be up (8787 live, 8791 replay, 8792 the pre-P25 baseline
  worktree at `D:/Temp/Dhan-p25base`). `git worktree list` first, kill by the PID that owns the
  port, and re-check `/api/health`'s `build` before trusting a number — a regression run earlier
  tonight measured P25's client against a pre-P25 **server** because the process predated the
  edit. `public/` is read per request; `src/server/` is not.
- 68 commits are stacked ahead of `main` and none of it is merged: p6 → … → p20 → p21 → p22 →
  p23 → p24 → p26 → p25. That is the user's call.
