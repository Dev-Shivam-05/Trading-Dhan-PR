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

## 2026-09-17 — A `go` on a blocked phase builds its credential-free half and leaves it blocked
P12's every done-when needs a live plan, and the token was still the one that expired 2026-08-28.
Stopping would have wasted the session; marking P12 done would have been false. The work that needs
no credentials — a probe that turns the live questions into one command, and the endpoint write-ups
the contract doc was missing — was built and verified offline, and the board still reads `blocked`.

## 2026-09-17 — The intraday date format is settled by a live call, not by the docs
Dhan's docs show `fromDate`/`toDate` as `YYYY-MM-DD HH:MM:SS`; `fetchIntraday()` sends date-only.
The docs do not say date-only is rejected, and a guessed time-of-day bound (09:15? 15:30? MCX runs
to 23:30) would be an invented value. So the code is unchanged, and `live:probe` sends the app's form
first and the documented form only on `DH-905` — one call decides it, with the raw body kept.

## 2026-09-17 — The probe's hand checks share no date code with the app
P7's peak, P8's closing OI and the previous session are recomputed with `Intl` in `Asia/Kolkata` and
a digit-count unit test, not `istParts()`'s `+05:30` arithmetic and `>1e11` threshold. A second
implementation that imports the first cannot catch a bug in it — the same rule as the P8/P9
independent re-implementations.

## 2026-09-17 — The scanner reads NSE, because that is what the user named and it is reachable
The 14-09 recordings restate P8 and name the source outright: "NSE spurt". The 2026-08-28 refusal
rested on two facts — NSE unreachable, OI Spurts capped at 25 — and both fell to one measurement
with a headed Chrome. With Dhan access dead, NSE is also the only source that works today. P8 is not
removed: it stays behind Source `Dhan`, untouched, for the day the plan is active.

## 2026-09-17 — "Top 20" means the top 20 of the F&O stocks, not of the whole market
The pasted analysis of the second recording says "poore market (5000+) ke Top 20 … cross-match";
the transcript it summarises says "poore market ke top gainer loser nahi chahiye … 250 mein se kon".
The transcript is the source, and measurement agreed with it: the whole-market top 20 gainers on
17-Sep were all 20–38% movers and contained **zero** F&O stocks, so that reading returns an empty
list on an ordinary day.

## 2026-09-17 — OI filter is rising OI only for the NSE source
"equal to 7 or greater than 7", said twice, with the recording's own gloss that new positions are
being built. P8 locked `abs(oiPct) >= 7` for Dhan with a short-covering argument; that row is not
reopened for P8, but P14 follows the user's words. On 17-Sep the two rules give the same answer
(no F&O underlying fell 7% in OI), so the difference is untested on real data.

## 2026-09-17 — Changing N re-ranks the same fetch; Run re-fetches
Comparing 20 / 25 / 30 is only meaningful on identical numbers, and every re-fetch costs NSE three
page loads. The header says `same fetch, re-ranked` so the two cannot be confused.

## 2026-09-17 — The phase is P14, and its branch is not stacked on P13
Another session built a card-layout P13 in a second worktree the same evening. This work was renamed
rather than rebased: that branch rewrites the very `index.html` / `app.css` blocks this phase
touches, it was still being worked on, and rebasing onto a moving branch would have mixed two
unmerged phases into one verification. The conflict is left for the merge, described in HANDOFF.

## 2026-09-19 — Replay and live keep separate cache files (P12b)
`peak-oi.json`, `iv-baseline.json` and `scan-oi.json` are now `*.replay.json` under `REPLAY=1`.
The other option was a mode tag inside each entry, which needs a migration and a check in every
reader. A file split cannot be forgotten by a future reader. The synthetic rows already in the live
files are left in place: they are keyed by past dates that live never reads, and the 7-day prune
removes them.

