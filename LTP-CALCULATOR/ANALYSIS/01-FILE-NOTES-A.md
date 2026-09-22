# Per-file analysis — Part A: VIDEO-00 → VIDEO-33

This is the foundation series (published as EP 01 – EP 34). It builds, in order:
imaginary line → volume vs OI → resistance definition → support definition → level grading →
six reversal points → extensions and divergences → the nine-scenario Chart of Accuracy →
shifting, percentages and state of confusion → positional (swing) trading.

**Read this part first.** Nothing later in the series is intelligible without it.

---

### VIDEO-00 — Introduction to the Option Chain Series
**Type:** Promo / series announcement. **NON-CORE for logic, core for framing.**

- **Concepts:** The series is built entirely around the speaker's own tool, the LTP Calculator
  (Android, iOS, web at `ltp.investingdaddy.com`). Claimed target ~2,000 videos; claimed ~15 years of research.
- **Named up front as the core theory:** "the **six kinds of reversals**", which the app
  "calculates and displays in one click." This is the thesis of the whole series (delivered in VIDEO-09).
- **Claimed coverage areas of the app:** arbitrage trading, support and resistance, stock rallies,
  stock positions, Nifty/Bank Nifty intraday.
- **Pricing as stated:** ₹1,416/month non-community; ₹708/month community (50% off for life after a
  one-time joining fee); five classes + the Option Chain data view free.
- **Build note:** establishes that the product surface is (a) an option-chain data view, (b) computed
  reversal levels, (c) stock screeners, (d) historical replay. Our future section needs the same four.
- **Unclear:** none — nothing is taught.

---

### VIDEO-01 — Option Chain Analysis Basics EP 01
**Type:** Theory, foundational.

- **Concept:** the **imaginary line**.
- **Logic:** On the option chain, a red horizontal line is drawn **between the two adjacent strike
  prices that bracket the current market price**.
- **Input:** live spot price; the exchange's strike ladder.
- **Example:** market 19,553 → line sits between strikes 19,550 and 19,600.
- **Named by the speaker**, not a standard feature. Everything else in the series is measured from it.
- **Data-source claim:** the speaker says he started with NSE data that arrived on a 3-minute delay,
  and later took a direct exchange data arrangement. Warns that free feeds may be auto-generated
  rather than genuine exchange prints.
- **Question deliberately left open:** does the line stay fixed all day? (Answered in VIDEO-02.)
- **Build note:** the imaginary line is the anchor of the entire model. It is *derived*, not stored:
  `line = between floor(spot/gap)*gap and that + gap`. See VIDEO-75 for a refinement (it is actually
  drawn using **highest time value**, which can differ).

---

### VIDEO-02 — Option Chain Analysis Basics EP 02
**Type:** Theory, foundational.

- **Logic:** the line **moves**. It re-seats every time spot crosses out of its current strike band.
- **Worked sequence:** 19,553 → line 19,550/19,600. Rise past 19,600 → 19,600/19,650.
  Rise to 19,753 → 19,750/19,800. Fall to 19,353 → 19,350/19,400.
- **New named term:** "**the pair of strike prices on the imaginary line**" — the two bracketing strikes.
  This pair is the *starting point* for locating support and resistance.
- **Orientation vocabulary (important and counter-intuitive):**
  - **Top** of the option chain = the **highest** strike price. **Bottom** = the lowest strike.
  - A rising market = "**movement towards top**". A falling market = "**movement towards bottom**".
- **Explicit warning:** "movement towards top" is NOT the same as "weak towards top" (a separate,
  later term). The two are easy to confuse — and this confusion recurs across many later files.
- **Unclear:** the file itself notes the transcript is noisy here because the LTP Calculator's
  on-screen display order does not match the top/bottom naming. **Flagged** — our UI must decide
  its own strike sort order and state it explicitly.

---

### VIDEO-03 — Option Chain Analysis Basics EP 03
**Type:** Theory, foundational (volume vs OI mechanics).

- **Screen layout:** strike price in the middle; **call data on the left, put data on the right**.
  First column on each side is the **LTP** (the premium).
- **Volume** counts trades. Buy one lot → one lot of volume. Ten trades → ten lots of volume.
  Toll-booth analogy: you pay every single time you pass.
- **Open interest** counts positions still standing.
- **Buyer vs writer:** a buyer takes a position by buying first; a **writer** sells first to *create*
  a new position.
- **The decisive rule:** the person selling to you is either (a) a writer opening a fresh position →
  **OI is created**, or (b) an existing holder squaring off → **volume is generated, OI is not**.
- **OI rises** when writers sell fresh premium; **OI falls** when writers buy positions back.
- **Q&A:** Do writers run the market? No — without buyers nothing executes and no OI is created.
  Do you watch volume or OI? **Both** (clutch/gear/accelerator analogy); where each applies comes later.
- **The branch analogy** (recurs throughout): buying an option is like sitting on the branch you are
  cutting — your own buying generates the pressure that eventually moves the market against you.
  The conclusion is not "never buy" but "be able to jump clear", i.e. know the exit level in advance.
- **Build note:** this is the causal story behind the whole model — *retail buying builds the very
  level that reverses them*. Our implementation doesn't need the story, but every rule downstream
  assumes it.

---

### VIDEO-04 — Option Chain Analysis Basics EP 04
**Type:** Theory (why levels exist at all).

- **Model:** the imaginary line as a **tug of war**. Call side pushes down, put side pushes up.
- **Mechanism:** every option premium "wants" to be zero at expiry (3:30 PM Thursday, at the time
  of recording). Call premiums are extinguished by a falling market → **call-side pressure is
  downward**. Put premiums are extinguished by a rising market → **put-side pressure is upward**.
- The further the market travels one way, the more premiums on that side are wiped out — which is
  why the push keeps going (self-reinforcing).
- **Worked example:** Bank Nifty, 24 Aug expiry. 10:15 AM line between 44,900/45,000 → 3:30 PM line
  between 44,400/44,500. The 44,500 call (≈₹58 in the morning) finished at zero; calls above the
  close collapsed to 5–10 paise. The 44,900 put (≈₹105) rose sharply.
- **Depends on:** VIDEO-03's branch analogy; forward-references intrinsic/extrinsic value (VIDEO-18).
- **Build note:** supplies the directional sign convention — *call-side weight = downward force,
  put-side weight = upward force*. This is why support is read on the put side and resistance on
  the call side, not the other way round.

---

### VIDEO-06 — EP 05: the definition of RESISTANCE
*(File VIDEO-06 carries EP 05; file VIDEO-05 carries EP 06. The source numbering is out of step —
the INDEX flags this. Read VIDEO-06 before VIDEO-05.)*

**Type:** Theory. **This is one of the two most important files in the entire corpus.**

- **The definition, stated word for word:** From the pair of strike prices on the imaginary line,
  **on the call side**, start at the **SMALLER** of the two strikes and move outwards towards
  out-of-the-money strikes. The **first thing you meet** — the highest open interest **or** the
  highest volume, **whichever is closer to the imaginary line** — is the resistance.
- **Why start at the smaller strike:** the call side has already pushed the line up to that point,
  so searching behind it is pointless; only strikes still ahead can stop the move.
- **Resistance therefore comes in three forms:** OI only, volume only, or both at the same strike.
- **Inputs:** strike ladder, per-strike call volume, per-strike call OI, spot.
- **Display convention:** LTP Calculator marks largest **volume in blue**, largest **OI in pink**.
  (VIDEO-98 adds: highest put OI in green, highest call OI in pink, highest volume blue on both sides.)
- **Examples:** Nifty pair 19,250/19,300 → largest OI ≈2,57,000 but largest volume at 19,300 is
  nearer the line → **resistance 19,300, by volume**. Bank Nifty pair 44,200/44,300 → **44,300 by
  volume**. Apollo Hospitals: highest OI and highest volume on the same 5,000 strike. Bata India:
  resistance ≈₹100 above a market near 1,800 → nothing in between has the weight to stop a move.
- **Q&A / exceptions:**
  - *Can an in-the-money strike be the resistance?* **Yes.** The rule is only ever "whichever you
    meet first, starting from the smaller strike."
  - *Can resistance break?* Yes; so can support. The useful question is *will* it.
- **Build note:** implementable exactly as written. Pseudocode:
  `lower = pair.low; scan strikes ascending from lower on the call side; find argmax(volume) and
  argmax(OI) within that scan; resistance = whichever argmax has the smaller strike (nearer the line).`
- **Conflicting note for later:** VIDEO-08's Tata Power case excludes a deep-ITM highest volume from
  being the support, which appears to contradict "an ITM strike can be the resistance". See
  Open Question 6.

---

### VIDEO-05 — EP 06: the definition of SUPPORT, and volume-vs-OI reliability
**Type:** Theory. **The other of the two most important files.**

