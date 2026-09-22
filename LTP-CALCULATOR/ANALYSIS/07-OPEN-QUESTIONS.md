# Open questions, contradictions and gaps

Nothing here has been silently resolved. Each item states **what the files actually say**, **why it
matters for a build**, and **how it could be settled**.

> **⚠ READ `08-V2-DELTA.md` ALONGSIDE THIS FILE.** The `KEY-POINTS-V2/` English re-extraction
> arrived after this document was written and changes it: **OQ-24, OQ-25, OQ-28 and OQ-31 are
> RESOLVED**; OQ-13, OQ-23 and OQ-27 are narrowed; **OQ-35 is made sharper and more urgent**;
> and a new **OQ-39** (the LTP Swing star-rating rule) is added there. OQ-1 is untouched and still
> the blocker.

Severity: **BLOCKER** = cannot build without it · **HIGH** = wrong output if guessed wrong ·
**MEDIUM** = affects a rule but not the core · **LOW** = cosmetic or historical.

---

## OQ-1 — The reversal-price formula is never given · **BLOCKER**

**What the files say.** Around twenty files state the reversal price is "derived from the Option
Greeks". The most complete input lists:

- **V124** (the manual prototype): *market price, call-side LTP, put-side LTP, delta, theta, vega,
  gamma* → press calculate → **the reversal price for that strike.**
- **V47** (earlier versions): *market price, Call data, Put data, IV, Theta and Delta* typed in manually.
- **V111**: *"Delta, Theta, Vega, Gamma, Rho — plus implied volatility, both sides' last traded
  prices, spot and futures."*
- **V107**: the Greeks themselves come from **Black-Scholes**.
- **V18** (the only theoretical bridge): *"a writer earns most where time value peaks; the price at
  which time value reaches its peak is where the writer commits most heavily — and that is the
  reversal price the tool calculates."*
- **V54 / V82** (the economic framing): *"when the demand-supply ratio shifts enough, price can
  reverse; the strongest reversal price is picked using volume and OI at each strike, with Greeks in
  the calculation."*

**No file gives the formula.** V06 says the exact reversal value "is a feature of his paid tool; the
video does not show the calculation."

**Why it matters.** Everything is built on it: extensions, divergences, EOR±n/EOS±n, all four 9:20
lines, all eight AI lines, Max Pain, Max Gain, the HOI reversals in LTP Swing, and the reversal-gap
directional rule in V126.

**How it could be settled.** (a) Reconstruct from V18's hypothesis — find, per strike, the spot level
at which that strike's time value is maximised, given the current Greeks — and validate against the
dozens of worked (strike → reversal value) pairs scattered through the files. (b) Ask the user
whether the app's API or any published documentation exposes it. (c) Treat it as a pluggable function
and ship a documented approximation. **This decision has to be made before anything else.**

---

## OQ-2 — Is a volume-only level stronger or weaker than an OI-only level? · **HIGH**

- **V05** ranks them: **volume+OI > volume only > OI only**, with a mechanical reason
  (volume cannot fall intraday; OI can, because writers buy back).
- **V43** shows the two hosts **disagreeing on screen**: one says volume+OI is stronger and
  **volume alone is weak**; the other says a level works equally well whichever column produced it.
  **Neither position is demonstrated.**
- **V105** sides with volume for intraday: *"OI is what writers are ASKING for; volume is what
  intraday traders are actually EXECUTING"* — and he trades the **volume** levels while the highest
  OI sits far away.

**Recommendation to put to the user:** follow **V05 + V105** (volume-primary for intraday) and treat
V43's dissent as one guest's opinion. But it should be an explicit, flagged decision.

---

## OQ-3 — How far can a State-of-Confusion move run? · **HIGH**

**V16:** *"A normal weak-towards-top stops one strike below the weak level. A state-of-confusion
weak-towards-top does NOT follow that limit — how far it can run is held back for the paid community
content."*

**Deliberately withheld.** Partial answers elsewhere:
- **V28** gives an upside limit for a resistance-side SOC: **the divergence of whichever strike holds
  the yellow shade.**
