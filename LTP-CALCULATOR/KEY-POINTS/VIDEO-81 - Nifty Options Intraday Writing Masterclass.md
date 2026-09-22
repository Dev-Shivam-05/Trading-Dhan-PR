# Nifty Options Intraday Writing Masterclass

**Video 81 of 133** · 13 min · [Watch on YouTube](https://www.youtube.com/watch?v=DvggUwcWFtI)

## In one line

Three ways to pick the two strikes for an intraday short strangle on Nifty expiry day, each using a different set of lines, with the combined premium as the stop loss.

## The common structure of all three

- Sell one out-of-the-money call and one out-of-the-money put, both intraday, on expiry day.
- **The stop loss is the sum of the two premiums received.** If either leg alone reaches that figure, exit the whole trade.
- Target is both legs decaying to near zero — he exits at 25 paise.
- The arithmetic: if the market runs hard one way, the losing leg is stopped at the combined premium while the winning leg pays the other premium, so the trade closes roughly flat. If the market stays between the two strikes, both legs expire worthless and you keep the full combined premium.
- Setup on screen: click **Spot** at the top of the option chain once, and the call-side and put-side premiums appear alongside every strike.
- Lot size used in the example is 75, so a ₹19 credit is 19 × 75 minus brokerage.

## Method 1 - the AI LTP dotted lines

- With the **AI LTP** toggle on, two dotted lines appear on the chart: **R Max Pain** above and **R Max Gain** below.
- R Max Pain sat near 24,786, so he takes the 24,800 call, trading at about ₹6.
- R Max Gain sat at 24,583, so he takes the 24,600 put, at about ₹13.
- Combined stop loss: ₹19.

## Method 2 - the 9:20 lines

- Switch off AI LTP and switch on **920**.
- UR+1 was at 24,765, so he takes the nearest strike below it, the 24,750 call at about ₹15.
- EOS-1 was at 24,582, so the 24,600 put at about ₹12.
- Combined stop loss: ₹27.

## Method 3 - adding the weekly range

- This one he calls a prediction rather than a pure calculation, and the riskiest of the three.
- The weekly range pointed to a close near 24,700, so the expectation is that a 24,700 call expires worthless. He writes the 24,700 call at about ₹31.
- On the other side he uses the **nearest volume-based support**, which read 24,650 that morning, and writes the 24,650 put at about ₹20.
- Combined stop loss: ₹51.

## The trade-off between the three

- Strikes further from spot collect the least premium but are the safest. Strikes nearer to spot collect more but are much more likely to hit the stop.
- The method is a bet on consolidation. The speaker's point is that you have to stay in a single position rather than switching between buying calls and buying puts all day.

## What the video tells you to do

- Keep this strictly intraday. He is explicit that it must not be carried overnight, because a gap up or gap down means the stop loss cannot execute and the loss can be large.
- Set the combined premium as the stop the moment both legs are sold, and exit the whole position if either leg reaches it.
- Go to the free historical data, run all three versions on the day shown, and check which one would have been stopped out.

## Worth knowing

- This is a demonstration of the presenter's own paid tool, and every line used is the tool's own output.
- The subscription price quoted here is **₹600 per month plus GST**. Other episodes in the same series quote very different figures, so confirm the current price directly.
- He states the channel sells no courses; the free sign-up includes historical data and access to Q&A sessions run by their trainers.
- The stop-out case is described as no profit, no loss. In practice slippage and brokerage make it a small loss, and the speaker does acknowledge brokerage separately.
- Several numbers in the transcript are mangled — the R Max Pain value in particular is spoken as "2486" and then rounded to 24,800. Read the levels off the video.
- The broker disclosure is repeated: for the partner app (transcribed as "Punch"), activation is under the FX section with the coupon code "LTP", requires the same email address as the LTP Calculator account plus an active subscription, and the broker pays a fixed cost plus API consumption charges rather than a share of brokerage.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
