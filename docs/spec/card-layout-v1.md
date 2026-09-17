# SPEC LOCK — P13 card layout

Status: **LOCKED** 2026-09-17 — approved with one `go`, all 17 rows as written.

Source: the user's request of 2026-09-17 with an attached reference screenshot (a light, card-based
options "strategy builder" screen branded "1LY OPTIONS"). The request: redesign the screen after the
reference, the option chain is mandatory, and do not disturb the concurrent session working on
`p12-live-verify`.

## What was read from the reference

A 44px black top nav; a white index strip; a grey page carrying white rounded cards in two columns
(controls on the left, the main visual on the right); green/red for money; black primary buttons;
the active tab marked by a green underline; title-case labels rather than uppercase; an Inter-like
sans with proportional numerals. **Colour values below were read by eye from a JPEG** and may be a
few units off the original.

## Isolation from the concurrent session

- Built in a git worktree at `D:\Temp\Dhan-p13`, branch `p13-card-layout`, forked from `30e8a0d`
  (`p12-live-verify` head at the time). The main checkout at `D:\Temp\Dhan` is never written to.
- Dev server on **port 8788** (`PORT=8788 REPLAY=1`). The other session owns 8787.
- The server is stopped by **PID only**. The project CLAUDE.md's `taskkill //F //IM node.exe` would
  also kill the other session's server.
- `node_modules` is a junction to the main checkout's; `.cache/` master files were copied, not linked.
- Not touched: `src/server/`, `scripts/`, `CLAUDE.md`, `docs/shots/`.

## Decision table

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | "According to that" — how much of the reference | **Layout and visual language only.** No payoff chart, strategy legs, Execute, margin, positions, orders, target sliders or avatar | The terminal is read-only and has no data for any of them. A payoff builder is its own phase |
| 2 | Top nav | 44px, `#0D0D0D`. Left: **DHAN OPTIONS** bold. Centre: **Option Chain** (active, green dot) · **Scanner** (`#scanBtn` moved) · **Latency** (`#panelBtn` moved). Right: `#modeBadge`, today's date, `#themeBtn` | Mirrors the reference nav; moving existing buttons keeps every handler wired |
| 3 | Replay banner | Kept. One 32px line (it may wrap below ~1280px), bg `#FFF4CC`, text `#8A6100` | CLAUDE.md: replay has a loud yellow banner |
| 4 | Index strip | 36px white. The 6 underlyings as `NIFTY 50 / BANK NIFTY / …`; active one bold with a 2px green underline. IST clock on the right | The reference's index row. **No prices for non-active underlyings** — only the selected one is fetched |
| 5 | Page grid | Page grey, 12px gutters. **Left column 248px**, right column flexible | Widest sidebar that keeps the 17 default columns (1132px) with zero horizontal scroll at 1440px |
| 6 | Left cards | (A) underlying: name, 24px/700 spot, coloured change, state chips. (B) "Chain summary": the 7 stats in a 2-column grid. (C) "Connection": all of the old status rail — conn, RTT, AGE, NEXT ring, OK, feed pill, t/s. The column scrolls independently | (B) is the reference's "Margin & Funds" card; (C) replaces the 26px rail |
| 7 | Right cards | (D) chart card — same tools and ranges. (E) chain card — header holds the title, expiry, strike search, Greeks toggle, Breached switch. (F) latency drawer card — closed by default, `L` | The reference's big payoff card and the cards beneath it |
| 8 | Splitters | The 1px seams become 12px gaps carrying a 36x4px grip, visible on hover/focus. Drag, arrow keys, double-click reset and persistence unchanged | Same `panes.js` / `telemetry.js` code, restyled |
| 9 | Card | `#FFFFFF`, 1px `#E4E6EA`, radius 8px, shadow `0 1px 2px rgba(16,24,40,.05)`. Header 44px with a 14px/600 title; body padding 12px 16px | Card look lifted from the reference |
| 10 | Light tokens | page `#F0F1F3` · card `#FFFFFF` · subtle `#F7F8FA` · fg `#16181D` / `#5F6673` / `#9AA0AA` · border `#E4E6EA` / `#CDD1D8` · up `#1A9E63` · down `#E0445A` · accent `#111111` | Eyeballed from the reference. P9's `--big-in` / `--big-out` stay as locked |
| 11 | Dark tokens | page `#0C0D10` · card `#15171C` · subtle `#1B1E24` · fg `#E8EAEE` / `#A0A6B1` / `#6C727D` · border `#262A31` / `#363B44` · up `#2DBE7E` · down `#F0606F` · accent `#F1F2F4` on `#111` · nav `#000` | Same structure; `T` still toggles |
| 12 | Default theme | **Light.** Supersedes P10 row 11 (dark default) | The reference is light |
| 13 | Font | Inter 400/500/600/700, 13px body. All numerals `tabular-nums`. IBM Plex Mono and Archivo dropped | Reference is not monospace; tabular numerals keep chain columns aligned |
| 14 | Chain table | "Calls" + green outlined **CE** pill / "Puts" + red outlined **PE** pill. Title-case 11px muted column headers, 12px cells, row height unchanged. Spine `#F7F8FA`; ATM spine `#111` with white text; spot pill white with a 1px dark border; ITM tint `#F7F8FA` | The reference's CE/PE type pills; grid logic untouched |
| 15 | Controls | 30px high, radius 6px, 1px border, 12px/500. Pressed toggle = black fill. Breached becomes a 32x18px switch | The reference's buttons and "Include Existing" switch |
| 16 | Scanner and tooltips | White modal, radius 8px, backdrop `rgba(13,13,13,.45)`; the candle tooltip a white card with a shadow | Same card language |
| 17 | Files | `index.html`, `app.css`, `app.js` (theme default, nav date), `panes.js`, `telemetry.js`, this spec, one `PHASES.md` row — 7 | Under the 8-file rule. Every element id is kept, so JS wiring is unchanged |