## 2026-09-19 — P9's opening-candle bias is recorded, not fixed
Live, every blue candle fired between 09:15 and 09:35, because `median20` at the open includes
yesterday's quiet tail. Making the median session-only changes `option-candles-v1.md`, so it waits
for the user's yes.

## 2026-09-19 — Underlying candles come from intraday history, not from ticks (P19)
The strip's candles are `/v2/charts/intraday` on the underlying (5-day window, latest session
drawn), with feed ticks only updating the forming candle. Built from ticks alone, the chart would
be empty whenever the market is shut, which is when almost all work on this project happens. The
earlier days in the window feed the SMAs, so SMA 20/50 already exist at 09:15.

## 2026-09-19 — Chart Style is for the underlying chart only (P19)
Up / down / background choices never reach P9's option candles. A user who picks Blue for "up"
would otherwise see blue option candles that read as "big player entering". Custom backgrounds
reuse the existing theme token sets (picked by luminance) rather than adding new text colours; the
existing `#7A8597` already clears 4.5:1 on every dark swatch.

## 2026-09-19 — The strike window is UI-only (P20)
The grid renders ATM ± 8, but the server still polls and subscribes the whole chain. P7's backfill
already goes nearest-ATM first, so the 34 visible contracts get their peaks first anyway. Trimming
the server would make the feed subscriptions follow the ATM, which is more moving parts for no
visible gain. The strike search still reaches the whole chain, because it is an explicit lookup.

## 2026-09-19 — Superseded checks are rewritten, never dropped (P20)
The user reversed four earlier invariants (all strikes rendered, the chip hidden when unfiltered,
at least 19 visible rows, an option click taking over the strip). Each old check was rewritten in a
`-p20` copy to assert the new rule, so the property is still being measured.

## 2026-09-19 — The previous close comes from daily candles, not from marketfeed (P21)
Once the session is over, Dhan's `/v2/marketfeed/ohlc` `close` is that day's own close and
`quote.net_change` is 0, so the header read +0.00. The reference is now the `/v2/charts/historical`
daily close of the session before the one the intraday payload ends on. The session is read off
the data rather than off a weekday table, because there is no holiday list and MCX traded on a day
NSE did not. Matches TradingView to the paisa on all five NSE chips.

## 2026-09-19 — One font, and text never clipped: the grid scrolls instead (P22)
Geist Mono was replaced by Inter with tabular figures, and the chain went from a fixed layout to
`table-layout:auto`. The trade-off was priced before building: with Greeks on the grid scrolls
270px at 1440 (it was 44px, with 277 cells cut off). A cut-off number on a trading screen is worse
than a scroll bar.

## 2026-09-19 — The strike window is anchored on the spot (P23)
The user gave both ends (NIFTY 23,346.40 → 22,950 … 23,700): 8 strikes strictly below the spot
and 8 at or above it, 16 rows. It replaces P20's ATM + 8 each side. A spot exactly on a strike
counts that strike as "above".

## 2026-09-20 — A collapsed chart says so (P24)
The collapse is persisted in `localStorage.chart`, and a stray `C` sets it, so the user read it as
"the chart is gone". The collapse itself stays (it is a feature). Collapsed, the toggle reads
"▸ Show chart" instead of a rotated 24px arrow.

## 2026-09-22 — TradingView-style navigation, and what "same as TradingView" was locked to (P25)
The request had two undefined terms. `docs/spec/chart-nav-v1.md` fixes them: wheel = time zoom
about the cursor at **0.85 per notch**, pinch (ctrl+wheel) the same with the page zoom suppressed,
shift/horizontal wheel and a plot drag = pan, alt+wheel and a wheel over the 76px gutter = price
zoom at 0.9, double-click or `0` = reset, and a `⟩` button appears the moment the view leaves its
default. The price scale **auto-fits to the candles inside the window**, because a zoom that keeps
the whole session's range is decorative. The option window gets the same gestures in **index**
space, since P9 draws option candles indexed so a halt cannot stretch a bar. The window is never
persisted: a time range in yesterday's epoch ms, restored onto today's candles, is an empty chart.

