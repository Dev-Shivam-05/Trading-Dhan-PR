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
