# Nifty Weekly Range and the Futures Plus Options Hedge

**Video 83 of 133** · 22 min · [Watch on YouTube](https://www.youtube.com/watch?v=UR54MFWOnbY)

## In one line

How to read the weekly range on Nifty and the monthly range on stocks from the option chain, sell premium inside that range, and hedge a futures position with a single option so the loss is capped at the premium paid.

## Where the range comes from

- Every stock has a monthly travel range and Nifty has a weekly one. The speaker says neither needs historical data, trend lines or any indicator.
- The range is read straight from the option chain: how much open interest sits at each strike, the stock's Vega, the volatility that Vega implies, how the other Greeks behave under that volatility, implied volatility, and pending events such as results or news.
- The range is fixed at the start of the period. If Nifty expires on Tuesday, the next week's range is already set on Tuesday evening.

## Reading the levels in the LTP Calculator

- In the charts panel there is a "Four Magical Spot Line" block. Selecting **W** draws the weekly range, **M** the monthly range.
- Six lines appear: RL1, RL2, RL3 above (resistance levels) and SL1, SL2, SL3 below (support levels).
- The speaker frames these as standard-deviation bands: roughly 65% of the time price stays inside L1, roughly 95% of the time inside L2.

## Writing premium inside the range

- Pair the levels: write the L1 call and the L1 put, or the L2 call and the L2 put. Never mix an L1 with an L2.
- Add the two premiums together and use that total as the stop loss on whichever side moves against you. Square off only that side; the other side decays towards zero.
- Worked example with Nifty near 24,824: the call side around 24,800 was about ₹46 and the put side around 24,300 about ₹44, so the stop was roughly ₹90 on one leg.
- The safer L2 version: around 25,000 call for about ₹20 and around 24,100 put for about ₹15, giving a stop near ₹35 with much smaller premiums collected.
- Day-one volatility is the main risk to this trade. The further into the week you go, the more reliable the stop becomes.

## The futures plus option hedge

- Wait for the stock or index to actually reach L1. Do not take the trade from the middle of the range.
- At an upper level (RL1), short the future and buy a call at the nearest strike. At a lower level (SL1), buy the future and buy a put. The option is described as insurance.
- Maximum loss equals the option premium paid, whatever happens. Beyond the strike, the option gain and the futures loss cancel each other out.
- Worked example on Bharat Electronics: price at 379.80 against an RL1 of 381. Short the future, buy the 380 call at ₹9.35, target the lower monthly level at ₹346. If price closes at 346, the future gains about ₹34 and the premium is lost, netting roughly ₹24. If price runs to 400 or 500, the loss stays pinned at about ₹10.
- The cheaper the hedging option is relative to the distance to the target, the better the trade. Choosing a strike further away lowers the premium but leaves a gap between the futures entry and the strike, and that gap is unhedged risk.

## What the video tells you to do

- Select W on Nifty for the weekly range and M on stocks for the monthly range before doing anything else.
- Write paired strikes at the same level number and set the stop at the combined premium of both legs.
- Avoid entering the writing trade on day one of the week; prefer day two, three or four when premiums are smaller and the stop is cheaper.
- Only take the hedge trade once price has arrived at L1 or L2, never at a random price.
- Check the lot size before taking the hedge. At a 2,850 lot size, a ₹9.35 premium is about ₹28,000 at risk.
- Scan stocks through the day looking for ones sitting near their L1 or L2.

## Worth knowing

- The speaker states plainly that the futures-plus-option hedge is a large-trader trade. Lot sizes are big and a small options trader cannot fund it.
- The range levels, the "Four Magical Spot Line" display and the reversal prices are the speaker's own product and innovation, not standard market tools.
- He announces a planned filter inside the LTP Calculator, within a month, that will list stocks sitting at RL1, SL1, RL2 or SL2 automatically.
- He explicitly does not claim the product's artificial intelligence will make anyone a profitable trader, only that it may give clearer readings.
- The numbers spoken during the Nifty example are inconsistent in places (strike values and premiums are repeated in shortened form), so confirm them on screen.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
