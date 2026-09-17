# SPEC LOCK — P10 terminal UI redesign (P10a + P10b)

Status: **LOCKED** 2026-09-03 — approved with one `go`, all 22 rows as written. Rows 7 and 11,
the two the table flagged as readings rather than measurements, were put up for veto in isolation
and both were accepted: **greeks hidden by default** and **dark as the default theme**.

P10a was built and verified the same day (41/41 acceptance checks, replay, 1440x900 and 1024x800).
P10b followed (30/30). Amendment rows 23-27 below were added during those builds and are marked as amendments.

The proposal was written against the real screen as it stands after P9, not against the
requirements alone — every "why" below cites a value already in the codebase or an existing spec
row. A future session with no memory of the emitting conversation can approve this file as-is.

Source: the user's request of 2026-08-31, boarded as the P10 row in `docs/PHASES.md` and recorded
in `docs/DECISIONS.md` ("P10 is boarded last and stays unlocked until its turn"). That decision
named the three things that had to become numbers before any UI file is touched: what
"TradingView-like" fixes, what the latency panel's new form is, and how the existing P2–P6
acceptance criteria are re-proved rather than quietly dropped. Rows 1, 12 and the third acceptance
block are those three answers.

## What it is

The screen rebuilt as a terminal shell: three stacked resizable panes with 1px seams, the strike
spine pinned so it can never scroll out of view, a default column set that fits 1440px without
horizontal scroll, and the P3 latency data moved off its 380px right dock into a always-on 26px
status rail plus a closed-by-default horizontal drawer.

**The split is not optional.** The PHASES row carries `~12` files against the 8-file rule and says
in its own text that it splits at spec-lock time. P10a is the shell and the chain; P10b is the
latency re-presentation. Five code files each. P10a deliberately leaves the existing `.lat` right
dock working and untouched inside the new shell, so P10a can ship and be verified on its own and
P10b has no rework to undo.

## Decision table

`Ph` is the sub-phase the row belongs to: `a` = P10a, `b` = P10b, `ab` = both.

