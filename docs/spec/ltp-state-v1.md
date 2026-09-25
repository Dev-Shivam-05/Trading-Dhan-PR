# P49 — LTP state machine (L4 pressure, L5 scenario + SOC, L8 Game of Percentage, L9 IV gate)

**Locked 2026-09-25** with one `go`. Rows marked **GUESS** state a number no source gives; each can be vetoed in one
word. Source of every "why": `LTP-CALCULATOR/ANALYSIS/05-CONSOLIDATED-LOGIC.md` §6–§8, §10, §20, and `08-V2-DELTA.md`.
Levels (L1–L3) come from P29's `readChain()` (`docs/spec/ltp-calculator-v1.md`), unchanged. Every rule is in
**strike space** (P29 row 5): higher strike = up = bullish.

## Measured before the spec
On 80 NIFTY days (2026-06-01 → 2026-09-25, `.cache/p49-flicker.ts`), `readChain()`'s level strike changes **0–27 times
per side per day, median ≈ 4**, and one side is weak for all ~375 minutes on many days. 0–2 minutes a day have no
reading (spot exactly on a strike).

## Decision table

### Inputs
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | One minute | One minute of `readDay(date, 1)` (W1, current weekly expiry), **09:15–15:29 IST**. The 15:30–15:39 candles are dropped | The rebuild carries 385 candles; the session is 375 |
| 2 | Minute → chain | Every strike with a non-null close at minute i: `ltp` = close, `volume` = **cumulative** Σv since 09:15 (a null minute counts 0), `oi`, `iv` at i; `spot` at i. Fed to P29's `readChain()` unchanged | The tool's volume is the day's running total (V05); L1–L3 stay the verified P29 engine |
| 3 | Coverage gaps | A level or challenger strike whose leg had any null minute before i is flagged `partial`. A level on the outermost strike of its scan range is flagged `edge`. Counted and printed, never dropped | 16 of 50 legs on 24 Sep have gaps; the real tool sees the whole chain, the rebuild ±10 strikes |
| 4 | Clock | Pure; time is the minute stamp; no `Date.now()`. All state resets at the day's first minute | CLAUDE.md: a rule reading the clock cannot be tested outside 09:15–15:30 |
| 5 | No-read minute | `readChain()` gives no pair or no level (spot exactly on a strike, P29 row 10): every state and clock is held, the minute is marked `noRead` | Measured at 0–2 a day |

