# Making the Share Market Work For You - EP 17

**Video 17 of 133** · 13 min · [Watch on YouTube](https://www.youtube.com/watch?v=98QQFBUxBhc)

## In one line

How to convert a spot level into the futures price and into the exact option premium it will carry when the market gets there, so entries, targets and stops can be placed as limit orders instead of chased.

## Spot, futures and the imaginary line

- All support and resistance definitions in the tool are built on the spot price. That never changes.
- A spot toggle switches the displayed price between spot and futures. In the Bank Nifty example the spot was around 44,213 while the futures were around 44,402.
- Because of that difference, the imaginary line will always sit somewhere other than the futures price. That is expected, not an error.
- Clicking the volume at the support strike of 44,200 gives an extension of support of 44,082 in spot terms, or 44,271 on the futures. Use the futures number if you are trading futures.
- There is no spot trading in an index. Index levels can only be traded through futures or options; stocks can be traded in spot.

## Converting a level into an option premium

- The **OC** tab (Option Chain) in the corner opens a grid of input boxes — one box in front of every strike on the call side and one in front of every strike on the put side.
- Type the spot level you are waiting for into the box in front of the exact strike and the exact side you intend to trade, then press calculate. The tool returns the premium that option will carry when spot reaches that level.
- Worked example: with the market at 44,213 the 44,000 call is trading at ₹432. Entering 44,082 (the extension of support) against the 44,000 call returns ₹345. That ₹345 is where the limit order goes.
- The same box gives the target. Enter the exit level against the same strike and the premium it returns is the price to book at.
- The reason for doing this at all: if you wait for the market to arrive and then enter manually, price can jump straight through the level and the trade is missed.

## Two mistakes the video calls out

- Entering the level against the strike on the opposite side of the chain. The calculation has to be done on the exact strike and side you will actually buy.
- Switching the whole option chain to the next expiry when you intend to trade the next expiry. The levels must still be read from the current expiry's chain — only the OC tab is switched to the far expiry to get its premium.

## What the video tells you to do

- Select the correct expiry in the OC tab before calculating.
- Calculate the entry premium first and place a limit order at that price, so the fill happens automatically when the level is hit.
- Calculate the target premium the same way and place the exit in advance.
- Use the futures conversion if the trade is in futures, and the OC conversion if it is in options.

## Worth knowing

- Strike price selection itself is not covered here — it is deferred to the next episode, which makes the premium numbers in this one illustrative rather than a complete method.
- The closing pitch is a community membership at a one-time ₹5,899 for a lifetime 50% discount on the LTP Calculator plus over 300 analysis videos.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
