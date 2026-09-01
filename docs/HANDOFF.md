# HANDOFF — Dhan Option Chain Terminal — Phase 9 (option candle colouring) — 2026-09-01

## Done
- **Clicking the CE half or the PE half of a strike row charts that one contract's own candles.**
  The existing chart strip switches mode — one strip, one grip, one paint budget. Header reads
  `NIFTY 50 24,100 CE · 01 Sep` with a `← underlying` button; `Esc` also leaves. The charted half
  of the row carries a `var(--ring)` outline that survives the 3 s snapshot re-render.
- **Candles are recoloured blue where a big player is entering the strike and yellow where one is
  exiting** — `vol >= 3.0 × median20` **AND** `|dOI| >= 5% of oi[i-1]` **AND** `|dOI| >= 5 × lot`,
  with `dOI > 0` blue and `dOI < 0` yellow. Two legend chips in the header, so the colour is never
  guessed.
- **The in-progress candle is never coloured.** A colour that appears and then vanishes mid-candle
  is a false signal, so only closed candles are judged.
- **The tooltip prints the exact inputs the colour was computed from** — O/H/L/C, volume,
  `median20`, `vol / median` against its threshold, OI, `oi[i-1]`, `ΔOI` and `ΔOI %` against both
  of theirs, and `fired: blue / yellow / no`. This is what makes the acceptance criteria checkable
  by hand rather than by trusting the code that ran them.
- **Interval switchable 1 / 5 / 15 min**, persisted, re-fetching and re-colouring with nothing
  stale left on screen. Re-fetch also every 60 s while an option chart is open.
- **An illiquid contract gets a named empty state**, not an error and not a blank chart:
  `no trades in this contract today — NIFTY 50 23,100 PE`.
- **Verified in replay: 22/22 checks**, zero console errors. Every acceptance criterion passed;
  none was scored `n/a`.

## Files changed
- `src/server/candles.ts` — **new.** The rule in one place, over the whole 5-day window; the
  `/v2/charts/intraday` request; the latest-session cut; per-`(contract, interval)` rate-gate key;
  in-flight dedupe.
- `src/server/replay.ts` — `replayOptionCandles()`: multi-day seeded series anchored to the same
  `oiBaseAt` the chain and P7's peaks use, with 3 blue, 2 yellow and one volume-only candle
  designated by **fraction of the session** so the counts hold at 1, 5 and 15 min alike.
- `src/server/index.ts` — `GET /api/candles` with parameter validation, and the `candles.js`
  `STATIC` row.
- `public/candles.js` — **new.** The panel: row click, mode switch, candlestick renderer, tooltip,
  interval group, 60 s refresh, `window.__candles` test seam.
- `public/app.css` — `--big-in` / `--big-out` and their derived `-line` strokes in all three theme
  blocks; the `.opt` / `.tickonly` display toggles; the tooltip; the selected-half outline.
- `public/index.html` — the option-mode header items, the second `<svg>`, the script tag.
- `public/app.js` — three small hooks: dispatch `chain-scope` / `chain-render`, return early from
  `drawChart()` in option mode, and **carry `tickonly` through the two wholesale `className`
  assignments** (see the bug below).
- `docs/spec/option-candles-v1.md` (3 amendment rows, a 16-row verification table, 3 risks),
  `docs/PHASES.md`, `docs/DECISIONS.md` (4 entries), `docs/spec/GLOSSARY.md` (4 terms),
  `CLAUDE.md` (2 traps).

## Decisions made
- **The option chart is a second `<svg>`, not a second branch inside `drawChart()`.** Folding it in
  would put a whole second renderer inside a function four phases depend on; importing `candles.js`
  from `app.js` would make an ESM cycle, because `candles.js` imports the number formatters the way
  `scan.js` does. `body.optmode` decides which renderer is on screen and three `CustomEvent`s carry
  the handover, so `app.js` still imports nothing downstream of itself.
- **`now` is an argument to the rule, not `Date.now()`.** On a closed market — almost every session
  on this project — no seeded candle is ever still forming, so row 11's branch is unreachable and
  AC4 would pass vacuously. Replay injects the last seeded candle's open + 1 s. Recorded as
  amendment row 21, not left implicit.
- **The fixture's volume spike is 8× the top of the ordinary band, not a multiple of a median it
  computed itself.** A fixture that recomputed the production median would reproduce a bug in
  `medianOf()` identically on both sides and pass. Same principle as P7 synthesising a candle
  series instead of a peak, and P8 designating survivors by rank instead of by name.
- **Only the latest session is drawn**, with the earlier days feeding `median20` and then dropped.
  Rows 3, 12 and 18 imply it and none of them says it, so it became row 20 rather than an
  implementation choice — the acceptance criterion depends on the answer.
- **Seven code files**, inside the ~8 guideline.

## Known broken / deliberately skipped
- **The live path has never run.** `dataPlan: Deactive`; every number came from synthetic candles.
  Three assumptions ride on the first live call: the `/v2/charts/intraday` response shape for
  `OPTIDX` / `OPTSTK`, whether Dhan really retains 5 days of per-candle OI for an option contract,
  and **the `open_interest` unit** — row 7's floor is `5 × lotSize` = 325 for NIFTY if OI is in
  units and must become **5** if it is in contracts.
- **A fired candle with a flat body renders as a one-pixel mark.** The wick carries the colour too,
  so it is visible, but a doji that fires reads as a thin line rather than a coloured candle. The
  seeded price walk is independent of the OI seeding, so it happens here; on live data a 12% OI
  move usually carries a real price move. Look at it with live data before adding a minimum body
  height — the header count (`3 blue · 2 yellow`) is the disclosure until then.
- **Drawing tools are not available on the option chart** (row 17, deliberate). Anchors are
  `(t, p)`, so it stays possible later without rework.
- **P8's AC5 is still the one open criterion in the project** — the chain poll's 3000 ms gap across
  a scan. It needs an open market and a live plan; replay makes no `dhanPost` calls at all.
- **`docs/shots/` still holds the 17 pre-P6 reference images.** Still P10's problem. `npm run shots`
  overwrites all 17 — never run it for an ad-hoc check.
- **Five branches pushed, none with a PR.** Stacked: merge `p6-chart-tools`, then
  `p8-p9-spec-lock`, then `p7-peak-oi`, then `p8-scanner`, then `p9-option-candles`, in that order.
- A dev server may still be running on port 8787 from this session's verification.

## Next session starts here
- Phase 10: **the TradingView-style terminal redesign** — and it is **not** spec-locked. Every
  recording-derived phase is now built, so P10 is next by the user's own ordering, but the row in
  `PHASES.md` says ~12 files against the 8-file rule and "TradingView-like" is three undefined
  adjectives. **Spec-lock it first and split it into P10a / P10b at lock time.** Do not open a UI
  file before the table exists.
- First command: `npm run check`
- Watch out for: **P10 rewrites a screen carrying eight phases of passing acceptance criteria.**
  Its own done-when says every P2–P6 criterion must still pass afterwards, and P7's column, P8's
  overlay and P9's chart mode all live on that screen too. Before touching layout, read
  `option-candles-v1.md` row 2 and `scanner-v1.md` row 12 — both phases deliberately reuse the one
  chart strip and the one grid, and a redesign that splits either of them reopens both.
  Second: **a valid token is not data access** — `DH-906` / `808` means the token is dead, `806`
  with `dataPlan: Deactive` means the account has no plan and re-pasting tokens will not fix it.
