# HANDOFF — Dhan Terminal — Phases P31, P36, P37, P40–P42 — 2026-09-25

> Earlier handoffs are in git history: P33 `fc15c3f`, P31 `ab104bb`, P36/P37 `a8ccc05`.
> Branches are stacked: `p31-close-live` → `p36-sleep-proof` → `p37-backtest` → `p40-phone-sandbox` (current, pushed).

## Done
- **P31 / P33 AC6:** Thursday 24 Sep's live paper day was recomputed from Dhan's candles. Entries are correct. The exits were wrong because the laptop slept from 10:40 to 17:45. Priced from the candles the day is ₹2,28,672.50; the ledger shows ₹1,12,985 and was kept as the record.
- **P36:**
  - A sleep or restart of more than 60 s marks open legs `awaiting`, and they are priced from Dhan's 1-minute candle at the moment the exit was due (`repriced`).
  - The server keeps the PC awake from 09:10 to 15:35 while it trades.
  - All marketfeed calls go through one queue, which ends the `805` errors.
  - NIFTY's 17:55 candle is dropped.
- **P37:**
  - `npm run backtest` and a nightly job at 16:00 replay 21 sessions (26 Aug–24 Sep) over a 108-setting grid, with walk-forward.
  - The result: only real 09:20 scans count as evidence. NSE's OI figure cannot be rebuilt from futures OI.
  - Every live 09:20 scan is now saved.
- **P40:** every live paper entry and exit, a 09:30 digest and a 15:20 summary are pushed to the phone through ntfy. A test message was read back in 1.9 s.
- **P41:**
  - **Tick recorder:** from 09:14 to 15:31 it records about 2,300 instruments, plus every leg the live trader holds, into `.cache/ticks/<date>/`.
  - **Sandbox card on the Paper tab:** it replays a past day through the same `PaperTrader` without seeing ahead. It has day, speed and rule switches.
  - **Proof:** cutting the day at 11:00 gives identical decisions before 11:00, and two runs are identical.
- **P42:**
  - Stop-loss, a 2R target, skipping a frozen range, an OI-disagreement flag and a −₹50k daily loss cap.
  - Each can be switched per sandbox run. All are **off live**.
- **Tests:**
  - paper 104, sleep 37, backtest 31, phone 18, sandbox 17. tsc is clean.
  - The browser sweep at P36 found no regression.
  - The sandbox UI screenshots at 1440 dark and 1024 light were read.
- **Live server 8787:** build `53070dc`, PID 11752. The token is good until Fri 25 Sep 18:00 IST.

## Files changed
- `src/server/paper.ts`: blind-time catch-up, keep-awake rule, phone events, risk rules.
- `src/server/awake.ts` (new): `SetThreadExecutionState` through a child powershell that exits when the server dies.
- `src/server/dhan.ts`, `poller.ts`, `scanner.ts`: a per-key call queue, and the shared `marketfeed` key.
- `src/server/instruments.ts`, `ucandles.ts`: `sessionCloseMin`, and out-of-session candles dropped.
- `src/server/backtest.ts` (new, pure) and `src/server/history.ts` (new, Dhan I/O): the P37 engine, store and nightly job.
- `src/server/ticks.ts` (new): the tick recorder.
- `src/server/sandbox.ts` (new): the no-look-ahead sandbox (day loader, run, manager).
- `src/server/index.ts`: wiring for the recorder, pushes, sandbox routes, the nightly backtest, scan saving, and OI on paper candles.
- `public/index.html`, `app.css`, `paper.js`: the awaiting and repriced labels, the Sandbox card, read-only sandbox tables, SL/T and ⚑.
- `scripts/{sleep,backtest,phone,sandbox}-test.ts` (new), `scripts/backtest.ts` (new), `scripts/open-checks.ts`, `scripts/paper-test.ts` (sub-minute clock walk).
- `test/fixtures/paper-2026-09-24/`: 24 Sep's real candles and ledger.
- `docs/spec/{sleep-proof,backtest,phone-sandbox}-v1.md` (new), `orb-strategy-v1.md` (the AC6 result), `PHASES.md`, `DECISIONS.md`, `CLAUDE.md`.

## Decisions made
- The 24-Sep ledger was not rewritten. Corrected numbers live in the docs.
- Blind time is priced from Dhan's 1-minute candles, and a signal is priced whole or not at all.
- The backtest learns only from real 09:20 scans. Proxy days are always reported apart.
- Nothing the backtest or the sandbox learns changes live rules without the user's word. P42's rules start off live.
- Phone channel: ntfy (free, already set up). No free broker app accepts outside paper trades.

## Known broken / deliberately skipped
- **The live paper trader is DISARMED.** Something turned it off on 24 Sep between 19:56 and 23:28, and this session did not do it. **Nothing trades today unless the user presses Arm.** This is the user's decision.
- The recorder's first day (AC2) and P36's keep-awake over a real session are unmeasured until today's 15:31.
- P37's fill model misprices band jumps. The sandbox with ticks does not (POLICYBZR 1606).
- A synthetic sandbox day only has the 5 strikes around the 09:20 price, so a band-jump option leg may not fill there.
- `p32-verify.js` still asserts P32's rules and needs rewriting.
- The Open table at 1024 clips Entry/LTP/SMA9 by 1 px. This predates this session.
- The PC clock is 4.6 s slow. The user needs to run `w32tm /resync` as admin.
- `L` is bound twice; P9 `median20`; the post-close candles in SMA9. All three wait for the user.
- `assets/voice-recordings/Yash-Sir-23-09-2026-Recording-01.ogg` is untracked and was not played (no audio tool). P33 implements its transcript.

## Next session starts here
- Next session: after today's close (Fri 25 Sep, 15:31), read the first recorded tick day and today's live paper trades.
  1. Replay today in the Sandbox against the recorded ticks and compare with the live ledger (AC2).
  2. Check `[backtest] done` in the log.
  3. Then P43, once the user defines how the calculators combine.
- First command: `curl -s http://127.0.0.1:8787/api/paper` (it must say `"armed":true` if the user armed it), then `cat .cache/ticks/2026-09-25/summary.json`.
- Watch out for: the token expires **Fri 18:00 IST**. The server renews it from 06:00–09:00 or after 15:45, but only while awake. If the laptop sleeps through both windows, Monday's run dies.
