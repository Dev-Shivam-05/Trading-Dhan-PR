# Per-file analysis — Part D: VIDEO-105 → VIDEO-132

This is the most recent and, in places, the most precise block. It contains the formal
**five-state / pressure** model (V108), the **Game of Percentage** with its inversion rule (V109),
the **live six-line** reading and the constraint on COA 2.0 (V110), the season-three re-teaching of
support/resistance and the nine scenarios (V111–V112, V114), **expiry-day** methods (V118, V119),
the **reversal-price-gap** rule (V126), and the indicator critiques (V113, V115, V124, V125).

---

### VIDEO-105 — volume vs OI for deciding whether a level holds; options as insurance
**Type:** Theory + live. **Core — restates the level rules and adds the "cheap premium is riskier" rule.**

- **WHERE S/R ACTUALLY COME FROM:** they are the market's current boundaries, set by the traders in it.
  They are **demand and supply**. **On the chain, volume and OI are where that demand shows up:
  OI is what WRITERS are ASKING for; VOLUME is what intraday traders are actually EXECUTING.
  A level only becomes real when the EXECUTION agrees with the WRITING.**
  Pen analogy: you can offer to sell a pen for ₹1 lakh, but it is not worth ₹1 lakh until somebody buys it there.
- **IN THE LIVE EXAMPLE HE TRADES THE VOLUME LEVELS, NOT THE OI LEVELS:** highest call volume 25,900 and
  highest put volume 25,800, while the highest OI was far away at 26,000 and 25,500.
  **Stated reason: volume is where intraday participants are committing.**
- **READING THE HIGHLIGHTED PERCENTAGES:**
  - **The tool highlights a strike once the shift pressure reaches about 75%. Below that the number is shown
    but not highlighted.**
  - **The DIRECTION of the highlight tells you which way a level is trying to move.**
    When **both** the call side and the put side pushed towards **higher** strikes, the label changed
    **slight bullish → bull run.**
    When **only one side** was shifting up, the market stayed merely **bullish**.
    When **the call-side percentage started FALLING while the put side ROSE**, the label changed to
    **both side risky.**
  - **Practical read:** if resistance at 25,900 is shifting **up** and support at 25,800 is **also** shifting
    up, **a short here loses.** **If the resistance percentage is FALLING while you are LONG, that is the
    exit signal.**
  - **Claim:** watching which side the highlights move is enough — you do not need to have learned support
    and resistance separately.
- **WHY EVERY CALL BUYER IS BUILDING RESISTANCE:** a call writer and a call buyer are complementary;
  **the writer's level does not exist until a buyer pays for it. So buying calls at a level adds another
  brick to the resistance there, regardless of what the buyer wants.**
  **Conclusion: buy CALLS near the BOTTOM of the range (resistance far above) and PUTS near the TOP.
  Buying calls after the market has already run up simply strengthens the level it will reverse from.**
  In the example the buy level was **S Risky at 25,760 — the reversal price for the 25,850 strike where
  ≈4 lakh of volume had built up.**
- **TWO WAYS TO TRADE:**
  - **With the direction** — the default, supported by the scenario label.
  - **Against the direction** — **allowed ONLY when the level you are fading is NOT trying to extend.
    If resistance percentages are still climbing, a put bought there will lose even though the level looks
    like the top.**
  - **Whichever side you take, the exit is defined in advance: leave the moment the percentage moves against
    your position.**
- **OPTIONS AS INSURANCE, NOT AS A CHEAP ENTRY:**
  - **The common advice is REVERSED here: options are called the instrument for people with the MOST money,
    because the risk is largest.** Buying an option with no underlying position is like buying car insurance
    when you own no car.
  - **The stated purpose is to protect an existing cash or futures position.** Example: short SBI futures at
    913 fearing a rise to 923; **buying the 915 call for ₹5** means that if SBI expires at 925 the call is
    worth ₹10 against a ₹12 futures loss → **net loss ≈₹3 instead of ₹12.**
- **INTRINSIC VALUE AND THE "CHEAP PREMIUM IS DANGEROUS" RULE:**
  - On expiry day only intrinsic value survives. Demonstrated on a Nifty expiry closing ≈25,850 with an
    **adjusted price of 25,843**: the 25,800 call ≈₹43, 25,750 ≈₹93, 25,700 ≈₹143 — **each 50-point step
    adding 50 to the premium. Every strike above the close was zero.**
  - **The hedging example — Cholamandalam bought ≈1,760:**
    - **Buying the 1,760 put for ≈₹13 caps the worst case at ₹13**, because the put gains rupee for rupee as
      the stock falls.
    - **Buying the CHEAPER 1,740 put for ₹5 instead does NOT cap the loss until the stock has already fallen
      20 points, so the worst case becomes ≈₹25 — nearly DOUBLE, for a premium that looked a third of the price.**
  - **THE RULE: the cheaper the premium you buy, the LARGER the risk you are actually carrying.**
  - **"Naked buying" = buying premium with no underlying position and no idea of the intrinsic value you are
    betting against.** Treated as the main way retail option buyers lose.
- **Instruction:** when hedging, **evaluate the WORST case rather than the profit case**, and prefer a
  premium near the money over a cheap far one.

---

### VIDEO-106 — the four LIVE lines on stocks, and the 1% monthly-range hedge
**Type:** Method. **Core — completes the stock path and gives the PV definition.**

- **WHY STOCK SELECTION MATTERS MORE THAN IN THE INDEX:** Nifty is a blend of 50 stocks so no single
  participant moves it easily; **an individual stock with thin volume drifts on its own — he calls it
  automatic manipulation, not deliberate.**
  **So LIQUIDITY IS A FILTER: strikes showing volumes of 20, 30 or 80 contracts are stocks to avoid entirely.**
- **THE FOUR LIVE LINES:** switching to **Live** draws **P2 and P1 above (sell side), C1 and C2 below (buy side).**
  **Generated at 9:25, AFTER THE FIRST TWO CANDLES. Before that there is nothing to trade.**
  **Each line carries three values: the ENTRY price, MAX PAIN (stop loss) and MAX GAIN (target).**
  **Computed from Greeks, volume and open interest — no trendlines, no candlestick patterns, no timeframe switching.**
- **PV (POINT VALUE), shown at the top, IS THE EXPECTED MOVE, CALCULATED AS HALF THE GAP BETWEEN TWO STRIKE
  PRICES.** A ₹20 strike gap gives **PV of ₹10.**
  → **This is a concrete, implementable formula and it appears nowhere else in the corpus.**
- **THE RULES THAT GOVERN WHICH TRADE YOU TAKE:**
  1. **P1 and C1 are a pair — if one fires, the other is not traded that day.**
  2. **If P2 or C2 fires, NO FURTHER TRADE is taken in that stock for the rest of the day.**
  3. **A trade that completed INSIDE THE FIRST CANDLE, before the 9:25 lines existed, is DISCARDED.
     You cannot claim a trade you could not have seen.**
  4. **Bullish risk and bearish risk are scored automatically from 0 to 10. Trade only when the relevant risk
     is 0 or 1; skip 2 and above. When BOTH P2 and C2 are available, take the side with the LOWER risk score.**
  5. **If only THREE lines appear instead of four, two values have COINCIDED and that stock is skipped for the day.**
     → *This explains the "missing line" condition mechanically: coincident values, not absent data.*
  6. **A risk score of 1 means the position may sit in loss close to the stop loss for a long time before the
     target arrives. The instruction is to WAIT rather than panic out.**
- **Worked examples:**
  - **TCS** — P1 entry 3,073 / stop 3,085 / target 3,063. Low 3,061, high 3,074 → target reached and stop never
    touched — **but this happened in the first candle, so the trade is DISCARDED.** The later **P2 at 3,092.55**
    (target 3,082.60, stop 3,104) had high 3,093.90 and low 3,079 → **that one paid.**
  - **Titan** — P1 target 3,716 against stop 3,738; the high missed the stop by ≈3 points and the target was
    made. A later P2 had its stop at 3,753.60 against a high of 3,753 — **saved by fractions, because the risk
    score was 1 rather than 0.**
  - **Zydus** — would have hit its stop. **Not every trade wins; the process is followed regardless.**
- **FINDING THE TRADES — LTP BLAST:** menu → Reports → LTP Blast. Lists, **live and auto-refreshing**, every
  stock currently sitting on P1, C1, P2 or C2, with its bullish and bearish risk scores.
  **In the first hour of the session he expects two to five usable trades to appear.**
- **EXECUTING IN CASH:** no lot size, no expiry; choose the share count that fits your capital; delivered
  shares sit in your demat indefinitely. **Use a LIMIT order.** Margin is displayed before the order
  (100 TCS shares showed ≈₹47,000–₹76,000 depending on broker).
- **THE MONTHLY-RANGE TRADE WITH INSURANCE:**
  - **When a stock reaches L1 of its monthly range, take the positional trade: SELL at the resistance-side L1,
    BUY at the support-side L1. Carry for about a month.**
  - **Unlike arbitrage this trade CAN lose, so it is insured by buying an option premium against it.**
  - **SBI example:** L1 ≈905, touched 20 October ≈10:45. **Sell futures at 905 and buy the 905 call for ₹8.**
    - SBI rises to 918 → futures lose ≈13 while the call gains ≈4.
    - Expires at 950 → futures lose 45 but the call is worth ≈45.
    - Falls to 900 or 890 → the call expires worthless and **the ₹8 premium is the only cost**, with the rest
      of the fall kept as profit.
  - **THE RULE: when you sell futures and buy the AT-THE-MONEY premium as cover, your maximum loss is that
    premium. Nothing beyond it.**
  - **THE 1% FILTER: look for a stock where the ATM premium is around 1% of the price. Then the worst case on
    the whole structure is 1%. If the ATM premium costs more than 1%, he prefers not to trade that stock.**
    → *Compare VIDEO-79/91's "5–7% of the expected move" — a different denominator. See Open Question 27.*
- **Flagged in-source:** two of the shown examples avoided their stop by less than a point; the video treats
  these as wins, but they equally demonstrate how fine the margin is at risk score 1.

---

### VIDEO-107 — volume/OI, where volatility comes from, strike depth, and one way to trade the 9:20 lines
**Type:** Theory. **Core — the densest single file on IV and strike selection.**

- **VOLUME VS OI, the cleanest chain:** someone writes 50 lots and a buyer takes them → **volume 50, OI 50.**
  That buyer sells to a second buyer → **volume 100, OI still 50**, because the position was only transferred.
  **Only a genuinely new WRITE adds to OI. OI falls only when the original writer buys back.**
  **Volume is INTRADAY and starts from zero each morning. OI is POSITIONAL and carries forward.
  Because of this, volume is always the larger number.**
- **WHERE VOLATILITY COMES FROM:** **the gap between spot and futures.** Example: Nifty spot 25,966 vs futures
  26,040 — a 70-point gap. **The wider that gap, the more volatile the instrument. On expiry day the two
  prices become equal, which is why the contract stops moving after expiry. That gap is what produces implied
  volatility.**
- **READING IMPLIED VOLATILITY:**
  - Compare call-side and put-side IV near the ATM strike. In the example **11.73 and 11.55 — close enough
    that IV would not interfere.**
  - **TWO WARNING CONDITIONS: (a) a LARGE DIFFERENCE between the call side and the put side, or (b) a LARGE
    MOVE in IV across the day** (starting at 11.73 and reaching 14, 15 or 16).
  - **When IV swings like this: price-action patterns break, indicator-based trades that were working suddenly
    fail, and stop losses are hit on setups that looked identical to earlier winners.**
  - **Named high-volatility events: 4 June 2024 (election results), budget days, major data announcements.**
  - **VERY LOW IV — readings of 4, 5, 6 or 7 sustained for ten to fifteen days — signals a CONSOLIDATION
    PHASE: range-bound, no gap ups or downs. A jump from 4–6 up to 8–10 marks the END of that phase.**
  - **Habit: note the IV each morning and check it a few times during the day.**
