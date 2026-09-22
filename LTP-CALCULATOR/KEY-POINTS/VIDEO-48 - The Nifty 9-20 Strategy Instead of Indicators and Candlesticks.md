# The Nifty 9-20 Strategy Instead of Indicators and Candlesticks

**Video 48 of 133** · 24 min · [Watch on YouTube](https://www.youtube.com/watch?v=NRlHcqbg1Uk)

## In one line

The full rule set for the Nifty 9:20 strategy — four fixed lines drawn once each morning, which of them are Call levels and which are Put levels, and how the stop loss is read off the option chain.

## How the four lines are made

- Open the LTP Calculator, choose the Chart or Option Chain plus Chart layout, and click the **9:20** button. Four dotted lines appear automatically.
- The lines are calculated once, at 9:20 am, from the option chain data and the Greeks. They are **static** — they do not move for the rest of the day.
- From top to bottom they are: extension of resistance plus one, extension of resistance, extension of support, and extension of support minus one.
- The strategy is for **Nifty only**. Other instruments have their own strategy.
- A question-mark button next to the 9:20 control opens the written rules inside the tool. The lines are also drawn on historical dates, so the strategy can be back-tested.

## Which line does what

- The **top two lines are Put levels.** Price arriving there is a Put buy.
- The **bottom two lines are Call levels.** Price arriving there is a Call buy.
- The **outer two lines** (extension of resistance plus one, extension of support minus one) are the **safe** trades, because the stop loss is close.
- The **inner two lines** (extension of resistance, extension of support) are the **risky** trades, because the stop loss is much further away.

## The trading rules

- New trades may be initiated between **9:20 and 11:30**. Positions may be managed until **2:30**, and everything is closed at 2:30 whether or not the target was reached.
- **Only the first touch of each line counts.** If price returns to the same line a second time, that is not a trade. This is what caps the day at four trades.
- Some days give all four trades, some give one, some give none.
- The **target** for a trade at one line is the next line in the direction of the trade.
- If price moves against the position to the next line out, **average there with the same lot size**.
- If you cannot fund the average, do not take the inner (risky) line at all. Wait and take the outer (safe) line instead.

## Reading the stop loss off the option chain

Switch to the Option Chain plus Chart layout and find the option value that matches the line's number.

- For the **upside lines**, take the next larger value on the resistance side and add **10 points**. In the worked example, the line value is 2573, the next resistance value is 2622, so the stop loss is 2632.
- For the **downside lines**, take the next smaller value on the support side and subtract **10 points**. In the example the value is 373, so the stop loss is 363.
- Both the risky and safe trades on the same side share the same stop loss. That is why the distance differs:

| Entry | Stop loss | Spot risk | Approximate option risk |
|---|---|---|---|
| Risky Put at 2525 | 2632 | ~110 points | ~50–55 points |
| Safe Put at 2573 | 2632 | ~50–60 points | ~30 points |
| Risky Call at 476 | 363 | ~110 points | ~50–55 points |
| Safe Call at 428 | 363 | ~65 points | ~25–30 points |

## What the video tells you to do

- Draw the 9:20 lines once in the morning and leave them alone for the whole session.
- Buy Puts only at the top two lines and Calls only at the bottom two.
- Take each line once. Ignore repeat touches.
- Exit at the next line, or at 2:30, or at the stop loss — whichever comes first.
- Do not take the inner risky lines unless you can average at the outer line.
- Back-test on historical dates in the tool before trading it live.

## Worth knowing

- The lines are described as calculated from Option Greeks, but the calculation itself is not shown. This is the speaker's own method.
- The claim that indicators and candlestick patterns confuse traders, and that this strategy will stop overtrading and produce patience, is asserted, not evidenced.
- The speaker promises more detail and multiple back-tests in a following episode, so the version shown here is not yet validated on air.
- Roughly half the video is not strategy. About four minutes advertise a Bajaj Allianz index fund benchmarked to the Nifty 500 Multicap Momentum Quality 50 (NAV ₹10, life cover of 10 times the annual or 120 times the monthly premium), and the last third draws prize winners for two LTP Calculator contests using a random number generator, with 511 and 294 entrants respectively.
- All the contest prizes are either cash or free LTP Calculator subscriptions, so the contest is itself a promotion for the paid tool.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
