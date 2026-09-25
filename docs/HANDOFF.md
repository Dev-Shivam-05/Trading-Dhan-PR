# HANDOFF — Dhan Terminal — Phase P47 (plus the LTP index plan) — 2026-09-25

> The previous handoff (P44, P41 AC2, P46) is at `beab298`. Branches are stacked:
> … → `p40-phone-sandbox` → `p44-train-all` → **`p47-nifty-chain-recorder`** (current, pushed).

## Done
- **The LTP index plan is written:** `docs/plan/ltp-index-intraday.md`.
  - It is built from the finished `LTP-CALCULATOR/ANALYSIS/`, and no source file is newer than that analysis.
  - The user's screenshot (CONCOR historical chain) was decoded. Both of its percentages reproduce to 2 dp (787.5/1,036.25 = 76.00%, 178.75/221.25 = 80.79%), which confirms P29's 75% grading.
  - P47–P55 are boarded.
- **Dhan's Expired Options Data (`POST /v2/charts/rollingoption`) works.** Three probes returned 1-minute strike, spot, OHLC, volume, OI and IV for ATM through ATM+10, with 31 days in one call, back to at least Jan 2024. So past NIFTY chains can be rebuilt (P48).
- **P47 is built:** the NIFTY chain recorder. From Monday, from 09:14 to 15:31:
  - every 3 s `ChainPoller` snapshot of NIFTY's current and next expiry is appended to `.cache/chains/<date>/NIFTY-<expiry>.jsonl`;
  - it keeps ±20 strikes around the ATM, as tuples, about 30 MB raw per expiry per day;
  - it calls no new endpoint;
  - `summary.json` is written at 15:31, and `npm run ticks:pack` packs the day.
- **Tests:**
  - `chainrec:test` 18/18.
  - Two real snapshots mapped with 0 mismatched rows (`.cache/p47-live-shape.ts`).
  - Pack checked on a scratch CACHE_DIR.
  - Regression all green: train 43, sandbox 17, paper 104, ltp 29, sleep 37, phone 18, backtest 31, session 11. tsc is clean.
- **Live server on 8787: PID 19840, build `5e8b519`, ARMED, `check` READY.** It was started **detached** (`Start-Process cmd /c npm run dev`), so it outlives the session. The one before it died when the last session's process ended.

## Files changed
- `src/server/chainrec.ts` (new): the recorder. It is testable with fake pollers and the clock is injected.
- `src/server/index.ts`: wires the recorder beside the tick recorder, live only.
- `scripts/chainrec-test.ts` (new) and `package.json` (`chainrec:test`).
- `scripts/ticks-pack.ts`: also packs closed chain days, with the same SHA-256 check.
- `docs/spec/chain-recorder-v1.md` (new), `docs/plan/ltp-index-intraday.md` (new), `docs/PHASES.md`, `docs/DECISIONS.md`.

## Decisions made
- **The user: NIFTY only.** ₹20,000 per index trade, with lots from the option's price and at least 1 lot. In a formula: lots = max(1, floor(20,000 / (premium × lot))), and a trade is flagged `over budget` when one lot costs more.
- **LTP Calculator 7-day premium:** buy it only after P48 and P49 exist, to calibrate the reversal price (OQ-1) and the scenario labels against their screen.
- **No GitHub repo or developer docs were found** for the LTP Calculator. Researching their documentation is P55.
- ±20 strikes kept per snapshot (a design choice with a reason, in spec row 3).

## Known broken / deliberately skipped
- **P47 AC5 (a full live day) is unmeasured until Mon 28 Sep.**
- **The token expires Sat 26 Sep 08:35 IST.** It renews only if the laptop is awake after about 20:35 tonight or during the weekend. Otherwise paste a new one Monday before 09:10.
- The laptop was on battery earlier today.
- P46's display hold is still unproven.
- A closed lid still sleeps the laptop.
- The sandbox treats a partial recording as a whole day.
- The scratch test directory `.cache/p47-test2/` was left in place, because deleting it was refused by the permission check. It is gitignored and harmless.
- Carried over, waiting on the user: `L` is bound twice; P9 `median20`; post-close candles in SMA9; `w32tm /resync`; the untracked voice recording; P45 (shadow book of P44's recommendation).

## Next session starts here
- Phase P48: rebuild NIFTY's past minute chains from `rollingoption` and check them against Monday's P47 recording (spec-lock first).
- First command: `cat .cache/chains/2026-09-28/summary.json` (after 15:31 on Monday; before that, `curl -s http://127.0.0.1:8787/api/health`).
- Watch out for: the token. If `npm run check` is not READY on Monday morning, nothing records and nothing trades.
