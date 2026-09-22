# Dhan Option Chain Terminal — project rules

Global rules live in `~/.claude/CLAUDE.md`. These are the ones specific to this repo.

## Running it
- `REPLAY=1 npm run dev` — the no-credentials path. Synthetic Black-Scholes numbers, loud yellow
  banner, badge reads `REPLAY`. Use this for any UI work.
- `npm run dev` — live. Needs a valid token **and** an active Data API plan.
- `npm run check` — the one-line verdict on credentials. **Run this before assuming live data works.**

The Data API plan is **Active** since 2026-09-18 (₹499/month, paid through 17 Oct 2026).

## Two failure modes that look identical and are not
A valid token does **not** mean data access. They are separate gates:
- `DH-906` / `808 Authentication Failed` -> the token is bad or expired. Get a new one.
- `806 Data APIs not Subscribed` + profile `dataPlan: Deactive` -> token is fine, the **account has
  no Data API plan**. No amount of re-pasting tokens fixes this. Subscribe at web.dhan.co ->
  My Profile -> DhanHQ Trading APIs -> Data APIs.
Tokens last about a day. `npm run check` prints which of the two you are looking at.

## Renewing the token kills the old one — one process owns it (measured 2026-09-19)
`GET /v2/RenewToken` (headers `access-token`, `dhanClientId`) returns `{createTime, expiryTime,
token}` good for another 24 h. The docs say POST, and POST answers `DH-905`. The old token dies
**at once** (`DH-906 Invalid Token`). So exactly one long-lived process may renew: the local
server (`src/server/token.ts` renews and rewrites `.env`). Never run a second server with a copy of
`.env` on another machine, and never hand the token to a serverless host that cannot write it back.

## GitHub cron is not a 09:20 clock
On Fri 18 Sep both the 09:20 and 09:25 cron lines started at **14:00 IST**. Because they started
together, the two `github-windows` jobs conflicted on `LATEST-github-windows.md`. The on-time run is
the Windows task `DhanNseScan0920` (`scripts/scan-task.cmd`), and GitHub is the backup. Task
Scheduler's default is "do not start on battery", and this PC is a laptop. A task created with
`schtasks` sits in `Queued` until that setting is cleared.

## Never run `npm run shots` for an ad-hoc check
It overwrites the 17 committed reference images in `docs/shots/`. Only run it when deliberately
re-baselining. For ad-hoc UI verification, write a throwaway Playwright script to `.cache/`
(gitignored) and screenshot into the session scratchpad.

## Playwright scripts must live inside the repo
Node resolves `import { chromium } from 'playwright'` from the **script's own location**, not the
cwd. A driver script in the system temp dir fails with `ERR_MODULE_NOT_FOUND` even when run from
the project root. Put it in `.cache/`.

## Data facts worth not re-deriving
- Dhan's option chain returns `previous_oi` = yesterday's **closing** OI, not its peak.
- Yesterday's intraday **peak** OI *is* obtainable: `POST /v2/charts/intraday` with `"oi": true`
  returns `open_interest` per candle (intervals 1/5/15/25/60 min, up to 90 days back) and accepts
  `exchangeSegment: NSE_FNO` with `instrument: OPTSTK` / `OPTIDX` / `FUTSTK`. Peak = max of that
  day's candle OI. **Do not self-record what this endpoint already answers.** (Untested against a
  live plan — verify with one call before relying on it, and check how expired contracts behave;
  there is a separate "Expired Options Data" API for those.)
- The chain REST poll is rate-limited to 1 request / 3 s per (underlying, expiry). OI and greeks
  are therefore 3 s data, not tick data.
- The WebSocket feed carries LTP, volume and OI only (`PACKET.OI`, code 5, 12 bytes) — **not** IV
  or greeks. Anything needing tick-resolution OI reads the feed; anything needing IV reads the poll.
- Expiry dates in the UI are always in the future — that is what an option expiry is. They come
  from the real instrument master even in replay mode. Only prices/OI/IV/greeks are synthetic.

## Scanner / F&O universe facts (verified 2026-08-28, re-verified 2026-09-01)
- The NSE F&O stock universe is **exactly 210 stocks**. `FUTSTK` and `OPTSTK` underlying lists are
  identical once you drop the junk. Do not hardcode "about 200". Use `fnoUniverse()` in
  `src/server/instruments.ts` — it reads the master and is memoised per day.
