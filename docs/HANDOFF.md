# HANDOFF — Dhan Terminal — Phase P33 — 2026-09-23

> P32's handoff is in git history at `ce9a89b`.

Branch **`p33-orb-strategy`**, cut from `p32-paper-trading`.

## Done
- **The paper trader now runs the user's F&O strategy (P33).** When armed, it runs the 09:20 NSE scan. At 09:25:05 it reads each
  future's 09:15 and 09:20 five-minute candles to get its range. A Long-list stock enters on the first
  tick strictly above the high, and a Short-list stock on the first tick strictly below the low, between 09:25 and 15:00.
  Each break also buys the nearest near-month stock CE (long) or PE (short). Both legs exit on the first tick after **two
  consecutive completed 5-minute closes against SMA9**, or at 15:15. No break by 15:00 means `no break`.
- **The Paper screen** has a *Waiting for break* table (range high/low, LTP, what it waits for). The Open table shows
  Range H–L, SMA9 and "closes against 0/2", with each option leg under its future.
- **Verified:**
  - `npm run paper:test`: 104/104. Every rule is shown rejecting something: a tick at the level, a Long stock breaking its low, one close
    against SMA9, below/above/below, the forming candle, the cap, and a failed candle read retried at 60 s, not 59.
  - `.cache/p33-verify.js` on a replay server built from the committed fixture: **26/26**, including a real-time 10-minute soak. In it,
    FEDERALBNK exits on 2 closes above SMA9 at replay 09:35:05, MFSL and POLICYBZR hold, and PNBHOUSING never breaks. A second quick run
    passed 14/14.
  - Every P&L was recomputed in integer paise and equals the state, the screen and the ledger file.
  - Four screenshots were read. One defect showed up only in them (heavy dashed borders on the option rows) and is fixed.
  - tsc is clean. ltp 29, session 11, chart 25 and oq1 5 all pass.
- **The live path was checked tonight with one read-only call.** MFSL future, 23 Sep: 77 five-minute candles, evenly
  spaced. The app's range and SMA9 equal my hand recomputation exactly (`.cache/p33-live-candles.ts`).
- **The live server on 8787 now runs P33 and is ARMED** for Thu 24 Sep. It was restarted at 22:40 by PID with one listener
  and no EADDRINUSE. `/api/health` build is 74c6340, the token is good until Thu 19:25 IST, and the rules read `orb-sma9`.

## Files changed
- `docs/spec/orb-strategy-v1.md`: the locked P33 spec: 13 rows, amendments 14–19, one open question.
- `src/server/paper.ts`: the range, the break, SMA9, the two-closes exit, the option leg and the candle-reading shell. Still no Dhan import.
- `src/server/replay.ts`: `replayOrbCandles()`, the seeded four outcomes, anchored to the same base as the tick walk.
- `src/server/instruments.ts`: `stockOptions()`, a symbol's near-month OPTSTK contracts.
- `src/server/index.ts`: wires candles (`/v2/charts/intraday`, `FUTSTK`, 5 min, key `paper:candles`) and options into the trader.
- `scripts/paper-test.ts`: rewritten for P33, 104 checks.
- `public/paper.js`, `public/app.css`: the waiting table, option legs, range, SMA9 and against count. The screen still reads a P32 server's shape.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `CLAUDE.md`: board (P33, P34, P35), five decisions, one lesson.

## Decisions made
- The candles and fills are the **future's**, not the cash stock's, so every P&L comes from one price series.
- **P32's 1% stop / 2% target are removed.** The recording defines the exit completely. There is no price stop between closes (risk 1).
- A break opens a future leg **and** an option leg (CE long / PE short, the nearest strike, ties to the lower strike). The option exits on the future's signal.
- Replay's Run now maps to **09:25:00** (P32 said 09:20), so the range is read 5 s after the press.
- **Real money is P35**, gated on the user asking for it by name and on paper results. `src/` still has no order endpoint.

## Known broken / deliberately skipped
- **AC6 (live entries) is unmeasured.** It needs Thursday's session.
- **P32's AC10 is superseded, not measured.** The server was moved to P33 before any live 09:20 run.
- **Open question (spec):** Dhan's series includes the 15:30 and 15:35 post-close candles, so SMA9 before ~10:00 reaches into them. Built as written. The user can say `exclude`.
- **Replay candles and replay ticks drift apart after the range.** A replay exit is decided on seeded closes while the fill is a random-walk tick, so replay P&L means nothing. The live path has no such split.
- **`L` is still bound twice** (P29 defect, p10b 29/1). It needs the user's call.
- **P34 (LTP Calculator trades on NIFTY) is not started.** The user's answers are recorded on its board row. It needs its own spec-lock.

## Next session starts here
- Phase P31 + P33 AC6: after Thursday's session, read `.cache/paper-ledger.json` and `.cache/p30-open-run.log`. Recompute each entry
  and exit from Dhan's real 5-minute candles, then close the open-session criteria. After that, spec-lock P34.
- First command: `curl -s http://127.0.0.1:8787/api/paper` (before 09:20: it must say `armed`, rules `orb-sma9`)
- Watch out for: the laptop sleeping at 09:20. Also a replay server on 8787 overnight, which never renews the token.
