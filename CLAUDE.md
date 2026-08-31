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

## Scanner / F&O universe facts (verified 2026-08-28 against the real master)
- The NSE F&O stock universe is **exactly 210 stocks**. `FUTSTK` and `OPTSTK` underlying lists are
  identical once you drop the junk. Do not hardcode "about 200".
- The master ships **18 fake `NSETEST` scrips** (`011NSETEST` ...) inside `FUTSTK`. Filter them or
  the scanner will try to quote instruments that do not exist.
- `KEEP_INSTRUMENTS` in `src/server/master.ts` does **not** include `FUTSTK` / `FUTIDX` today, so
  stock futures are dropped at parse time. Anything needing futures OI has to add them first.
- Every row of the master has exactly 33 comma-separated fields, so awk-style column parsing is
  safe for one-off analysis — but keep using the quoted splitter in code, a company name with a
  comma would silently shift every column.
- `POST /v2/marketfeed/quote` takes **1000 instruments per request** (1 req/sec) and returns
  `last_price`, `ohlc`, `volume`, `oi` and `net_change` (absolute change from previous close).
  All 210 F&O stocks therefore fit in **one** call — there is no top-gainer/loser endpoint in
  DhanHQ v2 and none is needed; sort locally.

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