- **WHY A CHEAP OTM STRIKE PAYS LESS:**
  - **The Greeks price the premium: delta = how much the premium moves for a move in the underlying;
    gamma = how fast delta changes; theta = time value decay; vega = volatility.
    The full calculation is BLACK-SCHOLES.** ← *the only explicit naming of the pricing model in the corpus.*
  - **The tool has a PREMIUM PROJECTOR: enter the spot value you expect and it returns what the premium will
    be there.** With spot 25,966, a move to 26,000 (34 points) took one call premium from ≈119 to ≈138.
  - **Running the same 50-POINT move across strikes shows a clear fall-off:** an ITM/ATM call captured
    **≈30 of the 50 points**, one strike further out **≈26**, further out again **≈20**, then **≈15**.
  - **The missing points go into REDUCING THE PUT-SIDE PREMIUM. A deep ITM call captured ≈36 points of a
    50-point move while the put side lost only ≈14.**
  - **CONCLUSION: for INTRADAY INDEX trading, choose DEEP IN-THE-MONEY strikes for maximum movement per point.**
    Traders who exit at 10 points get there faster. **Costs: a more expensive premium, more capital, more risk.**
  - **IN STOCKS, STAY AT THE MONEY. Low volatility in individual stocks makes deep ITM strikes a trap.**
  - *Flagged in-source: the "missing points go to the put side" framing is a useful intuition but is not how
    option pricing is formally defined; the real cause is delta and gamma.*
  - *Note this CONFLICTS with VIDEO-19's "second strike in from the line on the ITM side". → Open Question 9.*
- **THE 9:20 LINES — a 1:1 method:**
  - Four lines at 9:20, **two resistances above and two supports below.**
  - **If one or both UPPER lines are missing, do not buy PUTS that day. If one or both LOWER lines are
    missing, do not buy CALLS. The line has to exist for the trade to exist.**
  - **The method taught here: every time price hits one of the four lines, take the trade with an EQUAL stop
    loss and target — for instance 15 points each way, a 1:1 structure.** The example line at 25,882 against a
    low of 25,867 delivered roughly its 15 points.
  - **His own preferred approach is DIFFERENT: average into the position at the second line and place the stop
    loss ABOVE THE NEXT DIVERGENCE.** He says the method should be adapted to the day's scenario — bull run,
    blood bath or both-side-risky each call for different handling.
  - **BACKTEST YOUR OWN POINT VALUE rather than adopting 15 because he said it: try 10/10, 20/20, 20/10.**
  - **One observation offered: on the rare day when every stop loss in the market is hit, the DIVERGENCE trade
    ABOVE the 9:20 lines is the one that works. Such a day may come once in one to two months.**
- **PRE-CALCULATING YOUR ENTRY PREMIUM:** decide the spot level at which you intend to enter, then use the
  premium projector to see what the option will cost there.
  Example: intending to buy a call when Nifty reaches **25,824**, the projector showed the premium would be
  **≈₹156 against ₹196 currently → place a limit bid at ₹156** and the entry fills automatically.
- **WRITING PREMIUM AROUND THE 9:20 LINES (a rolling strangle):**
  - **Sell premium on both sides, ONE STRIKE BEYOND the upper and lower levels, and profit as both decay.**
  - **When the market runs one way, ROLL THE WINNING SIDE INWARDS: buy back the far call you sold and write a
    nearer one, adding pressure in the direction the market is already moving. LEAVE THE LOSING SIDE ALONE.**
  - **Worked:** sold a call ≈61 and a put ≈43 in the morning. The market fell to 25,824; the call dropped to 37
    for a **24-point gain** while the put rose to 63 for a **20-point loss** → **net ≈4 points.**
    A second call was then written at a closer strike, adding a few more points as the fall continued.
  - **Described as a CONTINUOUS position rather than scalping, since nothing is squared off between adjustments.**

---

### VIDEO-108 — THE FIVE STATES AND THEIR PRESSURE, plus divergence scalping
**Type:** Theory. **Core — this is the single most important file for implementing the state machine.**

- **THE FIVE STATES OF A LEVEL. Each level — resistance or support — is classified into one of five
  conditions, and each carries a DIRECTIONAL PRESSURE:**

  | State | What happened | Pressure |
  |---|---|---|
  | **Stable Strong** | Opened at a strike and stayed there all session | **Neutral** |
  | **WTT to Strong** | Tried to move to a HIGHER strike, then abandoned the attempt and returned | **BEARISH** |
  | **WTB to Strong** | Tried to move to a LOWER strike, then abandoned it and returned | **BULLISH** |
  | **Shifted Bottom to Top** | COMPLETED the move to a higher strike and became strong there | **BULLISH** |
  | **Shifted Top to Bottom** | COMPLETED the move to a lower strike and became strong there | **BEARISH** |

- **THE LOGIC:** **a level that ATTEMPTS a move and then GIVES IT UP produces pressure in the OPPOSITE
  direction. A level that COMPLETES the move produces pressure IN the direction it went.**
  → **This resolves the "WTT is bullish / WTT can be bearish" confusion flagged in VIDEO-75 and VIDEO-112.**
- **"Weak towards" is measured by percentage. A neighbouring strike crossing about 75% is highlighted yellow
  and marks the attempted shift. Below 75% the level is treated as STRONG.**
- **The same five states apply to support and to resistance INDEPENDENTLY.**
- **HOW THE SCENARIOS ARE BUILT:** **the scenario label at the top of the screen — bull run, blood bath,
  both side risky COA 8, and so on — is the COMBINATION of the SUPPORT's pressure and the RESISTANCE's pressure.**
  COA 1.0 defines **nine** such scenarios; **the underlying combinations run into thousands, all of which
  collapse into those nine.**
- **HIS ADVICE TO PEOPLE WHO ASK HIM TO ENUMERATE EVERY SCENARIO: don't.
  READ THE PRESSURE ON EACH SIDE rather than memorising the outcomes. The pressure is what the label is
  derived from, and it updates continuously.**
  → **This is the correct architectural instruction: implement the PRESSURE function, then derive the label.**
- **Development note:** he describes developing the framework manually over three to four years before
  training software to produce the label automatically.
- **Simple application:** resistance strong + support generating **bullish** pressure → **buy calls only** that day.
  Support generating **bearish** pressure → **buy puts only.**
- **TRADING A BLOOD BATH:**
  - AI LTP drew **only resistance lines — R Moderate, R Risky and the Max Pain stop — with no support lines
    at all. No support lines means no call trades that day.**
  - **WHERE YOU ENTER DECIDES YOUR RISK.** Selling at the current price, far from Max Pain, would have meant a
    stop of roughly **1,170 points**. Waiting for price to come within a few points of Max Pain would have
    meant a stop of **five points**.
  - **THE TRADE-OFF STATED PLAINLY: the tighter the stop, the safer the trade, the RARER it is, and the lower
    the total return. A setup that only triggers once in 10 to 25 days cannot produce much. A loose stop
    triggers constantly but loses more often.**
  - **Mindset asked for: think about HOW OFTEN a particular trade will actually be executed, not how many
    points it might make.**
- **THE DIVERGENCE SCALPING METHOD:**
  - **Turn on "Set D" and select D1 to draw the divergence lines. These are DOTTED and they MOVE as the market
    moves.** *(Contrast the 9:20 lines, which are static.)*
  - **Each time price touches a divergence line, take the trade with an EQUAL stop loss and target — 10/10,
    15/15, 20/20.**
  - **KEEP THE SAME SIZE ALL DAY.** If you start the morning with 10 points, stay on 10 points.
  - **MAXIMUM 25 POINTS, and NEVER more than the gap between two strike prices.** Stretching past that turns
    seven, eight or nine trades out of ten into losses, because the move simply is not there.
  - **Do not re-trade a line that has already given its result.**
  - **When the scenario flips — e.g. both-side-risky → bull run — stop taking trades on the side the scenario
    no longer supports and wait for a line on the other side.**
  - Replay: takes a put at a divergence, exits 10 points later at target; the scenario turns to bull run;
    he waits for the call-side line and takes a long with a 10-point stop and a 10-point target, which also pays.
  - **Called "diversion-to-diversion" trading, and treated as SCALPING.
    For a larger trade than this, he directs you back to the AI LTP lines.**

---

### VIDEO-109 — THE GAME OF PERCENTAGE, and the post-shift INVERSION
**Type:** Theory. **Core — the single most important file on how to interpret the percentage.**

- **WHAT THE PERCENTAGE IS:** every strike near support or resistance carries a percentage figure.
  **It measures how strongly volume or OI is pulling that level towards a NEIGHBOURING strike.**
  **The direction is labelled WTB (pulling to a lower strike) or WTT (pulling to a higher strike).**
- **THE INTERPRETATION DEPENDS ON THE LABEL, NOT ON THE NUMBER ALONE:**

  | Level state | Percentage RISING | Percentage FALLING |
  |---|---|---|
  | Resistance in **WTB** | Drags the market **down** | Lets the market **rise** |
  | Resistance in **WTT** | **Lifts** the market | **Weakens** it |
  | **Both sides' percentages falling** | — | Reading is **BULLISH** |

- **⚠ THE CRITICAL POINT — THE INVERSION:**
  **Once a level COMPLETES its shift and settles at the new strike, the reaction INVERTS.
  The SAME rising percentage that was BULLISH before the shift becomes BEARISH after it.**
  This was the guest's main misunderstanding and the speaker spends much of the episode correcting it.
  → **Implementation consequence: the percentage cannot be interpreted without knowing whether a shift has
    completed. The state machine must carry that flag.**
- **WATCH ALL FOUR NUMBERS:** there are **four** figures to track — the pulling percentages on the call side
  and the put side, **in both directions.**
  **The trap:** you watch one number falling and conclude bullish, while **a lower strike on the same side is
  quietly climbing and will pull the market down. The tool BOLDS these so they are not missed.**
  **When percentages on OPPOSITE sides both rise, a tug of war results** — the market either goes nowhere or
  follows whichever side is stronger.
- **HOW THE PERCENTAGE IS ACTUALLY USED — a precise scope statement:**
  - **IT DOES NOT GENERATE ENTRIES.** Entries still come from your value — a divergence, R Moderate, R Risky,
    S Risky.
  - **Its job is to tell you HOW MUCH CONFIDENCE to place in a trade before taking it, and HOW LONG TO STAY IN
    IT afterwards.**
  - Example: a bearish trade taken at R Moderate on the expectation the percentage would fall; **instead it
    climbed to 100% and held there → the position is EXITED even though it is flat.**
  - Another: with a rising percentage fighting the setup, he **declines an R Risky sell until the number falls
    back to ≈76**, at which point he considers the trade acceptable.
  - **Red candles inside a bullish phase are not a reason to worry while the percentage is still falling.**
    His phrasing: the candles are not people, they have no desires — they form because divergences have to be covered.
- **WHERE THE SCENARIO OVERRULES THE PERCENTAGE:**
  - **The scenario label still governs the DIRECTION.** In a bearish SOC the rule remains to sell at R Risky
    regardless of the percentages.
  - **BUT THE SCENARIO HAS A LIFESPAN.** A bearish SOC exists because support or resistance is unsettled across
    two strikes. **Once the level completes its shift and becomes strong at one strike, the scenario ENDS and
    the trade is no longer valid.**
  - **So before taking the R Risky sell, CHECK THAT THE PERCENTAGE HAS NOT RUN UP TOWARDS 100 ON THE WAY THERE.
    If it has, the scenario is about to expire and the trade is SKIPPED.**
  - **When no percentage anywhere is pulling, pure theory applies — the reversal levels work as published,
    with nothing distorting them.**
