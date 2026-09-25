# HANDOFF — Dhan Terminal — Phase P49 — 2026-09-25

> The previous handoff (P48) is at `3e8997c`. Branches are stacked:
> … → `p48-chain-rebuild` → **`p49-ltp-state`** (current, pushed).

## Done
- **`npm run ltpstate -- <date>`** prints the LTP state machine's timeline for any rebuilt NIFTY day.
  - Each line shows both levels: strike, grade, state, pressure, percentage and SOC.
  - Then the COA 1.0 verdict, the Game of Percentage (on scenarios 8/9) and the IV gate.
  - `npm run ltpstate` (no date) prints counts over all 680 stored days in about 40 s.
- **`npm run ltpstate:test` 45/45.**
  - AC1–AC6: hand-built minutes for every rule, each rule also shown rejecting something.
  - AC7: a second, look-back implementation agrees on **254,080 minutes over 680 days with 0 mismatches**, and the comparison is shown to catch a swapped rule.
  - AC8: every state, scenario, SOC stage, shift cause, GoP value and IV value occurs on real data (26/26).
  - AC9: 4 Jun 2024 turns IV `moving` at 09:22.
  - AC10: deterministic, no Dhan call, no clock.
- AC11: tsc clean, `ltp:test` 29/29, `chainhist:test` 50/50.
- **Findings, recorded in the spec's Result section:**
  - Confirmed SOC on 504 of 679 days.
  - V104's one-point IV rule reads `unbalanced` 70% of minutes.
  - 44% of shifts are re-seats.
  - Scenarios 6/7/9 are 77% of minutes; neutral is 1%.

## Files changed
- `docs/spec/ltp-state-v1.md` (new): 22 rows, 11 ACs, measurements before the spec, Result section.
- `src/server/ltp-state.ts` (new): the pure engine — `observeDay`, `stepSide`, `stepDay`, `runDay`. It reuses P29's `readChain()` unchanged.
- `scripts/ltp-state.ts` (new): the `ltpstate` CLI (one day's timeline, or counts over all stored days).
- `scripts/ltp-state-test.ts` (new): AC1–AC10, including the look-back second implementation.
- `package.json`: `ltpstate`, `ltpstate:test`.
- `docs/PHASES.md` (P49 row, Now, Next 3), `docs/DECISIONS.md`, `docs/spec/GLOSSARY.md` (pressure, shift / re-seat, SOC).

## Decisions made
- The pressure is stored and the label derived from it. Rules stay in strike space (P29 row 5), despite V75's "25,000 → 24,900 bottom to top".
- No debounce on shifts. Both sides bearish = scenario 6.
- Three GUESS rows, open to veto:
  - row 8: a re-seat counts as a shift;
  - row 16: the Game of Percentage looks back 5 min with a 1.0-point dead-band;
  - row 20: IV counts as moving at 2.0 points from its 09:20 value.
- History only: no UI, no live wiring, until the rules are checked against the tool's banner.

## Known broken / deliberately skipped
- **There is no ground truth.** Every AC proves the code does what the spec says, not that the spec matches the LTP Calculator. Rows 8, 15 and 19 are the likeliest to be wrong, given the frequencies above.
- **P48 AC3 is still open**: Mon 28 Sep after 16:00.
- Skipped on purpose: the UI panel, live poller wiring, OQ-3 (how far an SOC runs, withheld by the source), OQ-12 (V39's WTB constraint, one file only), and W2 chains.
- Carried over from P48: P47 AC5; P56 intraday OI; a closed lid still sleeps the laptop; `L` is bound twice; P9 `median20`; `w32tm /resync`; the untracked voice recording; P45; `package-lock.json` modified but not by this session (left alone).

## Next session starts here
- **Phase:** Mon 28 Sep's measurements (P56 at 10/11/12, then P47/P46/P41 after 15:31, then P48 AC3 after 16:00). After that, P50 (line sets) or the ground-truth check of P49, whichever the user picks.
- **First command:** `npm run check`, on Monday before 09:10. It must say READY or nothing records.
- **Watch out for:** the token expires **Sat 26 Sep 20:39 IST** unless the laptop is awake on Saturday morning for the renewal (live server on 8787, PID 19840).
