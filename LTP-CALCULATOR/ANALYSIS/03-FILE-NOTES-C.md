# Per-file analysis — Part C: VIDEO-71 → VIDEO-104

This block covers: the student-driven stock screen, IV and time-value behaviour, the free-tier
product surface, the **weekly/monthly standard-deviation range (L1/L2/L3)**, the **LTP Swing**
positional screener with its hedge rule, expiry-day **short strangle** writing, the definitive
statement of **ATM by time value / WTT / WTB / SOC**, and the **LTP Blast** intraday stock rule set.

---

### VIDEO-71 — the beginner screens the stock list herself
**Type:** Practical drill. **Core — adds three rules and one honest unresolved point.**

- **Path used:** clock symbol on the left menu → **LTP Blast** → **Show Nearest Stocks** (top right).
- **The routine for each name:** put the cursor on the **first candle**, read the **entry, target and stop
  loss** on the line the stock is sitting at, and **check whether either the target or the stop has already
  been touched. If neither has, the stock is an OPEN TRADE and can still be entered.**
- **THE FILTERS APPLIED:**
  - **Either level already touched → SKIP.** Tata Steel rejected because **both** its 158.2 target and its
    stop had been reached — *the rule as stated is that if the target **or** the stop has been hit, the
    trade is skipped.* Axis Bank rejected because its 1,159.0 target was already met at 1,157.78.
  - **Risk decides the side.** Piramal had **bullish risk 0 but bearish risk 3** → only the **C1 buy** was
    allowed and **P1 could never be traded that day.** Sun Pharma dropped outright for bearish risk 2.
  - **A stock that cannot be traded at C1 cannot be traded at P1 either, but MAY become tradable at C2 or
    P2 later.** Tata Steel was kept on watch for a C2 entry.
  - **READ THE DIRECTION CORRECTLY:** on a **red sell line the target is BELOW the entry and the stop is
    ABOVE it.** The student checked the wrong side on Bajaj Finserv and was corrected:
    **imagine you are the seller** — a rise to 2,039.1 hurts you, a fall to 2,017.1 is the target.
  - **LOWER RISK WINS A TIE.** With two bearish open trades available, **ICICI Bank (risk 0) was preferred
    over Bajaj Finserv (risk 1).**
- **THE MARKET STATE IS NOT USED IN THIS SCREEN AT ALL.** The teacher notes explicitly that blood bath and
  similar scenarios **play no part in the stock list.**
  → **Important architectural separation: index trades are state-driven; stock trades are line-and-risk-driven.**
- **The five positions selected:**

  | Stock | Side | Target | Stop loss |
  |---|---|---|---|
  | ICICI Bank | Sell at P1 | 1,415.0 | 1,426.0 |
  | Piramal | Buy at C1 | 1,335.7 | 1,313.7 |
  | Bajaj Finserv | Sell | 2,017.1 | 2,039.1 |
  | SBI | Sell | 1,816.9 | 1,827.9 |
  | Reliance | Buy | 1,484.5 | 1,473.5 |

- **A subtle rule surfaced:** on Reliance the student noticed the first candle's low of **1,472** was below
  the **1,473.5 stop**, but the teacher pointed out **the ENTRY had never been touched in that candle, so
  the stop was not relevant.**
  → **The "stop already hit" rejection only applies if the entry was reachable in the same window.**
  *(This subtly qualifies VIDEO-63's rule 4.)*
- **Unresolved:** the teacher says the student made **one mistake across the five picks** and refuses to say
  what it was. He also notes ~90% of the live chat picked Reliance, implying the crowd's choice was wrong,
  **and never explains why. The video ends without the answer.** → Open Question 23.

---

### VIDEO-72 — IV collapse, and why a 35–40 point move pays nothing
**Type:** Live discussion (with Amit Bhakt). **Core for the "do not trade" condition.**

- **Situation:** consolidating market, IV fallen to almost nothing, time value across the chain already spent.
  ATM premiums ≈₹15 and ₹23, heaviest activity at the **25,150** strike, **which is why price kept sticking
  near that level.**
- **Method:** strip the screen down — remove the candles, remove the spot line, switch off most Greeks so
  only the raw chain and **delta** remain.
- **WHY THE MOVE PRODUCED NO PROFIT:**
  - The 25,200 put ≈₹55 with **delta ≈0.55**. A 40-point rise should add only ≈₹20 to it.
  - **By the time that ₹20 arrives, time value has already drained.** So when the index went to 25,200 and
    came back to 25,170, the ₹55 premium came back at only ≈₹45 — **less than it started.**
  - Tracked live: ₹55 → ₹50 → ₹48 → ₹44 as the index returned to the same 25,165–25,168 level.
  - **Realistic gain was 7–10 points — eaten by brokerage. Conclusion: not worth trading.**
- **THE TRAP IN THE DEEP STRIKE:** the 25,300 put had **ZERO time value**, so it was expected to move
  one-for-one with the index, like futures. **It did not.**
  **When the index rose 40 points, ≈₹14 of time value was ADDED into that premium; when the index fell back,
  that added time value was TAKEN OUT again.**
  Net: the 25,300 put went ≈₹135 → ≈₹125 while the index returned to the same place.
  **A buyer of EITHER strike lost money.**
  → **A zero-time-value strike does NOT behave like futures over a round trip.**
- **READING THE REVERSAL PRICES FOR ASYMMETRY (a genuinely reusable technique):**
  - **Call side:** reversal prices sat almost on top of the strikes — 25,200 showed 25,205; 25,250 showed
    25,250; 25,300 ≈25,300; 25,350 ≈25,350. **Almost no room on the bullish side.**
  - **Put side:** gaps were large — 25,200 showed 25,170; 25,150 showed 25,125; 25,100 showed 25,075.
    **Roughly 30 points of extra room on the bearish side.**
  - **That asymmetry is read as: the market has capacity to fall ~30 points and none to rise.**
  - **At expiry all reversal prices converge to intrinsic value.**
- **What to do instead:** either take the move in **futures**, where a 30-point fall actually pays 20–25
  points, or **do not trade at all**. The discussion settled on doing nothing unless the index reached 25,250.
- **Honest note in-source:** the explicit takeaway is that **the option WRITER collected the money the buyer
  did not get.** Option writing carries risks this video does not cover.

---

### VIDEO-73 — the FREE TIER of the AI LTP Calculator
**Type:** Product tour. **Core — this is the free/paid feature split.**

- **Why a plain chain is not enough:** asked where the largest call-side OI sits, or the largest put-side
  volume, or the **second-highest** volume, or the biggest change in OI, a reader of the raw NSE grid has to
  hunt row by row. **He matches the numbers on both screens and they agree — the claim is only that the raw
  layout hides what matters.**
- **WHAT THE FREE VERSION DISPLAYS:**
  - Sign-up free via "Sign in with Google".
  - **Option chain on the left, live chart on the right.** He matches Nifty against TradingView on-screen
    (≈24,964 / 24,970) to argue the chart is tick-by-tick.
  - **Every volume figure shown as a PERCENTAGE of the largest. The biggest volume on a side is 100%, the
    next 99%, and so on** — so the ranking is visible without reading numbers.
  - **Labels WTT (weak towards top) and WTB (weak towards bottom)** mark which way a strike is leaning.
  - **Highest and second-highest OI highlighted, as is the strike with the biggest OI CHANGE.**
  - **Support and resistance printed in words.** Example: resistance 25,000, marked WTT with bullish
    pressure, weak towards top at 25,100; support also 25,000, marked WTB, at 24,900.
  - **Imaginary line drawn at the current spot price.**
  - **Expiry switchable.** Any F&O stock, Bank Nifty, **and also Bitcoin and Ethereum**, each with its own
    chain, chart and S/R (ETH resistance ≈3,600 shown).
- **WHAT STAYS BEHIND THE PAID PLAN:**
  - Nifty momentum direction
  - Futures charts
  - **Implied volatility, PCR and Option Greeks**
  - **The four and six magical lines of the AI LTP Calculator**
- **Unclear, flagged in-source:** the transcript is **inconsistent about the data** — the opening describes
  the free tier as **delayed**, while the demonstration insists the charts are **live and tick-by-tick**.
  A few volume figures differ slightly between the two sites (≈27.35 lakh vs 27.46 lakh), consistent with a
  delay. → Open Question 24.

---

### VIDEO-74 — the STANDARD-DEVIATION RANGE LINES (L1/L2/L3)
**Type:** Method. **Core for the range path.**

- **The idea:** standard deviation produces three bands. **Rough hit rates given: first band reverses price
  ~65% of the time, second ~95%, third ~99%.** He states these are approximate and that **the rule is
  standard mathematics, not his invention.**
- **Three resistance lines above (RL1, RL2, RL3) and three support lines below (L1, L2, L3).**
- **CRITICAL CLAIM ABOUT THE INPUT:** the calculation is **NOT derived from historical price data.**
  He says it is **computed from the option chain and Option Greeks — that is, from TIME VALUE — which is
  why a full month's range can be drawn on day one.**
- **WHEN EACH RANGE APPEARS:**
  - **Nifty** has weekly expiry → **WEEKLY range.** New lines generated **Thursday evening after the close,
    ~4:00 PM**, on the chart when Friday opens.
    *(VIDEO-88 and VIDEO-123 say Tuesday, after the expiry day moved. → Open Question 25.)*
  - **Bank Nifty, Fin Nifty, Midcap Nifty** expire monthly → **MONTHLY range.**
  - **Individual F&O stocks** → **MONTHLY range.** Next month's lines appear **the day after the current
    monthly expiry** (expiry 28 Aug → September lines from the 29th).
  - **Toggle: W for weekly, M for monthly.**
- **Examples shown (all levels that held):** Nifty week of 8 Aug — touched the weekly support with a low of
  24,342 on 11 Aug and reversed. Bank Nifty's August monthly range never broken. Idea L1 ₹6.46 (lows 6.48,
  6.46 → reversal to ≈6.53). BSE L1 ₹159.96 (lows 160.70, 160.38 → ₹166, ≈3%). BPCL L1 ≈₹310 → ₹323 (≈6%).
  GMR Airports ranged between L1s of ₹84 and ₹95 all month. **One stock broke L1, fell to L2 at ₹336,
  bottomed ≈₹331, rebounded to ₹356.**