- **V27** gives a downside floor for a support-side SOC: **the put-side divergence of the lowest
  support candidate.**
- **V100** says a bullish SOC is traded **exactly like a bull run**, which implies the bull-run
  target structure applies.

**Whether those partials ARE the withheld answer, or a simplification of it, is not stated.**

---

## OQ-4 — Two variants of the strong/strong scenario are promised and never delivered · **MEDIUM**

**V40:** *"the two remaining variants of the strong-strong scenario are deferred to future episodes."*
V39 covers "support WTB first, then strong"; V40 covers "resistance WTT first, then strong".
**The other two — presumably "support WTT first" and "resistance WTB first" — never appear in this
corpus.** They may be in the missing files (34, 70, 95, 127–129) or in videos outside the 133.

---

## OQ-5 — Average into a loser, or book the loss? · **HIGH** *(largely resolved)*

**V30** contains both instructions and does not reconcile them: average at the extra divergence, and
*"never hold a stuck bought option position in the hope it recovers — if you cannot exit cleanly,
book the loss."*

**V116 resolves it and should be treated as the governing statement:**
> Averaging is valid **only when the situation you entered on is still the situation on screen**.
> If the pressure has turned against you, adding is not averaging — it is a second position against
> yourself on top of one already trapped.

Remaining constraints that narrow it further: average only at the **next full value** (V11); **not at
all** if the S/R picture changed (V11); **not at all** if you trade a single lot (V30); **not at all**
if you cannot fund it (V48, V51, V61); and **never** once the AI says exit (V58).

**Still flagged because the corpus advises averaging in ~17 files without the V116 qualifier attached.**

---

## OQ-6 — Can support or resistance sit in the money? · **HIGH**

| File | Statement |
|---|---|
| **V06** | *"Can an in-the-money strike be the resistance? **Yes.** The rule is only ever 'whichever you meet first'."* |
| **V08** | A case where the biggest volume at 1,600 was **ITM and was therefore NOT counted** as the support — 1,500 was used instead. |
| **V111** | *"Support therefore can **never sit more than ONE strike in the money**."* |
| **V112** | *"A highlighted strike that is **deep in the money carries no meaning**."* |
| **V79** | For the hedge: if the 100% OI strike is **deep ITM, skip it** and use the next-ranked strike. |

**Best reading:** V111's "no more than one strike ITM" is the operative constraint, with V06's "yes"
covering exactly that one-strike case. **But V08's 1,600 example is not obviously one strike ITM**,
so this needs confirming against the videos.

---

## OQ-7 — The "only two strikes between the level and the line" case · **MEDIUM**

**V05** shows a case where only two strikes exist between the level and the imaginary line and
**explicitly sets it aside for a later episode.** No file in this corpus resolves it.
Relevant because it interacts with the diversion count (V11) and with the "support cannot be more
than one strike ITM" constraint (V111).

---

## OQ-8 — COA 2.0 scenarios 6 and 7 · **MEDIUM**

**V31** flags these as the most garbled part of that transcript: *"their direction calls are clear but
the exact line behaviour should be confirmed against the video."*
As transcribed: 6 = call OI falling sharply, put flat → strong bullish; 7 = put OI falling steeply,
call flat → price falls. **The symmetry with 3 and 4 is not obviously right and should be checked.**

---

## OQ-9 — Deep ITM or near ATM? · **HIGH**

| File | Recommendation |
|---|---|
| **V19** | **Second (sometimes third) strike in from the line, on the ITM side** — chosen on the best profit-to-loss gap |
| **V107** | **For intraday INDEX trading, choose DEEP in-the-money** (a deep ITM call captured ~36 of a 50-point move vs ~15 for far OTM). **In STOCKS, stay AT the money** |
| **V116** | *"Choose strikes near the money rather than deep in the money"* — the 25,200 put was *"far too deep in the money"*, and deep-ITM **magnifies the loss as much as the gain** |
| **V72** | A **zero-time-value** (deep ITM) strike **does not behave like futures over a round trip** — time value is added on the way out and taken back on the way home |

