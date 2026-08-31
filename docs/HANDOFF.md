# HANDOFF — Dhan Option Chain Terminal — Phase 7 (peak-OI tracking) — 2026-08-31

## Done
- **The grid has a `Pk %` column on both sides**, between `OI` and `OI Chg`, showing live OI as a
  percentage of **yesterday's peak** OI — not `previous_oi`, which is yesterday's *close* and is
  always the smaller number. Crossing the peak turns the cell amber with a `▲`; the OI bar carries
  a 1px marker where the peak sits; the exact figure is in the cell's tooltip
  (`peak 4.21 L at 13:45 · 28 Aug`).
- **A `Breached` toggle (keyboard `P`)** hides every row where neither side has crossed. It **ANDs**
  with the strike search — Breached + `23950` shows one row, not the union.
- **The peak comes out of `max(open_interest)` over the previous session's 1-minute candles** from
  `POST /v2/charts/intraday`. The previous *trading* session is derived from the candle data (the
  latest IST date before today that has candles), so there is no holiday table and no `today - 1`.
  Today's candles arrive in the same window and are discarded by date.
- **The backfill is progressive and visible**: ~82 contracts for a 41-strike chain, ATM-outward,
  behind a `PEAK OI 9 / 82` chip that hides itself when complete. All calls share one rate-gate key
  so they run strictly serially at 1 req/s; results cache to `.cache/peak-oi.json` under
  `(sessionDate, securityId)` and are never re-fetched.
- **The breach follows ticks, not just polls.** The OI cell updates at 10 Hz from the feed while the
  chain polls at 3 s, so `Pk %` is recomputed in `applyCellTick` from the same number.
- **Verified in replay: 23/23 checks** (7 against the SSE payload, 16 in the browser). Peak equals
  the hand-computed max **to the unit** (52,884 = 52,884 over 375 candles); a today-dated candle at
  **99x** does not move it; exactly **5** breached cells (3 CE, 2 PE) at the seeded offsets; `Pk %`
  agrees with the OI cell and the tooltip on **all 82** cells; chain cadence held at **min 3133 ms
  per key** across the backfill; zero console errors; six screenshots reviewed in both themes.

## Files changed
- `src/server/peakoi.ts` — **new.** The store: session-date derivation, `peakFrom()` (the one place
  a peak is computed, shared by the live and replay paths), the serial queue, the disk cache, and
  the progress listener.
- `src/server/poller.ts` — peaks ride the snapshot (`peaks`, `peakProgress`, `peakSessionDate`,
  `peakNote`); `track()` is fired and never awaited so the 3 s cadence cannot slip; `refreshPeaks()`
  re-emits the last snapshot as contracts land.
- `src/server/replay.ts` — synthesises the **candle series** (not the peak), seeded to 3 CE + 2 PE
  breaches; `oiBaseAt()` extracted so the chain and the peak share one base; chain OI drift made
  proportional.
- `src/server/instruments.ts` — `optionInstrument()` / `underlyingInstrument()`, read from the
  registry rather than re-derived, so `OPTIDX` / `OPTSTK` / `OPTFUT` cannot drift.
- `src/server/feed.ts`, `src/server/index.ts` — replay tick OI seeded from the snapshot
  (`oiBase` on the subscription) and random-walked instead of redrawn at random every tick.
- `public/app.js` — `pkCell()` (one place the ratio and the breach are decided), the column, the
  peak marker, the filter, the chip, and the tick-path update. `CELL` indices moved: 25 columns now.
- `public/app.css` — table min-width 1392 -> **1484px**, `td.pk` / `.breach`, `.pkmark`, `.tog`.
- `public/index.html` — two `Pk %` headers, `colspan` 11 -> 12 both sides, the chip and the toggle.
- `docs/spec/peak-oi-v1.md` — **new.** 22 rows (20 locked up front, 21-22 added during the build and
  marked as such), out-of-scope list, 9 acceptance criteria, a measured verification table, 5 risks.
- `docs/PHASES.md`, `docs/DECISIONS.md` (5 entries), `docs/spec/GLOSSARY.md` (3 terms),
  `CLAUDE.md` (3 traps).

## Decisions made
- **"Yesterday" is read off the candle data, never off a calendar.** `today - 1` is wrong every
  Monday and every exchange holiday; a hardcoded holiday table is wrong the first time the exchange
  changes one. One call on the *underlying* settles it per instrument per day, because the trading
  calendar belongs to the exchange, not the contract.
- **One rate-gate key (`peak:oi`) for the whole backfill.** `waitForSlot` gates per key, so the
  obvious `peak:<securityId>` would have dispatched all 82 contracts simultaneously. Same pattern
  P8's spec already locked.
- **Replay synthesises the candle series, not the peak.** Handing the peak over directly would have
  made the headline acceptance criterion compare an asserted number to itself.
- **Two rows added mid-build (21, 22), both marked as amendments in the spec** — the progress push
  and the replay OI anchoring. Both were found by testing, not by reading.
- **Nine code files, one over the ~8 guideline, taken knowingly.** The two replay-feed files were
  not optional: without them P7's acceptance criteria could not be measured in the only mode
  available.

## Known broken / deliberately skipped
- **The live path has never run.** `npm run check` reports `808` / `DH-901`: the token expired
  2026-08-28, and the account still has no Data API plan. **Every number in the verification came
  from synthetic candles.** Three things in `peakoi.ts` are assumptions until one live call lands:
  the response shape (the reader accepts a flat body *and* a `data` wrapper), that `timestamp` is
  epoch **seconds** (values above 1e11 are treated as ms), and that `IDX_I` / `MCX_COMM` are
  accepted by `/v2/charts/intraday` at all.
- **44px of horizontal scroll at 1440px.** Priced in spec row 20 before it was built; the offered
  trade is dropping `Vol Chg%` (56px x 2). Not taken — P10 owns the final column layout.
- **`open_interest` units (contracts vs units) unconfirmed.** Affects only the tooltip's absolute
  figure, never the ratio or the breach.
- **~82 calls per (instrument, expiry, day) cold.** Contained to instruments actually being viewed,
  and cached to disk, but if Dhan enforces a daily quota this is the phase that will find it.
- **`docs/shots/` still holds the 17 pre-P6 reference images.** Still P10's problem.
  `npm run shots` overwrites all 17 — never run it for an ad-hoc check.
- **Three branches pushed, none with a PR.** They are stacked: merge `p6-chart-tools`, then
  `p8-p9-spec-lock`, then `p7-peak-oi`, in that order.

## Next session starts here
- Phase 8: **the 9:20 F&O scanner** — spec-locked in `docs/spec/scanner-v1.md` (17 rows), and its
  OI baseline is the same endpoint and the same shared 1 req/s slot key `src/server/peakoi.ts`
  already implements. The one prerequisite before any scanner code: **add `FUTSTK` to
  `KEEP_INSTRUMENTS` in `src/server/master.ts`**, or stock futures OI is unreachable and the third
  filter cannot work.
- First command: `npm run check`
- Watch out for: **a valid token is not data access.** `DH-906` / `808` means the token is dead;
  `806` with `dataPlan: Deactive` means the token is fine and the *account* has no plan, which no
  amount of re-pasting fixes. Second trap: **P7 looks finished but has never met real data** — if
  the plan goes active, spend the first call on `/v2/charts/intraday` and check the response shape
  against `Candles` in `peakoi.ts` before trusting a single peak on screen. Third: **do not start
  P10.** It runs after P9, by instruction.