- **SETTING THE TARGET:**
  - **The target is the MAX GAIN line: S Max Gain when trading up from support, R Max Gain when trading down
    from resistance. Hold until that line and exit there.**
  - **If S Risky and S Max Gain print at the SAME PLACE, there is NO TRADE, even in a bull run — the entry and
    the target coincide.**
  - **When the market runs ABOVE EVERY LINE on the screen, it is OUTSIDE THE TOOL'S TRADEABLE RANGE and
    nothing should be taken.**
  - **Max Gain levels are RECREATED as the market moves.** As resistance shifted higher through the session,
    new and higher Max Gain targets appeared behind it.
  - **Two workable approaches: wait for the Max Gain line, or set your own fixed point target and stop loss.**
- **Summary of the exit rules stated here:** exit when the percentage that justified the trade moves the wrong
  way, **even at breakeven**; ignore two or four contrary candles while the percentage still supports the
  position; check a scenario is not about to expire before entering on its rule.

---

### VIDEO-110 — a full live session: the six lines, grey lines, and the limits of COA 2.0
**Type:** Live session, RBI policy day. **Core — the clearest statement of where each AI line comes from.**

- **Opening state:** at 9:18 the headline verdict was **"Nifty slightly bullish"**, and that verdict is built
  from **two inputs only: what RESISTANCE is doing and what SUPPORT is doing.**
  - **Resistance "weak towards top":** the largest call volume was sliding from 26,000 up to 26,100.
    **Call writers were abandoning the lower strike because they no longer believed it would hold, which hands
    the market roughly 100 extra points of room.**
  - **Support "stable strong" at 26,000, neutral all morning — neither pushing the market up nor down.**
  - **A label like "weak towards top" only appears once the competing strike reaches about 75% of the leading
    one. Readings of 53%, 63% or 64% mean no real contest, so the level is just "strong".**
  - **A bull run is scenario SEVEN and needs BOTH sides bullish.** With one side stable-and-strong, a bull run
    was ruled out early.
- **THE SIX LINES AND THEIR PROVENANCE (the most valuable paragraph in this file):**
  - Above price: **R Moderate, R Risky, R Max Gain.** Below price: **S Risky, S Moderate, S Max Pain.**
  - **Each is the REVERSAL PRICE OF A SPECIFIC STRIKE, not a round number.**
  - **S Risky comes from the strike where support is WEAK-TOWARDS-TOP.**
  - **S Moderate comes from the SUPPORT STRIKE ITSELF.**
  - **S Max Pain comes from TWO STRIKES BELOW support.**
  - **Below S Max Pain, close up for the day — no stop loss belongs beyond it.**
  - **THE PROFIT-TARGET LINE ONLY APPEARS ONCE PRICE ACTUALLY REACHES THE ENTRY LEVEL**, so an empty target
    field simply means price has not arrived yet.
- **GREY LINES:** **a grey line is HISTORY.** It was justified when resistance sat at 26,000 and will matter
  again only if 100% volume returns there. **It disappears on refresh, because only your own device remembers it.**
- **CHART OF ACCURACY 2.0 AND ITS HARD LIMIT:**
  - Open the OI-change graph on a strike → two lines, **GREEN = call side, RED = put side.**
    **Green on top with red falling is BEARISH; red rising above green is BULLISH.**
  - At 26,050 the two lines ran **parallel** for most of the morning, **which is why price kept hitting that
    level and reversing rather than breaking out.**
  - **⚠ CRUCIALLY: 2.0 is USELESS AT THE SUPPORT OR RESISTANCE STRIKE ITSELF.** There the call and put OI
    differ by an order of magnitude, and a few thousand new contracts cannot move a position that large
    (the "two-foot child pushing a six-foot man" image).
    **Use it ONLY at INTERMEDIATE strikes where call and put OI are roughly COMPARABLE.**
    Later in the day 26,150 became comparable, and only then was it worth reading.
    → **This is a necessary precondition that VIDEO-31 does not state.**
- **TRADING AROUND A SCHEDULED EVENT:**
  - Before the announcement he wrote **three ranges** from the lines: ≈**350 points wide (Max Pain to Max Pain)**,
    ≈**250 points (R Risky to S Moderate)** and ≈**150 points (Max Gain to Max Gain)**.
    **The 150-point band was the one he told viewers to note.**
  - **During a policy or data release, treat everything EXCEPT the range as suspended. Order flow, not
    structure, is breaking levels in those minutes.**
- **OPERATING RULES STATED:**
  - **Decide the market's DIRECTION first, then decide where to buy. Never pick a price first and rationalise
    a direction for it.**
  - **Do not take a trade against the COA 1.0 verdict, even when a reversal looks certain.** On a "slightly
    bullish" day, no bearish trade — **accept two trades a month if that is what it comes to.**
  - **Do not buy the moment a bull run appears. Wait for price to fall back to S Risky or S Moderate** — on
    that day ~100 and ~180 points below the current price.
  - **Read a red candle in a bull run as the market TRAVELLING TOWARDS YOUR ENTRY, not as a signal you missed
    the move.**
  - **If price runs away before reaching your level, LET IT GO. Buying late puts your stop loss hundreds of
    points behind.**
  - **Stop trading a consolidating market. When neither side is winning, option buying earns nothing.**
- **Rationale for automating:** a human watching from 9:15 quietly skips the readings that contradict his mood;
  the software has no such bias. *(Asserted, not demonstrated.)*
- **Scale claim here: "the claimed 13,000 combinations".**

---

### VIDEO-111 — season 3 EP 1: S/R defined strictly, and why a fixed-point stop loss kills the method
**Type:** Theory + live test. **Core — adds the "reversal price defines a level's REACH" rule.**

- **THE LIVE TEST:** the guest (profitable in May–June–July, then gave it back) is shown a random historical
  replay of Nifty on 1 September at double speed.
  Her read: support 24,500 with **both** 100% volume and 100% OI, resistance WTT → upward pressure from both
  sides. Plan: buy a call at **24,558**, target 50 points, stop 20 points.
  **The day's low was 24,559. The entry never filled BY A SINGLE POINT and the market rose without her.**
- **WHY A FIXED-POINT STOP LOSS FAILS:**
  - **A 20-point stop is a number the TRADER chose. The market does not know it and nobody else is trading around it.**
  - **Because the loss looks small — 20 points × a lot of 75 ≈ ₹1,500 — the trade feels easy, so the trader
    only plans the favourable case.**
  - **When price goes against the position, the stop gets MOVED to the extension of support, then to the next
    diversion below, and the planned ₹1,500 loss becomes 150 or 220 points.**
  - **Eight winning trades of 50 points and two losses of that size leave the account flat or negative.**
    He walks the guest through her own numbers showing exactly this pattern.
  - **A stop loss has to come from MARKET STRUCTURE — where support and resistance sit and which way the
    pressure runs — not from a number you like.**
- **HOW S/R ARE DEFINED HERE (restated, with one new constraint):**
  - Take the current price as an imaginary line and the pair of strikes immediately above and below it.
  - **Support:** start from the HIGHER strike of that pair on the PUT side and move outward to LOWER strikes.
    **The first strike carrying 100% volume or 100% OI, whichever is nearer the imaginary line, is support.**
  - **⚠ NEW CONSTRAINT: "Support therefore can never sit more than ONE STRIKE IN THE MONEY."**
    → *This partially resolves the ITM ambiguity from VIDEO-06/VIDEO-08. See Open Question 6.*
  - **Resistance is the mirror image.**
  - **⚠ IMPORTANT PERSISTENCE RULE: "Support formed at 9:15 stays valid FOR THE DAY even after price trades
    BELOW it, provided the largest open interest at that strike has not unwound."**
    Bank Nifty's 58,000 support held its status all session while price fell through it.
  - **Practice cases:** a pharma stock supported at 1,140 by volume alone with OI far away; BSE supported at
    2,400 **where the highlighted 83% figure was NOT the real level**; Divi's Labs at 6,800 rather than the
    92% strike at 7,000; Maruti resistance 16,000, support 15,500.
    → *These show the highlighted percentage strike is NOT automatically the level — the scan direction rule wins.*
- **REVERSAL PRICES AND HOW FAR A LEVEL CAN STRETCH:**
  - **The app prints a reversal price against every strike. He says he derives it from the GREEKS — Delta,
    Theta, Vega, Gamma, Rho — plus IMPLIED VOLATILITY, BOTH SIDES' LAST TRADED PRICES, SPOT and FUTURES.**
    ← *the most complete input list given anywhere. Still no formula.*
  - **A LEVEL'S REACH IS SET BY ITS REVERSAL PRICE, NOT BY THE STRIKE.**
    Bank Nifty support at 58,000 had a reversal price near **57,700**, meaning **price could drop roughly 300
    points below the strike and the level would still be doing its job.**
    **The day's low came in near 57,528 — one further diversion below — and support was STILL counted as 58,000.**
  - ICICI Bank: largest OI at 1,350 formed when price was ≈1,341 in the morning, reversal price ≈**1,336**,
    and the day's low arrived around there.
  - **A trader reading only the highest OI would give up long before price reached the level that actually mattered.**
- **Instructions:** stop setting stop losses in fixed points; **always cross-check the S/R values printed at
  the TOP of the app against the strike you picked by eye** (the guest misread several stocks by skipping
  this); **track OI from 9:15 onwards** rather than judging the chain at the moment you happen to open it.
- **Flagged in-source:** he states the app's AI "can never make a mistake on its own" and that discrepancies
  are the user's error. **A product claim.**

---

### VIDEO-112 — season 3 EP 2: pressure, the ARROW notation, the nine scenarios, and SOC 1R/2R/3R
**Type:** Theory. **Core — explains WHY the arrow notation exists.**

- **THE THREE STATES A STRIKE CAN BE IN:**
  - **Find the strike carrying 100% volume or 100% OI, then look for any NEIGHBOURING strike holding 75% OR
    MORE of that figure.**
  - **No neighbour reaches 75% → the level is STRONG.**
  - **A 75%+ neighbour at a HIGHER strike → WEAK TOWARDS TOP. At a LOWER strike → WEAK TOWARDS BOTTOM.**
  - **The app highlights the STRONGEST QUALIFYING neighbour in YELLOW and leaves other 75%+ strikes in BOLD.
    Read the YELLOW one, not whichever number catches your eye** — the guest repeatedly picked 79% over 86%.
  - **A highlighted strike that is DEEP IN THE MONEY carries no meaning. Only levels found by scanning
    OUTWARD from the current price count.**
- **⚠ THE EXCEPTION THAT REVERSES THE READING:**
  - **WTT does NOT automatically mean bullish. If the level itself has ALREADY SHIFTED DOWN from a higher
    strike, a WTT reading is actually BEARISH pressure.**
  - **The reverse holds: a level that shifted UP from a lower strike shows BULLISH pressure even while it
    reads WTB.**
  - **The app prints "shifted from top to bottom" or "shifted from bottom to top" ABOVE the level. Either read
    that line or track the chain from 9:15 yourself.**
  - **THIS IS WHY THE CHART USES ARROWS RATHER THAN THE LABELS WTT AND WTB.** He says he is explaining the
    reason publicly for the first time: **the same label can mean opposite things, so the ARROW records the
    NET PRESSURE instead.**
    **An arrow running from a SMALLER strike to a LARGER one is BULLISH; the reverse is BEARISH.**
  → **Architecturally: store the ARROW (net pressure), derive the label for display. Not the other way round.**
