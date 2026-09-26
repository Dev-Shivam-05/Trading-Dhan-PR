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

## Result (2026-09-26, built on `p52-oq-by-data`)
`npm run ltpoq:test` **6/6** (AC2 the verdict rule; AC3 the additions are byte-identical to P51 when unused: 157 trades,
−₹61,375 / −₹85,917). AC4: `ltpbt:test` 27/27, `ltplines:test` 65/65. AC5: tsc clean, `ltpstate:test` 45/45, `ltp:test`
29/29, `chainhist:test` 50/50. AC1: `npm run ltpoq` prints a verdict for all eleven questions. The full tables are in
`.cache/ltp-oq-report.json`.

| # | Verdict | The numbers (₹ net per trade, touch / late1m) |
|---|---|---|
| Q1 OQ-33, 920 | **SETTLED: the OUTER lines** (EOR+1, EOS−1) | outer **+1,582 / +1,711** (50 trades, median stop 35 pts). inner −358 / −704 (111 trades, median stop 61 pts). This **agrees with V48/V51/V61** (outer = safe, smaller stop) and **contradicts V117** |
| Q1b OQ-33, AI | not settled: the fills disagree | Moderate +1,141 / +641 (28 trades); Risky +837 / +673 (135 trades) |
| Q2 OQ-9 depth | not settled: the fills disagree (ITM 1 vs ITM 4) | Every depth loses. Premium captured per index point: 0.45 (nearest), 0.61, 0.73, 0.87 (4 ITM). V107's "36 of 50" is 0.72 |
| Q3 OQ-2 basis | not settled: no OI-only level was ever traded | Both factors **+1,577 / +1,587** (53 trades); volume only **−1,394 / −1,635** (104). The one comparison possible agrees with V05: both > volume |
| Q4 stop size | **SETTLED: 50/30** (target/stop, index points) | 50/30 is the only positive cell (+67 / +165). V99's own best, 30/20, is −451 / −525 here. Widening the target, not the stop, is what helps on this data |
| Q5 gap filter | SETTLED on the rule's letter: ≤ 400 beats no filter | **Every arm loses** (≤ 400: −288 / −532). No gap threshold makes the 920 book profitable. The narrow-gap days V117 praises are the worst here (≤ 150: −1,686 / −2,289) |
| Q6 920 hour | **SETTLED: 10:00–10:59** | 10h −64 / −147; 09h −687 / −1,151; 11h −720 / −493. It agrees with V117 ("profits between 10 and 11") in ranking, but even 10h is not positive |
| Q6b AI hour | not settled: three hours have fewer than 20 trades | 10h and 12h lead under both fills |
| Q7 indices | not measurable | NIFTY only |
| Q8 OQ-15 target | **SETTLED: 50 points (V117)** | −1 / +20, about breakeven. Next divergence (P34) −391 / −547. Next line (V48) −705 / −831 |
| Q9 IV gate | not settled: the fills disagree | Gate on removes 81 of 138 AI trades |
| Q10 OQ-22 | not measurable on this reconstruction | Price was never past a 920 line at 09:21 (P50), so the forecast's condition never occurs |
| Q11 OQ-1 | recorded | Extension median 99 / 88 / 101 points in 2024 / 2025 / 2026 = **0.36–0.42% of the index, 2.7× V09's midpoint**. Gap width ≤ 100 on 18 of 677 days |

**What this changes: nothing live** (the spec's rule). On the board as recommendations for a forward test, not as settings:
- **Q1** is the most solid: the outer 920 lines beat the inner ones under both fills, and their stops are about half as wide.
- **Q4 and Q8** both favour a **fixed 50-point target** over the structural one.
- The pieces were settled one at a time. The combination (outer lines, 50/30) was **not** tested as a whole, and picking it
  now would be fitting the history. P53's paper book therefore runs **P34's rules**, the user's own. Its report
  labels the outer-line and 50-point variants as shadow numbers.
- All of it rests on lines that sit 2.7× further out than V09 says (Q11). The first ground-truth check against the tool
  (the 7-day premium) could move every row of this table.
