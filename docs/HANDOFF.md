# HANDOFF — Dhan Option Chain Terminal — P10a + P10b + P11 — 2026-09-03

**The board is clear. Every phase on `docs/PHASES.md` is built.**

## Done

### P10a — terminal shell + chain (5 files, 41/41)
- **The spec was locked first.** `docs/spec/terminal-redesign-v1.md` went from `PROPOSED, NOT
  LOCKED` to **LOCKED** with one `go`. Rows 7 and 11 — the two the table itself flagged as
  readings rather than measurements — were put up for veto in isolation and both accepted.
- `public/panes.js` (new, plus its `STATIC` row) owns splitter #1 and the greeks toggle. It
  imports nothing and nothing imports it; it talks to `app.js` through `greeks` and `pane-resize`
  CustomEvents only, the same one-directional shape `scan.js` and `candles.js` use.
- **The strike spine is sticky on both axes** — `left:0` **and** `right:0`. `left:0` alone is inert
  on this table: the spine sits at x≈696 of 1484 and the overflow at 1440px is 44px, so it would
  need ~700px of scroll before it engaged. Measured pinned at `scrollLeft` 0, 230 and 460.
- **Greeks off by default: 17 columns / 1132px**, and `table.oc scrollWidth === clientWidth ===
  1440`. That is the P2 deviation row's 44px debt, paid. The eight `<td>`s stay in the DOM —
  `display:none` removes a cell from the CSS table but not from `tr.children` — so `app.js`'s
  `CELL` index constants needed no branch and the 10 Hz tick path was untouched.
- Dark is the default theme when nothing is stored; `T` still toggles both ways.

### P10b — the latency data in its new form (5 files, 30/30)
- **The 380px right dock is deleted.** `public/telemetry.js` (new) owns a 26px always-on status
  rail and a closed-by-default four-column drawer, with **every element id carried over
  unchanged**, so this is a move rather than a rewrite — which is what defused the phase's loudest
  named risk (about 20 ids inside `.lat`, one missing node presenting as the whole page dying).
- `#gridScroll.clientWidth` is 1440px with the drawer shut, open, and shut again. **The rail costs
  zero chain width**, which is the entire argument for deleting the dock.
- The conn dot, mode badge and clock **moved** out of the topbar into the rail rather than being
  duplicated there, on row 15's own reasoning ("two places showing the same number is how they
  come to disagree").

### P11 — the audit (12 files, 16 findings)
Not planned in advance; run at the user's request. **Every finding was reproduced with a runnable
script before any fix and re-run after.** The scripts are `.cache/bug-evidence-server.js` and
`.cache/bug-evidence-client.js`.

The three that matter most:
- **`candles.ts` — the P9 colour rule was a division where locked rows 6 and 7 are
  multiplications.** A `median20 > 0` / `prevOi > 0` guard inverts the answer on a zero baseline,
  so an illiquid strike waking up and a strike opening fresh — the two clearest "big player
  entering" cases the phase exists for — could **never** colour. P9's hand-checked candle still
  fires blue after the correction.
- **`derive.ts` — `last_price ?? 0` made ATM the lowest strike.** Its deep-ITM IV (42.5 against a
  correct 12.1) was then written by `BaselineStore` to `.cache/iv-baseline.json` as the session's
  IV baseline: wrong for the rest of the day, and surviving a restart. ATM is now null when spot
  is unknown — a missing ATM is visibly missing, a wrong one is not.
- **`index.ts` — `expiry` was unvalidated on `/api/stream` and `/api/candles`.** Every distinct
  value left a `ChainPoller` and a `PeakOiStore` listener alive forever: **144 → 191 MB over 180
  unauthenticated requests, linear, retained after every connection closed.** Now 400 at the
  boundary, and the same 180 requests cost +1.5 MB.

