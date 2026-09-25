# HANDOFF — Dhan Terminal — Phase P48 — 2026-09-25

> The previous handoff (P47 and the LTP index plan) is at `1b39f9d`. Branches are stacked:
> … → `p47-nifty-chain-recorder` → **`p48-chain-rebuild`** (current, pushed).

## Done
- **NIFTY's past option chains are rebuilt minute by minute:** 680 sessions, 2024-01-01 → 2026-09-25, 163 MB.
  - Files: `.cache/history/chains/NIFTY/<date>-W1.json.gz`, plus `-W2` from 16 Sep 2026, and `index.json` with each day's summary and expiry labels.
  - Each day holds ATM−10…+10 strikes × CE/PE, with OHLC, volume, OI and IV per minute, and spot and ATM per minute.
  - Read a day with `readDay(date)` from `src/server/chainhist.ts`.
- **`npm run chainhist`** fetches only what is missing (it made 0 calls on the re-run). It refuses in replay mode and below 2 GB free, and it makes up to 3 passes over months that failed.
- **The endpoint is now measured and documented** (spec M1–M8, CLAUDE.md):
  - `expiryCode` starts at 1;
  - ±10 is the ceiling, and ±11 returns empty, not an error;
  - volume is in units.
- **AC2 PASS:** summed minute volume vs NSE's bhavcopy is off by at most 0.0104% (W1, 38 legs) and 0.0191% (W2, 36 legs).
- **AC4 PASS:** 0 calendar errors over 680 sessions and 143 expiries. Before the fix it found a real one: **Diwali 2025 expired Mon 20 Oct, not on the Muhurat Tuesday 21 Oct.**
- **AC5 printed:**
  - median 34 legs covered all day;
  - 7 of 680 days (1.0%) moved more than 10 strikes; the worst was 4 Jun 2024, election results.
- **Tests:** `chainhist:test` 50/50. Every other suite is green: ltp 29, session 11, paper 104, sleep 37, backtest 31, train 43, chainrec 18, phone 18, sandbox 17, oq1 ok. tsc is clean.
- **The token renewed itself at 20:38 IST.** It now expires **Sat 26 Sep 20:39 IST**, and the live server on 8787 (PID 19840, ARMED) renews it again from Sat 08:39 if the laptop is awake.

## Files changed
- `src/server/chainhist.ts` (new): fetch, stitch, resume, the expiry calendar (with special sessions) and the pure recording comparison for AC3.
- `scripts/chainhist.ts` (new): the `npm run chainhist` CLI, with up to 3 passes.
- `scripts/chainhist-verify.ts` (new): `--bhav`, `--expiries`, `--coverage`, `--recording <date>`.
- `scripts/chainhist-test.ts` (new): 50 checks without the network.
- `package.json`: `chainhist`, `chainhist:verify`, `chainhist:test`.
- `docs/spec/chain-rebuild-v1.md` (new): locked, with amendments A1–A4, results and findings.
- `docs/PHASES.md`: the P48 row, Now, and Next 3.
- `CLAUDE.md`: the rollingoption facts, the Diwali expiry lesson, and the `notify:test` trap.

## Decisions made
- `WEEK 1` over the whole history; `WEEK 2` only from Sep 2026, where P47 records a second expiry. The full `WEEK 2` history would double the disk and nothing reads it yet.
- It is a CLI run by hand after 16:00, not wired into the live server. That would be a second 16:00 job, and a board row of its own.
- **A special session (< 200 candles) is never an expiry day** (A4). Measured: special sessions have 60–107 candles, regular ones ≥ 371.
- AC4 uses two data signals, each cut at its own largest gap, and a label is an error only when both contradict it (A3). The single-signal "no overlap" rule was unpassable noise over 676 pairs.

## Known broken / deliberately skipped
- **AC3 (against P47's recording) is open.** The first recorded session is Mon 28 Sep, so it cannot be measured before 15:31 that day.
- `WEEK 2` for 1–15 Sep 2026 is not stored. Dhan returned only 14 of 42 series for those days, and nothing needs them.
- 18 May 2024 (a Saturday DR session) has 90 conflicting cells. It is flagged in `index.json` and left as is.
- **`npm run notify:test` was run twice in the regression loop, and it sent two real test pushes to the phone.** Recorded in CLAUDE.md.
- Carried over: P47 AC5; P56 intraday OI; a closed lid still sleeps the laptop; `L` is bound twice; P9 `median20`; `w32tm /resync`; the untracked voice recording; P45; `package-lock.json` is modified but not by this session (left alone).

## Next session starts here
- Phase P48 close (AC3), then P49: the LTP state machine over `readDay()` chains.
- First command: on **Mon 28 Sep after 16:00**, run `npm run chainhist`, then `npm run chainhist:verify -- --recording 2026-09-28`. During the session, P56's `node --env-file=.env .cache/nse-vs-dhan-chain.ts` runs at 10:00, 11:00 and 12:00.
- Watch out for: the token. It expires Sat 20:39 IST unless the laptop is awake Saturday morning for the renewal. If `npm run check` is not READY on Monday by 09:10, nothing records and nothing trades.
