# Volume, Open Interest and Implied Volatility Secrets

**Video 107 of 133** · 40 min · [Watch on YouTube](https://www.youtube.com/watch?v=m6_PzLilXhs)

## In one line

What volume and open interest actually count, why implied volatility decides whether your trade behaves as expected, why an out-of-the-money strike pays you less for the same move, and one way to trade the four 9:20 lines.

## Volume versus open interest

- Open interest is created when a new position is written. Volume is created every time a lot changes hands.
- The worked chain: someone writes 50 lots and a buyer takes them — volume 50, open interest 50. That buyer sells to a second buyer — volume rises to 100, open interest stays 50, because the position was only transferred. Only a genuinely new write adds to open interest.
- Open interest falls only when the original writer buys the position back.
- **Volume is intraday** and starts from zero each morning. **Open interest is positional** and carries forward from the previous day.
- Because of this, volume is always the larger number.

## Where volatility comes from

- Volatility arises from the gap between spot and futures. In the example Nifty spot was 25,966 against futures at 26,040 — a 70-point gap.
- The wider that gap, the more volatile the instrument. On expiry day the two prices become equal, which is why the contract stops moving after expiry.
- That gap is what produces implied volatility, shown as the IV columns on both sides of the option chain.

## Reading implied volatility

- Compare the call-side and put-side IV near the at-the-money strike. In the example they read 11.73 and 11.55 — close enough that IV would not interfere.
- **Two warning conditions:** a large difference between the call side and the put side, or a large move in IV across the day (starting at 11.73 and reaching 14, 15 or 16).
- When IV swings like this, price action patterns break, indicator-based trades that were working suddenly fail, and stop losses are hit on setups that looked identical to earlier winners.
- Named high-volatility events: 4 June 2024 (election results), budget days, and major data announcements.
- **Very low IV** — readings of 4, 5, 6 or 7 sustained for ten to fifteen days — signals a consolidation phase: range-bound, no gap ups or gap downs. A jump from 4–6 up to 8–10 marks the end of that phase.
- The practical habit: note the IV each morning and check it a few times during the day.

## Why a cheap out-of-the-money strike pays less

- The Greeks price the premium. Delta says how much the premium moves for a move in the underlying, gamma says how fast delta itself changes, theta produces the time value, and vega handles volatility. The full calculation is Black-Scholes.
- The tool has a premium projector: enter the spot value you expect and it returns what the premium will be there. With spot at 25,966, a move to 26,000 — 34 points — took one call premium from about 119 to 138.
- Running the same 50-point move across strikes shows a clear fall-off: an in-the-money or at-the-money call captured about 30 of the 50 points, one strike further out about 26, further out again about 20, then about 15.
- The missing points do not vanish — they go into reducing the put-side premium. A deep in-the-money call captured about 36 points of a 50-point move while the put side lost only about 14.
- **Conclusion:** for intraday index trading, choose deep in-the-money strikes for maximum movement per point. Traders who exit at 10 points get there faster. The costs are a more expensive premium, more capital and more risk.
- **In stocks, stay at the money.** Low volatility in individual stocks makes deep in-the-money strikes a trap.

## The 9:20 lines

- Four lines are drawn at 9:20 — two resistances above and two supports below. That timing is where the name comes from.
- **If one or both upper lines are missing, do not buy puts that day. If one or both lower lines are missing, do not buy calls.** The line has to exist for the trade to exist.
- The method taught here: every time price hits one of the four lines, take the trade with an equal stop loss and target — for instance 15 points each way, a 1:1 structure. The example line at 25,882 against a low of 25,867 delivered roughly its 15 points.
- The speaker's own preferred approach is different: average into the position at the second line and place the stop loss above the next divergence. He says the method should be adapted to the day's scenario — bull run, blood bath or both-side-risky each call for different handling.
- Backtest your own point value rather than adopting 15 because he said it: try 10/10, 20/20, 20/10 and see which suits the reversals you get.
- One observation offered: on the rare day when every stop loss in the market is hit, the divergence trade above the 9:20 lines is the one that works. Such a day may come once in one to two months.

## Pre-calculating your entry premium

- Decide the spot level at which you intend to enter, then use the premium projector to see what the option will cost there.
- Example: intending to buy a call when Nifty reaches 25,824, the projector showed the premium would be about ₹156 against ₹196 currently.
- Place a limit bid at ₹156 and the entry fills automatically when the market arrives, instead of chasing the price.

## Writing premium around the 9:20 lines

- Sell premium on both sides, one strike beyond the upper and lower levels, and profit as both decay.
- When the market runs one way, roll the winning side inwards: buy back the far call you sold and write a nearer one, adding pressure in the direction the market is already moving. Leave the losing side alone.
- Worked example: sold a call at about 61 and a put at about 43 in the morning. The market fell to 25,824; the call dropped to 37 for a 24-point gain while the put rose to 63 for a 20-point loss — net about 4 points. A second call was then written at a closer strike, which added another few points as the fall continued.
- This is described as a continuous position rather than scalping, since nothing is squared off between adjustments.

## What the video tells you to do

- Note the call-side and put-side IV each morning and check for divergence and for drift during the day.
- Stay out of, or resize, option trades on days when IV is swinging.
- For intraday index option buying, prefer deep in-the-money strikes; for stocks, stay at the money.
- Do not buy puts on a day with no upper 9:20 line, or calls on a day with no lower line.
- Backtest your own stop loss and target sizes on the 9:20 lines rather than copying a number.
- Project the premium at your intended entry level and place a limit order at that premium in advance.

## Worth knowing

- The 9:20 lines and the premium projector are features of the speaker's own tool.
- The claim that the points "missing" from an out-of-the-money call go to the put side is a useful intuition but is not how option pricing is formally defined; the underlying cause is delta and gamma, which the video does mention.
- Several strike prices and premium figures in the transcript are mangled; the direction of each argument is clear but the exact numbers should be checked against the video.
- The speaker states explicitly that the Seven Days Challenge is free and that anyone asking for money in its name is a fraud.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