- **HOW TO USE THEM:**
  - **For option WRITING: sell strikes on BOTH sides at the same level. L1 on both sides is the most
    aggressive, L2 is safer, L3 is the safest.**
  - **Treat L1 writing on individual STOCKS as only moderate risk**, because stocks move less than the indices.
  - **For CASH buying: enter at support L1 if you accept more risk, or wait for L2 for a safer entry.**
  - **Start writing from day one of the month, so the whole month's time value works in your favour.**
- **Flagged in-source:** the title attacks RSI/Bollinger/EMA but the transcript never discusses them.
  Every example is a level that **held**; a level that fails on the same logic would put a writer short
  exactly where price is breaking out.

---

### VIDEO-75 — the definitive statement of ATM, S/R location, and the status labels
**Type:** Product + theory. **Core — the single best reference file for the label semantics.**

- **The two numbers:**
  - **Open interest** = the writer's position still open — sold but not yet bought back.
  - **Volume** counts every trade of the day. **A buy and a sell are two separate trades, so both add to
    volume.** Ten lots count as ten lots × lot size.
  - **In the tool, the largest volume on each side is 100% and the largest OI on each side is 100%.
    The second-highest is shown as a percentage of it and highlighted in YELLOW ONLY WHEN IT IS LARGE
    ENOUGH TO MATTER THAT DAY.** In the example a **57%** call-side volume was **not** highlighted, while a
    **75.85%** put-side volume **was**; on OI, the second-highest at **83%** was highlighted.
    → **This is direct numeric evidence that the yellow threshold is 75%.**
- **FINDING THE REAL ATM STRIKE:**
  - The red imaginary line marks the live spot; in the example it sits at 25,046–47, between 25,000 and 25,050.
  - **The rule: the ATM is the strike with the HIGHEST TIME VALUE, and there can only ever be ONE.**
  - **The IV/TV tool** at the top of the chain splits each side into IV and, separately, intrinsic and time
    value. In the example the **25,050** strike carried **₹66 of call-side time value and ₹63 on the put
    side — the highest on the chain → 25,050 is the ATM.**
  - **The imaginary line itself is drawn USING THE HIGHEST TIME VALUE, between those two strikes.**
    → **This refines VIDEO-01/02: the line is not purely a spot-bracket, it is time-value-anchored.**
    → Open Question 26.
- **LOCATING S/R (restated):**
  - **Resistance:** start at the LOWER of the two strikes at the imaginary line and read outward on the CALL
    side. Of highest OI and highest volume, **whichever sits CLOSER to the imaginary line** is the resistance.
  - **Support:** start at the HIGHER strike and read outward on the PUT side, towards OTM. Same tie-break.
  - **The tool prints the result at the top anyway.**
- **READING THE STATUS LABELS:**
  - **Strong** = the level is holding firmly.
  - **WTB** = weak towards bottom; **WTT** = weak towards top. **As a FIRST APPROXIMATION** WTB implies
    bearish pressure and WTT bullish pressure.
  - **⚠ THE WARNING THAT MATTERS: this shortcut OFTEN REVERSES.** A **WTB label can still carry BULLISH
    pressure**, and a **WTT label can carry BEARISH pressure**, depending on how the percentages moved
    during the day. **You cannot catch this with the naked eye unless you watch the chain continuously
    from 9:15.**
  - **WHAT SETTLES IT: the TRANSITION LINE printed under the level.** In the example resistance read
    **"WTB to Strong" — that is BULLISH** — and support read **"shifted from bottom to top" — also
    BULLISH. Both sides bullish is why the market was in a bull run.**
    → **This is the same five-state model formalised in VIDEO-108.**
  - **SOC = State of Confusion**, shown **with a duration and a direction**, e.g. "bearish SOC, 3 hours".
    **Red colouring means the confusion is on the SUPPORT side.**
    **Clicking the SOC banner shows when each level last changed.** In the example: resistance unchanged
    and strong since 10:00 AM; support shifted at 10:40 AM from 25,000 to 24,900; screen time 12:46.
- **THE 75% THRESHOLD, stated explicitly:** the tool flags caution once OI or volume around a level reaches
  **75% or more of the highest value on that side**, because it could climb towards 100% and flip the level.
  **Below 75% it stays quiet.** Live: the figure dropped **from 75% to 74.99%**, the bearish-pressure
  warning **disappeared immediately**, and the bull-run reading resumed.
- **Pricing note in-source:** free sign-up gives historical data and a **5-minute delayed** chain.

---

### VIDEO-76 — 9-EMA vs the 9:20 lines, plus the WRITING strategy and "Set D"
**Type:** Comparison + method. **Core — introduces the D1/D2/D3 target mechanism.**

- **The 920 button draws four horizontal lines after 9:21, generated once and then FIXED for the whole
  session**, including when you load that date in historical data.
- **The four lines on 28 August (Nifty ≈24,652): US−1 at 24,529, US/EOS at 24,575, UR/EOR at 24,620,
  UR+1 at 24,668.**
  **Claim: once the market reverses from these lines and completes its targets, that is the day's range.**
- **A FLOW CHART of the rules is available inside the tool under the question-mark button.**
- **THE WRITING STRATEGY:**
  - **Precondition: click 920 at or after 9:21. If all four lines are present, trade. If the lines on one
    side are missing, no trade is created on that side.**
  - **Sell the call strike ABOVE UR+1** — with UR+1 at 24,668 that is the **24,700 call ≈₹29**.
  - **Sell the put strike BELOW US−1** — with US−1 at 24,529 that is the **24,500 put ≈₹8**.
  - **Stop loss = the COMBINED premium of both legs ≈₹37–38.**
  - **If one side hits the stop, square off THAT LEG ONLY and let the other decay to zero.
    Outcome is roughly no profit, no loss.**
  - **If neither is hit, exit both legs at 2:30 PM. On expiry day hold to 3:30 PM.**
- **THE BUYING STRATEGY — and "SET D":**
  - **Bullish, RISKY trader:** buy a call when price reaches **US**. Then **press "Set D" and pick D1, D2 or
    D3 to get the target and stop loss.**
  - If price rises → exit at the chosen D target. **If price instead falls to US−1, AVERAGE WITH DOUBLE THE
    LOT SIZE — one lot at US, two lots at US−1 — then press Set D again. D1 is the target; the corresponding
    PUT-SIDE D1 value is the stop loss.**
  - **Bullish, MODERATE trader:** skip the first entry, wait for **US−1**, press D, set target and stop, exit.
    **No averaging.**
  - **Bearish:** buy a put at **UR**. If price keeps rising to **UR+1**, that is either the averaging point
    for the risky trader or a fresh trade for the moderate one.
  - Live put-side example: stop loss ≈**24,711 (D2 call)**; targets **24,625, then 24,580, then 24,528**.
  - **RULE FOR WHICH TARGET TO TAKE: the less experienced you are, the closer you should stop —
    inexperienced traders take D1 only.**
- **WHY EMA FALLS SHORT:** the EMA used is a **9-period EMA on a 5-minute chart**.
  **An EMA only exists where price has ALREADY been. There is no line ahead of the current candle**, so it
  cannot tell you in the morning where the day's top or bottom might be.
  At the bottom that reversed, the EMA gave no buy indication; the 9:20 line did, at 9:21.
  At the top, the EMA was still saying "buy" while the EOR line had already marked a selling level —
  **a trader following the EMA could be stopped out long and then, on the cross below, stopped out short as well.**
- **Homework instruction:** open historical data and compare the 9:20 lines against your own EMA over
  **30, 40, 50 or 90 days** before trading the method.

---

### VIDEO-77 — the 920 button (55-second clip)
**Type:** Short promo clip. **Confirms two facts.**

- The **920** button sits on the right of the chart, above the price panel.
- **Despite the name, the lines are generated at 9:21 AM**, once the first few minutes of trade have been read.
- **They are STATIC** — never change for the rest of the session, and **show the same values when you open
  that date later in historical data.**
