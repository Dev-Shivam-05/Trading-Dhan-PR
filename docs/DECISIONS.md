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

## 2026-08-31 — "Top gainer/loser" is the F&O universe's own top 50 a side, not an external list
This supersedes the 2026-08-28 entry that left the question open as architecture-changing. It is
still architecture-changing; it is now answered. The scanner ranks all 210 F&O stocks by % change
against previous close and keeps the **top 50 gainers and top 50 losers**, then applies the 2% and
7% filters to those 100. Three reasons, none of them taste: DhanHQ v2 has no gainer/loser endpoint,
`nseindia.com` refuses connection from this machine and publishes only its top 25 anyway, so an
external list cannot be sourced even if it were wanted; and the user's own worked example was
"maan lo 50 stock aaye", which is where the 50 comes from rather than from a round number. Keeping
50 a side also preserves the user's three-step mental model instead of collapsing filters 1 and 2,
while costing nothing — the ranking is a local sort over a payload already in hand.
Consequence: the scanner can never surface a stock outside the F&O universe. That is correct for
this tool, since every downstream action needs an option chain to trade.

## 2026-08-31 — Blue means entering, yellow means exiting, and the spec says so out loud
The 2026-08-28 entry refused to guess which colour meant buy, on the grounds that a wrong signal on
a trading screen is the one failure this project will not ship. That still holds, and the answer is
not a guess: the board's own sentence for P9 is "so a big player **entering or exiting** a strike is
visible", and the user gave blue -> buy, yellow -> sell. Entering a strike is the buy side, exiting
is the sell side, so `dOI > 0` is blue and `dOI < 0` is yellow. It is a reading of intent rather
than a measurement, which is why `option-candles-v1.md` row 8 names itself as the row to revisit
first if the screen ever looks backwards — and why nothing else in that spec depends on the
direction. Flipping row 8 is a one-line change with no downstream effect.

## 2026-08-31 — The volume-vs-OI contradiction is resolved as AND, which is why it was resolvable
Rec 01 said volume triggers the colour, Rec 02 said OI. They are not alternatives to choose between:
open interest cannot change without trades, so `OR` degenerates into the OI test alone and Rec 01
stops meaning anything. Volume on its own is intraday churn — the precise opposite of a big player
taking a position. Requiring both keeps each recording's signal doing the job it is good at: volume
says something unusual happened, `dOI` says whether it was accumulation or unwinding. "Vibration",
which was never defined in any of the six recordings, is now bound to exactly one number — the
volume test, `vol >= 3.0 x median(previous 20 candles)` — and is in `GLOSSARY.md` so it cannot be
redefined later.

## 2026-08-31 — Two build prerequisites found while writing the specs, not while building
Both are one-line changes that a session could otherwise lose an hour to. `KEEP_INSTRUMENTS` in
`src/server/master.ts` does not include `FUTSTK`, so stock futures are dropped at parse time and
stock OI is simply unreachable — P8's entire third filter depends on adding it, which is why it is
row 3 of the spec rather than a note. And both new client files need their row in the `STATIC`
allow-list in `src/server/index.ts`; without it the module 404s and the failure presents as the
whole client dying, not as a missing file. Writing the spec against the real code is what surfaced
them; neither is visible from the requirements alone.

## 2026-08-31 — P10 (terminal UI redesign) is boarded last and stays unlocked until its turn
The user asked for a total TradingView-style rebuild of the screen — the option chain as one
scrollable table showing the whole strike list, and the latency data presented some different way —
and in the same breath said it runs **after** the recording-derived phases, not before. That
ordering is recorded as an instruction, not as a preference, because it is the difference between
a redesign that has P7/P8/P9's columns and panels to design around and one that has to be reopened
three times to make room for them.
The spec is deliberately **not** locked now, for a reason beyond the standing "no undefined
adjectives" rule: a spec locked today would be written against a screen that is about to grow a
peak-OI column, a scanner overlay and an option-candle chart mode. Locking it early guarantees
churn. The three things that must become numbers before any UI file is touched: what
"TradingView-like" fixes (row height, column set, pane behaviour, what stays pinned), what the
latency panel's new form actually is, and how the existing P2-P6 acceptance criteria are re-proved
against a rebuilt screen rather than quietly dropped.
The row also carries `~12` files against the 8-file rule, so it splits into P10a / P10b at
spec-lock time. That is recorded now so a future session does not absorb it in one go.