- **THE NINE SCENARIOS (this statement of the table):**

  | Resistance pressure | Support pressure | Verdict |
  |---|---|---|
  | Strong | Strong | **Neutral** — calls and puts both available |
  | Bearish | Strong | **Slightly bearish**, prefer puts |
  | Bullish | Strong | **Slightly bullish**, prefer calls |
  | Strong | Bearish | **Slightly bearish** |
  | Strong | Bullish | **Slightly bullish** |
  | Bearish | Bearish | **BLOOD BATH — puts only** |
  | Bullish | Bullish | **BULL RUN — calls only** |
  | *levels pulling apart* | | **Risky on both sides** |
  | *levels pressing directly on each other* | | **Risky on both sides** |

  - **Each pressure state can be reached THREE different ways — direct weak-towards, a shift, or a
    weak-towards that turned strong — which is where the claimed total of about 13,000 combinations comes from.**
  - **Practical note:** when support and resistance are far apart and each edges towards the other **without
    contesting the same strike**, **volatility stays low and the market consolidates.**
- **STATE OF CONFUSION, formalised:**
  - **SOC appears in the MIDDLE FOUR scenarios, where one side is strong and the other has been pushing for an
    hour or more WITHOUT THE MARKET ACTUALLY MOVING.**
  - **After an hour it becomes SOC 1R, after two hours 2R, after three hours 3R.**
  - **A bullish SOC means BUY; a bearish SOC means SELL. THE MARKET MOVES AGAINST THE FAILED PRESSURE.**
  - **Live example:** Nifty opened in **blood bath** with resistance WTB. **Price refused to break the
    extension of support, and at ~10:15 the app flagged a BULLISH SOC.** Price reversed up from the extension
    of support and rose until ~11:12, **when the resistance SHIFTED, the SOC ended at 100%, and the blood bath
    verdict returned. The market fell for the rest of the session.**
  - **WHEN AN SOC ENDS, THE PRESSURE THAT WAS BLOCKED TAKES OVER AGAIN, so that moment deserves close attention.**
- **Instruction:** **judge the DIRECTION OF THE PRESSURE, not the label.** Cross-check the app's printed S/R
  against the strike you picked by eye. **Reach a conclusion about what the market is doing before taking any
  trade** — watching the chain without concluding anything is pointless.

---

### VIDEO-113 — Myths vs Maths EP 1: VWAP
**Type:** Indicator critique. **NON-CORE for the calculator; valuable as the speaker's stated research method.**

- **Why the series exists:** indicators are learned from their *results*, never from their *arithmetic*.
  **"Exposing" is in the title for reach, not because the indicator is fraudulent.**
- **The calculation:** VWAP = Σ(price × volume) ÷ Σ(volume), repeated every tick.
  Worked with three price points (≈22,450, 22,520, 22,380) and their volumes → VWAP ≈22,429 while price ≈22,450.
  **Image used: price is a pendulum, volume is the weight on it, VWAP is the centre of gravity the swing keeps
  returning to.**
- **WHAT THE FORMULA RULES OUT:**
  - **Volume resets to zero every day and is never carried forward → POSITIONAL TRADING IS ELIMINATED
    IMMEDIATELY. A VWAP line means nothing beyond the session it was built in.**
  - A common worry — rising volume against falling price unbalancing the indicator — **does not apply, because
    volume appears in BOTH the numerator and the denominator.**
  - **VWAP works only in a range-bound market, and only when volume is spread EVENLY through the session.**
- **WHEN IT FAILS:** uneven-volume days (Sensex the day after expiry; any index on a news or RBI-policy day);
  **very heavy volume early in the session** — the denominator becomes so large that VWAP effectively freezes,
  stays far below price, and may take most of the day to converge; **sudden large moves**, because VWAP is
  built from the last completed interval.
- **THE MISUSE:** **a touch of VWAP is not a buy signal. It is a MEAN — the market's fair value.
  Price returning to VWAP means only that price has come back to fair value; it can continue straight through.**
  **If you use VWAP, use it to judge fair value and check support and resistance separately for the entry.**
- **Transferable instruction: before using ANY indicator, work out its formula and identify the conditions
  under which the formula BREAKS.**

---

### VIDEO-114 — season 3 EP 3: outer boundaries, SINGLE vs DOUBLE FACTOR levels, and predicting the next scenario
**Type:** Theory. **Core — the double-factor asymmetry rule appears in full only here.**

- **WHERE THE DAY'S MOVE CAN END (scenario one):**
  - Bounded by **extension of resistance and extension of resistance +1 above, extension of support and
    extension of support −1 below.**
  - **Extension +1 is the reversal price of the NEXT STRIKE OUT. It is the FINAL boundary. If price passes it
    WITHOUT REVERSING, CLOSE THE POSITION FOR THE DAY and accept that something outside the framework is
    driving the market.**
  - **The FIRST level on each side is the RISKY line; the SECOND is the MODERATE line.**
    Worked example: R Moderate 1,329 above; S Risky 1,291 and S Moderate 1,274 below.
  - **STOP LOSS SITS AT EXTENSION +2 — THE MAX PAIN LINE** — 1,357 on the upside and 1,242 on the downside in
    that example.
    → **This is a second, explicit derivation of Max Pain, consistent with VIDEO-110's "two strikes below support".**
  - **None of these are round numbers; each is the reversal price of a specific strike.**
- **SINGLE FACTOR AND DOUBLE FACTOR LEVELS:**
  - **A level built on volume alone, or OI alone, is SINGLE FACTOR. A level where both sit at the same strike
    is DOUBLE FACTOR.**
  - **SINGLE FACTOR — simple: whatever that one factor is doing, the level is doing.** If the volume is WTB,
    the resistance is WTB.
  - **DOUBLE FACTOR — the rules are DELIBERATELY ASYMMETRIC:**
    - **RESISTANCE turns WTB if EITHER factor moves that way, but only turns WTT when BOTH do.**
    - **SUPPORT turns WTT if EITHER factor moves that way, but only turns WTB when BOTH do.**
    → **i.e. the "inward, towards the imaginary line" direction needs only ONE factor; the "outward" direction
      needs BOTH. This is the formal version of VIDEO-08's rule and is consistent with it.**
  - Practice cases: CG Power, Nifty, Bank Nifty, Bank of Baroda, Hindustan Zinc, Britannia, Asian Paints, DMart.
- **PREDICTING THE NEXT SCENARIO (the drill):**
  - **Method: look at each side's current pressure, ask what SINGLE CHANGE would flip it, and read off which
    of the nine scenarios that would produce.**
  - **From a BULL RUN:** one side turning bearish → scenario eight or nine (risky on both sides);
    one side merely turning strong → scenario five.
  - **From SCENARIO EIGHT:** the bullish side turning bearish → **blood bath**.
  - **From a BLOOD BATH:** either side turning bullish → eight or nine.
    **In a blood bath, one side moving FURTHER bearish changes nothing — only a turn to bullish changes the scenario.**
  - **The weighing-scale image: if the percentage at the LOWER strike is growing, the lower strike is getting
    heavier and the market is bearish. If the HIGHER strike is getting heavier, bullish.**
- **⚠ WHERE THE SCREEN LAGS THE MARKET (important for our UI):**
  - **The DISPLAYED scenario only updates when a percentage CROSSES 75%. A level falling from 95% towards 80%
    has ALREADY turned bullish in substance while the screen still prints blood bath.**
  - **Similarly, a level that remains WTB but moves its weak point UP from 4,000 to 4,100 has turned bullish in
    pressure while keeping its label.**
  - **His instruction is to read this MANUALLY and understand that the flagged blood bath will not arrive.**
  → **Design implication: we should surface the percentage TRAJECTORY, not only the thresholded label.**
- **Instructions:** exit when the scenario changes against the position — **do not hold on because it might
  come back** (it may come back four or six times out of ten; the time it does not, you are trapped);
  before entering, decide **what change would END that scenario**; watch the percentage move through
  **65, 68, 70, 72** rather than waiting for it to reach 75 and surprise you.

---

### VIDEO-115 — Myths vs Maths EP 2: RSI
**Type:** Indicator critique. **NON-CORE for the calculator; one cross-reference worth keeping.**

- **Indicator vs oscillator:** every oscillator is an indicator, not vice versa. **An indicator's range may be
  open-ended (a moving average has no upper bound); an OSCILLATOR's range is FIXED — RSI runs 0 to 100 with
  zones at 70 and 30.** An indicator can identify a trend; **an oscillator cannot and was never built to.
  Its only job is to mark overbought and oversold zones, and it is built for RANGE-BOUND markets only.**
- **The calculation:** `RSI = 100 − 100/(1 + RS)`, where `RS = average gain ÷ average loss`.
  **The period counts CANDLES, not days.** Fourteen on a five-minute chart = the last **seventy minutes**.
  **Influencers who select a five-minute chart and then describe "14-day RSI" are simply wrong about what the
  setting does.**
  Worked: over fourteen candles, gains ₹17 and losses ₹7 → average gain 1.21, average loss 0.5 → RS = 2.42 →
  `100 − 100/3.42` ≈ **70.8**.
- **Where it works:** a range-bound market; a **weak** trend (RSI repeatedly reaches an extreme and stalls,
  giving early warning); **a market rotating between two levels with momentum lost — the case the speaker maps
  to his own D1/D2 divergence rule.**
- **Where it fails:** a **strong** trend (RSI sticks above 70, 80, 90 because the scale cannot exceed 100 —
  selling the overbought reading while price keeps rising is how the money goes); **news or a spike**;
  **a very low time frame** (fourteen one-minute candles on a thinly traded stock produce an essentially
  random reading; an index holds up better than a single stock).
- **Instruction: establish the market's TREND STATE before deciding whether to use RSI at all, and drop it
  when the market is trending. 70 is not a sell instruction and 30 is not a buy instruction.**

---

### VIDEO-116 — season 3 EP 5: WHEN AVERAGING IS LEGITIMATE (two real losing trades replayed)
**Type:** Post-mortem. **Core — this is the definitive statement of the averaging rule.**

- **THE 18 AUGUST CALL TRADE:**
  - She bought a 24,900 call at 9:51 for a premium of **218**, because the app read "slightly bullish" and she
    saw support at 24,900 WTT.
  - **First error: support was actually at 25,000, having SHIFTED FROM BOTTOM TO TOP. She had picked the strike
    off the PERCENTAGE COLUMN without reading the LABEL.**
  - **Second and larger error: at that moment S Risky and S Max Gain were THE SAME VALUE. That is the TARGET of
    the day's move, not an entry. When those two lines coincide there is NO BUY there at all — you wait for
    S Moderate.**
  - She then added lots at 207, 178 and 154, ending with four. **At no point had she worked out what the STOP
    LOSS would COST.** Two lots at 75 points ≈₹11,250; three lots ≈₹15,000.
  - **What would have turned the trade against her: either side going WTB. That is exactly what happened when
    support crossed 75% and the verdict flipped slightly-bullish → slightly-bearish, with the premium ≈150.**
  - **She held on and exited at 3:29 PM near 121 — well past the framework's own rule to be flat by 2:30.**
  - **Entering at S Moderate instead would have put the entry and the exit at roughly the same level — a five
    to ten point loss, with NO AVERAGING NEEDED AT ALL.**
