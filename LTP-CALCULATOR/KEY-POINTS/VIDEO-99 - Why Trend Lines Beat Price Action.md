# Why Trend Lines Beat Price Action

**Video 99 of 133** · 38 min · [Watch on YouTube](https://www.youtube.com/watch?v=7lX4GpygeBk)

## In one line

Day four of the Seven Day Challenge: what each Option Greek does to a premium, how the four 9:20 lines are generated from them, and a month of backtested results showing that the exit rules matter more than the entry.

## What the Greeks actually do

- Five Greeks are named: delta, theta, vega, gamma and rho, alongside intrinsic value and time value.
- **Vega** is volatility. It decides how violently the market swings. It changes tick by tick and cannot be tracked by eye, which is the stated reason for using a server to follow it.
- **Theta** eats the premium. The speaker's description is that it chews through time value like a termite. This is why a premium can shrink by a rupee or two even when the market has not moved, or has moved in your favour.
- **Delta and gamma** set how far a premium will travel. A live example: with Nifty at 24779, the 24800 call premium was around ₹110-118. The calculator projected ₹241 if the index reached 25000, about ₹28 at 24600, and roughly 5 paise at 24500.

## Intrinsic value and time value

- Call intrinsic value = market price − strike price. Put intrinsic value = strike price − market price.
- If the result is negative, intrinsic value is zero. It is never negative. Example: with spot at 24780, the 24800 call would compute to −20, so its intrinsic value is zero.
- Time value is whatever is left in the premium after intrinsic value. In one example a ₹68 premium was made of ₹13 intrinsic and ₹55 time value.
- Deep in-the-money options are mostly intrinsic value. Near the money the two are roughly equal. Out of the money there is no intrinsic value at all, only time value — which is exactly what theta destroys.
- Intrinsic value is what the option will be worth at expiry. The speaker demonstrates this on the 23 September expiry: the screen showed 25185 at 3:30 pm, but the settlement price around 4:00 pm was 25169. After settlement every strike's price equalled its distance from 25169 and all time value was gone.
- The conclusion drawn: an LTP is not a random number, it is a calculated one.

## The four 9:20 lines

- The tool watches the Greeks across all strikes during the first five minutes of trading and plots four lines at about 9:20-9:21. They are labelled, from the top down, EOR+1, EOR, EOS and EOS-1.
- The lower two are for buying, the upper two for selling. The chart and the chain can each be toggled on or off independently.
- All four lines must be present for the normal strategy. Four incomplete cases are possible: EOR missing, EOR and EOR+1 both missing, EOS missing, or EOS and EOS-1 both missing. The speaker says he has never seen a day where both sides were missing.
- If a resistance-side line is missing, do not buy Puts and do not sell Nifty futures that day — the market has no upside destination fixed, which reads as bullish. If a support-side line is missing, do not buy Calls.
- The example given is 1 September, where an upper line was absent. The market broke above the top line and ran up through the day, and that warning was available at 9:21 am.

## What the backtest showed

Backtests run on Nifty from 1 to 25 September, one trade per line, entering only when price touches a line:

| Lines traded | Target / stop | Trades | Win rate | Result |
|---|---|---|---|---|
| EOR and EOS only | 10 / 10 | 19 | 26% | −86 points |
| All four | 10 / 10 | — | — | −70 points |
| All four | 20 / 20 | 28 | 50% | +12 points |
| All four | 30 / 20 | 28 | 46% | +96 points |
| All four | 30 / 30 | 28 | 54% | +93 points |
| All four | 50 / 30 | 28 | 36% | worse |

- The point made is that a 10-point stop was cutting trades that would have turned profitable. Widening the stop, not improving the entry, is what flipped the month from loss to profit.
- A 46% win rate still produced the best result. The number of winners matters less than the ratio between target and stop.
- The speaker walks through 3 September as an illustration: one trade at 10:05 am that hit its target, a second at 1:58 pm that hit its 20-point stop. One win, one loss, both taken mechanically.

## What the video tells you to do

- Check at 9:21 am whether all four lines are present, and drop the Put side or the Call side accordingly.
- Enter only when price actually touches a line. Do not trade a market hanging in between, and accept that some days give no trade at all.
- Fix the target and stop loss before the day starts and use the same pair every day, instead of exiting at 5 points one day and holding a 50-point loss the next.
- Forward test one fixed setting for three to six months before judging it. Do not conclude anything from two or four trades.
- Nifty futures trade in lots of 75, so points must be multiplied by lot size to get rupees.

## Worth knowing

- The four 9:20 lines, the reversal-based levels and the backtesting engine are all features of the speaker's own paid tool, and the video doubles as a demonstration of it.
- The backtest numbers cover a single month on a single index. They are illustrations from the tool, not independently verified results, and the speaker himself says the win rate is not the point.
- Despite the title, the video contains no comparison with price action trading. An arbitrage strategy is announced at the start but is not covered.
- The speaker misstates once that vega eats the premium, then corrects himself: it is theta.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