## 2026-08-31 — "Yesterday" is read off the candle data, never off a calendar
P7 needs the previous **trading** session. `today - 1` is wrong every Monday and every exchange
holiday, and a hardcoded holiday table is wrong the first time the exchange changes one. So the
date is derived from the data: request the last 7 calendar days of candles, bucket the timestamps
into IST dates, and take the latest one strictly before today. Seven days covers a two-day holiday
plus a weekend. One call on the **underlying** settles it per instrument per day and every contract
call for that instrument reuses the answer, because the trading calendar is a property of the
exchange, not of the contract.
The same reasoning fixes the other end: the fetch window runs `fromDate = that date, toDate = today`,
so today's candles arrive too and are **discarded** by date. The peak must mean "yesterday's
high-water mark"; letting today leak in would compare a number against itself.

## 2026-08-31 — One rate-gate key for the whole peak backfill
`waitForSlot` in `dhan.ts` gates **per key**. The obvious `peak:<securityId>` would have given
every one of the 82 contracts its own gate, so all 82 would have dispatched simultaneously and
tripped the 1 req/s quote limit on the first snapshot. They all share `peak:oi` instead, which
makes the backfill strictly serial at 1 req/s and leaves the chain poll's own 3 s key untouched.
This is the same pattern `scanner-v1.md` row 4 locked for P8, and P8 will reuse this fetcher.

## 2026-08-31 — A progressive column needs a push, not just a poll
Discovered by testing rather than by reading: on a **closed market** the poller takes one snapshot
and then only re-checks the session every 60 s — it never emits again. Since the peaks ride the
snapshot, the column would have stayed empty until the next trading day for anyone opening the app
after 15:30, which is most of the time this project is actually used. The store now notifies as
each contract lands and the poller re-emits its last snapshot with the new peaks, throttled to
750 ms. During a live session the 3 s poll would have carried them anyway, so this costs nothing
where it is not needed.

## 2026-08-31 — Replay must synthesise the candle series, not the peak
P7's whole acceptance criterion is "the peak equals the hand-computed max of that day's candle OI".
Had replay handed the peak over directly, that criterion would have tested nothing — it would have
compared an asserted number to itself. Replay generates the full parallel-array payload instead,
shaped so its maximum over the previous session lands on exactly one candle, and the peak comes out
of the **same `max()`** the live path uses. Today's replay candles deliberately carry 1.4x the peak,
so a reader that ever stops discarding them inflates every peak by 40% and the seeded breaches
vanish — a loud failure rather than a quiet one.

## 2026-08-31 — Replay OI is a position count, so it may not teleport
The P5 replay feed drew `1e5 + random*4e6` fresh for **every contract on every tick**: a strike's
open interest jumped between 1 L and 41 L ten times a second with no relation to the OI the chain
reported for that same strike. Nothing had ever compared OI against anything, so it was invisible
for four phases. P7's `Pk %` is exactly that comparison, and against a random number it is noise —
24 of 82 cells showed a false breach at ratios up to 2358%.
Fixed at both ends: the tick feed seeds each contract's OI from the snapshot and random-walks it
±0.2%, and the chain's own drift changed from a flat `+900/poll` to `+0.025%/poll of that
contract's OI`. The flat version added the same absolute size to a 24 K wing strike as to a 3 M ATM
strike, so wings grew ~4% per poll and crossed any fixed peak within minutes. This cost two files
outside P7's plan and took the phase to nine code files, one over the guideline — taken knowingly,
because without it P7's acceptance criteria could not be measured in the only mode available.

