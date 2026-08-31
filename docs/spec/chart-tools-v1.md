# SPEC LOCK — P6 chart price axis + drawing tools

Status: **locked** 2026-08-31. Approved with `go`, no changes requested.
Implemented in `public/chart-tools.js`, wired from `public/app.js`.

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table.

## Decision table

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | Where you grab the price axis | The existing right gutter of the plot: `PAD_R = 76px` wide, full plot height, as an overlay div `#chartAxis`, `cursor:ns-resize`, `touch-action:none` | `PAD_R=76` is already the axis gutter in `drawChart()`; the chart grip already uses `ns-resize` + pointer capture |
| 2 | What "compress/expand" does mathematically | Auto-fit stays as today (`lo/hi` of visible ticks, 12% pad). Then `half=(hiP-loP)/2*zoom`, `mid=(hiP+loP)/2`, view `= [mid-half, mid+half]`. Data stays centred and keeps auto-tracking; only the scale changes | Keeps the live chart live. A fixed absolute range would stop following price and silently go blank |
| 3 | Drag sensitivity + limits | `zoom = clamp(startZoom * Math.exp(dy/180), 0.15, 12)`, `dy = clientY - startY`. Drag **down** = larger range = compressed; drag **up** = expanded | Exponential = same feel at every zoom. 180px per e-fold is a full 0.15 -> 12 sweep in ~790px, more than the 520px max chart height |
| 4 | Reset gesture | `dblclick` on `#chartAxis` -> `zoom = 1` exactly, persisted | Stated in the PHASES board row |
| 5 | Zoom persistence | `localStorage['chartZoom']`, global (not per instrument), read at boot like `chartRange` | Matches `chart`, `chartRange`, `chartH` — all global keys |
| 6 | Vertical pan when zoomed in | **Not built.** At `zoom<1` data may run past the top/bottom edge and is clipped | Board row says compress/expand only; pan needs its own hit-test and doubles the phase |
| 7 | Crosshair trigger + geometry | Shown on `pointermove` over `#chartSurface` (plot area minus the 76px gutter), hidden on `pointerleave`. Vertical line snaps to the nearest tick when within **24px** on X, else free; horizontal line always follows the pointer | Snap makes the time/price readout a real print, not an interpolation |
| 8 | Crosshair styling | Both lines: 1px, `stroke-dasharray="3 3"`, `var(--fg-faint)`, `opacity .8` | `"3 3"` is the existing last-price dash |
| 9 | Crosshair readouts | Right gutter price pill: `rect rx=3 fill:var(--fg-muted)`, text `var(--bg-panel)` IBM Plex Mono 10.5px/600, `inr()` formatted. Bottom time label: 9px `var(--fg-faint)`, `HH:MM:SS` 24h en-IN | Same shape as the live-price pill but muted, so it can never be mistaken for the live price |
| 10 | Which tools, in what order | `↖` cursor · `╱` trendline · `—` horizontal line · `→` ray · `▭` rectangle · `✕` clear-all, as a `.tools` group with `aria-pressed`, placed left of `#chartRange` in `.chart-h` | Exactly the four tools in the board row. Text glyphs — the project ships no icon font |
| 11 | Keyboard shortcuts | `V` cursor, `D` trendline, `H` horizontal, `R` ray, `B` rectangle, `Esc` cancel/deselect, `Delete`/`Backspace` delete selection | None collide with the taken keys (`1-9`, `/`, `L`, `T`, `E`, `C`, `Home`) |
| 12 | Draw gesture | pointerdown -> drag -> pointerup. Two-point tools need >= **4px** of travel or the shape is discarded. Horizontal line is a single click (<4px travel) at the pointer's price | 4px is below accidental-drag threshold; discards stray clicks silently |
| 13 | Tool stickiness | Reverts to cursor after each completed shape | One-shot prevents stray shapes on a chart the user is mostly reading |
| 14 | Drawing colours + weights | Stroke `var(--accent)` 1.4px. Trendline/ray solid; horizontal line `stroke-dasharray="5 4"` plus an accent price pill in the gutter; rectangle 1.4px stroke + `var(--accent-wash)` fill | Accent gold is the only colour not already meaning up/down/latency-stage in the token sheet |
| 15 | Anchor coordinates | `{t: epochMs, p: price}`. Trend/ray/rect store `a` and `b`; hline stores `a.p` only and spans `x = 0 … W-76` | Price/time anchors are what makes "survives a scale drag" true by construction |
| 16 | Ray semantics | From `a` through `b`, extended to the plot edge in the `a->b` direction only | Standard ray; a trendline is the bounded version of the same maths |
| 17 | Clipping | All drawings inside `<clipPath>` = `rect(0, 0, W-76, H-16)` | Anchors outside the current window must not paint over the axis gutter or the time labels |
| 18 | Selection + hit tolerance | Click within **6px** of a shape selects it: stroke-width 2 and handles = r3.5 circles, `fill:var(--accent)`, `stroke:var(--bg-panel)` 1px. Handles are draggable to re-anchor | 6px is one mouse-slop at 1.6px stroke |
| 19 | Moving a whole shape | **Not built.** Endpoint/corner handles only | Body-drag on a live chart makes accidental displacement easy; handles cover re-anchoring |
| 20 | Undo/redo | **Not built.** Delete the shape instead | Keeps the phase inside 8 files |
| 21 | Clear-all safety | `✕` needs a second click within 3000ms; between clicks its label reads `sure?` and it carries `var(--crit)` border | Destructive and irreversible (no undo); a `confirm()` dialog is out of character for this UI |
| 22 | Persistence key + shape | `localStorage['draw:v1:<instrumentId>:<expiry>']` = `[{id, kind, a, b}]`, written debounced **250ms** after any add/move/delete | `v1` lets a later format change be dropped rather than mis-parsed |
| 23 | Key hygiene | On boot, delete any `draw:v1:*` key whose expiry segment parses to a date before today | Weekly expiries would otherwise accumulate keys forever |
| 24 | Cap | 200 shapes per (instrument, expiry); further shapes ignored with one `console.warn` | Guards the per-frame SVG rebuild; unreachable in real use |
| 25 | Behaviour with <2 ticks | Chart stays empty as today and the five tool buttons are `disabled`; stored drawings are untouched and reappear | Drawing against a chart with no scale would anchor to a fabricated price |
| 26 | Paint order | guides -> area -> line -> **drawings** -> last-price marker/pill -> crosshair | Drawings sit above the fill, below the live price — the live price must never be obscured |
| 27 | Where the code lives | New `public/chart-tools.js` (ES module) imported by `app.js`; axis/crosshair/drawing state and rendering live there, `drawChart()` calls into it | `app.js` is already 811 lines and `index.html` already loads it as `type="module"` |