**A reconcilable reading exists** — deep ITM for a fast directional index scalp where you want maximum
points per move and will exit quickly; near ATM when you may have to sit in the position — **but the
corpus never states it.** This must be decided explicitly.

---

## OQ-10 — The zero-LTP filter: how many zeros are allowed? · **MEDIUM**

- **V12:** *"If **any** of those values reads zero, skip the trade."*
- **V35:** *"**One zero is tolerable**, more than one or two makes the trade dangerous. A price
  displayed as 37.1 is **not** a zero — only a zero value counts."*

V35 is the later and more detailed statement and probably supersedes V12, but it is not framed as a
correction. Also unstated: **how far down the ITM column to look.**

---

## OQ-11 — 121, 8,000 or 13,000 combinations? · **LOW**

- **V08:** nine scenarios, then 121, "and more beyond that"
- **V13:** nine expanding to 121
- **V38:** nine base → 121 detailed → **over 8,000 combinations**
- **V110, V112:** **~13,000 combinations**

**V112 gives the mechanism:** each pressure state can be reached **three** ways (direct weak-towards,
a shift, or a weak-towards that turned strong). Cosmetic — the operative model is always the nine.

---

## OQ-12 — The extra structural constraint on WTB · **MEDIUM**

**V39 only:** *"a resistance is weak towards bottom **only if it sits below the smaller strike of the
imaginary-line pair**."* He checks the candle chart to confirm the market never traded below that
strike, **and on that basis grades the resistance STRONG rather than WTB.**

**This constraint appears in no other file.** If real, it is an additional gate on the WTB
classification and would change outputs. If it is a one-off simplification, treating it as a rule
would suppress valid WTB readings.

---

## OQ-13 — Is the State of Confusion two-stage or three-stage? · **MEDIUM**

- **V27** gives **two** confirmation forms (1 hour flat, or shift-completes-but-not-strong + 1 more hour).
- **V45** refers to *"**stage two** of the state of confusion"*, identified by one side's percentage
  **varying between 75 and 99** while the other stays strong, predicting an SOC within ~2 hours.
- **V112** grades by duration (**1R / 2R / 3R**) which is a third, different axis.

**Whether "stage two" is the same thing as V27's second form, or a separate earlier warning, is not
stated.**

---

## OQ-14 — Is "both sides WTB" scenario 6 or scenario 9? · **HIGH**

- **V13:** scenario **6** = both WTB ("heavy downward pressure, Puts only"); scenario **9** = "the two
  levels move against each other".
- **V37:** the blood bath is **"scenario six of the Chart of Accuracy: BOTH resistance and support
  weak towards bottom. Not scenarios one through five. Only six."**
- **V47:** *"resistance formed at 24700 with a weak-towards-bottom reading, and support formed at
  24600 also weak towards bottom. **Both sides weak towards bottom at the open is what the speaker
  calls the number nine scenario.**"*

**V13 and V37 agree; V47 does not.** Likely an ASR or speaker slip, but scenario 9 has a *different
trade rule* (both sides risky, all eight lines minus the Moderates — V100), so getting it wrong
changes the output.

---

## OQ-15 — The 9:20 target rule · **MEDIUM** *(probably resolved)*

**V49 deliberately withholds it and turns it into a comment contest.** The candidates elsewhere:

| File | Target rule |
|---|---|
| V48 | **The next line in the direction of the trade** |
| V51 | Take the line's value → find the nearest matching reversal price **on the OPPOSITE side** of the chain → the first reversal price visible on its other side |
| V52 | **The reversal price directly opposite on the option chain** |
| **V61** | **The reversal price NEAREST to the current market price** |
| V117 | **~50 points in the spot, OR the first reversal price visible on the opposite side** |

These are probably all the same idea worded differently, but **V48's "next line" and V61's "nearest
reversal price" are not the same number.** Needs one canonical statement.

---

## OQ-16 — The 65/95/99 hit rates · **MEDIUM**