- **THE 19 AUGUST PUT TRADE:**
  - At 9:30 she bought a 25,200 put at **285**, in a scenario the app marked **risky on both sides** —
    support pressure bullish, resistance pressure bearish.
  - **The strike was far too deep in the money.** A nearer strike trading ≈132 would have done the same job;
    **deep-ITM options magnify the LOSS as much as the gain.**
  - **In a both-sides-risky scenario with resistance volume building at 74% and able to flip bullish at any
    moment, the correct action was to WAIT rather than take a directional position.**
  - The trade initially worked — the premium reached ≈310 — **but she never booked, waiting for R Max Gain.**
  - **She then averaged at 245 and again at 235 WHILE THE RESISTANCE PERCENTAGE WAS CLIMBING through 82, 84
    and 88 — that is, while the readings were moving AGAINST her.**
  - Support turned WTT, a **three-hour bullish SOC** completed ≈12:18, and the index moved into **bull run**.
    She exited at 2:07 near 229; the position later fell to 200.
- **⚠ WHEN AVERAGING IS LEGITIMATE — the rule:**
  - **Averaging is ONLY valid when the SITUATION YOU ENTERED ON IS STILL THE SITUATION ON SCREEN.**
    You are bearish, the market is still bearish, and price has simply come a little above your entry.
  - **If the PRESSURE HAS TURNED AGAINST YOU, adding a lot is NOT averaging. It is building a SECOND position
    against yourself on top of one already trapped.**
  - **Price sliding towards a line is NOT a reason to add. The reason to add is that the READINGS still favour you.**
  - **Framed as ELIGIBILITY: you earn the right to average only once you can read the percentage pressure and
    say what would end the current scenario.**
  → **This is the resolution of the tension flagged at VIDEO-30 / Open Question 5.**
- **Instructions:** never open a position at S Max Gain; **before entering, calculate what the trade loses at
  its stop with the number of lots you intend to hold**; exit when the scenario flips, not when you run out of
  patience; **choose strikes NEAR the money rather than deep ITM** *(note: conflicts with VIDEO-107 for index
  intraday — Open Question 9)*; **keep a written log of losing trades with date and time, replay each one in
  the app's historical data at speed, and name the specific mistake.**

---

### VIDEO-117 — the 920 strategy + THREE MONTHS OF BACKTEST STATISTICS
**Type:** Backtest. **Core — the most decision-relevant quantitative content in the corpus.**

- **HOW THE 920 STRATEGY IS BUILT (restated):** at **9:21** the app draws four static lines from the S/R as
  they stood at **9:20**: extension of resistance, extension of resistance +1, extension of support, extension
  of support −1. **Static = fixed for the session.**
  **Reasoning: the first five minutes of build-up tends to control the rest of the day — not every day, but
  more often than not.**
  **It is DELIBERATELY a standalone strategy. You do NOT check the nine scenarios, the D1/D2 rule, or whether
  the day is a bull run or a blood bath. A complete beginner can trade it.**
  **Entry at a line; target roughly 50 points in the spot OR the first reversal price visible on the opposite
  side; stop loss 50 points. If the stop is hit, take the fresh trade at the NEXT LINE rather than averaging.**
- **RULES:**
  - **Do not trade 920 after 11:30 AM.**
  - **If a line is missing on one side, do not trade in the OPPOSITE direction that day.
    No resistance line → no bearish trade; no support line → no bullish trade.**
  - **Lines go missing when the market OPENS ABOVE its resistance reversal or BELOW its support reversal.
    At least two of the four always appear.**
  - **A market opening near the RESISTANCE side is more likely to DRIFT DOWN through the day; one opening near
    the SUPPORT side, more likely to RISE.**
  - **If a LIVE line sits within five to ten points of a 920 line, trading around it is acceptable.**
- **THE BACKTEST — 1 January to 7 April, internal portal, no averaging, mechanical 50-point target and stop:**
  - **Trading every symbol together LOST 466 points. FinNifty lost. Bank Nifty lost heavily.**
  - **Midcap Nifty gained ≈243 points: 37 wins vs 21 losses; longest winning streak 8, longest losing streak 3.**
  - **Nifty gained ≈127 points: 47 wins vs 37 losses, a 56% hit rate, risk-reward 1.84; longest winning streak
    7, longest losing streak 5.**
- **THE FILTERS THAT SEPARATE WINNERS FROM LOSERS:**
  - **GAP WIDTH between the two extension lines is the single fastest filter, readable at 9:21.**
    **Midcap Nifty: a gap of ≤50 points produced 37 wins to 14 losses, while gaps of 51–100 points produced
    NO WINNERS AT ALL. Nifty: gaps above 100 points lost all twelve times they occurred.**
  - **TIME OF DAY.** Midcap Nifty made its money **between 9 and 11** and **lost after 12**.
    Nifty was **loss-making at 9 AM and at 12**, and made its profits **between 10 and 11**.
  - **DAY OF WEEK.** Midcap Nifty's best day was **Tuesday**. Nifty's worst was **Thursday**; Monday and Friday fine.
  - **POSITION IN THE EXPIRY CYCLE.** Midcap Nifty earned **on expiry day itself and in the first day or two of
    a new cycle**, and lost most heavily **five days before expiry**. **Nifty's strongest day was the one
    immediately AFTER expiry.**
  - **WHICH LINE WAS TRADED:**
    - Midcap Nifty: **81% at the extension of support, 66% at the extension of resistance, 41% at EOS−1, 40% at EOR+1.**
    - Nifty: **70% at the extension of resistance, 60% at the extension of support, 33% and 20% at the +1 / −1 lines.**
    - **⚠ THE TRAP IN THAT LAST FIGURE: Nifty's extension-of-support trades won 60% of the time and STILL LOST
      182 POINTS OVERALL, because the wins were smaller than the losses.**
      → **Win rate alone is not a selection criterion.**
  - **TRADE DURATION IS A LIVE WARNING SIGN.** Midcap Nifty winners resolved in **14 to 18 minutes** and losers
    within 14; **Nifty trades averaged 61 minutes, and beyond that he treats the trade as likely lost.**
- **Instruction:** **decide at 9:21, from the GAP between the lines, whether 920 is worth trading at all that
  day. If not, switch to the app's AI mode instead.**
  **Trade 920 only on Midcap Nifty and Nifty — not Bank Nifty or FinNifty, and not all symbols at once.**
  **Take the trade at the EXTENSION lines rather than the +1 / −1 lines, which have the weakest hit rates.**
- **Honest caveats in-source:** one three-month sample from a period that included several geopolitical events;
  the ratios may change. **The statistics portal shown is INTERNAL and was not yet in the app.**
- **⚠ NOTE THE DIRECT CONFLICT WITH VIDEO-48/51/61:** those files make the OUTER (+1/−1) lines the SAFE trades.
  This backtest shows the outer lines have the WORST hit rates. → Open Question 33.

---

### VIDEO-118 — Expiry Day Full Analysis: projecting next week's range, and the last-hour time-value boundary
**Type:** Method. **Core — two techniques that appear nowhere else.**

- **READING THE WEEKLY RANGE ON EXPIRY DAY:**
  - **W draws RL1/RL2/RL3 above and SL1/SL2/SL3 below, derived from standard deviation.**
  - **On expiry day, note which two lines the market sits between and RE-CHECK EVERY HOUR FROM ABOUT 10 AM.**
    It may be between two resistance lines, two support lines, or one of each.
  - Example: the week's band ran RL1 **23,108** down to SL1 **21,554** — ≈**1,554 points**, called unusually wide.
  - **Reversal odds attached: ~65/100 at L1, 95/100 at L2, 99/100 at L3.**
  - Calls referenced: the Nifty bottom during the India–Pakistan episode (a 1,000-point gap-down reaching L3,
    with L1 already touched twice); a top at L3 a month earlier; a Budget Day level of 24,600 at L2.
- **⚠ ESTIMATING NEXT WEEK'S RANGE FROM TODAY'S CHAIN (described as revealed publicly for the first time):**
  1. **On expiry day, open the NEXT expiry's option chain, not the one about to settle.**
  2. **Take the AT-THE-MONEY strike and ADD THE CALL'S LTP TO THE PUT'S** (i.e. the straddle).
     In the example the 23,000 strike gave **≈700 points combined.**
  3. **DISCOUNT that figure for the time of day: ≈10% if read BEFORE NOON, 7–8% AFTER 12, ≈5% AFTER 2 PM.**
     700 → ≈**650**.
  4. **ADD and SUBTRACT that number from SPOT to get next week's RL1 and SL1** — here **23,650** and **22,350**,
     a full range of **1,300 points** against this week's 1,554.
  5. **Then COMPARE: is next week's RL1 higher or lower than this week's, and the same for SL1?**
- **THE DECISION RULE:**
  - **If next week's RL1 comes out HIGHER than the current one, do NOT take a bearish cheap-option punt this expiry.**
  - **If next week's SL1 comes out HIGHER than the current one AND price is sitting near support, the BULLISH
    version of that trade is the one worth taking.**
  - **Reasoning: the market has to settle inside its own range, so a rising projected range removes the downside case.**
  - **DISTANCE MATTERS TOO: if the opposite line is 400 to 500 points away, the punt has room to work.
    At 1,500 points away it does not.**
- **HERO-ZERO TRADES:** buying a ₹5 or ₹10 premium on expiry hoping it multiplies — **stated plainly: eight
  times out of ten it goes to zero.**
  **Suggested substitute: when the market is near a weekly-range level AFTER 12 NOON and has to close at that
  range, take the same view in FUTURES instead** — the move is captured without the near-certain total loss.
  **Expiry days tend to resolve one of two ways: the market dies inside the range, or it produces one sharp
  move of a hundred points or more right at the end.**
- **⚠ READING THE WRITERS' REMAINING MONEY IN THE LAST HOUR (a genuinely distinct technique):**
  - **Look at the TIME-VALUE column on the IN-THE-MONEY side of the chain, which the app shades GREY.
    Intrinsic value is irrelevant on the day contracts expire.**
  - **A writer will sell wherever the most money is still lying, then the next-best strike, working outwards.**
  - **WHERE TIME VALUE GOES TO NEAR ZERO OR NEGATIVE, NO WRITER WILL SHOW UP, because brokerage would eat the
    whole premium. THAT STRIKE MARKS A LEVEL THE MARKET WILL NOT BE SEEN PAST IN THE REMAINING TIME.**
  - Example: put-side time value turned negative around **23,150** → no put writer would arrive there → the
    market was unlikely to trade above it. On the call side money was still available five or six strikes out,
    so call writers could keep pressing the market down.
  - **SCOPE LIMIT STATED FIRMLY: this reading applies ONLY on expiry day, ONLY in the last hour, and ONLY on
    the grey side of the chain. It says nothing about a Tuesday or a Wednesday.**

---

### VIDEO-119 — the expiry-close prediction contest: only the Weekly Range survives
**Type:** Classroom. **Core — it explicitly rejects several plausible methods.**

- **The question:** at ~11:30 AM on a weekly expiry day with Nifty ≈22,900, name a **single closing number**
  for 3:30 PM — not a range, not a probability.
  **Framing: expiry day has one purpose — terminate the expiring weekly contracts and drive OTM premiums to zero.**
- **METHODS PROPOSED AND WHY MOST WERE REJECTED:**
  - **Change in LTP (Change PTS) on both sides** — calls green → up, puts green → down, both falling → stuck.
    **Both sides can never be green at once.** On this day **both were red, so the signal gave nothing**;
    he attributes that to ≈₹150 of time value consumed by the gap-down open. **Rejected for this day.**
  - **Open Interest change** — the idea that the market moves towards the side where OI change is negative, or
    settles between the two heaviest OI strikes (≈32,000 on the 22,800 put, ≈36,000 on the 23,000 call) so
    sellers keep the most.
    **REJECTED because OI unwinds within minutes; those positions run away as soon as price moves.**
  - **Delta** — a strike with delta ≥0.6 is unlikely to expire at zero (0.69 at 22,850).
    **Called correct but BOOKISH: it gives a PROBABILITY, not a closing number.**
  - **Nifty futures consolidation** — **REJECTED because spot and futures converge only on MONTHLY expiry, not weekly.**
  - **Time value** — the argument that if the market touched support and support−1 before 9:30 or 10:30 it
    usually travels up to resistance, predicting a close above a divergence of resistance.
    **Allowed to stand as a reasonable line of logic.**
  - **Historical data** — past 3:30 PM data usually shows both sides at the same strike, **and it only tells you
    at 3:00 PM, which is too late to trade.**
