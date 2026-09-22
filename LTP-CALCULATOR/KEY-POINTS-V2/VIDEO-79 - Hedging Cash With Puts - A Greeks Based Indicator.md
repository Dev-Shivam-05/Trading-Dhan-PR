# Hedging Cash With Puts - A Greeks Based Indicator

**Video 79 of 133** · 19 min · [Watch on YouTube](https://www.youtube.com/watch?v=4BTat5mCBRI)

## In one line

A three-filter screening routine for 10-to-15 day positional trades in stocks with an option chain, using the LTP Calculator's LTP Swing report, plus two ways to cap the downside — an option-interest stop loss, or a bought option used as a hedge.

## When these trades are taken

- Only stocks that have an option chain qualify. These are positional trades, not intraday.
- New positions are opened in roughly the first ten days of a new expiry month. The remaining ten to fifteen days are used to square off what was opened.
- The screen lives under the left-hand menu of the LTP Calculator: Reports, then LTP Swing. It has a bullish tab and a bearish tab, and the list is pre-filtered by the tool's AI.

## The three filters for a bullish trade

1. **Shifting status** must read Strong or WTT.
2. **Star rating** must be 0, or at most 1. Anything rated 2 or above is skipped.
3. **Put 100% open interest reversal** must either show a breakdown, or sit at the same price as the current market price.

- If all three line up, buy at the current market price. The target is the Call 100% open interest reversal price shown in the same row.
- Worked examples from the screen: REC, marked WTT with a breakdown and a zero star rating, bought around ₹351 with the call-side reversal at ₹401 as target; IGL at about ₹217 with a breakdown and a one-star rating, target 212 on the call-side reversal; Exide Industries needing roughly a ₹2 fall to reach its trigger. HDFC Life met the price condition but was rejected on a three-star rating.
- The bearish version is the mirror image: bearish tab, status Strong or WTB, call-side reversal showing a breakout or equal to the current price, star rating 0 or 1, then sell in futures with the put-side reversal as target. The speaker notes WTB rarely appears.
- This is for cash and futures positions only, never naked options.

## Two ways to handle the stop loss

- **Method one — watch the option interest.** Keep the stock's option chain open daily. Stay in a long while the put-side 100% open interest line reads Strong; exit when it flips to WTT. For a short, exit when the call-side 100% open interest turns WTT.
- **Method two — hedge instead of stopping out.** Subtract the put-side reversal from the call-side reversal to get the available move, then buy an option whose premium is a small fraction of it. In the REC example: buy 1,275 shares in cash or one futures lot around ₹350, then buy the ₹350 put for ₹10. If the stock reaches the ₹400 target, profit is roughly ₹40 a share after the premium. If it closes at or below ₹340, the put offsets the loss, so the position sits at no profit and no loss however far it falls. The maximum cost is the ₹10 premium.
- The hedge only works where the premium is cheap, which means the stock has to be trading close to its 100% open interest strike. Where premiums are large — the video points at Adani Enterprises and at IGL, which showed the same reversal level on both sides — take the open-interest stop loss instead.

## What the video tells you to do

- Check the three filters in order before every entry: status, star rating, then the reversal price.
- Take the entry at the current market price, and use the opposite-side 100% open interest reversal as the target.
- Decide up front which exit you are using. If the premium is small, buy the protective option; if it is not, plan to exit on the status flip.
- A flow chart and a written document covering both the bullish and bearish paths are linked in the video description.

## Worth knowing

- LTP Swing, the star rating and the reversal lines are features of the speaker's own paid tool. The filters are his method, not an established technique.
- Several premium and reversal figures in the transcript are mangled by speech recognition, and some stock names are misheard on screen. Treat the specific numbers as illustrations and re-check them in the video.
- The video ends with a broker promotion. The speaker states the broker pays a fixed API consumption fee rather than sharing brokerage.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
