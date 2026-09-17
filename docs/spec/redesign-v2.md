# SPEC LOCK — P16 total redesign ("redesign v2")

Status: **LOCKED** 2026-09-17 — approved with one `go`, all 18 rows as written. Stage A (mock) first; the user
approves the mock screenshots before any `public/` file changes (row 2).

Source: the user's message of 2026-09-17 — the current screen (P10a/P10b) and the other session's
card layout (P13, branch `p13-card-layout`) both rated **−5/10**; "total redesign", "very
extraordinary and aesthetic".

## What is wrong with both screens today (measured at 1440x900, replay)

| Problem | Current (P10) | Card layout (P13) |
|---|---|---|
| Chain rows fully visible | **11** of 41 — 230px of chips, stats and controls plus a 230px chart sit above it | **10** — cards, gutters and a 235px chart above it |
| Focal point | none: amber is on the chip, the ATM row, the tools, the spot pill and the replay bar at once | none: black nav, black ATM spine, red chart fill, green/red pills compete |
| Type | 2 families, ~9 sizes, letter-spaced uppercase labels everywhere | 1 family, but every label, stat and header is the same muted 12px |
| The one screen with live data today | the scanner, hidden behind a button as a modal | same modal, restyled |
| Numbers per change cell | two (`+6.43 L (+40.77%)`) at equal weight | same |

## Decision table