## 2026-09-22 — The spot comes from a quote of the underlying, not from the chain payload (P25)
Dhan's `/v2/optionchain` carries its own `last_price`. On **MCX that number is hours old** while
the rest of the payload is live — measured with the session open: GOLD's chain returned 151,879
twice 45 s apart (a 13:20–14:05 print) while `/v2/marketfeed/quote` on the same securityId
returned 152,396, and 57 of 174 strikes moved LTP/IV/OI across two calls 70 s apart. The header's
change is `spot − prevClose`, so a frozen spot against a real close printed −1,215 (−0.79%) where
the truth was −798 (−0.52%). The spot is now the quote of the underlying securityId and `derive()`
measures the **ATM against it too**, or the spot marker sits four rows from the ATM row. The quote
is refreshed without blocking the poll, so the 3 s chain cadence is untouched; the first snapshot
after a subscribe still reads the chain payload and `spotSource` says so on the wire and in the
header's tooltip. This supersedes the board's "GOLD mixes two contracts" — it does not.

## 2026-09-22 — A shut session may not grow a candle (P25 amendment 21)
`ucandles.onTick()` used to merge or open a candle from any tick on the session's own date. In
replay the feed keeps ticking after 15:30, so at 21:15 the chart held one bar **5 h 50 min** after
the 15:25 close with an empty 21,000,000 ms stretch in front of it — while `/api/ucandles` had
returned 76 clean candles. The client drew the gap. The **server** decides the session is open
now; a tick past the last candle on a shut session asks it (one throttled refresh) instead of
inventing a bar. Verified live on the open MCX session that this does not block a real one.

## 2026-09-22 — The LTP Calculator rests on one undisclosed primitive (P28)
The 133-video corpus in `LTP-CALCULATOR/` was read in full (127 V1 files + 35 V2 files) and
reconstructed in `LTP-CALCULATOR/ANALYSIS/`. The finding that decides whether the section can be
built at all: **every level the product draws is a selection of one number, the reversal price, per
strike per side.** Extensions, divergences, EOR+-n/EOS+-n, the four 9:20 lines, the eight AI lines,
Max Pain, Max Gain, the weekly and monthly range bands and the LTP Swing HOI reversals are all that
same number chosen from a different strike. Around twenty files state it is "derived from the Option
Greeks"; V124 lists the manual prototype's exact inputs (spot, call LTP, put LTP, delta, theta, vega,
gamma), V111 adds rho, implied volatility and futures, and V18 gives the only theory -- that a
writer commits hardest where time value peaks, and that peak is the reversal price. **No file gives
the formula.** Recorded as OQ-1 and treated as a blocker rather than guessed at, because a wrong
approximation would be invisible: it produces plausible levels that are quietly wrong, which is the
one failure mode this project's verification bar exists to prevent.

## 2026-09-22 — KEY-POINTS-V2 is a second pass, not new material, and neither folder wins (P28)
`LTP-CALCULATOR/KEY-POINTS-V2/` arrived mid-session and looks like new videos. It is not: all 35 of
its files are videos already in `KEY-POINTS/`, rebuilt from **English translations** of the same
transcripts instead of the Hindi ASR captions. Its own `INDEX.md` says so, and the other 92 videos
were already English and were not redone. The decision was to keep both and cite both rather than
replace V1. V2 is cleaner on its 35 and resolved four open questions -- the free tier is delayed on
the **data feed** while the charts are live (OQ-24); Nifty's weekly expiry **moved from Thursday to
Tuesday**, which explains three "contradictory" range-generation days (OQ-25); the stock lines carry
**per-line** Max Pain and Max Gain, not shared ones (OQ-28); and LTP Swing's bearish branch wants a
**breakout**, not a breakdown (OQ-31). But V2 also **loses** detail V1 kept (the five-shade yellow,
the "even if you personally did not take the trade" pairing clause, the deep-ITM hedge-strike
substitution) and **introduces one error of its own**: it flags support and resistance sitting on the
same strike as transcription damage, when the framework teaches that case explicitly as the
zero-divergence day. Both passes are summaries with their own failure modes; neither is ground truth.