| # | Ph | Ambiguity | Locked value | Why this default |
|---|---|---|---|---|
| 1 | a | What "TradingView-like" fixes, as a list | Exactly five things: **(a)** a resizable multi-pane shell with dragged splitters, **(b)** zero-gap 1px-seamed pane chrome, **(c)** the strike spine pinned so it can never scroll out of view, **(d)** the default column set fitting 1440px with no horizontal scroll, **(e)** dark as the default theme. Nothing else changes | Three undefined adjectives become five binary facts. Every other TradingView trait (drawing tools, multi-chart, watchlists, a replay bar) is either already built here or is out of scope below |
| 2 | a | The pane model | Three stacked panes in one column: **chart** (top) · **chain** (fills) · **telemetry drawer** (bottom, P10b) — plus a 26px status rail pinned under them. Two horizontal splitters. The fixed chrome above (topbar, replay banner, chip rail, header strip) is **not** a pane and does not move | The chain is height-scrolling and 1484px wide; a pane that takes width costs chain columns, a pane that takes height costs strike rows — and rows are cheaper, because the strike list is already scrolled |
| 3 | a | Splitter geometry | 5px visible, 9px hit area, `cursor:ns-resize`, `background:transparent` → `var(--border-strong)` on hover and while dragging, 120ms. Focusable (`tabindex=0`); Arrow Up/Down moves 8px, Shift+Arrow 32px. Double-click resets that pane to its default size | Generalises the existing `.chart-grip` (6px, same cursor) rather than inventing a second resize idiom. 9px is the smallest hit area reliably grabbable at 1440x900 |
| 4 | a | Pane sizes and persistence | Chart: default **190px**, min **70**, max **60%** of shell height, key `pane:chart` (migrated from today's `chartH`). Drawer: default **240px**, min **140**, max **60%**, key `pane:telemetry`, **closed by default**. Chain takes the remainder, min **200px** | 190 and 70 are today's live values in `public/app.css` `.chart-body`. The chart strip does not get resized by a phase that is not about the chart |
| 5 | a | Pane chrome | Panes are flush: no gap, no margin, no radius on pane edges. Every pane below the first carries `border-top:1px solid var(--border)`. Existing inner padding is unchanged | This is (b) of row 1, and it is the whole visual difference between "a page with sections" and "a terminal" |
| 6 | a | **The sticky strike spine** | `th.spine, td.spine { position: sticky; left: 0; right: 0; }` — the header cell is sticky on both axes (it already has `top:0`). z-index: thead spine **4**, other thead th **3**, tbody spine **2**. Both already paint `var(--bg-inset)` and `border-collapse` is already `separate`, so nothing else is needed | With symmetric offsets and a scrollport wider than the 92px spine, the cell is pinned inside the viewport in **both** scroll directions. A `left:0`-only spine never engages here: the spine sits at x≈696 and the overflow at 1440px is 44px, so it would need ~700px of scroll to stick |
| 7 | a | **The default column set** | The eight greek columns (Vega, Theta, Gamma, Delta, both sides) are **hidden by default**, toggled by a `Greeks` button and the `G` key, persisted as `cols:greeks`. Off → **17 columns / 1132px**. On → today's **25 / 1484px** | 1484px does not fit the narrowest supported screen. The P2 deviation row in `PHASES.md` already prices this as "44px of horizontal scroll at 1440px" and says *P10 owns the final column layout* — this row is that debt being paid. **This is the one row that is a reading rather than a measurement, and the one most likely to be vetoed.** One boolean flips it |
| 8 | a | "No ATM window, no hidden rows" | The default view hides **zero** rows: `tr.hidden` is only ever set by an explicit user filter (the strike search, or `Breached`). Whenever a filter hides anything the header strip reads `showing n of N strikes`; with no filter it reads nothing | Nothing windows strikes today — no server path and no client path. This row makes that a stated invariant instead of an accident, and makes the filtered case legible rather than looking like missing data |
| 9 | a | ATM auto-centring | **Unchanged** — centres once per instrument/expiry change, `Home` re-centres | P2 behaviour with a passing acceptance criterion. A redesign is not a licence to re-decide it |
| 10 | a | Row height and type | **Unchanged** — 28px body rows, 24+26px header rows, every type token as `ui-contract.md` section 1 | Nothing on screen is too loose. Changing density re-baselines 17 screenshots to buy nothing |
| 11 | a | Default theme | **Dark**: `applyTheme()` falls back to `dark` instead of the OS preference when `localStorage.theme` is unset. `T` still toggles; an existing stored choice still wins | (e) of row 1. One line, fully reversible, and the loudest available "terminal" signal. **Vetoable in isolation** |
| 12 | b | **The latency panel's new form** | The 380px right dock is **deleted**. Its data returns as two things: a **status rail** (row 13) and a **telemetry drawer** (row 14) | A right dock is the one shape that trades chain width for latency, which is exactly what the P10 done-when forbids. The rail costs 0 width; the drawer costs height and is closed by default |
| 13 | b | Status rail | 26px, full width, pinned below every pane, **never closable**. Left→right: conn dot + label · mode badge · `RTT` · `AGE` · `NEXT` + the countdown ring · `OK%` · feed pill + `t/s` · clock. IBM Plex Mono 10.5px, labels `--fg-faint`, values `--fg-base`, updated in place | These are the three P3 "big numbers" plus the two P5 feed numbers. Reading them costs no click and no width — which is what "readable without giving up chain width" means |
| 14 | b | Telemetry drawer | Opens above the rail. The P3 detail re-laid **horizontally in four columns** instead of vertically in one 380px stack: (1) stage waterfall + key, (2) sparkline + p50/p90/p99/max, (3) the 20-row call log, (4) the CSV export link. Toggled by `L` and by the existing `⇥` button | Same data, a different form — the done-when's own word. Four columns at ~1400px give each block more room than 380px did, and the call log stops being the only thing below the fold |
| 15 | b | The topbar mini readout | `#latMini` (RTT/age) is **removed** from the topbar; the rail carries it | Two places showing the same number is how they come to disagree |
| 16 | b | Where the moved code lives | New `public/telemetry.js` owns the rail and drawer renderers, moved out of `app.js`, **plus its row in the `STATIC` allow-list** in `src/server/index.ts`. Element ids are carried over **unchanged** | Same 404 trap as `scanner-v1.md` row 16 and `option-candles-v1.md` row 19. Keeping the ids makes this a move rather than a rewrite, and keeps the diff reviewable |
| 17 | ab | P8's scanner overlay and P9's chart mode | **Untouched.** `.scan` stays `position:fixed` above the shell; the chart pane keeps both `<svg>`s, the existing grip becomes splitter #1, and `body.optmode` still decides which renderer is on screen | `scanner-v1.md` row 12 and `option-candles-v1.md` row 2 both deliberately reuse the one grid and the one chart strip. A shell that splits either one reopens both phases |
| 18 | ab | `hidden` + `display` | Every new pane, the drawer and the rail get an explicit `.thing[hidden]{display:none}` | The P8 trap: `.scan{display:flex}` outranked the UA stylesheet's `[hidden]{display:none}`, the panel was on screen from page load, and neither `Esc` nor its close button could put it away. It presents as broken JavaScript, not as CSS |
| 19 | ab | Keyboard map | New: **`G`** greeks. Reused: `L` drawer (was the panel), `C` chart pane. Unchanged: `1-6`, `/`, `P`, `T`, `E`, `Home`, `S`, `V D H R B`, `Esc`, `Delete` | `G` is free. Every other letter this needs is already bound to the thing it now toggles, so the map does not grow |
| 20 | ab | Responsive floor | Supported down to **1024px**: greeks off, splitters live, the rail drops `OK%` then the clock below 1180px, the chain scrolls horizontally by 108px with the spine pinned | 1024 is P4's stated floor. Below it nothing is promised |
| 21 | ab | Files | **P10a:** `public/panes.js` *(new)* + its `STATIC` row in `src/server/index.ts`, `public/index.html`, `public/app.css`, `public/app.js` = **5**. **P10b:** `public/telemetry.js` *(new)* + its `STATIC` row, `public/index.html`, `public/app.css`, `public/app.js` = **5** | Both under the 8-file rule, which is the entire reason the split exists |
| 22 | b | `docs/shots/` re-baselining | `npm run shots` runs **once**, at the end of P10b, deliberately. Not during P10a, and never for an ad-hoc check | All 17 reference images predate P6 and the command overwrites all of them. P10 owns this, and it stays a deliberate act |

## Amendments made during the build (P10a, 2026-09-03)

| # | Ph | Amendment | Why it was needed |
|---|---|---|---|
| 23 | a | **The out-of-scope line "no change to the header strip" is scoped to restyling, not to rows 7 and 8.** The `Greeks` button joins `Breached` / `Scan` in `.hstrip` as a third `.tog`, and `showing n of N strikes` is a `.statechip` beside `#peakChip`. No other header-strip change | Rows 7 and 8 each require a control or a readout, and the header strip is where every other toggle and chip on this screen already lives. As written the two instructions contradict each other; the specific rows win over the general guard, and the guard still forbids everything else |
| 24 | a | **`skeleton()` must emit the `gk` class on the same eight cells the real rows do.** It builds its 25 `<td>`s from the same `COLS` constant, so without this it generates 25 columns against the 17-`<col>` colgroup | Found by testing, not by reading. Greeks off is the default, so this is the path *every* instrument and expiry switch takes: the shimmer rows landed on different column boundaries than the header above them and the grid that replaced them |
| 25 | b | **The rail takes the conn dot, the mode badge and the clock out of the topbar rather than duplicating them**, and takes `#feedPill` / `#tickRate` out of the chart header (dropping their `tickonly` class). Ids unchanged. Splitter #2 and the drawer's own size live in `telemetry.js`, not `panes.js`, so P10b stays at the five files row 21 costed | Row 13 lists all five as rail contents while the out-of-scope line forbids topbar edits beyond row 15 — but row 15's own reason is *"two places showing the same number is how they come to disagree"*, so moving is the reading that honours it. `tickonly` existed because P9 found the feed pill reading as an option's numbers **next to an option's candles**; in a global rail below every pane that ambiguity does not exist |
| 26 | b | **Row 4's three minimums are geometrically impossible at 1024x800, so they are ranked.** The chart yields first, down to its 70px floor, via a `pane-need-room` event `panes.js` answers (and `pane-release-room` hands the pixels back on close). If that is still not enough the **drawer** compresses below its 140 — floor 88, with each column scrolling — and the chain's 200px is never broken | Measured, not predicted: the first P10b run gave a **114px chain** at 1440x900 and **59px** at 1024x800. At 1024x800 the shell has ~483px for a 140px chart pane, a 140px drawer and a 200px chain, which needs 480 before the 5px splitter. Something has to lose and on a trading screen it is not the chain. Settled numbers there: chart 70, drawer 118.7, chain **exactly 200.0** |
| 27 | b | **The drawer re-clamps from a `ResizeObserver` on `#shell` *and* `#chartWrap`**, not from the snapshot alone | `chain-timing` fires once on a closed market — the normal case here — and the layout settles *after* it. `#shell` alone is the trap: it is `flex:1` of the body, so when the chart header wraps from one line to two the chart pane grows and the shell's height does not change at all. With only `#shell` observed, the 1024x800 case failed on about half of runs |

## Out of scope (will NOT build)
- Any change to the topbar / replay banner / chip rail / header strip beyond removing `#latMini` (row 15)
- Vertical splitters, floating or detachable panes, saved layout presets, more than three panes
- A watchlist, a symbol search overlay, multi-chart, or a second chain
- Any change to row height, column order, number formatting, or the token sheet
- New data, new endpoints, or any server change other than the two `STATIC` rows
- Drawing tools on the option-candle chart (still `option-candles-v1.md` row 17)
- Touch or mobile layouts below 1024px

## Acceptance criteria (binary, testable in `REPLAY=1` at 1440x900)

### P10a
- [ ] Dragging splitter #1 by −60px changes `#chartBody` height by 60±2px; the value survives a reload; double-click restores exactly 190px.
- [ ] Splitter #1 cannot drag the chart below 70px or above 60% of shell height.
- [ ] With greeks off, `table.oc` `scrollWidth === clientWidth` at 1440px (zero horizontal scroll) and the rendered column count is 17.
- [ ] With greeks on at 1024px, `td.spine.getBoundingClientRect().left >= 0` and `.right <= innerWidth` at `scrollLeft = 0`, at maximum `scrollLeft`, and at the midpoint.
- [ ] `#ocBody` row count `=== snapshot.strikes` with no filter, and zero rows carry `.hidden`.
- [ ] With a strike typed into search, the header reads `showing n of N strikes` and `n` equals the count of rows without `.hidden`.
- [ ] `localStorage.theme` cleared then reload ⇒ the resolved theme is dark; `T` still toggles both ways.

### P10b
- [ ] With the drawer closed, `RTT`, `AGE` and `NEXT` are all non-`—` in the rail, and `#gridScroll.clientWidth` equals the P10a no-drawer baseline **to the pixel**.
- [ ] Opening the drawer changes `#gridScroll.clientHeight` and leaves `clientWidth` unchanged.
- [ ] `/api/telemetry.csv` percentiles still match hand computation from the same samples (the P3 criterion, re-run).
- [ ] A telemetry tick updates the rail without re-rendering the grid: `#ocBody.innerHTML` is byte-identical across it.
- [ ] Zero `null`/undefined element errors in the console over a 60 s run after the dock is deleted.

### Re-proving the eight phases underneath — both sub-phases, scripted in `.cache/p10-verify.js`
This block is the third of the three things `DECISIONS.md` said had to be answered before any UI
file is touched. The P10 done-when requires every P2–P6 criterion to still pass; P7, P8 and P9 all
live on the same screen and are added here for the same reason.

- [ ] **P2** — row count equals the response strike count, every row has a spine cell, the ATM row is highlighted.
- [ ] **P3** — exported CSV percentiles match hand computation; a telemetry update does not re-render the grid.
- [ ] **P4** — all eight component states reachable, in both themes, at 1440px and 1024px.
- [ ] **P5** — subscriptions match the rendered strike list with zero orphans; frame gaps stay under 250 ms.
- [ ] **P6** — a trendline survives an instrument switch, a reload and a scale drag, staying within 0.05px of `X(a.t)/Y(a.p)`.
- [ ] **P7** — the `Pk %` column and the `Breached` filter behave as before.
- [ ] **P8** — the scanner opens, runs and closes with `Esc`.
- [ ] **P9** — a row click renders the option chart with exactly 3 blue and 2 yellow candles.
- [ ] 12 screenshots reviewed in both themes; `npm run shots` re-baselined once at the end of P10b.

## Risks

- **Deleting the right dock silently kills the client.** `app.js` writes to roughly 20 element ids
  inside `.lat`; one missing node is a null-deref that presents as the whole page dying, not as a
  missing panel. Cheapest check: row 16 carries the ids over unchanged, and the "zero console
  errors over 60 s" criterion is the tripwire.
- **The sticky spine can be defeated by `td.flash`**, which animates `background` to `transparent`
  — a sticky cell with no painted background lets the columns scroll through it. Cheapest check:
  confirm before building that the spine cell is never given `.flash`; if it is, exclude it.
- **`.spotpill` is `z-index:4` and pointer-events-none**, the same layer the sticky header spine
  now wants. Cheapest check: screenshot the spot pill with the grid scrolled to the top and to the
  bottom.
- **Row 7 is the one guess in this table.** Hiding greeks by default is a reading of
  "TradingView-like" plus the P2 deviation row, not something the user said. Row 11 is the second.
  Both are one flag each.
