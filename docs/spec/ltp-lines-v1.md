# P50 — LTP line sets (L7 the 920 and AI LTP lines, L8 scenario → line set, L9 first touch and vetoes)

**Locked 2026-09-26 by delegation.** The user said "go for it and complete all the pending phases … without stopping"
(2026-09-26), so this table was not put to a vote. Rows marked **GUESS** state a value no source gives. Each one can be
vetoed in one word. Source of every "why": `LTP-CALCULATOR/ANALYSIS/05-CONSOLIDATED-LOGIC.md` §9.3–9.5, §11, §12.1 and
§13.3, and `07-OPEN-QUESTIONS.md` (OQ-15, 18, 20, 21, 22).

This phase folds in **P34**. It uses the user's answers of 2026-09-23 (buy CE at the first touch of the extension of
support, PE at the first touch of the extension of resistance, stop at extension ±2, target the next divergence, each line once a
day). History only: no UI, no live wiring, no trades priced. P51 prices the trades this phase emits.

Every rule is in **strike space** (P29 row 5). Levels come from P29's `readChain()`, and scenarios come from P49's `runDay()`.
Both are unchanged.

## Measured before the spec
- The chain rebuild's `spot` **is** the NIFTY index's 1-minute close. On 2024-01-01 the first three minutes are
  21710.40 / 21695.35 / 21709.55 in both. Dhan's `/v2/charts/intraday` returns the index's (`IDX_I`, `13`)
  1-minute OHLC back to 2024-01-01 with 375 candles a session (probe `.cache/p50-idx-probe.ts`). So a touch can be read
  from the minute's high and low, not only its close.
- Reversal prices are monotonic in strike on an arbitrage-free chain: `K + C(K)` rises with K because `dC/dK > −1`, and
  `K − P(K)` rises with K because `dP/dK < 1`. So EOR+1 > EOR and EOS > EOS−1 should hold. AC1 counts the days where
  they do not.

## Decision table

### Inputs
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | The chain | P48's W1 minute chain, read minute by minute exactly as P49 row 2 does (`snapshotAt`, cumulative volume) | One reading of the chain across P49 and P50 |
| 2 | The index path | NIFTY 1-minute OHLC in `.cache/history/idx/NIFTY.json`. It is fetched from `/v2/charts/intraday` (`IDX_I`, `13`, `INDEX`) in 89-day chunks from 2024-01-01, with gate key `history` at 1100 ms. Replay mode refuses | A line is touched by the minute's **low/high**, which the chain's close-only `spot` cannot show |
| 3 | The step | The ladder's median strike gap (NIFTY: 50) | P29's `gap()`; no hardcoded 50 |

### L7 — the 920 lines
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 4 | Which snapshot | The minute whose candle **opens at 09:20**. Its close is the 09:21 state. The lines are live from minute **09:21** and fixed for the day | V49/V76/V77: "generated at 9:21"; V48: fixed for the day |
| 5 | The four lines | **EOR+1** = rev(R+step, call) · **EOR** = rev(R, call) · **EOS** = rev(S, put) · **EOS−1** = rev(S−step, put), with R and S from `readChain()` at row 4's minute. EOR+1 and EOR are **PUT** entries; EOS and EOS−1 are **CALL** entries | §11.1, V48; §9.3's side-crossing rule |
| 6 | The stop | Shared per side. Put trades: **EOR+2** = rev(R+2·step, call). Call trades: **EOS−2** = rev(S−2·step, put). V48's three-step "+10 points" reading is not used | V61 "two strikes above the 9:20 resistance strike"; V114 "extension +2 IS the Max Pain line"; P34's `go`. The ±10 appears in only one form, and V61/V114 state the structure without it |
| 7 | The target | P34's `go`: **the next divergence** in the trade's direction. Divergences are rev(K, call) and rev(K, put) for every strike **strictly between** S and R at row 4's minute (V11). The target is the nearest one beyond the entry. With none, it is the **next line** in that direction (V48) | P34 (the user's answer). V11 says price runs straight from EOS to EOR when nothing lies between. OQ-15's other readings (V61 nearest reversal, V48 next line) are P52's to compare |
| 8 | A missing line | A line is **missing** when its strike has no LTP at row 4's minute. It is also missing when row 4's close is already beyond it: an upper line when close ≥ line, a lower line when close ≤ line. A missing line is never traded. A missing stop removes both lines on that side (V60) | V117's mechanism ("the market opens above its resistance reversal"). V99/V107/V117 make it a prohibition. OQ-22's forecast reading is measured, not traded |
| 9 | Coinciding lines | Two of the four within **0.05** (one tick) are flagged `coincide`. Both are still drawn | V106 is a stock rule ("skip the stock"); for the index it is recorded, not a veto. GUESS |
| 10 | Gap width | `EOR − EOS`, reported per day | V117's fastest filter; P51/P52 use it |