## 2026-09-01 — A cash row is only the share if `SERIES = 'EQ'`
The scanner needs each F&O stock's NSE_EQ security id, and the obvious lookup — the master row with
`INSTRUMENT = EQUITY` and that `UNDERLYING_SYMBOL` — is wrong for two of the 210. `CHOLAFIN` and
`MOTHERSON` each also list an **NCD** under the same symbol with the same instrument type
(`INSTRUMENT_TYPE = DEB`, `SERIES = D1`). Whichever row the scan happened to hit first would have
supplied a debenture's last traded price and net change as the stock's, and the stock would have
been ranked, filtered and printed on that number with nothing on screen to suggest it was wrong.
`MasterRow` grew a `series` field and `fnoUniverse()` requires `SERIES = 'EQ'`. Verified: with the
filter, all 210 resolve to exactly one cash row; without it, two resolve to two.
A number that is silently wrong is worse than a visible error, and this is what that looks like in
practice — it took reading the actual master rows, not the API docs, to find.

## 2026-09-01 — The scanner is verified by a second implementation, not by its own output
`scanner.ts` computing 6 survivors and a test asserting it computed 6 survivors proves only that
the code is deterministic. So P8's acceptance test is a **separate implementation** of the whole
funnel (`.cache/recompute-scan.ts`) that reads the same replay payload, does its own sort, its own
top-50 cut, its own two thresholds and its own candle reducer, and never imports `scanner.ts`. It
agrees on all ten comparisons including both candidate lists by name.
The replay seeding is built the same way round: nothing tells the scanner who passes. Every stock
gets a % change from the same hash the rest of replay uses, and the six are designated **by rank in
the sorted list**, not by name — so the scanner still has to sort all 210 correctly to find them.
Same principle as P7 synthesising a candle series instead of a peak.

## 2026-09-01 — A seeded replay must make every filter reject something
The first working version of P8's replay spread % change uniformly over +/-6%. Every one of the top
50 therefore cleared the 2% threshold, the funnel read `210 -> 100 -> 100 -> 6`, and filter 2 was
never once exercised as a rejector — a bug in that threshold would have passed the acceptance test.
The distribution is now squared (`sign(v) * 5 * v^2`), which puts most stocks inside +/-1% the way a
real session does and cuts the bottom ~13 of the ranked 100. The funnel reads `210 -> 100 -> 87 -> 6`
and all three filters do work.
**A seeded fixture that only exercises the last stage of a pipeline tests the last stage of a
pipeline.** Check the intermediate counts, not just the final one.

## 2026-09-01 — AC5 is reported unverified rather than quietly passed
P8's fifth criterion is that the chain poll's minimum gap stays at or above 3000 ms across a full
scan. It cannot be measured here for two independent reasons: on a closed market `ChainPoller`
takes one snapshot and then only re-checks every 60 s, so there are no two consecutive polls to
measure a gap between; and **replay makes no `dhanPost` calls at all**, so the rate gate — the
mechanism by which a scan could starve the poll — is not exercised in this mode even with the
market open. A test that returned `n/a` and was scored as a pass would have been the worst of the
three options.
What was measured instead is the two things that would have to hold anyway: a static read of
`scanner.ts` confirming it only ever uses `scan:quote` / `scan:oi` and never a `chain:` key, and
`/api/scan/status` probed every 100 ms throughout a cold scan (p50 17.0 / p95 17.9 / max 18.0 ms),
which rules out the scan blocking the event loop. The criterion itself stays open until the market
is open with a live plan.


## 2026-09-01 — The option chart is a second `<svg>`, not a second module in `drawChart()`
P9 needed a candlestick renderer where P2-P6's tick line already lives. Folding it into app.js's
`drawChart()` would have put a whole second renderer inside a function four phases already depend
on; importing `candles.js` from app.js would have made an ESM cycle, because `candles.js` imports
app.js's number formatters the way `scan.js` does.
So `candles.js` owns its own `<svg>` layered inside the same `.chart-body`, and the two never run
at once: `body.optmode` decides which is on screen, `drawChart()` returns early when it is set, and
three `CustomEvent`s carry everything else (`chain-scope` and `chain-render` out of app.js,
`optmode` back in). app.js still imports nothing downstream of itself.
The cost is that both display toggles need `!important`, because `.chart-empty` and
`.chart-body svg` set their own `display` — the same rule that kept P8's scanner panel on screen.

