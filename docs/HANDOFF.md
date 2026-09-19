# HANDOFF — Dhan Terminal — Phases P21–P24 — 2026-09-20

## Done
- **P21** — The header's spot change is right on a shut market: NIFTY 23,346.40 **+75.80 (+0.33%)**,
  BANKNIFTY +302.95, SENSEX −19.63, RELIANCE −17.50, HDFCBANK +18.00, each equal to TradingView
  (it read +0.00 before). The candles were checked against TradingView too and match.
- **P22** — The whole UI is Inter, one family, with tabular figures. No chain cell cuts its text off
  (was 277/425 with Greeks on). The chart strip opens at 200px. The peak-OI tick sits under the
  digits, and the session note is on the time axis. There is a labelled **Style** button (icon-only
  below 1180px). A CE / PE click opens the option window over the other half of the chain.
- **P23** — The chain shows **8 strikes below the spot + 8 at or above it** (16 rows). Live NIFTY at
  23,346.40 shows exactly 22,950 … 23,700, the user's own example.
- **P24** — A collapsed chart shows a **▸ Show chart** button. "The chart is gone" was the persisted
  collapse (`C` / ▾), not a bug.
- All four branches are pushed, stacked: `p21-prev-close` → `p22-type-and-fit` →
  `p23-spot-window` → `p24-chart-toggle`. The live server on 8787 runs P21's server code and serves
  P24's UI.

## Files changed
- `src/server/poller.ts` — the previous close comes from daily candles, not from `marketfeed/ohlc` (P21).
- `public/index.html`, `app.css` — Inter, auto table layout, the 200px strip, the Style button, the
  peak tick, the collapsed-toggle label (P22, P24).
- `public/app.js` — the `MONO` constant, the spot-anchored `windowRows()`, the chip text and the
  `setChart()` label (P22–P24).
- `public/candles.js` — the option window goes over the side not clicked (P22 row 9).
- `public/ucandles.js`, `chart-tools.js`, `telemetry.js` — SVG font; the note on the axis row; no
  axis label behind the price pill (P22, P23).
- `public/panes.js` — default plot 200px (P22).
- `docs/spec/ui-type-v1.md`, `docs/spec/spot-window-v1.md` — new specs. `docs/shots/` re-baselined.
- `CLAUDE.md`, `docs/PHASES.md`, `docs/DECISIONS.md` — lessons, board, decisions.

## Decisions made
- The previous close is the daily close of the session before the one the intraday payload ends on (P21).
- The grid scrolls sideways rather than cutting text: 270px at 1440 with Greeks on (P22).
- The strike window is anchored on the spot, not the ATM: 8 + 8 = 16 rows (P23, the user's numbers).

## Known broken / deliberately skipped
- **GOLD's header change mixes two contracts.** The chain spot is 153,176; its charted future is
  at 154,263. Unresolved.
- **The previous-close rule is unmeasured while the market is open** — Mon 21 Sep 09:15 is the
  first chance. So is P19's forming candle.
- **P16's two funnel checks stay red.** They compare live NSE numbers with a fixed fixture, so the
  cause is environmental.
- **Not built — the user's new request, recorded as P25:** zoom in / out with the mouse wheel and
  the trackpad, "same as TradingView", "and other things". Today only the price axis zooms (by
  dragging it). There is no time-axis zoom and no pan.

## Next session starts here
- Phase P25: TradingView-style chart navigation. It needs a `spec-lock` table first, because "same
  as TradingView" and "other things" are undefined. Propose wheel = time zoom about the cursor,
  pinch = zoom, two-finger / drag = pan, Ctrl+wheel = price zoom, double-click axis = reset, and
  which days are loaded when panning left.
- First command: `git worktree list; netstat -ano | grep LISTEN | grep ':87'; npm run check`
- Watch out for: on Mon 21 Sep 09:15–09:30 the market-open checks (PHASES Next 3 #1) come
  **before** P25. Also, 8787 serves `public/` from disk: every saved UI file is on the user's
  screen at their next reload, so build P25 against a replay server on 8791.
