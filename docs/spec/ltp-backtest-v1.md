# P51 — Index option backtest (the 920 lines and AI LTP, priced from the options' own candles)

**Locked 2026-09-26 by delegation** (the user: "go for it and complete all the pending phases … without stopping").
Rows marked **GUESS** state a value no source gives, and each can be vetoed in one word. The entries are P50's signals
(`docs/spec/ltp-lines-v1.md`), unchanged. This phase only decides what a trade on them costs, how it ends and what it
earns. History only: no paper book (that is P53), no UI.

## Decision table

### The trade
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | Eligible signals | P50 signals whose veto is `null` or a **price** veto ((d)–(g)). The price veto is re-run with this config's stop and target (row 5). `window`, `used` and `side` stay rejected | A mechanical 50-point stop (V117) changes the ratio gate's answer, not whether the line was first touched |
| 2 | Books | Two books, **920** and **AI**, run independently. Each holds **one position at a time**. A signal that arrives while its book is open is `busy` and skipped | V117: "take the fresh trade at the NEXT LINE rather than averaging"; V11/V30: a single-lot trader does not average |
| 3 | The option | The strike **nearest the entry line** (ties go to the lower strike), CE for a call signal and PE for a put signal, from the day's W1 chain. If that leg has no close at the fill minute, the next strike toward the money is tried once. Otherwise the signal is `no-price` | P34's answer ("the strike nearest spot at entry"); the touch happens at the line |
| 4 | Fill models | `touch`: entry at the option's **close of the touch minute**. `late1m`: the **close of the next minute**. Exits are priced the same way. Every figure is quoted under both | CLAUDE.md (P44): a backtest result is quoted under both fill models, or it is not quoted. There is no premium-at-the-line in the data |
| 5 | Stop and target | Default `structure`: P50's stop (EOR+2 / EOS−2 or Max Pain) and target (next divergence or Max Gain), both on the **index**. Variant `mech50`: 50 index points each way (V117) | P34 / P50 rows 6, 7, 12, 15; V117's own backtest used 50/50 |
| 6 | Exit order | From the minute **after** entry. Stop when the index low (CE) or high (PE) reaches the stop. Target when the high (CE) or low (PE) reaches the target. **Both in one minute → stop.** AI trades also exit at the close of the first minute whose verdict **no longer permits** their side (V114, V64). The time exit is at the close of **14:29** (V48: everything closed at 2:30) | Conservative ordering; V117 does not check scenarios for 920 ("deliberately standalone") |
| 7 | Size | `lots = max(1, floor(20,000 / (premium × lot)))`. A trade whose one lot costs more than ₹20,000 is flagged `overBudget`. **lot = 65 for every day (GUESS)**. NIFTY's lot changed several times since 2024 and the master holds only today's. Points per unit are the primary figure; rupees are at today's lot | The user, 2026-09-25 (DECISIONS.md); lot from `api-scrip-master-detailed.csv` (65.0) |
| 8 | Costs | Per round trip: brokerage ₹20 × 2; STT 0.1% of the sell premium; exchange 0.03503% of premium turnover; SEBI 0.0001%; stamp 0.003% of the buy; GST 18% on brokerage + exchange + SEBI. **GUESS** (published NSE/Dhan schedules as of 2026; the 2024 STT of 0.0625% is not modelled) | P37/P44 used the same structure for futures (`train.ts` `COSTS`) |

### The report
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 9 | Per book × fill model | Trades, target-hit %, positive %, points, ₹ gross, costs, ₹ net, the largest drawdown in ₹ net, the median holding minutes | V117 reports hit rate, streaks and duration |
| 10 | V117's shape | 920 book, `mech50`, over **1 Jan – 7 Apr 2024** (V117's window) and over all history. Split by line (EOR / EOS / EOR+1 / EOS−1), by gap width (≤ 50, 51–100, > 100), by entry hour, by weekday and by the session's place in the expiry week (expiry day, day after, other). Each V117 claim is scored **reproduced / not reproduced / not measurable** | The phase goal: "reproduces V117's shape" |
| 11 | Walk-forward | 24 configurations: book (920, AI) × lines (all; extensions only = EOR/EOS or the Moderates; outer/Risky only) × target (structure, mech50) × stop (structure, mech50). Each month from the 7th month on, the configuration with the best ₹ net over the previous **6 months** (at least 10 trades, else the P34 default) trades the next month. The out-of-sample total is quoted next to the in-sample best. **GUESS** (window lengths) | P44's walk-forward shape, scaled to ~5 trades a month |

### Where it lives
| # | Locked value |
|---|---|
| 12 | `src/server/ltp-backtest.ts`, pure: `tradeDay(dayLines, day, cfg, fill)`, `costOf()`, `lotsFor()`. `npm run ltpbt [-- <date>]` prints a day's trades or the full report. `npm run ltpbt:test`. No Dhan call, no clock |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | On a hand-built day each exit is exercised: target, stop, **stop before target in one minute**, 14:29 time exit, the AI state-change exit, and the `late1m` model pricing one minute later |
| AC2 | Costs to the paisa on a hand-worked example; lots at the ₹20,000 boundary; the `overBudget` flag set and cleared |
| AC3 | Busy: a second eligible signal while a book is open is `busy`, and an eligible signal after the exit trades |
| AC4 | Accounting on all days: `trades + busy + no-price + price-vetoed = eligible`, where eligible is counted independently from P50's signals |
| AC5 | No look-ahead: every option close **after** a trade's exit minute ×2 leaves that trade identical |
| AC6 | A second implementation of the 920 trade walk (`touch`, `structure`) agrees on every trade over all days, **0 mismatches**, and is shown to catch a swapped rule (target checked before stop) |
| AC7 | The report prints both fill models for both books, the V117 table with every claim scored, and the walk-forward out-of-sample figure |
| AC8 | `ltp-backtest.ts` imports nothing from `dhan.ts`, never calls `Date.now()`, and two runs are byte-identical |
| AC9 | tsc clean; `ltplines:test` 65/65, `ltpstate:test` 45/45, `ltp:test` 29/29, `chainhist:test` 50/50 |

## Out of scope
Averaging; partial exits at divergences; limit-order fill modelling (a premium pre-computed at the line needs a pricer);
indices other than NIFTY (no rebuilt chains); the paper book (P53).