Quoted in V50, V74, V83, V88, V89, V101 and V118 as **standard-deviation facts** (V50 says 66/95/99;
the rest say 65/95/99). **V74 says the rule is "standard mathematics, not his invention."**

**But no file shows a back-test of the actual hit rate of these particular lines.** The σ-percentages
are properties of a normal distribution, not of a level drawn from option Greeks. **Treat the numbers
as band labels, not as measured accuracy**, unless the user has data.

---

## OQ-17 — The ±375 weekly projection · **MEDIUM**

**V50** uses a fixed **375** points, added to and subtracted from the expected Thursday close, to get
next week's support and resistance. Said to be derived from Option Greeks; **the derivation is not
repeated, and the file explicitly notes it never says how often 375 is recalculated or how it scales.**

**V118's straddle method is the better-specified alternative** — ATM call LTP + ATM put LTP, discounted
by time of day — and produces a comparable number from live data. **Prefer V118 unless the user knows
what 375 is.**

---

## OQ-18 — The morning analysis window: 5 or 6 minutes? · **LOW**

- V51: *"the tool's analysis runs for **six minutes** in the morning"*
- V52: *"analysing the market between **9:15 and 9:21**"*
- V99: *"during the **first five minutes** of trading"*
- V80: *"between **9:15 and 9:25**"* (stocks)
- V61: *"the AI needs **five minutes** after the open"* (stocks)

Index lines at **9:21**; stock lines at **9:25**. The "5 vs 6 minutes" difference is immaterial; the
**output timestamps** are consistent and are what matter.

---

## OQ-19 — Two "10 points" rules with opposite sign conventions · **MEDIUM**

- **V48/V49/V61:** for an upside line, take the next **larger** value on the resistance side and
  **ADD 10**; for a downside line, take the next **smaller** value on the support side and **SUBTRACT 10**.
  *(i.e. the stop sits 10 points BEYOND the next reversal — wider.)*
- **V52:** *"the extension of a reversal price is 10 points **beyond** the outer reversal price; the
  stop loss sits 10 points **inside** the nearest one."*
  *(i.e. the stop sits 10 points INSIDE — tighter.)*

These describe different placements. **V48/V49 are worked step by step with numbers (643 → 657 → 708
→ +10 → 718) and should be preferred**, but V52 needs re-checking against its video.

---

## OQ-20 — Are the "Live" lines static or moving? · **HIGH**

- **V47:** *"the lines are NOT fixed. When resistance shifted down the extension moved down with it;
  when price went back up, the extension moved back."*
- **V51:** *"**live lines**, which move with the market, and 9:20 lines, which are fixed for the day."*
- **V58:** *"**Live LTP draws STATIC lines** at whatever the current extension of resistance,
  resistance +1, extension of support and support −1 are."*
- **V61, V80, V106:** the stock **Live** lines (C1/C2/P1/P2) are **generated at 9:25 and static for
  the day.**

**Most likely resolution:** *index* Live lines move; *stock* Live lines are static once published at
9:25; V58's "static" is loose phrasing meaning "drawn as fixed horizontal lines at this instant".
**Needs confirming — it changes whether we recompute or freeze.**

---

## OQ-21 — How many AI lines: 6 or 8? · **MEDIUM**

- **V54, V100:** **up to eight** (four per side), *"anywhere from two to eight can be drawn."*
- **V60:** *"the 920 setting draws up to four lines; **AI LTP draws a minimum of three and up to six**."*
- **V110:** works with **six** (R Moderate, R Risky, R Max Gain, S Risky, S Moderate, S Max Pain).
- **V73** calls them *"the four and six magical lines."*

**Possible resolution:** the *Max Gain* lines only appear once price reaches the entry (V110), so on a
given screen you may see six of eight. **But V60's "up to six" as a hard maximum contradicts V100's
explicit eight-line table.**

---

## OQ-22 — Missing line: prohibition, forecast, or both? · **MEDIUM**

- **Prohibition** (V99, V107, V117, V80): no upper line → **do not buy puts**; no lower line →
  **do not buy calls**.