- **The definition (mirror image):** From the pair of strike prices on the imaginary line,
  **on the put side**, start at the **BIGGER** of the two strikes and move outwards towards the
  **lower** strikes. The first thing you meet — highest OI or highest volume, **whichever is closer
  to the imaginary line** — is the support.
- Support also comes in three forms: volume only, OI only, or both.
- **Examples:** Nifty pair 19,550/19,600 — put OI ≈1,39,000 at 19,600 and ≈3,21,000 at 19,500, but
  the largest volume (≈28 lakh at 19,550) is met first → **support 19,550, by volume**.
  Bank Nifty → 44,300 by volume. Adani Enterprises → support *and* resistance both at 2,500, both on
  volume. AU Bank → support 700 on OI, resistance 720 on volume. Dr Reddy's → both highest OI and
  highest volume sit above the line; support read at 5,600 on volume.
- **Why volume-based levels are steadier — the key structural fact:**
  - **Volume never falls during a session.** A trade cannot be un-done; the figure only rises
    through the day, then resets to zero the next morning.
  - **OI can fall**, because it is writers' standing positions and a writer can buy back.
  - Corollary given: that is why an option chain has a *change in OI* column and never a
    *change in volume* column.
  - **Reliability ranking:** volume+OI at the same strike (most dependable) > volume only >
    OI only (most volatile, shifts quickest).
- **Healthy vs unhealthy shifting (stated here first):**
  - Resistance moving to a **higher** strike, support moving to a **lower** strike → the level can
    still be relied on.
  - Resistance moving **lower**, support moving **higher** → cannot be relied on.
- The one thing that weakens a volume level: the **second-highest volume rising quickly** alongside
  it. Forward-reference to the percentage-growth comparison feature (VIDEO-07).
- **Edge case set aside:** a case where only two strikes exist between the level and the line is
  deferred to a later episode. **Never clearly resolved anywhere in the corpus** — see Open Question 7.
- **Build note:** "read every level twice — first *where* it is, then *what it is made of*." The
  level object needs a `builtOn: 'volume' | 'oi' | 'both'` field from the start.

---

### VIDEO-07 — EP 07: grading a level (strong / WTT / WTB)
**Type:** Theory. **Core.**

- **Why:** knowing *where* support and resistance are is only half the job. Whether the level turns
  the market depends on **how strong** it is. Also: levels are not fixed — sometimes the market
  travels to the level, sometimes the level moves to the market, and that movement is visible only
  on the option chain, never on a price chart.
- **The three grades:**
  1. **Strong** — no meaningful challenger.
  2. **Weak towards top (WTT)** — the challenger sits at a **higher** strike than the level.
  3. **Weak towards bottom (WTB)** — the challenger sits at a **lower** strike than the level.
- **The challenger** = the **second-highest** volume (or second-highest OI) on that side.
- **Threshold:** the second-highest only counts **once the tool marks it yellow**. No yellow = no
  impact. (The numeric threshold — 75% — is given later, in VIDEO-65/75/105/108/112.)
- **Yellow has five shades.** Darker = the second-highest is pressing harder on the highest = more
  able to change the decision. (Shade intensity as a signal recurs in VIDEO-26 and VIDEO-33.)
- **The rule is purely positional:** yellow at a **bigger** strike than the level → WTT.
  Yellow at a **smaller** strike → WTB. **Identical on the call side and the put side.**
- **Important caveat stated by the speaker:** "weak" is a nickname, not a verdict. A *strong* level
  can still fail to produce a reversal — which is what the Chart of Accuracy exists to resolve.
- **Examples:** Nifty resistance 19,600 on ~76 lakh volume, second-highest ~55 lakh with no yellow →
  strong. Nifty support at 19,800 where the highest OI carries yellow → not strong. Godrej:
  OI-only resistance with no yellow → strong; volume-only support with yellow below → WTB.
  HUL: volume-only resistance with yellow lower → WTB. M&M Financial: highest volume 930, yellow 940
  → WTT. Another stock: highest volume 860, yellow 880 → WTT.
- **The four-question drill (this is the canonical classification procedure):**
  1. Is it support or resistance?
  2. Is it made of volume, OI, or both?
  3. At which strike price?
  4. If made of **one factor only** — is it strong, WTT, or WTB?
- **Explicit scope limit:** this episode covers **single-factor levels only**. Two-factor levels are
  VIDEO-08.
- **Build note:** grading is a pure function of (highest strike, second-highest strike, second/highest
  ratio ≥ threshold). Trivially implementable once the threshold is fixed at 75%.

---

### VIDEO-08 — EP 08: the tie-break for two-factor levels
**Type:** Theory. **Core.**

- **Situation:** the level carries **both** volume and OI at the same strike, and the two can disagree.
- **The question asked of each factor is directional:** is *its* yellow challenger forming
  **towards** the imaginary line, or **away** from it?
- **The rule:** if **either** the volume challenger **or** the OI challenger is coming **towards**
  the imaginary line, the level is **weak**, and you follow that one.
  For the level to count as **strong, BOTH** must be clean or both moving away. One moving away is
  not enough.
- **Applied to sides:** a weak support is **weak towards top**; a weak resistance is
  **weak towards bottom**. (i.e. weakness on a two-factor level always points inward, at the line.)
- **Example:** Nifty support 19,500 on both volume and OI. OI challenger moving *away*, volume
  challenger moving *towards* the line → believe the volume → support graded **WTT**.
- **Further examples:** Indiabulls Housing — both levels OI-only with no yellow → both strong.
  SBI Life — volume-only support with no challenger moving out → strong; volume-only resistance with
  challenger at a higher strike → WTT.