- The master ships **18 fake `NSETEST` scrips** (`011NSETEST` ...) inside `FUTSTK`. Filter them or
  the scanner will try to quote instruments that do not exist.
- `KEEP_INSTRUMENTS` in `src/server/master.ts` now **does** include `FUTSTK` (added by P8; it costs
  +1,270 rows on ~170,465). `FUTIDX` is still dropped — anything needing index futures OI must add
  it first.
- Filter every NSE `FUTSTK` / `EQUITY` query on `exchId === 'NSE'`. BSE lists futures under the
  same symbols, so an unfiltered lookup returns 6 RELIANCE futures rows instead of 3.
- Every row of the master has exactly 33 comma-separated fields, so awk-style column parsing is
  safe for one-off analysis — but keep using the quoted splitter in code, a company name with a
  comma would silently shift every column.
- `data/fno-list.txt` is the user's own F&O list (210, tab-separated). On 2026-09-17 it matched NSE
  `master-quote`, NSE `underlying-information`, NSE OI Spurts and Dhan's `fnoUniverse()` exactly.
  P14's scanner ranks only symbols in it and names every mismatch in both directions.
- `POST /v2/marketfeed/quote` takes **1000 instruments per request** (1 req/sec) and returns
  `last_price`, `ohlc`, `volume`, `oi` and `net_change` (absolute change from previous close).
  All 210 F&O stocks therefore fit in **one** call — there is no top-gainer/loser endpoint in
  DhanHQ v2 and none is needed; sort locally.

## An `EQUITY` row is not necessarily a share — check `SERIES`
`CHOLAFIN` and `MOTHERSON` each list an **NCD** in the master with `INSTRUMENT = EQUITY` under the
same `UNDERLYING_SYMBOL` as the share (`INSTRUMENT_TYPE = DEB`, `SERIES = D1`). Matching on symbol
and instrument alone can hand you a debenture's `last_price` and quote it as the stock's, ranked
and filtered and printed with nothing on screen to say it is wrong. **NSE cash rows must also match
`SERIES = 'EQ'`** — `MasterRow.series` exists for exactly this. With the filter all 210 F&O stocks
resolve to one row each; without it, two resolve to two.

## A seeded replay must make every filter reject something
P8's first replay spread % change uniformly, so all 100 ranked stocks cleared the 2% threshold and
the funnel read `210 -> 100 -> 100 -> 6`. The final count was right and the middle filter was never
exercised as a rejector — a bug in it would have passed. **Check the intermediate counts of a
seeded fixture, not just the final one.** The distribution is squared now and the funnel reads
`210 -> 100 -> 87 -> 6`.

## Replay makes no `dhanPost` calls, so nothing rate-gate-shaped is testable in it
`dhanPost`'s slot gate, and therefore any acceptance criterion about cadence under load, is
**not exercised at all** in replay — the replay paths return synthesised payloads directly.
Combined with the closed-market poller (one snapshot, then a 60 s re-check), P8's AC5 could not be
measured at all and is recorded as unverified rather than as a pass. Where a criterion is about
transport, say so and leave it open; do not score an `n/a` as green.

## A CSS layout rule outranks the `hidden` attribute
`.scan{position:fixed;display:flex}` beat the UA stylesheet's `[hidden]{display:none}`, so the
scanner panel was on screen from page load and neither `Esc` nor its close button could put it
away. Any element toggled with the `hidden` attribute that also gets a `display:` rule needs an
explicit `.thing[hidden]{display:none}`. The failure looks like broken JavaScript, not like CSS.

## nseindia.com is reachable — but only from a headed Chrome (corrected 2026-09-17)
The 2026-08-28 note here said NSE was unreachable and OI Spurts listed only the top 25. **Both were
wrong once measured with a real browser.** curl is still HTTP 000, and headless Chromium *and*
headless Chrome both die with `ERR_HTTP2_PROTOCOL_ERROR`, but `chromium.launch({ headless: false,
channel: 'chrome', args: ['--window-position=-32000,-32000'] })` gets 200s in ~3 s. OI Spurts
(`/api/live-analysis-oi-spurts-underlyings`) returns **all 216** F&O underlyings (210 stocks + 6
indices), and its oddly named `avgInOI` **is** the OI change % (216/216 recomputed). Full F&O prices
with NSE's own `pChange`: `/api/NextApi/apiClient/marketWatchApi?functionName=getIndicesData&symbol=SECURITIES%20IN%20F%26O`
(the old `/api/equity-stockIndices` is 404). `src/server/nse.ts` owns all of this. NSE's terms of
use restrict automated access — the scanner makes 3 page loads per button press, and that is the
user's call, recorded in `scanner-nse-v1.md`.

