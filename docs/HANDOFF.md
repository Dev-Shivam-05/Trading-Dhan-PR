# HANDOFF — Dhan Terminal — Phase P31 + P33 AC6 — 2026-09-24

> P33's handoff is in git history at `fc15c3f`.

Branch **`p31-close-live`**, cut from `p33-orb-strategy`. (`p31-open-session` already existed: it is
P30/P31's setup branch, so this one has a new name.)

## Done
- **Read the first live paper-trading day and recomputed it from Dhan's real candles.**
  `.cache/p31-recompute.ts` (`CLOCK_SKEW_MS=4623`) scored 15 pass / 7 fail. The raw bodies are in
  `.cache/live/p31-*.json`.
  - Scan at 09:21:27 (NSE prices as of 09:20:55): funnel 210 → 40 → 19 → 2, both on the Short list.
  - **POLICYBZR**: range 1700.5 / 1700.5. The future sat at one price for the first three candles, and after that it moved in
    flat steps (1606, 1511.5, 1454.8, …, 1284.7), which looks like price-band trading. It entered SELL 1606 at 09:30, on the first
    tick below the level. PE 1600 at 81.05.
  - **MFSL**: range 1427.4 / 1404.3. It entered SELL 1401.3 at 09:49. PE 1400 at 30.
  - **Every entry number agrees with Dhan's candles**: both ranges, both break minutes, both fills inside their minute's
    traded range, both nearest strikes, both option fills. SMA9 and the against-count at the 10:30 bar match to the paisa.
  - **The exits are all wrong, from one cause.** Modern Standby ran from 10:40:04 to 17:45:35 (Kernel-Power 506/507). On
    wake, `onClock` squared everything off at `p.ltp`, the 10:40 tick. The ledger says `eod` at 17:45 with `stale: false`.
    By the candles, MFSL had two closes above SMA9 (10:45 at 1395.5 vs 1378.37, and 10:50 at 1395.2 vs 1379.59), so it
    should have exited at 10:55 at about 1395.2. POLICYBZR never had two closes against and should have been squared off
    at 15:15 at about 1243.2.
    | leg | ledger P&L | at the rule's exit (minute open) |
    |---|---|---|
    | POLICYBZR future | 52,920 | 126,980 |
    | POLICYBZR 1600 PE | 39,305 | 97,632.50 |
    | MFSL future | 12,760 | 2,440 |
    | MFSL 1400 PE | 8,000 | 1,620 |
    | **total** | **1,12,985** | **2,28,672.50** |
- **Read the open-session run** (`.cache/p30-open-run.log`, 09:36–09:40): 19 pass / 2 fail / 3 open. Details are in the P31 row.
- **Fixed two measurements, not the claims:**
  - The P25 wheel check: at 09:37 the default view was already at the 5-candle floor, so the check now steps out first.
    Re-run on NSE: ratio 0.850.
  - `open-checks.ts` now prints the scanner's `error` when P8 fails.
- **Measured the P8 cause.** Two `/v2/marketfeed/quote` calls sent together on different gate keys: one got `805`.
- **Found:** Dhan's NIFTY `IDX_I` intraday has a flat 17:55 candle today (direct call), so the P19 spacing check is red tonight.
- Read `.cache/p29-shots/04-live-edge.png`, the 09:40 live screen. Nothing broken on it.

## Files changed
- `docs/spec/orb-strategy-v1.md`: AC6 row, measured.
- `docs/PHASES.md`: P31 row, the P36 row (new), Now.
- `scripts/open-checks.ts`: prints the scan's error.
- `CLAUDE.md`: three lessons (sleep and late exits, the marketfeed 805, the PC clock).
- `.cache/` (gitignored): `p31-recompute.ts`, `p31-nifty-raw.ts`, `p31-quote-race.ts`, and the wheel fix in `p29-chart-live.js`.

## Decisions made
- The ledger was **not rewritten**. It is the record of what the app did. The corrected numbers live in the docs.
- No code change to `src/`. Every fix needs a number or a policy the user owns, so it went to P36.

## Known broken / deliberately skipped
- **The paper trader's exits are unreliable on this laptop** until P36 (or until the laptop stays awake 09:10–15:35).
- **P8 live is red**, and P8 AC5 could not run. Both wait for P36(b) and one more session.
- P19's 1-minute tick containment (SKIP) needs a re-run with the market open. P9's `median20` needs the user's call.
- Tomorrow's 09:20 run needs the token renewed tonight (see Watch out).

## Next session starts here
- Phase P36: spec-lock first (the proposals are below and in the reply). Then build.
- First command: `curl -s http://127.0.0.1:8787/api/health` → `tokenExpires` must be later than `2026-09-24T13:55:28Z`.
- Watch out for: **the token.** The 17:45 renewal failed with `network: fetch failed` on wake, and the token dies at 19:25 IST
  today. The server retries every 15 min, but only while the laptop is awake. The overnight sleep also skipped the
  07:25–09:00 renewal window.

## P36 proposals (awaiting one word)
| # | Row | Proposal |
|---|---|---|
| 1 | Late exit price | If an exit (SMA or 15:15) is processed after its instant, price it from Dhan's 1-minute candle **open** at that instant (`/v2/charts/intraday`, interval 1, key `paper:candles`). Mark it `repriced`, with a note that names the gap. |
| 2 | No candle available | Close at the last tick, set `stale: true`, and say "last tick 10:40, machine asleep" on screen. Never a silent `eod`. |
| 3 | Keep awake | While armed and any position is pending or open, 09:10–15:35 IST, the server holds `ES_SYSTEM_REQUIRED` through a child PowerShell `SetThreadExecutionState`. It releases after that. |
| 4 | One marketfeed gate | Every `/v2/marketfeed/*` caller goes through one serialised queue (`marketfeed`, 1000 ms). `waitForSlot` waits for in-flight calls, not only completions. |
| 5 | Out-of-session candles | `ucandles` drops candles after the instrument's session close + 10 min (NSE 15:40, which keeps Dhan's 15:30–15:39 F&O tail). This removes NIFTY's 17:55. |
| 6 | Clock | Correct the lag with `w32tm /resync` (admin, the user runs it). No code. |