- **Two edge cases worth keeping:**
  1. A case where the biggest volume sits at 1,600 **but in the money**, and is therefore **not**
     counted as the support — 1,500 is used instead. *(See Open Question 6: this conflicts with
     VIDEO-06's "an ITM strike can be the resistance".)*
  2. **Tata Power:** the highlight was missing entirely because the stock price was sitting
     **exactly on** the 257.5 strike, which **stops the tool calculating**. Checking historical data
     at 3:25 PM, once price had moved to 257.25, restored the highlight.
     **This is a real, named degenerate case: spot exactly equal to a strike → no imaginary line →
     no calculation.** Our implementation must handle it deliberately.
- **Scale warning given:** this branches into nine scenarios, then 121, and more beyond.
- **Explicitly NOT here:** no entry, exit or sizing instruction. This file only classifies.

---

### VIDEO-09 — EP 09: the Six Kinds of Reversals
**Type:** Theory. **This is the thesis of the whole series.**

- **The problem:** traders buy a Put the moment price touches resistance and a Call the moment it
  touches support. The level then **stretches past** that point and the stop is hit. The two common
  reactions (trade the breakout instead; remove the stop loss because of "stop-loss hunting" videos)
  both fail.
- **Why the classical levels stopped working:** support/resistance became popular between the World
  Wars, when prices were known two days late and plotted by hand. Computers, internet, phones and
  discount brokers removed the delay. **Because every trader now sees the same levels, volume at
  those levels is far higher, so the market still reverses near them but first EXTENDS past them —
  which is exactly where stops sit.**
- **The six points — three open a trade, three close it:**

  | Open a trade at | Close that trade at |
  |---|---|
  | Extension of resistance | Diversion |
  | Extension of support | Diversion |
  | End of diversion | Support or resistance |

- Every level has a paired one: resistance ↔ extension of resistance; support ↔ extension of support;
  diversion ↔ end of diversion.
- **Side mapping:** at an **extension of resistance** the trade is a Put buy, a Call write, or a short
  in cash/futures. At an **extension of support** it is the Call side.
- **The distance between a level and its extension is NOT fixed.** Rough scale given:
  ~20 paise on a ₹100 stock; ~₹10 on a ₹1,000 stock; **roughly 25–35 points on Nifty near 20,000**.
- **The crucial claim:** this distance is **derived from Option Greeks** and shown in one click.
  **The formula is never given.** → Open Question 1.
- **Position sizing instruction:** size to the *point being traded* (more aggressive at some, more
  defensive at others) rather than one fixed size everywhere.
- **Terminology warning:** "diversion" and "divergence" are used interchangeably across the corpus
  for the same thing. Also note: this "divergence" has **nothing** to do with indicator divergence.
- **Build note:** this table is the trade-generation core. Everything the AI lines later do is a
  productisation of these six points.

---

### VIDEO-10 — EP 10: Scenario 1 (both strong) — the first real setup
**Type:** Theory + worked replay. **Core.**

- **Scenario one of the Chart of Accuracy: strong support AND strong resistance simultaneously.**
- **Analogy:** a polythene bag of water sealed hard at both ends — the water cannot escape either end,
  so the market simply travels between them, reversing repeatedly.
- **Worked example — 25 August, 31 Aug expiry:**
  - 9:17 AM resistance already strong, support not. **By ~9:35 AM both strong** → scenario 1 valid.
  - Market opened 19,269. Support at the 19,300 strike; **extension of support ≈19,266**.
  - **Extension of resistance ≈19,325–19,326** as the session developed.
  - **How to read them:** *click the volume figure at the support or resistance strike in the LTP
    Calculator; the extension and divergence values are shown.*
  - Two further lines from **one strike outside each level**: the divergence of 19,250 ≈19,215–19,221
    below, and ≈19,380 above.
  - Those **four values are the day's boundaries**. The market ran extension-of-support →
    extension-of-resistance → reversed → back to extension-of-support → reversed again.
- **Trade rules given:**
  - Buy at the extension of support, book at the extension of resistance, and reverse on the other side.
  - **A level is only good for so many touches. First touch = safest. Second = riskier. After that
    the level starts reading weak and can break out one or both sides.**
  - If a level extends past you, do not panic-square — wait, **average in once**, exit when it returns.
  - **One or two trades a day at most.**
  - **Skip the first signal of the morning** — "untradeable, it comes too early."
  - **No new trade after 2:30 PM.**
  - **Mark all four values before trading.**
- **Data-refresh fact (important for our implementation):** values shift by about **5 to 7 points,
  never much more, because the data is a ONE-MINUTE snapshot live and a TWO-MINUTE snapshot in
  historical mode.**
- **Unclear/asserted:** the claim that the market "cannot" fall below the lower divergence is stated,
  not demonstrated. The averaging advice assumes the level holds.

---

### VIDEO-11 — EP 11: diversions, and safe vs risky
**Type:** Theory. **Core — this defines the diversion count.**

- **Situation:** support and resistance at **different** strikes. The space between fills with
  intermediate levels called **diversions**.
- **THE COUNTING RULE:** `number of diversions = (number of strike prices lying strictly between
  support and resistance) + 1`.
  - Case 1: support 19,700, resistance 19,800, 19,750 in between → 1 strike between → **2 diversions**.
  - Case 2: adjacent strikes, nothing in between → count starts from zero.
  - Case 3: **support and resistance on the same strike → counted as minus one**, which cancels the
    plus one → **0 diversions**. That is why, on such a day, price runs straight from the extension
    of support to the extension of resistance with nothing in between.
- **Timing:** do **not** take values at the opening bell. Wait until roughly **9:25–9:30** so volume
  builds and the Greeks settle.
- **Worked example — 24 July, ~9:19 AM:** resistance strong 19,800, support strong 19,700.
  Four levels: extension of resistance ≈817, upper diversion 767, lower diversion 718, extension of
  support ≈668. *(Digits truncated by ASR — read as 19,8xx / 19,7xx.)*
- **How the diversion values are read:** *click the volume on the **in-between strike** (19,750),
  which gives both the call-side and put-side diversion.*
- **SAFE vs RISKY — the canonical mapping:**
  - The **two upper lines are Put-buying levels**. The **top** line (extension of resistance) is the
    **safe** Put; the diversion just below it is the **risky** Put.
  - The **two lower lines are Call-buying levels**. The **bottom** line (extension of support) is the
    **safe** Call; the diversion just above it is the **risky** Call.
- **Management rules:**
  - Take profit at each diversion rather than holding through it.
  - If a **risky** trade goes against you, add a second lot **only when price reaches the next full
    value — the safe line**. Adding anywhere in between is overtrading.
  - If the underlying S/R picture changes while in a risky trade: **do not average — book the loss**,
    because the entry was the risky one.
  - Trade roughly **9:30 → 2:30**, close by 2:30. After 2:30 the option chain stops being reliable
    (square-offs and fresh positions distort it).
- **Learning-curve claim:** six months to two years of practice to read these levels reliably.

---

### VIDEO-12 — EP 12: stocks, support and resistance on the SAME strike
**Type:** Worked replay (SBI, 14 Sep 2023). **Core for the stock path.**

- **Setup:** both support and resistance land on the **600** strike; price near 600 at the open.
  Because they share a strike, **no diversion exists**; the two extensions sit directly against each other.
- **Timing:** wait until **9:25 AM** before reading anything.
- **THE SIDE-CROSSING RULE (critical and easy to get wrong):**
  - **Click the volume on the PUT side of 600 → get the extension of support → that is the CALL entry.**
  - **Click the volume on the CALL side of 600 → get the extension of resistance → that is the PUT entry.**
- **Values:** extension of support ≈595.96; extension of resistance ≈601.
  - Call trade: enter ≈595.96, stop 594 (≈₹2), target ≈600.
  - Put trade: enter ≈601, stop ≈606, target ≈596 (≈₹5).
  - **Both orders prepared in advance; whichever price is touched first is the trade taken.**
- **THE ZERO-LTP FILTER (first statement; refined in VIDEO-35):**
  - Before buying a **Call**, look down the **in-the-money LTP column on the call side**. **If any
    value reads zero, skip the trade.** Example shown ran 51, 43, 42, 37, 32, 28, 23, 13 — no zeros → tradeable.
  - Mirror image before buying a **Put**: no zeros in the ITM put-side LTP column.
  - **Why it matters more in stocks:** volume is often missing at many strikes in stocks, unlike Bank Nifty.
- **Outcome:** price opened near the extension of support, rose, hit the extension of resistance
  (overshooting ~₹2), turned down, struggled, finally reached ~595.5 where the target filled.
- **Repeated rule:** first touch of an extension is the safest; risk rises with every later touch.

---

### VIDEO-13 — EP 13: Chart 1.0 / Chart of Accuracy — the nine scenarios
**Type:** Theory. **Core — this is the first full statement of the nine-scenario table.**

- **Construction:** call data (left) generates **resistance**; put data (right) generates **support**.
  Each can be in one of three conditions — **strong in itself, weak towards top, weak towards bottom**.
  3 × 3 = **nine scenarios**. (Said to expand later to 121 combinations.)
- **UI:** reached through the saffron **COA** button, top right.
- **TWO DISPLAY TRAPS, both explicitly flagged:**
  1. On the COA screen **support is drawn ABOVE and resistance BELOW** — deliberately inverted
     relative to a price chart.
  2. **An UPWARD-facing arc means WEAK TOWARDS BOTTOM**; a downward-facing arc means weak towards top.
     The speaker stresses this because it is counter-intuitive.
- **The two permission columns:** "Extension of Support" tells you whether a **Call** is allowed today.
  "Extension of Resistance" tells you whether a **Put** is allowed today. **A column marked red means
  do not take that side.**
- **The nine scenarios as stated here:**

  | # | Support | Resistance | Verdict |
  |---|---|---|---|
  | 1 | Strong | Strong | Both sides allowed. Puts from extension of resistance, Calls from extension of support. First attempt safest. |
  | 2 | Strong | WTB | Pressure from both → **Puts only** |
  | 3 | Strong | WTT | Bullish → **Calls only** |
  | 4 | WTB | Strong | **Puts** |
  | 5 | WTT | Strong | **Calls** |
  | 6 | WTB | WTB | Heavy downward pressure → **Puts only** |
  | 7 | WTT | WTT | **Calls only** |
  | 8 | WTB | WTT | Cannot be read from Chart 1.0 alone |
  | 9 | *the two levels move against each other* | | Cannot be read from Chart 1.0 alone |

  Scenarios 8 and 9 require a second tool — **the Game of Percentage** (VIDEO-23, VIDEO-109).
- **Scenario 1 bound:** if the levels do not change all day, downside stops at
  **extension of support minus one**, upside at **extension of resistance plus one**.
- **The scenario is NOT fixed for the day — it changes several times as levels shift.**
- **"The promise":** trade only in the direction Chart 1.0 permits, never against it, and take only
  the **first trade of the morning, before 10:30 AM**, from a **safe** entry point.
  The claim that such a trade "can never end in an overall loss" is flagged in-source as marketing.
- **ASR note:** the transcript garbles the name as "Chart of Energy 1.0", "Kar Topic 1.0". It is one
  thing: Chart 1.0 / Chart of Accuracy 1.0.

---

### VIDEO-14 — EP 14: the two-value anti-overtrading rule
**Type:** Theory, standalone method. **Core — it is the simplest complete rule in the corpus.**

- **Claim:** works regardless of your other method (candlesticks, indicators, anything). Only the
  entry price changes.
- **THE PROCEDURE:**
  1. Find the two strikes either side of the imaginary line. Lower = call-side strike, higher = put-side strike.
  2. **Click the VOLUME on the CALL side of the LOWER strike.** Either a value appears, or the word
     **"breakout"**. If breakout → click the **next higher** strike instead.
     **The value that appears is the PUT-buying level.**
  3. **Click the VOLUME on the PUT side of the HIGHER strike.** Either a value appears, or the word
     **"breakdown"**. If breakdown → click the **next lower** strike.
     **That value is the CALL-buying level.**
  4. Result: two prices, one above and one below the current market. **Do nothing between them.**
- **Examples:**
  - Nifty 14 Aug 11:19 AM (17 Aug expiry): put level 19,376, call level 19,326, market ≈19,329.
  - Bank Nifty 23 Aug 12:15 PM: market 44,204, put level 44,244 (~40 pts above), call level 44,150
    (~50 pts below). Market then spent the session between exactly those two lines before breaking out.
  - Fin Nifty 26 Sep expiry ~10:30 AM: call level 19,785, put level 19,827.
  - ONGC 13 Sep ~10 AM: spot ₹181.70, put level ₹182.45, call level ₹181.35 — ~50 paise either side.
- **Exception:** the speaker only trusts **Fin Nifty** values on **expiry day**, because volume is too
  thin otherwise.
- **Build note:** "breakout"/"breakdown" are **sentinel return values** from the reversal-price
  calculation, not numbers. Our data model needs to represent them. They recur in VIDEO-79/91 as
  a *condition* ("Put HOI reversal must be breakdown or ≈CMP").

---

### VIDEO-15 — EP 15: Rule 3 (support strong, resistance WTT) and the day's ceiling
**Type:** Theory + replay (13 September).

- **Scope:** Rule 1 (both strong) has so far covered only the "**stable strong**" half; "**shifting
  strong**" comes later. This file is rule 3: **support strong, resistance WTT**.
- **What WTT means operationally:** the resistance *volume* is trying to move up a strike (e.g.
  19,600 → 19,700), shown as a yellow box.
  - **Resistance is read from VOLUME, not OI.** OI can be WTB at the same time without changing the reading.
  - **WTT ≠ shifting.** WTT is weakness only; *shifting* is the event where the highest volume actually
    moves to the new strike. Keep them apart.
- **THE CEILING RULE:** when resistance is WTT, **the market can move at most to ONE STRIKE BELOW the
  strike the weakness reaches** — i.e. that strike's divergence. In the example the weakness reached
  20,050, so 20,050's divergence (≈20,062) was the ceiling while the condition held.
  Above that level price may poke out 10–25 points but comes back and hits the same value repeatedly.
- **The day's whole range in this scenario** runs from the extension of support up to the
  weak-towards-top level minus one strike.
- **Replay detail:** 9:20 support was WTB → market fell an extra 10–15 points, bottoming ≈19,947.50.
  By 9:45 support turned strong on its own; with both strong, extension of support 19,965, extension
  of resistance ≈20,014, and the morning high of 20,006 was made against it. From the **second touch**
  onwards odds shift towards running on to the next divergence (20,062 up, 19,916 down).
  By 1:45 PM resistance turned WTT.
- **Entry fallback:** if the entry value is not offered, use **extension of support plus one strike** —
  click the **put side of the next higher strike** (20,050) → ≈20,019. If price then falls below the
  support extension, **average** rather than abandon.
- **The supported trade in this setup is a CALL buy at the extension of support, not a Put.**
- **If you take the Put near the ceiling anyway:** treat it as a trade against COA 1.0 and watch the
  WTT percentage. **If it climbs towards 90, 95, 97 → the volume is shifting → exit and book the loss.**
  A completed shift adds a new extension of resistance one strike higher and roughly **another
  ~100 points of upside**.

---

### VIDEO-16 — EP 16: duration display, gap reading, and the STATE OF CONFUSION (first statement)
**Type:** Live walk-through (3 October). **Core — introduces SOC.**

- **New feature: duration.** The app shows how long each condition has held ("support strong since
  9:25 AM", "resistance WTT for 113 minutes").
  **The duration number is an instruction:** open historical data from that many minutes earlier and
  see what the level was before. Doing so on this day revealed the resistance had been **WTB** earlier,
  then shifted, which is why it now read WTT.
- **Reading the gap at the open:** a change of **100 points in the LTP-change column on both sides**
  means a large gap; up to 15–20 points is normal.
  **Colour tells direction: call side green + put side red = gap UP; call side red + put side green = gap DOWN.**
- **Scenario 8 behaviour (support WTB + resistance WTT):** the support then shifts, and the market
  stops at the divergence **one strike above** the weak level.
- **THE FLIP RULE — before vs after shifting:**
  - **Before shifting:** resistance WTT targets *that level minus one strike*; support WTB targets
    *that level plus one strike*.
  - **After shifting:** targets are read off the **new** extension of resistance / extension of support instead.
- **Detecting a shift in progress:** the resistance shifted 19,600 → 19,500 between ~10:00 and 10:25,
  **visible because the volumes at both strikes were almost equal, near 101,000**.
- **STATE OF CONFUSION — definition:** when support or resistance **cannot settle on one strike for an
  hour**, that side is in a state of confusion. Here the resistance was undecided for 113 then 140 minutes.
- **THE SOC DIRECTION RULE:** once the **opposite side is strong**, the market moves **TOWARDS the
  confused side**.
  - Support strong + resistance confused → **bullish**, however bearish the OI/volume cluster looks.
  - (VIDEO-27 gives the mirror: resistance strong + support confused → bearish.)
- **This is precisely where option-chain readers get trapped** — the chain looks like a bloodbath
  while the market is about to rise.
- **SOC overrides the normal ceiling:** a normal WTT stops one strike below the weak level.
  **A state-of-confusion WTT does not follow that limit.** How far it can run is
  **deliberately withheld behind the paid community.** → Open Question 3.
- **Management while in an SOC trade:** watch the percentage on the confused side continuously.
  It sat at 85–86; **if it slides to 82 or 80, exit. If it holds or rises, stay in.**
  **Exit immediately if the confused side turns strong.**

---

### VIDEO-17 — EP 17: converting a spot level into a futures price and into an exact premium
**Type:** Tooling / method. **Core for order placement.**

- **All support and resistance definitions in the tool are built on the SPOT price. That never changes.**
- A **spot toggle** switches the displayed price between spot and futures. Example: Bank Nifty spot
  ≈44,213 while futures ≈44,402.
  **Because of that difference the imaginary line will always sit somewhere other than the futures
  price. That is expected, not an error.**
- Clicking the volume at the support strike 44,200 gives extension of support **44,082 in spot terms,
  or 44,271 on the futures**. Use the futures number if trading futures.
- **There is no spot trading in an index** — index levels can only be traded through futures or options.
- **THE OC TAB (premium projection):** opens a grid of input boxes, one in front of every strike on
  the call side and one on the put side. **Type the spot level you are waiting for into the box in
  front of the exact strike and the exact side you intend to trade, press calculate → the tool returns
  the premium that option will carry when spot reaches that level.**
  - Worked: market 44,213, the 44,000 call trading ₹432. Entering **44,082** against the 44,000 call
    returns **₹345** → that ₹345 is where the limit order goes.
  - The same box gives the **target premium**: enter the exit level against the same strike.
- **Why:** if you wait for the market to arrive and then enter manually, price jumps through the level
  and the trade is missed. **Place limit orders in advance.**
- **TWO NAMED MISTAKES:**
  1. Entering the level against the strike on the **opposite side** of the chain. The calculation must
     be done on the exact strike **and side** you will actually buy.
  2. Switching the **whole option chain** to the next expiry when you intend to trade the next expiry.
     **The levels must still be read from the CURRENT expiry's chain — only the OC tab is switched to
     the far expiry to get its premium.**

---

### VIDEO-18 — EP 18: intrinsic value, time value, and the real definition of ATM
**Type:** Theory. **Core.**

- **On expiry day a premium is pure intrinsic value.** Call premium = spot − strike; put premium =
  strike − spot. Demonstrated on Nifty expiring 19,545 on 4 October: 19,500 call ≈₹45, 19,450 ≈₹95,
  19,400 ≈₹145; on the put side 19,550 ≈₹5, 19,600 ≈₹55, 19,650 ≈₹105. Every strike on the wrong side
  expires at zero.
- **Before expiry: premium = intrinsic value + time value.** The 19,500 call showed IV 45.7 + TV 81.1
  ≈ traded premium ₹126.9.
- **The IVTV tab splits every strike into those two figures.**
- **ITM / OTM:** a strike has intrinsic value only on one side — those are ITM (on the app's display,
  above the line on the call side and below it on the put side). Strikes with zero intrinsic value are
  OTM and consist **purely of time value**.
- **THE ATM DEFINITION (non-standard, and used throughout the corpus):**
  **At the money = the strike carrying the HIGHEST TIME VALUE, not simply the strike nearest spot.**
  It is always one of the two strikes around the imaginary line, and **the same strike carries the
  highest time value on both the call and the put side.**
- **Why it matters:** ATM is the strike with the most power to deceive, because its time value is at
  its peak and has the furthest to fall. **A call bought ATM, taken into profit and not booked, can
  come back to the exact spot price it was bought at and still show a loss.**
- **THE LINK TO REVERSALS (the theoretical bridge of the whole product):**
  a writer earns most where time value peaks; **the price at which time value reaches its peak is where
  the writer commits most heavily — and that is the reversal price the tool calculates.**
  *(Asserted, not demonstrated. This is the closest the corpus comes to explaining the reversal price.)*

---

### VIDEO-19 — EP 19: strike selection by arithmetic
**Type:** Theory. **Core for strike choice.**

- **The 50-point shortcut:** Nifty strikes are 50 apart. **A 50-point move in the index pushes a
  strike's premium to roughly whatever the ADJACENT strike's premium is right now.**
  Verified with the OC calculate box: the 19,550 call at ₹99 → ≈₹125–126 on a 50-point rise (= what
  the 19,500 call trades at) and ≈₹75 on a 50-point fall. Put side mirrors: ₹103 put → ≈₹128–129 on a
  50-point fall, ≈₹80 on a 50-point rise.
  **So a rough target needs no calculation: read down or up the chain in steps of the strike gap.**
- **THE SELECTION TABLE:** for each strike record — premium now, premium after +50, resulting profit,
  premium after −50, resulting loss.
  - Moving from far OTM towards deep ITM, the profit on the same 50-point move ran roughly:
    **13, 16, 20, 25, 27, 31, 38, 37, 38**.
  - The instinct is to take the 38. But the deepest ITM strikes **lose about 37–38** on the same move against.
  - **Best pairing in this example: the 19,450 call — about +38 on a 50-point rise against about
    −31 on a 50-point fall.** Most money for the movement, least risk for the same movement.
  - OTM strikes give both a small gain and a small loss — the movement is not paid for.
- **THE GENERAL RULE:** **the best strike is usually the SECOND strike in from the imaginary line on
  the IN-THE-MONEY side, occasionally the third.** True on both the call and the put side.
- After doing this by hand 8–25 times, the **IVTV tab** replaces the arithmetic — reading intrinsic
  against time value gives the same answer at a glance.
- **Caveat flagged in-source:** the 50-point equivalence is an approximation that holds near the money
  and degrades further out. *(Contrast with VIDEO-107, which says prefer DEEP ITM for intraday index
  trading — see Open Question 9.)*

---

### VIDEO-20 — EP 20: first touch vs second touch, and the compare feature
**Type:** Worked case (19 July). **Core.**

- **The challenger idea restated:** through the day a strong level gets challenged by another strike
  trying to take its place (sledging analogy). **The market often travels to the challenger's level**,
  which is why the chain can look like one thing and resolve as another.
- **Strong support + strong resistance is NOT automatically a safe trade.** A support that was WTB
  earlier can still let the market make one extra divergence. Keep "safe" and "risky" apart.
- **COUNT THE TOUCHES.** The market *opened* at the extension of support — **the open itself was the
  first touch.** It came back ~10:40 for the second. First = safe; from the second the market has
  room to fall further.
- **A trade from the extension of resistance is carried only to the midpoint**, booking profit on each
  divergence, never held on the assumption that the opposite level will be reached.
- **THE COMPARE FEATURE:** click the volume on the put side of a strike → a **compare** option appears
  → select the next strike down and add it. **The percentage that comes back is the reading.**
  Example: 19,700 compared against 19,600 sat near **75**, treated as confirmation of a move towards
  the bottom.
- **TWO RULES AGREEING = the day's floor (the key lesson):**
  - Strong support being hit a **second** time → target = **extension of support minus one strike**
    (the 19,750 divergence, ≈19,726–19,727).
  - Support turning **WTB at 19,700** → target = **that strike plus one** → again the 19,750 divergence.
  - Both rules producing the same number fixed the day's low. The market hit ≈19,726–19,733 repeatedly
    from 11:15 AM to ~12:10 PM without breaking it. Because the floor was confirmed twice, buying calls
    there was a **safe** bullish trade, destination the extension of resistance ≈19,830.
- **The counter-intuitive core of the episode:** without the WTB reading, a second touch of support
  would have meant an extra divergence down. **The weakness appearing at the IMMEDIATELY ADJACENT
  strike reverses that and holds the market up.** "Look somewhere, target somewhere."
- **Scaling:** if the weakness appears a divergence further away (at 19,750 rather than 19,700), the
  arithmetic moves with it and the plus-one target becomes the extension of support itself.
- **Exit all option-chain trades by 2:30 PM.**

---

### VIDEO-21 — EP 21: shifting is a PROCESS, and the IV gate
**Type:** Live caller review (18 October). **Core — two rules of high build value.**

- **The caller's error:** he read correctly (support expected to shift 19,800 → 19,700 because volume
  read 32 lakh against 24 lakh) but **entered ~30 minutes too early**.
- **RULE: shifting is complete only when the VOLUME DIFFERENCE between the old and the new support
  strike closes to NEAR ZERO.** Until then the level has not moved.
  - Tracked: ~8 lakh gap at 12:00; ~6 lakh at 12:15 (33 vs 27 lakh); still ~5 lakh at 12:30 when the
    caller entered; by 1:10 ~35.91 lakh vs 34.68 lakh (≈1 lakh apart); **by 1:20 the gap was ~10,000
    → shifting effectively done.**
  - **With shifting complete, the correct entry was the DIVERGENCE OF THE NEW SUPPORT'S EXTENSION** —
    the Call-side value of the 19,700 strike, ≈19,708–19,709. A line drawn there held: the market
    topped ≈19,725 around 2:00 PM and fell away.
- **RULE: the IMPLIED VOLATILITY GATE.** All the levels are derived from the Greeks, **so when the
  Greeks move fast the level values become unreliable.**
  - IV around the imaginary line sat stable at **9.6–9.9 from 9:30 to ~10:30**.
  - From 10:45 it rose: ~10–10.5, toward 11 by 11:15, ~11.2 by 11:30.
  - **Because it was rising on BOTH the Call and Put sides, the market turned volatile and the
    divergence below the extension of support could not be trusted.**
  - **Stable IV → the levels reverse the market accurately. Rising IV on both sides → they will not.**
- **Also:** when a market touches both extensions one after the other, the **second** visit to either
  is riskier and an extra divergence should not be a surprise.
- **Discipline instructions:** back-test any method yourself 10–20 times before putting money on the
  value; stay on a single lot for six months to a year.
- **NON-CORE block:** a paid HDFC Life NFO promotion occupies the middle of the video.

---

### VIDEO-22 — EP 22: Scenario 2 (support strong, resistance WTB) and DOUBLE SHIFTING
**Type:** Theory + replay (23 October). **Core.**

- **Scenario 2 = support strong + resistance WTB. It is a BEARISH structure and it is a trap:** a
  trader sees strong support, assumes a reversal, buys Calls — and the market breaks the support.
  **The Put entry comes from the WTB resistance, not from the support.**
- **DEPTH RULE:** the depth of the fall does **not** depend on how many strikes the yellow WTB band
  sits below resistance. **In every case the target is the same: one strike below the extension of
  support — written EOS-1.**
- **DISTANCE RULE:** what the distance *does* change is how far the market rises before falling, and
  therefore **your risk**.
  - Resistance 19,950: weak band one strike lower → selling at its divergence risks ~50 points up to
    the extension of resistance. At 19,900 → ~100 points. At 19,850 → ~150 points.
  - **The nearer the WTB band is to resistance, the safer the Put trade.**
- **A SCENARIO CAN BE CANCELLED MID-DAY:** if the yellow band moves to a different strike, the old
  scenario is **cut** and a new one begins. **Bottom→top move = bullish shifting; top→bottom = bearish.**
  This can happen **inside two minutes**.
- **Replay:** 9:18–9:21 showed resistance WTT with strong support → scenario 3, bullish. ~9:41 the
  resistance shifted down 19,600 → divergence of 19,550 → 19,500, reversing the morning read to bearish.
- **Entries:** with the weak band at 19,500, the Call-side value of that strike read 19,544 while the
  market traded 19,536 → that was the sell point. A safer, later entry was the **divergence of 19,550,
  ≈19,596**.
- **Targets:** extension of support ≈19,497, then **EOS-1 ≈19,449–19,450**. The market fell ~100 points
  and stopped at the lower line.
- **DOUBLE SHIFTING:** by 10:23 the resistance shifted a **second** time. Two bearish shifts in a row
  (19,600 → 19,550 → 19,500) is **double shifting**, and it means **the fall will NOT stop at EOS-1**.
  Targets extend: **EOS-2 at 19,400 (value ≈19,402), then the divergence of 19,350 ≈19,359.**
- **Counter-example given:** had the resistance jumped 19,600 → a strong 19,500 **without pausing at
  19,550**, there would have been no double shift and the market would have reversed from the extension
  of support instead.
- **Notation established:** EOS-1, EOS-2, EOS-3 (and by symmetry EOR+1, EOR+2).
- **Data-cadence fact:** historical replay steps in **2-minute** intervals while live data refreshes
  about every **3 seconds**, so some shifts are invisible in replay.
- **Deferred:** where the market reverses during a blood bath cannot be answered from COA 1.0 — that
  is COA 2.0 (VIDEO-31).

---

### VIDEO-23 — EP 23: the GAME OF PERCENTAGE (scenarios 8 and 9)
**Type:** Theory + replay (Bank Nifty, 25 October). **Core — this resolves scenarios 8 and 9.**

- **The stuck scenario:** both support and resistance at 43,300, line between 43,300/43,400.
  Resistance WTT (bullish), support WTB (bearish) → the two cancel. Normal option-chain reading,
  candlesticks and indicators all lose money here.
- **First behaviour:** the market **consolidates between the divergence of the Call side of 43,300
  (≈43,350) and the divergence of the Put side (≈43,250)** — a 100-point band. Sell the top, buy the bottom.
- **THE PERCENTAGE:** next to each weak level the app shows a percentage **derived from the volume at
  the two strike prices being compared**. It measures how hard that side is pulling.
  **Whichever percentage is higher wins.** Here WTB read 96–99 against WTT 84–87 → downward pull →
  expect an overshoot below the extension of support.
- **TWO CAUTIONS ON READING IT:**
  1. When the imaginary line moves, a level can turn grey and a "weak towards top" label can appear
     that is **only an artefact** — check the raw volume numbers, not the colour.
  2. **Use the Compare feature to pick the right strike to compare against**, or the percentage means nothing.
  - Live example of the arithmetic: 1 crore 35 lakh against 1 crore 11 lakh → weakness reading **82**.
    *(1.11/1.35 = 82.2% — so the percentage is `second ÷ highest × 100`. This is the clearest
    statement of the formula anywhere in the corpus.)*
- **THE NINE PERCENTAGE COMBINATIONS (this is a SECOND, distinct nine-way table — do not confuse it
  with the COA 1.0 nine scenarios):**

  | Resistance % | Support % | Market |
  |---|---|---|
  | Increasing | Stable | Bullish |
  | Decreasing | Stable | Bearish |
  | Stable | Stable | Consolidation |
  | Increasing | Increasing | Consolidation |
  | Decreasing | Increasing | Bearish |
  | Stable | Increasing | Bearish |
  | Stable | Decreasing | Bullish |
  | Increasing | Decreasing | Bullish |
  | Decreasing | Decreasing | Consolidation |

- **How the session ran:** morning resistance % stable, support % increasing → bearish. Then both
  stable → the 100-point band held, giving repeatable buys near 43,250 and sells near 43,350–43,390.
  By 12:02 support weakness 95 vs resistance 85, volumes ≈63 lakh and ≈60 lakh → setup for a real break.
  **The volume gap at the support strikes was then watched tick by tick: 96,000 → 70,000 → 40,000 →
  7,000 → shift complete.** Target became the divergence of 42,900 (≈42,890–42,907); the market went there.
- **Entries offered:** divergence of 43,100 ≈43,188 = high-risk sell; divergence of 43,200 ≈43,288 = safer.
- **Profit rule:** book at the divergence of 43,000 **unless** resistance has turned strong by then.
  **Only if the resistance percentage starts DECREASING do you hold for one more divergence down to 42,900.**

---

### VIDEO-24 — EP 24: Scenario 5 (support WTT, resistance strong) and the 60-MINUTE RULE
**Type:** Theory + replay (27 October). **Core.**

- **Scenario 5 = support WTT + resistance strong → a buy-Calls-from-the-bottom setup.**
- **Morning:** support 18,900, resistance 19,000, line ≈18,938, market ≈18,947. Both strong at first →
  market travels between extension of support (≈18,864) and extension of resistance (≈19,026), stopping
  at the divergences on the way. **Four lines: the two extensions plus the Call-side and Put-side
  divergences of 18,950.** Market reached the extension of resistance ≈19,026 by ~10:05.
- **9:35–9:40 the support turned WTT → classification becomes scenario 5.**
- **WHAT SCENARIO 5 PREDICTS:** the market will **not** stop at the extension of resistance. It carries
  **one divergence further**. The top of the day becomes **the divergence of the strike one above
  resistance** — the divergence of 19,050, ≈19,056 in the morning / ≈19,069 in replay.
- Because the structure is bullish, **a short at the extension of resistance is a trade against the
  scenario — possible but risky, and he says not to take it.**
- **THE 60-MINUTE RULE:** once WTT appears, **the support has 60 minutes to complete its shift upward.**
  Clock started ~9:37–9:39 → deadline ~10:39.
  - **If the shift completes in time → the bullish move follows.**
  - **If it does not → the situation becomes a STATE OF CONFUSION.**
- **Entries:** aggressive = the value at the WTT support strike, ≈18,997. Safer = the divergence of the
  Put side of 18,950, ≈18,916. The market fell back to ≈18,970–18,975 between 10:02 and 10:25 — the buy.
  From there to 19,056 is ~80 points, the video's "best trade of the day".
- **CRITICAL: shifting does NOT extend the target.** Even after the support shifts, the destination
  stays one divergence above resistance.
- **Percentage as confirmation:** the WTT percentage **falling** steadily shows the shift is progressing
  and how fast: 99 → 97 → 93 → 92 → 80 → 79. **A reading near 79–80 means the level is close to becoming
  strong**, and the colour lightens toward yellow — that is the reassurance to stay in the Call trade.
- **Late-session flip:** the resistance percentage began **rising** (into the low 70s) → resistance itself
  turning WTT. **Support shifting up + resistance shifting up = DOUBLE SHIFTING = a BULL RUN** — which is
  why the short near the top (divergence just under the extension of resistance, ≈19,016) did not produce a fall.

---

### VIDEO-25 — EP 25: "the tool failed" — read from the FIRST TICK
**Type:** Defensive replay (10 October). **Core for one rule; note the unfalsifiability problem.**

- **The complaint:** strong support + strong resistance, Puts bought at the extension of resistance,
  market ran higher instead. Support 19,500, resistance 19,600, extension of support ≈19,557–19,576,
  extension of resistance ≈19,607–19,611. Market reached the extension ~11:14, sat there, broke above
  by ~12:15 to ≈19,660.
- The speaker first **rules out** the easy explanation: at 11:14, 11:30 and 12:15 the resistance was
  still strong, so a mid-day turn to WTT was not the cause.
- **THE ACTUAL ANSWER — read from 9:16, the FIRST TICK, not the 9:30 view:** support at 19,500 was
  **WTT** while resistance was strong → **scenario 5**. In scenario 5 you buy every bottom and never
  sell the top; the destination is **one divergence beyond the extension of resistance** — the
  divergence of 19,650, ≈19,656.
- At 9:18 the support shifted bottom→top, giving a buy ≈19,562–19,565 against a target ≈19,660
  (~100 points) while the market was still ≈19,595. **The support then had 60 minutes to become
  strong; it finished in about 10 minutes, by 9:30.**
- **THIS IS THE KEY DIAGNOSTIC:** a latecomer arriving at 9:30 sees "both levels strong" and calls it
  **scenario 1**. It is actually **scenario 5 with the support already shifted up.**
  → **The scenario label is path-dependent; a snapshot is insufficient.** This is restated in
  VIDEO-39, VIDEO-40, VIDEO-108 and VIDEO-112.
- **The two permitted outcomes at an extension of resistance:** waiting, or taking a divergence down.
  (Here it waited ~an hour.)
- **Later entries:** ~11:25 the Put-side value of 19,650 began printing ≈19,616 → risky Call entry,
  target still ≈19,665. Called risky because the market retains the right to drop back to the extension
  of support first; **his stated response is to average down rather than exit.**
- **12:30–12:45:** volumes at the compared resistance strikes read ≈18 lakh vs ≈25 lakh → weakness
  ≈72–73 and rising → resistance turning WTT too. **With support already shifted up, scenario moves
  5 → 7 = a BULL RUN: no Put buying at all, exit any Puts held.** Next Call entry ≈19,666, target from
  the 19,700 strike ≈19,715–19,718 — the day's high.
- **Flagged in-source:** the thesis "the tool never fails, every loss is a reading error" makes the
  method **unfalsifiable**. Also: averaging down into a losing risky trade is advised with **no risk
  limit or sizing rule**.

---

### VIDEO-26 — EP 27: positional stock trades from OI alone (the Swing tab)
**Type:** Method. **Core for the positional path.**

- **Horizon:** hold ~**10 to 15 days**, not intraday.
- **Timing rule tied to the MONTHLY expiry cycle: take positions in the FIRST 15 DAYS of the month
  and book profit; avoid opening new ones in the second half.**
- **Direction limits the instrument:** a **bullish** signal can be traded by buying and holding.
  A **bearish** signal **cannot be held as a bought option** — it must be taken in cash, futures, or
  option writing.
- **THE POSITIONAL READING RULES:**
  - Tool = the **Swing tab** from the home button.
  - **For positional work read OPEN INTEREST, not volume. Volume is an intraday measure only.**
  - Highest OI on the **put side** = support; highest on the **call side** = resistance.
    A second impactful OI reading is shaded yellow.
  - WTT/WTB are judged **from OI** in this mode.
  - **The distance between the support strike and the resistance strike is the expected move**
    (~₹10 in both examples).
- **THE CHECK THAT DECIDES THE TRADE (the trap filter):** the yellow band alone is not enough.
  **Open the historical data and find out where that Open Interest CAME FROM.**
  - OI has moved **up into** the strike from a lower one → the support is genuinely strengthening → good buy.
  - OI is **drifting down** towards a lower strike → wrong way → the "support" is a **trap**.
- **Examples:**
  - *Apollo Tyres, 5 Nov* — put OI highest at 380, call OI at 390, ~₹10 range, but support WTB and
    preparing to shift to 370. Walking back through 2 and 3 Nov showed the OI had **not** previously
    held at 370 — it was heading down → **labelled a trap, skipped.**
  - *Federal Bank* (the speaker's own position) — 4 Nov support 140, resistance 150. Going back to
    27 Oct, 140 was WTB in the morning, but **through the day the weakness percentage FELL and the
    yellow LIGHTENED → the support was strengthening.** Lows ≈138 on 27 Oct and ≈137–138 next day;
    he says he bought ≈138.8–140, stock at 143 at recording, target 150.
- **Entry value:** taken by clicking the volume at the **extension of support**.
- **Build note:** "falling weakness percentage + lightening yellow = level firming up" is a reusable
  confirmation signal, used again in VIDEO-24 and VIDEO-33.

---

### VIDEO-27 — EP 28: SOC form 1 — confusion on the SUPPORT side = BEARISH
**Type:** Theory + replay (Nifty, 7 November). **Core.**

- **Setup:** resistance strong from the open near 19,400; support could not be pinned — 19,400, 19,350
  and 19,300 all competing.
- **EARLY-WARNING SIGNAL: volume developing at THREE strikes at the same time** — here ≈2,34,000,
  96,000 and 1,89,000, all still growing at 9:19 and 9:29.
  **Three developing strikes show up early in the morning. With only two you usually cannot tell until
  the afternoon.**
- **THE TWO CONFIRMATION FORMS (this is the precise SOC test):**
  1. **The weakness percentage on the undecided side holds at the same level for a FULL HOUR without
     shifting.** Here it sat near 80 from 9:33 to 9:47 and was still only 85–86 past 10:25.
  2. **The shift DOES complete inside the hour but the level still does not become strong** — e.g. WTT
     stuck at 98 or 99. **In that case wait ONE MORE HOUR; if still unresolved, declare SOC.**
     **So the decision can take up to TWO HOURS.**
  - **Throughout, the other side must remain strong.**
- **DIRECTION RULE:** **confusion on the SUPPORT side → the market will be BEARISH.**
  **This holds whether that support reads WTB or WTT.**
  → **This is the important reversal: normally support WTT is bullish; inside an SOC it is not.**
  Confusion on the **resistance** side → **bullish**.
- **The trades:**
  - Risky sell = the **Call-side value of the 19,350 strike**, which was **breaking out** while the
    market traded ≈19,390.
  - Safe sell = wait for the **extension of resistance ≈19,410**.
  - Risk from 19,390 up to 19,410 ≈20–25 points; downside target — the **Put-side divergence of
    19,350** ≈19,306–19,320 — ≈70–90 points. **That asymmetry is the justification.**
  - Intermediate pause levels: ≈19,360 near the extension of support, ≈19,310 near the divergence.
  - Market ground sideways to ~11:40, then fell to ≈19,320 — the day's bottom and the profit point.
  - **Because that bottom is fixed by the confused support, the same analysis gives a SECOND, safer
    trade: buy Calls there and hold back up to the extension of resistance ≈19,409–19,410.**
- **Discipline:** ignore 10–25 point swings; only average when price actually reaches the level you
  nominated in advance. **Ignore a blue level appearing at a lower strike mid-fall — the original
  support strike still defines the target.**

---

### VIDEO-28 — EP 29: SOC form 2 — confusion on the RESISTANCE side = BULLISH
**Type:** Theory + replay (Nifty, 8 November, expiry day). **Core.**

- **The day flipped in the first two minutes.** First tick ~9:13–9:15: support 19,400 strong,
  resistance 19,500 WTB → **scenario 2, bearish**. Within minutes the resistance volume shifted
  19,500 → 19,450, and three strikes (19,500 / 19,450 / 19,400) began developing volume together.
  **By 10:21 they read ≈12 lakh, 12 lakh and 11.67 lakh: no winner.**
- **THE DOUBLE CROSS (a named complication):** the resistance was made of **both volume and OI**; the
  **volume** moved to 19,450 while the **OI** drifted toward the imaginary line.
  **The market follows the VOLUME.**
- **SOC clock here runs 60 minutes from the FIRST TICK** — 9:15 → 10:15. If resistance has not settled
  by then, it is a state of confusion. The other side must be strong throughout (support was).
- **Confusion on the resistance side → BULLISH** (mirror of VIDEO-27).
- **UPSIDE LIMIT:** the **divergence of whichever strike holds the yellow shade.** With 19,450 yellow,
  the target was its **Call-side divergence ≈19,474**. Had the yellow moved to 19,500, the target would
  have become ≈19,520.
- **PREPARE VALUES BEFORE THE TRADE EXISTS:** while waiting out the 60 minutes he writes down the risky
  buy = extension of support plus one ≈19,416, and the safe buy = extension of support ≈19,372, and
  draws those plus the 19,474 target **in advance**.
- **THE MISTAKE THE EPISODE IS BUILT AROUND:** at 10:21, with SOC confirmed and the market at 19,438,
  **buying at that market price is named the single biggest mistake.** The correct action is to click
  the strike, read the value (≈19,420–19,425 at that moment) **and wait for price to come to it.**
  It came at ~11:15 with the market at 19,411; price rose through the afternoon to ≈19,460 by 2 PM,
  **repeatedly hitting the divergence value — repeated hits on that value are the EXIT signal.**
- A second entry set up later (Put-side value of 19,450 ≈19,430, low ≈19,420) was **refused because it
  came after 2:30 PM.**
- **Forward reference:** a later episode on IV as a guide to whether the premium will rise.

---

### VIDEO-29 — EP 30: SOC session 3 — restarting the clock, and re-computing R:R
**Type:** Replay (9 November). **Core for two rules.**

- **First tick 9:15:** support 19,300 **WTT**, resistance 19,500 **WTB** — **both levels moving toward
  each other = the consolidation case = NO TRADE under COA 1.0.**
- **Named misreading:** a lower strike showing large volume (19,250) is **not** the support. Support was 19,300.
- **PRIORITY RULE:** the support then shifted up to 19,400 and became strong while the resistance was
  still drifting down. **The side that FINISHES its shift FIRST gets priority** → bias turned bullish
  with the market ≈19,417.
- **FOUR PATHS WRITTEN OUT IN ADVANCE (a good template for our UI):**
  1. Support also turns WTB → market breaks downward.
  2. Support stays strong **and** the resistance percentage holds steady for an hour → SOC → market
     rises from the bottom.
  3. Resistance shifts down to 19,450 and becomes strong → market falls to the extension of support.
  4. Resistance becomes strong again at 19,500 → market runs one divergence above resistance.
- **Shift tracking:** 98 at 10:15 (volumes ≈63 and 62 lakh); 63.8 vs 64.2 at 10:21; essentially
  complete by 10:27.
- **THE CLOCK-RESTART RULE:** **a shift completed is NOT the same as a level turned strong.**
  **From 10:27 you wait ONE MORE HOUR — to 11:27 — before calling a state of confusion.**
- **Entry:** the value at the **divergence of 19,450**, reading ≈19,420 while the market stood at
  19,423 — the 11:15 candle made its low right there.
- **HOLDING RULE FOR THAT CALL:** watch the percentage as it falls. **Above ~85 you can stay in.
  Below 85 the shift is completing and the market turns bearish, so the trade must be reversed.**
- **THE R:R RE-COMPUTATION RULE (important):** by 11:33–11:43 the market reached the divergence of
  19,450 (≈19,470–19,473) and stalled. **Recomputing from that point:** max upside = divergence of
  19,500 ≈19,518 (~50–60 points); downside if the resistance shift completes = extension of support
  19,394 then one extra divergence to 19,349 (~110 points).
  **That imbalance turns it into a PUT trade for a risk taker.**
  → **A bullish trade can become a bearish one purely because the remaining upside has shrunk.**
- **STRENGTH RULE:** by ~1:48 PM the resistance had turned strong, with **both its percentage and its
  volume falling. Only ONE of the two needs to firm up for the level to count as strong.**
- **Precision demonstration:** with support strong in itself, the market does not fall straight through
  the extension of support — **it takes a divergence off it first.** Extension of support ≈19,380–19,385,
  its divergence above ≈19,395–19,400 — a band of only 10–15 points. On 1-minute candles the market
  bounced inside that band five or six times in the late afternoon ("dot to dot").
- **NON-CORE block:** paid Bajaj Allianz NFO promotion.

---

### VIDEO-30 — EP 31: what to do when a trade at a strong level goes against you
**Type:** Short method (2 November 2023). **Core for risk handling.**

- **Setup:** ~9:50 AM, both levels strong around 19,800. Extension of resistance ≈19,820, extension of
  support ≈19,760; the market rotated between the two.
- **First touch of each extension = safe.** On this day extension of support was hit once ~9:15 and
  extension of resistance once ~10:00. **The danger is the SECOND touch** — a trader who arrives late,
  or misses that the first touch already happened, buys a Call at the extension of support and the
  market breaks straight through.
- **THE OUTER BOUNDARY ("extra divergence"):** when both levels are strong, the claim is the market
  **cannot travel beyond the extra divergence on either side.**
  - Upper limit: click the **Call side of the 19,850 strike** → **19,863**.
  - Lower limit: click the **Put side of the 19,750 strike** → **19,720**.
  - **So a Call caught in the fall has a defined place to average — 19,720 — rather than an
    open-ended loss.**
- **Stop loss placement:** **below that STRIKE price** — here below 19,750 and then below 19,700.
  **If price goes there, the scenario itself has changed.**
- **Averaging eligibility:** average **only if you trade multiple lots**, adding a quantity matching
  what you already hold. **A single-lot trader should not average — hold the position back to cost instead.**
- **Never hold a stuck bought option in hope. If you cannot exit cleanly, book the loss and get out.**
- **Flagged tension (real, and unresolved in-source):** averaging into a loser sits uneasily next to
  "book losses rather than hold". The video does not reconcile them. → Open Question 5.
- **Data availability fact:** at 9:19 **no data was available at all** — the levels only appeared from
  ~9:50, **since volume has to build first.**

---

### VIDEO-31 — EP 32: CHART OF ACCURACY 2.0 (the OI-change graph)
**Type:** Theory. **Core — this is a second, separate nine-scenario framework.**

- **Problem it solves:** a consolidating market gives no clue which way the next move goes. Two places
  it happens: after price has reached its extensions, and mid-market between divergences.
  It also covers the **second hit** of an extension, where the reversal trade becomes risky.
- **EXPLICIT WARNING: do NOT use COA 2.0 on the FIRST hit of an extension. It will point the opposite
  way and talk you out of a valid trade.**
- **Where it lives:** clicking **"OI Change"** on either the call or the put side opens the chart.
  **Two lines: RED = put-side OI, GREEN = call-side OI.**
- **Live example:** 1 December, 7 Dec Nifty expiry, ~3 PM. Price stalling ≈20,290 between the 20,250
  and 20,300 strikes; the 20,300 extension reading ≈290.
- **THE NINE SCENARIOS OF COA 2.0:**

  | # | Call OI | Put OI | Reading |
  |---|---|---|---|
  | 1 | Flat | Flat (parallel) | Consolidation — price stays stuck |
  | 2 | Rising sharply | Flat | **Bearish** from that strike's divergence |
  | 3 | Falling | Flat | **Mildly bullish** from that strike's divergence |
  | 4 | Flat | Rising sharply | **Mildly bullish** from the strike where put OI is rising |
  | 5 | Rising sharply | Rising sharply | **Boxed** between the two strikes. Breaks below the call-side divergence and rises above the put-side divergence. Expect ~50 points of range in Nifty, ~100 in Bank Nifty, the strike gap in stocks |
  | 6 | Falling sharply | Flat | **Strong bullish run** off that strike's divergence |
  | 7 | Flat | Falling steeply | **Price falls** from that strike |
  | 8 | Rising | Falling | **Price falls** off that strike's divergence |
  | 9 | Falling | Falling | Whole market consolidates until a direction appears |

- **Usage:** read it only when price has been range-bound for hours, or on a **second** extension hit.
  **Identify the STRIKE at which the described OI behaviour is happening — that strike's DIVERGENCE is
  the level the move starts from.**
- **Unclear:** scenarios 6 and 7 are the most garbled part of the transcript; direction calls are clear
  but the exact line behaviour should be confirmed. → Open Question 8.
- **Also relevant:** VIDEO-110 adds a hard constraint — **COA 2.0 is useless AT the support or
  resistance strike itself** (call and put OI differ by an order of magnitude there); use it only at
  **intermediate strikes where call and put OI are roughly comparable.**

---

### VIDEO-32 — EP 33: shortlisting positional trades with the swing tab (bearish worked example)
**Type:** Method + replay (Asian Paints, 2 January 2024).

- **Why not charts:** chart-based positional traders get caught by fake breakouts; with ~200 F&O names,
  manual chart research is impractical. Start from **Open Interest**, which shows the pressure before
  the chart confirms it.
- **The swing scanner ("IDD Swing")** lists only the stocks currently sitting **close to** their support
  or resistance — the ones worth researching. Split into **bullish** and **bearish** candidates.
- **A MARKET-WIDE SIGNAL:** on 2 Jan the bullish side was **completely empty**; only bearish names
  appeared (Asian Paints, Delta Corp, GNFC, HDFC Life, Lupin, MRF, Naukri, Vedanta, Gujarat Gas,
  JK Cement, Marico, National Aluminium, Tata Consumer, Voltas).
  **An empty bullish list is read as market-wide selling pressure: if no stock can turn bullish, the
  index cannot either.** Nifty printed a large red candle that session.
- **An appearance on the list is a RESEARCH TRIGGER, not a trade signal.**
- **Asian Paints walkthrough:** at the 3,400 strike, call-side OI read 145 and was flagged **strong**.
  Clicking the call-side volume returned **≈3,392** as the top value for the stock.
  Day-by-day replay of how the ceiling formed:
  - **21 Dec** — highest OI at 3,300, strong on the put side, WTT on the call side, price ≈3,291 →
    allowed a run to 3,400 but blocked anything above.
  - **27–28 Dec (expiry)** — highest OI at 3,400, still WTT, fresh OI building at 3,500.
    **Expiry-day positions unwind, so this reading is unreliable — ignore or discount expiry-day OI.**
  - **29 Dec** — price pinned at 3,400 with a 3,500 build-up pushing it slightly above.
  - **1 Jan** — the 3,400 OI turned **strong**. **That is the point the setup becomes a sell**;
    extension of resistance ≈3,400.
  - **2 Jan** — price fell 3,400 → ~3,300, low near 3,300, retraced; by 3:30 PM still strong OI at 3,400
    with 3,300 as the target zone.
- **The trade stays valid as long as price cannot get back above 3,400.**

---

### VIDEO-33 — EP 34: "OI moves, price follows" — Coal India over two weeks
**Type:** Replay (Coal India, 14–29 December).

- **Claim tested:** positional positions can be built from the option chain alone; the chart is shown
  only as a check, and the chain gave the same information earlier and with less ambiguity.
- **The reading:**
  - **14 Dec** — highest put OI at 350 (support), highest call OI at 360 (resistance), price ≈343–344.
    Floor 350, ceiling 360 → the buy sits close to support.
    **A ~₹10 move on a ₹350 stock is framed as good momentum, expected inside 2–5 days, not 2–3 weeks.**
  - **15 Dec** — price dipped a few rupees but the 350 put OI stood ≈2,200 and stayed strong → floor held.
  - **19 Dec** — price jammed at 355 where a fresh call build-up appeared.
    **COLOUR-INTENSITY SIGNAL:** the 355 cell was **dark yellow at 11 AM, still dark at 12:15, faded to
    light by 1 PM**. **Fading colour = the pressure at that strike releasing.**
    Once the 355 block lightened, price cleared 360 at ~2:15–2:20 PM (one large late candle).
- **FOLLOWING THE CROWD FROM STRIKE TO STRIKE:** after the break, ~5,500 contracts left 355 and ~442
  appeared at 370, while a new put build-up of ~653 formed at 360.
  **Reading: 370 is the next target, 360 is the new floor.** By 2:45 and again 3:15 the shift was
  complete — the 360 crowd had moved to 370. Price touched 370 and sold off there.
  - **20 and 28 Dec** — price pulled back towards 350 (highest put OI) → fresh buying opportunity, same 360 target.
  - **22 Dec 10:30 AM** — the 360 OI (≈2,400 the previous afternoon) had moved up to 370. Price followed
    and reached 370 by 26 Dec.
  - **28 Dec 10 AM** — highest OI appeared at **390** (≈901) → ceiling moved another ₹10–20 up.
    Price made 380 that day, 390 on 29 Dec, high 390.95 on the recording day.
- **RULES EXTRACTED:**
  - Highest put OI = floor; highest call OI = ceiling; buy near the floor with the ceiling as target.
  - **The OI moving to a higher strike is PERMISSION for price to follow it.**
  - **When OI leaves a level and rebuilds one strike higher, expect the old resistance to become the
    new support.**
  - Exit at the strike the crowd has moved to, rather than holding through it.
  - Watch colour intensity intraday: darkening = level holding; fading = pressure coming off.
- **Flagged in-source:** one stock over one trending fortnight, chosen after the fact; nothing shows
  the same reading failing.
