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

## 2026-08-28 — P8 and P9 boarded without locking their specs
Six voice recordings produced two systems: a 9:20 F&O stock scanner and option-candle colouring.
Feasibility was verified against the real master and the DhanHQ docs; the *numbers* were not, so
both rows say **spec NOT locked** and no code was written. The user's own rule is that a number,
colour or threshold that is not written down does not get invented, and these specs are mostly
thresholds. Fifteen open questions are listed in `docs/HANDOFF.md`.

Two of them are load-bearing rather than cosmetic:
- **P8** — if "top gainer/loser" is measured over the 210-stock F&O universe itself, then filter 1
  and filter 2 are the same filter and the scanner is 2 steps, not 3. The user's worked example
  ("maan lo 50 stock aaye") implies an external list instead. The answer changes the architecture.
- **P9** — the user gave both colours and both actions (blue -> buy, yellow -> sell) but never the
  condition that separates them. There is no defensible way to guess which side is which.

## 2026-08-28 — NSE OI Spurts will not be scraped server-side without an explicit decision
Two independent blockers, both verified: `nseindia.com` refuses connection from this machine
(HTTP 000, while example.com and dhanhq.co return 200 on the same run, with a browser UA and a
cookie bootstrap attempted), and the OI Spurts page publishes only the **top 25** underlyings by OI
change — so a stock that passes the first two filters but sits outside NSE's top 25 has no row to
read, and the third filter cannot be evaluated for it at all.

The alternative is to compute OI change % from Dhan for all 210 stocks: today's futures OI from
`/v2/marketfeed/quote` (`oi`) against yesterday's closing OI from `/v2/charts/historical`
(`"oi": true`) — the same "latest OI vs previous OI" NSE itself publishes, with no scraping and no
top-25 cap. This was **presented, not adopted**: the user asked for NSE Spurt by name, and swapping
a named data source for a computed equivalent is their call, not a detail to absorb quietly.


## 2026-08-31 — Chart drawings are stored as (time, price), never as pixels
P6's whole "done when" — a trendline survives an instrument switch, a reload and a scale drag —
is a storage decision, not a rendering one. A shape stores `{t: epochMs, p: price}` and its screen
position is re-derived every frame through the same `X()`/`Y()` the price line uses. That transform
was moved into `public/chart-tools.js` and `drawChart()` now calls into it, so the line and the
drawings cannot disagree by construction. Measured after a zoom drag to 0.46x: every endpoint
within **0.048px** of the recomputed anchor. Storing pixels would have required a migration on
every range switch and would still have drifted.

## 2026-08-31 — A frame-time budget is stated as p95, never as max
`chart-tools-v1.md` AC8 originally read "drawChart stays under 8ms measured over 100 frames",
meaning max. Profiling showed that is unreachable with **zero** drawings on the page: 0 shapes,
120-frame samples at 1440x900, gives p50 2.40 / p95 4.50 / **max 6.40 ms**, and a 21-node page
spikes to 13.3 ms. Those spikes are GC, not paint. The row was amended to **p95 under 8ms** with
the user's approval rather than quietly relaxed, and the measurements are recorded in the spec
next to the criterion. Any future performance criterion in this project gets stated the same way.

## 2026-08-31 — Two drawing optimisations came out of that measurement, not out of taste
The profiling that exposed AC8 also located the real costs, so both fixes are load-bearing rather
than speculative. One `<path>` per style instead of one node per shape turns the 200-shape cap
from 200 svg nodes per frame into 3. Horizontal-line price pills are deduped at **18px** — the
pill's own height, already locked in rows 9 and 14 — because a pill within 18px of another was
completely hidden behind it; 50 levels now draw 8 pills instead of 50, i.e. 16 nodes instead of
100. Result at the cap: **p50 1.70 / p95 2.70 / max 7.40 ms**, faster than the old zero-shape
baseline. The 18px is not a new invented number, which is why it was acceptable as an amendment.

## 2026-08-31 — Off-plot live-price marker is dropped, its pill is pinned
Not in the approved table; added during the build and reported. At `zoom < 1` the view is narrower
than the data, so the live price can sit outside the plot, and the chart svg is `overflow:visible`
— it would paint over the header. The dot and its dashed rule are now omitted when off-plot while
the price pill sticks to the nearest edge. Rationale: on a trading screen a marker drawn at a
price it is not at is worse than no marker, but the number itself must stay readable. Six lines in
`public/app.js`; change it if you would rather clamp the dot too.