The rest: `/api/feed` reported 166 and 249 subscriptions for a real set of 83 (and that field is
what P5's "zero orphans" criterion is measured through); `feed.ts` never unsubscribed and `REQ`
has no unsubscribe code, so Dhan's side only grew toward the documented 5,000 cap — fixed by
reconnecting when the set shrinks, because inventing request codes absent from the contract doc is
exactly the guess this project does not make; `scanner.ts`'s `reconciles` was algebraically always
true; a store-wide `onProgress` re-rendered every other tab's grid; two transient failures were
cached as permanent facts. Client: the spot pill printed the live spot over the sticky CALLS
header; `Ctrl+C` collapsed the chart pane and persisted it; `LTP − LTP Chg` (the previous close, a
constant) drifted 0.81 in 2 s; `chartPx` kept NIFTY 50's price under the "NIFTY BANK IDX" label;
`.scan-funnel` hit the P8 `[hidden]` trap again; and one `Esc` closed the scanner **and** tore
down the option chart behind it.

## Verified — all in replay, at 1440x900 and 1024x800
| | |
|---|---|
| P10a acceptance | **41 / 41** |
| P10b acceptance | **30 / 30**, three consecutive runs |
| P2–P9 re-proof | **37 / 37** |
| `tsc --noEmit` | clean |
| Console errors | **zero**, including a 60 s run after the dock was deleted |

Highlights from the re-proof: P6 endpoints within **0.0331px** of `X(a.t)/Y(a.p)` after a zoom to
2.177×; P7 82/82 `Pk %` cells with the funnel `5 of 41` under `Breached`; P8 `210 → 100 → 87 → 6`;
P9 exactly **3 blue and 2 yellow**; P3 percentiles matching an independent recomputation both over
the whole ring and over the panel's own window. `docs/shots/` re-baselined once, at the end of
P10b, per row 22 — `06-latency-panel.png` is replaced by `06-latency-drawer.png` and
`06b-status-rail.png`.

## Files changed
`public/panes.js` and `public/telemetry.js` are new. `public/index.html`, `public/app.css`,
`public/app.js`, `public/scan.js`, `scripts/shots.ts`, `src/server/index.ts`, `candles.ts`,
`derive.ts`, `feed.ts`, `instruments.ts`, `peakoi.ts`, `poller.ts`, `scanner.ts`. Docs:
`PHASES.md`, `spec/terminal-redesign-v1.md`, `CLAUDE.md`, this file.

## Still not proven — and it is all the same blocker
**The live path has never run, for any of P7, P8, P9, or the eleven P11 server-side fixes.** The
token in `.env` expired 2026-08-28; `npm run check` reports `DH-901` / `808`, which is the **token**
gate, not the data-plan gate — they fail differently and only one of them is fixed by re-pasting a
token. P8's AC5 (chain cadence under scan load) is still the one criterion in the project that has
never been measured, and it cannot be measured in replay at all, because replay makes no
`dhanPost` calls.

## Next session
1. **Unblock live data.** It is now the only thing between this project and a real verification
   pass, with three phases and eleven fixes queued behind it.
2. **Then settle every live-path question in one sitting** — one `/v2/charts/intraday` call
   (response shape, epoch units, and whether `open_interest` is units or contracts, which changes
   P9 row 7's floor from `5 * lotSize` to `5`), one `/v2/marketfeed/quote` with 420 instruments,
   `npm run feed:probe`, and **P8's AC5 with the market open**.
3. **Open the PRs.** Seven stacked branches, none with a PR, is now the largest unmanaged risk.
   Merge order: `p6-chart-tools`, `p8-p9-spec-lock`, `p7-peak-oi`, `p8-scanner`,
   `p9-option-candles`, `p10-spec-lock`, `p10a-terminal-shell`.

## Run it
`REPLAY=1 npm run dev` → http://127.0.0.1:8787 — no credentials needed, loud yellow banner,
badge reads `REPLAY`. `npm run check` first if you think live should work.
