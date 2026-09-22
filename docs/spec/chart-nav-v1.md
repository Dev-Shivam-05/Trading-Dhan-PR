# SPEC LOCK — P25 TradingView-style chart navigation

Status: **proposed** 2026-09-22 — every row is a value the user can veto in one word.
Implemented in `public/chart-tools.js` (main strip) and `public/candles.js` (option window),
wired from `public/app.js` and `public/ucandles.js`.

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table.

## What was undefined

The request was *"mouse ya trackpad se zoom in zoom out … same as TradingView … and other
things."* Two undefined terms:

- **"same as TradingView"** — rows 2–9 below name the exact gesture, factor and limit for each.
- **"other things"** — read as the rest of TradingView's chart navigation: pan, price zoom by
  wheel, auto-fit of the price scale to what is on screen, a reset, a keyboard path and a
  "back to the latest candle" control. Rows 10–14.

Today only the **price** axis zooms, by dragging the 76px gutter (`chart-tools-v1.md` rows 2–4).
Nothing zooms or pans **time** at all, on either chart.

## Decision table

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | The view model | The main strip keeps a time window as two numbers: `tSpan` (visible ms) and `tEnd` (the epoch ms at the right edge). `null` for either means **fit** — the data's own full range. Price keeps P6's `zoom` and gains `pShift` (a fraction of the visible price span). Nothing is stored in pixels; `X()`/`Y()` re-derive every frame | Same rule that makes a P6 drawing survive a scale change: a view is (time, price), never pixels. A pixel-stored window would break on every resize |
| 2 | Wheel over the plot | **Time zoom about the cursor.** `tSpan *= 0.85 ** (−deltaY/100)`, so one notch down (`deltaY = +100`) multiplies the span by `1/0.85 = 1.1765` (zoom **out**) and one notch up by `0.85` (zoom **in**). The time under the pointer stays under the pointer to the pixel | TradingView zooms on wheel, anchored at the cursor. 0.85 is ~6 notches per halving — fast enough to cross a session, slow enough to land on a candle |
| 3 | Trackpad pinch | Chrome delivers it as a `wheel` with `ctrlKey`. Treated as row 2 with the same factor, and `preventDefault()` so the **browser page zoom never fires** | A pinch that zooms the whole terminal instead of the chart is the failure this row exists to stop |
| 4 | Zoom limits | `tSpan` clamped to `[5 × interval, full span]` for candles and `[5 s, full span]` for the tick line. At the maximum the window **is** the full range, exactly | 5 candles is the fewest that still reads as a chart. There is no data past the ends, so zooming out past the range would only add whitespace |
| 5 | Pan by wheel | `shiftKey` + wheel, **or** a wheel whose `\|deltaX\| > \|deltaY\|` (a two-finger horizontal swipe), pans time by that delta in px: `1 px = tSpan / plotW` ms | Both are TradingView's horizontal-scroll gestures. The `deltaX` branch is what a Mac trackpad and a tilt wheel send |
| 6 | Pan by drag | With the **cursor** tool and nothing under the pointer (no shape, no handle), a drag on the plot pans **both** axes: time by `dx`, price by `dy`. Needs 3px of travel before it starts, so a click that only deselects is still a click. Cursor shows `grabbing` while panning | TradingView's primary gesture. The 3px threshold is below P6's 4px draw threshold, so a shape drag still wins where one is under the pointer |
| 7 | Pan limits | Time: clamped so `t0 ≥ T0` and `t1 ≤ T1` — the window never leaves the data. Price: `pShift` clamped to ±2 visible spans | No scroll-past-the-end whitespace: with one session on screen, whitespace would read as a halt |
| 8 | Price zoom by wheel | `altKey` + wheel over the plot, **or** a plain wheel over the `#chartAxis` gutter: `zoom *= 0.9 ** (−deltaY/100)`, clamped to P6's `[0.15, 12]`, about the plot's vertical **midpoint** (P6 row 2's maths, untouched) | Reuses the one transform P6 already owns, so the price line and every drawing still cannot disagree. Wheel-over-the-axis is TradingView's own price zoom |
| 9 | Price auto-fit follows the window | The price range is computed from the candles **inside the time window**, not from the whole session. So zooming into a quiet hour fills the plot with that hour's range | This is what makes a zoom useful rather than decorative. It is also TradingView's default ("auto" price scale) |
| 10 | Reset | **Double-click the plot** with the cursor tool on empty space: `tSpan`, `tEnd`, `pShift` reset and `zoom = 1`. Double-clicking the **price gutter** still resets the price only (`chart-tools-v1.md` row 4, unchanged) | One gesture for "put it back", in the place the pointer already is |
| 11 | Keyboard | `+` / `=` time zoom in, `-` / `_` time zoom out (both about the **right** edge, factor as row 2, one notch), `0` reset as row 10. Claimed by `tools.onKey` only while the chart is enabled, so a modifier combo still reaches the browser | The three keys are free: `1`–`9` are chips, and `0` fails the chips' `n >= 1` test today |
| 12 | The "latest" control | A `⟩` button, bottom-right inside the plot, **hidden unless the view is not the default**. Click = row 10's reset. Title "Back to the latest candle (0)" | TradingView shows exactly this arrow once you pan away. It is also what makes the feature discoverable and the reset testable without a keyboard |
| 13 | The option window (`#candleSvg`) | The same gestures in **index** space, because P9 draws option candles indexed, not time-scaled (a halt must not stretch a bar): `iSpan` (visible candles) and `iEnd` (index of the rightmost). Wheel = zoom about the cursor's index, drag = pan, double-click = reset, min **5** candles, max all. Its own `⟩` button. Price auto-fits to the visible candles, per row 9 | The user's chart request is about charts, not about one chart. Index space keeps P9's rule that a bar is a bar |
| 14 | When the view resets by itself | On a chip change, an interval change, a contract change in the option window, and a page load. **Never persisted** | A time window in yesterday's epoch ms, restored onto today's candles, is an empty chart. `chartZoom` (price) stays persisted as P6 row 5 has it |
| 15 | Following live data | While the view is at the default, new candles keep it fitted, as today. While zoomed **and** pinned to the right edge (`tEnd` at the data's end), the window follows new candles. Zoomed and panned away, it stays put | A chart you scrolled back to read must not jump forward under you; one you left at the live edge must not fall behind it |
| 16 | Behaviour on a dead chart | Every gesture is inert when `chart-tools` is disabled (fewer than 2 points, `chart-tools-v1.md` row 25) | Zooming a scale that is not on screen anchors to a fabricated price |
| 17 | Drawings | Unchanged and re-derived: a P6 shape's anchors must land at the same `(t, p)` after any zoom or pan, to **0.5px**, and the 200-shape cap, the clip and the pills are untouched | The whole reason the anchors are (time, price) |
| 18 | Paint budget | `p95 < 8 ms` over 120 frames at 375 candles with 3 SMAs, zoomed in and while panning (`underlying-candles-v1.md` row 16's budget, unchanged) | A pan that stutters is worse than no pan |
| 19 | Test seam | `window.__chart.view()` → `{tSpan, tEnd, t0, t1, zoom, pShift, fitted}` and `window.__candles.view()` → `{iSpan, iEnd, i0, i1, n, fitted}`, read-only. Nothing in the app reads either | Same seam P6/P9/P19/P26 verification scripts already use |
| 20 | What is NOT built | Touch pinch on a touchscreen (`touchstart`/`gesturestart`); a time-axis drag strip; scroll-past-the-end whitespace; per-scope persistence of the window; a zoom-to-rectangle tool | Each is a phase of its own. The machine this runs on has no touchscreen, and rows 2–3 already cover the trackpad |

## Acceptance criteria

| # | Criterion | How it is measured |
|---|---|---|
| AC1 | A wheel notch over the plot changes `tSpan` by the row-2 factor, and the time under the cursor moves by **≤ 0.5px** | `__chart.view()` before/after; the cursor's time re-derived through `__chart.X` |
| AC2 | Six notches in halve the span twice over (`0.85⁶ = 0.377`), and the clamp at row 4 holds at both ends | drive 40 notches each way, read `tSpan` |
| AC3 | A pinch (`wheel` with `ctrlKey`) zooms the chart and the page's own zoom does **not** change | `window.devicePixelRatio` / `visualViewport.scale` unchanged; `defaultPrevented` true |
| AC4 | A 120px drag on empty plot pans time by `120 × tSpan / plotW` ms ± 1px, and a 40px vertical drag moves price | `__chart.view()` before/after |
| AC5 | A drag that starts on a drawing's handle still moves the handle and does **not** pan | draw a trendline, drag its endpoint, assert the shape moved and `tEnd` did not |
| AC6 | The price range follows the window: zoomed into 10 candles, `view.lo/hi` equal those 10 candles' low/high ± the 8% pad | recompute from `__ucandles.data()` |
| AC7 | Double-click on empty plot restores the default exactly: `fitted === true`, `zoom === 1`, `pShift === 0` | `__chart.view()` |
| AC8 | `0`, `+`, `-` do rows 11's job; `+` with Ctrl held does not | keydown through the page |
| AC9 | The `⟩` button is hidden at the default view, appears after one wheel notch, and resets on click | `hidden` and the computed `display`, per the CLAUDE.md `[hidden]` trap |
| AC10 | A trendline drawn at fit is at the same `(t, p)` after zoom + pan: `X(a.t)`, `Y(a.p)` re-derived equal the shape's rendered endpoints to 0.5px | `__chart.shapes()` and `__chart.X/Y` |
| AC11 | The option window zooms and pans in index space, min 5 candles, and resets when the contract changes | `__candles.view()` across a CE→PE click |
| AC12 | Paint p95 < 8 ms over 120 frames while panning at 375 candles + 3 SMAs | `__ucandles.paints` |
| AC13 | A chip change and an interval change both reset the view | `__chart.view().fitted` |
| AC14 | Zero console errors over a 60 s soak with the chart zoomed | the page's error hook |
| AC15 | Every earlier suite still green: P6/P10a, P19, P20, P26 | the existing `.cache/*verify*.js` scripts |

## Amendments (found during the build, 2026-09-22)

| # | What | Why it is here |
|---|---|---|
| 21 | **A shut session must not grow a candle.** `ucandles.onTick()` only merges or opens a candle while the payload says `openNow`. When it says the session is shut, a tick past the last candle asks the **server** (one refresh, throttled to `REFRESH_MS`) instead of inventing a bar | Found by AC6, not by reading the code. In replay at 21:15 IST the chart held one candle **5 h 50 min** after the 15:25 close, with an empty 21,000,000 ms stretch before it — and `/api/ucandles` had returned 76 clean 5-minute candles. So the gap was drawn by the client. Every P25 rule takes a ratio of a time window to the data's span, so a phantom candle at the wall clock silently corrupts all of them, and almost every session on this project is outside 09:15–15:30. The refresh path is kept so the chart still wakes up when the market opens |
| 22 | A window that contains **no candle at all** (it landed inside a real gap) keeps the previous price range rather than an infinite one | Without it `lo = Infinity` reaches the renderer and the whole plot disappears. Zooming into a genuine halt should show an empty stretch, not a blank chart |
| 23 | The OHLC readout's default is the last candle **inside** the window, not the newest candle | Panned back a session, printing the live candle's OHLC over a chart that does not show it is a number that is silently wrong — the thing this project's verification bar exists to stop |
| 24 | The view also resets on a **chart-mode** change (tick line ↔ candles) and on a **tick-range** change (1m/5m/15m/All), not only on the chip, interval and contract changes row 14 names | Both switch the chart to a different time domain; a window measured in the old one is meaningless in the new one |
| 25 | The option window's `iEnd` is stored **fractional** and rounded only where a candle index is needed | A drag arrives as many small `pointermove` steps. Rounding the stored position on every step throws each one away: an 8-step 90px drag at 5 candles across a 452px plot is eight moves of 0.12 candles, every one of which rounds back to where it started, so a **slow drag panned nothing**. A fast flick worked, which is what makes this look like a dropped event rather than arithmetic |
| 26 | The verification harness must wheel at `plotW − 1`, not `plotW` | `.chart-surface{right:92px}` and `.chart-axis{right:16px;width:76px}` share an edge, so a wheel at the surface's right edge lands on the **gutter** and is a price zoom by row 8. The first AC6 run zoomed the price forty times and truthfully reported the time window untouched — a harness bug, fixed rather than written off as flake |
| 27 | "At the live edge" (row 15) is measured in **pixels**, not milliseconds: within **1 px** of the data's end re-pins the window, and within **half a candle** in the option window | Found on the live MCX session, 2026-09-22 21:50. Six notches with the cursor 1 px short of the right edge walked the edge inward by 144,450 ms in total — a fraction of a pixel each time, invisible on screen — and with the original 0.5 ms tolerance that was enough to **un-pin the chart from the live edge**, so it silently stopped following new candles. A gap nobody can see must not change behaviour |
| 28 | The session note on the time-axis row is **suppressed while the crosshair is within 190 px of the right edge** | Seen on the live GOLD screen, not in any check: the crosshair's time label is a filled box on the same row and is drawn last, so at the right-hand end it painted over the note and left `sessi` showing. The time labels already dodge the note (`underlying-candles-v1.md` amendment 26); the crosshair cannot, because it has to follow the pointer. The note yields instead — it is standing information, and the label under the pointer is what is being read |