| # | Decision | Locked value | Why |
|---|---|---|---|
| 1 | Starting point | Built on `main` (P6–P15). `p13-card-layout` is **not merged**; its branch is left untouched | The user rated it −5 as well; merging it first means re-styling a layout that is about to be replaced |
| 2 | How approval happens | **Two stages.** Stage A: a static mock at `docs/mock/redesign-v2.html` (both workspaces, real 17-Sep NSE fixture numbers, both themes), screenshots shown to the user, one-word approval. Stage B: only then the real app files change | Taste cannot be proved by a table. A mock costs ~1 file and throws nothing away |
| 3 | Structure | Two **workspaces** under one 48px nav: **Scanner** and **Option chain**. The scanner stops being a modal. Default on load: **Scanner** | It is the only screen with live data today (NSE); the chain is replay until the Dhan plan is active. *A reading, not a measurement — veto candidate* |
| 4 | Nav (48px) | Left: `DHAN` 14/600 + `terminal` in `--fg-3`. Centre: workspace tabs, active = `--fg-1` + 2px `--accent` underline. Right: mode badge, IST clock (mono), theme button | One row replaces the P10 topbar + chip rail |
| 5 | Replay notice | 28px single line, `--warn` text on `--warn` 10% wash, full sentence in `title`; still on every replay load | CLAUDE.md: replay must stay loud. It stops costing 40px |
| 6 | Fonts | **Geist** 400/500/600 for UI, **Geist Mono** 400/500/600 for every number (Google Fonts). Exactly two families | Mono numerals keep 25 columns aligned; one designed pair instead of Archivo + Plex or Inter-only |
| 7 | Type scale | Only **10 / 11 / 12 / 13 / 14 / 16 / 22 / 32 px**. Labels sentence case; uppercase only for 10px section eyebrows at `.06em` | Eight sizes, enforced by a check, not by eye |
| 8 | Dark tokens (default theme) | page `#07090D` · surface `#0C1016` · raised `#121822` · inset/hover `#19202B` · line `rgba(148,163,184,.10)` / strong `.20` · fg `#E6EAF2` / `#A3ADBD` / `#7A8597` · **accent `#8B7CFF`** (wash `.14`) · up `#2FD08A` · down `#FF5C6C` · warn `#F5B83D` · P9 `--big-in #5C93F0` / `--big-out #F2C438` unchanged | Near-black blue page, one violet accent that is neither up nor down. Every text colour is ≥ 4.5:1 on surface |
| 9 | Light tokens | page `#F4F5F8` · surface `#FFFFFF` · inset `#EEF0F4` · line `rgba(15,23,42,.08)` / `.16` · fg `#0B1220` / `#4B5565` / `#6B7385` · accent `#5B4BF5` · up `#0E9F6E` · down `#E23D52` · warn `#B7791F` | Same structure; `T` still toggles |
| 10 | Shape and depth | Radius 8px surfaces, 6px controls, 999px pills. Dark: no shadows, 1px lines only. Light: `0 1px 2px rgba(15,23,42,.06)` | Depth from tone steps, not drop shadows |
| 11 | Motion | Hover/press 160ms `cubic-bezier(.2,.8,.2,1)`; workspace switch 120ms opacity; funnel bars 480ms ease-out on a new result; existing 400ms cell flash kept. All off under `prefers-reduced-motion` | Nothing longer than half a second |
| 12 | Chain workspace layout | Instrument bar **64px**: underlying tabs · spot 22px mono + change · ATM, ATM IV, IV chg, PCR, Lot, DTE (11px label over 13px value) · expiry, strike search, Greeks, Breached. Chart strip **140px** (was ~230), `C` collapses it. Chain fills the rest; status rail 28px | Chrome above the chain drops from ~460px to 280px |
| 13 | Chain rows | 28px rows (unchanged), numbers 12px mono, row hover `--bg-3`. Change cells: absolute value `--fg-1`, the bracketed % at 10px `--fg-3` | One number reads first; the % stays for those who want it |
| 14 | ATM and spine | Spine 96px, `--raised`, strike 13px/600 mono. ATM row: the **whole row** on `--accent-wash`, spine cell solid `--accent` with `#0B0B12` text. Spot pill: `--fg-1` on `--raised`, 1px `--line-strong` | The ATM row becomes the one focal point of the screen |
| 15 | OI "butterfly" | OI bars behind the OI cells: CE bars grow **leftwards** from the spine side in `--up` at 22% alpha, PE bars grow **rightwards** in `--down` at 22%, scaled to the largest OI in the expiry | Puts the chain's OI distribution into one silhouette — the signature visual, from data already on screen |
| 16 | Scanner workspace | Max width 1280px, 24px padding. Header: `9:20 F&O Scanner` 22/600, NSE `as of` stamps 12px `--fg-2`; right: Source segmented `NSE | Dhan`, Top segmented `20 | 25 | 30`, primary **Run scan** (36px, `--accent`, `S` hint), Export CSV. **Funnel**: 4 tiles, count 32px mono, label 12px, a 4px bar whose width = count ÷ list size, chevrons between, last tile outlined in `--accent`. **Results**: Long and Short side by side, 52px rows (symbol 14/600 + name 11px, Chg % 13px mono, `OI +8.89%` chip, LTP 12px). Below: collapsible "Why each stock passed or failed" (P15's `trace`), skipped, not-in-list. Footer card: "Runs automatically at 09:20 and 09:25 IST on GitHub" + link to `scan-logs` | The funnel bars make 210 → 40 → 26 → 4 visible at a glance; the trace was already computed and never shown |
| 17 | What does not change | Every element id, every keyboard shortcut, every API, every data rule, P9 candle colours, the rail's numbers, the drawer. Only markup placement and CSS move | Eight phases of verification are keyed to those ids |
| 18 | Files | Stage A: `docs/mock/redesign-v2.html`. Stage B: `public/index.html`, `public/app.css` (rewritten), `public/app.js` (workspaces, default theme), `public/scan.js` (workspace instead of overlay), `public/panes.js` (140px chart default), `docs/shots/` re-baselined once at the end. 5 code files | Inside the ~8 rule |

### Amendment rows (found while building the Stage A mock — approved or vetoed together with the mock)

| # | Amends | Locked value | Why |
|---|---|---|---|
| 19 | 9 | Light `up #047857` · `down #C81E3A` · `warn #8A5A00` (was `#0E9F6E` / `#E23D52` / `#B7791F`). Acceptance row 5 extended to `--up`, `--down`, `--warn`, `--accent` | Computed before building: the locked light values were **3.39 / 4.18 / 3.64 : 1** on white — every coloured number on the light screen below 4.5:1. The new ones are 5.48 / 5.67 / 5.93 on white and ≥ 4.81 on `#EEF0F4`. Dark values all pass as locked (lowest: `--fg-3` on `--raised` 4.77) |
| 20 | 12 | The ATM auto-centre **snaps to a whole 28px row** | Centring on a fractional offset cut one row at the top edge: 23 full rows with the chart collapsed against a space for 24.28 |
| 21 | 14 | Spot pill 10px text, **12px tall**, centred on the dashed line; its spine cell `z-index:5` | A 16px pill clipped the 24,050 glyphs; and every sticky spine cell is `z-index:1`, so the next row's solid ATM cell painted over the pill's lower half. Zoomed at 2x in both themes after the fix |
| 22 | 15 | OI text aligned to the **outer** edge (CE left, PE right) | With text at the inner edge the bars started exactly under the numbers and the butterfly read as blocks |

## Stage A measurements (mock, 1440x900, both themes)
`.cache/p16-mock-shots.js` **19/19**: scanner fits without scrolling; exactly Geist + Geist Mono; font sizes used 10/11/12/13/14/22/32 (all in the scale); chain **19** full rows with the chart, **24** collapsed; no horizontal scroll; zero console errors.

## Out of scope (will NOT build)
- New data, new columns, new endpoints, a payoff chart, orders or anything that trades
- Scan history pulled from GitHub into the app (the footer links to `scan-logs` instead)
- Mobile layouts below 1024px
- Merging or reviving `p13-card-layout`

## Acceptance criteria (binary)
- [ ] Stage A mock screenshots (both workspaces × both themes) approved with one word before any `public/` file changes.
- [ ] 1440x900, Option chain, chart expanded: **≥ 19** chain rows fully visible; chart collapsed: **≥ 24**.
- [ ] 1440x900, Scanner, 17-Sep fixture: funnel and both result lists visible without scrolling.
- [ ] Computed `font-family` across the DOM resolves to exactly 2 families; every computed `font-size` ∈ {10, 11, 12, 13, 14, 16, 22, 32}px.
- [ ] Text contrast ≥ 4.5:1 for every `--fg-*` on `--surface` and `--raised`, both themes (computed).
- [ ] `table.oc scrollWidth === clientWidth` at 1440px with greeks off; `td.spine` inside the viewport at every `scrollLeft` at 1024px (P10a rows kept).
- [ ] All existing suites green after selector updates for the moved scanner: P14 UI, P8 UI + recompute, P2–P9 re-proof, P10a, P10b, server 31/31.
- [ ] Zero console errors over 60 s in each workspace.
- [ ] Screenshots of 12 states (2 workspaces × results/empty/error/running × 2 themes, plus chain at 1024) read and reviewed; `docs/shots/` re-baselined once.

## Risks
- **Taste is not a number.** The table can be met exactly and still read as −5. Cheapest check: Stage A, before any wiring.
- **Scanner as default workspace** (row 3) is a reading of today's situation; once Dhan is live it may be the wrong default. One-line change.
- **Geist from Google Fonts** needs the network on first load. The fallback stack is `system-ui` / `ui-monospace`, and the row-7 size check still holds.
- **The concurrent session** may keep building on `p13-card-layout`. That work would be superseded; the user should tell it.