- **Forecast** (V61): only the lower two drawn → **expect a good bullish move**; only the upper two →
  **expect a bearish one**.

These are logically compatible (a missing upper line = no fixed upside destination = bullish, so
buying puts is wrong). **What is not stated is whether the forecast is meant to be traded as a
positive signal, or only used as a veto.**

---

## OQ-23 — The unnamed mistake in V71 · **LOW**

The teacher tells the student she made **one mistake across her five picks** and refuses to say what
it was, inviting viewers to find it. He also notes ~90% of the live chat picked Reliance, implying the
crowd's choice was wrong. **The video ends without the answer.**

Best guess from the stated rules: **Reliance's first-candle low of 1,472 was below the 1,473.5 stop**,
and although the teacher ruled the entry was never touched, this is the only anomaly in the five.
**Unconfirmed.**

---

## OQ-24 — Is the free tier live or delayed? · **LOW**

**V73** is internally inconsistent: the opening describes the free tier as **delayed data**, while the
demonstration insists the charts are **live and tick-by-tick** (matched against TradingView on screen).
A few volume figures differ slightly between the two sites (≈27.35 vs 27.46 lakh), **which is
consistent with a delay.** V75, V80 and V88 say **5-minute delayed**. Commercial detail, not logic.

---

## OQ-25 — When is the weekly range generated? · **MEDIUM**

- **V74:** *"New lines are generated on **Thursday** evening after the close, around **4:00 pm**"*
- **V88:** *"calculated once, at **4:00 pm** on the previous **TUESDAY** expiry"*
- **V123:** *"calculated once a week, on **Tuesday at 5:30 PM**"*

**Almost certainly all correct for their respective dates** — NSE moved the Nifty weekly expiry from
Thursday to Tuesday during the period these were recorded. **The generation time (4:00 vs 5:30 PM)
is still unresolved**, and the rule should be stated as *"after the settle on expiry day"* rather
than tied to a weekday.

---

## OQ-26 — Is the imaginary line a spot-bracket or a time-value anchor? · **HIGH**

- **V01, V02, V42, V98:** the line sits between the two strikes that bracket **spot**.
- **V75:** *"**the imaginary line itself is drawn using the highest time value**, between those two
  strikes."*

Usually the same answer. **They diverge when the highest-time-value strike is not the nearest strike
to spot** — which V18 says can happen, since ATM is defined by time value, not proximity.
**This changes the pair, which changes where the S/R scan starts, which changes everything.**

---

## OQ-27 — Hedge sizing: 5–7% of the move, 20%, or 1% of the price? · **HIGH**

- **V79, V91:** buy a protective option whose premium is **5–7% of the expected move**
  (Call HOI reversal − Put HOI reversal).
- **V79's own worked example contradicts it:** REC, CMP ≈₹350, target ₹400 (a ₹50 move), **buy the
  350 put for ₹10** — that is **20%**, not 5–7%. The source file flags the discrepancy explicitly.
- **V106 uses a different denominator entirely:** *"look for a stock where the **at-the-money premium
  is around 1% of the PRICE**. Then the worst case on the whole structure is 1%."*
  (₹8 on SBI at ₹905 ≈ 0.9% — internally consistent.)

**V106's 1%-of-price is the only rule whose worked example matches it.** The 5–7%-of-move rule may be
a garbled statement of something else.

---

## OQ-28 — Do Max Gain and Max Pain repeat across all four stock lines? · **MEDIUM**

**V80 states:** *"Only Max Gain and Max Pain repeat across all four lines. The entry value is what
changes."*
**V80's own Asian Paints example contradicts this:** C1 stop 2,521.50 / target 2,543.50 vs C2 stop
2,501.40 / target 2,523.40 vs P1 2,565.30 / 2,543.30 vs P2 2,584.80 / 2,562.80 — **all four different.**
V61's Apollo example is likewise per-line (P2 6942/6972/6917; P1 6893/6923/6868).
**The worked numbers should be believed over the summary sentence**, but the sentence may mean
something subtler (e.g. the *labels* repeat, or C1 and P1 share a pair) that was lost in transcription.

