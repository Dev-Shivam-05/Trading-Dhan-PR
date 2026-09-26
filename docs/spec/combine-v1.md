# P43 — Combining the calculators: does NIFTY's LTP scenario help the 09:20 stock trades?

**Locked 2026-09-26 by delegation.** The board row waited on the user's definition of "combine". The user's instruction
of 2026-09-26 ("complete all the pending phases … without stopping") is taken as leave to **define one candidate
combination and measure it**, as a recommendation only. Nothing live changes (P37 row 13; memory: delegated
decisions). If the user meant another combination, this is the evidence base for it, not a substitute.

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | The candidate | A **market filter**: take a 09:20 ORB stock trade only when it goes **with** the NIFTY LTP scenario at entry. The LTP Calculator sets direction, and the ORB scan picks the stock and the moment | The most direct reading of "combine": the index framework's direction gating the stock framework's entries |
| 2 | The market's direction | P49's verdict (`runDay` on the rebuilt NIFTY chain). **Bullish**: scenarios 3, 5, 7 or a bullish SOC. **Bearish**: 2, 4, 6 or a bearish SOC. **Mixed**: 8, 9. **Neutral**: 1. No reading → **none** | P50 row 16's grouping of the same table |
| 3 | With / against | BUY in bullish, or SELL in bearish = **with**. The reverse = **against**. Mixed, neutral and none = **other** | Row 1 |
| 4 | Which moment | The verdict of the minute **before** the entry minute | No look-ahead (P50 row 18) |
| 5 | Which trades | P44's own trades, recomputed with `runGrid`, for the baseline and the pick (`…/SL/noT/nofrz`), under **both** fills, over P44's 244 sessions (1 Oct 2025 – 25 Sep 2026) | The same engine and data that produced P44's numbers |
| 6 | The verdict | P52's rule: settled only if both fills agree and each arm has ≥ 20 trades, and "better" means ₹ net per trade. It compares **with** against **against** | One rule for every "is it better" on this project |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | Rows 2–3 are unit-tested on all 9 scenarios, both SOC verdicts and "no reading" |
| AC2 | Accounting: with + against + other = every trade = the sum of the market counts, for both settings and both fills |
| AC3 | The report prints every arm, the filtered and unfiltered totals, and the verdict, for both settings under both fills |

## Result (2026-09-26)
`npm run combine:test` **19/19** (AC1, and AC2 on all four runs). `npm run combine` (AC3, 244 sessions, NIFTY verdicts
for all 244):

| Setting, fill | With the scenario | Against it | Other (mixed/neutral) | Filter "with only" vs unfiltered |
|---|---|---|---|---|
| Pick, level | 857 trades, **+₹434/trade** | 546, **+₹1,014/trade** | 687, +₹555 | **+₹7.54 L vs +₹13.07 L** |
| Pick, late1m | 857, +₹212 | 546, **+₹664** | 687, +₹352 | +₹4.24 L vs +₹7.86 L |
| Baseline, level | 500, +₹300 | 288, +₹324 | 463, +₹606 | +₹4.31 L vs +₹5.24 L |
| Baseline, late1m | 500, −₹3 | 288, +₹8 | 463, +₹350 | +₹1.61 L vs +₹1.63 L |

**Verdict: settled, and the opposite of the candidate.** For both settings, under both fills, the stock trades taken
**against** NIFTY's LTP scenario earn more per trade than the ones taken with it. The market filter would **cut the
pick's result almost in half**. **Recommendation: do not combine the calculators this way.** Nothing changes.

**Read these before drawing more from it:**
- This is not evidence for a contrarian rule either. The difference was not tested for significance, and "against" is
  simply the arm that did better on this year.
- NIFTY's verdicts come from P49, which has no ground truth yet (its rows 8, 15 and 19 are the likeliest to be wrong). A
  different reading of the scenario could change this.
- The trades that fall under a mixed scenario (8/9) are the baseline's best arm. The two-sided market is where the
  stock breakouts pay most, and that is worth a look if a combination is ever specified.
