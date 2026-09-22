# Protecting Cash and Futures by Buying Option Premium

**Video 106 of 133** · 43 min · [Watch on YouTube](https://www.youtube.com/watch?v=KObbx6ybc30)

## In one line

Two stock methods: intraday cash entries from the four automatically drawn Live lines, and a monthly-range positional short whose loss is capped by buying an at-the-money call for roughly 1% of the price.

## Why stock selection matters more than in the index

- Nifty is a blend of 50 stocks, so no single participant moves it easily. An individual stock with thin volume drifts on its own — the speaker calls it automatic manipulation, not deliberate.
- That makes liquidity a filter. Strikes showing volumes of 20, 30 or 80 contracts are treated as stocks to avoid entirely.

## The four Live lines

- Switching to **Live** draws four lines on a stock: **P2 and P1** above (sell side) and **C1 and C2** below (buy side).
- The lines are generated at **9:25**, after the first two candles of the session. Before that there is nothing to trade.
- Each line carries three values: the entry price, **Max Pain** which is the stop loss, and **Max Gain** which is the target.
- The lines are computed from Greeks, volume and open interest — no trendlines, no candlestick patterns, no timeframe switching.
- **PV** (point value) shown at the top is the expected move, calculated as half the gap between two strike prices. A ₹20 strike gap gives PV of ₹10.

## The rules that govern which trade you take

- **P1 and C1 are a pair.** If one of them fires, the other is not traded that day.
- If **P2 or C2** fires, no further trade is taken in that stock for the rest of the day.
- A trade that completed inside the first candle, before the 9:25 lines existed, is discarded. You cannot claim a trade you could not have seen.
- **Bullish risk and bearish risk** are scored automatically from 0 to 10. Trade only when the relevant risk is 0 or 1; skip 2 and above. When both P2 and C2 are available, take the side with the lower risk score.
- If only three lines appear instead of four, two values have coincided and that stock is skipped for the day.
- A risk score of 1 means the position may sit in loss close to the stop loss for a long time before the target arrives. The instruction is to wait rather than panic out.

## Worked examples

- **TCS:** P1 entry at 3,073 with stop loss 3,085 and target 3,063. The low was 3,061 and the high 3,074, so the target was reached and the stop was never touched — but this happened in the first candle, so the trade is discarded. The later P2 at 3,092.55 had target 3,082.60 and stop loss 3,104; the high was 3,093.90 and the low 3,079, so that one paid.
- **Titan:** P1 gave target 3,716 against stop loss 3,738. The high missed the stop by about three points and the target was made. A later P2 had its stop loss at 3,753.60 against a high of 3,753 — saved by fractions, because the risk score was 1 rather than 0.
- **Zydus:** the trade would have hit its stop loss. The speaker's point is that not every trade wins, and the process is followed regardless.

## Finding the trades: the LTP Blast report

- Path: menu → Reports → LTP Blast. It lists, live and auto-refreshing, every stock currently sitting on P1, C1, P2 or C2, with its bullish and bearish risk scores.
- This replaces scanning charts stock by stock. The speaker opens it cold and finds an open trade on the first click.
- In the first hour of the session he expects two to five usable trades to appear.

## Executing in cash

- Cash has no lot size and no expiry. You choose the share count that fits your capital, and delivered shares sit in your demat indefinitely.
- Use a limit order rather than a market order, even though slippage is less of a problem in cash than in low-volume options.
- Margin is displayed before the order; 100 shares of TCS showed roughly ₹47,000 to ₹76,000 depending on the broker.

## The monthly-range trade with insurance

- When a stock reaches **L1** of its monthly range, take the positional trade: sell at the resistance-side L1, buy at the support-side L1. This can be carried for about a month.
- Unlike arbitrage, this trade can lose. So it is insured by buying an option premium against it.
- **SBI example:** L1 at about 905, touched on 20 October near 10:45. Sell futures at 905 and buy the 905 call for ₹8.
- The outcomes he walks through: if SBI rises to 918 the futures lose about 13 while the call gains about 4; if it expires at 950 the futures lose 45 but the call is worth about 45. If SBI falls to 900 or 890, the call expires worthless and the ₹8 premium is the only cost, with the rest of the fall kept as profit.
- **The rule:** when you sell futures and buy the at-the-money premium as cover, your maximum loss is that premium. Nothing beyond it.
- **The 1% filter:** look for a stock where the at-the-money premium is around 1% of the price. Then the worst case on the whole structure is 1%. If the ATM premium costs more than 1%, the speaker prefers not to trade that stock.

## What the video tells you to do

- Wait until 9:25 for the Live lines; take no cash trade before they exist.
- Trade only stocks whose risk score on your intended side is 0 or 1.
- Honour the pairing rules — one of P1/C1 per day, and nothing after P2 or C2 fires.
- Discard any trade that completed before the lines were drawn.
- Skip stocks showing only three lines, and skip stocks with thin option volumes.
- Use LTP Blast to find candidates rather than scanning charts.
- On monthly-range positions, always buy the covering premium, and choose stocks where the ATM premium is about 1%.

## Worth knowing

- The Live lines, the risk scores, PV and the L1 monthly range are all outputs of the speaker's own tool; none can be reproduced without it.
- The claim that the covering premium is your maximum loss holds for the described structure at expiry, but ignores brokerage, taxes and the margin cost of carrying a futures short for a month.
- Two of the shown examples avoided their stop loss by less than a point. The video treats these as wins; they are equally a demonstration of how fine the margin is at risk score 1.
- The speaker acknowledges that reading the option chain directly improves accuracy but says the tool is meant to make that unnecessary.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