### L4 — pressure
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 6 | Weak / strong | P29's combined grade (its row 21). `wtt` = pushing up, `wtb` = pushing down, `strong` = neither | Already verified by P29 |
| 7 | Shift | The level's strike changes while the old strike is still in the side's scan range (resistance: strikes ≥ `pair.lower`; support: ≤ `pair.upper`). Complete **at that minute**. Direction = sign of new − old. **No debounce** | V21/V23: complete when the volume gap closes to zero. V75: the warning cleared at 74.99 immediately — the tool has no hysteresis, and an N-minute debounce is an invented number |
| 8 | Re-seat | The level changes because the old strike **left** the scan range (price traded through it, or it left the ±10 window) → a completed shift in that direction, tagged `cause: 'reseat'` (a row-7 shift is `cause: 'volume'`). **GUESS** | V23 warns that a moving line creates spurious labels; the tag keeps the two separable |
| 9 | The five states (V108) | **stable** (no weak minute and no shift since the day's first reading) → neutral. **abandoned-up** (WTT → strong at the same strike) → **bearish**. **abandoned-down** (WTB → strong) → **bullish**. **shifted-up** (strong after a shift up) → **bullish**. **shifted-down** → **bearish**. The most recent transition holds until the next one. Weak → strong at the same strike counts as **shifted** when the level arrived there by a shift and has not been strong since, otherwise **abandoned** (direction = the last weak label) | V108's table; "a level that attempts a move and gives it up pushes the other way; one that completes it pushes the way it went" |
| 10 | Pressure while weak | No shift yet today: WTT = bullish, WTB = bearish. After a shift today: **the direction of the last shift**, whatever the label. The pressure is stored; the label is derived | COA 1.0 scenarios 2–5; V112 "if it has already shifted down, a WTT reading is bearish — and the reverse" |
| 11 | `shiftDone` | Per side, true from the day's first completed shift to the end of the day | V109: without it the percentage is uninterpretable |

### L5 — scenario and SOC
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 12 | COA 1.0 | (resistance pressure, support pressure): N/N **1** neutral · bear/N **2** slightly bearish · bull/N **3** slightly bullish · N/bear **4** slightly bearish · N/bull **5** slightly bullish · bear/bear **6** blood bath · bull/bull **7** bull run · bull/bear **8** both sides risky (pulling apart) · bear/bull **9** both sides risky (pressing together) | V13, V112, V121 |
| 13 | OQ-14 | Both sides bearish = **6**, not 9 | V13 and V37 agree; V47 alone dissents |
| 14 | A side's percentage | The challenger percentage of the factor that placed the level: **volume** if the level is built on volume, else OI | P29 row 22: volume leads intraday |
| 15 | SOC | The clock runs while **this side is weak and the other side is strong**. It restarts at a completed shift on this side (V29) and stops when either condition breaks (V47: the other side reaching 75%). Duration = minute stamp − clock start. **< 60 min = warning; ≥ 60 = confirmed**, graded `floor(min/60)` R (V112). Resistance-side SOC → **bullish**, support-side → **bearish** (V16, V27, V28). A confirmed SOC overrides COA 1.0 and is read as bull run / blood bath (V100) | V75 (V2) makes it three-stage — 75% raises the warning, the hour confirms, the R grade is displayed — which closes OQ-13 |

### L8 — the Game of Percentage
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 16 | Use A (scenarios 8 and 9 only) | V23's nine-row table on each side's percentage change over **5 minutes**; `|Δ| < 1.0` point = stable. R inc/S stable bullish · R dec/S stable bearish · S/S consolidation · inc/inc consolidation · dec/inc bearish · stable/inc bearish · stable/dec bullish · inc/dec bullish · dec/dec consolidation. No value 5 minutes back → unknown. **GUESS** (window and dead-band) | No source states a window; V114 steps 65 → 68 → 70 → 72, i.e. 2–3 points a step |
| 17 | Use B | Per side: the challenger at a higher strike (WTT-like) — % rising → up, falling → down; at a lower strike (WTB-like) — rising → down, falling → up; **inverted when `shiftDone`**. Output only; never an entry | V109 table and inversion |
| 18 | The four numbers | Per side, the highest percentage (same factor as row 14) among scan-range strikes **above** the level and **below** it. Output only | V109 "watch all four" |

### L9 — IV gate (output only; never changes the verdict)
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 19 | Balance | ATM = `ltpAtm`. `|ceIV − peIV| ≤ 1.00` → `settled`, else `unbalanced`; either IV missing → `unknown` | V104 |
| 20 | Move | ATM IV = mean of the two sides. `|ATM IV − ATM IV at 09:20| ≥ 2.0` → `moving`, else `steady`; before 09:20 or missing → `unknown`. **GUESS** | V107: 11.73 → 14/15/16, the smallest cited move 2.27 |
| 21 | Late | Minutes ≥ 14:30 are flagged `late` | V11: the chain stops being reliable after 14:30 |

### Where it lives
| # | Ambiguity | Locked value |
|---|---|---|
| 22 | Code | `src/server/ltp-state.ts`, pure: `observe(day, i, acc)`, `step(prev, obs, t)`, `runDay(day)`. `npm run ltpstate [-- <date>]` prints a day's transitions, or a summary over every stored day. `npm run ltpstate:test`. No Dhan call, no UI, no route |

## Out of scope
UI panel, live poller wiring and an `/api` route; line sets (P50); trades and backtest (P51); how far an SOC move runs
(OQ-3, withheld by the source); V39's extra WTB constraint (OQ-12, one file only); W2 chains.

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | Each of the five states is reached by a fixture, and a near-miss is rejected (weak → strong at the same strike = abandoned, not shifted; arrival by shift then strong = shifted) |
| AC2 | All nine COA cells, one fixture each |
| AC3 | All nine rows of the Use A table; boundary 0.99 = stable, 1.00 = moving |
| AC4 | The same rising percentage reads opposite before and after a shift (V109) |
| AC5 | SOC at 59 min = warning, 60 = 1R, 120 = 2R; a shift restarts the clock; the other side reaching 75% ends it |
| AC6 | IV boundaries: 1.00 settled / 1.01 unbalanced; 1.99 steady / 2.00 moving |
| AC7 | A second, differently built implementation agrees minute for minute (state, pressure, scenario, SOC, Use A) on all stored days, **0 mismatches** |
| AC8 | Every rule rejects something on real data: across all stored days each state, each of the nine scenarios, SOC warning and confirmed, and each IV value occur at least once. A zero is a fail |
| AC9 | 4 Jun 2024 (election results, a named high-IV day, V107) reads `moving` at some minute |
| AC10 | `ltp-state.ts` imports nothing from `dhan.ts` and never calls `Date.now()`; two runs give byte-identical output |
| AC11 | tsc clean; `ltp:test` 29/29 and `chainhist:test` 50/50 still pass |

## Result (2026-09-25, built on `p49-ltp-state`)
`npm run ltpstate:test` **45/45**: AC1–AC6 on hand-built minutes (every rule also shown rejecting), AC7 **0 mismatches
over 254,080 minutes / 680 days** against a look-back implementation, and the comparison shown to catch a swapped rule
(279 minutes differ when the abandoned pressures are inverted). AC8 26/26 values occur on real data. AC9: 4 Jun 2024
turns `moving` at 09:22 (ATM IV 48.5/54.5 at 09:20 → 57.9/60.8). AC10 byte-identical, no `dhan.ts`, no clock.
AC11: tsc clean, `ltp:test` 29/29, `chainhist:test` 50/50. A full pass over the 680 days takes ~40 s.

**What the history says** (`npm run ltpstate`, 679 days with session minutes; the Muhurat evening of 1 Nov 2024 has none):
| Measure | Value |
|---|---|
| Scenario share of minutes | 1: 1.0% · 2: 5.0% · 3: 4.3% · 4: 2.3% · 5: 4.0% · **6: 24.4%** · **7: 23.8%** · 8: 6.4% · **9: 28.8%** |
| Shifts per day, both sides | median **13**, max 55; 5,602 volume shifts and **4,360 re-seats** (44%) |
| Days with a confirmed SOC | resistance side (bullish) **302**, support side (bearish) **202**, of 679 |
| IV balance (row 19) | `unbalanced` **70%** of minutes, `settled` 30% |
| IV move (row 20) | `moving` 30% of minutes |
| Coverage | `partial` 1.7% of side-minutes, `edge` 0.1%, no reading 230 minutes |

**Read these before trusting the verdicts:**
- **SOC confirms on most days.** One side weak for an hour while the other is strong is ordinary on this data, so
  row 15 as written is not a rare event. Either that is the real market, or minute-level cumulative volume keeps a
  challenger above 75% far longer than the tool's 3 s picture does. Only a comparison with the tool can say which.
- **Row 19's one-point rule calls the IV unbalanced 70% of the time** on Dhan's per-leg minute IV. V104's "within one
  point" may assume a smoother IV (the tool's own, or an average) than a single leg's minute value.
- **Re-seats are 44% of all shifts** — the level moving because price traded through it, not because volume moved.
  Row 8 counts them as shifts. If that is wrong, the shifted-* pressures change on almost half the events.
- Scenario 1 (neutral) is only 1% of minutes: a level that has once been weak never returns to `stable` (row 9, the
  last transition holds).

## Risks
- **No ground truth.** No LTP Calculator screen exists for any of these days; a wrong rule can pass every AC. Cheapest
  check: the tool's 7-day premium, comparing its banner on 2–3 days.
- **V75 (V2) calls a support shift 25,000 → 24,900 "bottom to top … bullish"**, which contradicts row 9 in strike space.
  P29 row 5 decided strike space; if V75 is right, shifted-up and shifted-down swap.
- The rebuild is 1-minute; the tool refreshes every 3 s, so sub-minute attempts are invisible.
- SOC may confirm on many days, because one side is often weak all session. AC8's counts show how often.
