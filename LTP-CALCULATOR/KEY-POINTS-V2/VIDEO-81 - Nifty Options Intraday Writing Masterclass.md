# Nifty Options Intraday Writing Masterclass

**Video 81 of 133** · 13 min · [Watch on YouTube](https://www.youtube.com/watch?v=DvggUwcWFtI)

## In one line

Three ways to pick the two strikes for an intraday short strangle on Nifty using the LTP Calculator's lines, each with a stop loss equal to the total premium collected — recorded on an expiry Tuesday with Nifty near 24,700.

## The common structure

- Sell one call above the market and one put below it, both on the same expiry, and hold only for the day.
- The stop loss is the **sum of the two premiums received**. If either leg's premium alone reaches that number, exit the whole trade.
- The target is both legs going to near zero; the speaker exits at 25 paise.
- The logic: if the market runs hard one way, one leg expires worthless and the other is cut at the combined premium, so the trade lands near break-even. If it stays between the two strikes, the whole premium is kept. The realistic outcomes are a profit or a flat trade minus brokerage.
- To see the premiums on the chart, click **Spot** at the top; they then appear next to the strikes on both sides.

## Method one — the Max Pain and Max Gain lines

- Click **AI LTP** to draw two dotted lines.
- The upper line, R Max Pain, pointed to the 24,800 strike. The 24,800 call was quoted around ₹6.
- The lower line, R Max Gain at about 24,583, pointed to the 24,600 strike. The 24,600 put was quoted around ₹13.
- Combined premium ₹19, so the stop loss is ₹19 on either leg. On one lot of 75, the best case is ₹19 × 75 less brokerage.

## Method two — the 9:20 am lines

- Turn off AI LTP and select the 9:20 line set instead, then use R+1 above and S−1 below.
- R+1 sat near 24,765, so the 24,750 call was sold at roughly ₹15. S−1 sat near 24,582, so the 24,600 put was sold at roughly ₹12.
- Combined premium ₹27, which is also the stop loss. Strikes closer to the money pay more and are stopped out more often.

## Method three — the weekly range, as an add-on

- The weekly range line suggested the week would finish near 24,700, so the 24,700 call was written at about ₹31.
- The put leg was chosen from the nearest volume support visible on the chart, 24,650, written at about ₹20.
- Combined premium ₹51, and the stop loss is ₹51.
- The speaker is explicit that this third version mixes a prediction into the calculation, and that it is the riskiest of the three because the strikes are closest to the market.

## What the video tells you to do

- Take this intraday only. A gap up or gap down on the next open will jump straight past the stop loss, so the position must not be carried overnight.
- Set the stop loss as the two premiums added together, and apply it to whichever single leg reaches that value.
- Accept the trade-off consciously: the nearer the strikes, the larger the premium collected and the higher the chance of being stopped.
- Treat the day as a consolidation play. The speaker's point is that buying calls and puts alternately through the day is the losing alternative.
- Backtest all three versions on the tool's free historical data before using them live.

## Worth knowing

- The lines, the risk labels and the strike selection method belong to the speaker's own paid tool, which costs ₹600 a month plus GST. Free sign-up covers historical data, Q&A sessions and five-minute delayed data.
- The claim that losses are "negligible" with discipline is the speaker's own; it rests entirely on the stop loss being filled at the stated level, which a fast move can prevent.
- Nifty's index levels in this transcript keep losing their leading digits — the strikes above are reconstructed from context and are worth checking against the video.
- The video promotes a broker integration, with the speaker stating that the broker pays a fixed API fee rather than sharing brokerage.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
