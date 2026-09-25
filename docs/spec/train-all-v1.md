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
