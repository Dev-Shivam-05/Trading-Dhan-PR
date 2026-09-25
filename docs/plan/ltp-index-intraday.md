# Plan — LTP Calculator intraday trading on the indices

**Written 2026-09-25 for the project owner.** Planning only; no code has been written for this plan.
Sources:
- `LTP-CALCULATOR/ANALYSIS/05-CONSOLIDATED-LOGIC.md` and `08-V2-DELTA.md`. These reconstruct all 163 transcript files; on 25 Sep it was checked that no source file is newer than the analysis.
- `docs/spec/ltp-calculator-v1.md`, which P29 built.
- The screenshot the owner sent.
- Three Dhan probes run today, described below.

---

## 1. Where the product stands, honestly

| Area | State |
|---|---|
| Stock paper trading (09:20 NSE scan → ORB → SMA exit) | Live, armed, paper only. P44 trained it on a year of data. |
| **Index intraday trading (NIFTY, BANKNIFTY, SENSEX, FINNIFTY, MIDCPNIFTY)** | **Does not exist.** Nothing trades an index. |
| LTP Calculator workspace (P29) | **Read-only**, for the NIFTY, BANKNIFTY and SENSEX chips. It draws the chain's levels (layers 0–3 and 6, listed below) and trades nothing. |
| FINNIFTY, MIDCPNIFTY | Not on the chip rail at all. |
| Layers 4–10: pressure, COA, SOC, Game of Percentage, 9:20 lines, AI LTP lines, vetoes, trade management | Not built. |

What P29 built, layer by layer:

| Layer | What it is |
|---|---|
| 0 | The raw chain |
| 1 | The imaginary line and the ATM by highest time value |
| 2 | Support and resistance found by the outward scan |
| 3 | The Strong / WTT / WTB grade at 75% |
| 6 | The reversal price, with the break-even candidate `K ± LTP` that the owner approved with `GO` |

**The owner's 1/10 for index intraday is a fair score.** The pieces that make the LTP Calculator a *trading* system
are layers 4–10, and none of them exist.

---

## 2. The screenshot, decoded

It is the source tool's **historical option chain**: CONCOR, expiry 25-08-2022, replayed at 11:50 on 03-08-2022, lot 800.
The header reads:
- **CALLS:** "OI is strong", "Volume is WTT – 76.00%".
- **PUTS:** "Volume is strong", "OI is WTB – 80.79%".

Checked against the numbers on screen, with P29's rules:

| | Call side (resistance) | Put side (support) |
|---|---|---|
| The pair (imaginary line) | 700 / 710 | 700 / 710 |
| Scan | from 700 upward | from 710 downward |
| Highest volume | 720 (1,036.25) | 700 (442.5) |
| Highest OI | 720 (678.75) | 700 (221.25) |
| Level | **720, on both factors** | **700, on both factors** |
| Volume challenger | 750 at 787.5 → 787.5 ÷ 1,036.25 = **76.00%**, above 720 → **WTT** | none ≥ 75% → **Strong** |
| OI challenger | none ≥ 75% → **Strong** | 650 at 178.75 → 178.75 ÷ 221.25 = **80.79%**, below 700 → **WTB** |

**Both percentages reproduce to two decimals.** So the tool computes `second ÷ highest × 100` and grades by position,
exactly as P29's engine does. This is independent confirmation of spec rows 15–20.

**Our reading of the same screen,** applying row 21's double-factor asymmetry (a resistance turns WTT only if both
factors do, and a support turns WTB only if both do): both levels stay **Strong**. That makes it COA scenario 1,
**neutral**: puts from EOR, calls from EOS, first touch only. This is our rule applied to their screen; the tool's own
banner is not visible in the image.

---

## 3. What the LTP Calculator is, in one page

One number per strike per side, the **reversal price**. Everything else either *selects* which strike's reversal to
show, or *classifies* the chain to decide which side may be traded.

| Button / rule | Question | What it needs |
|---|---|---|
| **W** (weekly / monthly range L1–L3) | Where can price go this week? | IV, OI per strike, the settle |
| **920 lines** (EOR+1, EOR, EOS, EOS−1, fixed at 9:21) | Where does it turn today? | The 9:20 chain |
| **AI LTP** (8 lines: Risky, Moderate, Max Pain = **stop**, Max Gain = **target**, on each side) | Where exactly to enter? | The live state |
| **COA 1.0** (9 scenarios: neutral, slight bull/bear, bull run, blood bath, both-sides-risky 8/9) | Which side may be traded? | **Pressure per side: needs intraday history** |
| **SOC** (a side that cannot settle for 1–2 h while the other is strong; the market moves TOWARDS the confused side) | The trap day | The history of levels over time |
| **Game of Percentage** (a second 9-way table from the direction of the two %s; the inversion after a shift completes) | Resolves scenarios 8/9; how long to hold | The % time series and a shift-completed flag |
| **COA 2.0** (call vs put OI-change lines at an intermediate strike) | Direction when stuck, never on the first touch | OI change per strike over time |
| **Vetoes** | First touch only; stop > target → no trade; no Max Pain → no trade; IV sides > ~1 pt apart → no trade; entries 9:20–11:30; flat by 14:30 | All of the above |