- **THE METHOD THAT SURVIVED — WEEKLY RANGE:**
  - **The Weekly Range screen shows six levels, three each side.**
  - **The market tends to close near whichever of those levels is NEAREST to the current price.**
  - On the day: price 22,900 was ≈200 points from 23,108 and ≈1,400 points from 21,554.
    **A 200-point move in four hours is plausible; a 1,400-point move is not → 23,108 was the accepted answer.**
  - **Caveat given on the spot:** the market can do anything. He recalls 17 April, when Nifty was ≈900 points
    from a level at midday and still reached it by 3:30, with ≈300 points coming in a 15–20 minute burst after 1:30 PM.
- **HOW HE ACTUALLY MANAGES A TRADE (worth recording — it contradicts several of his own published rules):**
  - **If a trade does not work within 15–20 minutes, he closes it regardless of whether it is at a small profit
    or a small loss.** He states plainly **he is not good at holding**, and that **his job is to stop the loss,
    not to capture the target.**
  - He describes taking a **three-point profit** after moving the stop to cost, because the position had stalled,
    and defends it: the same trade can be re-entered later.
  - **He prefers repeating ONE setup at ONE level (and averaging if it recurs) over hunting a new method every
    day. If a setup works 15–16 times out of 20, there is no need for a new one.**
  - **He says he does NOT trade diversions at all.** → *Directly at odds with VIDEO-108's divergence scalping.
    Open Question 34.*
- **Instructions:** **trade the FIRST TWO HOURS of your session only** — the brain operates at full capacity in
  the market for roughly two hours; **enter after the pull in one direction ENDS, not while it is in progress**
  (for a Call, wait for the downward pull from support to finish); **fix a loss limit before entry** —
  his stated example: **risk 30 points for a 300-point target.**

---

### VIDEO-120 — Ritesh Shukla (Kotak MF) on India's economy
**Type:** Guest talk. **NON-CORE — no LTP Calculator logic at all.**

