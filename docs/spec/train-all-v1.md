# P44 — Train the entry and exit rules on every F&O stock, 1 Jul – today

**Locked 2026-09-25 by delegation.** The user asked for the system to be trained on this week, last week and
all of August, and then said: *"assume all the answers which will be the best … do not ask anything, I am not
available for the next four to five hours."* Every value below that is not measured is therefore a **GUESS made
by Claude**, marked as such, and open to a one-word veto afterwards. **Nothing here changes the live rules**
(P37 row 13 still holds): the output is a recommendation.

## What was measured before writing this
- **NSE's OI Spurts figure cannot be rebuilt from Dhan (measured again today).** Its `prevOI` (yesterday's close,
  so it is static all day) against Dhan's own previous-day OI, in lots, 25 Sep:

  | | NSE prevOI | Dhan futures (3 expiries) | Dhan options (all expiries) | futures + options |
  |---|---|---|---|---|
  | POLICYBZR | 132,387 | 45,260 | 92,706 | 137,966 |
  | FORTIS | 21,021 | 21,936 | 5,182 | 27,118 |
  | MFSL | 35,585 | 25,256 | 17,198 | 42,454 |

  No column matches, so no past day can reproduce the 09:20 scan's OI filter. (The RELIANCE row got `805` on
  the option-chain calls, because they collided with the live server's own chain polls, and the probe stopped there.)
  The **price** half of the scan does rebuild (P37: within 0.1–0.7 pp).
- **Dhan's cash 1-minute candles reach back to 1 Jul in one call.** For 360ONE and RELIANCE that is 62 sessions
  (1 Jul – 25 Sep). Since August, **each day's cash series stops at 15:14**, whatever the request span: 360 candles
  a day against July's 375. Row 8 prices the 15:15 square-off from the 15:14 candle's close for this reason.
- The August futures contract expired on 25 Aug and is gone from the master. Its data would need P39's
  expired-contract API.

## Rows

