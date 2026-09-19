# HANDOFF — Dhan Terminal — Phases P21 + P22 + P23 — 2026-09-19

## Done
- **P23 (branch `p23-spot-window`, stacked on P22, pushed).** The chain shows 8 strikes below the
  spot and 8 at or above it (16 rows) — the user's example, NIFTY 23,346.40 → 22,950 … 23,700,
  verified live. Spec `docs/spec/spot-window-v1.md`. The user's screenshot of this request still
  showed Geist Mono and clipped cells: that tab had not been reloaded since before P22 (the server
  sends `no-cache`), so tell them to reload if the screen looks old.
- **P21 (branch `p21-prev-close`, pushed).** The header's spot change read `+0.00 (+0.00%)` on a
  shut market. After the session Dhan's `/v2/marketfeed/ohlc` `close` is that day's own close.
  `poller.ts` now takes the daily close (`/v2/charts/historical`) of the session before the one the
  intraday payload ends on. Live: NIFTY +75.80 (+0.33%), BANKNIFTY +302.95, SENSEX −19.63,
  RELIANCE −17.50, HDFCBANK +18.00 — all equal to TradingView. The live server on 8787 runs it.
- **The TradingView comparison** the user asked about: same data (12:15 candle H/L identical, O/C
  within 0.25). Differences on screen were the 112px strip vs TV's tall pane, and Dhan putting the
  official close 23,346.40 into the 15:25 candle while TV's candles end at the last trade 23,341.75.
- **P22 (branch `p22-type-and-fit`, stacked on P21, pushed).** Spec `docs/spec/ui-type-v1.md`.
  Inter everywhere; grid cells grow to their text (0 cut-off cells, was 277/425); 200px chart;
  peak tick under the digits; session note on the time axis; labelled Style button; the option
  window opens over the side not clicked. Replay 22/22, live 23/23, every older suite green except
  P16's environmental live-NSE funnel row.

## Files changed
- P21: `src/server/poller.ts`.
- P22: `public/index.html`, `app.css`, `app.js`, `candles.js`, `chart-tools.js`, `ucandles.js`,
  `telemetry.js`, `panes.js`; `docs/spec/ui-type-v1.md`; `docs/shots/` (re-baselined).
- Docs: `PHASES.md`, `CLAUDE.md` (2 lessons: Dhan `ohlc.close`; `public/` edits are live at once).

## Decisions made
- The option window's side rule applies on open and on a CE↔PE switch only; height and vertical
  spot stay remembered (amendment 10).
- Greeks on now scrolls sideways (270px at 1440) instead of cutting text — the spec's risk row said
  report it, not shrink the type.

## Known broken / deliberately skipped
- **GOLD's header change mixes two contracts** (chain spot 153,176 vs its future's LTP 154,263).
  Before and after P21. PHASES Next 3 #1.
- The daily-candle behaviour during a live session is unmeasured until Mon 21 Sep 09:15.
- Leftovers not mine: worktree `D:/Temp/Dhan-p19base`, replay servers on 8788 / 8790.
- The suite copies with rewritten checks live in `.cache/p22suite/` (gitignored, like all suites).

## Next session starts here
- Phase: PHASES Next 3 — GOLD's contract, then the Monday 09:15 checks (now including P21's).
- First command: `git worktree list; netstat -ano | grep LISTEN | grep ':87'; npm run check`
- Watch out for: 8787 is the one token owner and serves `public/` from disk — a saved UI file is
  on the user's screen at their next reload.
