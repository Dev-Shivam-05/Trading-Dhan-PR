# HANDOFF — Dhan Option Chain Terminal — Phase 8 (9:20 F&O scanner) — 2026-09-01

## Done
- **A `Scan` button (keyboard `S`) opens a full-width overlay** over the grid and runs one pass of
  the 210-stock NSE F&O universe, funnelling
  `210 stocks -> top 50 gainers + top 50 losers -> |LTP change| >= 2% -> |OI change| >= 7%`
  and printing the survivors as **`Long candidates (n)`** and **`Short candidates (m)`** — Symbol,
  LTP, Chg %, OI, OI Chg %, Volume, futures expiry. `Esc` or `✕` dismisses it; the chain poll and
  the tick feed underneath are untouched, which is why it is an overlay and not a route.
- **The funnel is printed on every outcome**, not just the empty one: `210 → 100 → 87 → 6` with
  `scored · skipped · rejected` beside it. A legitimate zero gets its own expressive state naming
  *which* step emptied it, so a quiet market and a broken scan cannot look the same.
- **`FUTSTK` is in `KEEP_INSTRUMENTS`** — the prerequisite the spec named. Stock futures OI is
  reachable for the first time. Measured cost: **+1,270 rows on ~170,465**, 0.7%.
- **Equities carry no OI, so the OI leg is each stock's near-month `FUTSTK` contract**, quoted in
  the *same* `POST /v2/marketfeed/quote` as the cash leg — 420 instruments in one request, inside
  the 1000 limit. The baseline is the previous session's **closing** futures OI, read as the last
  candle of `POST /v2/charts/intraday` and cached to `.cache/scan-oi.json` per
  `(sessionDate, securityId)`.
- **The whole baseline fan-out shares one rate-gate key (`scan:oi`)**, the quote uses `scan:quote`,
  and neither ever touches a `chain:` key. `previousSessionIn` / `closingOiOn` / `fetchIntraday` /
  `istParts` are now **exported from `src/server/peakoi.ts` and shared with P7** rather than written
  twice — P9 gets the same client for free.
- **Nothing is silently dropped.** A stock that cannot be scored appears under a `skipped (n)`
  disclosure with its reason (`no quote`, `no previous close`, `no futures open interest`,
  `no OI baseline`, `incomplete master rows`), and `skipped + survivors + rejected = 210` is
  checked and shown.
- **Verified in replay: 32/33 checks.** The 33rd is not measurable in this mode — see below.

## Files changed
- `src/server/scanner.ts` — **new.** The engine: universe, the one quote call, the three filters,
  the baseline fan-out, the disk cache, the funnel accounting, and `scanCsv()`.
- `src/server/instruments.ts` — `fnoUniverse()`, memoised per day: the 210 `OPTSTK` underlyings
  with the `NSETEST` scrips dropped, each joined to its `EQ`-series cash row and its near-month
  `FUTSTK` contract.
- `src/server/master.ts` — `FUTSTK` added to `KEEP_INSTRUMENTS`; `MasterRow` grew a `series` field.
- `src/server/peakoi.ts` — the `/v2/charts/intraday` client extracted into exported
  `fetchIntraday()` / `previousSessionIn()` / `closingOiOn()` / `istParts()` / `datesIn()`;
  `PeakOiStore` now delegates to them. No behaviour change to P7.
- `src/server/replay.ts` — `replayScanPlan()` and `replayFuturesCandles()`: the seeded universe.
- `src/server/index.ts` — `GET /api/scan`, `/api/scan/status`, `/api/scan.csv`, the `scan.js`
  `STATIC` row, and the enable gate.
- `public/scan.js` — **new.** The panel, the progress poll, the keyboard, `window.__scan`.
- `public/app.css` — the overlay, the two tables, the funnel strip, the zero/running/error states.
- `public/index.html` — the `Scan` button, the panel shell, the script tag.
- `public/app.js` — `abbr` and `inr` exported so the scanner formats numbers the same way the grid
  does. Two words changed; nothing else touched.
- `docs/spec/scanner-v1.md` (3 amendment rows, a verification table, 2 new risks),
  `docs/PHASES.md`, `docs/DECISIONS.md` (4 entries), `docs/spec/GLOSSARY.md` (3 terms),
  `CLAUDE.md` (4 traps).