- **The four levels named here: US−1 (24,529), EOS (24,575), EOR (24,620), UR+1 (value garbled).**
  **Together these four form what the speaker calls the day's range.**
- **Nothing about how to trade them** — that is VIDEO-48/49/76.

---

### VIDEO-78 — Zero Tax on Property Sale
**Type:** Tax commentary. **NON-CORE — no market logic.**

- A viral reel claims a couple made ≈₹4 crore on property and paid zero tax. The speaker walks through the
  actual case: 2002 two flats bought (₹34L, ₹17L); 2015 a third flat; 2017 the ₹34L flat **gifted** to the
  wife; Jan 2020 the wife sold both for **₹5.98 crore** → LTCG **₹4.21 crore**; March 2020 she bought the
  husband's Lodha flat for **₹3.85 crore**, paying **₹11,55,000** stamp duty. **Section 54** removes the CG
  liability; the tribunal ruled for the couple because Section 54 contains no bar on buying from a spouse.
- **His argument:** the ₹3.85 crore went to the husband, **so the liability was relocated, not avoided**, and
  **stamp duty was paid twice.** Had she bought from an unrelated seller she would have got the identical
  exemption with stamp duty once.
- **Relevance to our build: none.** Listed for completeness.

---

### VIDEO-79 — LTP SWING: the complete positional rule set + the hedge
**Type:** Method. **Core — the definitive positional screener spec.**

- **Horizon:** positional, **each position ~10 to 15 days.**
- **TIMING: new trades initiated only in the FIRST 10–15 DAYS of a new expiry month. The remaining days are
  for squaring off what was opened.**
- **Only stocks with a live option chain qualify**, because every signal derives from the chain.
- **Path:** black strip on the left → three-line menu → **Reports** → **LTP Swing**.
  Opens as an AI-filtered list with **Bullish** and **Bearish** buttons at the top.
- **LIST COLUMNS: time, symbol, lot size, SHIFTING STATUS, CMP, PUT HOI REVERSAL, CALL HOI REVERSAL, OI,
  and STAR RATING.**
- **THE BULLISH RULES — three filters, ALL must pass:**
  1. **Shifting status must be Strong or WTT.**
  2. **Star rating must be 0, or at most 1.** Anything rated 2 or above is not traded.
  3. **Put HOI reversal must be either "breakdown" or roughly equal to the CMP.**
  - **If all three pass, BUY AT THE CMP, in cash or futures.**
  - **TARGET = the Call HOI reversal** — the reversal price of the 100%-open-interest strike on the call side.
  - Examples: REC CMP ≈₹351, WTT, breakdown, star 0, target ₹401. Exide ₹397 with entry ₹395, star 1.
    HFCL ₹69.30, entry ₹68.25, target ₹75. **HDFC Life ₹775 rejected purely on a star rating of 3.**
- **THE BEARISH RULES:**
  - Status must be **Strong or WTB**.
  - **Call OI reversal must be a breakout or equal to CMP.** Star rating again 0 or 1.
  - **Sell from CMP. Target = the Put HOI reversal.**
  - **The bearish side is marked FUTURES ONLY. The bullish side allows cash and futures.**
  - **Neither side is for naked option buying. Options appear here only as the hedge.**
- **TWO WAYS TO CONTROL THE LOSS:**
  - **Method 1 — STATUS STOP LOSS.** Watch the put-side 100% OI every day. **While it reads Strong you stay
    in the long trade. The moment it turns WTB, EXIT.** On the bearish side, the equivalent exit is the
    call-side 100% OI turning WTT.
    → **This is a stop loss that is a STATE, not a price.**
  - **Method 2 — HEDGE INSTEAD OF A STOP LOSS.** **Subtract the put-side reversal (or the CMP) from the
    call-side reversal to get the expected move, then buy an option whose premium costs roughly 5–7% of
    that move, and leave it alone.**
    - **REC example:** lot 1,275 shares, CMP ≈₹350, target ₹400. **Buy the 350 put for ₹10.**
      - Reaches ₹400 → spot gain 1,275 × ₹50; put expires worthless costing 1,275 × ₹10; **net 1,275 × ₹40.**
      - Closes at ₹350 → **the ₹10 premium is the entire loss. That is the stop loss.**
      - Below ₹350 (₹340, ₹330, ₹320) → the put's gain offsets the spot loss → **no profit, no loss however
        far it falls. Because there is no stop-out, a later reversal can still turn it profitable.**
- **WHEN HEDGING IS NOT AVAILABLE:**
  - **The hedge only works when the protective option's premium is SMALL, which means the strike has to be
    close to at-the-money.** If the relevant strike is far from ATM the premium is too large and **the hedge
    eats the target** → fall back on the WTB status stop.
  - Adani Enterprises: premium too expensive to hedge. IGL: appeared in **both** the bullish and bearish
    lists with the 100% OI reversal on both sides at the same place → **also not hedgeable.**
  - **LIC Housing Finance — the good case:** the put-side 100% OI sat at 550, **deep in the money**,
    **so that strike is SKIPPED and the 88% OI strike is used instead**, where the premium is small.
    → **A named rule: if the 100% OI strike is deep ITM, step to the next-ranked OI strike for the hedge.**
- **INTERNAL CONTRADICTION FLAGGED IN-SOURCE:** the 5–7% premium rule and the REC example **do not agree**
  — a ₹10 premium against a ₹50 expected move is **20%, not 5–7%.** → Open Question 27.

---

### VIDEO-80 — LTP BLAST: the complete intraday stock rule set
**Type:** Method. **Core — the most complete statement of the stock path.**

- **WHERE THE LEVELS COME FROM:** between **9:15 and 9:25** the tool's AI reads the option chain of every
  stock and index. **At 9:25 it publishes the day's key levels.** The claim is that this is based on
  **current-session data rather than historical price.**
- **Path:** three-line menu under the AI LTP logo → **Reports** → **LTP Blast**.
  **The report REFUSES TO OPEN outside 9:25 AM – 3:30 PM on a trading day.**
  **Show Nearest Stocks** (top right) narrows the list to stocks currently sitting at a tradeable level.
  **This list refreshes all day — names appear and disappear.**
- **CHART TOGGLES: Live, M, AI LTP. For intraday stock work use LIVE. That is what draws the four lines.**
- **THE FOUR LINES:** top to bottom **P2, P1, C1, C2**.
  **P2 and P1 are BEARISH lines (sell entries). C1 and C2 are BULLISH lines (buy entries).**
  **Every line shows three values: Max Gain = the TARGET, Max Pain = the STOP LOSS, and the line's own label
  (C1, P2…) = the ENTRY PRICE.**
  **Only Max Gain and Max Pain repeat across all four lines. The entry value is what changes.**
  *(Note: the Asian Paints numbers below actually show different Max Gain/Max Pain per line, so read this
  statement with care — Open Question 28.)*
- **If all four lines are NOT visible on a stock — three, two, one or none — that stock is not traded at all
  that day.**
- **Worked example on Asian Paints:** C1 entry 2,533.50 / stop 2,521.50 / target 2,543.50;
  C2 entry 2,513.40 / stop 2,501.40 / target 2,523.40; P1 entry 2,553.35 / stop 2,565.30 / target 2,543.30;
  P2 entry 2,572.80 / stop 2,584.80 / target 2,562.80.
- **Entries are taken in CASH or FUTURES. Options only if the volume in that option is reasonable — cash
  and futures are preferred.**
- **THE RULES THAT ELIMINATE TRADES:**
  1. **PAIRING.** P1 is paired with C1, and P2 with C2. **If the market touches C1 and that trade executes,
     P1 is not traded for the rest of the day, and the reverse holds. This applies EVEN IF YOU PERSONALLY
     DID NOT TAKE THE TRADE — what matters is that it executed on paper.**
  2. **C2 / P2 OVERRIDE.** **If the market reaches C2 or P2 at any point in the day, including at the open,
     ONLY THAT LINE IS TRADED. The other three are dropped for the day.**
  3. **RISK RATING.** **Bullish Risk** governs C1 and C2; **Bearish Risk** governs P1 and P2.
     **Only 0 or 1 is tradeable.** Asian Paints showed a bullish risk of **2** → **both bullish lines eliminated.**
  4. **THE PRE-9:25 CANDLE.** Because the lines only appear at 9:25, **the first candle of the day can
     already have hit an entry AND its stop before you ever see them. Hover over that candle and check its
     high and low.** On Asian Paints the first candle's low was **2,519.60**, below C1's stop of **2,521.50**
     → **C1 counts as EXECUTED AND STOPPED OUT, and is eliminated. With C1 gone, P1 is automatically gone too.**
  - **After both eliminations, only C2 and P2 remained tradeable on that stock.**
- **NIFTY ASIDE:** the 9:20 lines had **only three of four lines visible — the EOR line was missing**.
  **The tool's own rule is that when a line is missing on one side, no trade is taken on that side** →
  bearish trades off.
  He also notes it was a **three-day week** (Fri, Mon, Tue with Tuesday expiry) and **short weeks usually
  consolidate**, and that the weekly-range L1 levels were far apart with far-strike premiums already decayed
  to ≈₹20 and ≈₹10 — read as the market settling between them.
