# Bullish and Bearish Risk in Intraday Trading

**Video 80 of 133** · 30 min · [Watch on YouTube](https://www.youtube.com/watch?v=kLQHJ1XoGdI)

## In one line

How to read the four intraday lines the LTP Calculator draws for a stock at 9:25 am — C1, C2, P1, P2, each with its own entry, stop loss and target — and the pairing and risk rules that decide which of them may actually be traded that day.

## Where the levels come from

- Between 9:15 am and 9:25 am the tool's AI reads the whole option chain and produces levels for each stock from current-session data rather than from history.
- The report is at Reports, then LTP Blast, in the left-hand menu. It only exists between 9:25 am and 3:30 pm on a trading day.
- "Show Nearest Stock" at the top right narrows the long list to the stocks currently sitting at one of their levels. The list refreshes all day, so names enter and leave it.
- Open a stock, switch off the chain to get the plain chart, and select **Live** — not M, not AI LTP — to draw the four intraday lines.

## What the four lines say

- From top to bottom: P2, P1, C1, C2. C1 and C2 are buy lines; P1 and P2 are sell lines.
- Every line carries three values. The line's own number is the entry, **Max Pain** is the stop loss, and **Max Gain** is the target.
- The Asian Paints example used in the video: C1 entry 2533.50, stop 2521.50, target 2543.50. C2 entry 2513.40, stop 2501.40, target 2523.40. P1 entry 2553.35, stop 2565.30, target 2543.30. P2 entry 2572.80, stop 2584.80, target 2562.80.
- If any of the four lines is missing on a stock, the speaker's rule is to leave that stock alone.

## The rules that disqualify a trade

- **Pairing.** C1 is paired with P1, and C2 with P2. If a C1 trade triggers, P1 is off for the rest of the day, whether or not you were in it — and the reverse. Same for C2 and P2.
- **Priority.** If price touches C2 or P2 at any point in the day, including at the open, only that line is traded that day and the other three are ignored.
- **Risk score.** The panel shows a Bullish Risk and a Bearish Risk figure. Bullish risk governs C1 and C2, bearish risk governs P1 and P2. A score above 1 means no trade on that side.
- **The pre-9:25 candle.** Because the lines are only drawn at 9:25, check the first candle's high and low with the cursor. In the example, that candle's low of 2519.60 had already gone through C1's 2521.50 stop, so C1 counted as stopped out before it could be taken.
- Asian Paints was eliminated twice over that day: bullish risk of 2, and the stop already hit in the first candle. With C1 gone, P1 went with it, leaving only C2 or P2 live.

## Reading the index before trading stocks

- Nifty was described as slightly bullish because resistance had held in one place since the open while support had firmed up from weak, which points to consolidation rather than a trending move.
- On the 9:20 am line set, one of the four lines was missing. The tool's own 9:20 strategy note says that when a line on one side is absent, do not trade that side that day — so bearish trades were ruled out.
- It was a three-day trading week, which the speaker treats as usually consolidating. The weekly range lines were far apart, which he reads as the market likely finishing between them. The actual level numbers in this part of the transcript have lost their leading digits and are not recoverable.

## What the video tells you to do

- Wait for 9:25, open LTP Blast, and use Show Nearest Stock to find stocks sitting at a level.
- Switch the chart to Live before reading any line.
- Before entering, confirm three things: the direction's risk score is 0 or 1, the paired line has not already traded, and the first candle did not already run through the stop or target.
- Enter in cash or futures at the line, place the stop at Max Pain and the target at Max Gain, and leave it alone. Use options only where option volume is adequate.
- The example the video leaves open: OIL at P1, entry 393.35, bearish risk 0, bullish risk 3 — a sell with the posted Max Pain and Max Gain.

## Worth knowing

- C1, C2, P1, P2, the risk scores and the LTP Blast report are all proprietary to the speaker's paid tool, and the trading rules around them are his own.
- Some level figures in the transcript are visibly corrupted — the weekly-range numbers in particular, and the Max Gain of C1 is quoted as both 2543.50 and 2543.30.
- The video promotes free sign-up, free historical data for backtesting, and a broker integration. The speaker states the broker pays a fixed API fee, not brokerage.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