## The daily scan: where it runs, where its logs are, what to read first
`.github/workflows/nse-scan.yml` runs `npm run scan:nse` at 09:20 and 09:25 IST Mon–Fri on
`ubuntu-latest` (under `xvfb-run`) **and** `windows-latest`. Both reached NSE on 2026-09-17. Logs go
to the orphan branch **`scan-logs`**: `LATEST-<runner>.md`, `index-<runner>.csv`, and
`<date>/<HHmmss>-<runner>.{md,json}` whose `result.trace` says why each ranked stock passed or
failed. Read them with `git fetch origin scan-logs && git show origin/scan-logs:index-github-windows.csv`
— no checkout needed. NSE's raw bodies are workflow artifacts for 30 days (`gh run download`).
**`schedule:` only fires from the default branch** — a workflow sitting on a feature branch never
runs on its own, which is why P15 had to be merged to `main`. GitHub starts schedules late; judge
freshness by NSE's `prices_as_of` column, not by the run's start time. In a workflow on a Windows
runner, `TZ=Asia/Kolkata date` prints UTC — format times with Node's `Intl`.

## A re-baseline of `docs/shots/` is itself a measurement — open one image
P16's first `npm run shots` wrote all 18 "chain" images showing the **Scanner** workspace, because
`scripts/shots.ts` seeds localStorage but knew nothing about `ws`. Every image was green, committed
and wrong. After any re-baseline, read at least one image before trusting the set. `shots.ts` now
seeds `ws=chain` and takes two deliberate scanner shots (`12-…`, `13-…`).

## The UI's two-font / eight-size rule reaches into the JavaScript
`app.js`, `candles.js`, `chart-tools.js` and `telemetry.js` each write `font-family` and
`font-size` **attributes** into SVG they generate; `app.css` cannot reach them. They all read a
`MONO` constant — change it there too, or a chart axis keeps the old family while the page changes.
P16's type check walks `<text>`/`<tspan>` for exactly this reason.

## A default that shrinks a pane can make an older criterion unmeasurable
P16 cut the chart plot from 190px to 112px. P10a's "drag −60px moves the chart by 60±2px" then
clamped at the 70px floor and reported 42 — the splitter was fine, the starting height was not. The
check now seeds `pane:chart=200` first. Same shape as P6's max-vs-p95 and P9's injected clock:
**when a criterion stops being measurable, fix the measurement, do not loosen the claim.**

## Look at the screenshot; a passing check can still be wrong on screen
P14's browser suite was 32/32 green while the error state printed "nothing skipped" under a failed
scan and the header wrapped every button onto two lines. Both were only visible in the PNGs. Read
each screenshot before calling a UI phase done, then add a check for whatever you saw.

## "Now" is an argument, not a clock, wherever a rule depends on it
P9's rule must never colour the candle that is still forming, and the market is shut for almost
every session on this project — so with `Date.now()` that branch is unreachable and the criterion
is unmeasurable. `colourCandles()` takes `nowMs`; live it is the wall clock, in replay it is the
last seeded candle's open + 1 s. Same shape as P8's replay session gate. **Any rule that reads the
clock has an acceptance criterion that cannot be run outside 09:15–15:30 IST unless the clock is
injected.**

## Two modules can share the chart strip without importing each other
`public/candles.js` draws into its own `<svg>` layered inside the same `.chart-body`; `body.optmode`
plus `body:not(.optmode) .opt{display:none!important}` / `body.optmode .tickonly{...}` decides which
is on screen, and two `CustomEvent`s (`chain-scope`, `chain-render` out of app.js; `optmode` back)
carry the rest. app.js imports nothing downstream of itself, so there is no ESM cycle — the same
one-directional shape `scan.js` uses. The `!important` is load-bearing: `.chart-empty` and
`.chart-body svg` set their own `display`, and this is the same trap that kept P8's scanner panel
on screen.

