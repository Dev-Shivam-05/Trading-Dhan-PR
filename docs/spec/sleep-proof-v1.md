# P36 — Paper trader survives a sleeping laptop; one marketfeed gate

**Locked 2026-09-24 with one `go`** on the six-row proposal in the P31 handoff. The source is P31's
measurement of the first live paper day (`docs/PHASES.md` P31 row, `orb-strategy-v1.md` AC6).

## What went wrong on 24 Sep
- Modern Standby lasted from 10:40:04 to 17:45:35. On wake, `onClock` squared off every open leg at `p.ltp`, which was the 10:40
  tick. It stamped the close 17:45, `reason: eod`, `stale: false`. MFSL's SMA exit, due at 10:55, was never seen. The ledger
  showed ₹1,12,985. Dhan's candles show ₹2,28,672.50.
- `/v2/marketfeed/quote` called twice in the same second on two different gate keys returned `805`. The scanner (`scan:quote`)
  and the spot quote (`spot:quote`) are such a pair. `waitForSlot` spaces a call only from the key's last *completion*, so
  two calls in flight on one key both go out.
- Dhan's NIFTY `IDX_I` intraday returned a flat 17:55 candle. The chart drew a 2.5 h gap after 15:25.

## Rows

| # | Row | Value | Why |
|---|---|---|---|
| 1 | Late exit price | If an exit (SMA or 15:15) came due while the process was blind, it closes at Dhan's **1-minute candle open** for the minute that holds the due instant. That minute comes from `/v2/charts/intraday`, interval 1, key `paper:candles`. The leg's `exitAt` is the due instant, not the wake time. It is marked `repriced: true`, with a note naming the gap and the minute | P31: the 10:40 tick priced a 15:15 exit |
| 2 | No candle available | The leg stays open, marked `awaiting a candle price`, and the read is retried every `RETRY_MS` (60 s). Neither `onTick` nor the 15:15 rule may close it at a tick while it waits. If the date changes first, P32 row 13's stale close takes it at the last tick, with `stale: true` and a note naming the last tick's time. It is never a silent `eod` | The network was down at the moment of wake (the 17:45 token renewal failed with `fetch failed`), so one failed read must not decide the price |
| 3 | Keep awake | While the trader is armed on a weekday, 09:10–15:35 IST, and either today's scan has not finished or any leg of today is pending or open, the server holds `ES_CONTINUOUS \| ES_SYSTEM_REQUIRED` through one child `powershell` that calls `SetThreadExecutionState`. Killing the child releases it | P31: idle sleep at 10:40 |
| 4 | One marketfeed gate | Every `/v2/marketfeed/*` caller in `src/` uses gate key `marketfeed` at 1000 ms. `dhanPost` serialises calls per key, so a call waits for the key's in-flight call and then for the cadence | P31: measured `805` |
| 5 | Out-of-session candles | `ucandles` drops a candle whose IST open is at or after the instrument's session close + 10 min, taken on that candle's own date. NSE: 15:40, which keeps Dhan's 15:30–15:39 F&O tail. MCX: 23:40 or 00:05 | P31: NIFTY 17:55 |
| 6 | Clock | The user runs `w32tm /resync` as admin. No code | P31: the PC is 4.6 s behind |

## Constants

- `GAP_MS = 60_000`. The shell counts itself blind when two of its 1 s steps are more than a minute apart, or when it loads a
  ledger whose `aliveAt` is more than a minute old. That is the repricing source's resolution: a shorter gap cannot be
  priced better than by the live tick, so it is left to the live rules. **GUESS, derived from row 1.**
- `aliveAt`, stamped on every ledger write. It is what `load()` measures a gap from after a restart.

## Catch-up (rows 1, 2), run once per detected gap and retried per row 2
For each of today's **open futures**:
1. Read its 5-minute candles and walk them with `applyBars` against a clock capped just before 15:15. That excludes the
   15:10 candle, which completes at 15:15 exactly, the same as live, where the square-off comes first.
2. If that walk makes the SMA exit due, the due instant is the second close's candle end. Otherwise, if 15:15 has
   passed, the due instant is 15:15 and the reason is `eod`. Otherwise nothing is due, and the live rules carry on.
3. If an exit came due more than `GAP_MS` ago, read the 1-minute candles of the future **and** of each open option leg.
   Close each at its own minute's open, as in row 1. If any read fails, apply row 2 to the whole signal.

## Out of scope
- **An entry missed during a gap.** A pending future still enters on the first tick after wake, at that tick's price. No
  row covers reconstructing it. Recorded as an open question for the user.

## Acceptance criteria

| # | Criterion | How |
|---|---|---|
| AC1 | 24 Sep replayed through the rules: MFSL's future and PE close at 10:55 at their 1-minute opens, POLICYBZR's at 15:15, all `repriced`, P&L 2,28,672.50 total | Unit, fixture built from P31's real candles, clock injected |
| AC2 | A failed candle read leaves the legs open and `awaiting`. A tick and 15:15 do not close them. A retry before 60 s is not made, and one at 60 s is. A date change closes them `stale` with the last tick's time in the note | Unit |
| AC3 | A gap under 60 s changes nothing, and a gap during the session with no exit due changes nothing | Unit |
| AC4 | Keep-awake: the hold/release decision over the window edges and the scan/positions conditions. Live: `powercfg /requests` lists the child under SYSTEM while held and not after release | Unit + one live check |
| AC5 | Two `dhanPost` calls on one key dispatch ≥ cadence apart **after** the first completes, even when issued together. The scanner and the spot quote share `marketfeed` | Unit with a stub fetch + grep |
| AC6 | `/api/ucandles?key=NIFTY&interval=5` on the live server has no candle at 17:55 on 24 Sep, and NIFTY's today count is 75 | Live read |
| AC7 | `paper:test` and every suite P33 ran stay green | Suites |

---

## Amendments found while building

| # | Change | Why |
|---|---|---|
| 7 | Row 3 also holds the machine awake **before** today's scan has run (09:10 until the scan finishes). The approved proposal said "while any position is pending or open" | There are no positions before 09:20, so the row as proposed would not keep the laptop awake for the scan that creates them |
| 8 | Row 1 prices from the first 1-minute candle **at or after** the due minute | An illiquid option may not trade in that minute. Live, its first tick after the due instant would have been the fill |
| 9 | A failed 1-minute read on **any** leg leaves the whole signal awaiting. No leg is priced alone | A future priced at 10:55 beside an option still waiting would be half a signal |
| 10 | `paper:test` walks its clock in steps under a minute where it used to jump from 09:35 to 15:00 | Under row 1, a jump longer than `GAP_MS` **is** a blind gap. The checks are about an awake trader, so the measurement changed. The claim did not (CLAUDE.md: fix the measurement) |
| 11 | On the Paper screen, an awaiting leg shows `awaiting price` on its own line, with the gap and due time in the tooltip. A repriced close reads `… · repriced`, with the note in the tooltip | The first wording, `asleep 10:40–18:23 · awaiting a candle price` inline, was clipped in its 12% column. Seen in the screenshots |
| 12 | `keepAwake`'s child polls the server's PID every 30 s and exits once it is gone | Killing the server by PID is the routine here, and an orphan would hold the laptop awake indefinitely. Verified: server killed with `taskkill //F`, child gone within 40 s |

## Found, not changed
- **At 1024 px the Open table clips Entry, LTP and SMA9 by 1 px** (`scrollWidth 69` vs `clientWidth 68`, `table-layout: fixed`). This predates P36: removing P36's line in the page changes nothing. The column widths are P33's, so fixing it means choosing a new width.
- An entry missed during a gap (see Out of scope).
