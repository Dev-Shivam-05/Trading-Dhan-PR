# P52 — Open questions settled by data (on P51's backtest)

**Locked 2026-09-26 by delegation** (the user: "go for it and complete all the pending phases … without stopping").
It uses P51's engine (`docs/spec/ltp-backtest-v1.md`) and P50's signals unchanged. The three additions to it are listed under
"Engine additions". Every question below gets a verdict from `npm run ltpoq`. **Its rule was written here before the run**, so the data
cannot choose the question it answers.

## The one rule for every verdict
A question is **settled** only when **both fill models** (`touch` and `late1m`) give the same answer **and** every arm
compared has **≥ 20 trades**. Otherwise it is **not settled**, and the reason is printed: the fills disagree, or an arm is too small.
"Better" means **higher ₹ net per trade** (costs included). A total would reward the arm that trades more.
**No verdict changes a live or paper setting.** A settled answer becomes a recommendation on the board (memory: delegated
decisions).

## Questions
| # | Question | Source | Arms | Settled when |
|---|---|---|---|---|
| Q1 | **OQ-33 safe vs risky, 920.** Do the inner lines (EOR, EOS) beat the outer (EOR+1, EOS−1)? | V48/V51/V61 vs V117 | Each line traded **as its own book** (P51 row 2's one-position rule would otherwise hide the outer lines behind the inner), P34 rules. Inner = EOR + EOS pooled, outer = EOR+1 + EOS−1 pooled | Row rule. The median stop size of each arm is printed, so "safe = smaller stop" stays visible |
| Q1b | **OQ-33 for AI.** Moderate vs Risky | V60, V100 | Each line on its own, a 50/50 target and stop (the structural target makes AI trades too rare to compare, as P51 showed) | Row rule |
| Q2 | **OQ-9 strike depth.** Nearest strike vs 1, 2 or 4 strikes in the money | V19, V107, V116 | 920 with P34 rules, at depth 0 / 1 / 2 / 4 | The best depth is the same under both fills. Premium captured per index point is printed (V107: 36 of 50 deep ITM) |
| Q3 | **OQ-2 volume vs OI.** Which basis gives the better level? | V05 (both > volume > OI), V43 | 920 trades (P34 rules) split by the factor that placed the level at 09:20 | The ranking is the same under both fills. It is compared with V05's |
| Q4 | **Stop size** (V99's grid) | V99, V111 | 920, all lines, target/stop in index points: 10/10, 20/20, 30/20, 30/30, 50/30, 50/50 | The best cell is the same under both fills. It is compared with V99's 30/20 |
| Q5 | **The gap filter** | V117 | 920 with P34 rules, only on days with gap width ≤ 150 / 200 / 250 / 300 / 400 / no filter | A threshold beats "no filter" under both fills |
| Q6 | **Time windows** | V117, V13, V119 | Entry hour (920: 09/10/11; AI 50/50: 09–14) | The best hour is the same under both fills |
| Q7 | **Which indices** | V117 | — | **Not measurable.** Only NIFTY chains exist (P48 is NIFTY-only by the user's decision, 2026-09-25) |
| Q8 | **OQ-15 the 920 target** | V48, V51/52, V61, V117 | 920 with the P34 stop and three targets: next divergence (P34), next line (V48), 50 points (V117) | Row rule |
| Q9 | **The IV gate** (P49 rows 19–20) | V21, V104, V107 | AI 50/50, all lines, gate off vs on (no entry when the minute before is `unbalanced` **and** `moving`) | Gate-on beats gate-off per trade under both fills |
| Q10 | **OQ-22 the missing-line forecast** | V61 | Days whose 920 upper lines are both missing: did NIFTY close (15:29) above its 09:21 level? The mirror for lower lines | ≥ 20 such days, and ≥ 60% go the forecast's way (GUESS threshold) |
| Q11 | **OQ-1, the evidence P50 found** | V09, V117 | The extension distance (premium at the 09:20 level) and the gap width, per year, against V09's "25–35 points near 20,000" scaled to the index level (0.125–0.175%) and V117's "gaps above 100 are rare" | Recorded, never acted on. P29 row 12 changes only with the user's word |

## Engine additions (P51, P50 — additive, defaults unchanged)
- `Cfg` gains `tgtPts` / `stopPts` (Q4), `depth` (Q2), `ivGate` (Q9), `target: 'nextline'` (Q8), and a single line
  name for `lines` (Q1). All are optional, and with none set the output is byte-identical to P51's.
- `DayBook` carries the four 920 values and P49's IV flag per minute. P50's `Signal` carries `basis` (Q3), the factor
  that placed its level.

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | Each of Q1–Q11 prints a verdict line: settled (with the answer), not settled (with the reason), or not measurable |
| AC2 | The verdict function is unit-tested. Fills agreeing and both arms ≥ 20 → settled. The fills disagreeing → not settled. An arm of 19 → not settled |
| AC3 | Consistency: Q2's depth-0 arm and Q8's "next divergence" arm reproduce P51's P34-rules totals exactly (157 trades and the same ₹ net under both fills) |
| AC4 | P51 is unchanged by the additions: `ltpbt:test` 27/27, `ltplines:test` 65/65 |
| AC5 | tsc clean; `ltpstate:test`, `ltp:test`, `chainhist:test` pass |

## Out of scope
Changing any default, live rule or paper setting; indices other than NIFTY; the reversal formula.
