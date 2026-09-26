# P55 — What the LTP Calculator's own public material says (research, 2026-09-26)

**Scope, as the user set it (2026-09-25):** find and read whatever official documentation exists, and map it onto
`LTP-CALCULATOR/ANALYSIS/07-OPEN-QUESTIONS.md` (with `08-V2-DELTA.md` overriding parts of it).

**Method:** public pages and the web app's publicly served files only. There was no login, no credentials and no paid
access. The research was done by a delegated read-only agent and is reported here with its sources. The asset URLs carry
build hashes and will break when the vendor rebuilds, so the quotes below are the record.

## What exists
| Source | What it is |
|---|---|
| `https://nseoptionchain.ltpcalculator.com/assets/index-D7P44OCr.js` | The web app's bundle: the help text ("How to Use" for Weekly Range, "Important Instructions" for LTP Blast), and the image names below |
| `…/assets/flow_chart_ltp_swing-BOG4UZXp.jpeg` | The **LTP Swing flowchart** (the "LTP Flow Chart" button) |
| `…/assets/920Help-C7ba_vWG.jpg` | "Full Vertical Flowchart of **9:20 Strategy**" |
| `…/assets/AILtp-C56DO9o2.png`, `…/assets/ImpAILtp-B7LXMOQ6.png` | The AI LTP line diagram and "Imp notes about AI LTP" |
| `…/assets/coa-Bn3wvkhZ.png` | The Chart of Accuracy 9-scenario table |
| `web.archive.org/web/20250829175509/https://www.ltpcalculator.com/blogs/ltp-swing-strategy-complete-guide` | The LTP Swing "Read More" guide. It is gone from the live site and survives only in the archive |
| `web.archive.org/web/20260201151302/https://www.ltpcalculator.com/blogs/nifty-9-20-strategy-today-live-analysis` | An official 9:20 blog post (archived) |
| ltpcalculator.com (now) | A SEBI Research Analyst marketing site. Its FAQ covers only regulatory and refund questions; there is no pricing page and no method |
| Play Store / App Store / investingdaddy.com | Marketing copy and version notes only |
| howtouseltpcalculator.in | **Not official** (it claims no affiliation). It offers a weekly-range method. It is **not used** to settle anything |

## The finding that matters most
**The formulas are not in the client.** The app receives each strike's reversal prices from its server as fields
`calReversal` / `putReversal`. They can be the strings `"Break Down"` or `"NA"`, which confirms the corpus's sentinel values
(§9.1). The weekly-range levels arrive as `S_L_1..3`, `R_L_1..3`, `close_price`, `close_pv`. Nothing public explains how
either is computed.

- **OQ-1 stays the blocker**, and the only route left is the one already chosen: capture the tool's own numbers (the
  7-day premium) and fit against them. P50's measurement says what to look for. Our `K ± LTP` extensions sit about 2.7× further
  out than V09's figure (P52 Q11).
- **A second undocumented formula has appeared.** The official 9:20 flowchart sets the target and the stop from "Set D"
  lines (`Target = D1 Call, SL = D1 Put`), and nothing public defines D1.

## Open questions, mapped
| OQ | Status | Official evidence | What it means for our build |
|---|---|---|---|
| **OQ-1** reversal formula | not covered | Marketing only ("algorithmically calculated Reversal Prices"); the values come from the server | Unchanged. P29 row 12 stays as approved |
| **OQ-16 / 17** weekly range | not covered | "Green values indicate Support levels. Red values indicate Resistance levels." No σ, no 65/95/99, no 375 | P54's σ bands remain a reconstruction. They reproduce the claimed hit rates, but they are not shown to be the tool's |
| **OQ-22** missing line | **answered: a veto** | 9:20 flowchart: "Missing → No Trade on that side AND No Writing Strategy at all" | Matches P50 row 8. The forecast reading is not official |
| **OQ-14** both sides bearish | **answered: scenario 6** | COA image: column 6 has both arrows ↑ and trade "PE"; column 9 has no trade | Matches P49 row 13 |
| **OQ-33** safe vs risky | narrowed | "Risky Buyer: Buy CE at EOS" · "Moderate Buyer: Wait EOS-1 Buy CE at EOS-1" · "Safe Entry: At EOR+1 … (double lot averaging rule applies)" | **The official mapping makes the outer lines the safer entries, and P52 Q1 found exactly that on our data** (outer +₹1.6k/trade, inner −₹0.4k, half the stop). The labels describe entry risk; no hit rates are claimed, so V117's per-line win rates are not the official framing |
| **OQ-15** 9:20 target | narrowed: **"Set D" D1** | "Click Set D for Target → D1/D2/D3 Call"; "Target = D1 Call, SL = D1 Put"; blog: "Target = D1 Put / EOS" | P50/P51 use P34's answer (the next divergence, stop at EOR+2 / EOS−2), which is **not** the official rule. D1 is undefined, so it cannot be built. Recorded as a deviation |
| **OQ-19** the ±10-point stop | narrowed | The official stop is the opposite D1 line; no ±10 rule appears anywhere | P50 row 6 already dropped the ±10 |
| **OQ-5** averaging (9:20) | narrowed | "If Market DOWN → EOS-1 Double Lot Avg at EOS-1 … Target = D1 Call, SL = D1 Put" | P51 does not average (V117's backtest did not either) |
| **OQ-18** timing | **answered** | "Click 9:20 Button (at or after 9:21 AM)" | Matches P50 row 4 |
| **OQ-21** 6 or 8 lines | narrowed | The notes define 8 (S/R × Risky, Moderate, Max Pain, Max Gain), the header says "6 Magical SPOT Lines", and values can read "Break Out" / "NA" | Matches P50 rows 12-15 |
| **OQ-35** arrows | narrowed (COA screen) | On the COA image ↑ always goes with a put trade | Consistent with P29 row 5's resolution |
| **OQ-30** Swing stop | **answered** | "SL = If PUT 100% OI BECOMES WTB" / "… CALL 100% OI BECOMES WTT" | LTP Swing is not built; recorded for when it is |
| **OQ-39** star rating | **answered** | "CHECK STAR RATING : 0 or MAX 1" | Same |
| **OQ-27** hedge size | **answered** | "Buy PE ( 5- 7% of Diff)" | Same: 5–7% is the published rule, not a transcription error |
| **OQ-31** breakout vs breakdown | **reopened** | The flowchart says "Breakdown or = CMP"; the archived blog says "Breakout or equal to CMP" | `08-V2-DELTA.md`'s "resolved: breakout" is downgraded to open |
| OQ-2, 3, 20, 26, 37 and the rest | not covered | — | — |

Other official facts: LTP Swing takes new trades only before the 15th and exits 2 days before expiry (this conflicts with V2's
"first ten days"). Bullish trades are cash and futures, bearish trades futures only. For the 9:20 writing strategy: "Write CE
Strike > EOR+1 / PE < EOS-1", the stop is the combined premium, and everything exits at 14:30. For LTP Blast: "target = PV,
SL = PV+1", and "If C1 entry is already done after 9:20 AM, P1 will not be traded that day".