### L7/L8 — the AI LTP lines
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 11 | Static or moving | **Recomputed every minute** from that minute's `readChain()` | OQ-20's likely resolution: index Live/AI lines move (V47, V51) |
| 12 | Moderate | S Moderate = rev(S, put) = EOS. R Moderate = rev(R, call) = EOR | V110 |
| 13 | Risky | S Risky = rev(K, put), where K is the strike **above** support and inside support's scan range (≤ `pair.upper`) with the **highest challenger percentage** of support's factor (P49 row 18's "above" strike). R Risky is the mirror: the strike below resistance, ≥ `pair.lower`, giving rev(K, call). No such strike → the line is absent. **GUESS** | V110: "the strike where support is weak-towards-top". The strongest top-side challenger is taken **whether or not it clears 75%**, because V100 draws S Risky in a bull run, where support is usually strong |
| 14 | Max Pain | S Max Pain = rev(S−2·step, put). R Max Pain = rev(R+2·step, call) | V110, V114 |
| 15 | Max Gain | S Max Gain = the **smallest divergence strictly above the higher S entry line**. With none, it is R Moderate (EOR). R Max Gain is the mirror: the largest divergence strictly below the lower R entry line, else S Moderate. **GUESS** | §11.3 draws Max Gain between the entry and price. P34 targets the next divergence, and V11 says the move runs EOS → EOR with nothing between |
| 16 | Scenario → set | P49's verdict at the minute. Slightly bullish (3, 5): all 4 S + R Risky, R Max Gain, R Max Pain. Slightly bearish (2, 4): all 4 R + S Risky, S Max Gain, S Max Pain. Bull run (7) or bullish SOC: the 4 S. Blood bath (6) or bearish SOC: the 4 R. Scenario 8: all 8. Scenario 9: all but both Moderates. **Neutral (1) and no verdict: none (GUESS)** | V100's table, §11.4. V100 has no neutral row; drawing nothing is the choice that trades nothing unseen |
| 17 | Which side may trade | Bullish sets (3, 5, 7, bullish SOC): **calls** from S Risky / S Moderate. Bearish sets (2, 4, 6, bearish SOC): **puts** from R Risky / R Moderate. 8 and 9: both. Counter-trend trades from a Max Gain line are **not** taken. **GUESS** | V110, V13 "never trade the side the scenario forbids". The counter-trade needs V100's "no yellow" marker, which is not modelled |

### L9 — touch, first touch, vetoes
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 18 | A touch | A line **below** the price is touched in minute i when the index **low ≤ line**. A line **above** is touched when **high ≥ line**. The line must have been on the right side at the end of minute i−1 (close > a lower line, close < an upper line). **No look-ahead:** an AI line traded in minute i is the value computed from minute **i−1**'s chain | §13.4: wait at the level. The minute i chain includes minute i's own trading |
| 19 | First touch only | Each named line trades **at most once a day**. For the 920 lines that is each of the four. For the AI lines it is each entry name (`S Risky`, `S Moderate`, `R Risky`, `R Moderate`). A later touch is recorded as `second-touch` | V48, V53, V57, V66, V100, V125 |
| 20 | Entry window | 920: minutes **09:21–11:29** (V48, V117 "after 11:30, do not initiate"). AI: **09:21–14:29** (V48 "2:30: no new trades"). **GUESS for AI** | §22 |
| 21 | Vetoes, in this order, each counted where it rejects | (a) window; (b) line already used; (c) side not permitted (AI, row 17); (d) no stop / Max Pain missing (V60); (e) stop on the entry, `|stop − entry| < 0.05` (V66); (f) entry = target, `|target − entry| < 0.05` (V109, V116); (g) **ratio gate**: stop distance > target distance (V57, V58, V60); (h) IV gate: P49 `balance = unbalanced` **and** `move = moving`. (h) is **off by default**, because P49 measured `unbalanced` on 70% of minutes; P52 decides it | §12.1 |

### Where it lives
| # | Ambiguity | Locked value |
|---|---|---|
| 22 | Code | `src/server/idxhist.ts` (fetch + read the index path). `src/server/ltp-lines.ts`, pure: `lines920()`, `aiLines()`, `daySignals(day, idx, states)`. `npm run idxhist` fetches. `npm run ltplines [-- <date>]` prints a day, or a summary over all days. `npm run ltplines:test`. No Dhan call from `ltp-lines.ts`, no clock, no UI, no route |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | On a hand-built chain, each of EOR+1, EOR, EOS, EOS−1, EOR+2 and EOS−2 equals its formula to the paisa. Over all stored days, the count of days where EOR+1 ≤ EOR or EOS−1 ≥ EOS is **printed** (expected 0; a non-zero value is shown with its days, not hidden) |
| AC2 | Missing lines: a fixture whose 09:20 close is ≥ EOR drops EOR and EOR+1 and makes no put trade there. A fixture whose close is below keeps them. Both branches are exercised |
| AC3 | All 9 scenarios and both SOC verdicts give row 16's set exactly (11 fixtures) |
| AC4 | Touch: a minute whose close stays above a line but whose low pierces it **is** a touch. A second touch of the same line is `second-touch`, not a trade. A line drawn with price already beyond it is never touched from the wrong side |
| AC5 | Every veto (a)–(g) rejects a fixture. On real data each of (a)–(g) rejects at least once. `accepted + Σ rejected` equals the number of first-touch candidates **counted independently** (a separate loop over touches) |
| AC6 | No look-ahead: changing minute i's chain (every LTP × 1.5) leaves every AI signal **at minute i** unchanged |
| AC7 | A second, differently built implementation of the 920 lines and their touches (raw legs → reversal prices directly; touches by a backward scan) agrees with the engine on every stored day, **0 mismatches**, and is shown to catch a swapped rule |
| AC8 | The index path matches the chain: close = chain `spot` on ≥ 99.9% of shared minutes, over all stored days |
| AC9 | `ltp-lines.ts` imports nothing from `dhan.ts` and never calls `Date.now()`. Two runs give byte-identical output |
| AC10 | tsc clean; `ltpstate:test` 45/45, `ltp:test` 29/29, `chainhist:test` 50/50 still pass |

## Out of scope
Pricing and P&L (P51); settling OQ-15/22/33 by data (P52); live wiring and the paper book (P53); the stock C1/C2/P1/P2
set (§11.5, a stock path); counter-trend trades; V109's "percentage running to 100" warning; averaging.
