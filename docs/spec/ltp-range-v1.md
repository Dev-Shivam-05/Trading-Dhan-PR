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
| 3 | When it is computed | At the close of the **09:15 minute on the week's first regular session** (amended at build: two weeks open on a Muhurat evening, 1 Nov 2024 and 21 Oct 2025, which has no 09:15; the next session is used), from the new W1 chain. **Deviation, declared:** the tool computes after the 16:00 settle on expiry day (V88). On that evening our only chain is the expiring contract (W2 exists only from Sep 2026). The overnight gap therefore sits **inside** our band's starting point, not outside it | P48 data limit |
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

## Result (2026-09-26, built on `p54-weekly-range`)
`npm run ltprange:test` **16/16**:
- AC1: both bands to the paisa by hand.
- AC2: 680 of 680 sessions sit in exactly one week, the partial first week is dropped, and Diwali 2025's week closes on
  Monday 20 Oct.
- AC3: the scoring boundaries hold.
- AC4: a raw-array second implementation agrees on 6 of 6 cells.
- AC6: no `dhan.ts` and no clock. tsc clean, `chainhist:test` 50/50.

`npm run ltprange`: 142 complete weeks (2024-01-05 → 2026-09-22):
| Band (claim) | σ method, path inside | σ, expiry close inside | straddle method, path | straddle, close |
|---|---|---|---|---|
| L1 (~65%) | 46.5%, narrower | **69.7%, matches** | 25.4%, narrower | 57.0%, narrower |
| L2 (~95%) | **90.1%, matches** | **97.2%, matches** | 74.6%, narrower | 85.2%, narrower |
| L3 (>99%) | **99.3%, matches** | **100%, matches** | 93.7%, narrower | 97.9%, matches |

Median week size (RL1 − SL1): σ 790 points (3.4% of the index); straddle 573 (2.4%).

**What it says about OQ-16:**
- The corpus's hit rates are **what ±1/2/3σ bands from the ATM IV give**, when "hit rate" means **where the expiry close
  lands**. That is V131's use ("expect the close back inside the range").
- Read as "the week's path never leaves the band", L1 holds only 46% of weeks.
- V118's straddle projection, with 2× and 3× for L2/L3 (our GUESS), is too narrow for the claims. Its L1 is **not** the tool's L1.
- This does **not** prove the tool uses σ bands. It shows that σ bands reproduce the published numbers, which the straddle
  reading does not.