## Superseded by this spec

- P10 row 11 — dark as the default theme (row 12 here).
- P10 rows 2 and 5 — zero-gap 1px seams (row 8 here).
- P10b row 13 — the 26px bottom status rail (row 6 card C here; element id `rail` kept).

Everything else in `terminal-redesign-v1.md` stands, including the spine pinning, the 17-column
fit, the pane minimums and ceilings, and the closed-by-default drawer.

## Out of scope

Payoff simulation, strategy builder, P&L table, pre-built strategies, margin, positions, orders;
any server change or new endpoint; prices for non-active underlyings; re-baselining `docs/shots/`.

## Acceptance criteria

1. At 1440x900: nav height 44px with background `rgb(13, 13, 13)`; left column width 248px; every `.card` has `border-radius: 8px`.
2. At 1440x900 with greeks off: `#gridScroll` `scrollWidth === clientWidth`.
3. At 1024x800 with greeks on: `td.spine` stays inside the viewport at every `scrollLeft`.
4. Chain row count equals the response strike count; zero `tr.hidden` rows.
5. Dragging `#chartGrip` by -60px moves `#chartBody` height by 60±2px, and it survives a reload.
6. Opening the drawer changes `#gridScroll.clientHeight` and not `clientWidth`.
7. Every element id in `public/index.html` at `30e8a0d` is present in the new `index.html` (script diff).
8. Keys `1`-`6`, `G`, `P`, `S`, `C`, `L`, `T`, `/`, `Esc` each still produce their prior effect.
9. Clicking an LTP enters option-candle mode, and the `tickonly` header items are hidden.
10. The scanner closes with `Esc` and with its close button.
11. With empty storage the page loads light; `T` switches to dark and persists across a reload.
12. In replay, the header ATM strike and PCR recomputed from the payload equal what is displayed.
13. Zero console errors over a 60 s replay run.
14. Screenshots: light, dark, 1024px, drawer open, scanner open, candle mode, error state.

## Risks

- The 248px sidebar is much narrower than the reference's ~38%; a wider one makes the chain scroll at 1440px.
- Colours were read from a compressed JPEG.
- At 900px height the drawer, chart and chain minimums compete; the chart yields first (existing P10b behaviour).
- The `PHASES.md` row may conflict with the other session's edits at merge time.
