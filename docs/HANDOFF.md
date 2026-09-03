# HANDOFF — Dhan Option Chain Terminal — Phases 10a, 10b, 11 — 2026-09-03

## Done
- The screen is a terminal shell: chart / chain / telemetry drawer stacked in one column with 1px
  seams and two draggable splitters (drag, double-click to reset, Arrow ±8px, Shift+Arrow ±32px),
  sizes persisted.
- **The strike spine can no longer scroll out of view.** Pinned with `left:0` AND `right:0`, and
  measured inside the viewport at `scrollLeft` 0, 230 and 460 with all 25 columns on at 1024px.
- **The chain no longer scrolls sideways at 1440px.** Greeks are off by default — 17 columns /
  1132px, `table.oc scrollWidth === clientWidth === 1440`. `G` brings all 25 back.
- Dark is the default theme when nothing is stored; `T` still toggles both ways.
- **The 380px right dock is gone.** Its data is a 26px always-on status rail (conn · mode · RTT ·
  AGE · NEXT + ring · OK% · feed · t/s · clock) plus a four-column drawer, closed by default,
  toggled with `L`. `#gridScroll.clientWidth` is 1440px with the drawer shut, open, and shut again.
- A filtered chain now says so: the header reads `showing n of N strikes` whenever a filter hides
  anything, and nothing at all when it does not.
- **16 defects found by a full audit are fixed**, each reproduced with a runnable script before the
  fix and re-run after. The three that mattered: the P9 candle rule could never colour the two
  clearest cases it exists for; a missing `last_price` made ATM the lowest strike and persisted its
  deep-ITM IV as the day's IV baseline; and an unvalidated `expiry` leaked a poller per distinct
  value (144 → 191 MB over 180 unauthenticated requests, now +1.5 MB).

## Files changed
- `public/panes.js` — **new.** Splitter #1, the greeks toggle, pane sizing and persistence. Imports
  nothing; talks to app.js through `greeks` / `pane-resize` / `pane-need-room` events only.
- `public/telemetry.js` — **new.** The status rail and the telemetry drawer, moved out of app.js
  with every element id carried over unchanged, so it is a move rather than a rewrite.
- `public/index.html` — the shell wrapper, the two splitters, the rail, the drawer; `#latMini`
  removed and the conn/badge/clock moved down into the rail; `gk` on the eight greek headers.
- `public/app.css` — shell and splitter rules, sticky spine, the greeks-off column set, the rail
  and drawer; the whole `.lat` block deleted. `.scan-funnel[hidden]` added (the P8 trap again).
- `public/app.js` — telemetry renderers removed; colgroup and colspans follow the greeks toggle;
  `showing n of N`; dark default; five P11 fixes (spot-pill guard, modifier guard, chart header
  reset, and the three change columns recomputed on the tick).
- `public/scan.js` — `Esc` now stops propagation so it cannot also tear down the option chart.
- `src/server/index.ts` — two `STATIC` rows; `expiry` validated on `/api/stream` and
  `/api/candles`; `/api/feed` reports the deduped subscription count.
- `src/server/candles.ts` — the colour rule evaluated as the spec's multiplications, not divisions;
  `shapeError()` so a malformed response is not reported as an illiquid contract; `oiFloor` from
  the charted expiry's own lot.
- `src/server/derive.ts` — ATM is null when `last_price` is absent, instead of the lowest strike.
- `src/server/poller.ts` — a failed prev-close call is no longer cached as fact; a poller only
  re-emits when its **own** peaks changed.
- `src/server/peakoi.ts` — the calendar probe is shared in flight instead of returning null to the
  second caller, and a failed call is not cached as "no earlier trading day".
- `src/server/feed.ts` — reconnect when the subscription set shrinks (Dhan is never told to
  unsubscribe and the request codes are not in the contract doc).
- `src/server/instruments.ts` — `OptionContract` carries `lotSize`, which is per expiry.
- `src/server/scanner.ts` — `rejected` is counted at each rejection instead of subtracted, so
  `reconciles` can actually fail.
- `scripts/shots.ts` — the latency shot targets `#drawer` and `#rail`; `docs/shots/` re-baselined.
- `docs/spec/terminal-redesign-v1.md` — status LOCKED; amendment rows 23–27.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `CLAUDE.md`, this file.

## Decisions made
- **The spec was locked before a UI file was opened.** Rows 7 and 11 — the two the table itself
  flagged as readings rather than measurements — were put up for veto in isolation and both
  accepted as written.
- **Row 13 and the out-of-scope line contradicted each other; row 15's own reasoning settled it.**
  The conn dot, mode badge and clock *move* into the rail rather than being duplicated there,
  because "two places showing the same number is how they come to disagree".
- **Row 4's three pane minimums are geometrically impossible at 1024x800, so they are ranked.**
  Chart yields to its 70px floor first, then the drawer compresses to 88; the chain's 200px is
  never broken. On a trading screen the chain is not the one that loses.
- **`feed.ts` reconnects rather than unsubscribing.** Dhan's unsubscribe request codes are not in
  `docs/spec/dhan-api-contract.md`, and inventing them is exactly the guess this project forbids.
- **P11 was boarded as its own phase, not absorbed.** It is 12 code files against the ~8 rule; it
  is one audit's findings across the whole tree rather than a feature, and that is recorded.

## Known broken / deliberately skipped
- **No live path has ever run** — not P7, P8, P9, nor the eleven P11 server-side fixes — because
  the token in `.env` expired 2026-08-28 and the account still has no Data API plan. These are two
  separate gates that fail differently.
- **P8's AC5 (chain cadence under scan load) is still unmeasured**, and cannot be measured in
  replay at all: replay makes no `dhanPost` calls, so the rate gate is never exercised.
- **The WebSocket binary parser has never seen a real byte.** `npm run feed:probe` exists for
  exactly this and should be the first thing run once the plan is active.
- **`/v2/charts/intraday` and `/v2/marketfeed/quote` response shapes are UNVERIFIED**, and whether
  `open_interest` is quoted in units or contracts is still open — it changes P9 row 7's floor from
  `5 * lotSize` to `5`.
- **Seven branches are pushed and none has a PR.** Merge order: `p6-chart-tools`,
  `p8-p9-spec-lock`, `p7-peak-oi`, `p8-scanner`, `p9-option-candles`, `p10-spec-lock`,
  `p10a-terminal-shell`.

## Next session starts here
- Phase P12: unblock live data, then re-run every live-path question in one sitting — the intraday
  response shape and its OI units, the 420-instrument quote body, the binary parser, and P8's AC5
  with the market open.
- First command: `npm run check`
- Watch out for: **the two gates fail differently and only one is fixed by pasting a token.**
  `DH-901` / `808` means the token is bad — get a fresh one, they last about a day. `806` plus
  `dataPlan: Deactive` means the token is fine and the **account has no Data API plan**; no amount
  of re-pasting fixes that. `npm run check` prints which of the two you are looking at.
