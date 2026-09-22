# Per-file analysis — Part B: VIDEO-35 → VIDEO-69

This block covers: the stock scanner and its three filters, the weekly range, the blood-bath
signature, the detailed COA 1.0 scenarios, the Nagpur crash course (a cleaner re-teaching of the
basics), the **9:20 strategy**, and the arrival of the **AI LTP lines** — which is the form the
product finally settles into.

---

### VIDEO-35 — EP 26: the stock scanner and the THREE FILTER RULES
**Type:** Method. **Core — this is the canonical stock-trade filter.**

- **Why stocks:** Nifty/Bank Nifty are "entertainment" for intraday; expiry days drag the indices into
  consolidation, leaving an index-only trader with nothing. But ~200 F&O names need fast filtering.
- **Four stock tools on the home screen:** IDD Dips, IDD Picks, Rally Stocks, IDD Swing.
  **This episode covers IDD Picks only.** It runs on the live market and returns the stocks
  **currently sitting at their support or resistance** — the ones that can move today.
  Output split into **bullish** (parked at their bottom, ready to rise) and **bearish** (parked at the top).
- **Bias the side you trade towards your read on Nifty.**
- **Stocks show a MONTHLY range in the option chain, unlike Nifty and Bank Nifty which show a WEEKLY one.**
- **THE THREE RULES — all three must pass; one failure cancels the trade:**
  1. **Level type.** To buy a **Call**, **neither** the support nor the resistance may be **WTB**.
     To buy a **Put**, **neither** may be **WTT**.
  2. **Zeros on the in-the-money side.** Before buying a Call, check the **ITM call LTPs**; before a
     Put, the **ITM put LTPs**. **One zero is tolerable; more than one or two makes the trade dangerous.**
     **A price displayed as 37.1 is NOT a zero — only a zero value counts.**
     *(Note: this relaxes VIDEO-12's stricter "any zero → skip". See Open Question 10.)*
  3. **Implied volatility.** IV around the ATM strike should sit **around 20** and **must not exceed
     roughly 25 to 28**. Above that, accuracy and reversal quality break down.
- **Worked examples:**
  - *Ambuja Cement (bullish)* — monthly range 396–444, price ≈420. Resistance 420 **WTT** with strong
    support → **scenario 3**, allows a buy from the bottom. IV 20–21; a single zero on the ITM call
    side → all three rules pass.
    **Risky entry = the divergence near 425. Safer entry = the extension of support.**
  - *Ashok Leyland (bearish)* — both levels strong, no WTT reading, IV ≈21–22, no zero on the ITM put
    LTP → put buy allowed.
- **STOCK-SPECIFIC TARGET RULE:** price *can* run as far as the WTT resistance, **but in stocks the
  instruction is to book at the FIRST DIVERGENCE only** — stocks are slower and carry less volume and
  fewer traders than the indices.
- **Timing:** open IDD Picks between about **9:20 and 9:30 AM** in the live market.
- **Flagged in-source:** the zero-count rule and the IV ceiling are the speaker's own thresholds,
  given without evidence for the specific numbers.

---

### VIDEO-36 — EP 36: reading the WEEKLY RANGE, IV level, and level shift on the first day of a new expiry
**Type:** Method. **Core for the weekly-range path.**

- **Three questions answered on the FIRST trading day of a new expiry, from the 9:15 AM option chain:**
  1. How many points will Nifty travel this week?
  2. Will the week be more or less volatile than the last?
  3. Will the pressure be bullish or bearish?
- **How each is read:**
  - **Range size** — the weekly range gives a top and a bottom; **subtract one from the other = the
    distance Nifty is expected to cover during the week.**
  - **Volatility** — read IV around the ATM strike and compare with the **previous week's opening
    reading**. Higher = wider, faster week.
  - **Direction** — compare **this** week's support and resistance with **last** week's.
    **Both levels higher → bullish pressure. Both lower → bearish pressure.**
  - **IV never gives direction on its own** — only size. Direction comes from the level comparison and
    the COA reading.
- **Four weeks compared (illustrative; digits partly truncated):**
  - *11 Jan expiry (opened 5 Jan)* — range 21,885–21,432 ≈ **453 points**, IV ≈10. Actual travel
    ≈21,450–21,775 ≈325 points — comfortably inside.
  - *18 Jan (opened 12 Jan)* — range 21,905–21,390 ≈ **515 points**, IV 11–11.5. Both levels higher
    than the previous week → bullish. Nifty made its all-time high and still closed inside the range.
  - *25 Jan (opened 19 Jan)* — IV opened 14.6–14.7. Range 21,780–21,145 ≈ **635 points**. Resistance
    dropped 905→780 and support 390→145 → both lower → **bearish pressure**. Price opened at the top,
    worked down over three days, closed back inside.
  - *1 Feb (opened 29 Jan)* — range 21,680–21,025 ≈ **655 points**. Resistance down again 780→680,
    support lower → mild bearish. IV opened ≈17, 19–20 by mid-morning, 21–23 by ~1:25 PM.
    Nifty printed a high ≈21,760, closed ≈21,737 — **above the top of its own weekly range**.
    *(i.e. the range is not inviolable.)*
- **THE BIG-CANDLE RULE:** big candles are **not** produced by high IV by itself, but by a **sharp
  JUMP in IV within the week.** 25 Jan week jumped 10–11 → 14–15 and produced several unusually large
  candles; the recording day jumped 17 → 20+ and produced another.
  **A week where IV stays flat tends to give gap-ups and gap-downs with consolidation in between,
  rather than long candles.**
- **Instruction:** watch IV change **through the day**, not just at the open.

---

### VIDEO-37 — EP 37: the BLOOD BATH signature
**Type:** Theory + replay (Nifty, 8 February 2024, −300 points). **Core.**

- **A blood bath is the exception to divergence-to-divergence trading:** a single large one-directional
  move where the usual next-divergence target does not apply.
- **THE SETUP: scenario SIX of the Chart of Accuracy — BOTH resistance AND support weak towards bottom.
  Not scenarios one through five. Only six.**
  **When this appears, buying calls is off the table entirely.**
- **THE DISGUISED VERSION (important):** later in the day, resistance can read **strong** but only
  because **it has SHIFTED DOWN from a higher strike**, with support still WTB.
  **It looks like scenario four to the naked eye and is actually scenario six.**
- **Replay:**
  - Context: expiry day, RBI policy at 10:00 AM. Nifty opened ≈22,000, fell to ≈21,700.
  - **Pre-condition from the weekly range:** resistance sat at **22,122** and price had failed to close
    above it all week (Fri→Wed). **That alone raised the odds of 22,000 breaking.**
  - **9:15 first tick:** resistance 22,300 **WTB**, support 22,000 **WTB** → **scenario six from the
    opening second.**
  - 9:16: both levels shifted further down — still a blood-bath reading.
  - **9:19:** the resistance OI moved 22,300 → 22,000 and turned **WTT at its new strike. That PAUSES
    the fall.** With a level pinned at 22,000, price could only travel one divergence either way —
    ≈21,970 down, ≈22,027 up — and it traded in that band.
  - **9:57 (3 min before policy):** resistance now **strong**, support **WTB**. **Because that strong
    resistance had migrated DOWN from 22,300, it counts as BEARISH pressure, not support for a rally.
    Blood bath still on.**
  - 10:05 after the policy: one very large red candle; price stopped at ≈21,932 by ~10:15–10:20.
  - Bounce to ≈21,960–21,965, support shifted down again and turned WTB → second leg down.
  - **Three bearish pressures then stacked:** resistance shifted top→bottom, support shifted top→bottom,
    support WTB.
- **ENTRY:** click the **call side of the nearest resistance strike** to read its value. At the 21,950
  strike this returned ≈21,979–21,980 — the aggressive place to join the fall.
  Safer version: wait for the **next divergence above** that level.
- **FIRST TARGET — "weak towards bottom plus one":** take the **put-side divergence of the weak strike.**
  With the level at 21,900–21,950 this gave ≈21,932 — where the first leg stopped.
  On the second leg the nearest divergences read 21,936 and 21,985, with **21,849** available as a
  profit-booking level.
- **CRITICAL:** **in a genuine blood bath there is NO reliable floor.** Price may run through one, two,
  three or four divergences → **book progressively rather than predicting the bottom.**
- **General rule extracted:** **watch for OI shifting from a higher strike to a lower one. The SHIFT
  ITSELF is the bearish pressure, regardless of whether the level then reads strong.**

---

### VIDEO-38 — EP 38: COA 1.0 scenario one in detail, and the OR+1 / OS-1 notation
**Type:** Theory. **Core — this is the cleanest statement of the four-line construction.**

- **Direction matters more than entries:** small losses are survivable; the damage comes from one trade
  taken **against** the market's direction. The rule is therefore never to take a position against the
  COA reading, in Nifty, Bank Nifty, midcaps or stocks.
- **SCENARIO ONE — both sides strong. CRITICAL PRE-CONDITION:**
  **the level must have been strong FROM THE MARKET OPEN and must NOT have shifted.
  If it shifted during the day, this scenario does not apply.**
- **THE FOUR LINES. To get each, click the volume on the relevant strike and read the value returned.**
  Example is Nifty, morning of 7 February, key strike 22,000:

  | # | Line | How to get it | Value in example |
  |---|---|---|---|
  | 1 | **Extension of resistance** | Click the **call-side** volume of the 22,000 strike | ≈22,028 |
  | 2 | **Extension of support** | The matching **put-side** reading | ≈21,959 |
  | 3 | **OR+1** | One strike **above** the resistance (the 22,050 strike) | ≈22,058 |
  | 4 | **OS-1** | One strike **below** the support (the 21,950 strike) | ≈21,909 |

  The notation extends: **OR+2** is two strikes above resistance, **OS-2** two strikes below support.
  *(Elsewhere written EOR+1/EOS-1, UR+1/US-1, R+1. Same thing — see Glossary.)*
- **HOW THE LINES ARE USED:**
  - **First hit is SAFE.** The first time price reaches the extension of resistance or the extension of
    support, the reversal trade can be taken from that line on either side.
  - **Second hit is RISKY.** By then the first hit has weakened the level, more time has passed (first
    touch may have been 9:20–9:30, second at 10:30), and volume, OI and overall pressure have built up.
  - **On a second hit:** a **risky** trader can still enter at the extension line and, if price runs
    against him, **average at the OR+1 or OS-1 line**.
    A **safe** trader **skips the extension line entirely on the second hit** and waits for **OR+1**
    (for a put) or **OS-1** (for a call).
- **Draw all four lines BEFORE the first hit, not after it.**
- **Scale claim:** nine base scenarios → 121 detailed cases → over 8,000 combinations.
  *(VIDEO-112 and VIDEO-110 later say ~13,000. See Open Question 11.)*

---

### VIDEO-39 — EP 39: the "late strength" variant of scenario one
**Type:** Theory + replay (16 February 2024). **Core — the first of two path-dependency variants.**

- **Thesis:** two levels that look identical in a snapshot behave completely differently depending on
  **how they got there**. "History" here means replaying the same day's chain from 9:15 tick by tick.
- **Practical check when using historical data:** very low volume figures mean you are looking at
  **today's opening** data; a large figure like 42,000 means you have **rewound into the previous day**.
- **Reading the 16 Feb open:**
  - 9:15 first tick: resistance 22,000 carrying **both OI and volume**; support also at 22,000 but
    carrying **volume only**, and **WTB**.
  - **A DEFINITION GIVEN HERE AND NOWHERE ELSE:** *a resistance is weak towards bottom **only if it
    sits below the smaller strike of the imaginary-line pair.*** With price ≈21,998 that would require
    the market to have traded under 21,950. He checks the candle chart — Nifty never traded below
    ≈21,970 → **the condition failed and the resistance counted as strong.**
    → **This is an extra, structural constraint on WTB that is not repeated elsewhere.** Open Question 12.
  - As the first minutes passed the support's WTB percentage **deepened** → bearish pressure building
    → implying a reversal down from the extension of resistance.
  - **By 9:20 both levels read strong → scenario one, but arrived at LATE rather than present from the open.**
- **WHY LATE STRENGTH CHANGES THE DAY:** treat each level as a crowd pushing price. Equal pressure both
  sides = rotation. Here the support **first dropped, then pushed back up**, so **support-side pressure
  exceeded resistance-side pressure → the resistance is weaker than its label suggests.**
  - **Consequence: price frequently runs PAST the extension of resistance to the next line up
    (extension of resistance +1).**
  - Downside stayed capped because the support shifted upward.
  - Result that day: a 50-point band, ≈22,001 to ≈22,051, held until the 2:30 PM close.
- **HOW TO TRADE THIS VARIANT:**
  - **Safe put entry: wait for the extension of resistance PLUS ONE.** Selling puts at the plain
    extension of resistance is what gets a safe trader stuck in this variant.
  - **Risky put entry:** enter at the extension of resistance, **average at the plus-one line** if price
    continues up, book at cost or in profit when price returns.
  - **Calls:** buying at the extension of support is available but risky, because price can reverse
    before reaching it. **Exception: the FIRST touch of the day — an untested level will reverse on that first hit.**
- **Wait roughly five minutes after 9:15 before acting**, since the classification can change in the first minutes.

---

### VIDEO-40 — EP 40: the MIRROR variant (resistance briefly WTT before turning strong)
**Type:** Theory + replay (26 February 2024). **Core — completes the pair with VIDEO-39.**

- **THE PAIRED RULE — this is the cleanest statement of path dependency in the corpus:**

  | Early state | Then | Day's destination |
  |---|---|---|
  | Support starts **WTB**, then turns strong | (VIDEO-39) | Price runs one divergence **ABOVE** resistance → **extension of resistance +1** |
  | Resistance starts **WTT**, then turns strong | (VIDEO-40) | Price runs one divergence **BELOW** support → **extension of support −1** |

- **The claim:** the brief early state sets the whole day's bias, and **a single minute is enough to do it.**
- **Replay:** 9:15 resistance read **WTT at 22,300** in the 22,200–22,300 band. **By 9:16 it had turned
  strong**, with support also strong — the WTT state lasted about **one minute**.
  Reference lines: extension of resistance ≈22,200, extension of support ≈22,145, with the plus-one and
  minus-one lines outside them.
  Because the pressure had been created on the **downside**, the expectation was a move to
  **extension of support −1**, not to the upside line.
  ~9:20–9:25 price reached the extension of resistance almost exactly at 22,200 → **with the day's bias
  already known, that touch was the SELL entry.** By 9:30 extension of support −1 read ≈22,107 and price
  had come down to ≈22,096, then consolidated at that line for the rest of the day.
- **Instruction:** watch the first minute or two specifically for a level that is weak on one side and
  then hardens. **That transition is the signal, not the final strong-strong reading.**
- **Flagged in-source:** built on a single session; two further variants of the strong-strong scenario
  are deferred and (as far as this corpus goes) never delivered. → Open Question 4.

---

### VIDEO-41 — Free Intraday Trading Crash Course (Nagpur, with Amit Bhakte)
**Type:** Interview / framing. **Low logic content but sets up VIDEO-42/43.**

- **What an option chain is:** F&O are **derivatives** — price derived from the spot of the underlying.
  Options were originally created as **insurance for a cash holding**; a small limited payment caps the
  damage of an adverse move. Over time the use changed — traders now buy and sell options and futures
  directly with no underlying to protect.
- **The guest's process rules (these ARE the transferable content):**
  - **One lot only, one trade a day, held to for six months.**
  - **Never take a trade against the direction the data shows. Take only the setups classified as SAFE.**
  - **Copy the method exactly rather than adapting it.**
  - **Sit out entirely when nothing fits** — both speakers describe watching six hours and taking no trade.
  - Overtrading was the early trap: on four days of overtrading, three ended in a loss.
    **Stated priority: avoiding losses rather than chasing profit.**
  - He worked through **a full week of historical option-chain data in a single sitting, repeated for
    15–20 days** — i.e. the historical replay is the training mechanism.
- **Claimed results (unverified):** runs of 40–50 trading days without a losing day, best run 63
  consecutive trading days; audience members quoted 22 days and 230–238 days.

---

### VIDEO-42 — What Is an Option Chain (beginner screen tour)
**Type:** Product tour / beginner theory. **Useful as the canonical screen spec.**

- **Screen layout:** strike price column down the middle **in orange**; **call data left, put data right**.
- **Strike gaps are set by the exchange**: Nifty 50 points, Bank Nifty 100 points.
- **Lot size is set by the exchange, differs by script, shown at the far right.** (Nifty given as 50 here
  — outdated; later files say 75.)
- **The blue box above the strike column shows the SPOT price.**
- **Per-strike columns in order: LTP, change in points, VOLUME, OPEN INTEREST, change in OI.**
  **Open Interest is the fourth column on each side.**
- **Imaginary line:** a horizontal red line; **above it on the Call side and below it on the Put side the
  background is shaded grey** (i.e. the grey shading marks the OTM region on each side).
  The line always sits between the two strikes bracketing spot → the **pair of strike prices at the
  imaginary line**. Example: Bank Nifty spot ≈45,863 → pair 45,800 / 45,900.
- **ALL CALCULATIONS IN THE LTP CALCULATOR'S OPTION CHAIN ARE BASED ON THE SPOT PRICE, NOT FUTURES.**
- **What OI actually measures — the quiz that settles it:** 25 writers offer 3,000 Nifty lots and buyers
  take 100 lots. **Open Interest is 100** — not 3,000 and not 2,900.
  Classroom analogy: 50 seats, 30 students present → OI is 30. Unsold seats are irrelevant.
  **With no buyer at all, OI is zero however large the offer.**
- **Support is ALWAYS found on the Put side; resistance ALWAYS on the Call side.**
- **Flagged:** the claim "the writer always wins" is the speaker's own observation; both guests
  immediately note buyers and writers need each other.

---

### VIDEO-43 — What Are Volume and Open Interest (the running example)
**Type:** Theory. **Core — the clearest statement of the OI/volume mechanics and the S/R rule.**

- **Properties:**
  - Only a **writer** can create OI. **Volume** is created by writers and buyers alike.
  - **OI can rise or fall during the day. Volume only ever increases.**
  - **Volume resets every day — always intraday, never carried forward**, even though the contract runs
    to weekly expiry.
  - **"Change in OI" can go negative** (today's OI lower than yesterday's close). Volume's change never can.
- **THE RUNNING EXAMPLE (definitive):**

  | Step | Open Interest | Volume |
  |---|---|---|
  | Writers offer 5,000 lots, nobody buys | 0 | 0 |
  | Buyers take 3,000 lots | 3,000 | 3,000 |
  | Those buyers sell 2,000 lots | **3,000** | 5,000 |
  | Writers buy back 1,000 lots | **2,000** | 6,000 |

  **OI stays at 3,000 when buyers sell among themselves, because the writer's position has not changed.
  OI only falls when the WRITER closes out.**
  **An offer nobody takes is invisible: until a buyer transacts there is no OI and no volume to see.**
- **THE OVERTRADING FEEDBACK LOOP:** volume is the one input a **buyer** controls. Every extra round trip
  adds to it. Green candle → buy Call, red candle → buy Put, all session. **That flow builds volume at a
  strike → attracts writers → builds OI → forms resistance on the Call side.
  The trader's own activity helps create the level that blocks the move he wants.**
- **THE SUPPORT/RESISTANCE RULE RESTATED (with the direction stated as "where the LTP is falling"):**
  Both start from the pair of strikes at the imaginary line and move **in the direction where the LTP is
  falling (out of the money)**.
  - **Support** — on the **Put** side, start from the **HIGHER** strike of the pair and read **downwards**.
  - **Resistance** — on the **Call** side, start from the **LOWER** strike of the pair and read **upwards**.
  - In that direction, find the strike showing the **highest volume** and the strike showing the
    **highest OI**, **each marked as 100 percent**.
  - **If they sit at different strikes, the one CLOSER TO THE IMAGINARY LINE is the level.
    If both fall on the same strike, that strike is support (or resistance) of BOTH volume and OI.**
- **The LTP Calculator prints "current range", "resistance" and "support" at the top of the screen**, so
  the manual reading can be checked against the tool.
- **Examples:** Nifty support 21,900 / resistance 22,000 both on volume; Bank Nifty resistance 46,000 /
  support 45,800; a stock with support 165 / resistance 170.
- **AN ON-SCREEN DISAGREEMENT WORTH RECORDING:** the two hosts disagree about strength.
  One says a level backed by **volume + OI** is stronger and **volume alone is weak**; the other says a
  level works equally well whichever column produces it. **Neither position is demonstrated.**
  → This contradicts VIDEO-05, which ranks volume-only ABOVE OI-only. Open Question 2.
- **A further personal claim:** a resistance formed from volume, OI **and OI-change** together does not
  break **within a market phase**, but breaks **when the phase changes**. Offered as five-to-six months
  of personal observation.

---

### VIDEO-44 — the user's ten-trade probability model
**Type:** User interview (Akash Garg). **Useful as an expectancy model, not as new option-chain logic.**

- **Scope:** applies to **strong resistance and strong support at the SAME strike price**, assumed to
  hold unchanged over a short window rather than a whole day.
- **Structure:** four horizontal lines — resistance and its extension above, support and its extension
  below. Price hitting the upper line has two outcomes; he assumes **50:50 across ten occurrences** —
  five reverse down (profitable), five continue up. Of the five that continue, he pessimistically
  assumes three go further against and only one or two come back.
- **His assigned numbers:** a correct move from level to target ≈ **30 points of premium**.
  A wrong-way trade loses ≈ **40 points**; holding past the next line adds 10 → **50 points**.

  | | Safe trader | Risky trader (averages in) |
  |---|---|---|
  | Best case (5 correct) | +150 | +150 |
  | Moderate case | 0 to +30 | +120 |
  | Worst case (3 losses) | −120 | −60 |
  | **Net over 10 occurrences** | **+60** | **+90** |

  At a lot size of 50: ≈**₹3,000/month** safe, ≈**₹4,500/month** risky, assuming the setup appears
  ~10 times in a 20-day month. **He notes the safe trader's ₹3,000 is close to break-even after brokerage.**
- **Plan A / Plan B:** Plan A is the profit exit; **Plan B is what happens when the trade goes against
  him, and he argues Plan B is what separates profitable traders.**
- **Rules:** wait for the defined value; do not exit early on a 10-point adverse move; **do not cut the
  stop until price has actually travelled to the third line of the plan**; run at least ten occurrences
  before judging; start at the safe version.
- **Honest caveats in-source:** every probability is his own assumption, not measured; the whole framework
  depends on the scenario not changing during the trade, and when it does, the response "has to come from
  experience and cannot be written down".

---

### VIDEO-45 — EP 45: screen versions, and STRIKE PRICES AS STAIRS
**Type:** Theory + live session. **Core — introduces the per-strike range model.**

- **Which screen version to use:** Option Chain menu offers **Detailed Option Chain, Option Chain PCR,
  IV, TV and Compare**.
  - **Compare** runs on **delayed data, ~1.2 seconds behind**.
  - **Version 24** updates live but is **beta**; when it goes down on an update day, fall back to Compare.
  - Version 24 shows a thick line with the market price printed on it; Compare shows the thin red imaginary line.
- **Imaginary line restated, with the VISUAL TRAP:** because strikes are printed **smallest at the top**,
  **a falling market appears to move the line UPWARD on screen. It is not.**
- **STRIKE PRICES AS STAIRS (the model):**
  - The market climbs or descends **one step at a time and cannot jump.**
  - **Every strike price has a RANGE extending above and below it, and these ranges OVERLAP with the
    neighbouring strikes.** A strike at 500 might reach down to ≈457 and up to ≈550; a strike at 550
    might reach down to 506 and up to 556.
  - **Only ONE strike at a time shows values on BOTH sides. That strike is wherever the market is
    currently standing.** From that step you can see the step above and the step below, **and no further**.
  - **A move to the next strike requires the current strike's value to BREAK OUT.** Worked from 14 June:
    price moves from the 350 step to the 400 step only once the **350 call-side value (≈367–370) breaks**,
    and the **400 put side then converges to roughly the same number.**
  - Framing: every strike tries to hold the market near itself ("its last wish").
- **SOC STAGE TWO defined here:** **one side's percentage varying between 75 and 99 while the other side
  stays strong.** Reading that pattern live, he expects a state of confusion **within about two hours.**
  → This gives SOC a **three-stage** structure. → Open Question 13.
- **A state of confusion does NOT end a bull run permanently — it PAUSES it. Once the percentage jumps,
  the move resumes.**
- **Practical session note:** when a shift is **slow** rather than forceful, participants see it coming and
  step aside, which makes the shift harder still. **Take the 10 or 20 points on offer rather than waiting
  for more.**
- **Method instruction:** do not trade on a single signal. Study time value, intrinsic value, Vega, Theta,
  Gamma, volume and IV **together** (the doctor analogy: one symptom is not a diagnosis).

---

### VIDEO-46 — EP 46: LTP defined, and the insurance model
**Type:** Theory. **Core for the hedging path.**

- **LTP = LAST TRADED PRICE** — the price at which the most recent trade between a buyer and a seller
  executed. **That is where the tool's name comes from.** The market price is simply the last completed
  transaction, nothing more. LTP can be read on spot, futures and options.
- **The insurance model:** a ₹6 lakh car insured for a ₹25,000 annual premium — the insurer can promise
  full replacement because it collects that premium from many people. 10,000 policies × ₹25,000 = ₹25 crore;
  500 write-offs cost ₹6 crore and it keeps the rest.
  **The option writer is in the insurer's position. The buyer is the single policyholder.**
- **A stock position with no option against it is a NAKED TRADE.** No insurance company will cover a share
  price — the options market is where that cover is bought.
- **THE ITC WORKED EXAMPLE:**
  - ITC at ₹430, lot size 1,600, so **3,200 shares = two lots. A ₹10 move is worth ₹32,000.**
  - Insurance: buy the **425 put at ≈₹2.50** → ≈**₹8,000** for 3,200 shares.
  - ITC rises ₹10 → cash gains ₹32,000, put expires worthless → **net ≈₹24,000**.
  - ITC falls → the put gains as it moves ITM, offsetting the cash loss.
  - ITC expires at ₹400 → cash down ₹30/share but the 425 put is worth ≈₹25 → **small, known loss
    instead of ₹96,000.**
  - **The trade-off is direct:** a higher premium (closer strike) reduces the profit on an upmove and
    reduces the loss on a downmove by the same logic. Further OTM costs less, leaves more upside, covers less.
- **The behaviour it fixes:** without cover, a ₹1–3 adverse move produces fear; the claim is 99 out of 100
  traders exit there and miss the recovery. **With a put in place the same move is tolerable because the
  loss is capped, so the position can be held to its intended horizon.**
- **On a reversal back to entry:** either close the put and keep the cash position, or **ROLL the put down**
  to a lower strike (425 → 400) if the fall is expected to continue.

---

### VIDEO-47 — EP 47: chart + option chain combined, and all three states in one day
**Type:** Replay. **Core — first statement of the automatic four-line chart overlay, and of scenario NINE.**

- **The combined screen plots the option-chain levels directly onto a candlestick chart, drawing FOUR
  LINES AUTOMATICALLY: extension of resistance, extension of resistance +1, extension of support, and
  extension of support −1.**
  **Earlier versions required the market price, Call data, Put data, IV, Theta and Delta to be TYPED IN
  MANUALLY before a reversal price could be calculated. That is now automatic.**
  → This is an important historical fact: **the reversal price is a function of
  (spot, call LTP, put LTP, IV, theta, delta)** at minimum. See VIDEO-124 for the same list.
- The four lines were drawn at **9:20 AM** and the entire day's range stayed inside them — the low reached
  extension of support −1 and no further.
- **BUT: the lines are NOT fixed here.** When resistance shifted down the extension moved down with it;
  when price went back up, the extension moved back. **(This is the "Live lines" behaviour. Contrast the
  "9:20 lines", which are static — VIDEO-48 onward.)**
- **Historical data is free after download; live data requires a subscription.**
- **HOW THE DAY DEVELOPED — three states in one session:**
  - **9:15–9:20 — SCENARIO NINE.** First tick: resistance formed at 24,700 **WTB**, and support formed at
    24,600 **also WTB**. **Both sides WTB at the open is "the number nine scenario".**
    *(Note: this conflicts with VIDEO-13, where scenario 6 is WTB/WTB and 9 is "the two levels move against
    each other". → Open Question 14.)*
    Scenario nine allows trades at both extensions **but can flip into a blood bath or a bull run at any
    moment. That is what makes it dangerous.**
  - **~9:30 — BULL RUN.** Resistance percentage climbed to 89–90 then **fell back, releasing the bearish
    pressure**, while support's WTB reading strengthened into **bullish** pressure. Price ≈24,610 with
    extension of support at 24,582, so the buy level was never reached; price then rose to ≈24,675 and consolidated.
  - **~11:00–12:30 — STATE OF CONFUSION.** Resistance began shifting and stayed unresolved for hours while
    support remained strong on its own. **Rule restated: an SOC is DEFINED by the other side still being strong.**
  - **~12:20–12:30 — the trade.** Price reached extension of support ≈24,580 with SOC on the resistance side
    and strong support → **Call buy**. Price dipped to extension of support −1 ≈24,540 → **averaged there**.
  - **Exit:** the SUPPORT percentage rose past **75**, which **ends the state of confusion** → exited at cost
    or small profit.
  - **Afternoon — blood bath re-forming.** Resistance percentage went back toward 97 (bearish pressure
    restored) while support weakened towards bottom. **With both sides in confusion from ~12:45, the day
    became a BOTH-SIDE STATE OF CONFUSION, which KILLS MOVEMENT.** No further trade before the 2:30 exit.
- **RULES STATED:**
  - Resistance WTB → bearish pressure. Support WTB, **once it strengthens**, → bullish pressure.
  - **Both pressures bearish = blood bath. Both bullish = bull run.**
  - **An SOC needs at least an hour, and ENDS as soon as the opposite side stops being strong.
    The threshold for that side losing strength is a percentage reaching 75.**
  - Trading an extension of resistance while the resistance percentage is **climbing back** is dangerous —
    **there is no sensible place to put a stop loss** and the position gets cut for no reason.
  - **Do not buy at immediate support — wait for the extension of support.**
- **Honest note:** the speaker chose this session deliberately to show that **correct entry + correct
  average + correct exit can still produce almost no money.**

---

### VIDEO-48 — The NIFTY 9:20 STRATEGY — the full rule set
**Type:** Method. **Core — this is a complete, standalone, mechanical strategy.**

- **How the four lines are made:** open the LTP Calculator, choose the Chart or Option-Chain-plus-Chart
  layout, click the **9:20** button. **Four dotted lines appear automatically.**
  **They are calculated ONCE, at 9:20 AM, from the option chain data and the Greeks, and are STATIC — they
  do not move for the rest of the day.**
- **From top to bottom: extension of resistance +1, extension of resistance, extension of support,
  extension of support −1.**
- **The strategy is for NIFTY ONLY.** Other instruments have their own strategy.
- A **question-mark button** next to the 9:20 control opens the written rules inside the tool.
  **The lines are also drawn on historical dates, so the strategy can be back-tested.**
- **WHICH LINE DOES WHAT:**
  - **The top two lines are PUT levels.** Price arriving there is a Put buy.
  - **The bottom two lines are CALL levels.** Price arriving there is a Call buy.
  - **The OUTER two lines (EOR+1, EOS−1) are the SAFE trades** — the stop loss is close.
  - **The INNER two lines (EOR, EOS) are the RISKY trades** — the stop loss is much further away.
- **TRADING RULES:**
  - **New trades may be initiated between 9:20 and 11:30.** Positions may be managed until **2:30**, and
    **everything is closed at 2:30** whether or not the target was reached.
  - **Only the FIRST touch of each line counts.** A second visit to the same line is not a trade.
    **This is what caps the day at four trades.** Some days give four, some one, some none.
  - **The TARGET for a trade at one line is the NEXT LINE in the direction of the trade.**
  - **If price moves against the position to the next line out, AVERAGE there with the same lot size.**
  - **If you cannot fund the average, do not take the inner (risky) line at all — wait and take the outer
    (safe) line instead.**
- **READING THE STOP LOSS OFF THE OPTION CHAIN:** switch to the Option-Chain-plus-Chart layout and find
  the option value that matches the line's number.
  - **For the UPSIDE lines: take the NEXT LARGER value on the RESISTANCE side and ADD 10 points.**
    Example: line value 2573, next resistance value 2622 → **stop loss 2632**.
  - **For the DOWNSIDE lines: take the NEXT SMALLER value on the SUPPORT side and SUBTRACT 10 points.**
    Example: value 373 → **stop loss 363**.
  - **Both the risky and the safe trade on the same side SHARE the same stop loss.** That is why the
    distance differs:

  | Entry | Stop loss | Spot risk | Approx option risk |
  |---|---|---|---|
  | Risky Put at 2525 | 2632 | ~110 pts | ~50–55 pts |
  | Safe Put at 2573 | 2632 | ~50–60 pts | ~30 pts |
  | Risky Call at 476 | 363 | ~110 pts | ~50–55 pts |
  | Safe Call at 428 | 363 | ~65 pts | ~25–30 pts |

---

### VIDEO-49 — the 9:20 strategy, second pass (RBI policy day)
**Type:** Method, reinforcement. **Core — adds the rationale and one extra step.**

- **Why the tool computes the lines:** the chain changes on many fronts at once — volume shifts, OI shifts,
  S/R redefine themselves around the imaginary-line pair, IV rises and falls, the Greeks move, premiums
  decay, and spot/futures/cash diverge. **No trader can track all of that simultaneously, so the tool does
  it and outputs four lines.**
- **The evaluation runs between 9:20 and 9:21.** The lines are then fixed for that day **and in the
  historical record afterwards.**
- **Uncheck Live, check 9:20** → four dotted lines on a plain chart. **No price-action reading is involved.**
- Top line = extension of resistance +1 = **the top of the market**. Bottom = extension of support −1 =
  **the bottom of the market**.
- **Stated risk sizes:** safer trade ≈**50 points of spot / ~25 points of option premium**;
  risky trade ≈**100–120 points of spot / ~50–60 points of premium**. **Nifty lot size given as 75.**
- **On the RBI policy day shown, both outer lines were hit once and both reached target.**
- **THE STOP-LOSS CALCULATION, WORKED (three steps) — buying a PUT, read from the CALL side:**
  1. Take the value sitting next to the line you are trading. For a Put at **643**, the nearby Call-side
     value is **657**.
  2. Move to the **strike just below that value**. Its value is **708**.
  3. **Add 10 points → stop loss 718.**
  - Both the safe and risky Put share that 718 stop. From 643 ≈60 spot points / ~30 premium points;
    from 594 ≈120 spot points / ~60 premium points.
  - **Stated reason both share one stop: the top of the market is a property of the market, not of your
    entry. The market does not adjust to your position size or capacity.**
  - The Call side mirrors this from the Put side of the chain.
- **The full rule sheet is inside the tool under the question mark: four rules for Calls, one for Puts,
  three of which are shared — five distinct rules in total.**
- **The TARGET rule is deliberately withheld here and turned into a comment contest.** → Open Question 15.

---

### VIDEO-50 — the WEEKLY RANGE (W button), L1/L2/L3, and the ±375 projection
**Type:** Method (Wed 12 Feb 2025). **Core for the range path.**

- **Press the W button in the centre of the screen to display the weekly range.**
- **Three levels each side: L1, L2 and L3 for both support and resistance.**
- **These are STANDARD DEVIATIONS.** Reliability as given here: **≈66% at L1, ≈95% at L2, ≈99% at L3**,
  so reversals are expected at L3.
  *(Other files say 65%. Treat as ~1σ/2σ/3σ. See Open Question 16.)*
- **On the day:** Nifty had broken L1 support (≈23,275), fell to **L2 support 22,929**, reversed there and
  closed above it. **L3 support 22,580.** Reading: the market respected L2; with one day to expiry, the
  probable Thursday close is at or above L2.
- **PROJECTING THE FOLLOWING WEEK — one number, added and subtracted:**
  - **The fixed number is 375**, said to be derived from Option Greeks. The derivation is **not** repeated.
  - **Take the expected Thursday close. ADD 375 → next week's resistance. SUBTRACT 375 → next week's support.**

  | If Thursday closes at | Next week's resistance | Next week's support |
  |---|---|---|
  | ~23,275 (L1) | ~23,650 | ~22,900 |
  | 22,929 (L2) | ~23,305 | ~22,550 |
  | 22,580 (L3) | *left as homework* | *left as homework* |

  - **The comparison that makes it bearish:** the current week's resistance ≈23,977 and support ≈23,271.
    Both projections sit well below → next week is weaker than this one either way.
- **Flagged in-source:** 375 is fixed **for this analysis** and is specific to this market level and date.
  **The video never says how often it is recalculated or how it scales.** → Open Question 17.
- **Context:** Nifty had just printed **six consecutive red daily candles**, called rare (usually 3–4 then
  a green or a doji). The argument for the chain: a price chart can mark a support, but it cannot tell you
  whether that level will hold.

---

### VIDEO-51 — Live lines + 9:20 lines on one screen; target/stop from the chain; stocks
**Type:** Long replay (24 February 2025). **Core — one of the densest operational files.**

- **THE THREE RAW INPUTS:** "the option chain has only three pieces of raw exchange data:
  **LTP, VOLUME and OPEN INTEREST**. Everything else — change in LTP, change in OI, implied volatility,
  the Greeks — is **calculated** from those."
  **This is the single most important architectural statement in the corpus.**
- **Volume is public-driven:** 83,000 at the 22,600 strike ÷ lot size 75 = the number of lots actually traded.
- **"The tool's analysis runs for SIX MINUTES in the morning and outputs four lines."**
  *(Elsewhere: five minutes, 9:15–9:21. → Open Question 18.)*
- **TWO LINE SETS ON ONE SCREEN:** choose **Option Chain plus Chart** from the layout button next to Spot.
  The chart carries two switchable sets: **LIVE lines**, which move with the market, and **9:20 lines**,
  which are fixed for the day.
- **Historical replay** is opened through the clock icon in the left sidebar: pick expiry, date and time,
  submit, then **play** to watch the chain move in real time.
- **THE FOUR 9:20 LINES, TOP TO BOTTOM:**

  | Line | Trade | Why |
  |---|---|---|
  | Extension of resistance +1 | **Moderate Put** | Small stop loss |
  | Extension of resistance | **Risky Put** | Large stop loss |
  | Extension of support | **Risky Call** | Large stop loss |
  | Extension of support −1 | **Moderate Call** | Small stop loss |

  **"Risky" refers to the SIZE OF THE STOP, not to how often it is hit.**
  If price moves against a position taken at an inner line, **that is not a stop — it is the point to
  average at the outer line.**
  Cost of the risky Call in this session: the two lines ≈50 spot points apart ≈25 points of premium
  ≈₹1,800 on a 75 lot. **If that is not acceptable, wait for the outer line instead.**
- **THE TRADE ON 24 FEB:**
  - Extension of support **22,547**. Resistance ≈23,000, support ≈22,600 — a **400-point gap, read as a
    consolidated day**.
  - Price drifted down and touched **22,541** ~10:24 → the risky Call entry.
  - **FINDING THE TARGET:** take the line's value (547), look on the **OPPOSITE side of the chain** for the
    nearest matching reversal price. **The nearest value was 527 on the Put side; the first reversal price
    visible on its Call side was 577 → that is the target** (~70 points, reached within ~10 minutes).
  - **On target size:** the calculator only shows the move the chain can currently see. **A small visible
    target means a small move, and taking it is correct.**
  - **FINDING THE STOP LOSS:** from the level value 496, find the nearest **Put-side** value **481**,
    **step down one divergence to 430, then subtract 10 points → stop 420.**
  - **Only ONE 9:20 trade appeared all day.** Price never reached the other three lines.
- **THE LIVE-LINE READING OF THE SAME DAY:**
  - Early morning: support shifted bottom→top and resistance shifted up to 23,000 and strengthened.
    **Both shifting upward reads as a BULL RUN — but only once price reaches extension of support ≈22,550.**
  - ~9:48 resistance bottomed out and the bullish read ended. Volume went WTB at 600 and OI at 800, which
    he calls **the normal sequence for a resistance shifting down and then re-forming as WTT at the new level.**
  - **From ~noon the resistance stayed unresolved for about three and a half hours while support held
    strong → a STATE OF CONFUSION → buy at extension of support ≈22,520, exit at the resistance WTT level
    ≈22,762, or at 2:30, whichever comes first.**
  - **The SOC trade is only valid while the opposite side stays strong. A support bottom cancels it.**
  - A triple bottom formed on support late in the day, too late to be tradable.
- **STOCKS — the four lines labelled C1, C2, P1, P2:**
  - **THE PAIRING RULE:** if the day's first touch is on **C2, you do not trade P2 that day**, and vice
    versa. The same holds for **C1 and P1**. **Only one side of each pair is tradable.**
  - **BULLISH RISK RATING:** 0 is best, 1 is risky, 2 is highly risky, **3 is the rarest and worst.**
    On a stock rated 3, take no more than two Call buys and two Put buys.
  - Examples: Bank of Baroda one trade → target; Coal India one trade → target; Federal Bank came close to
    its 875 target but missed then gave a stop, **with its bullish risk of 3 flagged as the reason for
    caution**; HDFC AMC started at C1 and never touched C2 or P2 → one trade only; Escorts rated 2.
  - **Workflow: filter for stocks showing ZERO bullish risk, then trade the ones highlighted on C1 or C2.**
- **Honest note in-source:** the speaker states plainly that F&O are among the riskiest instruments in India
  and that anyone promising to double money in ten days is misleading you.

---

### VIDEO-52 — the same 9:20 method, restated, plus five random stocks
**Type:** Replay. **Core — adds several rejection rules not stated elsewhere.**

- **The tool draws four lines after analysing the market between 9:15 and 9:21.** Before 9:21 only the
  **Live** lines exist; the 9:20 lines appear once that window closes.
- **Top to bottom: moderate resistance, risky resistance, risky support, moderate support.**
  Upper two = put-buying zone; lower two = call-buying zone.
  **"Risky" and "moderate" refer to STOP-LOSS SIZE, not signal quality.**
- **History player: replay any past date tick by tick at 1x, 2x or 4x.**
- **RULES:**
  - **No trade unless price is actually sitting on one of the four lines.** Anything in the middle is ignored.
  - **Each line is good for ONE trade per day.** A second touch is not traded.
  - **The TARGET is the reversal price directly OPPOSITE on the option chain.** Example: a put entered at
    a put-side level of 598; the matching call-side value ≈547–549 became the target. Price bottomed ≈545 → target reached.
  - **A risky put has NO stop loss. Instead you AVERAGE — add the same number of lots you already hold.
    If you cannot fund that second lot, do not take the risky line; take the moderate line, where a normal
    stop applies.**
  - **"The extension of a reversal price is 10 points beyond the outer reversal price; the stop loss sits
    10 points inside the nearest one."** *(The two "10 points" rules here and in VIDEO-48/49 are the same
    family but stated with opposite sign conventions — see Open Question 19.)*
  - **The tool has a calculator field: type the index level into the reversal price box and it returns the
    matching option premium for entry and for the stop loss.**
- **STOCKS — additional rejection rules:**
  - Lines labelled **C1, C2, P1, P2**. **Once C1 is traded, P1 is not taken that day; once C2 is traded,
    P2 is not taken.**
  - **A "bullish risk" and "bearish risk" number sits above the chart. ZERO is the best condition for that
    side, ONE is tolerable, TWO or more means skip the trade.** Dalmia showed bullish risk **5** → no
    bullish trade; Hind Copper **3** → call side dropped.
  - **If a stock OPENS EXACTLY AT ITS C2 line, no trade is taken in that stock all day** (Chambal Fertilisers).
  - **If a line's stop loss OR target is already reached inside the first or second candle, that trade is
    skipped.** Balkrishna's first-candle high 2698 against a stop ≈2600-something → **void before it started.**
  - Results shown: BPCL — one stop-out on C1, one C2 trade that never reached target and was closed at cost;
    Gujarat Gas — hit target on both P2 and C2.
- **Instruction:** pick five stocks and follow them for a full week rather than scanning everything.

---

### VIDEO-53 — A Live Trading Psychology Test
**Type:** Psychology / discipline. **Low new logic, high behavioural content.**

- Historical chain data for an undisclosed date is replayed at real-time speed from 9:15; the guest cannot
  recall the outcome. **The host's point about back-testing: at 9:15:45 on a replay everybody becomes an
  idealist, because no real position is open.**
- **The guest's stated rule:** enter only at the extreme — extension of support or extension of resistance —
  **and only when the percentage reading on the opposite side STOPS RISING.**
- He declined nearly every setup, then passed on at least two that later worked, then under pressure took a
  call-buy that went into profit — **which the host tells him to stop rather than bank, because it was
  against his own framework** (specifically: **buying calls during a blood-bath reading**).
- **Rules restated:** do not trade while price sits between two lines; **do not re-trade a level that has
  already given its trade and hit its target that day**; for the first two years refuse every trade that
  runs against the chain reading, even when it looks profitable.

---

### VIDEO-54 — the AI LTP Calculator: SEVEN market states and EIGHT lines
**Type:** Product spec. **Core — this is the definitive spec of the AI layer.**

- **Setup:** sign up (name, mobile, email, password) then recharge; plans one week to one year.
  Option chain opens from the stack-of-cards icon under the home button. A **history player** replays a
  past date at real speed (walkthrough uses 9 May, 15 May expiry, Nifty opening ≈23,971).
  **The dashboard lists stocks with a status and a likely day range for each** (e.g. a stock in bull run
  with a range of 1501 to 1516).
- **THE SEVEN MARKET-DIRECTION READINGS.** The line above the chart names one of seven states, and
  everything else follows from it:
  1. **Neutral** — no direction; price stays inside one or two ranges.
  2. **Slight bullish** — prefer buying from the lower levels.
  3. **Bull run** — a strong upward move expected.
  4. **Slight bearish** — direction is downward.
  5. **Blood bath** — a large fall.
  6. **Both sides risky, EIGHTH scenario.**
  7. **Both sides risky, NINTH scenario.**
  **The reading can change within the first minutes** — the example flips slight-bearish → slight-bullish
  about thirty seconds after the open.
- **THE EIGHT AI LINES.** Red lines carry an **R** (bearish trades); green lines carry an **S** (bullish).

  | Line | What it is for |
  |---|---|
  | **R Max Pain** | **Stop loss for any BEARISH trade** (dotted) |
  | **R Moderate** | Conservative bearish entry, **smallest stop** |
  | **R Risky** | Bearish entry for risk takers |
  | **R Max Gain** | **Exit / target for a bearish trade** (dotted) |
  | **S Risky** | Bullish entry for risk takers |
  | **S Moderate** | Conservative bullish entry |
  | **S Max Pain** | **Stop loss for any BULLISH trade** (dotted) |
  | **S Max Gain** | **Exit / target for a bullish trade** (dotted) |

  - **Not all eight appear every day. Anywhere from two to eight can be drawn, and THE NUMBER THAT APPEARS
    IS ITSELF PART OF THE SIGNAL.** The **AILTP** button toggles them off.
- **Stated basis:** a reversal-price model — when the demand/supply ratio shifts enough price can reverse;
  **the strongest reversal price is picked using VOLUME and OPEN INTEREST at each strike, with OPTION
  GREEKS in the calculation.**
- **Instructions:** wait **five to seven minutes** after the open before acting. Read the direction line
  first, then pick the side you are allowed to trade. **Use R Max Pain as the stop on any bearish trade and
  S Max Pain on any bullish trade, WHATEVER method you actually used to enter**, and exit at the matching
  Max Gain.
- **⚠ TERMINOLOGY WARNING:** "Max Pain" here means **STOP LOSS**, not the classical max-pain strike.
  "Max Gain" means **TARGET**. Do not import the industry meanings.

---

### VIDEO-55 — a full day under the AI lines (9 May)
**Type:** Replay. **Core — shows how state changes drive the line set.**

- The direction line opened **slight bearish**, flipped to **slight bullish** within the first minute,
  turned **slight bearish** again ~9:24, and later became **both sides risky**.
- **KEY RULE:** when Nifty was slight bullish, **the R Moderate line was MISSING from the chart.
  Stated reason: if the day's bias is bullish there is no safe bearish entry, so no moderate resistance
  line is drawn. THE NUMBER OF LINES SHOWING IS ITSELF INFORMATION.**
- **Bullish setup at that point:** S Risky at 24,000 with a stop near 23,900 (~100 points) and
  S Max Gain at 24,450 (~450 points of target). Price was still above the entry → nothing to do.
- After the flip to slight bearish, a short was available **with a large stop**. Opening the option chain
  showed why: **both the highest volume and the highest OI sat at the 24,500 strike, so the model widened
  the stop around that strike.** → **The Max Pain line is anchored to the heaviest strike.**
- That short reached **R Max Gain ≈24,798**. The reading then turned **both sides risky**, and **the same
  level became a bullish entry at S Risky**, with S Max Gain as the new target. That long also worked.
- **CHOOSING A SIDE UNDER BOTH-SIDES-RISKY: compare the two STOPS before choosing.** Here R Risky carried
  a 400-point stop while S Risky carried ~200 → **the bullish side was the less exposed trade.**
- **COA 1.0 stated simply:** track how support and resistance move inside the chain; **if the reading is
  slight bullish, give priority to bullish trades that day.**
- **The reading must be rechecked continuously. A position taken under one state should be reassessed the
  moment the state changes.**

---

### VIDEO-56 — The Retail Trader Mindset (zero-sum thought experiment)
**Type:** Essay. **NON-CORE for logic; one useful market-structure fact.**

- **Pure intraday F&O is a zero-sum game.** It stops being zero-sum once positional trading, option
  writing, BTST and cash trading are included. **Even in the zero-sum case both sides pay brokerage**, so
  broker, exchange and clearing corporation earn regardless.
- **SEBI figures quoted:** FY2022–FY2024, ~93% of retail F&O traders lost money, ~7% profited; within that
  7%, only the top 1% made more than ₹1 lakh. **Retail losses ≈₹1.8 lakh crore over three years**, going
  to prop firms, foreign funds and institutions. *(The transcript garbles one figure — the source file
  flags it. Verify against the study.)*
- **Conclusion:** a market only functions when views differ. The winners are not lucky — they may trade
  only 200 of 365 days, lose on half, and still finish profitable. **Discipline, not frequency.**
- **Notable honesty:** he applies the same answer to his own tool when asked what happens if everyone uses
  the LTP Calculator.

---

### VIDEO-57 — Using the AI lines: the STOP-TO-TARGET RATIO test
**Type:** Replay (2 May). **Core — introduces the ratio gate.**

- **Reading order:** check the **market-state line at the top first** (bull run, both sides risky, blood
  bath…). Then select **AILTP** from the three tabs on the right (the others are **Live Lines** and **920 Lines**).
  Option chain left, chart right, draggable divider. **A speaker button and a chat button announce every
  change of market state, by voice or in writing.**
- **WHAT THE LINES DO AND DO NOT SHOW:**
  - **Lines only appear for the side the current state permits.** In a **bull run no red resistance lines
    are drawn at all**. In a **blood bath the S lines turn grey and buying disappears.**
  - **A GREY line means that trade has VANISHED — it was there before and is no longer valid.**
  - The state changed repeatedly in the first minutes → **wait three to five minutes and let it settle.**
- **THE RATIO TEST:**
  - Whatever line you enter from, **Max Pain is the stop and Max Gain is the target.** R lines use the R
    pair; S lines use the S pair.
  - **Before entering, measure both.** In the replay **R Risky offered a 200-point stop for a 100-point
    target → rejected. R Moderate offered a 100-point stop for a much larger target → the one worth waiting for.**
  - Price first reached R Moderate ~10:10–10:15 — roughly **an hour after the open**. Everything before
    that was a wait, not a missed trade.
- **DIVERGENCES AS PARTIAL EXITS:** **every reversal price between your entry and Max Gain is a divergence,
  and each one is a valid place to book part of the position.** From an entry ≈580 the first divergence
  was 535 and the second, which was also R Max Gain, ≈490.
- **If price touches the same line a second or third time, the risk on that touch is higher than on the first.**
- **If you enter at S Risky and price falls to S Moderate → AVERAGE (add the same number of lots) rather
  than exit in fear.**
- **Instruction:** accept doing nothing. The tool is explicitly **not** designed to hand you a trade every
  session. **If you already trade by price action, overlay the Max Pain and Max Gain lines on your existing
  method instead of abandoning it.**

---

### VIDEO-58 — Gurukul Season 6 Day 3 (live trade quiz + expiry mechanics)
**Type:** Event. **Core for the three line modes and one expiry fact.**

- **The live quiz:** state = slight bearish, resistance forming 23,400, support 23,300.
  **Clicking the state label shows the REASON** — resistance had turned strong while support stayed neutral
  (stable since the open).
  Lines: **R Risky 23,430, R Moderate 23,483, R Max Pain 23,537**, with S Moderate ≈23,340.
  **Students justify on stop-loss size: R Risky = 100-point stop; R Moderate = 50-point stop for a
  ~100-point target → R Moderate is the better choice.**
- Later the state became **both sides risky, scenario nine**. Teaching point: **both S Moderate and
  R Moderate carried a 100-point stop, and that SYMMETRY is exactly what "both sides risky" names.**
- **Under a blood-bath reading all the S values printed "NA" — meaning no bullish trade exists on the AI
  lines.** The 920 strategy *did* offer a support trade there, but **100-point stop for a 30-point target
  → ratio not worth taking.**
- **THE THREE LINE MODES — definitive:**
  - **Live LTP** draws **static** lines at whatever the current EOR, EOR+1, EOS, EOS−1 are.
    *(Contrast VIDEO-47/51 which describe Live lines as MOVING. → Open Question 20.)*
  - **920** draws four fixed lines that lock in at **9:21** and do not move.
  - **AI LTP** names the state and prints Risky / Moderate / Max Pain / Max Gain on each side.
- **IMPORTANT DATA FACT:** **the lines visible AT THE OPEN are the PREVIOUS DAY'S, because the volume that
  defines a level builds from zero each morning and cannot exist at 9:15.**
- **Expiry mechanics:** IV must reach zero on expiry day (OTM options have zero intrinsic value, so only
  time value remains and it has to be extinguished). He ties IV to the **spot–futures gap** (~15 points
  that day); spot and futures are forced to converge at expiry, and that convergence drives IV to zero.
  **A rule introduced ~Feb/Mar roughly DOUBLES margin on expiry day** — carry double margin from the
  previous day or square off.
- **Game of percentages:** look at the strike carrying **both** highest volume and highest OI on each side,
  then the weakness percentages beside them (≈70% WTB on resistance, ≈73% WTT on support).
  **When the day's resistance and support are only ONE STRIKE APART, price usually closes at that strike.**
  He predicted ≈23,315 (matching weekly-range L1) — **and was wrong, and said so on air**: the market ran
  ~600 points up, high ≈23,871, finishing at L2 ≈23,892.
- **Discipline rules:** stay neutral before the open; **argue against your own trade** and take it only if
  you cannot find a reason not to; **when the AI says exit, exit — do not average, hold, or wait for a
  reversal**; **after a stop loss, do not re-enter immediately — wait for the next day.**

---

### VIDEO-59 — a live morning across index and stocks
**Type:** Live session. **Core — the 75% state-flip threshold and the stock rejection rules.**

- **Nifty opened slight bearish**, resistance strong ≈25,000, support WTB ≈24,500. **When support
  strengthened the state flipped to slight bullish.**
- **THE FLIP IS DRIVEN BY A SINGLE PERCENTAGE CROSSING 75%.** At ≈76.5% the state was slight bearish;
  once it fell back toward 73% it became slight bullish. **Watching that number tells you a state change
  is coming BEFORE it prints.**
- **A sound toggle makes the tool announce every state change by voice**, so a second tab can be left running.
- **Trading with the state is the COA 1.0 preference.** Taking the opposite side is "highly risky" and is
  **reserved for traders who have been profitable for at least six months.**
- **Entry from R Risky or R Moderate; stop is always R Max Pain; target is R Max Gain. S versions mirror.**
- **Targets can be taken at intermediate divergences — reversal prices on the OPPOSITE side of the chain
  between the entry and Max Gain.** Nifty showed three that day.
- **Bank Nifty was both sides risky with price mid-range → simply wait until one line is touched.**
- **STOCK SCANNING:** Reports → **LTP Blast** → **Show Nearest Stock** filter.
  **Stocks use the LIVE lines, not the AI LTP lines.**
  Stock charts carry **C1, C2, P1, P2**, and **each line prints its own entry, Max Pain and Max Gain.**
  **Bullish risk / bearish risk: 0 or 1 is tradable; 2 or more means do not trade that side.**
  **Red line = bearish entry, green line = bullish entry.**
- **THE RULES THAT ELIMINATED MOST STOCKS:**
  1. **Once a trade appears at C1, P1 is dead for the day, and vice versa. Same pairing for C2/P2.
     Whichever comes first is the only one.**
  2. **If a stock opens directly at C2 or P2, that stock is untradable all day.**
  3. **If the target or the stop loss is reached inside the first or second candle, that line is
     untradable even though no entry was possible.**
  4. **If C1 and P1 print the SAME VALUE, skip the stock entirely.** (This disqualified Petronet.)
- **Five stocks that passed** (entry / stop / target read straight off the lines), including Union Bank
  bearish entry 141.31 and HDFC Bank bearish 1947.15 / 1959.20 / 1937.20.
- **Access note: the AI lines are shown only to community members; non-members see the Live and 920 lines.**

---

### VIDEO-60 — MAX PAIN as the anchor, and the risk-reward argument
**Type:** Theory. **Core — the most important file on how the AI lines are meant to be used.**

- **MAX PAIN IS THE ANCHOR:**
  - **R Max Pain is the stop loss for EVERY bearish trade. S Max Pain for EVERY bullish trade.
    You do not choose your own stop; the market's structure sets it.**
  - **If the R Max Pain line is MISSING on a given day, do not buy puts at all. Without a stop loss there
    is no trade.** Same for S Max Pain and calls.
  - **Choose your ENTRY by how far you are willing to sit from Max Pain.** Want a 50-point stop? Wait for
    a line 50 points below it. Want a 5-point stop? Wait for price 5 points below it — **accepting that
    such a setup might appear four times in a year.**
  - **Bigger risk = opportunities every day; smaller risk = very few.**
  - **THE BIGGEST NAMED MISTAKE: taking a Risky-line entry and then substituting your own 20-point stop
    because the real one is 100 points wide.**
- **WHEN TO EXIT ON A STATE CHANGE:**
  - **If the state changes and your Max Pain line turns grey or vanishes** — e.g. both-sides-risky flipping
    to bull run while you hold a put — **exit immediately, because the stop loss that justified the trade
    no longer exists.**
  - **If Max Pain moves CLOSER to your entry after you are in, your risk has shrunk → stay.
    If it moves FURTHER away, your stop has widened → better to exit.**
- **Line counts:** **the 920 setting draws up to FOUR lines; AI LTP draws a MINIMUM OF THREE and up to SIX.**
  *(VIDEO-54 and VIDEO-100 say up to EIGHT. → Open Question 21.)*
- **THE PROBABILITY ARGUMENT:** every trade is 50-50; a streak does not change it (the cricket-toss
  illustration). **Therefore anyone advertising 70%, 90% or 99% accuracy is misleading you — and he applies
  this to his own tool.** Since the odds are fixed, **the only lever is the RATIO.**
  On the day shown, the **Risky** lines on both sides offered a 100-point stop for a 50-point target while
  the **Moderate** lines offered 50 for 100 → **only the Moderate lines were acceptable.**
- **ELIGIBILITY RULE: Risky lines should only be taken by traders who have been profitable for at least
  three to six months. A losing or break-even trader should never take them, even if that means no trade
  for six months.**
- **BLOOD BATH EXAMPLE (Bank Nifty):** no S Max Pain line → **no call buying at all that day.**
  Selling where price happened to be gave a **550-point stop for a 250-point target**; waiting for
  **R Moderate** turned the same day into **~200-point stop for a ~600-point target.**
  **The stop-to-target ratio changes continuously as price moves → re-measure at each candidate entry.**
- **Scope: apply to Nifty, Bank Nifty, Fin Nifty and Midcap Nifty. Stocks use a different method.**
- **Flagged in-source:** the 50-50 framing is a rhetorical simplification used to shift attention from
  entry accuracy to position sizing.

---

### VIDEO-61 — the four static lines on stocks; ten-minute shortlist; 9:20 entry/stop/target on the index
**Type:** Method. **Core — consolidates the stock path and adds a strong 9:20 tell.**

- **Stocks show only TWO tabs, Live and AI LTP, and the method here uses LIVE.**
  Both community and non-community members get Live once they recharge.
- **The Live setting plots FOUR STATIC lines that do not move all day: P2 at the top, then P1, then C1,
  then C2. Red = resistance / put buying; green = support / call buying.**
  **Each line prints its own entry, Max Pain and Max Gain, so no option-chain reading is required.**
  Apollo example: **P2 entry 6942, stop 6972, target 6917; P1 entry 6893, stop 6923, target 6868.**
- **THE FILTERS THAT KILL MOST STOCKS:**
  1. **Bullish risk and bearish risk must be 0 or 1 on the side you want to trade. 2+ → skip that side.**
     (Adani: bullish 2, bearish 4 → neither side tradable.)
  2. **C1 and P1 are a pair — if one is hit the other is dead for the day. C2 and P2 pair the same way.**
  3. **If the first candle already reached the target OR the stop loss of the line price is sitting on,
     that line is untradable that day.**
  - **The LTP Blast report only runs between 9:25 and 3:30.** Stated reason: **the AI needs five minutes
    after the open to build the lines.** **Show Nearest Stock** narrows it to stocks currently at a
    tradable value; the risk numbers are visible in the report itself.
- **Five stocks found in ten minutes** — with two borderline judgements worth noting:
  - Coal India: first candle low 398.80 came **within 40 paise** of the 398.40 stop → **flagged marginal**.
  - Power Grid: third candle high 295.70 came **within 30 paise** of the 296 target →
    **his own ruling is to treat the target as reached and SKIP the trade.**
  - Follow-up: the one he had doubts about was the one that went wrong.
- **THE 9:20 LINES ON THE INDEX (entry / stop / target, restated):**
  - At 9:21 four fixed lines appear: **UR (extension of resistance), UR+1, US (extension of support), US−1.**
  - **Buy a call when price reaches US. If it falls further to US−1, do not cut — add the same number of
    lots. If you cannot fund that averaging, skip US and wait for US−1 instead.** Puts mirror at UR / UR+1.
  - **To pick the option, find the index level on the OPPOSITE side of the option chain.
    The stop loss is the next LARGER reversal price ABOVE your put entry, or the next SMALLER one BELOW
    your call entry.**
  - **Stated another way: the stop-loss reversal sits TWO STRIKE PRICES above whatever strike was resistance
    around 9:20, or TWO STRIKES below the 9:20 support strike.** Read them from the **9:20 snapshot**, since
    S/R move during the day.
  - **The TARGET is the reversal price nearest to the current market price.**
    *(This is the closest the corpus comes to answering the target rule withheld in VIDEO-49.)*
  - **A USEFUL TELL: if only the LOWER two 920 lines are drawn and the upper two are missing, expect a
    good BULLISH move that day. If only the upper two appear, expect a BEARISH one.**
    *(VIDEO-99 and VIDEO-107 restate this as a prohibition rather than a forecast — see Open Question 22.)*
- **Personal note:** he distrusts Fin Nifty and Bank Nifty because their volumes are far lower than Nifty's.
- **Capital rule:** only trade F&O with genuinely surplus money, after term and health insurance; never on
  borrowed money or a credit card.

---

### VIDEO-62 — reading a support about to shift back down; two stop-loss styles
**Type:** Live session. **Core for one mechanism.**

- **Nifty support had moved up 24,700 → 24,800, but the percentage AT 24,700 was climbing again:
  it had fallen to 76% and recovered to 93%.
  A RISING percentage at the LOWER strike means the support is preparing to shift BACK DOWN to 24,700.**
- Because the support above is weak, the setup produced a **"dot to dot" reversal off the S Moderate line.**
- **If the support does shift down, the S Max Pain level moves down with it** — he expects the figure shown
  as 666 to become 566, **roughly 100 points lower** (i.e. one strike).
- **THE 76% PIVOT:** had the percentage broken below **75%** instead of recovering, the setup would have
  flipped to a bearish blood-bath view rather than a reversal.
- **TWO WAYS TO SET THE STOP LOSS:**
  1. **Fixed at 100%.** Hold until the percentage reaches 100 and treat that as the stop. Outcome ≈ coin
     flip — price may end at cost, at S Max Pain, or run to R Risky / R Moderate / S Max Gain.
  2. **Percentage stop.** Exit at a chosen level before 100 — 80, 90, 95, 98.
     **Claim: exiting before 100% usually ends at cost or slightly better.** *(Asserted, not evidenced.)*
  **Which to use is a personal risk decision, not something the tool decides.**
- **Behavioural content:** a caller with a ₹5 lakh loss is told to forget it entirely.
  **Trading to recover a past loss is presented as the single reason a trader stays unprofitable.**
  A trader cannot set an annual return goal the way an investor can, because each trade settles on its own.

---

### VIDEO-63 — LTP BLAST: the stock report and its rejection filters
**Type:** Live screening. **Core — the definitive statement of the LTP Blast filter set.**

- **The report is generated at 9:25 AM, from the first five minutes of trading. Once drawn, the lines stay
  STATIC for the day.**
- **From top to bottom: P2, P1, C1, C2. P2 and P1 are RED = sell levels; C1 and C2 are GREEN = buy levels.**
  **Sell when price reaches P1; if it pushes above P1, sell again at P2. Buy when price falls to C1; if it
  falls further, buy again at C2.**
- **Each line carries three numbers: the ENTRY, the MAX PAIN (stop loss) and the MAX GAIN (target).**
  A separate **bearish risk** and **bullish risk** figure is shown at the top of the stock.
- **THE REJECTION RULES (applied to every name; most were discarded):**
  1. **Risk must be 0 or 1.** Bearish risk ≥2 kills the sell side; bullish risk ≥2 kills the buy side.
     Rejected: Apollo Hospitals (bearish 3), Balkrishna (bullish 5), Hindalco (2), ATGL (2), Concor (2),
     Kalyan Jewellers (4).
  2. **All four lines must be visible.** SAIL, Bharti Airtel and Idea showed only three → dropped.
  3. **The stock must not OPEN at the outer line.** Titan and HDFC AMC opened below C2 → discarded.
     **An open at C2 or P2 makes the stock untradable for the day.**
  4. **The stop must not already be hit.** Indigo's first-candle low 5,281 was below the C1 Max Pain of
     5,281.40 → the stop had been touched before entry.
  5. **The target must not already be hit.** ICICI Bank's low 1,405.50 had passed its 1,405.30 target;
     Axis Bank's low 1,217.40 passed a Max Gain of 1,218.78; Infosys' first-candle high 2,701 passed a
     C1 Max Gain of 2,696. **All rejected.**
  6. **Once a stock trades and hits its target on C1, P1 is no longer traded that day** — only P2 or C2 remain.
- **The five that passed:** ICICI Prudential (C1 631.05 / 628 / 633.50, bullish risk 0 — target reached);
  BHEL (C1 251 / 249.30, bullish risk 0); Godrej Properties (P1 2,471.60 / 2,458 / 2,446, bearish risk 1);
  Tata Motors (P1, first-candle low 671.50, target 669); **Nykaa (P1 196.83 / 197.70 / 195.25 — flagged
  borderline, only 25 paise of target left; he says he would personally have avoided it).**
- **He aims for about FIVE stocks so the intraday portfolio is diversified rather than resting on one name.**
- **Index aside:** both indices opened in **blood bath** = a **sell-only** state.
  **R Max Pain is always the stop on the sell side. R Max Gain had moved to the SAME VALUE as R Risky, so
  the risk-reward was poor and the call was to wait.**
  Later the state changed to **both sides risky**, which **happens when support and resistance strengthen
  at the same place. The expectation then is that price oscillates between R Moderate and S Moderate for
  the rest of the day, with the risk being a break into a bull run or a blood bath.**

---

### VIDEO-64 — SWOT for a trade, and handling a mid-trade state change
**Type:** Decision method. **Core — the comparison framework.**

- **Run every signal through strength / weakness / opportunity / threat. A mental exercise, seconds long.**
  **The point is COMPARISON: when two setups are live at once, the SWOT tells you which to take.**
  **Each time the market state changes, the old SWOT is VOID and must be redone.**
- **Setup 1 — S Moderate buy, dropped:** state moved blood bath → both-sides-risky → bull run as the
  support-side weakness disappeared.
  *Strengths:* bull run; first touch of the level; no weakness visible below.
  *Weaknesses/threats:* **~100-point stop against a ~50-point target**; OI at the 25,500 resistance had
  climbed to ~74%, which can end the bull run; the move from Moderate to Max Gain had **already happened**.
  **Verdict: threats outweighed strengths → skipped.**
- **Setup 2 — S Risky buy vs R Risky sell, compared:**
  - *S Risky strengths* — 50-point stop against a 100-point target; first touch of support; **the 9:20
    bottom line sitting at the SAME level**.
    *Weaknesses/threats* — both sides risky; the Risky→Max Gain move on the support side already completed;
    could turn into a blood bath.
  - *R Risky strengths* — same 50/100; **the 9:20 TOP line at the same level, so two bearish signals settle
    together**; the option-interest percentage on the bearish side still rising.
    *Weaknesses/threats* — both sides risky; momentum to that level not yet complete; fear of support
    turning strong, which the percentage made look unlikely.
  - **Conclusion: the sell had more strengths and a weaker nightmare case → preferable.**
  - **CONFLUENCE RULE: where two independent signals land at the same price (here the 9:20 top line and the
    R+1 level), count that overlap as an added strength.**
- **HANDLING A MID-TRADE STATE CHANGE — the ordered rule:**
  1. Know the exact point value of your stop loss when you enter.
  2. When the scenario changes, ask whether the change favours you.
  3. Check whether the **stop distance has GROWN or SHRUNK**.
  **A shrinking stop = the scenario is in your favour. A growing stop = against you → exit immediately.**
  **A support that shifts DOWN does not change the target but WIDENS the stop** — which is why a rising
  percentage is a weakness for a long trade.
- **The six checklist questions** (also VIDEO-90): target-to-stop ratio in points; is the direction
  favourable; if the scenario changes does it help or hurt; is the momentum to that level already complete;
  is the percentage rising or falling.

---

### VIDEO-65 — a short 9:20 AM read: the 75% threshold flipping the state
**Type:** Live read. **Core — the clearest statement of the 75% yellow threshold.**

- At 9:20, spot ≈25,597, futures ≈25,692. Resistance strong at the 25,600 strike **since the 9:15 open**.
- Support initially **WTB** between 25,600 and 25,500 — **the tool highlights it in FLASHING YELLOW.
  Strong resistance + bearish support pressure = a put-buy signal.**
- **THE YELLOW HIGHLIGHT APPEARS WHEN THE READING CROSSES 75%. When the support figure fell back BELOW 75%,
  the yellow disappeared and the state changed from slightly bearish to slightly bullish.**
- **The rubber-band explanation:** the weak support was stretching the level downward; when the weakness
  released, the support snapped back and pushed the resistance above it slightly higher.
- **Resistance had 100% of the volume at 25,600, with the second-highest at 25,500.
  The second reading only matters if it is ABOVE 75%; here it was 50–51% → ignored.**
- **HOW THE LEVELS ARE PRODUCED (stated compactly):** the tool **combines highest OI and highest volume at
  a strike, then derives a REVERSAL PRICE from the GREEKS of that strike.**
  - For the 25,600 **call** side the derived reversal was ≈**25,612** → drawn as **R Risky** (the bearish entry).
  - **If price pushes past that, the next level considered is the DIVERGENCE at the following strike,
    ≈25,650–25,657. That is treated as the EXTREME: average there, but EXIT if price goes beyond it.**
  - On the **put** side the 25,600 reversal was ≈**25,560** → drawn as **S Moderate**.
    **"Moderate" means the support itself is STRONG, so the situation is not urgent.**
- **A line shown in GREY is STALE. Refreshing the screen removes it.**
- **CONFLUENCE:** the separate 9:20 support and resistance levels were pointing to the same place →
  treated as confirmation.
- **Scoring the long:** strength = moderate support + first touch + slightly bullish state.
  Opportunity ≈50 points (25,564 → 25,612). **Weakness = a ~100-point stop → ratio against you.**
  **Threat = the support reading at 73%; if it climbs back to 75% the WTB state returns, the market flips
  to slightly bearish, and S Moderate drops to S Risky with a new level below it.**
  **He notes the threat is realistic: 73→75 takes almost no time, whereas resistance moving 51→75 would
  take much longer.** → **Distance-to-threshold is itself a risk measure.**

---

### VIDEO-66 — "does the tool keep changing the scenario?"
**Type:** Q&A / discipline. **Core for two operational rules.**

- **Answer to the complaint:** **the MARKET changes the scenario; the tool only displays what is currently
  there.** The tool reports the reading behind the display (in the example, ≈1,48,000 of volume against
  ≈15,62,000 on the other side), so the state follows the data.
- **Reading the session:** Nifty opened **NEUTRAL** — meaning **price is expected to touch BOTH support and
  resistance once, then the state resolves.**
  Support ≈58%, resistance ≈69%. **The HIGHER resistance reading meant weakness would appear THERE first,
  so the expected shift was neutral → slightly bullish, making the buy side easier.**
  → **Comparing the two percentages tells you which side will weaken first.**
  Later the support percentage rose instead → flipping the expectation to slightly bearish.
- **RULE: once R Risky has been touched once, a second touch should not be traded.**
- **RULE: when the state turned slightly bearish, MAX PAIN MOVED DOWN ONTO THE ENTRY PRICE ITSELF.
  That overlap is a signal NOT TO ENTER AT ALL.**
  *(Related to VIDEO-109's "if S Risky and S Max Gain print at the same place, there is no trade".)*
- **Why the rules are written defensively:** they are deliberately written for the **most conservative**
  trader, because **an aggressive trader can follow conservative rules, but a conservative trader cannot
  survive rules written for an aggressive one.**
- **Trade count is not stable:** some months thirty setups across twenty-two trading days, others only two.
- **The on-air interviews are a rhetorical device, not evidence** (self-selecting participants, unverified figures).

---

### VIDEO-67 — Day 1 with a complete beginner: direction, why options, and delta
**Type:** Beginner theory. **Core for the delta intuition.**

- **Direction → instrument:** market expected to rise → buy a **Call**; expected to fall → buy a **Put**.
  Confirmed live: as spot moved ≈25,543 → 25,550, the 25,500 call premium rose ≈₹63 → ₹65-66 while the put
  premium fell from ≈₹28.
- **Why options rather than futures:** Nifty futures ≈25,636 with a **lot size of 75** → a full lot is worth
  ≈**₹19.22 lakh**. **Margin is roughly a tenth, ≈₹1.25 lakh**, and that is the minimum balance for one
  futures lot. Someone without that capital buys a **portion** of the move — a ₹62 premium on 75 units
  costs ≈**₹4,650**, and P&L is calculated on that ₹4,650.
  Exam analogy: eight students splitting an eight-paper exam each write one paper.
- **Cheaper, far-out premiums move LESS for the same index move; costlier, nearer premiums move MORE.**
  On a 100-point index move, one strike might gain 50, another 80, another only 10.
- **DELTA, taught as a split:** **the total move for a ₹1 change in the index is ₹1, SPLIT ACROSS THE TWO
  SIDES.** In the example the call side carried **60 paise** and the put side **40 paise**.
  A ₹1 rise adds 60p to the call and takes 40p off the put; a ₹1 fall reverses it.
  **The strike price is the dividing line.**
  → **This "the two sides' deltas sum to 1" framing recurs in VIDEO-107 and is the speaker's mental model
  for why an OTM strike pays less.**
- **Practice instruction:** pick ONE strike near the money and watch only the call and put figures **facing
  each other at that same strike**. Comparing across different strikes confuses you.
  Write down call premium, put premium and spot as a baseline, then wait until the premium has moved ₹10–15
  before judging. **Turn off all Greeks except delta while learning.**

---

### VIDEO-68 — Free Course EP 2: options as insurance, proved on a replayed expiry
**Type:** Beginner theory. **Core for the intrinsic-value proof.**

- **Screen:** centre column = strikes, marked with the **ATM** strike. Left = call side (green); right = put side.
- **Nifty lot size 75** — you must buy 75 or a multiple (150, 225, 300), never a single share.
  At 25,600 a full lot ≈**₹19.2 lakh**, margin ≈**₹1.5 lakh**.
- **EVERY STRIKE PRICE IS AN INSURANCE COMPANY.** Each offers to sell you its premium instead of making you
  buy the whole futures contract. **The difference from real insurance: here the premium can come back to
  you**, and index options expire every Thursday rather than after a year.
  **The call side promises to return however many rupees the market closes ABOVE that strike at expiry.
  The put side returns however many rupees it closes BELOW it.**
- **THE REPLAYED 3 JULY EXPIRY (the proof):** spot ≈25,495 in the morning.
  - 25,500 call ≈₹45 → **break-even 25,545**. Close at 25,550 → receive ₹50 (₹5 profit). At 25,600 → ₹100.
    At 25,700 → ₹200 (₹155 profit on a ₹45 cost).
  - **The market actually closed at 25,405.** Every call strike at or above that expired worthless —
    25,500 and 25,450 both zero, **since a premium never goes negative.**
  - **Below the close the premium equalled the exact gap:** 25,400 call ₹5, 25,350 ₹55, 25,300 ₹115,
    25,250 ₹155.
  - **Put side mirrored:** 25,450 put ≈₹45, 25,500 ₹95, 25,550 ₹145, while 25,400 and 25,350 puts were
    worthless because the close was above them.
- **Break-even formula:** strike **plus** premium on the call side; strike **minus** premium on the put side.
- **Scope limit flagged in-source:** this lesson covers only **expiry-day intrinsic value**. Time value,
  volatility and pre-expiry decay are not covered here.

---

### VIDEO-69 — Day 3: cash vs futures vs options, and using VOLUME to choose the instrument
**Type:** Beginner theory. **Core for the instrument-selection rule.**

- **Four NSE indices in regular use: Nifty, Bank Nifty, Fin Nifty, Midcap Nifty.**
  **You cannot buy the spot value of an index** — the spot number is only a reference; trades happen in
  futures or options. **An individual stock can be traded in all three.**
- **Lot sizes quoted in the session:** Nifty **75**, Bank Nifty **35**, Fin Nifty **65**, Midcap Nifty **140**,
  Angel One 250, Bharti Airtel 475.
  Angel One ≈₹2,685 × 250 ≈ ₹6.71 lakh contract, margin ≈₹1.5 lakh.
  **In spot there is no lot** — buy a single share, no margin given.
  **Options cost least:** a Nifty put at ₹90 × 75 = **₹6,750**, against ≈₹1.5 lakh margin for the futures.
- **What you actually own:** spot buy = the shares are yours (the "owned shop"); spot sell = must buy back
  the same day; **futures = a rented shop** — the agreement ends at expiry, and rolling costs money.
  **Capital ordering: spot needs most, futures less, options least. RISK runs the OPPOSITE way — the option
  buyer carries the most risk.**
- **Recommended progression (contrarian to the crowd):** start with **intraday trading in CASH**, build
  capital slowly, move to options, then futures, and eventually put profits back into cash investments.
  If capital is only a few thousand rupees, prefer a ₹100–200 stock where you can buy 20–50 shares rather
  than an index option.
- **How a price is formed:** buyers and sellers bid at many prices; a trade happens only where they match.
  **The number on screen is the LTP — not a live current price. It is what is normally called CMP.**
  **If the price sits unchanged for long stretches, few people are trading and the instrument is bad for you.**
  Worked reason: with ₹8.8 lakh to transact, in an empty market where the last trade was 977 and the only
  buyer will pay 950, you are forced to accept 950 — **a ₹27/share loss multiplied by the lot size.**
- **USING VOLUME TO CHOOSE WHAT TO TRADE:** compare volume **around the imaginary line on both sides**.
  Live comparisons: Ashok Leyland > OFSS; HDFC Bank > both.
  **Among indices: Nifty ≈11.59 lakh vs Bank Nifty ≈31,000 and Midcap Nifty ≈40,000–45,000, with Fin Nifty
  lowest. Trading preference: Nifty → Bank Nifty → Midcap Nifty → Fin Nifty.**
  **Practical rule: if the same setup appears in two instruments, take the one with higher volume.**
- **Claim flagged in-source:** the speaker says he invented the term "imaginary line" and put it into his own
  option chain ~3 years earlier, and that every Indian option chain now shows it. His own account.