## 2026-09-22 — `/api/health`'s `build` is HEAD at process start, not the code running (P28, cross-session)
Two sessions were misled by this in one night. `build` reads like a version stamp and is not one: a
server started at 21:38 reports the HEAD of 21:38 for its whole life, even when `src/server/*.ts`
files newer than that commit were already on disk and loaded at boot. `dhan-36` concluded from it
that two running servers predated the P27 fixes and was about to restart them; `dhan-93` pushed back
and the check was wrong. **To tell what a running server actually has, compare file mtimes against
the process start time, not `build` against HEAD.** And remember `src/server/index.ts` reads `public/`
from disk per request, so every running server already serves the current UI whatever `build` says.
The same shape of trap appeared twice: this session's start-of-conversation git snapshot said branch
`p26-panel-windows` while `git rev-parse` said `p25-chart-nav`. **Never trust a start-of-session
snapshot for a value that moves.**

## 2026-09-23 — P30: session state is re-derived per request, at the route
The registry is memoised at boot, so its `session` field was the state at boot. The fix is
`withLiveSession()` at `/api/health` and `/api/instruments`, not re-resolving the registry: that
would re-download the master and re-run the GOLD spike to refresh one clock-derived field. The
armed open-session runner now waits for a date as well as a time, and keeps re-checking a replay
or stopped server until 15:00 rather than exiting.

## 2026-09-23 — P31 setup: the live server starts the night before, not at the open
A replay server never renews the Dhan token, and `shouldRenew` refuses between 09:00 and 15:45.
With replay on 8787 overnight, the token expired at 05:43 IST, before the 09:36 armed run. So the
live server is started the evening before; on start it renewed to 19:25 IST the next day. The replay
server was killed by PID only after `ListAgents` showed no live peer session.

## 2026-09-23 — P32 boarded: auto trading is PAPER trading, operated from the UI
User's direction. No Dhan order endpoint is called; fills are simulated from the LTP the app already
streams. Strategy, exit, size, instruments and UI are unspecified and go through `spec-lock` first.
Replay and live keep separate ledgers (same rule as every other persisted cache here).

## 2026-09-23 — P32 spec locked: the recording's 9:20 list, traded as near-month futures
The only part of the strategy the user ever wrote down is the entry — the 14-Sep voice note's
three-filter list "for trade entry between 9:20 and 9:30". Exit (stop 1% / target 2% / 15:15),
instrument (the near-month future the scanner already measures OI on), size (1 lot, max 10) and the
60 s retry are GUESS rows the user accepted with one `go` and can veto one at a time. The trader
lives in the server, not the browser, so the 09:20 scan happens with no tab open; it rides the
existing feed under one reserved `feedWants` key and never polls REST.

## 2026-09-23 — Replay's Run now moves the paper engine's clock, not the rules
A Run now pressed at 21:00 would meet the 15:15 square-off in the same second. The alternative —
exempting replay positions from the clock rules — would have left the 09:30 and 15:15 branches
untested in replay. So the press is mapped to 09:20:00 IST and the offset is persisted in the replay
ledger (a restart must not jump the clock to 21:00). Live's offset is always 0; live has no Run now.

## 2026-09-23 — `L` is bound twice; left for the user rather than chosen here
The P32 regression sweep found p10b's drawer-drag check red (29/1). `app.js:729` binds `L` to the
telemetry drawer (terminal-redesign-v1) and P29's `ltp.js:290` binds the same key to the LTP
workspace, with no spec row giving it one. Both fire, the overlay covers the drawer grip. Choosing
which feature keeps `L` changes a documented shortcut, so it is the user's call; the check was not
loosened.

