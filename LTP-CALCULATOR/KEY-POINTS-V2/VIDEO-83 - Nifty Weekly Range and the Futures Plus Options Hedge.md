# Nifty Weekly Range and the Futures Plus Options Hedge

**Video 83 of 133** · 22 min · [Watch on YouTube](https://www.youtube.com/watch?v=UR54MFWOnbY)

## In one line

Two positional uses of the range lines in the LTP Calculator: writing paired strikes against Nifty's weekly range, and hedging a stock futures position taken at a monthly range boundary with a bought option, so that the maximum loss equals the premium paid.

## Where the ranges come from

- Each stock is assigned a **monthly range** at the start of the expiry month, and Nifty a **weekly range** decided on the evening of the Tuesday expiry for the week ahead.
- The ranges are derived from the current month's option chain — where open interest has built up at which strikes, the stock's vega, the implied volatility that follows from it, and known events such as results. No historical data, trend lines or indicators are used.
- On the chart, the line-set selector offers Live, W, 9:20 and AI LTP. **W** draws the weekly range, **M** the monthly range. Each draws three resistance lines (RL1, RL2, RL3) and three support lines (SL1, SL2, SL3).

## Writing against Nifty's weekly range

- Pair the levels by number: write the call at RL1 and the put at SL1, or both legs at L2, never one of each.
- Add the two premiums. That total is the stop loss. If the market runs one way, square off the leg whose premium reaches the total; the other leg decays to zero on its own.
- The L1 example, with Nifty at about 24,824: the 24,800 call at ₹46 and the 24,300 put at ₹44 to ₹45, giving a ₹90 stop loss.
- The safer L2 example: the call above 25,000 at about ₹15 and the 24,100 put at about ₹20, for a ₹35 stop loss. Further out means smaller premium and a smaller stop.
- The speaker justifies the L1/L2 choice by standard deviation, quoting roughly a 65% chance of the market staying inside the first band and 95% inside the second.
- Avoid entering on day one of the week. First-day volatility is what takes out these stop losses; the same trade behaves better as the week runs down.
- He also notes the previous week worked out this way: the weekly range pointed near a level the market briefly exceeded on a high, then closed back below, and the call written there expired worthless.

## Hedging a futures position at L1

- When price reaches L1 on either side, the range trade can be taken in futures instead: buy futures at support L1, sell futures at resistance L1. Above those levels, averaging is required.
- Insure the futures leg with a bought option at roughly the same strike — **buy a put if you are long futures, buy a call if you are short**. The premium paid becomes the entire risk, so no stop loss order is needed.
- The Nifty illustration: buy the future at L1 around 24,330 and buy the 24,300 put. If the market drops to about 24,350 the put would be worth around ₹100 to ₹110, and that premium is the whole loss.
- Choosing a strike further out lowers the premium but leaves a gap — going to 24,200 instead of 24,300 opens a 100-point unprotected stretch, which then has to be managed actively.

## The stock example worked through

- Bharat Electronics, trading at 379.80 with monthly RL1 at 381: short the future and buy the 380 call at ₹9.35. Target is monthly support at ₹346, held for the rest of the month.
- If the stock closes at 380, the call premium goes to zero and the futures leg is flat, so the loss is the ₹9.35 premium. At 385 the call retains ₹5 while futures lose ₹5. At 391 and at 400 the call gains match the futures losses, so the loss is capped at about ₹10 however far it rises.
- On the downside the futures profit offsets the lost premium: flat at around 370, and at the 346 target roughly ₹34 of futures gain against the ₹10 premium, about ₹24 net.
- **Position size is the catch.** BEL's lot is 2,850 shares, so a ₹10 per-share maximum loss is around ₹28,000. The speaker states plainly that this is a large-trader method, not something a small options trader should attempt.
- The premium paid should be small relative to the distance to target — his Jindal Steel example wants a premium under roughly ₹100 for a move of about that size.

## What the video tells you to do

- Select W for Nifty and M for stocks, and wait for price to actually reach an L1 or L2 line. Do not take these trades at random points; several stocks shown were simply sitting mid-range with nothing to do.
- When writing, always pair like with like and set the stop loss at the sum of both premiums.
- When taking futures at a range boundary, buy the opposite-side option at a nearby strike as insurance, and check the premium is small before committing.
- Skip the first day of the week for range writing.

## Worth knowing

- The range lines, the reversal prices and the market labels such as "Bull Run" and "Blood Bath" are features of the speaker's own paid tool, and he describes reversal prices as his own innovation.
- He states explicitly that using the tool's AI does not make anyone a profitable trader — only that it aims to show the option chain more clearly.
- Index and stock levels in this transcript repeatedly lose their leading digits. The Nifty strikes above are reconstructed from the 24,824 spot; the L2 figures in particular should be re-checked against the video.
- A monthly-range filter report, to list stocks currently at their L1 or L2, is announced as coming but did not exist at the time of recording.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
