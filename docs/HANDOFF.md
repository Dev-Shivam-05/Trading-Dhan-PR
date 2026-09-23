# HANDOFF — Dhan Terminal — Phase P31 (setup only) — 2026-09-23

> P30's handoff is in git history at `e124207`, and its board row is in `docs/PHASES.md`.

Branch **`p31-open-session`**, cut from `p30-health-session`. The only commit is this handoff and the board update.

## Done
- **8787 is a LIVE server built from P30** (PID **16036**, started 19:25 IST, `npm run dev` detached,
  log `.cache/p31-dev.log`). Checked: exactly one listener on 8787, zero `EADDRINUSE`, `/api/health` `mode=live`,
  and GOLD reads `open (19:25 IST)`, which shows the per-request session is working.
- `npm run check` reported **READY** before the server started.
- The token was renewed at start and now expires **Thu 24 Sep 19:25 IST**. That is after Thursday's session.
  If the replay server had stayed on 8787, the token would have died at **05:43 IST Thu**, because a replay
  server never renews and `shouldRenew` blocks renewal between 09:00 and 15:45. The armed run would then
  have found a dead token.
- The replay server that held 8787 (PID 7060, started 19:12 on the P29 build) was killed **by PID** after
  `ListAgents` showed no peer session alive.
- The armed runner **PID 24376** is still waiting for **Thu 24 Sep 09:36 IST** → `.cache/p30-open-run.log`.

## Files changed
- `docs/HANDOFF.md`, `docs/PHASES.md`, `docs/DECISIONS.md`: handoff, board and decisions. No code changed.

## Decisions made
- The live server was started on Wednesday night, not Thursday morning. The token would otherwise have expired
  before the 09:36 run.
- **The user's direction for the next session:** build an **auto trading system that PAPER trades, driven from
  the front page (the UI)**. It is boarded as **P32**. P31 (reading Thursday's open-session log) stays open
  and can be closed in any later session. The log stays on disk.

## Known broken / deliberately skipped
- **The laptop sleeps after 3 minutes idle on mains power** (`powercfg` STANDBYIDLE AC = 180 s). If it is
  asleep at 09:36, the server and the runner freeze until it wakes, and the runner gives up at 15:00. I did not
  change the setting, because it is the user's machine.
- P31's actual work (closing P8 AC5, P12b, P19/P9 on NSE, P21 and the NSE `last_price` lag from the log) needs
  Thursday's data. Nothing was measured tonight.

## Next session starts here
- Phase P32: the auto paper-trading system, run from the front page. It needs a spec locked first. Strategy
  and entry signal, exit (target / stop), position size, instruments, and what the UI shows are all
  **undefined**, so run `spec-lock` and propose exact values before writing any code.
- First command: `git checkout -b p32-paper-trading` (then `cat .cache/p30-open-run.log` to see whether
  Thursday's run landed)
- Watch out for: **paper means paper.** Never call a Dhan order endpoint (`/v2/orders` or any other). Fills are
  simulated locally from the LTP the app already has. Replay and live must keep **separate** paper ledgers,
  chosen by `isReplay()`, or replay's synthetic fills will mix into the live P&L.
