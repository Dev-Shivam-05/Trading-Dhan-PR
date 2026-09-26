# P54 — NIFTY weekly range (W): the L1–L3 bands and their hit rates on history

**Locked 2026-09-26 by delegation** (the user: "go for it and complete all the pending phases … without stopping").
Rows marked **GUESS** state a value no source gives. Source: `LTP-CALCULATOR/ANALYSIS/05-CONSOLIDATED-LOGIC.md` §16 and
`08-V2-DELTA.md` (OQ-25). **The tool's own formula is not in the corpus.** §16.4 lists only its inputs: OI, vega, IV, the
Greeks, standard-deviation rules, and the spot–futures gap. So this phase builds the two readings the corpus
supports and **measures** them against the hit rates the corpus claims (OQ-16: "stated as mathematical fact; never
demonstrated"). History only: no UI.

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | Which instrument | NIFTY weekly only. Monthly ranges (Bank Nifty, Fin Nifty, stocks) are out of scope | §16.2; only NIFTY chains are rebuilt (P48) |
| 2 | The week | All sessions sharing one W1 expiry (P48's calendar, holiday- and Muhurat-aware). The first group in the data (it starts mid-week) is dropped | V88: "the week runs from the Wednesday after expiry"; OQ-25 resolved as "after the settle on expiry day" |
| 3 | When it is computed | At the close of the **09:15 minute on the week's first session**, from the new W1 chain. **Deviation, declared:** the tool computes after the 16:00 settle on expiry day (V88). On that evening our only chain is the expiring contract (W2 exists only from Sep 2026). The overnight gap therefore sits **inside** our band's starting point, not outside it | P48 data limit |
| 4 | Method **σ** (the SD reading) | centre = the index at row 3's minute. σ = centre × IV/100 × √(T/365), with IV = the mean of the CE and PE IV at the strike nearest the centre, and T = calendar days from row 3's minute to the expiry at 15:30. **L1 = ±1σ, L2 = ±2σ, L3 = ±3σ** (RL above, SL below). **GUESS** (the multiples) | §16.1: the hit rates are "essentially 1σ / 2σ / 3σ" (65 / 95 / 99); §16.4 names IV and standard-deviation rules |
| 5 | Method **straddle** (V118) | The ATM straddle (CE + PE LTP at the strike nearest the centre) × **0.90** (V118's before-noon discount) = the L1 distance. L2 and L3 are **2× and 3×** it. **GUESS** (the multiples) | §16.7 is "the better-specified alternative"; V118 gives L1 only |
| 6 | Hit rate: path | The share of weeks whose index path (every minute's high and low, row 3's minute through the expiry day's 15:29) **never leaves** ±Lk | §16.1's "L3 rarely even reached" reads as a statement about the path |
| 7 | Hit rate: close | The share of weeks whose **expiry-day 15:29 close** sits inside ±Lk | V131: "expect the close to come back INTO the weekly range" |
| 8 | Scoring the claims | Per method and band, path and close: **within ±5 points** of the claim (L1 65, L2 95, L3 99) = `matches`, above it = `wider than claimed`, below it = `narrower than claimed`. **GUESS** (the ±5 tolerance) | OQ-16 asks exactly this |
| 9 | Also reported | The median week size (RL1 − SL1, V36) and, per band, the share of weeks where each side was touched | V36, V131 |
| 10 | Code | `src/server/ltp-range.ts` (pure: `weeksOf()`, `rangeAt()`, `scoreWeek()`), `npm run ltprange`, `npm run ltprange:test`. No Dhan call, no clock |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | σ and straddle bands to the paisa on a hand-built chain (IV, T and straddle worked by hand) |
| AC2 | Grouping: every stored session is in exactly one week; the partial first week is dropped; a holiday-moved expiry (the Diwali 2025 Monday) closes its week on the right day |
| AC3 | Path/close scoring on hand-built paths: a high that pierces RL1 by 0.05 is a breach and a touch that stops exactly on it is not; the close is scored separately from the path |
| AC4 | A second implementation of the hit rates (re-reading the index file directly, not through the engine's week objects) agrees with the engine on every band, both methods, both measures |
| AC5 | The report prints both methods × three bands × two measures, each scored against its claim, and the median week size |
| AC6 | `ltp-range.ts` imports nothing from `dhan.ts` and never calls `Date.now()`. tsc clean, `ltplines:test` and `chainhist:test` still pass |

## Out of scope
Monthly ranges; the ±375 projection (V50, OQ-17: its scaling is never given); range-writing strategies (§17.4); UI.