## 2026-09-23 — P33 replaces P32's entry and exit; P32's stop/target are gone
The user's two voice notes define the F&O strategy completely: range = the 09:15 and 09:20
five-minute candles; enter on a strict break (long list above the high, short list below the low);
exit on two consecutive completed closes against SMA9. P32's 1% stop / 2% target were GUESS rows
with no source, so they were removed rather than kept alongside (spec row 10). Risk recorded: there
is no price stop between candle closes; `change 10` adds the opposite side of the range as one.

## 2026-09-23 — Candles and fills come from the FUTURE, not the cash stock
The recordings say "the stock breaks". The range, SMA9 and fills are taken from the near-month
future's own candles and ticks so that every P&L is recomputable from one price series; mixing a
cash trigger with a futures fill would put the basis inside every number. Offered to the user as the
row to change (row 2); accepted with the table.

## 2026-09-23 — Each break trades two paper legs: the future and the nearest option
"future & Options" and "call-side entry": a long break also BUYS the near-month stock CE nearest
the future's price, a short break the PE. Ties go to the lower strike. The option exits on the
future's signal. Option legs do not count against the 10-signal cap.

## 2026-09-23 — The live 8787 server was moved to P33 the same night
Armed under P32 at 21:51, then restarted on P33 at 22:40 so Thursday's 09:20 run trades the rules
the user just gave. P32's AC10 is therefore superseded, not measured. The live candle path was
checked first with one read-only call (MFSL future, 23 Sep): range and SMA9 equal a hand
recomputation.

## 2026-09-23 — Real money is a separate phase (P35), gated by name
The user wants paper results first and then "switch it to real money, try it once". That needs an
account seam, a loss cap, a kill switch and Dhan's order API verified — none built. Until the user
asks for P35 by name, `src/` contains no order endpoint (P32 row 1, grepped by `paper:test`).

## 2026-09-24 — The 24-Sep ledger stays as the record; corrected numbers live in the docs (P31)
The laptop slept 10:40-17:45 and the trader closed at the 10:40 tick. Rewriting the ledger would hide
what the system actually did; P31's recompute (Rs 2,28,672.50) is recorded on the board and in AC6.

## 2026-09-24 — Blind time is priced from Dhan's 1-minute candles (P36)
An exit that came due while the process was asleep or down closes at the open of the 1-minute candle
at the due instant, marked `repriced`. A failed read retries every 60 s; a date change closes stale
with a note. A signal is priced whole or not at all (amendment 9).

## 2026-09-24 — The backtest learns only from real 09:20 scans (P37)
NSE's OI Spurts figure includes options OI and cannot be rebuilt from Dhan's history (MFSL +7.82%
NSE vs +2.86% near-month future). Proxy days are always reported apart, and every live 09:20 scan
is saved so the real sample grows by one day per session.

## 2026-09-25 — Phone visibility through ntfy, not a paper-trading app (P40)
Research: FrontPage has no API; Dhan/Upstox sandboxes do not show in their apps; Tradetron's free
plan is the only inbound option and has catches. ntfy was already configured (P17).

## 2026-09-25 — Risk rules exist but start OFF live (P42)
Stop, 2R target, frozen-range skip, OI flag and a -Rs 50,000 loss cap are switchable per sandbox
run. On 24 Sep the frozen-range rule would have skipped the day's winner, so which rules go live is
the user's call after sandbox evidence.

## 2026-09-25 — LTP index trading: NIFTY only, Rs 20,000 per trade (the user, for P47–P53)
- "Nifty hi chahiye." FINNIFTY, MIDCPNIFTY, BANKNIFTY and SENSEX drop out of the build for now.
- "Abhi ke liye 20k ke saath trade kijiye", lots sized by the price of the option being traded, and "1 lot se karege
  toh bhi chalega". For P53 this becomes: lots = max(1, floor(20,000 / (premium × lot size))). When one lot costs more
  than Rs 20,000, the trade still takes 1 lot and the ledger flags it `over budget`. That flag is Claude's addition,
  so the user can see it.
