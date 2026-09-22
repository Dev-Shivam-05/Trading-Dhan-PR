# The Nifty 9-20 Strategy - Not for Overtraders

**Video 49 of 133** · 15 min · [Watch on YouTube](https://www.youtube.com/watch?v=21cffhi8AaY)

## In one line

A second pass over the Nifty 9:20 strategy, walked through an RBI policy day, with the stop-loss calculation shown step by step and the target rule deliberately withheld as a homework contest.

## Why the lines are computed by the tool

- The option chain changes on many fronts at once: volume shifts, Open Interest shifts, support and resistance redefine themselves around the imaginary line pair, implied volatility rises and falls, the Greeks move, premiums decay, and spot, futures and cash diverge from each other.
- The argument made is that no trader can track all of that simultaneously, so the tool does it and outputs four lines.
- The evaluation runs between **9:20 and 9:21**. The four lines are drawn and never change for the rest of that day, or in the historical record afterwards.

## The four lines and their trades

- Uncheck **Live**, check **9:20**, and four dotted lines appear on a plain chart. No price action reading is involved.
- Top line: extension of resistance plus one — the top of the market. Bottom line: extension of support minus one — the bottom of the market.
- Both upper lines are Put buys. Both lower lines are Call buys.
- The outer lines are the safer trades; the inner two carry the same stop loss from further away, so they risk roughly twice as much.
- Stated risk sizes: roughly **50 points of spot, about 25 points of option premium** on the safer trade, and roughly **100–120 points of spot, about 50–60 points of option premium** on the risky one. Nifty's lot size is given as 75.
- Each line is traded only on its **first** touch. A second visit is not a trade.
- On the RBI policy day shown, both outer lines were hit once and both reached target.

## The stop-loss calculation, worked

Buying a Put, the stop is read from the **Call** side of the option chain:

1. Take the value sitting next to the line you are trading. For a Put at 643, the nearby Call-side value is 657.
2. Move to the strike just below that value. Its value is 708.
3. Add 10 points. The stop loss is **718**.

- Both the safe and the risky Put share that same 718 stop. From 643 that is about 60 points of spot, roughly 30 points of option premium. From 594 it is about 120 points of spot, roughly 60 points of premium.
- The stated reason both share one stop: the top of the market is a property of the market, not of your entry. The market does not adjust to your position size or capacity.
- The Call side mirrors this from the Put side of the chain.

## Averaging and position discipline

- If price moves against a Put bought at the inner line, do not cut. Buy a second lot at the outer line — that is the average.
- If you cannot fund a second lot, do not take the inner line at all. Take the outer line only.
- The full rule sheet is inside the tool: click the question mark next to the 9:20 control. It contains four rules for Calls, one for Puts, three of which are shared — five distinct rules in total, which the speaker says should simply be memorised.

## What the video tells you to do

- Trade "mercilessly": exit at the target, exit at the stop loss, enter only when the entry arrives, average only when the averaging point arrives.
- Never take the risky inner line without the capacity to average at the outer line.
- Read the stop off the opposite side of the option chain, not from the chart.
- Work out the target rule yourself from the in-tool rules page. The speaker offers one month of LTP Calculator free for the most detailed correct comment explaining it, judged on 15 February.

## Worth knowing

- The target rule — the one piece needed to complete the strategy — is not given in this video. It is turned into an engagement contest instead.
- The lines are described as produced by artificial intelligence evaluating the chain. No detail of the calculation is shown, and the strategy remains the speaker's proprietary method.
- The video opens by comparing failing trading to unstoppable hair fall and unshiftable weight, and promises this is the solution. That framing is marketing, not evidence.
- A broker promotion runs through the middle: open an account and place a first trade, and get one month of the LTP Calculator free. The speaker states explicitly that the channel is not an authorised partner and takes no share of brokerage.
- The numbers quoted in the stop-loss walkthrough are truncated in the transcript and should be checked against the video.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
