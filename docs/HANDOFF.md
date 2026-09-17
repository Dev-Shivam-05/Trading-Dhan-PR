# HANDOFF — Dhan Option Chain Terminal — Phase 12 (prep only, still blocked) — 2026-09-17

## Done
- **`npm run live:probe` exists.** Once the token and the Data API plan are both good, one command
  makes five serial calls and prints a PASS / CHECK / FAIL line for each question P7, P8 and P9
  guessed about Dhan's responses:
  - **Intraday candles:** which date format Dhan accepts, the envelope, the seven parallel arrays,
    seconds vs milliseconds, and whether today's candles arrive.
  - **Open interest:** whether `open_interest` is in units or contracts, and whether it is in the
    same unit as the chain's `oi`.
  - **Hand checks:** P7's peak and P8's closing OI, re-derived by hand and compared with the app.
  - **Quote:** coverage of the scanner's real 420-instrument body, and what `net_change` and
    `ohlc.close` mean.
  - **Raw bodies** are saved to `.cache/live/<date>-*.json`, so the evidence outlives the token.
- **On a bad token it stops cleanly.** It prints which gate failed and the fix, exits 1 and writes
  nothing. With no credentials it exits 2.
- **Its verdict logic is proven offline:** 36/36 branches against replay payloads and deliberately
  broken ones (`.cache/p12-shape-selftest.ts`, run with `REPLAY=1 node .cache/p12-shape-selftest.ts`).
- **`dhan-api-contract.md` now documents the two endpoints** P7, P8 and P9 depend on (§2.5
  intraday, §2.6 quote), read from Dhan's docs, with every open question listed.
- **None of P12's done-when criteria are met.** The token in `.env` is still the one that expired
  on 2026-08-28.

## Files changed
- `scripts/live-probe.ts` — **new.** The runner: gates first, then chain → intraday → quote, raw
  bodies saved, exits 0/1/2.
- `scripts/live-shape.ts` — **new.** Pure verdict functions (`intradayReport`, `quoteReport`) with
  no network access, so they can be tested without a plan.
- `package.json` — the `live:probe` script.
- `docs/spec/dhan-api-contract.md` — §2.5 and §2.6 added, with the date-format discrepancy flagged.
- `docs/PHASES.md` — the P12 status note, `## Now`, `## Next 3`, a session log row.
- `docs/DECISIONS.md`, `CLAUDE.md`, this file.

## Decisions made
- **A `go` on a blocked phase became the credential-free half of it, and P12 stays `blocked`.**
  Nothing here meets a done-when criterion, and the board says so.
- **`fetchIntraday()`'s date format was not changed on documentation alone.** The docs *show*
  `YYYY-MM-DD HH:MM:SS` but never say date-only is rejected. The probe sends the app's form first
  and retries with the documented one only on `DH-905`, so the first live call decides it.
- **The probe re-derives dates through `Intl` (`Asia/Kolkata`) and digit counts, not the app's
  `+05:30` arithmetic and `>1e11` test.** A hand check that shares the app's date code cannot catch
  a bug in it.
- **`resolveRegistry({})` is called without credentials in the probe.** With credentials, an
  unresolved GOLD chip spends calls that the "five calls" claim does not account for.

## Known broken / deliberately skipped
- **Everything past the login check is unrun live**, because the token expired on 2026-08-28. The
  data-plan gate (`806`) cannot even be observed until the token is fresh.
- **The likely date-format bug in `src/server/peakoi.ts:181` is unfixed**, because the evidence is
  docs-only and the probe settles it in one call.
- **`npm run feed:probe`, the P7/P8/P9 screens on live data, and P8's AC5** are all untouched. They
  need the plan, and AC5 also needs 09:15–15:30 IST.
- **Eight stacked branches, no PRs.** Merge order: `p6-chart-tools`, `p8-p9-spec-lock`,
  `p7-peak-oi`, `p8-scanner`, `p9-option-candles`, `p10-spec-lock`, `p10a-terminal-shell`,
  `p12-live-verify`.
- **`assets/voice-recordings/` is untracked and was not touched.** It is not this session's work.

## Next session starts here
- Phase P12 (still): paste a fresh token, confirm both gates, then run both probes and fix what
  they report — ideally on a weekday during 09:15–15:30 IST, so AC5 can be measured in the same
  sitting.
- First command: `npm run check`, then `npm run live:probe` once it says READY.
- Watch out for: **a READY from `npm run check` is not the finish line.** If `live:probe` prints
  `FAIL date format`, change `fetchIntraday()` before driving any P7/P8/P9 screen live. Otherwise
  every candle-backed column reads as "request failed" and looks like a plan problem.