| # | Row | Value |
|---|---|---|
| 1 | Question | Which settings of the opening-range breakout and SMA exit made money, out of sample, on the F&O stocks the 09:20 scan would pick **by price**? The OI filter is out, because nothing can rebuild it (above). |
| 2 | Data | For each of the 210 stocks in P37's `contracts.json`: the **share's** 1-minute candles from 1 Jul (`/v2/charts/intraday`, `NSE_EQ`), and its official daily closes from 20 Jun (`/v2/charts/historical`). One gate key, `history`, at 1100 ms. Stored in `.cache/history/eq1/` and `eqd/`, fetched once, incremental, **refused in replay mode**. |
| 3 | Why the share and not the future | The August future is gone, and a future tracks its share point for point apart from a basis that drifts by paise within a day. P&L is priced in **the current futures lot**. AC3 measures this substitution on the days both series exist. **GUESS** that the basis drift is negligible; AC3 says how far off it is. |
| 4 | Sessions | Every date on which at least 100 of the 210 stocks have candles: 1 Jul – the latest completed session. Only a complete session is used (after 16:00 IST, the same rule as P37). |
| 5 | Selection (each day) | The price at 09:20:00, which is the 09:19 candle's close, is compared with the previous session's official close: chg % to 2 dp, the same formula as NSE. Stocks with \|chg\| ≥ **minChg** are ranked by \|chg\| (a tie goes to the symbol), and the top **10** are taken. 10 is the live cap (`MAX_POSITIONS`). |
| 6 | Direction | **gap**: a gainer may only break up (long) and a loser only down (short). This is the live scan's rule. **either**: the first break of either side decides. If both sides break inside the same minute, the stock is skipped and counted. |
| 7 | Entry | The live rules (P33 / P37 rows 6–7): the range is the first `rangeBars` five-minute bars (built from the 1-minute candles); the first 1-minute candle from the range-ready minute until **15:00** that trades strictly beyond the level; fill at its open if it opened beyond, else at the level ± 0.05. |
| 8 | Exit | The first of: (a) **stop**, at the other side of the range (P42 row 8); (b) **target**, at 2 × the entry-to-stop risk (P42 row 9); (c) **N completed 5-minute closes against the SMA**, where the SMA includes earlier sessions' bars as live does and the exit is due at the bar's end; (d) **15:15**. Stop and target are checked on 1-minute candles from the candle **after** the entry candle, because the order inside the entry minute is unknown. They fill at the level, or at the open if the candle gapped past it. If both are touched in one candle, the stop wins (**GUESS**, conservative). The SMA and 15:15 exits fill at the price at that instant: the open of the candle starting then, or failing that, the close of the candle ending then (row 2's 15:14 fact). |
| 9 | Costs | Net P&L per trade (one futures round trip, one lot). **GUESS**, typical discount-broker rates for NSE futures: brokerage ₹20 per order (₹40); STT 0.02% of the sell value; exchange charge 0.00173% of turnover; SEBI fee 0.0001% of turnover; stamp duty 0.002% of the buy value; GST 18% on brokerage + exchange + SEBI. Training optimises **net**, and gross is printed alongside. |
| 10 | Option leg | **Not modelled.** It needs about 10 calls per stock per day, and August's options have expired (P39). Everything here is the future leg. |
| 11 | Grid | minChg {0, 1, 2}% × direction {gap, either} × rangeBars {1, 2, 3} × SMA {5, 9, 13, 20} × closes {1, 2, 3} × stop {off, on} × target {off, 2R} × frozen-range skip {off, < 0.3%}. That is **1,728** settings. |
| 12 | The live rules, as a baseline | minChg 2, gap, 2 bars, SMA9, 2 closes, no stop, no target, no frozen skip. This is today's live strategy **without** its OI filter, so it trades more often than live does. |
| 13 | Walk-forward | Train on sessions 1…k and test on session k+1, for every k from **10** (the first 10 sessions only train). The choice is the setting with the best net P&L over the training sessions among those with **≥ 20 trades** in training (**GUESS**: fewer is luck). A tie goes to the live baseline, then to the smaller key. The held-out sum is printed next to the baseline's on the same days. **This held-out sum is the honest number**; the best in-sample number is printed too, labelled as biased. |
| 14 | Stability | For the full-window best and for the baseline: net P&L on the first half and the second half of the sessions, per month, and per weekday. The report also counts how often the walk-forward's choice changed. |
| 15 | What each setting is worth | For every grid dimension, the mean net P&L per trade and per session at each value, averaged over all the other dimensions. This shows which knobs matter. |
| 16 | Output | `npm run train` prints the report and writes `.cache/history/train-report.json`. A panel on the Paper tab is P38's job. |
| 17 | Applying it | **Never automatic.** A recommendation is printed only if the walk-forward's held-out net beats the baseline's on the same days **and** the chosen setting is positive in both halves. Otherwise the report says so and recommends nothing. |

### Amendments made while building (also by delegation)
| # | Row | Value |
|---|---|---|
| 18 | Late fills (stress test) | The whole grid is run a second time with every fill **one minute late**: entry at the break candle's close, stop and target at their candle's close, and the SMA / 15:15 exit at the close of the candle starting at that instant (falling back to row 8's price). **Why:** row 7's level fill is what priced POLICYBZR on 24 Sep at 1700.45 when the live fill was 1606, and a zero-width range such as KPITTECH's on 1 Jul (604.4 / 604.4, then 570.8 one minute after the break) is the same trap. |
| 19 | Is it luck? | For the baseline, the in-sample best and the setting chosen most often: the daily t-statistic (mean ÷ sd × √n), the net without the best day and without the best 3 days, and the net without the best stock. |
| 20 | One clean split | Choose on the first half of the sessions only, then score on the second half, under both fill models, next to the baseline on the same halves. |
| 21 | Recommendation | Row 17 also needs the **late-fill** walk-forward to beat the baseline. |
| 22 | Window moved to **1 Oct 2025** | Measured after the first run: Dhan returns the share's 1-minute candles for Jan–Mar and Apr–Jun 2026 as well (RELIANCE, 60 sessions each). The 90-day limit is per **request**, not a horizon; P37's "58 sessions" was the futures **contract's** life. So `train-data.ts` fetches in 89-day chunks from 1 Oct 2025: 1,050 calls, 0 failed, 27 min, 716 MB. That is **243 sessions** (the Sunday 1 Feb 2026 Budget session included). |
| 23 | Rolling walk-forward | Next to row 13's expanding window, the same walk-forward trained on only the last 60 sessions, in case the market's behaviour moved within the year. |

## Final: 244 sessions (1 Oct 2025 – 25 Sep 2026), run after 16:00 on 2026-09-25

Adding 25 Sep changes no conclusion. `npm run train`: 420 calls, 0 failed.

| | Level fills (row 7) | Late fills (row 18) |
|---|---|---|
| **Baseline** (live rules minus OI): trades · net · daily t | 1,251 · **+5,24,087** · 1.43 | 1,251 · **+1,63,037** · **0.47** |
| Walk-forward, expanding (234 held-out): tuned vs baseline | **+9,32,728** vs +5,75,374 | **+4,82,426** vs +2,11,290 |
| Walk-forward, rolling 60: tuned vs baseline | **+7,33,763** vs +5,75,374 | **+4,10,229** vs +2,11,290 |
| Choose on Oct–Mar, score on Apr–Sep: chosen vs baseline | +5,16,939 vs +3,94,096 | +2,78,014 vs +2,57,105 |
| **Recommended**: `chg0/either/r3/sma20/x3/SL/noT/nofrz`: trades · net · daily t | 2,090 · **+13,07,269** · **2.79** | 2,090 · **+7,86,188** · **1.70** |
| its twin with the 2R target on (`…/SL/T2R/…`) | +12,92,792 · t 2.92 | **+8,02,415** · t 1.79 |

Row 17's last choice moved from the `T2R` twin to the `noT` twin. The target fires on about 2% of trades, so the two are
the same strategy for any practical purpose. Month by month the recommended setting is positive in 10 of 12 months
(March 2026 −32,967, August 2026 −5,182). AC5 was re-run on the new pick: 3/3 PASS.

## Result on 243 sessions (1 Oct 2025 – 24 Sep 2026), 2026-09-25

| | Level fills (row 7) | Late fills (row 18) |
|---|---|---|
| **Baseline** (live rules minus OI): trades · net · daily t | 1,250 · **+5,10,117** · 1.39 | 1,250 · **+1,47,762** · **0.42** |
| Walk-forward, expanding (233 held-out sessions): tuned vs baseline | **+9,67,226** vs +5,61,404 | **+5,24,816** vs +1,96,015 |
| Walk-forward, rolling 60 (amendment 23): tuned vs baseline | **+7,32,494** vs +5,61,404 | **+3,98,555** vs +1,96,015 |
| Choose on Oct–Mar, score on Apr–Sep (row 20): chosen vs baseline | +5,23,323 vs +3,64,099 | +2,86,158 vs +2,27,734 |
| **Recommended**: `chg0/either/r3/sma20/x3/SL/T2R/nofrz` — trades · net · daily t | 2,081 · **+13,27,290** · **3.01** | 2,081 · **+8,40,190** · **1.88** |
| … without its best 3 days | +9,80,528 | +5,18,801 |

- **Row 17 now recommends a change:** `chg0/either/r3/sma20/x3/SL/T2R/nofrz`. All four walk-forwards beat the baseline
  (expanding and rolling, each under both fill models), and the setting is positive in both halves (+8,03,967 / +5,23,323).
  It is positive in 10 of 12 months (March −29,464, August −4,237).
- **What that setting changes from live:**
  - take the 10 biggest movers at 09:20 with **no 2% floor**;
  - let the **first break of either side** decide the direction;
  - build the range from **three** five-minute bars (09:15–09:29);
  - exit on **3 closes against SMA20** instead of 2 against SMA9;
  - turn the stop and the 2R target **on**. They fired on only 80 of 2,081 trades, so they barely matter.
- **The live baseline's edge does not survive realistic fills.** Late fills take it from +5.10 lakh to +1.48 lakh
  (t 0.42), and without its best 3 days it is **−1,19,779**. The live exit, 2 closes against SMA9, is the part that loses:
  SMA5/9 are the worst exits in the grid under both fill models (row 15).
- **Why this is still a recommendation and not a change:**
  - t 1.88 under late fills is suggestive, not proof.
  - The universe is **today's** 210 F&O stocks, which were not all F&O stocks in Oct 2025, so there is survivorship.
  - P&L uses today's lot sizes.
  - The option leg is not modelled.
  - The live rules change only on the user's word (P37 row 13; the decision in HANDOFF).
- The first 61-session run below recommended nothing. Its sample was a quarter of this one, and its tendencies (slow SMA
  exit, 3 closes) were the same.
- **AC3 on this run:** 99 comparable trades. The exit reason agreed in 97, the mean future − share return was +0.10 pp,
  and the mean absolute difference 0.31 pp.
- **AC5:** six trades recomputed to the paisa by `.cache/p44-ac5.ts`: 3 baseline trades, 3 recommended-setting trades.

## First result, 2026-09-25 (61 sessions, 1 Jul – 24 Sep; 210 stocks; 420 Dhan calls, 0 failed)
- **The walk-forward does not beat the live rules.** Held-out net over 51 sessions: tuning **+2,20,240** against the
  baseline's **+2,57,014** on the same days. With late fills it is **+1,41,918** against **+1,76,214**. So row 17
  recommends **nothing**: the evidence does not support changing a live setting.
- **The live rules make money on this sample, but it is not proven.** Baseline, level fills: 307 trades, win 41.7%,
  net **+3,33,863** after ₹70,106 of costs, 30 of 61 days green, daily t = **1.57**. With late fills: net +2,22,606, t = 1.20.
  **Without the best 3 days it is +59,368** (late fills: **−7,881**). POLICYBZR on 24 Sep is the largest single contributor
  (+1,51,181).
- **The clean split (row 20) is mixed.** Level fills: the first-half pick (`chg0/gap/r2/sma13/x3`) made +1,47,415 on the
  second half against the baseline's +91,025. Late fills: +55,831 against +56,224, so no gain.
- **These tendencies agree under both fill models (row 15), but the walk-forward did not confirm them:**
  - direction `gap` beats `either`, and minChg 2 beats 0 and 1. Both of those are the live rules.
  - 2 range bars beat 1 and 3.
  - a slower exit helps: SMA 13 or 20 beats 9, and 3 closes beat 2.
  - **all three P42 rules lower the net**: stop, 2R target and the frozen-range skip. They stay off live.
  - The setting chosen most often, `chg2/gap/r2/sma20/x3/noSL/T2R`, is the most robust: t 2.07 (late fills 1.73),
    and +1,69,680 without its best 3 days.
- **AC3, the share as a stand-in for the future:** 99 baseline trades replayed on both 5-minute series. The exit reason
  agreed in 98 of 99, the exit bar in 66 of 99, and the mean return difference was **+0.012 pp** (mean absolute
  0.22 pp). There is no bias. The other 208 trades predate P37's futures cache (26 Aug).
- **AC5:** six trades (baseline and the most-chosen setting, first, middle and last) recomputed from the raw candles
  by a separate script (`.cache/p44-ac5.ts`): range, break minute, gross, costs and net all equal to the paisa.

## Out of scope
Option legs (row 10). The OI filter (above). Any change to the live rules. Brokerage-plan specifics beyond row 9.
Real orders.

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | `npm run train` fetches the missing cash history (a second run makes 0 calls for stored days), then replays all 1,728 settings over every session and prints the report. It refuses in replay mode. |
| AC2 | A second implementation agrees: on 24 Sep's real futures candles (`test/fixtures/paper-2026-09-24/`), the trainer's engine with the baseline settings and the day's real signals gives the same entry minute, entry price, exit bar and exit reason as P37's `replayDay`, which is already checked against `paper.ts` (P37 AC2/AC3). |
| AC3 | Substitution check: on every (session, stock) where both P37's futures 5-minute bars and the share's bars exist, the baseline's selected trades are replayed on the 5-minute bars of both series. The report prints how often the side and the exit bar agree, and the mean difference in % return. |
| AC4 | Every rule is shown rejecting something in `npm run train:test`: minChg, gap direction, the same-minute double break, the 15:00 entry cut-off, the frozen range, the stop, the target, the SMA exit, the 15:15 fallback price, the costs, and the walk-forward's ≥ 20-trade floor. |
| AC5 | One trade from the report is recomputed by hand from its raw 1-minute candles, and its net equals the report's to the paisa. |