## 2026-09-01 — `now` is injected, so "never colour the forming candle" is testable
Row 11 says the in-progress candle is never blue or yellow. Read off `Date.now()`, that branch is
unreachable in the only mode this project can run: the market is shut for almost every session, so
no seeded candle is ever "still forming" and AC4 would be vacuous rather than passing.
`colourCandles()` therefore takes `nowMs`. Live it is the wall clock. In replay it is the last
seeded candle's open + 1 s, so exactly one candle is forming and the branch is exercised. This is
the same deviation, for the same reason, as `scanner-v1.md` row 20 enabling the Scan button in
replay — and it is recorded as an amendment row (21), not left implicit.

## 2026-09-01 — The fixture's volume spike is a multiple of the band, not of the median
The seeded replay day has to make exactly 3 candles blue and 2 yellow *through the production
rule*, which computes its own 20-candle median. The obvious fixture — set the spike to
`3.4 x median(previous 20)` — would have had the fixture compute the median the rule is being
tested on, so a bug in `medianOf()` would have been reproduced identically on both sides and the
test would have passed. The spike is instead `8 x` the top of the ordinary volume band (a fixed
240,000 against a 20,000-30,000 band), which clears `3.0 x` whatever median the rule arrives at,
with margin, and shares no arithmetic with it. Same principle as P7 synthesising a candle series
instead of a peak, and P8 designating survivors by rank instead of by name.

## 2026-09-01 — Only the latest session is drawn, and that had to become a spec row
Row 3 fetches 5 calendar days and row 12 explains why: so the session's 09:15 candle already has
20 predecessors. Row 18 then speaks of "a 75-candle 5-min day". Nothing said which of the five
days is on screen. Drawing all of them would put 375 candles on a 5-minute chart and make row 18's
count ambiguous; drawing one and computing the rule over five is what both rows imply.
It is now row 20 rather than an implementation choice, because a future session rebuilding from
the spec would otherwise have a coin flip to make, and the acceptance criterion depends on the
answer.

## 2026-09-01 — P10's spec is written but NOT locked; the table was emitted and no `go` came back
The session's whole output is `docs/spec/terminal-redesign-v1.md`, 22 rows, marked **PROPOSED, NOT
LOCKED** in its own first line. That status is deliberate and is not a formality: the spec-lock
rule is one approval, and the approval did not arrive. A file that says "locked" when nobody
approved it is worse than no file, because the next session builds from it without asking.
No `src/` and no `public/` file was touched.

## 2026-09-01 — "TradingView-like" is resolved as exactly five facts, not as a style
Row 1 of the proposal fixes the phrase to: a resizable multi-pane shell, zero-gap 1px-seamed pane
chrome, a strike spine pinned so it cannot scroll out of view, a default column set that fits
1440px without horizontal scroll, and dark as the default theme. Everything else a person might
mean by the phrase is either already built here (drawing tools, a chart strip, a replay banner) or
is listed under out-of-scope. The point of enumerating it is that each of the five is a pass/fail
measurement, and none of them is a screenshot compared against taste.

## 2026-09-01 — The latency panel's new form is a bottom rail plus a closed drawer, not a narrower dock
The P10 done-when says the latency numbers must be readable "without giving up chain width", and a
right-hand dock is the one shape that cannot satisfy that at any width — the chain is 1484px wide
on a 1440px screen before the dock takes its 380. So the dock is deleted. The three P3 big numbers
and the two P5 feed numbers move to an always-on 26px status rail, which costs zero width; the
waterfall, sparkline, percentiles and 20-row call log move to a drawer that is closed by default
and takes height, not width, when opened. Same data, different form, and the criterion becomes a
pixel comparison of `#gridScroll.clientWidth` rather than a judgement.

## 2026-09-01 — The sticky strike spine needs `left:0` AND `right:0`, and the reason is geometry
The obvious implementation, `position:sticky;left:0`, does nothing on this screen. The spine is
column 13 of 25 and sits at x≈696; the horizontal overflow at 1440px is 44px, so the cell would
need about 700px of scroll before it ever pinned. Symmetric offsets (`left:0;right:0`) pin it in
both directions and only conflict if the scrollport is narrower than the 92px cell, which is far
below the 1024px floor. The spine already paints `--bg-inset` and the table already sets
`border-collapse:separate`, so the whole row is two declarations — but it is two declarations that
are wrong in the obvious form, which is why it is a spec row and not an implementation detail.

