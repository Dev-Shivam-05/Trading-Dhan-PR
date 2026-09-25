# HANDOFF — Dhan Terminal — P44 (training), P41 AC2, P46 — 2026-09-25

> The previous handoff (P31–P42) is in git history at `0cfccdd`.
> Branches are stacked: … → `p40-phone-sandbox` → **`p44-train-all`** (current, pushed).

## Done
- **P44, training on history** (the user's request: "this week, last week, full August … train our system … assume all the answers"):
  - **Data:** the share's 1-minute candles for all 210 F&O stocks, **1 Oct 2025 – 25 Sep 2026**, which is **244 sessions**, plus the official daily closes. That took 1,890 Dhan calls, 0 failed, and 716 MB in `.cache/history/eq1` and `eqd`.
  - **Why the share and not the future:** the August futures have expired, and Dhan's 90-day limit is per request rather than a horizon.
  - **Grid:** 1,728 settings of the ORB and SMA rules, each scored net of costs.
  - **Checks:** walk-forward (expanding and rolling 60), a first-half/second-half split, and a stress test where every fill lands one minute late. The robustness numbers are a daily t, the net without the best days, and the net without the top stock.
  - **Result:** the live rules minus the OI filter net +5.24 lakh, but only **+1.63 lakh (t 0.47) with late fills**, and they are negative without their best 3 days.
  - **Recommended, NOT applied:** `chg0/either/r3/sma20/x3/SL`, which beats the baseline in all 4 walk-forwards. With late fills it nets +7.86 lakh (t 1.70) and is positive in 10 of 12 months.
  - Spec: `docs/spec/train-all-v1.md`; its "Final" section has the whole table.
- **NSE's OI Spurts figure** was measured again. `prevOI` matches no sum of Dhan's futures and options OI (POLICYBZR, FORTIS, MFSL), so the 09:20 scan cannot be rebuilt for past days. That is why P44 selects stocks by price only.
- **P41 AC2: PASS on counts.** 19,335,431 ticks from 2,310/2,310 instruments; an independent CSV count agrees with `summary.json` for every instrument.
  - Coverage was only **10:45:54 → 15:12:33, with a hole at 12:56–13:14.** The laptop rebooted and slept in the morning, and fell into Modern Standby twice later.
  - There was no 09:20 scan and no live trade today, so the day has nothing to compare with a live ledger.
  - The day is packed: 1,118 MB → 190 MB (`npm run ticks:pack`, SHA-256 verified). The sandbox reads `.gz`.
- **P46 is built and live.** The keep-awake now covers the recorder, and it asks for the display (0x80000003).
  - Why: on this laptop Modern Standby ignored the old system-only hold (standby at 14:08 while it was held).
  - Live server restarted on it: **8787 = PID 11204, build `0a412e4`, ARMED**. There is one listener and 0 EADDRINUSE.
- **Tests:** `train:test` 43/43 (AC2: the trainer equals P37's `replayDay` on 24 Sep's real candles). AC5: 9 trades recomputed to the paisa. tsc is clean.

## Files changed
- `src/server/train.ts` (new, pure engine) and `src/server/train-data.ts` (new, Dhan I/O, 89-day chunks, refuses replay).
- `scripts/train.ts`, `scripts/train-run.ts`, `scripts/train-test.ts` (new); `package.json` (`train`, `train:test`, `ticks:pack`).
- `scripts/ticks-pack.ts` (new); `src/server/sandbox.ts` (reads `ticks.csv.gz`).
- `src/server/awake.ts` (0x80000003) and `src/server/index.ts` (hold = trader OR recorder).
- `docs/spec/train-all-v1.md` (new), `docs/PHASES.md` (P41, P44, P45, P46, Now), `CLAUDE.md` (3 lessons).

## Decisions made (by delegation: the user said "assume all the answers, do not ask")
- Every unmeasured value in P44 is marked **GUESS** in the spec (costs, stop-wins-ties, the 20-trade floor, 10 held-out starts).
- **The live rules were NOT changed.** The standing decision is that nothing learned changes live without the user's word, and a t of 1.70 is suggestive, not proof. P45 (a shadow paper book of the recommendation) is boarded.
- The live server was restarted after the market closed, with no positions open, so that Monday runs with P46.

## Known broken / deliberately skipped
- **The token expires Sat 26 Sep 08:35 IST.** The server renews it only while the PC is awake (under 12 h left; the weekend counts as outside market hours). If the laptop sleeps from tonight to Monday, **the token dies and Monday's 09:20 does nothing.** Keep it awake and plugged in some time over the weekend, or paste a fresh token Monday before 09:10.
- **The laptop was on battery** at 16:30 today (`PowerOnline False`).
- On battery the display turns off after 60 min, and on AC after 3 min. P46's display hold covers only 09:10–15:35 on weekdays, and only if the server is running.
- A closed lid still sleeps it.
- P46 is unmeasured until Monday. Check the Kernel-Power 506/507 events for 09:14–15:31.
- **P44's caveats:**
  - Today's 210-stock universe is used for all of the past year, which means survivorship.
  - Today's lot sizes are used throughout.
  - No option leg is modelled.
  - The OI filter can't be tested at all.
- The sandbox treats a partial recording as a whole day. A day that starts after 09:25 has no range, and the sandbox says so nowhere.
- The nightly backtest had one `NETWORK` failure (360ONE 5m, right after the wake). It is retried incrementally tomorrow.
- The ntfy 15:20 summary failed (`fetch failed`) because the PC was asleep.
- Still waiting for the user, as before: `L` is bound twice; P9 `median20`; the post-close candles in SMA9; `w32tm /resync`; the untracked voice recording.
- The `.cache` probes behind the numbers above: `p39-oi-identity.ts`, `p41-ac2.ts`, `p44-ac5.ts`, `p44-probe*.ts`.

## Next session starts here
- Next session: **Monday 28 Sep after 15:31.** Read the first full recorded day and the live paper day. Then give the user the P44 recommendation to decide on (P45 shadow book, yes or no).
- First command: `curl -s http://127.0.0.1:8787/api/paper` (it must say `"armed":true` and show today's scan), then `node .cache/p41-ac2.ts 2026-09-28` and the Kernel-Power 506/507 events for the session (P46).
- Watch out for: the token (Sat 08:35 expiry). If `npm run check` does not say READY on Monday morning, nothing trades.
