# HANDOFF — Dhan Terminal — Phase P32 — 2026-09-23

> P31's setup handoff is in git history at `0f4f733`.

Branch **`p32-paper-trading`**, cut from `p31-open-session`, pushed to origin.

## Done
- **Auto paper-trading works in replay.** When armed, the server runs the P14 NSE scan at 09:20 IST.
  It BUYs the Long list's near-month futures and SELLs the Short list's (1 lot each, at most 10,
  entries until 09:30). Each position fills at the first feed tick and exits at stop 1%, target 2%
  or 15:15. No Dhan order endpoint exists in `src/` (checked by grep).
- **A fourth workspace, Paper.** It has the arm toggle, a status line, gross day P&L, Square off
  all, Run now (replay only), and three tables: Open, Closed today and Last 5 days. It survives a
  reload.
- **The LTP Calculator now survives a reload too.** It never did before. See the decision below.
- **Verification, all run:**
  - `npm run paper:test`: 70/70.
  - `.cache/p32-verify.js` on a replay server: 18/18 (open), 19/19 (resume after kill + restart),
    6/6 (scan failed).
  - Every P&L was recomputed in integer paise and matched the state, the screen and the ledger file.
  - Five states were screenshotted and read. The screenshots showed three layout defects, all fixed.
  - AC11 regression sweep, 21 suites one at a time: all green except p10b at 29/1. That red is a
    P29 defect, described below.
- The live ledger `.cache/paper-ledger.json` does not exist yet. Replay wrote only
  `paper-ledger.replay.json` (AC6).

## Files changed
- `docs/spec/paper-trading-v1.md`: the locked spec. 18 rows plus amendments 19–23.
- `src/server/paper.ts`: the pure rules (clock injected) and the `PaperTrader` I/O shell (timer,
  ledger, feed subscriptions).
- `src/server/index.ts`: the trader wired to the feed under a reserved `feedWants` key, the
  `/api/paper*` routes (bodies validated), and a `/paper.js` STATIC row.
- `public/paper.js`, `public/index.html`, `public/app.css`: the Paper workspace.
- `public/scan.js`, `public/ltp.js`: a fix so workspaces persist across a reload.
- `scripts/paper-test.ts`, `package.json` (`paper:test`): the unit acceptance criteria.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/spec/GLOSSARY.md`, `CLAUDE.md`: board, decisions,
  three terms, and two lessons.

## Decisions made
- **Strategy.** Entry is the user's recorded 9:20 list. Exit, instrument, size and retry are GUESS
  rows the user accepted with `go`. The trader lives in the server, so it runs without a browser tab.
- **Replay's Run now maps the press to 09:20:00 IST.** The offset is persisted in the replay ledger.
  Without it, the 15:15 rule would square everything off the same second.
- **Feed LTPs are rounded to 0.01 before the rules see them.** They are decoded as float32, and
  1259.24 would miss a 1259.24 target.
- **Why workspaces lost their state on reload:** `scan.js` claimed every non-`chain` `ws` value,
  and `ltp.js` saved `ws` before announcing itself, so the scanner overwrote it. Now each workspace
  announces first and then saves.

## Known broken / deliberately skipped
- **The live 8787 server predates P32**, so `/paper.js` returns 404 there and the Paper tab does
  nothing on the live screen. I tried to restart it and the session's permission classifier refused
  ("Interfere With Workloads"), so I did not work around it. It is still PID 16036, live, with a
  token valid until Thu 19:25 IST.
- **AC10 (a live 09:20 entry) is unmeasured.** It needs the restart above, the Arm button pressed,
  and the laptop awake at 09:20. The laptop sleeps after 3 minutes idle on mains.
- **p10b 29/1: `L` is bound twice.** `app.js:729` toggles the drawer and `ltp.js:290` opens the LTP
  Calculator. P29 added the second binding, and no spec row gives it that key. This needs the user's
  call; I did not loosen the check.
- Stop, target and 15:15 firing were proven in the unit tests only. In the browser run, every exit
  was manual, because replay's walk takes minutes to move 1%.

## Next session starts here
- **Phase P31 + P32 AC10:** after Thursday's session, read the open-session run log and the live
  paper ledger, and close both sets of criteria.
- **First command, tonight:** `taskkill //F //PID 16036` then `npm run dev`. That restarts 8787 on
  the P32 build. Then open the Paper tab and press **Arm auto-trading**.
- **Watch out for:** a replay server on 8787 overnight. It never renews the token and has no live
  ledger, so Thursday's 09:20 run and the 09:36 P31 run would both find nothing to measure.
