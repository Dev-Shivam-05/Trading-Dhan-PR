# Hedging Cash With Puts - A Greeks Based Indicator

**Video 79 of 133** · 19 min · [Watch on YouTube](https://www.youtube.com/watch?v=4BTat5mCBRI)

## In one line

A complete rule set for 10-15 day positional trades taken from the LTP Swing screener, including how to replace a stop loss with a cheap bought option.

## When these trades are taken

- These are positional, not intraday. Each position is meant to run roughly 10 to 15 days.
- New trades are initiated only in the **first 10-15 days of a new expiry month**. The remaining days of the month are for squaring off what was opened.
- Only stocks with a live option chain qualify, because every signal is derived from the chain.
- Where to find the list: the black strip on the left of the LTP Calculator, then the three-line menu, then **Reports**, then **LTP Swing**. It opens as an AI-filtered list with Bullish and Bearish buttons at the top.
- The list columns are time, symbol, lot size, shifting status, CMP, Put HOI reversal, Call HOI reversal, OI and star rating.

## The bullish rules

Three filters, all of which must pass:

1. **Shifting status** must be **Strong** or **WTT** (weak towards top).
2. **Star rating** must be **0**, or at most **1**. Anything rated 2 or above is not traded.
3. **Put HOI reversal** must be either "breakdown" or roughly equal to the CMP.

- If all three pass, buy at the CMP, in cash or in futures.
- **Target** is the Call HOI reversal — the reversal price of the 100% open-interest strike on the call side.
- Examples he walks through: REC at a CMP near ₹351, WTT, breakdown, star rating 0, target ₹401. Exide Industries at ₹397 with the entry at ₹395, star rating 1. HFCL at ₹69.30 with entry at ₹68.25 and target ₹75. HDFC Life at ₹775 was rejected purely on a star rating of 3.

## The bearish rules

- Select the Bearish tab. The status must be **Strong** or **WTB** (weak towards bottom) this time.
- The **Call OI reversal** must be a breakout or equal to CMP. Star rating again 0 or 1.
- Sell from CMP. Target is the **Put HOI reversal**.
- The bearish side is marked **futures only**. The bullish side allows cash and futures.
- Neither side is for naked option buying. Options appear here only as the hedge.

## Two ways to control the loss

**Method 1 - status stop loss.** Watch the put-side 100% open interest every day. While it reads Strong you stay in the long trade. The moment it turns WTB, exit. On the bearish side, the equivalent exit is the call-side 100% open interest turning WTT.

**Method 2 - hedge instead of a stop loss.** Subtract the put-side reversal (or the CMP) from the call-side reversal to get the expected move, then buy an option whose premium costs roughly 5-7% of that move and leave it alone.

- The REC example: lot size 1,275 shares, CMP around ₹350, target ₹400. Buy the 350 put for ₹10.
  - If the stock reaches ₹400, the spot gain is 1,275 × ₹50, the put expires worthless costing 1,275 × ₹10, and the net is 1,275 × ₹40.
  - If the stock closes at ₹350, the ₹10 premium is the entire loss. That is the stop loss.
  - Below ₹350 — at ₹340, ₹330, ₹320 — the put's gain offsets the spot loss, so the position sits at no profit, no loss however far it falls. Because there is no stop-out, a later reversal can still turn it profitable.

## When hedging is not available

- The hedge only works when the protective option's premium is small, which means the strike has to be close to at-the-money.
- If the relevant strike is far from ATM the premium is too large and the hedge eats the target. In that case you must fall back on the WTB status stop loss.
- He shows Adani Enterprises as a case where the premium was too expensive to hedge, and IGL as a stock appearing in both the bullish and bearish lists with the 100% OI reversal on both sides at the same place — also not hedgeable.
- LIC Housing Finance is his example of a good hedge candidate: the put-side 100% open interest sat at 550, deep in the money, so that strike is skipped and the 88% open interest strike is used instead, where the premium is small.

## Worth knowing

- The 5-7% premium rule and the REC example do not agree: a ₹10 premium against a ₹50 expected move is 20%, not 5-7%. Check the figure in the video before sizing a hedge.
- Several numbers in the transcript are garbled, in particular the IGL target and the Axis Bank prices. The named stocks are examples from one day, not recommendations.
- This is a walkthrough of the presenter's own paid screener. The star rating, the shifting status and the HOI reversal levels are all the tool's own calculations.
- He gives the disclosure that the partner broker (transcribed as "Punch") pays a fixed fee and consumption charges for the LTP Calculator lines, not a share of brokerage. The API can also be licensed to build your own tool.
- Monthly range trading is promised for the next video.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
