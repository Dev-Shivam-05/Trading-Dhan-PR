# HANDOFF — Dhan Terminal — Phase P30 — 2026-09-23

> P29's handoff is in git history at `1add63d` and its board row is in `docs/PHASES.md`.

Branch **`p30-health-session`** (cut from `p29-ltp-spec`), **pushed**. Commits `71b2317` (fix), `97ce376`
(docs), plus this handoff.

## Done
- `/api/health` and `/api/instruments` now report each chip's session as of **the request**, not as
  of server boot. Before, a server started at 06:10 said `pre-open` until 15:00. That is why P29's
  armed open-session run never fired on 23 Sep (`.cache/p29-open-run.log`: 43 "pre-open" lines,
  09:49–14:47). It is also why the chip rail's open dot would not have lit.
- `npm run session:test` passes **11/11** with an injected clock. It covers the bell, 09:14, the
  15:30 close, the MCX DST close, Saturday, and the frozen registry giving the wrong answer at 10:00.
- Route-level check: a new-build replay server on 8791 read GOLD `open (19:13 IST)` and then
  `open (19:14 IST)` 65 s later. At the same time the old build on 8787 stayed at `open (19:12 IST)`,
  its boot minute. `tsc --noEmit` is clean.
- **Armed:** `.cache/p30-at-open.js` is running detached as **PID 24376** for **2026-09-24**. It starts
  at 09:36 IST, gives up at 15:00, and writes to `.cache/p30-open-run.log`. An hourly heartbeat marks
  when the machine was asleep.

## Files changed
- `src/server/instruments.ts` — `withLiveSession()` re-derives `session` from `sessionState(now)`.
- `src/server/index.ts` — `/api/health` and `/api/instruments` go through it.
- `scripts/session-test.ts` and `package.json` (`session:test`) — the injected-clock proof.
- `.cache/p30-at-open.js` (gitignored) — the re-armed runner. It waits for a date, keeps re-checking a
  replay or stopped server, and names the stale-session case.
- `docs/PHASES.md`, `CLAUDE.md`, `docs/DECISIONS.md` — the board row, the lesson and the decision.

## Decisions made
- Fixed at the route, not by re-resolving the registry. Re-resolving would re-download the master
  and re-run the GOLD spike, which is too much work to get one clock-derived field.
- The runner keeps waiting when the server is in replay instead of exiting. That way, a live server
  started late in the morning still gets measured.

## Known broken / deliberately skipped
- **8787 is running a REPLAY server that this session did not start** (PID 7060, started 19:12,
  `--env-file-if-exists=.env`). It also predates P30. I did not touch it, because it may belong to
  the user or a peer. The armed run will log `server is replay` until a **live** server built from
  P30 or later owns 8787.
- The runner's "stale session" message has not been exercised live, because no pre-P30 live server
  was available to point it at. Only its give-up branch and its replay branch were dry-run.
- Laptop sleep: the P29 log has a gap from 09:49 to 14:06. Nothing in a script can prevent that.
- The `ltp-calculator-v1.md` L4–L10 layers are still unspecified (P31+). They need intraday history.

## Next session starts here
- Phase P31: read Thursday's open-session results and close the board's open-session criteria
  (P8 AC5, P12b, P19/P9 on NSE, P21, and NSE `last_price` lag).
- First command: `cat .cache/p30-open-run.log`
- Watch out for: the run needs a **live** server on 8787 before 09:36 on Thu 24 Sep. If 8787 is
  still the replay one, kill it by PID (never `//IM node.exe`) and start `npm run dev`, then confirm
  that exactly one server is listening.