- **Data/pricing facts:** free tier = **5-minute delayed** data; **historical tick-by-tick data is free**,
  which is what makes the back-testing homework possible.
- **Unresolved by design:** he leaves a short in OIL at 393.35 (bearish risk 0, bullish risk 3), recorded
  1 September, for viewers to look up.

---

### VIDEO-81 — Nifty expiry-day SHORT STRANGLE, three ways to pick the strikes
**Type:** Method. **Core for the writing path.**

- **COMMON STRUCTURE OF ALL THREE:** sell one OTM call and one OTM put, **intraday, on expiry day.**
  - **THE STOP LOSS IS THE SUM OF THE TWO PREMIUMS RECEIVED. If EITHER LEG ALONE reaches that figure,
    exit the whole trade.**
  - **Target is both legs decaying to near zero — he exits at 25 paise.**
  - **The arithmetic:** if the market runs hard one way, the losing leg is stopped at the combined premium
    while the winning leg pays the other premium → **the trade closes roughly flat.** If the market stays
    between the two strikes, **both legs expire worthless and you keep the full combined premium.**
  - **Setup on screen: click "Spot" at the top of the option chain ONCE, and the call-side and put-side
    premiums appear alongside every strike.**
  - Lot size 75 in the example, so a ₹19 credit is 19 × 75 minus brokerage.
- **METHOD 1 — the AI LTP dotted lines.** With **AI LTP** on, two dotted lines appear: **R Max Pain above
  and R Max Gain below.**
  R Max Pain ≈24,786 → take the **24,800 call ≈₹6**. R Max Gain 24,583 → take the **24,600 put ≈₹13**.
  **Combined stop ₹19.**
- **METHOD 2 — the 9:20 lines.** Switch off AI LTP, switch on **920**.
  **UR+1 at 24,765 → nearest strike BELOW it, the 24,750 call ≈₹15. EOS−1 at 24,582 → the 24,600 put ≈₹12.
  Combined stop ₹27.**
- **METHOD 3 — adding the weekly range.** Called **a prediction rather than a pure calculation, and the
  riskiest of the three.**
  The weekly range pointed to a close near 24,700 → **write the 24,700 call ≈₹31.**
  On the other side use the **nearest VOLUME-based support**, which read 24,650 → **write the 24,650 put ≈₹20.
  Combined stop ₹51.**
- **THE TRADE-OFF:** strikes further from spot collect the least premium but are safest; nearer strikes
  collect more but are much more likely to hit the stop. **The method is a bet on CONSOLIDATION.**
- **HARD RULE: keep it strictly intraday. He is explicit it must NOT be carried overnight, because a gap up
  or down means the stop cannot execute and the loss can be large.**
- **Honest note in-source:** the stop-out case is described as no profit no loss; **in practice slippage and
  brokerage make it a small loss.**

---

### VIDEO-82 — How Supply and Demand Set Market Prices (44 seconds)
**Type:** Micro clip. **Low content but states the model's premise.**

- **Rising:** supply lower than demand. **Consolidating:** sellers = buyers. **Falling:** sellers rise while
  buyers drop.
