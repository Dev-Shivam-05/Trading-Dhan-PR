# HANDOFF — Dhan Terminal — Phase P12b — 2026-09-19

## Done
- **Feed parser proven on real bytes.** Quote (4), full (8) and OI (5) packets for NIFTY and two
  NIFTY options agree **exactly** with `/v2/marketfeed/quote` on LTP, volume, OI, open, high and low.
- **P7 live:** three peaks in the live server's cache equal the max of Dhan's raw 18-Sep candle OI,
  to the unit and the minute.
- **P9 live:** 488/488 candles (1m / 5m / 15m, NIFTY 22-Sep) match Dhan on OHLC, volume and OI, and
  a second implementation of the colour rule gives the same blue/yellow on every one.
- **Bug fixed:** replay and live no longer share `peak-oi.json`, `iv-baseline.json` and
  `scan-oi.json`. Replay writes `*.replay.json`. Verified: a replay server on 8790 wrote only the
  `.replay` files, and the live files' mtimes did not change.
- Branch `p12b-live-drive` (stacked on `p17-live-deploy`), 2 commits plus this handoff, pushed.

## Files changed
- `src/server/peakoi.ts`, `src/server/poller.ts`, `src/server/scanner.ts`: cache file name chosen by
  `isReplay()`, so synthetic values can never become a live session's cached truth.
- `docs/spec/dhan-api-contract.md`: live-measured facts. LTT is IST wall-clock as an epoch.
  385 one-minute candles per session (15:30–15:39 included). `NSE_EQ` `net_change` is 0 after the
  close while `NSE_FNO` keeps the previous close. On a shut market, `oi_day_high` = the last
  session's peak.
- `docs/PHASES.md`: P12b row, P19 row (new user request), Now / Next 3 rewritten.
- `CLAUDE.md`: the "replay and live must never share a persisted cache" rule.
- `.cache/p12b-peak.ts`, `.cache/p12b-candles.ts`, `.cache/p12b-feed.ts` (gitignored): the
  re-runnable verification scripts.

## Decisions made
- Split the caches per mode instead of tagging entries: three one-line changes, and no migration.
- Left the synthetic 16-Sep rows in the live cache files. Live never reads a past date's key, and
  the 7-day prune removes them.
- Did **not** change P9's rule, although every live blue fires between 09:15 and 09:35. That is a
  spec change, and the user decides it.

## Known broken / deliberately skipped
- **P8 live and P8's AC5.** Not run: `/api/scan?source=dhan` returns 409 on a shut session, and it
  is Saturday.
- **Unknown: does `NSE_EQ` `net_change` still read 0 at 09:20?** If Dhan has not reset the
  previous-day figures by then, the Dhan-source scan scores every stock 0%. Check it on Monday.
- **The live server on 8787 (PID 32412) still runs build `60e85b0`.** It predates the login gate and
  the cache split. Harmless until a replay server also runs; restart it deliberately.
- **P9 opening-candle bias.** `median20` at 09:15 reaches into yesterday's quiet tail, so the open
  nearly always fires. The recommendation is a within-session median. Waiting on the user.
- P18 (public URL), `gh secret set NTFY_TOPIC`, the Telegram bot, the PR merges: all still the
  user's.

## New user request (2026-09-19) — next session's build item
> "I need candles in the UI, the same candles, red and green."

Recorded as **P19**. The likely reading is the main (underlying/spot) chart drawn as green/red
OHLC candlesticks instead of the tick line. P9's option chart already has them. Not specified:
which chart, which intervals, the data source (`/v2/charts/intraday` on the underlying, or built
from feed ticks), and how it coexists with P6's drawings and P9's option mode. **Run `spec-lock`
first. Do not guess.**

## Next session starts here
- Phase P19: red/green candlestick chart in the UI, specified with `spec-lock` before any code.
  If it is Mon 21 Sep between 09:15 and 09:30 IST, do the market-open checks first (PHASES
  Next 3 #2).
- First command: `git worktree list; netstat -ano | grep LISTEN | grep ':87'; npm run check`
- Watch out for: the stale live server on 8787 (build `60e85b0`). Confirm `/api/health`'s
  `build` before trusting any number, and kill it only by its PID, never `//IM node.exe`.