---

## OQ-29 — Pricing is quoted inconsistently across the corpus · **LOW**

₹1,416 / ₹708 per month (V00) · a ₹5,899 one-time community fee for a lifetime 50% discount
(V14, V17, V18, V23, V24) · ₹1,179/month for a class archive (V32) · ₹1,770/month (V74, V75) ·
₹170 (V75) · ₹600 + GST (V81) · ₹78/month NSE and ₹99/week crypto (V88).
**Commercial, not logical. Recorded only so nobody quotes a number from here.**

---

## OQ-30 — The LTP Swing stop-loss condition is stated loosely · **MEDIUM**

**V91's own caveat:** *"the exact stop-loss condition is stated loosely in places and is symmetrical
in intent rather than precisely worded, so **read it off the published flowchart** rather than from
the spoken version."*
As transcribed: long → exit when the **put-side 100% OI turns WTB**; short → exit when the
**call-side 100% OI turns weak** (V91 says "turns weak"; V79 says "turns WTT").
**The published flowchart is the authority and we do not have it.**

---

## OQ-31 — LTP Swing bearish: "breakout" or "breakdown"? · **MEDIUM**

- **V79:** *"The **Call OI reversal** must be a **breakout** or equal to CMP."*
- **V91:** *"The **Call High-OI Reversal** must be in **breakdown** or close to the CMP."*

**Symmetry argues for V79** — the bullish branch requires the *put* reversal to be in **breakdown**,
so the bearish branch should require the *call* reversal to be in **breakout**.
**But the two files literally disagree.**

---

## OQ-32 — Gift Nifty: use it or ignore it? · **LOW**

- **V103:** Gift Nifty's overnight direction **hints at how the Indian market opens** — a worked
  example is given.
- **V121:** he **deliberately ignores** overnight news, **Gift Nifty** and US markets, because acting
  on stale news creates recency bias.
- **V123:** he *does* cite Gift Nifty pointing to a large gap down.

Probably a teaching-vs-practice split (useful context for a beginner; excluded from his own decision
process to stay neutral). **Not resolved in text.**

---

## OQ-33 — The safe/risky mapping contradicts the backtest · **HIGH**

**The published mapping (V48, V51, V52, V61):** the **OUTER** lines (EOR+1, EOS−1) are the **SAFE**
trades because the stop is close; the **INNER** lines (EOR, EOS) are **RISKY**.

**V117's three-month backtest says the opposite about outcomes:**

| Line | Midcap Nifty win rate | Nifty win rate |
|---|---|---|
| **EOS (inner)** | **81%** | 60% |
| **EOR (inner)** | 66% | **70%** |
| **EOS−1 (outer)** | **41%** | **33%** |
| **EOR+1 (outer)** | **40%** | **20%** |

**And V117's own instruction:** *"Take the trade at the extension lines rather than the +1 and −1
lines, which have the weakest hit rates."*

**These can be reconciled** — "safe" refers to *stop size*, not *hit rate*, and a tight stop is hit
more often. **But the practical instruction flips**, and V117 also shows a 60%-win-rate line losing
182 points overall. **This must be decided explicitly, not inherited.**

---

## OQ-34 — Exit discipline contradicts itself · **MEDIUM**

- **V100:** *"Exit at your stated value. **Do not book 5 or 10 points early** because the target
  looks close."*
- **V44:** *"do not exit early on a 10-point adverse move… **do not cut the stop until price has
  actually travelled to the third line**."*
