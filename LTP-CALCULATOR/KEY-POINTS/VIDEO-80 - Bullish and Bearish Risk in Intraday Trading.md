# Bullish and Bearish Risk in Intraday Trading

**Video 80 of 133** · 30 min · [Watch on YouTube](https://www.youtube.com/watch?v=kLQHJ1XoGdI)

## In one line

The complete rule set for intraday stock trades from the LTP Blast report: four levels generated at 9:25 am, each carrying its own entry, target and stop loss, plus the filters that disqualify most of them.

## Where the levels come from

- Between 9:15 and 9:25 the tool's AI reads the option chain of every stock and index. At 9:25 it publishes the day's key levels. The claim is that this is based on current-session data rather than historical price.
- Path: the three-line menu under the AI LTP logo on the left, then **Reports**, then **LTP Blast**. The report refuses to open outside 9:25 am to 3:30 pm on a trading day.
- A second click on **Show Nearest Stocks** at the top right narrows the long list to the stocks currently sitting at a tradeable level. This list refreshes all day — names appear and disappear.
- On the chart there are three toggles: **Live**, **M** and **AI LTP**. For intraday work, use **Live**. That is what draws the four lines.

## The four lines and what the numbers mean

- From top to bottom: **P2, P1, C1, C2**.
- P2 and P1 are **bearish** lines — sell entries. C1 and C2 are **bullish** lines — buy entries.
- Every line shows three values:
  - **Max Gain** = the target
  - **Max Pain** = the stop loss
  - the line's own label (C1, P2 and so on) = the entry price
- Only Max Gain and Max Pain repeat across all four lines. The entry value is what changes.
- If all four lines are not visible on a stock — three, two, one or none — that stock is not traded at all that day.
- Worked example on Asian Paints: C1 entry 2,533.50 with stop 2,521.50 and target 2,543.50; C2 entry 2,513.40, stop 2,501.40, target 2,523.40; P1 entry 2,553.35, stop 2,565.30, target 2,543.30; P2 entry 2,572.80, stop 2,584.80, target 2,562.80.
- Entries are taken in cash or futures. Options only if the volume in that option is reasonable — cash and futures are preferred.

## The rules that eliminate trades

**Pairing.** P1 is paired with C1, and P2 with C2. If the market touches C1 and that trade executes, P1 is not traded for the rest of the day, and the reverse holds. This applies even if you personally did not take the trade — what matters is that it executed on paper.

**C2 and P2 override.** If the market reaches C2 or P2 at any point in the day, including at the open, only that line is traded. The other three are dropped for the day.

**Risk rating.** At the top of the chart the tool prints a **Bullish Risk** and a **Bearish Risk** number. C1 and C2 entries are governed by the bullish figure, P1 and P2 by the bearish one. Only **0 or 1** is tradeable. Asian Paints showed a bullish risk of 2, so both bullish lines were eliminated.

**The pre-9:25 candle.** Because the lines only appear at 9:25, the first candle of the day can already have hit an entry and its stop before you ever see them. Hover over that candle and check its high and low. On Asian Paints the first candle's low was 2,519.60, below C1's stop of 2,521.50 — so C1 counts as executed and stopped out, and is eliminated. With C1 gone, P1 is automatically gone too.

- After both eliminations, only C2 and P2 remained tradeable on that stock for the day.

## The Nifty aside

- The 9:20 lines had only three of four lines visible that day — the EOR line was missing. The tool's own rule is that when a line is missing on one side, no trade is taken on that side, so bearish trades were off.
- It was a three-day week (Friday, Monday, Tuesday, with Tuesday expiry). Short weeks, he says, usually consolidate.
- The weekly range L1 levels were far apart on both sides, and the far strikes' premiums had already decayed to around ₹20 and ₹10, which he reads as the market settling between them.

## What the video tells you to do

- Open LTP Blast at 9:25, click Show Nearest Stocks, and work only from that filtered list.
- Switch the chart toggle to Live before reading any level.
- Before entering, check three things in order: are all four lines present, is the relevant risk number 0 or 1, and did the first candle already trigger and stop the level out.
- Enter at the line value, set the stop at Max Pain and the target at Max Gain, then leave the trade alone.
- Verify the method on free historical data before trading it live.

## Worth knowing

- This is a walkthrough of the presenter's own tool. Max Gain, Max Pain, Bullish Risk, Bearish Risk and the P1/P2/C1/C2 lines are all its proprietary outputs, not standard market data.
- The free tier gives 5-minute delayed data; historical tick-by-tick data is free, which is what makes the back-testing homework possible.
- He leaves one trade deliberately unresolved: a short in OIL at 393.35 (bearish risk 0, bullish risk 3), recorded on 1 September, and asks viewers to look up what happened in the historical data.
- Disclosure given for the broker tie-up (transcribed as "Punch"): the lines appear there if you hold an active LTP Calculator subscription and open the demat account with the same email address. He says the broker pays fixed API consumption charges, not a share of brokerage.
- Practical tip unrelated to trading: the channel's videos carry both Hindi and English audio tracks, switchable under the YouTube settings menu.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