- **The point:** a rising market does not rise forever — **at some particular RATIO of sellers to buyers,
  sellers begin to outnumber buyers and the move turns. Locating that ratio is what turns the basic
  economics rule into something tradeable.**
  → **This is the one-line statement of what the reversal price is supposed to be** (cf. VIDEO-54: "when the
  demand-supply ratio shifts enough, price can reverse").
- **Flagged in-source:** it does not say how to identify the flip point — which is the part that matters.

---

### VIDEO-83 — the weekly/monthly range, and the FUTURES + OPTION HEDGE
**Type:** Method. **Core for the range and hedge paths.**

- **WHERE THE RANGE COMES FROM (the fullest input list anywhere):** read straight from the option chain —
  **how much OI sits at each strike, the stock's VEGA, the volatility that Vega implies, how the other
  Greeks behave under that volatility, IMPLIED VOLATILITY, and PENDING EVENTS such as results or news.**
  **No historical data, trend lines or indicators.**
- **The range is FIXED at the start of the period.** If Nifty expires on Tuesday, **next week's range is
  already set on Tuesday evening.**
- **UI: a "Four Magical Spot Line" block in the charts panel. W = weekly range, M = monthly.
  Six lines: RL1, RL2, RL3 above and SL1, SL2, SL3 below.**
  Standard-deviation framing: **~65% inside L1, ~95% inside L2.**
- **WRITING PREMIUM INSIDE THE RANGE:**
  - **Pair the levels: write the L1 call and the L1 put, or the L2 call and the L2 put.
    NEVER mix an L1 with an L2.**
  - **Add the two premiums together and use that total as the stop loss on whichever side moves against you.
    Square off ONLY that side; the other decays towards zero.**
  - Worked with Nifty ≈24,824: call side ≈24,800 ≈₹46, put side ≈24,300 ≈₹44 → **stop ≈₹90 on one leg.**
    **Safer L2 version:** ≈25,000 call ≈₹20 and ≈24,100 put ≈₹15 → **stop ≈₹35** with much smaller premiums collected.
  - **DAY-ONE VOLATILITY IS THE MAIN RISK. The further into the week you go, the more reliable the stop becomes.**
- **THE FUTURES + OPTION HEDGE:**
  - **Wait for the instrument to actually REACH L1. Do not take the trade from the middle of the range.**
  - **At an upper level (RL1): SHORT the future and BUY a CALL at the nearest strike.
    At a lower level (SL1): BUY the future and BUY a PUT.** The option is insurance.
  - **Maximum loss = the option premium paid, whatever happens.** Beyond the strike, the option gain and the
    futures loss cancel.
  - **Bharat Electronics example:** price 379.80 against an RL1 of 381. Short the future, buy the **380 call
    at ₹9.35**, target the lower monthly level ₹346. Close at 346 → future gains ≈₹34, premium lost →
    **net ≈₹24.** Price runs to 400 or 500 → **loss stays pinned at ≈₹10.**
  - **The cheaper the hedging option relative to the distance to target, the better.
    Choosing a strike further away lowers the premium but leaves a GAP between the futures entry and the
    strike, and that gap is UNHEDGED RISK.**
- **Honest note:** the speaker states plainly that **the futures-plus-option hedge is a LARGE-TRADER trade** —
  lot sizes are big and a small options trader cannot fund it. **Check the lot size**: at a 2,850 lot size a
  ₹9.35 premium is ≈₹28,000 at risk.
- **Product roadmap mentioned:** a filter to list stocks sitting at RL1, SL1, RL2 or SL2 automatically.

---

### VIDEO-84 — Investor vs Entrepreneur (2 min)
**Type:** Interview clip. **NON-CORE — no market logic.**

- Copying someone else's money-making route is the mistake; a business is a full-time commitment while
  putting money into someone else's business is not.
- **Match the investment to your own time horizon**: if you have ₹1 lakh today but need it next month,
  do not put it in at all. Even an ETF carries risk because the outcome depends on how long you can leave
  the money invested.

---

### VIDEO-85 — expiry-day writing around Max Pain (3 min clip)
**Type:** Short method. **Duplicates VIDEO-81 method 1; keep for the explicit break-even arithmetic.**

- **Click "Spot"** → premiums appear beside the strikes. **With AI LTP selected, two dotted lines appear;
  the first marks the Max Pain strike.** In the example Max Pain pointed to the **24,800** strike on a
  Tuesday expiry.
- **The trade:** sell the **24,800 call ≈₹6** and the **24,600 put ≈₹13**.
  **Stop loss = 13 + 6 = ₹19, applied to whichever leg moves against you. Target: zero — exit ≈25 paise.**
- **Why it is called no-profit-no-loss:**
  - Market runs up past 24,800 → the put decays to zero and you keep ≈₹13, while the call leg is stopped at
    ₹19 for a ₹13 loss → **cancel.**
  - Market falls hard → the call goes to zero and you keep ≈₹6, while the put leg is stopped at ₹19 for a
    ₹13 loss → **cancel.**
  - **The profit case is the market staying between the two strikes so both premiums decay to near zero.**
- **Flagged in-source:** the break-even claim **assumes the stop actually fills at ₹19**; on a fast
  expiry-day move the fill can be worse.

---

### VIDEO-86 — The Real Theory of Support and Resistance (29 seconds)
**Type:** Promo teaser. **NON-CORE.**

- Argues S/R is a "scattered" subject: many opinions, no underlying theory; traders have watched OI and
  volume for years, each from their own point of view, with no shared rule.
- **The pattern he objects to is SELECTIVE MEMORY: when a call works it is celebrated; when it fails it is
  shrugged off and nothing is learned.**
- **No theory is actually explained here.** The clip ends mid-sentence.

---

### VIDEO-87 — why a round trip in the underlying leaves the option worth less (2 min)
**Type:** Conversational fragment. **Core for the delta+theta intuition.**

- Holder has an option ≈**₹55** with **delta ≈0.55**.
- **If the underlying moves 40 points AGAINST the position, the option loses ≈₹20 on delta alone → ₹55 → ≈₹35.**
- **That move takes TIME, and over that time the option's time value is being spent. The time value lost does
  not come back.**
- **When the underlying reverses, it does not return all the way** — in the example it comes back to ≈170
  rather than 150. **On that partial recovery the option goes ₹35 → ≈₹40, at most ₹45. It never prints ₹55 again.**
- **Conclusion: a full round trip in the underlying leaves the option worth LESS than it was, because delta
  only captures part of the move and time value keeps draining throughout.** The practical result is trading
  options for 7, 8 or 10 points.

---

### VIDEO-88 — a whole week reviewed against the weekly/monthly range
**Type:** Review. **Core — confirms the static property and the generation time.**

- **WHERE THE RANGE COMES FROM (restated):** every buyer and writer already trades with a range in mind —
  a target on one side and a stop on the other. **OI and volume build at particular strikes because
  participants are collectively fixing the week's or month's range.**
  **That range depends on the GAP BETWEEN SPOT AND FUTURES, and on the Greeks that gap generates (delta,
  theta, vega, gamma, rho and the minor Greeks)**, treated as a read on trader sentiment and activity.
  **Calculated on standard-deviation rules, not on historical price data or trend lines.**
  **Reading the chain directly is described as too complicated to do by hand** — OI and volume keep shifting
  all day. **The tool's system watches the market from 9:15 to 3:30 AND AGAIN AT THE 4:00 SETTLE, and
  generates the range from that.**
- **THE KEY PROPERTY — THE LEVELS ARE STATIC:** **the weekly range is calculated ONCE, at 4:00 PM on the
  previous TUESDAY expiry, and then the lines are FIXED for the whole week. They do not move as price moves.**
  **Press W for Nifty's weekly range, M for a stock's monthly range. The monthly range starts the day after
  the previous month's expiry.**
- **Three bands each side: L1, L2, L3. Hit rates given: ~65% L1, ~95% L2, above 99% L3, which he says almost
  never gets reached.**
- **What the week actually did (3 Sep → Tuesday 9 Sep expiry; RL1 24,824, SL1 ≈24,334):**
  3 Sep middle of range; 4 Sep gap-up to the top then back inside; 5 Sep opened at the top and stayed below
  it all day; 8 Sep poked above once then closed back below.
  **With price stuck at the top on expiry day, the ≈24,850 call was still ≈₹37 while both the 24,350 and
  24,300 puts had already decayed to near zero.**
- **Monthly ranges on stocks (all consolidating ON a range line):** Bank of Baroda upper L1 244 / lower L1
  222, price mid-range. CDSL L1 1,546, high ≈1,543 on 2 Sep, price kept closing back inside.
  IDFC First opened centre, reached the top 4 Sep, consolidated ≈₹73 just above L1.
  Jubilant Food moved to the top and consolidated on that line ≈668. Mankind consolidating directly on L1
  ≈2,620. Exide sat on L1 from early September and tried to break it on 8 Sep.
  **The point: consolidation ON a range line is what makes it useful — for writing, for choosing a put strike
  when hedging a short future, and for reading direction in cash trades.**
- **Behaviour instruction:** **on day one and day two premiums often spike when the market jumps. Do not
  chase them; hold the position and trust the fixed range.
  If you find yourself trading out at L2, treat that as caused by a large gap-up rather than normal behaviour.**
- **Pricing stated here:** historical data and 5-minute delayed live data free; real-time paid, **from ₹78/month
  for NSE and ₹99/week for crypto.** *(Pricing varies wildly across files — see Open Question 29.)*

---

### VIDEO-89 — Trusting the Weekly Range (1 min)
**Type:** Excerpt from VIDEO-88. **Confirms the hit rates and one behavioural rule.**

- **The behaviour being corrected:** when writing intraday against the weekly range, the market often jumps
  and prints a high, **especially on day one and day two. On those jumps premiums rise sharply, and that is
  when writers panic out.**
  **Instruction: trust the range that was already fixed at the start of the week. If you are trading the L1
  band, STAY in the L1 band. Ending up out at L2 usually only happens because of a very large gap-up.**
- **Hit rates claimed: L1 ≈65%, L2 ≈95%, L3 >99% and "capable of stopping the market", and L3 is rarely even
  reached.**
- **Stocks have monthly ranges built on the same idea as Nifty's weekly range.**

---

### VIDEO-90 — Six Questions Before Every Trade (1 min)
**Type:** Checklist excerpt. **Core — the compact SWOT checklist.**

- **THE QUESTIONS:**
  1. **Target versus stop loss — how many points is each, and what is the ratio?**
  2. **Is the chart pointing in a direction that favours the trade, or not?**
  3. **If the scenario changes, does it change in your favour or against you?**
  4. **If the market is in a State of Confusion, what direction is likely to follow?**
  5. **Is the momentum already complete, or is there still move left in it?**
  6. **Is the percentage reading increasing or decreasing?** (Only where a percentage is available.)
- **HOW TO APPLY: ask the SAME list FOUR TIMES OVER — once for each part of SWOT: strengths, weaknesses,
  threats and opportunities.**
- **Claim:** asking these of yourself, in that repeated way, **is the whole of the analysis.**
- One question in the transcript is garbled beyond safe reconstruction.

---

### VIDEO-91 — the published LTP SWING FLOWCHART
**Type:** Flowchart walkthrough. **Core — this is the cleanest statement of the positional decision tree.**

- **Where to find it:** three-line menu → **Reports** → **LTP Swing** → **Bullish / Bearish / Read More**.
  **Read More opens the website page holding the complete LTP Swing strategy guide; the information button
  there shows the FLOWCHART, and the report table beside it lists every term the flowchart uses.**
- **THE BULLISH BRANCH** (cash and futures only — **explicitly NOT naked option buying**):
  1. **Shifting Status must read Strong or WTT.**
  2. **Put High-OI Reversal must be in BREAKDOWN, or sitting level with the current market price.**
  3. **Star rating must not be more than 0 or 1.**
  - **All three match → BUY at the current market price.**
  - **Target: the value shown at the Call High-OI Reversal, or the strike carrying 100% open interest.**
  - **Stop loss: triggered if the PUT side's 100% OI turns WTB.**
- **THE BEARISH BRANCH:**
  1. **Shifting Status must read Strong or WTB.**
  2. **Call High-OI Reversal must be in breakdown or close to the CMP.**
  3. **Star rating 0 or 1.**
  - **All match → SELL at the current market price.**
  - **Target: the strike where the Put High-OI Reversal shows 100% open interest.**
  - **Stop loss: triggered if the CALL side's 100% OI turns weak.**
- **HOW THE HEDGE IS SIZED:**
  - **Long: subtract the Put High-OI Reversal from the Call High-OI Reversal. Buy a PUT whose premium is
    roughly 5% to 7% of that difference.**
  - **Buy it for the SAME QUANTITY as the position** — the number of shares held, or the number of futures lots.
  - Worked: holding 1,000 shares or a 1,000 lot, the put works out ≈**₹10 to ₹17** of premium.
    **That premium is effectively the stop loss for the whole trade.**
  - **Short: mirror — subtract the Call High-OI Reversal from the Put High-OI Reversal and buy a CALL at
    roughly 5% to 7% of that difference.**
- **Flagged in-source:** the exact stop-loss condition is stated **loosely** and is symmetrical in intent
  rather than precisely worded. **Read it off the published flowchart rather than from the spoken version.**
  → Open Question 30.
- **Note a wording inconsistency with VIDEO-79:** here the bearish branch says the Call High-OI Reversal must
  be in **"breakdown"**; VIDEO-79 says **"breakout"**. → Open Question 31.

---

### VIDEO-92 — a live morning where the correct answer is "write, don't pick a side"
**Type:** Live read. **Core — the clearest statement of how to read the percentage DIRECTION.**

- **Starting picture:** the first resistance had been **WTT** (bullish pressure) and then **suddenly turned
  Strong. That flip creates BEARISH pressure.**
  At the same time the support's OI **shifted from bottom to top**, and the support **volume** was on the
  verge of shifting too — **both bullish.**
  **So resistance pushes down while support pushes up. The whole exercise is deciding which is larger.**
- **Method:** first **remove the option chain and every prediction line**, leaving a plain chart — on which
  there are only two possible trades. Then **add the external factors back one at a time.**
- **THE FACTORS CHECKED:**
  - **Weekly range:** RL1 and SL1 were both **far away**, so neither was pulling the market →
    **this factor is ELIMINATED.** → *A weekly-range level only matters when price is near it.*
  - **Intraday range:** both the day's resistance and support printed at **25,300 — on the same line.**
    Clicking the resistance showed **Bearish Strong**; clicking the support showed **bullish** pressure.
  - **THE PERCENTAGE IS THE TIEBREAKER — and the logic is REVERSED between the two sides:**
    - **On the RESISTANCE side:** a **RISING** percentage (72% → 73%) means **the bearish pressure is
      DISSOLVING and will convert into bullish pressure**, because the resistance is turning WTT again.
      A **FALLING** percentage means **the bearish pressure stays stable.**
    - **On the SUPPORT side the logic is reversed:** a **FALLING** percentage means **the support is
      shifting cleanly and the bullish pressure continues**; a **RISING** percentage means **the shift is
      failing and the market turns bearish.**
    - Live reading: resistance % slowly increasing, support % decreasing → **overall tone towards buying.**
- **WHY THE TRADE WAS STILL REFUSED:** the AI LTP layer said **wait on both sides** — sell only at ≈25,357,
  buy only at ≈25,265, **and in the zone between the two do nothing.** Reason: **the market has not settled;
  it is still trying to build a range.**
  Three outcomes listed: support Strong + resistance WTT → **bull run**; neither happens → **price keeps
  rotating**; support shifts back down → **sharp fall.**
  **The specific risk to buying: the support becomes WTB at a NEW level, which would put in a top and leave
  the long stranded.**
- **THE CONCLUSION RULE:** **when the correct action is to WAIT both for buying and for selling, the day
  belongs to WRITING, not to direction, because price will keep rotating in the middle until one of the
  levels resolves.**
  **Write at the Max Pain on both sides:** resistance-side Max Pain ≈25,400 trading ≈₹33; support-side
  Max Pain ≈25,150 ≈₹13.
- **Flagged in-source:** the title promises a second-highest-volume lesson that the transcript never delivers.

---

### VIDEO-93 — THE SECOND-HIGHEST VOLUME RULE
**Type:** Theory. **Core — the fullest statement of the speaker's signature claim.**

- **What volume is:** created by a completed trade — a buyer and seller matched. **Every executed trade sets
  a new LTP, so volume and LTP are locked together — volume cannot change without the price changing.**
  **Volume resets to zero each session (9:15 → 3:30).**
  **This is about volume PER STRIKE on the option chain, not the volume bars at the bottom of a price chart.**
- **HOW VOLUME SITS ACROSS THE STRIKES:**
  - **Volume appears at EVERY strike, not only the one you are watching.** The assumption that all traders
    sit on one strike is called a common myth.
  - **ITM strikes carry light volume; OTM strikes carry heavy volume. The two sides mirror each other.**
    From the chain: at 24,600 ≈83,877 trades on the Put side against 578 on the Call side; at 24,650
    ≈44,970 Put vs 208 Call.
  - **OTM strikes carry the WRITING activity.** Institutional money (FIIs, DIIs, mutual funds) writes options
    through algorithms rather than buying calls and puts all day; **their target is a 16–25% ANNUAL return
    through a repeated process.**
  - **For intraday trading only the heaviest-traded strikes matter, because the deep-OTM expiry-focused
    machines are indifferent to intraday movement.**
- **THE SECOND-HIGHEST VOLUME RULE:**
  - **The largest volume on each side is set to 100% and highlighted BLUE; every other strike is a percentage
    of it; the SECOND-HIGHEST is highlighted YELLOW.**
  - **THE CLAIM: the HIGHEST volume is what HOLDS the market at a strike. The SECOND-HIGHEST volume is what
    GUIDES the market's next direction.**
  - **The question to ask is whether the 100% volume is MOVING TOWARD the second-highest strike.
    If yes, the market moves in that direction; if no, it does not.**
  - **The chain labels the movement:** *"shifted from top to bottom"* = the volume moved from a higher strike
    to a lower one = **bearish pressure**. *"WT"* (weak towards top) = **bullish**.
  - **THE PERCENTAGE MATTERS AS MUCH AS THE DIRECTION.** A WTT reading **falling** 96% → 94% → 93% means the
    bullish guidance is **fading** while the downward reading strengthens.
  - **Worked replay:** at 9:15 the 100% volume sat at 25,200 with the market ≈25,119. **The guidance flipped
    downward toward 25,100, the bearish percentage climbed step by step (78, 84, 88, 93, 97, 99), and the
    index fell roughly 50 points alongside it.**
  - **Once the second-highest reaches 100% it BECOMES the highest, the yellow highlight shifts elsewhere, and
    the reading RESTARTS.**
  - **DOWNSIDE IS CAPPED AT THE STRIKE HOLDING THE MARKET. To fall further, the PUT side's second-highest
    volume must ALSO start guiding down.** In the example it did not — it stayed flat, neither bold nor
    highlighted — **and the fall stopped there.**
    → **This is a genuinely important two-sided confirmation rule that is not stated this clearly anywhere else.**
- **Flagged in-source:** presented as the speaker's own discovery, with the claim that no other channel in
  India or internationally teaches it.

---

### VIDEO-94 — Seven Day Challenge announcement (4 min)
**Type:** Promo. **NON-CORE.**

- A free multi-part series; the team travels to cities, meets traders, and invites selected participants to
  the studio; each participant is taught over seven on-camera episodes.
- **Stated syllabus:** stock market, financial markets and mutual funds, from the beginning; **a specific goal
  is for the participant to work out their own RISK PROFILE and TRADING PSYCHOLOGY**, so they can match
  investments to what kind of trader they actually are.
- Selection: **no fee**; register via a form; a spin-the-wheel draw every two or three days; travel,
  accommodation and food paid.

---

### VIDEO-96 — Seven Day Challenge opening episode (5 min)
**Type:** Promo / introduction. **NON-CORE — no market content.**

- The selected participant (Bhabhuta Ram, from Pali district Rajasthan, running a mobile-repair shop in
  Gujarat) is picked up and introduced; the selection rules are restated (Google Form → spin-the-wheel;
  everything paid).
- One line worth keeping as framing: he says he came **to remove his own fear and gain knowledge**, and when
  the host calls it a success he corrects him — **this is only the beginning; what has changed so far is that
  his mind is coming under control.**

---

### VIDEO-97 — Seven Day Challenge Day 1: who should trade at all
**Type:** Conceptual / suitability. **NON-CORE for the calculator, but it is the product's stated audience gate.**

- **THE ELIGIBILITY CHECKLIST** (anyone who cannot answer yes should stop before investing aggressively):
  - Do you have a job or business producing income?
  - **Does anything remain after your expenses?** The surplus is what remains **after income, insurance and
    the children's education are paid for.**
  - Do you already put that surplus somewhere (mutual fund, SIP)?
  - **Do you have health insurance covering the WHOLE FAMILY?** — made the first priority.
  - **Does the earning member have TERM insurance?**
  - **How close are you to retirement age?**
- **Risk ranking of instruments:** FD / RD / post office = low; conservative and arbitrage mutual funds and
  equity-debt mixes = moderate; **direct trading and direct investing = aggressive.**
- **Why a regulated market exists:** a partnership is capped at 50 members; beyond that a private limited
  company; beyond roughly 200 it must list. **A listed company cannot take your money and disappear**, though
  the price can still fall to almost nothing. **Counterparty risk management** — buyer and seller do not know
  each other; the exchange manages the risk; **CDSL and NSDL handle clearing in India and are themselves listed.**
- **Process, not returns:** investing is long term, trading short term; both are a process repeated.
  **The reason to come to the market is a modest step UP in return, not a multiple:** FD gives x → mutual
  funds x+1 → market y+1. Expecting 1000×y is the wrong starting assumption.
- **Two kinds of risk:** **systematic** (from the system itself — flood, tsunami, Covid; unavoidable) and
  **unsystematic** (the risk you created and can manage — e.g. a lifetime's savings entirely in gold).
  **The answer is to split across gold, FDs, aggressive funds, moderate funds and equities.**
  Same for cash: split across four bank accounts, since opening extra accounts costs nothing.
- **Intraday trading does not replace mutual funds, ETFs, gold or deposits.**

---

### VIDEO-98 — Seven Day Challenge Day 3: OI vs volume, market orders, and the S/R rule
**Type:** Theory. **Core — adds the limit-order rule and the colour scheme.**

- **OI AND VOLUME ARE ONLY COMPLETED TRADES:**
  - **Volume is created the moment a trade executes. OI is created when a sold (written) position is executed.**
  - **BID AND ASK QUANTITIES ARE NOT TRADES.** A bid at ₹8.30 and an ask at ₹9.25 with no match creates
    nothing — **no LTP, no volume, no OI.**
  - Worked: the speaker offers **five** lots and the participant buys **one**. **OI is ONE — not five and not six.**
  - **Large bid/ask numbers on a screen are just talk** (the Burj-Khalifa analogy).
  - **Both volume and OI are created by ordinary retail traders. That is why they are worth reading.**
- **EXPIRY AND SQUARING OFF:**
  - **Cash never expires.** A short sale in cash must be bought back the **same day**.
  - **Futures expire on the LAST TUESDAY of the month** and must be squared off then.
  - **Nifty options expire EVERY TUESDAY; the new position is built on Wednesday.
    Bank Nifty, Fin Nifty, Midcap Nifty and STOCK options are squared off on the last Tuesday of the month.**
  - In F&O a position can be **sold before it is bought** and held until expiry.
- **MARKET ORDERS VS LIMIT ORDERS — a hard rule:**
  - **A market order fills at whatever the standing ASK offers, not at the LTP.**
  - Nifty: LTP **39.85** but the market order would fill at **40.70** — about a rupee worse.
  - **A stock option is worse:** an Ambuja Cements put showed an LTP of **₹14.70** while the market order
    filled at **₹16.55** — roughly ₹2 higher, **on a trade whose whole target was about ₹2.**
  - **INSTRUCTION: use LIMIT price for entry, for the target AND for the stop loss.**
- **THE S/R RULE RESTATED:** imaginary line = spot plotted between the two bracketing strikes (spot 890 →
  line between 850 and 900).
  **Resistance:** start from the LOWER strike of the pair on the call side, move outward toward OTM, take
  whichever of highest OI or highest volume sits **closest to the imaginary line**.
  **Support:** start from the UPPER strike on the put side, move outward, same rule.
  Example: highest OI at 25,000, highest volume at 25,100 → **25,000 is nearer the line → an OI-resistance at 25,000.**
- **THE CHAIN'S AI PRINTS SUPPORT AND RESISTANCE AT THE TOP OF THE SCREEN. Once you have the strike, look at
  that row and see WHICH COLUMN READS 100% — that tells you whether the level is built on volume, on OI, or
  on both.**
  **Repeated correction: look at the labels above the chain instead of scanning up and down inside it.**
- **THE COLOUR SCHEME (definitive):** **highest volume in BLUE on both sides; highest PUT OI in GREEN;
  highest CALL OI in PINK; second-highest values highlighted; every value shown as a percentage of the 100% reading.**
- **Underlying principle stated throughout: "the market is never motiveless."** It leaves one level with a
  destination in mind. **The shop is resistance, home is support, and an extra errand two kilometres further
  is an EXTENSION of that level.**

---

### VIDEO-99 — Seven Day Challenge Day 4: the Greeks, and the 9:20 BACKTEST
**Type:** Theory + backtest. **Core — the only quantitative evidence in the corpus, plus the missing-line rule.**

- **WHAT THE GREEKS DO:**
  - **Vega** is volatility — decides how violently the market swings; **changes tick by tick and cannot be
    tracked by eye**, which is the stated reason for using a server.
  - **Theta** eats the premium — "chews through time value like a termite". **This is why a premium can shrink
    by a rupee or two even when the market has not moved, or has moved in your favour.**
  - **Delta and gamma set how far a premium will travel.** Live: with Nifty at 24,779 the 24,800 call was
    ≈₹110–118; the calculator projected **≈₹241 at 25,000, ≈₹28 at 24,600, ≈5 paise at 24,500.**
- **INTRINSIC AND TIME VALUE:**
  - **Call IV = market price − strike. Put IV = strike − market price.**
  - **If the result is negative, intrinsic value is ZERO. It is never negative.** (Spot 24,780, the 24,800
    call computes to −20 → intrinsic value zero.)
  - **Time value is whatever is left after intrinsic value.** A ₹68 premium = ₹13 intrinsic + ₹55 time value.
  - **Deep ITM = mostly intrinsic. Near the money = the two roughly equal. OTM = no intrinsic at all, only
    time value — which is exactly what theta destroys.**
  - **Intrinsic value is what the option will be worth at expiry.** Demonstrated on the 23 September expiry:
    **the screen showed 25,185 at 3:30 PM but the SETTLEMENT price around 4:00 PM was 25,169.** After
    settlement every strike's price equalled its distance from 25,169 and all time value was gone.
    → **The settlement price, not the 3:30 screen price, is what determines expiry value.**
  - **Conclusion: an LTP is not a random number, it is a calculated one.**
- **THE FOUR 9:20 LINES:** the tool watches the Greeks across all strikes during the **first five minutes**
  and plots four lines at about **9:20–9:21**, labelled top-down **EOR+1, EOR, EOS, EOS−1**.
  **Lower two for buying, upper two for selling.** Chart and chain toggle independently.
- **THE MISSING-LINE RULE (stated here as a prohibition):**
  **All four lines must be present for the normal strategy. Four incomplete cases are possible: EOR missing;
  EOR and EOR+1 both missing; EOS missing; or EOS and EOS−1 both missing. He says he has NEVER seen a day
  where BOTH sides were missing.**
  - **If a RESISTANCE-side line is missing: do not buy Puts and do not sell Nifty futures that day** — the
    market has no upside destination fixed, **which reads as BULLISH.**
  - **If a SUPPORT-side line is missing: do not buy Calls.**
  - Example: **1 September**, an upper line absent → the market broke above the top line and ran up all day,
    **and that warning was available at 9:21 AM.**
- **THE BACKTEST (Nifty, 1–25 September, one trade per line, entering only on a touch):**

  | Lines traded | Target / stop | Trades | Win rate | Result |
  |---|---|---|---|---|
  | EOR and EOS only | 10 / 10 | 19 | 26% | **−86 points** |
  | All four | 10 / 10 | — | — | **−70 points** |
  | All four | 20 / 20 | 28 | 50% | **+12 points** |
  | All four | **30 / 20** | 28 | 46% | **+96 points** |
  | All four | 30 / 30 | 28 | 54% | **+93 points** |
  | All four | 50 / 30 | 28 | 36% | worse |

  - **THE CONCLUSION: a 10-point stop was cutting trades that would have turned profitable. WIDENING THE STOP,
    NOT IMPROVING THE ENTRY, is what flipped the month from loss to profit.**
  - **A 46% win rate still produced the best result. The number of winners matters less than the
    target-to-stop ratio.**
  - Walkthrough of 3 September: one trade at 10:05 AM hit target; a second at 1:58 PM hit its 20-point stop.
- **Instructions:** fix the target and stop **before the day starts** and use the **same pair every day**;
  **forward test ONE fixed setting for three to six months** before judging; **Nifty futures trade in lots of
  75**, so points must be multiplied by lot size.
- **Self-correction noted in-source:** he misstates once that vega eats the premium, then corrects himself —
  it is **theta**.

---

### VIDEO-100 — the AI LTP scenario → line-set mapping
**Type:** Theory / product spec. **Core — THE definitive scenario-to-lines table.**

- **Switching on AI LTP draws up to EIGHT labelled lines, four per side:
  S Max Gain, S Risky, S Moderate, S Max Pain | R Max Pain, R Risky, R Moderate, R Max Gain.**
  - **The Max Pain lines are always the OUTERMOST pair. The Max Gain lines sit CLOSEST TO THE CENTRE.**
  - **Roles are fixed: Risky or Moderate = the ENTRY; the Max Pain on that side = the STOP LOSS;
    the Max Gain = the TARGET.**
  - **A MODERATE line gives a TIGHTER stop than a Risky line because it sits NEARER to Max Pain.
    A Risky line offers more movement but more risk.**
  - The tool also prints a scenario name at the top, e.g. "Nifty both side risky COA 8".
- **WHICH SCENARIOS ALLOW WHICH TRADES — the mapping:**

  | Scenario | Lines drawn | Trade permitted |
  |---|---|---|
  | **Slight bullish** | All four **support** lines; only **three** resistance lines (**no R Moderate**) | Bullish trades are in favour of COA 1.0; any bearish trade is **highly risky** |
  | **Slight bearish** | All four **resistance** lines; **S Moderate missing** | Bearish trades are the favoured ones |
  | **Bull run** | **Only the four support lines** | Bullish in favour. A sell can only be attempted from **S Max Gain**, and only if resistance is strong |
  | **Blood bath** | **Only the four resistance lines** | Bearish in favour; a counter-trade from **R Max Gain** requires support to be strong |
  | **Both side risky 8** | **All eight** | Both directions are AGAINST COA 1.0 |
  | **Both side risky 9** | All eight **minus R Moderate and S Moderate** | The riskiest of the set; **the guest says he now avoids trading it entirely** |
  | **Bullish SOC** (1/2/3 hours) | — | **Traded exactly like a BULL RUN** |
  | **Bearish SOC** | — | **Traded exactly like a BLOOD BATH** |

- **READING STRENGTH:** volume or OI shifting towards a **higher** strike → highlighted **yellow**, labelled
  **WTT**. Shifting towards a **lower** strike → **WTB**. **No label = strong** (not trying to move either way).
- **COUNTER-TREND PERMISSION RULE:** **a counter-trend trade is only allowed when the level you are FADING
  shows NO YELLOW.** In the live example the speaker **refuses a sell at S Max Gain because resistance is WTT
  and its percentage is still rising**; resistance then shifts and S Max Gain moves away, confirming the refusal.
- **Live examples:** 1 Sep data = slight bullish; R Risky 25,540 with market ≈25,520; **R Max Pain 25,590 →
  a 40-point stop.** An earlier example: R Moderate 25,125 with stop 25,170 — **≈50 points of risk against a
  100-point target at R Max Gain.** 15 Sep = slight bearish; a put buy at R Risky carried a **50-point target
  and a 100-point stop**; that was **the only trade the whole day, and it reached its target.**
- **OPERATING RULES:**
  - **Trade only in the direction that is in favour of COA 1.0 for the current scenario.**
  - **Wait for price to actually touch a line. If nothing is touched all day, take no trade and do not look
    for a reason.**
  - **Use each line ONCE. If price returns to the same line later the same day, do not re-enter there.**
  - **Exit at your stated value. Do not book 5 or 10 points early because the target looks close.**
  - **If the scenario changes while you hold a position, re-check the NEW scenario's table and decide from
    that, not from the old one.**
  - Keep a printed copy of the scenario chart at your screen (a PDF is promised).
- **Flagged in-source:** the instruction "keep your mind aside, the AI is using its mind" removes discretion
  **but also removes any independent check on the tool.**

---

### VIDEO-101 — three positional stock methods + mutual-fund allocation
**Type:** Method summary. **Core for the monthly-range and swing paths.**

- **TRADING THE MONTHLY RANGE:**
  - In the stocks section, **M** draws the monthly range: three lines above and three below. **Nearest = L1.**
    **Probabilities attributed: ~65% at L1, 95% at L2, 99% at L3 that price reverses there.**
  - **Trade the EXTREMES only: sell futures or write calls at a resistance line; buy cash or futures at a
    support line.**
  - **TIMING RULE: the position must be opened in the FIRST 15 DAYS of the month — about the first 11 of the
    22 trading days. A stock that only reaches L1 on the 26th is LEFT ALONE because too little of the month
    remains.**
  - **If price runs PAST L1 to L2, AVERAGE into the position, since L2 carries the higher reversal probability.**
  - Examples: GAIL sold at L1 ≈179 fell to 173 (≈4%). ITC sold ≈420 fell to 398 (≈3%).
    **Divi's Laboratories made a low of 5,903 against an L1 of 5,835 → the level was never touched and NO
    TRADE EXISTED.**
  - **The stated ambition is modest — a 1% to 2.5% move is treated as a full target.**
- **THE LTP SWING SCREENER (restated):** Reports → LTP Swing; bullish and bearish listed separately.
  - **Long:** bullish + shifting status **Strong or WTT** + **star rating 0 or 1**.
    Examples: Concor at 524.8, target 564 (~40 points); another name at 648 with entry 638 and target 703.
  - **THE STOP LOSS IS NOT A PRICE. You exit when the open-interest shift FLIPS — WTT becoming WTB kills a
    long, and Strong becoming WTT kills a short. YOU EXIT ON THAT FLIP EVEN IF THE POSITION IS CURRENTLY IN
    PROFIT.**
  - **Short:** status **Strong or WTB**, reverse the logic. ONGC: sell at 240, target 234.
  - **Same 15-day rule: open these positions in the first half of the month.**
- **CASH-FUTURES ARBITRAGE:**
  - **Open in the first two or three days of the month: SELL one futures lot and SIMULTANEOUSLY BUY the
    identical share quantity in cash.**
  - Example: Aditya Birla Capital, spot 278, futures 280, lot 3,100 → sell one lot of futures, buy 3,100 shares.
  - **Close both legs when spot and futures converge, which happens naturally as the month ends.**
  - **The tool shows an expected profit figure per stock.** Opened at the start of the month one example showed
    ≈**₹6,200**; the same trade near month end showed ≈**₹78**, because the gap had already closed.
  - **Index contracts are EXCLUDED — individual stocks only.**
  - **Flagged:** called a no-loss strategy, but **returns are low, brokerage eats into them, and the capital
    required is large.**
- **NON-CORE:** mutual-fund allocation by age (fully aggressive in the twenties → ~50/50 in the forties and
  fifties → lower past 55), one fund per goal sized by how soon the money is needed, spread across AMCs.
  Ends in a direct pitch to open an NJ account.

---

### VIDEO-102 — what a scalper needs from a terminal (Sahi app review)
**Type:** Product review of a third-party terminal. **NON-CORE for our logic; useful as UX requirements.**

- **What scalping demands:** the same setup repeatedly inside one session, targets and stops ≈5–10 points each
  time; sustained concentration; **slippage is the recurring problem, so the terminal's slippage percentage
  matters more here than in any other style.**
- **Terminal features highlighted (a usable UX checklist):** scalper mode with two charts side by side and
  buy/sell buttons on the charts; **Set defaults** storing a trade quantity per instrument; preset auto stop
  loss and target in points with a trailing option; **one-click buy/sell** firing quantity + stop + target in
  a single press; selecting Nifty auto-loads the ATM call, one click switches to the put; layouts with index
  spot, call chart, put chart and option chain on one screen, resizable independently; **notification sound**
  on execution/target/stop; a **kill switch** disabling trading in a segment for the rest of the day
  (framed as a psychological tool for when a scalper develops a one-directional bias);
  an **OI resistance / OI support indicator** plotting the highest call and put OI directly on the spot chart.
- **Its built-in AI panel** prints a plain-language read: sideways trend, sideways breadth, OI PCR ≈0.68–0.69,
  MACD (8,17,6) below signal = bearish, RSI 35 = weak momentum, breadth 24 advances vs 26 declines,
  price support 25,695 / resistance 25,768. **Flagged in-source as a plain-language summary of standard
  indicators, not a prediction — a time saver rather than an edge.**
- **Brokerage as the scalper's raw-material cost:** high trade count makes brokerage the largest cost;
  the offer described is zero brokerage for 30 days then ₹10 per order against a ₹20 benchmark.

---

### VIDEO-103 — Learn Trading Day 2: diversification, spot vs futures, Gift Nifty, arbitrage
**Type:** Beginner theory. **Mostly NON-CORE; three items are worth keeping.**

- **Diversification's cost stated honestly:** everything in one winner may go 10×, while a five-way split
  averages perhaps 5×. **The protection matters in the other case: one bad stock out of five still leaves you
  positive; one bad stock out of one does not.** Jet Airways and Reliance's old telecom business cited.
- **Spot vs futures:** the Nifty index itself cannot be bought — exposure via **Nifty futures, lot size 75**.
  **Spot:** hold indefinitely, shares delivered; sell-before-buy must be closed the same day.
  **Futures:** a contract, no share delivery, fixed lots, **three monthly contracts trade at once, each
  expiring on the last Tuesday of its month.**
  **The futures price is the market's view of the price ON THE EXPIRY DATE, not today's price.**
  **LTP = Last Traded Price — the origin of the tool's name.**
- **Short selling explained with the pen-seller analogy** (credit stock must be returned before 3:30).
- **GIFT NIFTY as an opening clue:** trades ~23 hours a day, meant for foreign traders in GIFT City.
  **Its overnight direction hints at how the Indian market opens — gap up, gap down or flat.**
  Example: Nifty closed Friday 25,797 while Gift Nifty was ≈25,877 at 3:30 and still ≈25,865 hours later →
  **no meaningful gap expected.**
  *(Note: VIDEO-121 says he deliberately IGNORES Gift Nifty. → Open Question 32.)*
- **CASH-FUTURES ARBITRAGE:** buy the shares in spot and sell the same quantity — one full lot — in futures,
  then hold both. **Spot and futures must converge by expiry, so whatever the stock does in between, the gap
  you locked in is yours.**
  **Path: menu → Reports → LTP ARBITRAGE STOCKS, which filters the list by the size of the spot–futures gap.**
  Live example: SBI Card spot 928 vs futures 937 — a ≈₹10 gap with two days to expiry → ≈₹7,100 on a
  deployment of ≈₹8.7 lakh. Smaller gaps in RBL Bank (≈₹2) and PNB Housing (≈₹6).
  **He notes the SBI Card gap was unusual and probably caused by a large trade hitting the market away from
  the prevailing price.**
  **Limitations stated: the gaps are usually tiny, they cannot be found by manual searching, and the strategy
  needs substantial capital because both legs must be funded.**

---

### VIDEO-104 — unbalanced IV: when the premium and the future both stop following spot
**Type:** Short replay. **Core — gives a concrete "do not trade" test.**

- **THE CALL PREMIUM THAT DID NOT FOLLOW:** 9:29 — spot ≈25,792, the 25,750 call ≈₹214–215, **IV ≈13**.
  Spot then rose **53 points** to 25,845.
  **For an in-the-money call the premium should have gained roughly 25–30 points on that move. It gained
  only 14.**
- **THE FUTURES PRICE THAT DID NOT FOLLOW EITHER:** 9:29 spot 25,795 / futures 25,922 → **gap 127 points.**
  9:45 spot 25,843 / futures 25,939 → **gap narrowed to 96 points.**
  **Spot gained ≈51 points; futures gained only 17. The futures contract absorbed the move by CLOSING ITS
  OWN PREMIUM TO SPOT rather than rising with it.**
- **WHAT THE SPEAKER SAYS THIS MEANS:** when IV is swinging and is **unbalanced between the call side and the
  put side**, the market becomes risky to trade. **Effects listed: option premiums refuse to expand; futures
  stop tracking spot; REVERSAL PRICE LEVELS SHIFT; and a correctly judged direction still loses money.**
- **THE SETTLED CONDITION — a usable numeric test:
  implied volatility on the call side and the put side within about ONE POINT of each other.**
- **Instructions:** compare call-side and put-side IV before trading; **treat a wide or swinging gap as a
  reason to stay out rather than as noise**; watch the spot-to-futures difference during the session —
  **a narrowing gap means the futures leg will not deliver the move that spot is making.**
- **Flagged in-source:** the causal link is asserted from a single morning; time decay, the starting premium
  level and the specific strike all affect the same outcome and are not separated out.
