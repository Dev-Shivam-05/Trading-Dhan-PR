# HANDOFF — Dhan Option Chain Terminal — Phase 6 — 2026-08-31

## Done
- The tick chart's **price axis is draggable**. Drag the 76px right gutter down to compress the
  scale, up to expand it; double-click resets to exactly 1. The zoom multiplies the half-span of
  the auto-fit range about its midpoint, so the chart keeps tracking price — it never freezes on a
  stale absolute range. Persisted in `localStorage.chartZoom`.
- A **crosshair** follows the pointer over the plot, snapping its vertical line to a real tick
  within 24px. Price reads off the axis in a muted pill (never the live-price colour), time reads
  off the bottom.
- **Four drawing tools** — trendline (`D`), horizontal line (`H`), ray (`R`), rectangle (`B`),
  cursor (`V`). Draw by dragging; the tool returns to the cursor after each shape. Click within
  6px to select, drag the end handles to re-anchor, `Delete` to remove, `Esc` to cancel mid-draw,
  `✕` twice to clear all.
- **Drawings survive**: switch instrument and come back, reload the page, drag the scale — they
  stay on the same price and the same time. They are stored as `{t, p}` anchors, never pixels, so
  this is structural rather than patched.
- Verified in `REPLAY=1`: **19 of 19 acceptance checks pass, zero console errors**. Endpoints land
  within **0.048px** of `X(a.t)/Y(a.p)` recomputed from storage after a zoom drag to 0.46x; the
  crosshair pill equals `invY(pointerY)` to 2 dp; a click 5px away selects and 8px does not.
  12 screenshots reviewed in both themes.
- Branch **`p6-chart-tools`** is pushed. Two commits, `f733bae` and `5241f09`. **PR not opened.**

## Files changed
- `public/chart-tools.js` — **new.** The whole feature: scale, crosshair, hit-testing, the four
  tools, persistence, key hygiene. Kept out of `app.js`, which was already 811 lines.
- `public/app.js` — `drawChart()` now takes its transform from chart-tools so the price line and
  the drawings share one `X()`/`Y()`; drawings and crosshair inserted in the locked paint order;
  off-plot live-price marker guarded; paint time recorded for the verification script; `select()`
  sets the drawing scope; the keydown handler forwards the tools' keys first.
- `public/index.html` — the `.tools` button group in the chart header, plus the `#chartSurface`
  and `#chartAxis` pointer overlays.
- `public/app.css` — `.tools` reuses the existing `.range` button look; the two overlays; the
  `sure?` confirm state.
- `src/server/index.ts` — **`/chart-tools.js` added to the static allow-list.** Without this the
  module 404s and the whole client dies; the list is explicit on purpose (no path traversal).
- `docs/spec/chart-tools-v1.md` — **new.** 28 locked rows, out-of-scope list, 9 acceptance
  criteria, risks. The contract a future session builds from.
- `docs/spec/GLOSSARY.md` — **new.** plot area, price zoom, anchor, scope key, one-shot tool,
  handle, replay mode.
- `docs/PHASES.md`, `docs/DECISIONS.md` — P6 marked done, session log row, five decisions appended.

## Decisions made
- **Spec-locked before writing a line.** 27 rows approved with one `go`, then built. Two rows were
  added mid-build and both went back for approval instead of being absorbed: row 28 (pill dedupe)
  and the AC8 restatement.
- **AC8 was restated from `max` to `p95`, not quietly relaxed.** Profiling proved an 8ms *max* is
  unreachable with zero drawings on the page (0 shapes: p50 2.40 / p95 4.50 / max 6.40ms). Every
  future performance criterion in this project is stated as p95.
- **Anchors are (time, price).** See DECISIONS 2026-08-31 — this is what makes the done-when true
  by construction rather than by fixing up coordinates on every range change.
- **No vertical pan, no whole-shape drag, no undo.** All three are in the spec's out-of-scope list.
  Pan needs its own hit-test and would have doubled the phase; body-drag makes accidental
  displacement easy on a live chart; handles cover re-anchoring.
- **`window.__chart` is a deliberate read-only test seam** for the replay verification scripts.
  Nothing in the app reads it.

## Known broken / deliberately skipped
- **PR not opened** — pushing is as far as the rules go. `p6-chart-tools` is waiting.
- **`docs/shots/` still holds the 17 pre-P6 reference images.** None of them show the toolbar.
  Re-baselining needs `npm run shots`, which overwrites all 17, so it is a deliberate act — not
  something to run for a look.
- **One guard is not in the approved table**, and was reported rather than hidden: at `zoom < 1`
  the off-plot live-price dot and its dashed rule are dropped while the pill pins to the edge
  (`public/app.js` ~L713-722, six lines). Change it if you would rather clamp the dot too.
- **Everything live is still blocked.** `dataPlan: Deactive`, option chain returns `806`. P7, P8
  and P9 all sit behind it, and `src/server/feed.ts`'s binary packet parser has still never seen
  real bytes.
- **P8 and P9 specs are still NOT locked** — 15 open questions and one contradiction, listed in
  the 2026-08-28 handoff and in DECISIONS. No code for either until they are answered.
- A replay server was left running on **port 8787** at the user's request. `REPLAY=1`, synthetic
  data, no credentials touched.

## Next session starts here
- Phase 7: **peak-OI tracking** — but only after the Data API plan is active; until then the only
  unblocked work is spec-locking P8/P9 or re-baselining the screenshots.
- First command: `npm run check`
- Watch out for: **a valid token is not data access.** `DH-906` / `808` means the token is dead;
  `806` with `dataPlan: Deactive` means the token is fine and the *account* has no Data API plan,
  which no amount of re-pasting fixes. `npm run check` prints which of the two you are looking at.