## Verification bar for this project
It is a trading screen. "It compiled" is not done, and a number that is silently wrong is worse
than a visible error. Any derived value gets recomputed from the payload and compared before it is
called done — see the replay verifications in `docs/PHASES.md`.

## Adding a file under `public/` — it will 404 until you say so
`src/server/index.ts` serves the UI from an **explicit allow-list**, not a static directory (no
path joining from user input, no traversal surface). A new `public/*.js` or `*.css` is invisible
until it has a row in `STATIC`, and the failure looks like the whole client dying, not like a
missing file.

## Create the phase's branch before the first commit, not after
Branches here are **stacked**, one per phase, and each is pushed at its own head. P9's first commit
landed on `p8-scanner` because the session started on it — recovering meant `git branch -f
p8-scanner <its pushed sha>` after moving the work onto a new branch, which is safe only because
the sha was still on the remote. `git checkout -b p<N>-<name>` is the first command of a build
session, before any file is touched.

## A wholesale `el.className = '...'` silently drops classes another phase added
P9 hides the tick-chart header items in option-candle mode with a `tickonly` class. `paintSpot()`
sets `chartChg.className = 'cchg mono ' + klass` and `onFeed()` sets `pill.className = 'feedpill
live'` — both **replace** the class list, so the underlying's price change and the feed pill stayed
on screen next to an option's candle header, reading as that option's numbers. The elements that
were never reassigned (`chartPx`, `tickRate`) hid correctly, which is what makes it look like a
CSS specificity problem rather than what it is. Prefer `classList.toggle`; if you must assign,
carry the other phases' classes and say why in a comment.

## Frame-time budgets are stated as p95, never as max
Measured on this machine at 1440x900, 120-frame samples, `drawChart()` with **zero** drawings:
p50 2.40 / p95 4.50 / **max 6.40 ms**, and a 21-node page still spikes to 13.3 ms. Those spikes
are GC, not paint. A criterion written as "max under 8 ms" is therefore unpassable no matter how
fast the code is — P6's AC8 had to be amended for exactly this. With the 200-shape cap on screen
the chart now runs p50 1.70 / p95 2.70 / max 7.40 ms.

## Chart drawings are (time, price), and there is a test seam
Anchors are `{t: epochMs, p: price}`; screen position is re-derived every frame through the
`X()`/`Y()` that `public/chart-tools.js` owns and `drawChart()` borrows, so the price line and the
drawings cannot disagree. `window.__chart` exposes `frame() shapes() zoom() tool() selected()
key() repaint() X Y invY` read-only for replay verification scripts — nothing in the app reads it.
Spec: `docs/spec/chart-tools-v1.md`. Fixed terms: `docs/spec/GLOSSARY.md`.

## Replay data must be anchored, or any ratio computed from it is noise
The replay tick feed used to draw a fresh uniform random OI for every contract on every tick, so a
strike's open interest teleported between 1 L and 41 L ten times a second with no relation to the
chain's OI for that same strike. Four phases never noticed, because nothing compared OI to
anything. P7's `Pk %` did, and 24 of 82 cells showed a false breach at ratios up to 2358%.
Both ends are anchored now (`oiBase` on the subscription; proportional drift in `replayChain`).
**Before building anything that takes a ratio of two replayed numbers, check that both ends are
anchored to the same base.** A synthetic value that only has to look plausible on its own is not
the same as one that has to stay consistent with another.

