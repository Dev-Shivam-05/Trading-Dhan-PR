# Type, fit and chart height — v1 (P22)

Locked 2026-09-19 with one `go`. Source request (2026-09-19): the Chart Style reference image plus
"the current UI is literally not that much suitable. The font and everything so I need you to
change that", and a TradingView screenshot of the same NIFTY session for comparison.

Measured before writing the table (live build `97a146a`, 1620×916 dark): with Greeks on,
**277 of 425** visible chain cells had `scrollWidth > clientWidth` (text cut off); at 1440 with
Greeks off, 41 of 289. The P7 peak marker in the OI cell is a full-height line through the digits.
The P19 session note sits in the plot's top-right, over the candles.

| # | Change | Locked value | Why |
|---|---|---|---|
| 1 | Font | **Inter** 400/500/600 (Google Fonts) for all text and all numbers, `font-variant-numeric: tabular-nums` on numbers. Replaces Geist + Geist Mono; one family | The reference and TradingView both use a proportional grotesk; the mono face is what overflows the cells |
| 2 | Sizes | Unchanged: 10/11/12/13/14/16/22/32 px | redesign-v2 row 7 |
| 3 | SVG text | The `MONO` constants in `app.js`, `candles.js`, `chart-tools.js`, `ucandles.js` become `Inter, system-ui, sans-serif` (name kept, value changed) | CLAUDE.md: the two-font rule reaches into the JS |
| 4 | No clipped cells | Chain cells size to their content (`white-space:nowrap`, no width that cuts text). Wider than the viewport → the grid scrolls sideways with the strike spine pinned | The 277 clipped cells |
| 5 | Peak marker | A **6px** tick at the **bottom edge** of the OI cell, not a full-height line | "26\|.75" in the user's screenshot |
| 6 | Chart height | Default plot **112 → 200px**; drag and `localStorage` still win | 900 − (48 nav + 64 bar + 28 strip header + 26 rail + 52 thead) − 17×28 = 206px, so P20's 17 rows fit at 1440×900 |
| 7 | Session note | Moves from the plot's top-right to the **time-axis row, right-aligned** | It overlaps the candles |
| 8 | Style button | Icon + the word **"Style"**, 24px tall | The Chart Style dialog is easy to miss |
| 9 | Option window spot | Opens over the side **not** clicked: CE click → over the PE half, PE click → over the CE half | P20's open decision (PHASES Next 3 #1) |

## Out of scope
Colours, shortcuts, element ids, data rules, the Chart Style dialog's controls (it inherits the font).

## Acceptance criteria
- [ ] 0 clipped chain cells at 1440 and 1620 wide, Greeks on and off, both themes.
- [ ] Every rendered text node (HTML and SVG `<text>`) resolves to Inter; every size is in row 2's scale.
- [ ] 17 chain rows fully visible at 1440×900 live with the 200px plot and no stored height.
- [ ] A CE click opens the window without covering any CE cell of the visible rows; PE likewise.
- [ ] Peak tick height 6px, touching the cell's bottom inset; no overlap with the digit glyph boxes.
- [ ] Session note's box does not intersect any candle's box.
- [ ] Earlier suites still green (P20, P19, P10a, P10b, P2–P9, P9, P16), superseded checks rewritten, not dropped.
- [ ] Screenshots of each state read; `docs/shots/` re-baselined once, one image opened.

## Risks
- 25 columns at 1440 may still scroll sideways with Greeks on; report the exact overflow, do not shrink the type.