**The one measured result in the whole corpus (V117)** is the 9:20 strategy, 1 Jan – 7 Apr, with a 50-point stop and
target:

| Index | Result |
|---|---|
| NIFTY | **+127** points |
| MIDCPNIFTY | **+243** points |
| BANKNIFTY | **heavy loss** |
| FINNIFTY | **loss** |
| All together | **−466** points |

The same backtest found that a gap between the extension lines of more than 100 points lost every time on NIFTY.
**So the corpus itself says: not every index, and not every day.**

---

## 4. What the three probes today changed

**The biggest blocker for index work was history.** Pressure, SOC and the Game of Percentage all need the chain's
intraday history, and nothing can be backtested without it. Dhan does not sell historical option-chain snapshots.

Measured today, 25 Sep 2026, one call each:

| Probe | Result |
|---|---|
| `POST /v2/charts/rollingoption` (Dhan's Expired Options Data), NIFTY `OPTIDX`, weekly, `ATM`, CALL, 3–5 Aug 2026 | **OK: 1,155 one-minute candles**, each carrying **strike, spot, OHLC, volume, OI and IV** |
| The same endpoint, `ATM+10` PUT | **OK.** The strike column reads 25,050 against a spot of 24,553.8, i.e. 10 strikes out |
| The same endpoint, a **31-day** span (Oct 2025) | **OK: 7,605 candles, 21 sessions** in one call |
| The same endpoint, **Jan 2024** | **OK.** History reaches back at least to Jan 2024 |
| The cash / index 1-minute history (P44 today) | Back to at least **Oct 2020**; daily candles from **2002** |

**Consequence:** a minute-by-minute option chain of ±10 strikes around the ATM can be **rebuilt** for any past day.
That costs 21 strikes × 2 sides × one call per month, about **500 calls per index per year** (about 10 minutes at the
1.1 s gate P44 used without a single failure). That turns layers 4–10 from "build and hope" into "build, then
**measure on two years of real days**".

Three things about the endpoint are still unverified:
- which expiry `expiryCode: 1` selects;
- how many offsets beyond ±10 it accepts;
- whether the per-minute volume summed from 09:15 equals the live chain's day volume.

Phase P48's acceptance criteria settle each one.

---

## 5. The plan

The order follows one principle, which this project learned twice (P37, P44): **measure before trading, and quote
every result under realistic fills.** Each phase gets its own `spec-lock` table before any code.

| # | Phase | What it delivers | Done when |
|---|---|---|---|
| **P47** | **Index universe and a live chain recorder** | FINNIFTY and MIDCPNIFTY on the chip rail. From 09:14 to 15:31, every 3 s chain snapshot (LTP, volume, OI, IV) of the 5 indices, current and next expiry, is written to disk and gzipped after the close, like the tick recorder. Every poller shares the documented 1 req / 3 s per (underlying, expiry) gate | One full day recorded for all 5 indices with no gap over 10 s inside 09:15–15:30. The count per index is printed |
| **P48** | **Historical chain rebuild** | `rollingoption` → minute chains of ±10 strikes × 2 sides for NIFTY and SENSEX from Jan 2024, and for BANKNIFTY, FINNIFTY and MIDCPNIFTY (monthly), in `.cache/history/chains/` | Wherever a P47 recording exists, the rebuilt chain matches it on strike, OI and LTP, and the summed volume is within a stated tolerance. `expiryCode` and the offset limit are measured |
| **P49** | **The state machine: layers 4, 5, 8 and 9** | Pressure per side from the level's history (the 5 states); COA 1.0's 9 scenarios; SOC with its 1 h / 2 h clock and 1R/2R/3R; the Game of Percentage with the **shift-completed flag** (the inversion rule); the IV gate. Pure functions over a chain time series, clock injected | Every scenario and every SOC branch is shown on a rebuilt historical day **and** rejecting on another. V25's trap (a 9:30 latecomer reading "scenario 1" when it is "scenario 5") is reproduced |
| **P50** | **The line sets: layers 7 and 10** | 920 lines (fixed at 9:21), AI LTP's 8 lines with the scenario → line-set table, the stop read off the opposite side, first-touch bookkeeping, and the vetoes (ratio gate, missing line, Max Pain on entry, 11:30 entry cut-off, 14:30 flat) | For three rebuilt days, every line recomputed by a second implementation equals the engine's |
| **P51** | **The index option backtest** | The 920 strategy first (it is the only one fully specified), then AI LTP. Entries use the index's 1-minute path; **the option leg is priced from that strike's own 1-minute candle** (from P48); fills at the level and one minute late; costs included; walk-forward | The corpus's own V117 result reproduces in shape on Jan–Apr (NIFTY positive, BANKNIFTY and FINNIFTY negative), or the difference is explained. The full two-year result is printed per index, per line, per time of day |
| **P52** | **Settle the open questions by data, not by guessing** | Grids over what the corpus contradicts itself on: which line is "safe" (OQ-33), strike depth (OQ-9: ATM vs 2nd ITM vs deep ITM), volume vs OI priority (OQ-2), stop size (V99's 10/20/30), the 920 gap filter, time-of-day windows, and indices to include | A recommendation per question, backed by held-out results under both fill models, **or an explicit "the data cannot tell"** |
| **P53** | **Index paper trader** | A second paper book beside the stock one: tick-driven entries on the index's own feed (first touch of a level); a **limit order at the premium pre-computed for that level** (V17/V107); the stop and target from the line set; exits on a state change (V60/V64); phone pushes. Only the settings P51/P52 proved | Two weeks of live paper, each trade recomputed from the recording, and the paper P&L compared with P51's model on the same days |
| **P54** | **The weekly / monthly range (W)** | L1/L2/L3 as 1σ/2σ/3σ bands from IV (a **GUESS**; the corpus gives hit rates, not a formula), checked against V118's straddle projection | The hit rates on two years of history are printed next to the claimed 65 / 95 / 99% |
| (P35) | Real money | Unchanged: only after paper results, by name, with a loss cap and a kill switch | — |

P34 ("LTP Calculator trades on NIFTY options", boarded 2026-09-23) is folded into P50 + P53. Its accepted rules (a CE at
the first touch of EOS, a PE at the first touch of EOR, the stop at extension ±2, the target at the next divergence)
become one strategy inside P51's grid, not a separate build.

---

## 6. Which indices, and why

| Index | Expiry | Plan |
|---|---|---|
| **NIFTY** | weekly (Tuesday) | **First.** Positive in V117; the most liquid chain |
| **SENSEX** | weekly (BSE) | Second. Same weekly structure |
| **MIDCPNIFTY** | monthly | Include. V117's best result (+243), but a thinner chain |
| **BANKNIFTY** | monthly | Backtest only until the data says otherwise. V117: heavy loss |
| **FINNIFTY** | monthly | Backtest only. V117 lost, and V14 trusts its values only on expiry day |

Expiry facts per the corpus (V98). Before P47 hard-codes any expiry, it is checked against Dhan's expiry list.

---

## 7. How a trade will work once P53 is done (the target behaviour)

1. **09:15–09:21:** record the chain. The AI state is not trusted before ~09:21. The lines on screen at the open are yesterday's.
2. **09:21:** the 920 lines are fixed. Apply the gap filter. A missing line means that side is off for the day.
3. **Every 3 s:** a new chain snapshot updates pressure per side, the scenario and SOC. The scenario decides which lines exist.
4. **Every tick of the index:**
   - If price touches an allowed line for the **first time** and every veto passes, send a limit buy at the pre-computed premium.
   - The stop is Max Pain; the target is Max Gain, or the next line.
5. **In the trade:**
   - The % moves against the trade → exit.
   - Max Pain moves away or vanishes → exit.
   - The scenario turns against the trade → exit.
   - Averaging only under V116's conditions.
6. **11:30:** no new entries. **14:30:** flat.

Tick-level: entries and stops react to every feed tick. The chain itself (OI, volume, IV) is 3 s data, because that is
Dhan's limit. The source tool's live mode runs on the same ~3 s / 1-minute snapshot (V10, V22).

---

## 8. The owner's answers (2026-09-25)

1. **₹20,000 per trade**, with lots from the option's price and a minimum of 1 lot: lots = max(1, floor(20,000 / (premium × lot size))). A trade whose single lot costs more than ₹20,000 is flagged `over budget`. With 1 lot, V30 rules averaging out.
2. **NIFTY only.** The other indices in §6 leave the build. P48 rebuilds NIFTY alone.
3. **P47 started, and it is built**: `docs/spec/chain-recorder-v1.md`, live from Mon 28 Sep.
4. **The LTP Calculator's 7-day premium:** buy it once P48 and P49 exist, as ground truth for the reversal price and the scenario labels (DECISIONS.md, 2026-09-25). Researching their documentation is P55.

## 9. Risks, said plainly

- **The reversal price is a candidate** (writer's break-even, approved with `GO`). If the paid tool uses a different
  formula, every line moves. P51's backtest is the check: if the lines do not reverse price better than chance on two
  years, the formula is wrong. That is a measurable failure, not a silent one.
- **The rebuilt chain is ±10 strikes around a moving ATM.** On a day that moves more than 10 strikes, far strikes have
  gaps early in the day. This affects support and resistance only on trend days, and P48 measures how often.
- **"Pressure" and "SOC" are the corpus's most subjective rules.** P49 implements them literally; P51 says whether
  they add anything.
- **Dhan's limits:**
  - Option chain: 1 request / 3 s per (underlying, expiry).
  - Quote: 1 request / s. Two quote calls in the same second get `805`, with a block warning.
  - The chart endpoints ran 1,890 calls today at 1.1 s with 0 failures.
  - History jobs run after 16:00, never beside the live pollers.
