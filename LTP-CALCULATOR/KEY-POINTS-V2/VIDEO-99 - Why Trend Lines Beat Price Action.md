# Why Trend Lines Beat Price Action

**Video 99 of 133** · 38 min · [Watch on YouTube](https://www.youtube.com/watch?v=7lX4GpygeBk)

## In one line

Day four of the Seven Days Challenge explains the four "920" lines the LTP Calculator plots each morning, and then backtests a month of Nifty trades on them to show that the target and stop-loss you fix in advance matter more than the win rate.

## What the four Greeks actually decide

- Vega governs volatility — how fast and how far the market swings. The speaker's point is that it changes tick by tick, so no one can track it by eye across every strike.
- Theta eats the time value in a premium and drives it to zero by expiry. It is the reason a premium shrinks even when the market sits still or moves slightly in your favour.
- Delta and gamma decide the price — how much a premium rises or falls for a given move in the index.
- The speaker misspeaks once and attributes time-value decay to Vega, then corrects himself: it is Theta.

## Intrinsic value and time value

- Call intrinsic value = market price − strike price. Put intrinsic value = strike price − market price. If the result is negative it is treated as zero, never a minus.
- Premium − intrinsic value = time value. In most premiums the time value is the bigger share.
- Deep in-the-money strikes are mostly intrinsic value with little time value. Near ATM the two are roughly equal. Out-of-the-money strikes have zero intrinsic value, so the whole premium is time value.
- Worked example from the 23 September expiry: the screen showed 25,185 at 3:30 pm, but the adjusted settlement price after 4:00 pm was 25,169. The 25,150 call then carried an LTP of roughly ₹19 — exactly the gap between settlement and strike. All time value had gone.
- The conclusion drawn: LTP is not a random number, it is a calculated one.

## The 920 lines

- The LTP Calculator watches the Greeks across all strikes for the first five minutes of the session and plots four lines at about 9:20–9:21 am. They stay fixed for the day.
- Top to bottom: EOR+1, EOR (extension of resistance), EOS (extension of support), EOS−1. The two upper lines are for selling, the two lower lines for buying.
- The chart, the option chain and the 920 lines each toggle on and off independently.
- Some days a line is missing, and that itself is the signal:
  - If EOR or EOR+1 is missing (or both), do not buy puts and do not sell Nifty futures that day. Nothing has fixed a destination above, so treat the day as bullish.
  - If EOS or EOS−1 is missing (or both), do not buy calls that day.
- The speaker says he has never seen both sides missing on the same day — the loss is always on one side.
- Example shown: on 1 September the upper lines were absent, so puts were ruled out at 9:21 am. By 3:30 pm the market had broken above and run higher.

## The month of backtests

All runs are Nifty, 1–25 September, one trade per line per day. Figures are index points, not rupees.

| Rules | Trades | Win rate | Result |
|---|---|---|---|
| Target 10 / SL 10, EOR and EOS only | 19 | 26% | about −86 points |
| Target 10 / SL 10, all four lines | — | — | about −70 points |
| Target 20 / SL 20, all four lines | 28 | 50% (14/14) | +12 points |
| Target 30 / SL 20 | 28 | 46% (13 wins) | about +96 points |
| Target 30 / SL 30 | 28 | 54% | about +93 points |
| Target 50 / SL 30 | 28 | 36% | presented as worse |

- The lesson drawn: a 10-point stop was too tight and kept cutting trades that would have worked. A 46% win rate produced the best month, so win rate alone says nothing.
- A single day is walked through — 3 September, in the 9 September expiry. The lower line was missing. A trade triggered on extension of resistance at 10:05 am and reached the 30-point target; a second trade at 1:58 pm hit the 20-point stop. One profit, one loss on the same day.
- He then role-plays a new subscriber who starts on 1 September, sees a loss on day two and two more on day three, and quits by 5 September calling the tool useless — while the same rules held to the end of the month finished around +96 points.

## What the video tells you to do

- Fix your target and stop loss before the session, in points, and use the same pair every day.
- Take the trade only when price actually reaches one of the four lines. Do not trade a market hanging in the middle, and do not trade all day.
- Check at 9:21 am which lines are present. A missing upper pair rules out puts and futures shorts; a missing lower pair rules out calls.
- Judge a rule set over two to three months of forward testing, not over four trades. Change one variable at a time — target, stop, which lines you trade.
- Decide your exit in advance and take it, instead of leaving at −10 one day, −15 the next and −50 on a bad day.

## Worth knowing

- The title does not match the content. The video never mentions price action and never compares trend lines against it. It also opens by promising divergence-based entries (D1, D2, D3) and an arbitrage strategy, and covers neither — both are deferred.
- The backtests come from the speaker's own tool over a single month of Nifty and are shown on screen, not published. One month of 19–28 trades is too small a sample to settle anything, which the video itself half-concedes by asking for months of forward testing.
- The episode is built around a paid subscription to the LTP Calculator; the four lines are a feature of that product.
- The support level for Nifty is stated but the number is mangled in the transcript. The resistance is given as 24,800 with the index near 24,780.
- A large part of the episode is the Seven Days Challenge giveaway — comment, share, fill the form, and a weekly spin decides who gets a free trip, stay and in-person sessions.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