## Out of scope (will NOT build)
- Vertical pan, horizontal/time zoom, scroll-wheel zoom
- Whole-shape drag, undo/redo, copy/paste, shape styling UI (colour/width pickers)
- Fib, text, measure, parallel channel, or any tool beyond the four named
- Snapping anchors to strikes or to OHLC values
- Drawings on an option contract's own chart — that is P9
- Server-side or cross-device persistence

## Acceptance criteria (binary, testable in `REPLAY=1`)
- [ ] A trendline drawn on NIFTY is present with both anchors unchanged after: switching to BANKNIFTY and back, and after a full page reload — stored `{t,p}` values byte-identical.
- [ ] After dragging the axis so `zoom` moves from 1.0 to <= 0.5, each rendered endpoint equals `X(a.t), Y(a.p)` recomputed from the stored anchors, within **0.5px**.
- [ ] Double-click on the axis sets `zoom === 1` exactly and repaints within one frame.
- [ ] Crosshair price readout equals the inverse of `Y` at the pointer's clientY to **2 dp**.
- [ ] A click 5px from a trendline selects it; a click 8px away does not.
- [ ] `Esc` mid-drag leaves the drawing count unchanged.
- [ ] Drawings written only under `draw:v1:<instrument>:<expiry>`; a second expiry starts empty.
- [ ] With 200 shapes on screen, `drawChart()` stays under **8ms** measured over 100 frames.
- [ ] Screenshots: cursor idle, each of the four tools mid-draw, a selected shape with handles, compressed scale, expanded scale, crosshair readout — both themes for the last three.

## Risks
- **Per-frame SVG string rebuild.** Drawings join an `innerHTML` rebuild that runs at up to 60fps. Cheapest check: the 200-shape 8ms criterion, run before anything else is polished.
- **Pointer capture collision** between `#chartAxis`, `#chartSurface` and the existing `#chartGrip`. Cheapest check: drag the grip to resize while a shape is selected; the shape must not move.
- **`t0`/`t1` slide with the range window**, so a shape drawn on `All` can be entirely off-screen on `1m` and look deleted. Mitigation is the clip in row 17; nothing is written, so switching back restores it.
