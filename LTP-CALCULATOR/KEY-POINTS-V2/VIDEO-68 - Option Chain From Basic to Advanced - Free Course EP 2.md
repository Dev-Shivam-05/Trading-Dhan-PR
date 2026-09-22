# Option Chain From Basic to Advanced - Free Course EP 2

**Video 68 of 133** · 31 min · [Watch on YouTube](https://www.youtube.com/watch?v=Z8H4t-vONFQ)

## In one line

Day two of the seven-day beginner challenge, which explains an option as an insurance contract and then proves on real expiry data that a premium settles at exactly the distance between the strike price and the closing level.

## How to read the option chain screen

- The ATM strike sits in the centre of the chain. Strikes run above and below it; the centre line is treated as a border with the call side in green on the left and the put side on the right.
- Two sides are fighting across that border. The stated way to make money is to join whichever side is winning.
- Spot and futures are shown separately and both change tick by tick because every trade happens at a new price. On the day of recording spot was near 25,520 and futures near 25,600.
- Intraday means buying and selling the same day; holding into the following days is positional.
- The session's own example: the index low was 25,472 and the high 25,519, a 47-point move. Knowing that in advance is the whole problem — the course claims to teach how to see it.

## Buying the whole thing versus buying a slice

- Futures must be bought in a lot of 75 or a multiple of it, so at roughly 25,600 the contract represents about ₹19 lakh and needs roughly ₹1.5 lakh of margin.
- Anyone without that margin buys a part of the move instead, which is the option premium.

## The insurance analogy

- A bike worth ₹1 lakh can be protected two ways: keep ₹1 lakh in the bank, or pay an insurance company about ₹3,000 a year and let it carry the ₹1 lakh risk.
- If nothing happens in the year, the ₹3,000 is gone. If 1,000 customers each pay ₹3,000 the company collects ₹30 lakh and only some of them claim.
- Each strike price is described as its own insurance company. Buying its premium is buying that company's promise. Weekly expiry — every Thursday — is when the contract ends, exactly like an annual policy.
- One difference is stressed: with insurance the premium never comes back, but an option premium can return money at expiry.

## What a premium is actually worth at expiry

- The promise: at expiry, a call returns whatever the closing level is above its strike, and a put returns whatever the close is below its strike. Anything with the market on the wrong side returns zero, and a premium can never go negative.
- Worked example on the option chain: buy the 25,500 call for ₹45 with the index near 25,495. Break-even is 25,545. A close at 25,550 pays 50 (₹5 profit); at 25,600 pays 100; at 25,700 pays 200. A close at or below 25,500 pays nothing and the ₹45 is lost.
- The lesson is then checked against the real 3 July expiry, replayed in historical data. The index closed at 25,405.
- At that close, every call above 25,405 settled at zero, the 25,400 call settled at about 5, and the 25,350 call at about 55 — each one exactly its distance from the close.
- On the put side the same rule ran the other way: the 25,450 put settled near 45 and the 25,500 put near 95.
- Conclusion drawn for the beginner: call premiums rise as the index rises and fall as it falls, puts do the opposite, so buy calls when you expect a rise and puts when you expect a fall.

## What the video tells you to do

- Open historical data for a past expiry, note the closing level, and check each strike's final premium against its distance from that close until the rule is obvious.
- Before buying a call, work out the break-even — strike plus premium paid — and ask whether the index can realistically reach it by Thursday.
- Choose the side before the strike: decide direction first, then look at which premium to pay.

## Worth knowing

- The original student from day one did not show up and could not be reached, so day one is repeated with a new beginner, Simran. The seven-day promise is renewed with her.
- The insurance framing is a teaching device. It describes settlement accurately but leaves out time decay, volatility and the cost of being right too late.
- The "join the winning side" line is the speaker's framing, not a method; nothing in this episode tells you how to identify which side is winning.
- Several strike and premium figures in the transcript have lost their leading digits or been mangled by speech recognition. Only the ones consistent with the worked example are given above.

---

*Key points extracted from the auto-generated transcript. The spoken language is Hindi and the transcript carries speech-recognition errors, so specific numbers are worth confirming against the video itself.*