## The poller stops emitting when the market is closed
`ChainPoller.loop()` takes one snapshot and then, if the session is shut, only re-checks every
60 s — it never emits again. Anything that arrives **after** that first snapshot and rides the
snapshot to the browser (P7's peaks; anything P8/P9 add) needs its own push, or it is invisible
until the next trading day. P7 does this with `PeakOiStore.onProgress` -> re-emit `last`,
throttled to 750 ms. Most work on this project happens outside 09:15-15:30, so this is the normal
case, not the edge case.

## `dhanPost`'s rate gate is per key — one key per item means no gate at all
`waitForSlot(key, cadenceMs)` in `src/server/dhan.ts` holds a slot **per key**. A loop that calls
82 contracts with `key: \`thing:${securityId}\`` dispatches all 82 simultaneously. Anything doing a
fan-out shares ONE key (P7 uses `peak:oi`, P8's spec locks `scan:quote` / `scan:oi`).

## `pkill` does not kill the dev server here — use `taskkill` by PID, then verify
`pkill -f "node.*src/server/index"` reports success and kills nothing on this machine. The old
server keeps port 8787, the new one dies with `EADDRINUSE` **into the log file**, and every
subsequent curl silently hits the STALE build — which is how a tuning change to `replay.ts` was
measured against the code it replaced and read as having no effect. Find the PID that owns the port
(`netstat -ano | grep ':8787 ' | grep LISTEN`) and `taskkill //F //PID <pid>`, then re-check
`/api/...` before trusting any number. (This note used to say `//IM node.exe`; that also kills MCP
servers and any other session's server — see the worktree note below.) A restart that
you did not confirm is a measurement of the previous commit.

## A self-check whose inputs come from its own expected answer is decoration
`scanner.ts` reported `reconciles: true` on every run through the whole of P8's verification. It
computed `rejected` by subtracting the same totals it then compared against, so it collapsed to
`universe.length` algebraically and would have reported true even if the scoring loop had
double-counted or dropped a stock — the one thing `scanner-v1.md` row 14 exists to catch. **Count
at the point of rejection, then compare against something derived independently.** The same shape
of mistake is what "recompute from the payload with a second implementation" is guarding against
everywhere else in this project.

## When the user asks to see it running, lead with the URL
The reply that starts with the server already up and `http://127.0.0.1:8787` on the first line is
the one that answers the question. Credentials status, mode and verification belong under it, not
in front of it.

## Another session may be running this repo from a second worktree — on the same port
`git worktree list` showed `D:/Temp/Dhan-p13` on `p13-card-layout`, driven by a parallel Claude
session that (a) took the phase number P13 and (b) restarted *its* server on 8787 while this
session's regression suite was running, so part of that run measured the other checkout's
`scan.js`. The symptom was a verify script timing out on a feature that plainly existed on disk.
Before trusting any number: `git worktree list`, confirm the listening PID's command line
(`Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"`), and fetch a file only this build
serves. If a peer is on 8787, run on another `PORT` and say so (`ListAgents` / `SendMessage`).
**Never `taskkill //IM node.exe`** here: this machine also runs MCP servers and other tools as
`node.exe`. Kill by the PID that owns the port. Check the board on *every* branch
(`git branch -a`) before choosing a phase number.

## A background `npm run dev` with an `||` fallback respawns the server you just killed
`REPLAY=1 npm run dev > log 2>&1 || mkdir -p .cache && REPLAY=1 npm run dev > log 2>&1` looks
harmless. It is not: killing the server makes the first command *fail*, which runs the fallback
and starts a **second** server. The next deliberate start then dies with `EADDRINUSE` into the log
while the respawned one holds 8787 — the exact stale-build trap above, arrived at from the other
direction. Start the server with **one** plain command, and after any restart assert three things
before trusting a number: exactly **one** listener on 8787, **zero** `EADDRINUSE` in the log, and
a request for something only the new build can serve (a newly added `STATIC` route returning 200).

## A `ResizeObserver` on the shell misses a child that wraps
`.shell` is `flex:1` of the body, so when the chart header wraps from one line to two the chart
pane grows and **the shell's own height does not change at all** — no callback fires. Observing
`#shell` alone left the telemetry drawer mis-sized on about half of runs at 1024x800, and it
presents as a flaky test rather than as a bug. Observe the element that actually changes size
(`#chartWrap`) as well, and guard re-entry.

## `PeakOiStore.onProgress` is store-wide, not per poller
Every contract that lands for **any** instrument notifies **every** `ChainPoller`. Without a
"did my own peaks actually change?" check before re-emitting, one chip's backfill re-renders the
whole grid in every other open tab. It also makes any "a telemetry tick does not re-render the
grid" measurement race a completely unrelated chip's backfill.

## Never measure a client percentile against the server's live ring
The panel computes over the last 60 samples **it** received; `/api/telemetry.csv` is the server's
500-sample ring and grows while you read it. Slicing "the last n rows" of the CSV to compare
against the panel compares two different sets and fails intermittently. Read the raw values the
client actually holds (`window.__telemetry.rtts()`) and recompute from those. Related: on a closed
market the client never reaches the 2 samples the sparkline needs — use the **GOLD** chip, because
MCX is the one session usually open.

## In a verification script, a trendline is a drag, not two clicks
`chart-tools.js` commits on `pointerup` only when the pointer travelled `>= MIN_DRAG_PX`, and the
tool is one-shot (it resets to `cursor` afterwards). Two `page.mouse.click()` calls draw nothing
and report `0 shapes`, which reads as a broken seam rather than a broken gesture.

## A check that picks its target from the rendered DOM breaks when the DOM is windowed
P9's illiquid check took "the top rendered row" as a deep OTM strike. After P20 rendered only
ATM ± 8, that row was 8 strikes out, replay kept it liquid, and the check failed with nothing wrong
in P9. Pick test targets from the data's own rule (replay's `ILLIQUID_OFFSET`), not from whatever
the page happens to render.

## Write the docs with the Write/Edit tools, not a bash heredoc
`cat > docs/... <<'EOF'` on a long markdown table died with ``unexpected EOF while looking for
matching `'`` — the docs here are full of backticks, pipes and apostrophes, and one of them ends
the heredoc early. Write and Edit handle the same content without escaping. **This also applies to multi-line Python
patch scripts:** a `python - <<'PYEOF'` heredoc died the same way twice in P19/P20 even with the
quoted delimiter. Write the script to `.cache/*.py` with the Write tool, then run it. Git also rewrites LF to
CRLF on these files, so a diff that looks whole-file is usually just line endings.

## Phase order is an instruction, not a preference
P10 (the TradingView-style UI redesign) runs **after** P7, P8 and P9 — the user said so explicitly
on 2026-08-31. An unlocked spec is not a licence to start, and a redesign that lands before the
three data phases has to be reopened three times to make room for their columns and panels.

## A centred sticky column needs `left:0` AND `right:0`, or it never pins
The strike spine is column 13 of 25, sits at x≈696, and the table overflows the 1440px floor by
only 44px. `position:sticky;left:0` — the reflex — would need ~700px of horizontal scroll before it
ever engaged, so it does nothing here and looks like sticky "not working". Symmetric offsets
(`left:0;right:0`) pin the cell in both scroll directions and only conflict when the scrollport is
narrower than the cell (92px), far below the supported floor. Sticky also needs a painted
background and `border-collapse:separate` — the spine already has both. Watch `td.flash`, which
animates `background` to `transparent`: a sticky cell that ends transparent lets columns scroll
through it.

## Read the screen before writing a redesign spec — three P10 rows changed because of it
Written from the requirements alone, P10's spec would have specified work that is already done and
missed the work that is actually needed. The grid **already** renders the complete strike list in
one scrollable table with a sticky header — nothing windows strikes in `derive.ts` or `app.js` — so
"no ATM window, no hidden rows" is an invariant to state, not a rebuild to schedule. The sticky
spine's obvious implementation is inert (above). And the real unmet need was never in the
requirements at all: 25 columns need 1484px against a 1440px floor, which the P2 deviation row had
already priced and handed forward. **A spec row whose "why" cannot cite a value in the codebase or
an existing spec row is a guess — mark it as one so it can be vetoed in one word.**

## Never `process.exit()` right after a `fetch` in a script — set `process.exitCode`
On this machine (Node 24, Windows) `process.exit(1)` straight after a `dhanPost` crashed with
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\winsync.c` and exit code
`-1073740791` instead of 1 — the verdict printed correctly and the exit code lied. `check.ts` already
avoids it; `live-probe.ts` throws a `Stop` and sets `process.exitCode`. Any script whose exit code
means something must end the same way.

## `npm run live:probe` is the first command once `npm run check` says READY
It answers P12's intraday and quote questions in five calls and keeps the raw bodies in
`.cache/live/`. Dhan's docs show intraday `fromDate`/`toDate` as `YYYY-MM-DD HH:MM:SS` while
`fetchIntraday()` sends date-only — if the probe prints `FAIL date format`, fix that before
driving any P7/P8/P9 screen live, or every candle-backed column reads "request failed".

## A control that rebuilds itself on click takes focus to `<body>` with it
P19's Chart Style dialog re-renders its swatch rows on every pick. The clicked button was
removed, focus fell to `<body>`, and the dialog's own `keydown` listener (on its root) never saw
the next Esc, so the dialog could not be closed from the keyboard. That looks like "Esc is broken",
not like a focus bug. A modal must (a) hand focus to the rebuilt control and (b) own the keyboard
from a document-level capture listener while it is open. Any `innerHTML`-style re-render of a
focused control needs the same care.

## Dhan's `ohlc.close` is the previous close only while the session is on (measured 2026-09-19)
After the session, `/v2/marketfeed/ohlc` and `/quote` return **that day's own close** as
`ohlc.close` (NIFTY 23346.4 = `last_price`) and `net_change` 0 — for `IDX_I` and `NSE_EQ` alike.
The header showed `+0.00 (+0.00%)` all weekend while TradingView showed `+75.80 (+0.33%)`. MCX's
quote still carried the real previous close at the same moment. The previous close now comes from
`/v2/charts/historical` (daily, official close, NSE holidays absent per exchange) — the close of
the session before the intraday payload's latest date. The scanner's `last_price - net_change`
has the same exposure on a shut market.

## Saving a file under `public/` changes the user's live screen at once
`src/server/index.ts` reads each `STATIC` file from disk **per request**, so the live server on
8787 serves a UI edit on the user's next reload — no restart, and no way to stage it. Server code
(`src/server/*.ts`) is the opposite: it needs the PID-kill-and-restart routine. Build and verify
UI work against a credential-free replay server on another port (`PORT=8791 REPLAY=1 node
src/server/index.ts`, no `--env-file`, so it cannot touch the token), and expect the user to see
each saved step.

## "The chart is gone" — check `localStorage.chart` before debugging
`C` (or the toggle at the right of the chart bar) collapses the strip and **persists** it in
`localStorage.chart = '0'`, so it survives reloads. The user reported it as a disappeared chart on
2026-09-20. Since P24 the collapsed toggle reads "▸ Show chart". When the user reports a missing
chart, ask them to press `C` first. Likewise, an old-looking screen is usually a tab not reloaded
since a UI change; the server already sends `no-cache`.

## No double quotes inside a PowerShell here-string commit message
`git commit -m @'…"Show chart"…'@` in Windows PowerShell 5.1 split the message at the embedded
quotes, and git read the rest as a pathspec (`error: pathspec '…' did not match`). **Nothing was
committed**, and a `git push` in the same call still pushed the old head. Keep commit messages free
of `"`, and read `git log -1` after every commit.

## Replay and live must never share a persisted cache
Replay writes synthetic values under **real** security ids. `peak-oi.json`, `iv-baseline.json` and
`scan-oi.json` were shared, and none of them re-fetches a key it already holds. So a `REPLAY=1` run
for UI work quietly supplied the next live session's peaks, IV baseline and scan OI baseline. Found
live on 2026-09-19: all 400 cached 16-Sep peaks were replay's, which shows as `candles: 375`
(Dhan's real sessions have 385, including 15:30–15:39). Each mode now writes `*.replay.json`.
**Any new file under `CACHE_DIR` that holds market data picks its name by `isReplay()`.**

## The replay tick feed keeps ticking after 15:30, and the chart believed it
`ucandles.onTick()` merged or opened a candle from any tick whose IST date matched the session's.
In replay at 21:15 that produced one candle **5 h 50 min after the 15:25 close** with an empty
21,000,000 ms stretch in front of it — while `/api/ucandles` had returned 76 clean 5-minute
candles. The client drew the gap. Anything that takes a ratio of a time window to the data's span
(P25's zoom, pan and price auto-fit) was being computed against that phantom, and almost every
session on this project is outside 09:15–15:30. The **server's `openNow`** decides now, not the
tick. Same shape as the anchored-replay lesson above: a synthetic value that only has to look
plausible on its own is not the same as one that has to stay consistent with another.

## Dhan's option-chain `last_price` is hours stale on MCX while the rest of the payload is live
Measured 2026-09-22 with the MCX session open: `/v2/optionchain` for GOLD returned **151,879**
twice, 45 s apart — a print from 13:20–14:05 — while `/v2/marketfeed/quote` on the very same
securityId (483079) returned **152,396**. It is not a different contract: no MCX future quotes
that number and it sits inside 483079's own day range. And the payload is otherwise live: across
two calls 70 s apart, **57 of 174 strikes** moved LTP, IV or OI. The header's change is
`spot − prevClose`, so the screen read −1,215 (−0.79%) where the truth was −798 (−0.52%). The spot
now comes from a quote of the underlying securityId, and `derive()` takes the **ATM** from it too
— otherwise the spot marker sits four rows from the ATM row on a 500-point ladder. `spotSource`
says which number is on screen. **NSE agrees today on a shut market; re-check it at 09:15.**

## A second Dhan call inside the poll loop is a cadence bug waiting to happen
`underlyingSpot()` refreshes its quote **without** being awaited. Awaiting it would put a second
round trip inside the 3 s chain budget, and with several pollers sharing one 1 req/s gate key the
queue alone could push the cadence past 3 s — the exact thing `dhanPost`'s gate exists to protect.
The cost is that the FIRST snapshot after a subscribe falls back to the chain's own number; it
says so in `spotSource`. Also: while a poller is running it holds the marketfeed slot, so a
verification script calling `/v2/marketfeed/quote` at the same time gets `805 Too many requests`.
Take the direct reading BEFORE subscribing.

## "At the edge" in a chart is measured in pixels, never in milliseconds
P25's window re-pins to the live edge when its right end is within **one pixel** of the newest
data. With a 0.5 ms tolerance, six wheel notches with the cursor one pixel short of the right edge
walked the edge inward by 144,450 ms in total — a fraction of a pixel each time, invisible — and
that was enough to un-pin the chart, so it silently stopped following new candles. The option
window has the same rule at half a candle. A gap nobody can see must not change behaviour.

## Rounding a stored position throws away every small drag step
The option window kept its right edge as a rounded candle index. A drag arrives as many small
`pointermove` steps: eight moves of 0.12 candles each rounded straight back to where they started,
so a **slow** drag panned nothing while a fast flick worked — which reads as a dropped event, not
as arithmetic. Store the position fractional; round only where an index is actually needed.

## The chart surface's right edge IS the price gutter's left edge
`.chart-surface{right:92px}` and `.chart-axis{right:16px;width:76px}` share a boundary, so a
pointer event at `plot.x + plot.w` lands on the **gutter**. P25's first AC6 run wheeled there 40
times, zoomed the price scale, and truthfully reported the time window untouched. In a
verification script, aim at `plotW − 1`.

## A suite that is not re-run is not green, it is unmeasured
P19 was recorded at **62/62** on 2026-09-19. By 2026-09-22 it was **48/62**, and nobody knew:
its reds were assumed to be the known environmental ones. Seven of them were P19's own AC1, AC3
and AC9, red since the replay feed started inventing a candle at the wall clock. Re-baselining
the other suites (P27) then turned up **two real product defects** hiding behind red lines that
had been read as stale for weeks — the chart header wrapping to 76px at 1024, and a refusal that
never said it was retrying. **Re-run the whole set at the end of every phase, and when a line is
red, find out why before writing it off.** The rewrite rule: replace a superseded constant with
the value the CURRENT spec states, or with the criterion's own invariant where the spec states no
number — and say in a comment which spec row superseded it. Never loosen a claim to make it pass.

## Three shapes of measurement bug this project keeps producing
- **A float compared as a string.** `lastSma.toFixed(2) === seamSma.toFixed(2)` flips at a `.xx5`
  boundary: two ways of summing the same twenty closes gave 24085.3950 and 24085.3950 that
  rounded to different strings, while the drawn point was 0.0098px from where it belonged.
  "To 2 dp" is a numeric claim — make it numerically, `|a − b| <= 0.005`.
- **Two reads of a moving tape treated as one instant.** `#uSpot` is repainted from the feed at
  10 Hz; the strike window re-anchors only when a 3 s snapshot lands. Reading them in separate
  `page.evaluate` calls reported 58 of 60 samples "off-centre" with nothing wrong. Read both in
  ONE evaluate, and where the app's own state is the truth, put it on a read-only seam
  (`window.__grid.spot()`) — without that, P23's rule was not measurable from outside at all.
- **A pixel ceiling standing in for a layout fact.** "The header stays one line" was written as
  `height <= 32px`. P26 added two 30px icon buttons; the one-line header is 34px. The ceiling now
  measured the tallest control, not wrapping. Assert the fact: no child sits a row below another.

## Frame-time numbers taken while anything else is running are not measurements
P19's AC9 (paint p95 < 8 ms at 375 candles) read **9.70 ms** while two verification suites were
driving their own Chrome instances, and **4.70 ms** median over five 120-frame runs alone, on the
same build minutes later. Before believing a frame-time red, re-run it with nothing else going —
and prefer the median p95 of several samples to a single one. Same family as the max-vs-p95 note.