## 2026-09-01 — P10a leaves the right dock alone so the split has no rework in it
The phase splits at 5 code files each. The tempting cut is "shell in P10a, polish in P10b", which
would have P10a build a pane system around a dock that P10b then deletes. Instead P10a builds the
shell and the chain and leaves `.lat` working exactly as it is inside it, and P10b deletes the dock
and adds the rail and drawer. Each sub-phase is independently shippable and verifiable, and nothing
built in P10a is thrown away in P10b.

## 2026-09-03 — Rows 7 and 11 were put up for veto in isolation, and that is why P10 could be built
The spec had been sitting unlocked because two of its 22 rows were readings rather than
measurements: greeks hidden by default, and dark as the default theme. Neither is a fact about the
codebase; both are one flag. Emitting them as a single either/or question with the exact
consequence of each ("17 columns / 1132px, fits 1440px with zero scroll" against "25 / 1484px, 44px
of horizontal scroll stays") turned an open-ended approval into one word. Both were accepted as
written. The general lesson is the one the spec-lock skill already encodes: the blocking part of a
spec is never the whole table, it is the two or three rows that cannot be derived from the code.

## 2026-09-03 — Where row 13 and the out-of-scope list contradicted each other, row 15's reason won
Row 13 lists the conn dot, the mode badge and the clock as rail contents; the out-of-scope list
forbids any topbar change beyond removing `#latMini`. Both cannot hold. The tie-break came from
row 15's own stated reason — "two places showing the same number is how they come to disagree" —
so the three readouts were MOVED into the rail rather than duplicated, ids unchanged. Recorded as
amendment row 25 rather than done silently, because a future reader would otherwise find a topbar
change that the spec appears to forbid.

## 2026-09-03 — Row 4's three pane minimums are impossible together, so they are ranked
Chart 70, drawer 140, chain 200. At 1024x800 the chrome wraps taller and the shell has about 483px
for what needs 480 before the 5px splitter — the constraint set is infeasible, and the first build
resolved it by silently crushing the chain to 59px. It is now an explicit ranking: the chart yields
first to its own floor, then the drawer compresses to a hard floor of 88 with each column
scrolling, and the chain's 200px is never broken. On a trading screen the chain is the product and
the drawer is diagnostics. Recorded as amendment row 26. The general form: when a spec states
several minimums, it has also implicitly stated a priority order, and the build should make that
order explicit rather than discover it.

## 2026-09-03 — `feed.ts` reconnects instead of unsubscribing, because the codes are not written down
Dhan is never told to unsubscribe, so its side of the socket only ever grows toward the documented
5,000-per-connection cap — and the failure is backwards: the old contracts keep streaming while the
new ones are refused, so the grid goes quiet while the feed still reports healthy. The direct fix
is an unsubscribe request, but those request codes are not in `docs/spec/dhan-api-contract.md`.
Inventing them is precisely the guess this project's second operating rule forbids, so the socket
is dropped and rebuilt when the wanted set shrinks: correct by construction, one reconnect per chip
switch, and no invented protocol. If the codes are ever documented, this becomes a one-line change.

## 2026-09-03 — The audit was boarded as its own phase rather than absorbed into P10
Sixteen findings across `src/server/` and `public/` is 12 code files against a ~8-file rule. Folding
them into P10b would have made that phase unreviewable and would have mixed "the redesign works"
with "these sixteen things were already wrong". P11 is its own row with its own done-when, and its
done-when is not "the bugs are fixed" but "every finding has a script that fails before the fix and
passes after" — which is what made it possible to prove that fixing the candle rule did not
regress the candle P9 had hand-checked.

## 2026-09-03 — A self-check that cannot fail is worse than no self-check
`scanner.ts` reported `reconciles: true` on every run. It was computed by subtracting the same
totals it then compared, so it collapsed to `universe.length` algebraically and would have reported
true even if the scoring loop had double-counted or dropped a stock — the one thing scanner-v1
row 14 exists to catch. It had been green through P8's entire verification. The rule this leaves:
a check whose inputs are derived from its own expected answer is decoration. Count at the point of
rejection, then compare against something computed independently.