- Macro case that India has structurally changed (living standards, inflation band, FX reserves ≈$620bn,
  infrastructure growth 2013–2024, PSB NPAs falling from 9–11% to ~1%, GDP vs Brazil+Russia, six of the ten
  fastest-growing cities, ~90–95k startups, Amul's scale).
- Digital payments and direct benefit transfer removing leakage; India as the second-largest mobile
  manufacturer; only ~13–15 of ~135 companies leaving China came to India.
- **The one transferable item — his expected-return rule of thumb:
  `FD rate + inflation + risk premium`**, with a risk premium of **1% large cap, 2% mid cap, 3% small cap**.
  Worked: 7.5% + 4.5% + premium ≈ **12–13%**, or 14–15% in a good market.
- **"Core and satellite": keep TRADING capital and LONG-TERM capital in separate buckets, and never move money
  between them.** Recommended horizon five years; savings target 40% of income.
- **All statistics are heavily garbled in the transcript and should not be quoted from it.**

---

### VIDEO-121 — the nine-scenario ENUMERATION DRILL
**Type:** Classroom exercise. **Core — this is the best procedural description of the morning routine.**

- **THE MORNING ROUTINE:**
  - **He deliberately IGNORES overnight news, Gift Nifty and US markets.** Argument: news never stops arriving,
    and acting on stale news creates **recency bias**, which stops you reading the market neutrally.
    *(Note the conflict with VIDEO-103, which uses Gift Nifty. Open Question 32.)*
  - **His stated condition for trading: BE NEUTRAL. If you have already decided you are bullish or bearish, the
    market is not yours that day.**
  - **He does not look at price in the first four minutes.**
  - On the day shown, Nifty gapped down; support 22,700 and resistance 23,000.
- **STEP ONE — MARK THE OUTER RANGE:**
  **Write down the SUPPORT strike, then ONE STRIKE BELOW it (22,700 and 22,650).
  Write down the RESISTANCE strike, then ONE STRIKE ABOVE it (23,000 and 23,050).
  That pair of outer values is the day's likely range.** He says this is the first thing to do every morning.
- **STEP TWO — LIST THE POSSIBLE MOVES ON EACH SIDE:**
  - **Resistance can do exactly THREE things: become strong where it is; shift to a new strike and become
    strong there; or shift and form WTT at the new strike.** He challenges the room to name a fourth and there isn't one.
  - On this day the resistance side had **three** listed outcomes and the support side had **five**, because
    support could also shift down twice and had a 100% OI reading appearing at 22,500.
  - **Multiply: 3 × 5 = 15 possible paths for the day.**
  - **Reading the volume percentages matters.** At 23,000 volume read 100%, the largest; the next largest ≈95%
    was at 22,700. **A RISING percentage at resistance means the level is being REINFORCED** — the image is a
    ₹100 note nobody is pulling away while more stones are piled on top.
- **STEP THREE — LABEL EACH OUTCOME, THEN COMBINE:**
  - **Tag each individual outcome bullish or bearish. Resistance becoming strong at the LOWER strike is BEARISH;
    resistance shifting UP and strengthening is BULLISH. Support shifting DOWN then forming WTT at a higher
    strike is BULLISH pressure even though the level itself moved down.**
  - **Then PAIR each resistance outcome against each support outcome and write the result: bloodbath, bull run,
    consolidation, or unpredictable.**
  - **Worked results:** resistance strong at 22,700 paired against the five support cases produced
    **three bloodbaths and two consolidations, and NO bullish outcome at all** → **if resistance turns strong at
    22,700, trade bearish or stand aside.**
    If resistance instead turned strong at 23,000, most pairings came out **consolidation or unpredictable** →
    **leave that market alone entirely.**
  - **PRACTICAL SHORTCUT: work from whichever side has FEWER possible outcomes.**
  - **He estimates this takes 5 to 10 minutes a morning**, and the LTP Calculator already automates it under the
    headline banner ("Nifty in Blood Bath").
- **THE SCENARIO SUMMARY AS GIVEN HERE:** both strong → trade either side. Resistance bearish + support strong →
  **Puts only**. Resistance bullish + support strong → **Calls only**. Both bearish → **bloodbath, Puts only**.
  Both bullish → **bull run, Calls only**. **One bullish and one bearish → TAKE NOTHING.**
- **HOW TO READ THE SCREEN:** **an UPWARD ARROW means BEARISH, a downward arrow means BULLISH.**
  **Reason given: as the market rises, the imaginary level shifts to a higher strike, which moves it DOWNWARD on
  the option chain display.**
  **A GREEN box means that side is tradeable, a RED box means it is not. Both green = both Calls and Puts available.**
  → *⚠ Note this arrow convention is the OPPOSITE of VIDEO-112's ("an arrow from a smaller strike to a larger one
    is bullish"). Almost certainly the same fact stated against different display orientations.
    → Open Question 35 — this MUST be pinned down before we draw anything.*
- **Consolidation days trade between the max gain and max pain strikes, with the stop loss at the level itself.**
- **Unresolved:** a student raises that **implied volatility was very high that day**; the speaker sets it aside
  and says he would **trade futures in that case**, without further explanation.

---

### VIDEO-122 — beginners: the reversal-price ladder, and the "trade away from the nearer level" rule
**Type:** Live beginner event. **Core — the simplest complete method in the corpus, and it is shown FAILING twice.**

- **Where price comes from:** traders themselves set it. **When a buyer and a seller agree, that becomes the LTP,
  and the LTP is the market price.** Nifty works this way tick by tick 9:15–3:30.
  For beginners: **set aside the spot/futures/options distinction and watch ONE thing — the number on screen.**
- **Why direction changes everything:** ask a room whether gold is expensive today and most say yes; tell them
  it will be ₹5 lakh in a year and the same price looks cheap. **"Expensive" and "cheap" are not properties of
  the price — they are conclusions you draw once you have a view on direction.**
  Stated exception: real estate, where he says direction cannot usefully be guessed.
- **READING A CANDLE, AND THE RIGHT QUESTION:** a candle shows open, high, low, close for its period.
  **The useful question is NOT "will price go up or down" but WHICH OF THE TWO EXTREMES GETS HIT FIRST.**
  If price reaches the upper extreme and turns, sell there; if it drops to the lower and turns, buy there.
  **The upper turning level is resistance, the lower is support.**
- **WHY THE OPTION CHAIN AND NOT INDICATORS:** nobody can see who is buying and who is selling — the exchange and
  regulator deliberately prevent that data existing, and **some participants use colocation servers precisely so
  their trades stay unidentifiable.** **What IS available is snapshot data published AFTER trades execute —
  that is the option chain.**
  **Most standard indicators (moving averages, Fibonacci, level indicators, 52-week high/low,
  accumulation/distribution, ADX) derive from HISTORICAL PRICE DATA. His stated distinction is that his work is
  built on the LIVE LTPs in the option chain instead.**
- **⚠ THE REVERSAL PRICE METHOD, DEMONSTRATED LIVE:**
  1. **Turn on the "Spot" button on the option chain. The display switches from LAST TRADED PRICES to
     REVERSAL PRICES.**
  2. **The CALL side (left) carries resistance data. The PUT side (right) carries support data.**
  3. **THE RULE: the market FALLS from a reversal price on the CALL side, and RISES from a reversal price on the
     PUT side.** Each side gives a **ladder** of levels, so a rally has a designated place to turn down and a
     decline has a designated place to turn up.
  4. **DECIDE BY PROXIMITY: whichever reversal price is CLOSEST to current price, TRADE AWAY FROM IT TOWARDS THE
     FAR ONE.**
  - **Worked example on randomly chosen historical data, 13 March, 12:00 PM:** price 23,363, call-side reversal
    23,412, put-side reversal ≈23,363. Price was closer to the lower level, **so the class BOUGHT with a target
    of 23,412.**
    **THAT TRADE LOST. SO DID THE NEXT ONE. On the third attempt the class SOLD from 23,363 and it worked.**
    **The speaker leaves the two losses in rather than editing them out.**
    → **This is the only place in the corpus where a published rule is shown failing in real time. Worth weighting.**
  - Second example: spot 25,734, resistance ≈25,738, support ≈25,690; above 25,738 the next downward reversal
    sits at 25,787, and at 25,639 price should turn up.
  - **He states the reversal prices are calculated from Option Greeks, and that this is only the MOST BASIC
    LEVEL of the method.**
- **Instruction:** practise on random historical dates and times **chosen by someone else**, so you cannot know
  the outcome in advance.

---

### VIDEO-123 — a heavy gap-down day: the Weekly Range as the anchor, and the positioning rule
**Type:** Live session. **Core — adds two rules and one unusually honest admission.**

- **READING THE SENSEX:** support **73,500** marked **WTB — a RED indicator**, meaning it wants to shift to a
  lower strike and could break. Resistance marked **WTT — a GREEN indicator**, meaning it wants to move higher.
  **With support pulling down and resistance pulling up, pressure is equal on both sides → the banner read
  "Sensex is both sides risky."**
  → **Colour convention: GREEN = bullish pressure, RED = bearish pressure** (consistent with VIDEO-125).
- **ON A BOTH-SIDES-RISKY DAY: price typically travels between EXTENSION OF SUPPORT PLUS ONE and EXTENSION OF
  RESISTANCE PLUS ONE, and trading anywhere in between will cause trouble.**
  *(The phrasing "extension of support plus one" is likely an ASR slip for minus one — the structure elsewhere is
  symmetric. Flagged.)*
  The AI LTP screen gave a sell level ≈250 points above price and a buy level ≈250 points below.
- **THE WEEKLY RANGE AS THE ANCHOR:**
  - **Calculated once a week, on TUESDAY at 5:30 PM, automatically inside the tool.**
    *(VIDEO-88 says 4:00 PM Tuesday; VIDEO-74 says Thursday ~4 PM. → Open Question 25.)*
  - For that week: resistance **23,800**, support **23,134**. Nifty closed the previous Friday at 23,366;
    Gift Nifty pointed to a large gap down; the market opened sharply lower.
    **The point: the destination was already known. Price came down and RESTED ON the 23,134 Weekly Range support.**
  - **Conclusion for the week: the bottom for today and tomorrow is around 23,134, and expiry is likely to land
    near whichever Weekly Range level is closest.**
  - **Trying to SELL while standing ON Weekly Range support is self-contradictory. It is rare for price to break
    decisively below that level, so the better question there is WHERE TO BUY.**
  - **Scope admission:** he states plainly that **his research covers only INTRADAY and WEEKLY horizons.
    He cannot forecast Nifty one, two, three or six months out.**
- **HOW THE DAY'S SCENARIO KEPT FLIPPING:** resistance at 23,500 shifted and formed WTB at 23,100, then shifted
  back, then to 23,200 and formed WTT at 23,500. **With both showing bullish pressure the banner read "Bull Run".**
  **But two competing volumes sat close together — ≈87% WTT at resistance and ≈86% WTB below.** He predicted
  trouble, and **while he was speaking the banner flipped from Bull Run back to both-sides-risky.**
- **⚠ RULE — HOW LONG A LEVEL IS VALID: the MODERATE resistance value holds ONLY WHILE ITS YELLOW PERCENTAGE
  MARKER IS ALIVE. Once the yellow marker moves or a WTT forms, that line STOPS MATTERING AND DISAPPEARS.**
- **⚠ THE POSITIONING RULE (a genuinely distinct mechanism):**
  - **When resistance and support are separated by at least one strike and both are strong in themselves,
    price GRAVITATES TOWARDS RESISTANCE.**
  - **WHICHEVER LEVEL PRICE IS STANDING NEAR, THE *OTHER* LEVEL FORMS FIRST.**
    **Price near support forces resistance to form WTB; price near resistance forces support to form WTT.**
  - **Reason given — crowd behaviour:** when price has risen sharply intraday, people start buying Puts.
    That builds volume on the put side, which creates WTT in support, which pushes price higher still.
  - **His general statement: BUY PUTS AND THE MARKET GOES UP; BUY CALLS AND THE MARKET GOES DOWN.
    A small number of buyers means price reverses at the level; a LARGE CROWD means price does the OPPOSITE.**
- **Unusually honest admission:** **on the day itself he STAYED OUT.** He held out for a 23,050 entry that never
  arrived, while **23,134 was visible and did work.** He repeats this candidly several times.
- **On IV that day:** Nifty ATM IV was ≈21 on one side and ≈19 on the other — **a small enough difference that
  he expected no significant IV-driven effect.** *(Consistent with VIDEO-104's ~1-point test being a guideline
  rather than a hard gate.)*
- **His advice on becoming a trader: only if you can absorb losses for ten continuous years.**

---

### VIDEO-124 — "where does it fail" — the research test, and the origin of the tool
**Type:** Method / epistemics. **Core — contains the tool's own origin story and input list.**

- **THE ARGUMENT ABOUT RESEARCH:** existing research is everything already published and freely learnable
  (candlestick patterns, bullish engulfing, Heikin Ashi, EMA, RSI, Bollinger Bands). **Repeating it is not research.**
  **Real research starts by identifying the GAP — the conditions under which the existing work STOPS FUNCTIONING.**
  Analogies: a laptop that works until ambient temperature exceeds 40°C; an EV that matches a petrol car for
  300 km and then needs four to six hours to charge.
  **Conclusion: every product and every method has a boundary. Finding it is the work.**
- **THE EMA DEMONSTRATION:** he deliberately builds the case *for* EMA first — a 30-period EMA, buy when a candle
  closes above, sell when it closes below — stepping through close after close where the rule produced a
  profitable move. He explains the mechanic (a 30 EMA averages the last 30 candles but **the most recent five to
  seven carry extra weight**). **Then he shows the other cases: closes above followed immediately by a decline,
  and closes below that reversed up. Each is a booked loss.**
  **The point is not that EMA is bad — it is that no video he has seen bothers to identify WHEN the
  close-above signal FAILS.**
- **THE SAME TEST APPLIED TO HIS OWN TOOLS:** he says he talks more about **when 920 fails and when Chart 1.0
  fails** than about when they work.
  **A stated failure condition in his own method: in a BULLISH market standing AT ITS TOP, he will NOT buy at the
  top. The trade is only taken FROM THE BOTTOM. Taking it at the top repeatedly is where the loss comes from.**
  **Payoff framing: once you filter out the failure conditions, the valid entries appear on their own, even if
  that leaves you only two trades in a month.**
- **WHY HE MOVED FROM CANDLESTICKS TO THE OPTION CHAIN:** a live example — **a tweezer bottom formed at a support
  level and reversed, producing a good move. Later the SAME level produced a SECOND tweezer bottom which BROKE
  DOWN instead. Candlestick theory offers no answer for why the same pattern at the same level behaved differently.**
  His claim: the answer exists in the option chain, where volume, OI at each strike, and the Greeks including IV
  are all visible.
- **⚠ HOW THE LTP CALCULATOR STARTED (the most concrete statement of the reversal-price inputs anywhere):**
  - **The first prototype was entirely MANUAL.** He pulled the option chain from the NSE website and took:
    **the MARKET PRICE, the CALL-SIDE LTP and the PUT-SIDE LTP at a strike, and the GREEKS — DELTA, THETA, VEGA,
    GAMMA — from wherever a broker terminal exposed them.**
  - **He typed all of it into a calculator and pressed calculate, which returned THE REVERSAL PRICE FOR THAT STRIKE.**
  - **Purpose was narrow: get the exact price at which to enter.** Example: a Sensex Put trade at the 74,500
    strike where **the reversal price came out at 46, so he waited for 46 and bought the Put there.**
  - **All of that is now automatic, with a reversal price shown at every strike.**
  → **So: reversal_price(strike, side) = f(spot, callLTP, putLTP, delta, theta, vega, gamma)**, with VIDEO-111
    adding **rho, IV and futures**. **Still no formula.** → Open Question 1.

---

### VIDEO-125 — when a repeatedly-holding support suddenly breaks: the second-volume early warning
**Type:** Replay (Sensex, 5 June). **Core — the clearest statement of the early-warning signal and the second-touch rule.**

- **THE UNANSWERED QUESTION FROM CHARTS:** draw a support line, price reverses off it several times, then one
  time it does not. **Candlestick theory offers no reason for the failure; its only response is a stop loss,
  which ACKNOWLEDGES the failure without EXPLAINING it.**
- **READING THE OPTION CHAIN IN FOUR STEPS:**
  1. **Spot price** — the red imaginary line between two strikes (here between 74,000 and 74,100).
  2. **Strike prices** — the column down the middle.
  3. **Resistance** — read at the top of the screen.
  4. **Support** — same.
  - On the day, support and resistance were **both at 74,500**.
  - **Each level can be in one of three conditions: strong in itself (NEUTRAL), WTT (BULLISH pressure), or
    WTB (BEARISH pressure).**
  - **COLOUR: GREEN means bullish pressure, RED means bearish pressure.**
  - **S/R in his tool are defined by VOLUME and OPEN INTEREST, by his own definition, and ONCE SET THEY ARE USED
    FOR THE WHOLE DAY.**
- **⚠ THE RESEARCH GAP HE CLAIMS TO HAVE CLOSED:**
  - **The naive reading is that the largest volume marks support. But that support BREAKS often enough to be
    unreliable.**
  - **His answer: WATCH THE SECOND-LARGEST VOLUME. When a SECONDARY CLUSTER forms BELOW the main support —
    in the example a 78% reading at 74,000 beneath the 74,500 support — that is WEAK-TOWARDS-BOTTOM, and it
    OPENS THE DOOR TO A 500-POINT FALL.**
  - **THE SIGNAL APPEARS THE MOMENT THE SECONDARY VOLUME FORMS, NOT AT THE MOMENT PRICE BREAKS.
    So the warning is available EARLY.**
- **THE 5 JUNE WALKTHROUGH:**
  - **9:15–9:20** — support 74,500 strong in itself, resistance WTT. **Banner: bullish.**
  - **9:53** — resistance still WTT, support turns strong. **The bull run downgrades to a NEUTRAL scenario.**
  - **10:19–10:20** — banner reads **Bullish SOC**. **The direction is bullish, but NO ENTRY IS AVAILABLE YET.**
  - **Candlestick reading at this moment would say buy the support that has already reversed price several
    times. AI LTP says BUY NOTHING, and WAIT FOR 74,300 — roughly 250 points BELOW the then-current price of ≈74,583.**
  - **⚠ THE BUY LEVEL IS NOT ARBITRARY: it is THE REVERSAL PRICE CALCULATED AT THE STRIKE HOLDING THE HIGHEST
    OPEN INTEREST SITTING UNDER THE HIGHEST VOLUME. Nearer reversal prices exist, but ONLY THE ONE AT THE
    HEAVIEST STRIKE IS OFFERED.**
    → **This is the most precise statement anywhere of WHICH strike the entry line is taken from.**
  - **No sell level is given at all, because resistance is WTT, meaning bullish.**
    His point: selling that resistance would fail repeatedly, **and a chart gives you no reason why.**
  - **~11:00** — price falls to the buy zone, holds above the S Max stop level, and turns. The move arrives.
  - **11:10 onwards** — the bullish scenario persists through 11:20, 11:48 and 12:52, and **price RETURNS to the
    same buy zone. The tool still shows it, but the rule says DO NOT TAKE IT.**
- **⚠ THE SECOND-TOUCH RULE, AND HOW HE DERIVED IT:**
  - **The rule: trade a level ONCE. Do not take a second trade at the same level.**
  - **How he arrived at it:** he traded the setup, reviewed the losses, **found that S Risky and S Moderate
    entries were failing ON REPEAT TOUCHES**, and concluded that **a level WEAKENS once it has been hit.**
    **The rule was then written in to close that gap.**
  - **Offered explicitly as the worked example of his research method: trade the idea, catalogue the failures,
    isolate the condition, add a rule that forbids it.**
- **WHEN THE SCENARIO FINALLY FLIPPED:** later a new volume cluster built below support. **The tool left it alone
  until it crossed a significant percentage, then highlighted it.**
  **Support went from WTT-too-strong (already bearish pressure, flagged since morning) to WTB — meaning the level
  was no longer just under pressure but ACTIVELY MOVING DOWN.**
  **Banner changed from Bullish SOC to both-sides-risky. Buying and selling both became risky.**
  **A NEW S Risky buy level appeared at 73,920 with a stop just below at 73,824. The instruction is to wait for
  that price and nothing else.**
- **Summary rules stated:** never SELL into a resistance marked WTT; never BUY into a support marked WTB;
  one trade per level per scenario; **wait for the scenario banner to change before looking for the next trade,
  then use the NEW levels it produces.**

---

### VIDEO-126 — THE REVERSAL-PRICE GAP RULE (reading the Greeks indirectly)
**Type:** Theory. **Core — a distinct, implementable directional signal that appears only here.**

- **WHY THE RAW GREEK VALUES ARE NOT ENOUGH:** knowing the definition of Delta or Theta tells you nothing
  tradeable; **what matters is how the market REACTS when those values change.**
  Body analogy: **the symptoms come before the diagnosis. The REVERSAL PRICE IS THE SYMPTOM.**
  He demonstrates turning on Delta, Gamma, Vega, Theta and IV columns and asks what conclusion you can actually
  draw by eye. **His answer: none.**
  He is dismissive of "Delta blast", "gamma blast" and PCR word-play.
- **⚠ THE REVERSAL PRICE GAP RULE:**
  - **BASELINE EXPECTATION:**
    - **A CALL-side reversal price should sit ABOVE its strike.**
    - **A PUT-side reversal price should sit BELOW its strike.**
  - **A modest gap in both directions is NORMAL. What matters is the DIRECTION and SIZE of the deviation.**
  - **BOTH SIDES PUSHED DOWN** — the call-side reversal falling BELOW its strike, the put-side reversal unusually
    far below → **BEARISH.**
  - **BOTH SIDES PUSHED UP** → **BULLISH.**
  - **BOTH SIDES EQUAL or near-equal** → **CONSOLIDATION, no volatility.**
  - **The GAP SIZE measures how STRONG the pressure is, and the CHANGE OVER TIME is the signal.**
- **WORKED EXAMPLE — Sensex, 4 June:**
  - **9:15–9:20:** the 74,400 strike showed a reversal price of **74,200 — 200 points BELOW, where it should have
    been ABOVE.** The put side was similarly stretched down. **Verdict: BEARISH.** Price at that point was 74,158
    and within minutes it fell further.
  - **By 9:30 the gap had narrowed to ≈150 points. By 10:00 it stayed near 150. The bearish pressure was EASING,
    and price turned up.**
  - **Total analysis time: five minutes at the open. No volume, no Greeks, no indicator.**
- **WORKED EXAMPLE — a consolidating day, 29 April** (chosen deliberately as a date nobody would remember):
  - **9:20:** gaps were normal — **≈50 points up on the call side and ≈50 down on the put side → NO VOLATILITY,
    a consolidated day.**
  - The gaps narrowed to ≈20 up and widened to 82 down, then returned to ≈50 each way, then settled to **equal by
    11:20 AM**. Price consolidated in line with it.
  - **By 12:00 the call-side reversal began drifting BELOW its strike.** Sensex was noticeably more volatile than
    Nifty that day, **which he reads off the same gaps.**
- **USING THE GAP WHILE ALREADY IN A TRADE:** **the stated practical use is EXIT TIMING.**
  If you are long from any method — candlesticks, RSI, a moving average — **and the reversal-price gap has been
  holding steady at 50 points above, the position is fine. When that gap suddenly REVERSES or behaves abnormally,
  it is an early warning that the move is about to turn, and a chance to exit BEFORE it does.**
  He attributes these sudden shifts to news arriving or about to arrive.
- **THE SECOND FACTOR — THE WEEKLY RANGE:** direction from the Greeks is only half the picture.
  - Worked example, Nifty week of 20–26 May. On Wednesday 20 May the Greeks read close to normal and mildly
    bearish. **The Weekly Range gave resistance ≈24,330 and support ≈23,200, with price CLOSER TO SUPPORT.**
  - **A THIRD QUESTION HE ADDS: WHERE IS PRICE COMING FROM? Where was it one day ago, two days ago?
    Direction of approach matters.**
  - What happened: 20 May set a low ≈23,397, close to the Weekly Range support. Price rose through 21 May to
    ≈23,859, continued Friday and Monday to ≈23,972, and on expiry Tuesday touched the Weekly Range top ≈24,000
    before closing lower.
  - **CONCLUSION: when price starts the week NEAR WEEKLY RANGE SUPPORT, expect it to travel to the TOP.
    Once it reaches the top, expect BEARISH momentum from there.**
  - **THE COMBINATION IS THE POINT: the Greeks can read BULLISH while the Weekly Range POSITION says the move is
    nearly exhausted.**

---

### VIDEO-130 — Seven Days Challenge EP 1: instruments, realistic returns, and the BIG-TO-SMALL reading order
**Type:** Beginner theory. **Core for one structural instruction.**

- **Spot / futures / options, practical differences:** three prices exist for a tradable stock, all three
  tradable. **In spot you can buy a single share; in futures you must buy the whole lot** (example stock:
  lot 1,250 at a spot price of ₹444). **A spot purchase can be held indefinitely; a futures contract expires on
  the LAST TUESDAY of the month and must be closed that day, then reopened in the next contract.**
  **A short in spot must be bought back the same day; a short in futures can be carried until expiry —
  THAT CARRY FACILITY IS THE REASON FUTURES EXIST.**
  **Nifty has no spot instrument.**
  **Buying = buying a Call. Selling = buying a Put.** (Writing is left for later episodes.)
  **Spot and futures trade at different prices: if a level is quoted on the SPOT chart, the FUTURES order will
  fill at the futures price for that moment, not at the quoted spot number.**
- **WHAT A REALISTIC RETURN LOOKS LIKE:** FD ≈6–9%; mutual funds ≈12.5% over ten years.
  **25–30% a year from the market is a LARGE result, not a starting point. Good traders are quoted as content
  with about 1.5–2% a MONTH.** Doubling money in five days is dismissed outright.
  **Expect to spend a decade in the market before the returns are reliable.**
- **⚠ READING THE MARKET FROM BIG TO SMALL (the structural instruction):**
  - Political analogy: PM → CM → MLA → councillor — macro to micro.
  - **Intraday trading needs the same direction, but there is no point starting from a ten-year view.
    START AT THE WEEK.**
  - **ORDER OF QUESTIONS: where will the market move THIS WEEK → where will it move TODAY → where exactly do I
    ENTER.**
  - **The LTP Calculator's buttons are laid out in that same sequence (W → 920 → AILTP), which is why the
    speaker says it should be read in that order.**
  → **This is the product's intended information architecture, stated explicitly.**
- **Instructions:** set your return expectation at 25–30% a year before placing a trade; **trade ONE LOT ONLY for
  the first year**, increase to two after your reactions have settled, then give that another year;
  **before entering any trade, ask how much you stand to LOSE, not how much you stand to make**;
  **take no trade at all on a day you do not understand.**

---

### VIDEO-131 — Seven Days Challenge EP 2: the weekly range as the FIRST FILTER
**Type:** Method. **Core — confirms the three-button order and the three-way verdict.**

- **THE MORNING MINDSET:** never open the market with a view already formed. At 9:15 the correct starting position
  is that the day **could be bullish or bearish.** **A single opening candle tells you nothing** — the example
  opens Nifty at 23,250 and the beginner correctly says she cannot tell which way it is going.
  **The decision comes from the LEVELS and the MOMENTUM, not from the look of the chart.**
- **⚠ THE THREE BUTTONS, IN ORDER:**
  - **W** — the weekly range, the range for the whole week.
  - **920** — the day's range.
  - **AILTP** — the actual trade levels.
  **They are deliberately laid out in that sequence and should be READ in that sequence.**
  The video's point is that the beginner had been skipping straight to AILTP for three years.
- **READING THE WEEKLY RANGE:**
  - **Six lines: three resistance above, three support below. Stated to be calculated from the GREEKS of the
    option chain**; the underlying research is left to a separate **70-episode playlist**.
  - **THE THREE-WAY VERDICT:**
    - **Price sitting ON or NEAR any of the three SUPPORT lines → treat the day as BULLISH.**
    - **On any of the three RESISTANCE lines → treat the day as BEARISH.**
    - **Price sitting in the MIDDLE of the six lines → the weekly range gives NO VIEW for that day.
      This is treated as a VALID THIRD ANSWER, not a failure.**
  - **Worked examples:** an open at support level **S2** was followed by a **300–350 point rise**;
    a day that opened in the centre gave **no signal** and the market then consolidated in roughly a 300-point
    band (low ≈23,264, high ≈23,579); **a gap-down open BELOW support still resolved BULLISH**, with the high
    ≈150–200 points up.
  - **When price approaches a resistance line during the day, reduce or stop buying there.**
  - **ON EXPIRY DAY, EXPECT THE CLOSE TO COME BACK INTO THE WEEKLY RANGE. A push above resistance L1 on expiry
    is expected to return; a stand on support is expected to close back up.**
- **Instruction:** **if the weekly range gives NO VIEW, move to the 920 (day range) button rather than forcing a trade.**
  **Back-test on random historical dates** until the behaviour is familiar.
- **Honest note in-source:** the examples include two that worked **and one where the tool gave no signal** —
  honest about the tool's limits, but still a selected sample.

---

### VIDEO-132 — podcast with CA Sumeet Mongia
**Type:** Podcast. **NON-CORE for the calculator; three items worth keeping.**

- **⚠ WHY INDIA DROPPED AMERICAN-STYLE OPTIONS (a real market-structure fact):**
  - Indian stock options were once **American style, marked CA and PA rather than CE and PE.**
  - **Under a EUROPEAN option you can only exit if a buyer appears on the exchange.** Example: a call bought at
    ₹8 is worth ₹22 to buyers while sellers quote ₹40 — **you are stuck with the spread.**
  - **An AMERICAN option let the holder ask the exchange to close the position. The exchange then had to pick
    one of the short sellers AT RANDOM and force the assignment on them — an "unlucky draw".**
  - **That forced-assignment process needed heavy monitoring and left assigned writers aggrieved, so India moved
    to European options.**
  - **Liquidity has since removed the original problem: options no longer trade far below intrinsic value.**
- **HOW BIG MONEY BEHAVES:** mutual funds receive continuous inflows and **must deploy them** — unlike retail,
  **they ADD MORE AS THE PRICE RISES**, because the money keeps arriving. Their effort goes into selecting the
  company; after that the job is to hold. **Retail takeaway offered: if a mutual fund starts buying a stock,
  more fund money is likely to follow it.**
  **Mutual funds are largely BARRED from F&O; the newer SIF/AIF structures are allowed.**
  **Scale changes ambition: ₹20,000 wants several lakh; ₹2,000 crore asks whether he can get 3%.**
  **Both speakers say a trader needs ~a decade of watching the market — or at minimum 200 hours — before the
  same event reads as opportunity instead of disaster.**
- **ANATOMY OF A PUMP AND DUMP** (presented as devil's advocate): incorporate a small services company for
  ₹1–2 crore; take it public through an **SME IPO** at a nominal ₹5 crore valuation, allotting shares to friends;
  have those holders **trade between themselves** (a buyer bid at ₹20 against a seller at ₹20 on a share opened
  at ₹10 doubles the valuation on a hundred shares traded); repeat over the two to three years the company must
  remain on the SME platform; then build real volume to sell to the public.
  **SEBI counters this through ASM and GSM surveillance — the broker must show an ALERT at the buy button when
  the PE ratio is out of line with profits, or when price and volume swings are extreme. The alert does NOT BLOCK
  the purchase.** Rajesh Exports, RCom, Idea and Yes Bank cited.
- **THE TAX POINT:** **before 31 March, book the loss on a position that is under water, then buy it back the
  next day.** The cost is effectively restored while the loss enters the books; **that loss can be carried forward
  for eight years and set against future gains.** *(General commentary from a CA on a podcast, not advice —
  confirm against current rules.)*
- **One transferable discipline rule:** **test a new strategy or algorithm in a SMALL account, never in the main
  trading account.** The guest's own worst mistake was exactly this — the team removed the hedge on an
  algo-generated call buy, the market reversed, and one trade cost a whole month.