## Decisions made
- **The scanner is verified by a second implementation, not by its own output.**
  `.cache/recompute-scan.ts` rebuilds the entire funnel from the same replay payload with its own
  sort, its own top-50 cut, its own thresholds and its own candle reducer, and never imports
  `scanner.ts`. It agrees on all ten comparisons, including both candidate lists **by name**.
  The seeding is built the same way round: the six are designated **by rank in the sorted list**,
  never by name, so the scanner has to sort all 210 correctly to find them.
- **A cash row is only the share if `SERIES = 'EQ'`.** `CHOLAFIN` and `MOTHERSON` each list an NCD
  with `INSTRUMENT = EQUITY` under the same symbol. Without the filter the scan can rank and print
  a debenture's price as the stock's, with nothing on screen to say so.
- **A seeded fixture must make every filter reject something.** The first replay spread % change
  uniformly, all 100 ranked stocks cleared 2%, and filter 2 was never exercised as a rejector — the
  final count was still 6, so the test would have passed with that threshold broken. The
  distribution is squared now and the funnel reads `210 → 100 → 87 → 6`.
- **AC5 is reported unverified rather than quietly passed.** Scoring an `n/a` as green would have
  been worse than either alternative.
- **Nine code files, one over the ~8 guideline**, taken knowingly. The `peakoi.ts` extraction and
  the two-word `app.js` export are both smaller than the duplication they prevent.

## Known broken / deliberately skipped
- **AC5 — the chain poll's 3000 ms gap across a scan — is UNVERIFIED.** Two independent reasons:
  on a closed market `ChainPoller` emits one snapshot and then only re-checks every 60 s, so there
  are no two consecutive polls to measure a gap between; and **replay makes no `dhanPost` calls at
  all**, so the rate gate is not exercised in this mode even with the market open. What *was*
  measured: the scanner only ever uses `scan:quote` / `scan:oi` (static read), and the server
  answers `/api/scan/status` in p50 17.0 / p95 17.9 / **max 18.0 ms** throughout a cold scan.
  **Re-run this the first time the market is open with a live plan.**
- **The live path has never run.** `npm run check` reports `808` / `DH-901`: the token expired
  2026-08-28 and the account still has no Data API plan. Every number came from synthetic data.
  Unverified assumptions in `scanner.ts`: the `/v2/marketfeed/quote` response shape (the reader
  accepts a flat body *and* a `data` wrapper, and reads `last_price` / `net_change` / `volume` /
  `oi` from segment-keyed maps), that 420 instruments really are accepted in one request, and that
  `FUTSTK` on `NSE_FNO` is accepted by `/v2/charts/intraday`.
- **A live cold scan is projected at ~90 s, not measured** — 87 baseline calls at the *assumed*
  1 req/s plus the quote. That is inside the 120 s criterion by only ~25%, and it rests on a rate
  limit nothing has confirmed. If the real limit is slower, AC1 fails on the first live run.
  Replay measured 4.2 s cold / 43 ms warm, which says nothing about transport.
- **`open_interest` units (contracts vs units) still unconfirmed.** Affects only the displayed OI
  column, never a percentage.
- **The zero-state screenshots were captured by intercepting `/api/scan`** and returning the
  server's own payload with the six survivors moved into `rejected`. The seeded universe always
  returns six, so that state is otherwise unreachable in replay. It exercises the renderer and
  claims nothing about data.
- **`docs/shots/` still holds the 17 pre-P6 reference images.** Still P10's problem. `npm run shots`
  overwrites all 17 — never run it for an ad-hoc check.
- **Four branches pushed, none with a PR.** Stacked: merge `p6-chart-tools`, then
  `p8-p9-spec-lock`, then `p7-peak-oi`, then `p8-scanner`, in that order.

## Next session starts here
- Phase 9: **option candle colouring** — spec-locked in `docs/spec/option-candles-v1.md` (19 rows).
  It is the last recording-derived phase and the last thing before P10. Its `/v2/charts/intraday`
  client already exists and is exported from `src/server/peakoi.ts`; P8 is the worked example of
  consuming it. Its new `public/*.js` file needs a `STATIC` row in `src/server/index.ts` or it 404s
  and the failure looks like the whole client dying.
- First command: `npm run check`
- Watch out for: **a valid token is not data access** — `DH-906` / `808` means the token is dead,
  `806` with `dataPlan: Deactive` means the account has no plan and re-pasting tokens will not fix
  it. Second: **three phases now depend on the same two unverified calls** — spend the first live
  minute on one `/v2/charts/intraday` and one 420-instrument `/v2/marketfeed/quote` before trusting
  anything P7 or P8 puts on screen. Third: **do not start P10.** It runs after P9, by instruction.
