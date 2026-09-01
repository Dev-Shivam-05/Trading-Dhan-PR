# Dhan Option Chain Terminal — project rules

Global rules live in `~/.claude/CLAUDE.md`. These are the ones specific to this repo.

## Running it
- `REPLAY=1 npm run dev` — the no-credentials path. Synthetic Black-Scholes numbers, loud yellow
  banner, badge reads `REPLAY`. Use this for any UI work.
- `npm run dev` — live. Needs a valid token **and** an active Data API plan.
- `npm run check` — the one-line verdict on credentials. **Run this before assuming live data works.**

## Two failure modes that look identical and are not
A valid token does **not** mean data access. They are separate gates:
- `DH-906` / `808 Authentication Failed` -> the token is bad or expired. Get a new one.
- `806 Data APIs not Subscribed` + profile `dataPlan: Deactive` -> token is fine, the **account has
  no Data API plan**. No amount of re-pasting tokens fixes this. Subscribe at web.dhan.co ->
  My Profile -> DhanHQ Trading APIs -> Data APIs.
Tokens last about a day. `npm run check` prints which of the two you are looking at.

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

## nseindia.com is not reachable from a server here
Plain fetch/curl to `nseindia.com` returns **HTTP 000** (connection refused) while example.com and
dhanhq.co return 200 on the same run — browser UA and cookie bootstrap do not help. It also
publishes only the **top 25** underlyings on the OI Spurts page. Treat any NSE-scraping plan as
blocked-and-lossy until proven otherwise with a real Chromium, and prefer computing the same number
from Dhan.

## Verification bar for this project
It is a trading screen. "It compiled" is not done, and a number that is silently wrong is worse
than a visible error. Any derived value gets recomputed from the payload and compared before it is
called done — see the replay verifications in `docs/PHASES.md`.

## Adding a file under `public/` — it will 404 until you say so
`src/server/index.ts` serves the UI from an **explicit allow-list**, not a static directory (no
path joining from user input, no traversal surface). A new `public/*.js` or `*.css` is invisible
until it has a row in `STATIC`, and the failure looks like the whole client dying, not like a
missing file.

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

## Write the docs with the Write/Edit tools, not a bash heredoc
`cat > docs/... <<'EOF'` on a long markdown table died with ``unexpected EOF while looking for
matching `'`` — the docs here are full of backticks, pipes and apostrophes, and one of them ends
the heredoc early. Write and Edit handle the same content without escaping. Git also rewrites LF to
CRLF on these files, so a diff that looks whole-file is usually just line endings.

## Phase order is an instruction, not a preference
P10 (the TradingView-style UI redesign) runs **after** P7, P8 and P9 — the user said so explicitly
on 2026-08-31. An unlocked spec is not a licence to start, and a redesign that lands before the
three data phases has to be reopened three times to make room for their columns and panels.