- "Okay start kijiye": P47 started (the NIFTY chain recorder).

## 2026-09-25 — Do not buy the LTP Calculator yet; buy the 7-day premium only to calibrate
The user offered to buy 7 days of LTP Calculator premium. Recommendation: **yes, but only once P48 and P49 exist**, and
only as ground truth. The single biggest risk in the whole plan is the reversal-price formula (OQ-1), which only their
screen can confirm. Seven days before our engine exists would be spent looking, not comparing. No public GitHub repo
or developer documentation was found (web search 2026-09-25). There are only the product sites (ltpcalculator.com,
investingdaddy.com), the apps, the pricing page, and the in-app "Read More" flowchart. Capture by hand, for personal
comparison only; automated scraping of their site is not proposed. Researching their docs in depth is its own task
(P55).

## 2026-09-25 — Dhan stays the engine; NSE's chain becomes the referee for OI (measured)
The user asked whether NSE's own option chain (nseindia.com/option-chain) or Dhan's is better. Measured on 25 Sep after
the close. The same NIFTY 29-Sep chain was read from NSE's page (`/api/option-chain-v3`, 15:40 stamp) and from Dhan, and
both were scored against **NSE's official F&O bhavcopy**. Over the 40 near-ATM legs:
- **Volume:** NSE 40/40, Dhan 40/40.
- **LTP:** NSE 40/40, Dhan 40/40.
- **OI:** **NSE 40/40, Dhan 0/40**, off by up to **21.8%**. Dhan's chain OI equals its own last 1-minute candle (15:39) and misses the exchange's final OI.
- Both sources picked the same support and resistance strikes all the same.

Why not replace Dhan with NSE:
- NSE's site answers only a headed Chrome, and its terms restrict automated access.
- It has no history, no ticks, no Greeks and no orders.
- Its intraday refresh rate is unmeasured.

Dhan has all of those (3 s chain, WebSocket, `rollingoption` history back to 2024, orders for P35).

**Decision:** Dhan remains the data and trading engine. NSE's chain, and its bhavcopy, are the **referee for OI**. P56 measures whether Dhan's OI is also off **during** the session (Monday), which decides whether OI-based levels need NSE's number.

## 2026-09-25 — LTP Calculator: do not buy now; buy 7 days after P48 and P49 (restated clearly for the user)
No, not now. Later, yes: 7 days only, as a measuring instrument for our own engine, not as a trading tool. Long-term
subscriptions and the ₹5,899 community fee are not needed, because the system is being built here.

## 2026-09-25 — P48: how NIFTY's past chains are rebuilt
- **`WEEK 1` over the whole history (from 2024-01-01), `WEEK 2` from 2026-09-01 only.** A full `WEEK 2` history doubles the disk, and no boarded phase reads it. It can be added later with one entry in `CODES`.
- **A CLI (`npm run chainhist`) run by hand after 16:00, not a job inside the live server.** Wiring it in is a second 16:00 job and a board row of its own.
- **A special session is never an expiry day** (spec A4). Diwali 2025's contract expired on Mon 20 Oct, not on the Muhurat Tuesday 21 Oct. The data found it.
- The owner approved the spec and the download in one line ("run whatever download you want I approved it — I just want the system to be working").