- **V119 (the speaker's own practice):** *"If a trade does not work **within 15–20 minutes**, he
  closes it regardless of whether it is at a small profit or a small loss… he is **not good at
  holding**… his job is to **stop the loss, not to capture the target**."* He describes taking a
  **three-point profit** and defends it.
- **V119 also:** *"**he does not trade diversions at all**"* — while **V108** teaches divergence
  scalping as a method.

**The published rules and the author's own behaviour differ.** Worth knowing before we encode
"discipline" as a feature.

---

## OQ-35 — The arrow / orientation convention is stated two opposite ways · **HIGH**

- **V121:** *"an **UPWARD arrow means BEARISH**, a downward arrow means bullish. The reason given is
  that as the market rises, the imaginary level shifts to a higher strike, which moves it **downward
  on the option chain display**."*
- **V112:** *"An **arrow running from a smaller strike to a larger one is BULLISH**; the reverse is
  bearish."*
- **V13:** on the COA screen, **support is drawn ABOVE and resistance BELOW**, and **an upward-facing
  ARC means WEAK TOWARDS BOTTOM.**
- **V45:** because strikes print smallest-at-top, **a falling market appears to move the line UPWARD.**

**Almost certainly one fact stated against different display orientations** (strike-ascending vs
strike-descending; price-chart vs chain). **But we cannot draw a single arrow until this is pinned
down**, and getting it backwards inverts every directional read on screen.

---

## OQ-36 — Which expiry's chain do the levels come from? · **MEDIUM**

**V17** is explicit about one case: *"the levels must still be read from the **current** expiry's
chain — only the OC tab is switched to the far expiry to get its premium."*
**V118** requires the **next** expiry's chain for the straddle projection.
**V32** says expiry-day OI is unreliable and should be discounted.

**Unstated: on expiry day itself, which chain do the intraday levels come from — the one settling, or
the next one?** This matters for a whole trading day each week.

---

## OQ-37 — What exactly is a "shift completing" for the percentage inversion? · **HIGH**

**V109's inversion rule** (*"once a level completes its shift and settles at the new strike, the same
rising percentage that was bullish becomes bearish"*) depends entirely on a boolean:
*has this shift completed?*

The corpus gives **three different completion tests**:
- **V21, V23:** the **volume gap between the two strikes closes to near zero**.
- **V24:** the **60-minute clock** expires.
- **V29:** a shift completed is **not** the same as a level turned strong — and *"only ONE of the two
  needs to firm up for the level to count as strong."*

**Which one flips the percentage's meaning is not stated.** This is the most likely place for a
subtle, hard-to-debug implementation error.

---

## OQ-38 — Source-material integrity · **HIGH (process, not logic)**

Every one of the 127 files carries the same footer: the source is **Hindi ASR**, and it **routinely
drops the leading digits of index levels** (22,700 → "700"). Individual files flag specific damage:
V13 ("Chart of Energy 1.0"), V38 ("the exact line values sit in the most garbled stretch"),
V121 ("22,700 appears as 27,000 and 700 throughout"), V125/V126 ("Sensex rendered as Sussex"),
V124 ("EMA rendered as EMI"), V56 (a SEBI figure inverted).

**Consequence for the build: never take a numeric constant from these files.** The structural rules
are repeated across many files and are reliable; the digits are not. **The only constants that appear
consistently enough to trust are the 75% threshold, the 9:21 / 9:25 / 11:30 / 2:30 timestamps, the
1σ/2σ/3σ band structure, and PV = half the strike gap.**

---

## Summary — what has to be answered before anything is built

| Severity | Items |
|---|---|
| **BLOCKER** | **OQ-1** (the reversal-price formula) |
| **HIGH** | OQ-2, OQ-3, OQ-6, OQ-9, OQ-14, OQ-20, OQ-26, OQ-27, OQ-33, OQ-35, OQ-37, OQ-38 |
| **MEDIUM** | OQ-4, OQ-5, OQ-7, OQ-8, OQ-10, OQ-12, OQ-13, OQ-15, OQ-16, OQ-17, OQ-19, OQ-21, OQ-22, OQ-25, OQ-28, OQ-30, OQ-31, OQ-34, OQ-36 |
| **LOW** | OQ-11, OQ-18, OQ-23, OQ-24, OQ-29, OQ-32 |

**Four of these can only be answered by the user or by watching the videos:**
OQ-1 (the formula), OQ-30 (the published LTP Swing flowchart), OQ-35 (the on-screen arrow
orientation), and OQ-3 (the withheld SOC target).
