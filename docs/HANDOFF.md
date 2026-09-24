# HANDOFF — Dhan Terminal — P31 read, P36 and P37 built — 2026-09-24

> P33's handoff is in git history at `fc15c3f`. The P31-only version of this file is at `ab104bb`.

Branches: **`p31-close-live`** (docs, cut from `p33-orb-strategy`), then **`p36-sleep-proof`** (cut from it).
The user said `go` twice in one session: first to boot P31, then to lock and build P36. Two phases in one session,
at the user's word.

## Done
- **P31 / P33 AC6.** Thursday's live paper day was recomputed from Dhan's candles. The entries are right. The exits were
  wrong because the laptop slept from 10:40 to 17:45 (details are on the P31 row and in `orb-strategy-v1.md` AC6). The
  open-session run scored 19 pass / 2 fail / 3 open.
- **P36 built** (`docs/spec/sleep-proof-v1.md`):
  - **Blind time.** A gap longer than 60 s, either between the trader's 1 s steps or since `aliveAt` on restart, marks
    every open leg `awaiting`. Ticks and 15:15 then leave those legs alone. The catch-up walks the 5-minute candles
    (capped before 15:15) to find what came due, then closes each leg at its own 1-minute candle open at that instant.
    It is marked `repriced`, and the note names the gap. A failed read retries at 60 s. A date change closes the leg
    `stale`, with a note.
  - **Keep awake.** While armed on a weekday, 09:10–15:35, until the scan is done or while any leg is live, a child
    `powershell` holds `SetThreadExecutionState(ES_CONTINUOUS|ES_SYSTEM_REQUIRED)`. It is live only, and it exits when
    the server dies.
  - **One marketfeed gate.** `dhanPost` now queues per key: in-flight calls first, then the cadence. The scanner's quote
    and the spot quote share key `marketfeed` at 1000 ms.
  - **Out-of-session candles.** `ucandles` drops candles at or after the session close + 10 min. NIFTY's 17:55 is gone.
  - Paper screen: `awaiting price` and `· repriced`, with the details in tooltips.
- **Verified:** `sleep:test` 37/37 on the real 24-Sep candles; totals 2,28,672.50 by two implementations. `paper:test`
  104/104, tsc clean, ltp 29, session 11, chart 25, oq1 5. AC6 was checked live, and `p29-chart-live` is all PASS on NSE
  tonight. Screenshots were read. The browser regression sweep is at the bottom.
- **Live server on 8787 is P36** (build `9db344e`; the UI tweak `9043a52` is served from disk), PID 10348. It is ARMED for
  Fri 25 Sep, and the token is good until Fri 18:00 IST.

## Files changed (P36)
`src/server/{paper,dhan,poller,scanner,instruments,ucandles,index}.ts`, the new `src/server/awake.ts`,
`public/paper.js`, `scripts/{sleep-test,paper-test}.ts`, `package.json`, `docs/spec/sleep-proof-v1.md`, and
`test/fixtures/paper-2026-09-24/` (P31's real candles plus the ledger as it closed). **That is 11 code files, over the
~8 guideline.** The six rows were locked as one unit.

## Decisions made
- **`GAP_MS = 60 s`** (GUESS, from the 1-minute repricing resolution). Recorded in the spec.
- **Keep-awake also covers the time before the scan** (amendment 7). The row as proposed would not have covered 09:20.
- **A signal is priced whole or not at all** (amendment 9).
- **`paper:test`'s clock now walks in sub-minute steps** (amendment 10). A 5.5 h jump is now, correctly, a blind gap.

## Known broken / deliberately skipped
- **P36's live half is unmeasured**: keep-awake through a real session, and P8 live, which should no longer `805`.
  Friday's session measures both.
- `powercfg /requests` needs admin. The flag was proven through `SetThreadExecutionState`'s return value instead.
- **An entry missed during a gap** still fills at the first tick after wake. No row covers it; that is the user's call.
- **The Open table at 1024 clips Entry/LTP/SMA9 by 1 px.** It predates P36. A fix means choosing a column width.
- Carried: the PC clock is 4.6 s slow (row 6, the user runs `w32tm /resync` as admin), the double `L` binding, the P9
  `median20` question, and the P33 post-close-candle question.

## Next session starts here
- After Friday's session: `curl -s http://127.0.0.1:8787/api/paper`, then read `.cache/paper-ledger.json` and the
  Kernel-Power 506/507 events for 09:00–15:40. Every exit should be a live tick close or `repriced`, and none should be
  silent. Then re-run `node --env-file-if-exists=.env .cache/p31-recompute.ts` against Friday (change `DAY`).
- First command: `curl -s http://127.0.0.1:8787/api/health` → build `9db344e`, `tokenExpires` 2026-09-25T12:30:39Z.
- Watch out for: the token expires at 18:00 IST Friday. The server renews it once 12 h remain and the market is shut,
  which is 06:00–09:00 or after 15:45. The laptop must be awake in one of those windows before 18:00.

## P37 — backtest (branch `p37-backtest`, cut from `p36-sleep-proof`)
- Spec `docs/spec/backtest-v1.md`. `npm run backtest` prints the report. The live server also runs it once per weekday at or after 16:00 IST, writing
  `.cache/history/report.json`. `npm run backtest:test` 31/31.
- First run: 638 calls, 21 sessions (26 Aug–24 Sep). Second run: 0 calls. Real-scan days: 21 Sep and 24 Sep only.
- **Finding:** NSE's OI Spurts figure is not near-month futures OI. The proxy's OI goes the other way (rollover, 5 days
  before expiry), so proxy days almost never trade. The learning therefore rests on real 09:20 scans, which row 18
  now saves daily (`.cache/history/scans/<date>.json`). The first saved one will be Friday's.
- **Row 12's fill model misses band jumps:** POLICYBZR model 1700.45 vs live 1606 (and so 1700 PE vs 1600 PE). MFSL is off by 1.10.
- Live server restarted on P37 (`aeabd99`, PID 26928). It did not rerun the job today, because the report is dated today. ARMED.
- Next: after Friday 16:00, read `[backtest] done` in `.cache/live-8787.log` and `report.json`. Friday should be the
  third real-scan day. P38 (the panel) and P39 (older history) are boarded.

## Regression sweep (browser, replay 8791)
Run by a subagent on **8793**. 8791 was held by a stale replay server, PID 16816, on build `ed5c509`, started 23 Sep
22:36. It is still running: not started this session and not killed. It shares `paper-ledger.replay.json`.
**No regression traces to P36.** Google Fonts was reachable, so the reds P33 owed are now green.
p25 44/44 · p19 62/62 · p20 30/30 · p10a 42/0 · p10b 29/1 (known: splitter #2 `240 -> 240px`, the `L` double binding) ·
P2–P9 re-proof 37/0 (P5 83 = 2×41+1) · p9 22/22 (AC7 p95 4.40 ms) · p25-note 4/4 · p25-pop 6/6 · p29-ltp-ui 17/0 ·
p22 23/23 · p23 19/19 · p24 errors 0 · p26 27/27 · p33-verify 26/26 with the 10-minute soak.
`p32-verify.js` fails 3 and then times out, because it still asserts P32's rules (disarmed default, the stop/target rules line), which P33
replaced. It needs rewriting before its numbers mean anything. It was not in P33's sweep either.