## 2026-09-25 — P49: the LTP state machine's rules (spec `ltp-state-v1.md`, locked with one `go`)
- **Pressure is stored and the WTT/WTB label is derived from it** (V112). Weak before any shift: WTT = bullish, WTB = bearish. After a shift, the last shift's direction wins.
- **Rules stay in strike space** (P29 row 5), even though V75 (V2) calls 25,000 → 24,900 "bottom to top … bullish". If the tool shows otherwise, shifted-up and shifted-down swap.
- **No debounce on a shift.** The tool clears its warning at 74.99 immediately; any N-minute debounce would be an invented number.
- **Both sides bearish = scenario 6 (blood bath)**, per V13 and V37 over V47 (OQ-14).
- **Three GUESSes, open to a one-word veto:** a re-seat (price through the level) counts as a shift; the Game of Percentage looks back 5 minutes with a 1.0-point dead-band; IV counts as moving at 2.0 points from 09:20.
- **History only.** No UI, no live wiring. The live read waits until the rules are checked against the tool's banner.

## 2026-09-26 — P50: the line sets, locked by delegation
The user said "go for it and complete all the pending phases … without stopping", so the spec was locked without a vote,
every unsourced value marked GUESS (memory: delegated decisions).
- **P34 is folded in, on the user's own answers of 2026-09-23**: stop at extension ±2 (EOR+2 / EOS−2), target the next
  divergence, first touch only. V48's "+10 points" stop reading is not used; V61 and V114 state the structure without it.
- **A touch is read from NIFTY's own 1-minute high/low**, fetched once (`npm run idxhist`, 12 calls). The chain's `spot`
  is not the minute close after Oct 2025, so it could not serve.
- **AI lines are recomputed every minute, and a trade uses the previous minute's line** (no look-ahead).
- **GUESSes:** S/R Risky = the strongest inward challenger, even if it is under 75%; Max Gain = the next divergence, with
  the other side's Moderate as the fallback; a neutral scenario draws nothing; no counter-trend trades; AI entries until
  14:29; the IV gate is a veto that is off by default.
- **Not changed, recorded instead:** the reversal formula. The lines' distances disagree with the corpus's two published
  numbers (V09, V117) by about 3×. P29 row 12 stays as approved until the tool's own numbers settle it.

## 2026-09-26 — P51: the index backtest, and no recommendation from it
- **One position per book, no averaging** (V117 "take the fresh trade at the next line rather than averaging").
- **The option bought is the strike nearest the line**, a CE for support lines and a PE for resistance lines (P34). Its
  price comes from its own minute candle: the close of the touch minute, or of the next minute. Both are always quoted.
- **Lot 65 on every day** (today's master); NIFTY's past lot changes are not modelled. Option costs follow the published
  NSE/Dhan schedule (GUESS).
- **No configuration is recommended.** The walk-forward's out-of-sample net is +₹65k with one fill model and −₹48k with
  the other. The P34 rules lose under both. Nothing changes in any live or paper setting.

## 2026-09-26 — P52: how an open question counts as settled
- **One rule, written before the run:** both fill models must agree, every arm needs ≥ 20 trades, and "better" is ₹ net per
  trade. A question that fails the rule is printed as not settled, with the reason.
- **Settled answers are recommendations, not settings.** Nothing in P32/P33/P53 or any live rule changes because of P52.
- **The combination of the settled pieces is not adopted.** Settling Q1, Q4 and Q8 one at a time and then stacking them
  would fit the history. P53 trades P34's rules (the user's) and reports the variants beside them.

## 2026-09-26 — P57: the chart indicators
- **"ETC" became Bollinger Bands only.** RSI, MACD and volume need a pane under the chart, which is a layout phase (P58).
- **VWAP is drawn wherever the candles carry volume.** NIFTY's index candles from Dhan do (measured). No proxy volume from
  the future is borrowed.
- **The settings sit under the preview, not in the controls card.** P19 fixed the dialog at 1040 × 640 with a card that
  does not scroll, and the card had no room left.
- **The live server was restarted** (evening, market shut, Paper armed state kept) so that `/indicators.js` was on its
  allow-list before `ucandles.js` imported it. Otherwise the user's next reload would have lost the whole client.
