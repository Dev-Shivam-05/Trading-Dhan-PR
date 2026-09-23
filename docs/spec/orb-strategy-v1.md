# SPEC LOCK — P33 Opening-range breakout + 9 SMA exit (F&O stocks, future and option legs)

Status: **LOCKED** 2026-09-23 — approved by the user with one `go` on the table below.

This **replaces the entry and the exit of `paper-trading-v1.md`** (rows 3's 09:30 entry cutoff, 6, 7).
Everything else in that spec stands: paper means paper (row 1), the 09:20 NSE scan and its 60 s retry
until 09:30 (rows 2, 3), 1 lot (row 5), 15:15 square-off (row 8), one trade per symbol per day
(row 9), arming (row 10), manual controls (row 11), the feed (row 12), the ledger per mode (row 13),
the injected clock (row 14), the routes (row 17) and the test seam (row 18).

Source: the user's two voice notes of 2026-09-23, transcribed by the user:

> **Recording 1.** For every stock selected by the indicator, consider the first two 5-minute
> candles of the trading day (9:15–9:20, 9:20–9:25). Once these two candles have formed, identify
> the highest high and the lowest low. For stocks where the indicator generated a short signal, take
> a short-side entry only when the stock breaks below the low of the first two candles. For a long
> signal, take a long-side (call-side) entry when it breaks above the high.
>
> **Recording 2.** For the exit, use the 9-period SMA. Exit when two consecutive candles close below
> the 9 SMA — after the first candle closes below, the immediately following candle must also close
> below it.

Paper is the rehearsal for real money (user, 2026-09-23: *"if the paper trading results are too good
then we will switch it to real money"*). That switch is **P35** and is not built here.

---

## Decision table

| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | "stocks selected by the indicator" | The P14 NSE scan at 09:20 (P32 rows 2, 3). A **Long**-list stock may only go long, a **Short**-list stock only short. At most 10 signals (P32 row 5) | Recording 1 + P32 |
| 2 | Whose candles | The **near-month future's own** 5-minute candles — for the range, the SMA and the fills | One price series, so every P&L is recomputable from one payload |
| 3 | The range | `high = max(high)`, `low = min(low)` of the 09:15 and 09:20 candles. Fetched from `/v2/charts/intraday` (interval 5) at **09:25:05**, every signal sharing **one** gate key `paper:candles`. A missing candle → `no range: <reason>`, on screen | Recording 1 |
| 4 | "Breaks above / below" | The first feed tick with LTP **strictly** above the high (long) / below the low (short), LTP rounded to 0.01. The fill is that tick's LTP. A tick exactly at the level does not trigger | "Breaks" = trades through. Float32 rule from CLAUDE.md |
| 5 | Entry window | **09:25:00 – 15:00:00**. No break by 15:00 → `not taken: no break` | **GUESS.** The recording gives no cutoff |
| 6 | What is traded | Each break opens **two paper legs**: 1 lot of the future, and 1 lot of the near-month **stock option nearest the future's LTP at the break tick** — **CE** for a long, **PE** for a short (both are BUYs). The option fills at its first feed tick after the break | "future & Options", "call-side entry" |
| 7 | Exit (long) | Two **consecutive completed** 5-minute candles close **below** SMA9. Counting starts with the candle the entry happened in. Candles are fetched 5 s after each 5-minute boundary. Both legs exit at their **first feed tick** after the second close is confirmed | Recording 2 |
| 8 | Exit (short) | The mirror: two consecutive closes **above** SMA9 | Only reading consistent with Recording 2 |
| 9 | SMA9 | Mean of the last 9 **completed** 5-minute closes, reaching back into the previous session | What a chart computes; exists at 09:25 |
| 10 | P32's 1% stop / 2% target | **Removed.** Exits: row 7/8, 15:15 square-off, manual Exit | The recording defines the exit completely |
| 11 | Re-entry | One trade per stock per day (P32 row 9) | Unchanged |
| 12 | Screen | Open table drops Stop / Target, gains **Range H–L**, **SMA9**, **closes against (0/1/2)**. A **Waiting for break** table: symbol · side · high · low · LTP. Option legs sit under their future | P32 row 15's layout |
| 13 | Replay | Seeded candles: one long breaks, one short breaks, one never breaks, one exits on the SMA rule. Every filter rejects something | CLAUDE.md: a seeded replay must make every filter reject something |

## Out of scope

- Trading from the LTP Calculator (P34), real orders (P35), brokerage, trailing stops, averaging.

## Acceptance criteria

| # | Criterion | How |
|---|---|---|
| AC1 | The range equals the hand-computed high/low of the 09:15 and 09:20 candles; a tick 0.01 inside the range does not enter; a tick at the level does not enter; a Long-list stock breaking the LOW does not enter | Unit, clock injected |
| AC2 | The SMA exit fires on the **2nd** consecutive close against SMA9 and **not** on the 1st; below/above/below does not exit; long and short | Unit |
| AC3 | No break by 15:00 → `no break`; 15:15 squares off both legs | Unit |
| AC4 | Every P&L on both legs recomputed in integer paise by a second implementation equals state, screen and ledger file | Unit + browser |
| AC5 | Replay browser run shows the four seeded outcomes; screenshots taken **and read** | `.cache/p33-verify.js` |
| AC6 | Live, the next trading day: the entries logged, recomputed from Dhan's real candles | **Open until measured** — never scored as a pass |
| AC7 | Every earlier suite re-run and green | Suites in `.cache/` |
| AC8 | Still no order endpoint in `src/`; `paper.ts` imports nothing from `dhan.ts` | Grep in `paper:test` |

## Risks

1. **No price stop.** A sharp move against the position runs until the second 5-minute close. As
   recorded. `change 10` adds the opposite side of the range as a hard stop.
2. Stock options expire Tue 29 Sep, so the option leg decays fast this week.
3. `/v2/charts/intraday` on `FUTSTK` 5-minute candles during a session is untested live — whether
   the forming candle is included is decided by time (`t + 5 min <= now`), not by position.

---

## Amendments found while building

| # | When | Change | Why |
|---|---|---|---|
| 14 | during build | The **scan** keeps P32's 09:20–09:30 retry window (`SCAN_UNTIL_MIN`); only the **entry** window moves to 09:25–15:00 | The recording moves the entry, not the indicator |
| 15 | during build | A failed candle fetch is retried after **60 s** (`RETRY_MS`, P32 row 3's constant) | Reuses a locked number instead of inventing one |
| 16 | during build | Option strike tie (the future's LTP exactly between two strikes) → the **lower** strike | Same tie rule as `ltp-calculator-v1.md` row 11 |
| 17 | during build | Replay's `Run now` maps the press to **09:25:00 IST** (P32 amendment 19 said 09:20) | The range needs the 09:20 candle closed; at 09:20 the replay run would wait 5 real minutes before anything could happen |
| 18 | during build | Replay option ticks start at **2% of the future's price** | Synthetic only; without a base the replay feed walks a stock option at 24,000 |
| 19 | during build | An option leg whose future has already exited before the option's first tick → `unfilled: future exited first` | A leg that would open after its signal ended would be a new trade, not the same one |

## Open question for the user (found measuring, not changed)

Dhan's 5-minute `FUTSTK` series carries **77 candles a day, 09:15 to 15:35** — the 15:30 and 15:35
candles are the post-close session (CLAUDE.md: Dhan's sessions have 385 one-minute candles,
including 15:30–15:39). Row 9's SMA9 at 09:25 therefore reaches back into them (measured on MFSL,
23 Sep: the window starts at 22 Sep 15:10). A chart that shows only 09:15–15:30 would compute a
slightly different SMA for the first ~45 minutes. **Row 9 is built as written; say `exclude` to drop
candles opening at or after 15:30.**
