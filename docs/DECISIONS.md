# DECISIONS

Append-only. Newest at the bottom. Never rewrite an entry — supersede it with a new one.

## 2026-08-28 — Verification screenshots never go through `npm run shots`
`npm run shots` writes into `docs/shots/`, which holds 17 committed reference images from P2-P5.
Running it for an ad-hoc check silently rewrites all of them and produces a diff nobody asked for.
Ad-hoc UI verification uses a throwaway Playwright script in `.cache/` (gitignored) writing to the
session scratchpad. `npm run shots` is reserved for deliberately re-baselining the reference set.

## 2026-08-28 — Peak-OI must be recorded from the tick feed, not the 3 s chain poll
Dhan's option chain gives `previous_oi` = yesterday's **close**. Yesterday's intraday **peak** OI is
not available from any Dhan endpoint, so it has to be self-recorded. It will be recorded from the
WebSocket tick stream (`src/server/feed.ts`, `PACKET.OI`, code 5), not from the 3 s REST snapshot:
a 3-second sample of a running maximum systematically under-reports the true high, and a peak that
is wrong-low is worse than no peak at all because it produces false "breakout" flags.
Consequence accepted: the peak only exists for days the app was actually running. Day one shows
nothing. This is a property of the data, not a bug to design around.

## 2026-08-28 — P7 deferred to its own session rather than absorbed
Peak-OI tracking touches the poller, the feed, a new persistence file, the SSE payload, the grid
column set and the filter bar — past the ~8 file limit for one phase. Boarded as P7.

## 2026-08-28 (later) — SUPERSEDES "Peak-OI must be recorded from the tick feed"
The earlier entry today claimed no Dhan endpoint exposes yesterday's intraday peak OI, so it had
to be self-recorded and P7 could not show anything on its first day. **That was wrong**, and it was
wrong in the direction that costs the most: it would have had us build a recorder for data Dhan
already serves.

Verified against the DhanHQ v2 docs: `POST /v2/charts/intraday` accepts `exchangeSegment: NSE_FNO`
with `instrument: OPTSTK` / `OPTIDX` / `FUTSTK`, takes `"oi": true`, and returns `open_interest`
per candle at 1/5/15/25/60-minute intervals for up to 90 days. Yesterday's peak OI is therefore
`max(open_interest)` over yesterday's candles, and 90 days of history can be back-filled on
first run.

Still true from the earlier entry: `previous_oi` on the option chain is yesterday's *close*, not
its peak, so it is the wrong field for this. Still open: whether Dhan really retains 90 days of
per-candle OI for option contracts, and how expired contracts behave (separate "Expired Options
Data" API). Both are one API call to settle once the Data API plan is active - settle them before
building P7.
