# The LTP Calculator, reconstructed

**Written for: a developer who has not watched the 133 videos.**
Everything here is traced to the transcripts. Where the transcripts disagree or go silent, that is
said in place rather than papered over, and the item is cross-referenced to `07-OPEN-QUESTIONS.md`.

---

## 0. What the thing actually is

Strip away the branding and the LTP Calculator is **one primitive plus nine layers built on top of it.**

> **The primitive:** for every strike price, on each side, compute a single number called the
> **reversal price** — the spot level at which the market is expected to turn around at that strike.
>
> **Everything else** — support, resistance, extensions, divergences, the 9:20 lines, the AI lines,
> Max Pain, Max Gain, the weekly range, the stock screeners — is either a *selection* of which
> strike's reversal price to show, or a *classification* of the option chain that decides which of
> those levels you are permitted to trade today.

The product's own framing (V130, V131) is a three-step funnel, and the UI buttons are deliberately
laid out in that order:

| Button | Question it answers | Horizon |
|---|---|---|
| **W** | Where will the market move **this week**? | Weekly / monthly range |
| **920** | Where will it move **today**? | Four static lines fixed at 9:21 |
| **AILTP** | Where exactly do I **enter**? | Live state + entry/stop/target lines |

Read in that order, always. The stated failure mode is jumping straight to AILTP (V131).

---

## 1. Inputs — what data the system needs

### 1.1 The three raw exchange fields (V51, stated explicitly)

> "The option chain has only three pieces of raw exchange data: **LTP**, **volume** and
> **open interest**. Everything else — change in LTP, change in OI, implied volatility, the Greeks —
> is calculated from those."

Per strike, per side (call and put):

| Field | Source | Behaviour |
|---|---|---|
| **LTP** | Exchange | Last traded price of that option. Changes only when a trade executes (V93). |
| **Volume** | Exchange | Cumulative trades today. **Monotonically increasing. Resets to zero at 9:15 every day.** (V05, V43, V93, V107) |
| **Open Interest** | Exchange | Open written positions. **Can rise AND fall intraday. Carries forward overnight.** (V43, V107) |

Plus, per instrument:

| Field | Notes |
|---|---|
| **Spot price** | **All S/R definitions are built on SPOT, never futures** (V17, V42). |
| **Futures price** | Needed for the spot–futures gap, which is treated as the source of volatility (V58, V88, V107). |
| **Strike ladder + gap** | Exchange-set. Nifty 50, Bank Nifty 100, stocks vary (V42). |
| **Lot size** | Exchange-set, per script (V42). Nifty quoted as 75 in later files, 50 in earlier ones. |
| **Expiry dates** | Current and next expiry chains are both needed (V17, V118). |

### 1.2 Derived per-strike fields

| Field | Used for |
|---|---|
| **Implied volatility** (call side and put side separately) | The IV gate (V21, V104, V107) and the range calculation (V83). |
| **Delta, Gamma, Theta, Vega, Rho** | Inputs to the reversal price (V111, V124). |
| **Intrinsic value** | `max(0, spot − strike)` for calls, `max(0, strike − spot)` for puts. **Never negative** (V99). |
| **Time value** | `premium − intrinsic value`. Drives the ATM definition (V18, V75) and the expiry-day boundary (V118). |
| **Change in OI** | Can be negative (V43). Feeds COA 2.0 (V31). |
| **Change in LTP** | Used for gap detection at the open (V16) and as a (rejected) expiry predictor (V119). |

### 1.3 Data-cadence facts that constrain the design

| Fact | Source |
|---|---|
| Live data refreshes **~every 3 seconds**; the reversal values shift by **5–7 points, rarely more**, because live is a **1-minute snapshot** | V10, V22 |
| Historical replay steps in **2-minute** intervals — so some shifts visible live are invisible in replay | V10, V22 |
| The "Compare" screen version runs on **~1.2 s delayed** data | V45 |
| Free tier is **5-minute delayed**; historical tick data is free | V75, V80, V88 |
| **At 9:15 there is no usable data.** Volume builds from zero. At 9:19 the levels may not exist at all; they appeared from ~9:50 on one day | V30, V58 |
| **The lines visible AT the open are the PREVIOUS DAY's** | V58 |

---

## 2. The derivation pipeline

Computed in this order. Each layer depends only on the ones above it.

```
L0  raw chain (LTP, volume, OI) + spot + futures + strike ladder
      │
L1  imaginary line  →  pair of strikes  →  ATM strike (by highest time value)
      │
L2  locate SUPPORT (put side) and RESISTANCE (call side)
      │
L3  classify each level:  built-on (volume / OI / both)
                          challenger + percentage
                          label: Strong / WTT / WTB
      │
L4  derive PRESSURE per side (5 states → bullish / bearish / neutral)
      │                       ← requires INTRADAY HISTORY, not a snapshot
L5  combine the two pressures → SCENARIO (COA 1.0, 9 scenarios) + SOC detection
      │
L6  reversal price per strike per side  ← the unknown primitive
      │      → extensions, divergences, EOR±n / EOS±n
      │
L7  build the LINE SET for the active mode (Live / 920 / AI LTP / stock C-P)
      │
L8  apply SCENARIO to decide which lines are drawn at all
      │
L9  apply FILTERS and VETOES → tradable or not
      │
L10 entry / stop / target, then management rules
```

---

## 3. Layer 1 — the imaginary line, the pair, and ATM

### 3.1 The imaginary line

A red horizontal line drawn **between the two adjacent strikes that bracket the current spot price**
(V01). It **moves during the day**, re-seating whenever spot crosses out of its current strike band
(V02).

```
market 19,553  →  line between 19,550 and 19,600
market 19,753  →  line between 19,750 and 19,800
market 19,353  →  line between 19,350 and 19,400
```

The two strikes are **"the pair of strike prices on the imaginary line"** — the starting point for
everything downstream.

**Refinement (V75):** the line is actually drawn **using the highest time value**, between those two
strikes. This may or may not be the same as the arithmetic midpoint. → **OQ-26.**

**Degenerate case (V08, named explicitly):** when **spot sits exactly ON a strike**, the tool stops
calculating and the highlights vanish. Tata Power at exactly 257.5 produced no output; at 257.25 it
worked again. **This must be handled deliberately.**

### 3.2 Orientation vocabulary — and the display trap

| Term | Meaning |
|---|---|
| **Top** of the chain | The **highest** strike price |
| **Bottom** of the chain | The **lowest** strike price |
| **Movement towards top** | Market **rising** |
| **Movement towards bottom** | Market **falling** |

**Trap 1 (V02):** "movement towards top" ≠ "weak towards top". Different concepts.

**Trap 2 (V45):** because strikes are printed **smallest at the top**, a **falling market appears to
move the line UPWARD on screen**.

**Trap 3 (V13):** on the COA screen, **support is drawn ABOVE and resistance BELOW** — inverted
relative to a price chart. And **an upward-facing arc means WEAK TOWARDS BOTTOM.**

**Trap 4 (V121 vs V112):** the two files give **opposite arrow conventions**. V121: "upward arrow
means bearish." V112: "an arrow running from a smaller strike to a larger one is bullish."
Almost certainly the same fact stated against different display orientations, but **this must be
pinned down before we draw anything.** → **OQ-35.**

### 3.3 The ATM strike — non-standard definition

> **ATM = the strike carrying the HIGHEST TIME VALUE.** Not the strike nearest spot. (V18, V75)

It is always one of the two strikes at the imaginary line, and **the same strike carries the highest
time value on both the call and put side**. There can only ever be one.

Why it matters: **ATM has the most time value to lose**, so an ATM option taken into profit and not
booked can return to your exact entry spot and still show a loss (V18).

---

## 4. Layer 2 — locating support and resistance

This is the most-repeated rule in the corpus (V05, V06, V43, V75, V98, V111).

### 4.1 Resistance (call side)

```
1. Take the PAIR at the imaginary line.
2. Start at the SMALLER of the two strikes.
3. Scan OUTWARD (upward / towards OTM) on the CALL side.
4. Find the strike with the highest VOLUME, and the strike with the highest OI
   (each marked 100% by the tool).
5. If they are at different strikes → the one CLOSER TO THE IMAGINARY LINE is the resistance.
   If they are at the same strike → that strike is resistance of BOTH volume and OI.
```

### 4.2 Support (put side) — exact mirror

```
1. Take the PAIR at the imaginary line.
2. Start at the BIGGER of the two strikes.
3. Scan OUTWARD (downward / towards OTM) on the PUT side.
4. Same tie-break: whichever of highest volume / highest OI is CLOSER to the line.
```

### 4.3 Why the directions are what they are (V04, V06)

The call side's pressure is **downward** (call premiums are extinguished by a falling market) and the
put side's is **upward**. The call side has "already pushed the line up to that point", so searching
*behind* the smaller strike is pointless — only strikes still **ahead** can stop the move.

### 4.4 Constraints, exceptions and traps

| Rule | Source |
|---|---|
| **An in-the-money strike CAN be the level.** The rule is only ever "whichever you meet first". | V06 |
| **But: "support can never sit more than ONE STRIKE in the money."** | V111 |
| A case where the biggest volume at 1,600 was ITM and was therefore **not** counted as support (1,500 used instead) | V08 |
| **A highlighted/percentage strike is NOT automatically the level.** BSE's highlighted 83% figure was not the real level; Divi's used 6,800 rather than the 92% strike at 7,000. **The scan-direction rule wins.** | V111, V112 |
| **A highlighted strike that is deep ITM carries no meaning.** Only levels found by scanning outward count. | V112 |
| **Persistence:** "support formed at 9:15 stays valid for the day EVEN AFTER price trades below it, provided the largest OI at that strike has not unwound." Bank Nifty's 58,000 support held its status all session while price fell through it. | V111 |
| **The tool prints support and resistance at the top of the screen** — always cross-check your manual read against it. | V43, V98, V111, V112, V114 |

→ **OQ-6** covers the ITM tension between V06, V08 and V111.

### 4.5 Which factor to trust

| Context | Use |
|---|---|
| **Intraday** | **Volume** is primary. "OI is what writers are ASKING for; volume is what intraday traders are actually EXECUTING. A level only becomes real when the execution agrees with the writing." (V105) In the live example he trades the **volume** levels while the highest OI sat far away. |
| **Positional (10–15 day)** | **Open Interest only. Volume is an intraday measure.** (V26, V79, V91) |

**Reliability ranking (V05):** volume+OI at the same strike > volume only > OI only.
Reason: **volume never falls during a session** (a trade cannot be undone); **OI can fall** because
writers buy back. That is also why a chain has a *change in OI* column and never a *change in volume*
column.

⚠ **V43 contains an on-screen disagreement between the two hosts** — one says volume-only is *weak*,
the other says the source column does not matter. Neither is demonstrated. **This contradicts V05's
ranking.** → **OQ-2.**

---

## 5. Layer 3 — grading the level

### 5.1 The challenger and the percentage

- The **level** is the strike with the **highest** volume (or OI) — marked **100%**.
- The **challenger** is the **second-highest** on that side.
- **The percentage = second-highest ÷ highest × 100.**
  Direct numeric evidence (V23): *1 crore 35 lakh vs 1 crore 11 lakh → reading 82.*
  (1.11 / 1.35 = 82.2%.)

### 5.2 The 75% threshold — the single most important constant

| Statement | Source |
|---|---|
| "The tool flags caution once OI or volume reaches **75% or more** of the highest value on that side." | V75 |
| A **57%** call-side volume was **not** highlighted; a **75.85%** put-side volume **was**; an **83%** OI **was**. | V75 |
| "The yellow highlight appears when the reading crosses **75%**." The second reading "only matters if it is above 75%; here it was 50–51%, so it was ignored." | V65 |
| Live: the figure dropped **from 75% to 74.99%** and the bearish-pressure warning **disappeared immediately**. | V75 |
| "A label like weak-towards-top only appears once the competing strike reaches about **75%** of the leading one. Readings of 53%, 63% or 64% mean no real contest." | V110 |
| "Find any neighbouring strike holding **75% or more**. No neighbour reaches 75% → the level is STRONG." | V112 |
| A single percentage crossing **75%** is what flips the whole market state. | V59 |
| The SOC ends when the opposite side's percentage reaches **75**. | V47 |

**Treat 75% as the system constant.**

### 5.3 The three grades (V07)

| Grade | Condition |
|---|---|
| **Strong** | No challenger ≥ 75% |
| **WTT** (weak towards top) | The qualifying challenger sits at a **HIGHER** strike than the level |
| **WTB** (weak towards bottom) | The qualifying challenger sits at a **LOWER** strike than the level |

**Purely positional. Identical on both sides.**
**Yellow has five shades** — darker = pressing harder (V07). **Fading yellow = pressure releasing**
(V33, V26).
**If several strikes are ≥75%, the strongest qualifying one is YELLOW and the others are BOLD.
Read the yellow one** (V112).

### 5.4 Single-factor vs double-factor levels

**Single factor** = built on volume alone, or OI alone.
> **Whatever that one factor is doing, the level is doing.** (V114)

**Double factor** = volume AND OI at the same strike. The rules are **deliberately asymmetric**:

| Level | Turns WTB when | Turns WTT when |
|---|---|---|
| **Resistance** | **EITHER** factor moves that way | **BOTH** factors do |
| **Support** | **BOTH** factors do | **EITHER** factor moves that way |

(V114.) This is the formal version of **V08's** rule, which states the same thing directionally:

> *If **either** the volume or the OI challenger is coming **TOWARDS the imaginary line**, the level
> is weak, and you follow that one. For the level to count as strong, **BOTH** must be clean or both
> moving away.*

i.e. **the inward direction needs only one factor; the outward direction needs both.**
Worked (V08): Nifty support 19,500 on both; OI challenger moving away, volume challenger moving
towards the line → believe the volume → graded **WTT**.

**The double cross (V28):** when the volume moves one way and the OI drifts the other,
**the market follows the VOLUME.**

---

## 6. Layer 4 — PRESSURE (the five states)

**This is the heart of the system and the part most often got wrong.** V108 states it as a table:

| State | What happened | **Pressure** |
|---|---|---|
| **Stable Strong** | Opened at a strike and stayed there all session | **Neutral** |
| **WTT → Strong** | Tried to move to a **higher** strike, **abandoned** it, returned | **BEARISH** |
| **WTB → Strong** | Tried to move to a **lower** strike, **abandoned** it, returned | **BULLISH** |
| **Shifted Bottom → Top** | **Completed** the move to a higher strike and became strong there | **BULLISH** |
| **Shifted Top → Bottom** | **Completed** the move to a lower strike and became strong there | **BEARISH** |

> **The rule behind it: a level that ATTEMPTS a move and GIVES IT UP produces pressure in the
> OPPOSITE direction. A level that COMPLETES the move produces pressure IN the direction it went.**

### 6.1 Why the label alone is not enough

V75 warns that the WTT-is-bullish / WTB-is-bearish shortcut **often reverses**, and V112 gives the
mechanism:

> **WTT does not automatically mean bullish. If the level has ALREADY SHIFTED DOWN from a higher
> strike, a WTT reading is actually BEARISH pressure.** And the reverse.

**This is why the tool uses ARROWS rather than the WTT/WTB labels** (V112, stated as being explained
publicly for the first time): the same label can mean opposite things, so **the arrow records the
NET PRESSURE**.

> **Architectural consequence: store the PRESSURE (the arrow). Derive the label for display.
> Never the other way round.**

And correspondingly:

> **Pressure cannot be computed from a snapshot. It needs the level's intraday history.**
> Hence V25's diagnostic: a latecomer at 9:30 sees "both strong" and calls it scenario 1; it is
> actually **scenario 5 with the support already shifted up**. Same screen, different day.

The tool exposes this history in two ways: the **transition line** printed under the level
("WTB to Strong", "shifted from bottom to top" — V75, V112) and the **duration display**
("resistance WTT for 113 minutes" — V16), which is itself an instruction to rewind that many minutes
in historical data and see what changed.

### 6.2 Shifting is a PROCESS, not an event

| Rule | Source |
|---|---|
| **Shifting is complete only when the VOLUME DIFFERENCE between the old and new strike closes to NEAR ZERO.** Tracked: 8 lakh → 6 lakh → 5 lakh → 1 lakh → 10,000 = done. | V21 |
| Same, tick by tick: 96,000 → 70,000 → 40,000 → 7,000 → shift complete. | V23 |
| A shift in progress is visible as **two strikes with almost equal volume** (~101,000 each). | V16 |
| **WTT ≠ shifting.** WTT is weakness; shifting is the highest volume actually moving. | V15 |
| **Three strikes developing volume together** is the early warning of an unresolved side. | V27, V28 |
| **A shift COMPLETED is not the same as a level TURNED STRONG.** The clock restarts. | V29 |
| **The side that finishes its shift FIRST gets priority.** | V29 |
| **Only ONE of percentage or volume needs to firm up for the level to count as strong.** | V29 |

### 6.3 The rule flip before vs after shifting (V16)

| | Target |
|---|---|
| **Before** shifting | Resistance WTT → *that level minus one strike*. Support WTB → *that level plus one strike*. |
| **After** shifting | Read off the **new** extension of resistance / extension of support instead. |

---

## 7. Layer 5 — the scenario (Chart of Accuracy 1.0)

**Support pressure × resistance pressure → one of nine scenarios.** The tool prints the label as a
banner ("Nifty in Blood Bath", "Nifty both side risky COA 8").

### 7.1 The canonical table

Synthesising V13, V112 and V121 (which agree on substance):

| # | Resistance | Support | Verdict | Trade |
|---|---|---|---|---|
| 1 | Strong | Strong | **Neutral** | Both sides. Puts from EOR, Calls from EOS. First touch safest. |
| 2 | **WTB / bearish** | Strong | **Slightly bearish** | **Puts only** |
| 3 | **WTT / bullish** | Strong | **Slightly bullish** | **Calls only** |
| 4 | Strong | **WTB / bearish** | **Slightly bearish** | **Puts** |
| 5 | Strong | **WTT / bullish** | **Slightly bullish** | **Calls** |
| 6 | Bearish | Bearish | **BLOOD BATH** | **Puts only. No call buying at all.** |
| 7 | Bullish | Bullish | **BULL RUN** | **Calls only. No put buying at all.** |
| 8 | *levels pulling apart / opposing* | | **Both sides risky** | Cannot be read from COA 1.0 alone |
| 9 | *levels pressing on each other* | | **Both sides risky** | " |

Scenarios **8 and 9 require the Game of Percentage** (§10) to resolve (V13, V23).

⚠ V47 calls **both sides WTB at the open "the number nine scenario"**, which conflicts with
scenario 6 above. → **OQ-14.**

⚠ Scale claims vary: 9 → 121 → 8,000 (V38); 9 → ~13,000 (V110, V112). The mechanism given in V112
is that **each pressure state can be reached three ways** (direct weak-towards, a shift, or a
weak-towards that turned strong). → **OQ-11.**

### 7.2 The seven market-state labels the AI layer prints (V54)

1. **Neutral** — price expected to touch both levels once, then resolve (V66).
2. **Slight bullish**
3. **Bull run**
4. **Slight bearish**
5. **Blood bath**
6. **Both sides risky — 8th scenario**
7. **Both sides risky — 9th scenario**

Plus **SOC** variants (§8) which are traded like bull run / blood bath.

### 7.3 The speaker's own instruction on all this

> **"Don't memorise the outcomes. READ THE PRESSURE ON EACH SIDE. The pressure is what the label is
> derived from, and it updates continuously."** (V108)

**Build it that way: implement `pressure(side) → {bullish, bearish, neutral}` and derive the label.**

### 7.4 ⚠ The screen LAGS the market (V114)

> The displayed scenario only updates when a percentage **crosses** 75%. A level falling from 95%
> towards 80% **has already turned bullish in substance while the screen still prints blood bath.**
> Likewise a level that stays WTB but moves its weak point *up* one strike has turned bullish in
> pressure while keeping its label.

**Design implication: surface the percentage TRAJECTORY, not only the thresholded label.**
V114's own instruction is to watch the number move through **65, 68, 70, 72** rather than waiting
for 75 to surprise you.

---

## 8. State of Confusion (SOC)

### 8.1 Definition

> **When one side of the chain CANNOT SETTLE ON ONE STRIKE for an hour or more, while THE OTHER SIDE
> IS STRONG, that side is in a State of Confusion.** (V16, V27, V47)

The "other side must be strong" clause is load-bearing: **the SOC ENDS as soon as the opposite side
stops being strong** — specifically when its percentage reaches **75** (V47).

### 8.2 The two confirmation forms (V27)

1. **The weakness percentage on the undecided side holds at the same level for a FULL HOUR without
   shifting.** (Observed sitting at ~80 from 9:33 to 9:47, still 85–86 past 10:25.)
2. **The shift DOES complete inside the hour but the level still does not become strong** — e.g. WTT
   stuck at 98 or 99. **Then wait ONE MORE HOUR.**
   → **So confirming an SOC can take up to TWO HOURS.**

**Clock rules:** the 60 minutes runs from the **first tick** if the side was unsettled from the open
(V28), or **restarts from the moment a shift completes** (V29).

**V45 adds a stage-two tell:** one side's percentage **varying between 75 and 99** while the other
stays strong → expect an SOC within about two hours. → **OQ-13** (is SOC two-stage or three-stage?)

### 8.3 The direction rule — counter-intuitive and central

> **The market moves TOWARDS the confused side.**
> **Confusion on the SUPPORT side → the day is BEARISH.**
> **Confusion on the RESISTANCE side → the day is BULLISH.**
> (V16, V27, V28)

**And it holds regardless of whether the confused level reads WTT or WTB** (V27).
→ **This is the important reversal: normally support WTT is bullish; inside an SOC it is not.**

V112 restates it as: **the market moves AGAINST the failed pressure.**

**This is precisely where chain-readers get trapped** (V16): the chain looks like a bloodbath while
the market is about to rise.

### 8.4 Duration grading and how to trade it

- **After 1 hour → SOC 1R; 2 hours → 2R; 3 hours → 3R** (V112).
  The banner shows it as e.g. "bearish SOC, 3 hours"; **red colouring means the confusion is on the
  support side** (V75).
- **Bullish SOC is traded exactly like a BULL RUN. Bearish SOC exactly like a BLOOD BATH** (V100).
- **An SOC does NOT end a bull run permanently — it PAUSES it. Once the percentage jumps, the move
  resumes** (V45).
- **When an SOC ENDS, the pressure that was blocked takes over again** (V112) — demonstrated: a
  bullish SOC at 10:15 lifted the market until ~11:12, then the resistance shifted, the SOC ended at
  100%, the blood-bath verdict returned, and the market fell for the rest of the session.
- **Both sides in confusion = "both-side state of confusion", which KILLS MOVEMENT** (V47).

### 8.5 The withheld piece

**A normal WTT stops one strike below the weak level. An SOC WTT does NOT follow that limit — and
how far it can run is deliberately withheld behind the paid community** (V16). → **OQ-3.**

---

## 9. Layer 6 — the reversal price and the level ladder

### 9.1 The reversal price — the unknown primitive

Every strike carries a **reversal price** on each side. It is the number all the lines are made of:

> "**None of these are round numbers; each is the reversal price of a specific strike.**" (V114)
> "**Each is the reversal price of a specific strike, not a round number.**" (V110)

**What the corpus says about how it is computed:**

| Input list | Source |
|---|---|
| "Derived from Option Greeks" | V09, V48, V50, V54, V65, V122, V131 |
| The manual prototype took: **market price, call-side LTP, put-side LTP, and delta, theta, vega, gamma** → pressed calculate → got the reversal price for that strike | **V124** |
| Earlier versions required **market price, Call data, Put data, IV, Theta and Delta** to be typed in | **V47** |
| "Delta, Theta, Vega, Gamma, **Rho** — plus **implied volatility**, **both sides' LTPs**, **spot** and **futures**" | **V111** |
| The Greeks themselves are priced by **Black-Scholes** | V107 |
| The theoretical bridge: *"a writer earns most where time value peaks; the price at which time value reaches its peak is where the writer commits most heavily — and that is the reversal price"* | **V18** |
| The economic framing: *"when the demand-supply ratio shifts enough, price can reverse; the strongest reversal price is picked using volume and OI at each strike, with Greeks in the calculation"* | V54, V82 |

**No file gives the formula.** → **OQ-1. This is the single genuine blocker.**

**Sentinel values:** instead of a number, the calculation can return the word **"breakout"** (call
side) or **"breakdown"** (put side) (V14). These are not errors — they become *conditions* in the
LTP Swing rules (V79, V91). **The data model must represent them.**

### 9.2 Reading a reversal price off the screen

- **Click the VOLUME at a strike on a given side** → the reversal value for that strike/side (V10,
  V11, V12, V38).
- **Or: press the "Spot" button and the whole display switches from LTPs to REVERSAL PRICES** (V122).
  Pressing "Spot" once also makes premiums appear beside every strike (V81, V85). *(The same button
  is described doing two different things across files — minor, but note it.)*

### 9.3 ⚠ The side-crossing rule (easy to get wrong)

> **Click the volume on the PUT side of a strike → get the EXTENSION OF SUPPORT → that is the CALL entry.**
> **Click the volume on the CALL side of a strike → get the EXTENSION OF RESISTANCE → that is the PUT entry.**
> (V12)

V17 names the mirror mistake explicitly: **entering a level against the strike on the opposite side
of the chain** when projecting a premium. The projection must be done on **the exact strike and the
exact side you will actually buy.**

### 9.4 The level ladder

| Name | Definition |
|---|---|
| **Support / Resistance** | The strike itself (§4) |
| **Extension of support (EOS / US)** | The reversal price at the support strike, on the put side |
| **Extension of resistance (EOR / UR)** | The reversal price at the resistance strike, on the call side |
| **EOS−1 / OS−1 / US−1** | The reversal price of the strike **one below** support |
| **EOR+1 / OR+1 / UR+1** | The reversal price of the strike **one above** resistance |
| **EOS−2, EOR+2** | Two strikes out. **V114: extension +2 IS the Max Pain line.** |
| **Divergence / diversion** | The reversal price at an **intermediate** strike between support and resistance |
| **End of diversion** | The paired level of a diversion (V09) |

**Notation is inconsistent across files** — EOR+1 / OR+1 / UR+1 / R+1 / "extension of resistance plus
one" all mean the same thing. Normalise on one form.

### 9.5 Counting diversions (V11)

```
diversions = (number of strikes strictly BETWEEN support and resistance) + 1
```

| Case | Count |
|---|---|
| Support 19,700, resistance 19,800, 19,750 between → 1 strike between | **2 diversions** |
| Adjacent strikes, nothing between | count starts from 0 |
| **Support and resistance on the SAME strike** | counted as **−1**, cancelling the +1 → **0 diversions** |

The same-strike case is why price runs **straight** from EOS to EOR with nothing in between (V11, V12).

**To read a diversion value: click the volume on the IN-BETWEEN strike** — it gives both the
call-side and put-side diversion (V11).

### 9.6 The distance is not fixed — and the level's REACH

- The level→extension distance is **not fixed**. Rough scale: ~20 paise on a ₹100 stock, ~₹10 on a
  ₹1,000 stock, **~25–35 points on Nifty near 20,000** (V09).
- **A LEVEL'S REACH IS SET BY ITS REVERSAL PRICE, NOT BY THE STRIKE** (V111).
  Bank Nifty support at 58,000 had a reversal price near **57,700** — price could drop ~300 points
  below the strike and the level was still doing its job. The day's low came in near 57,528, one
  further diversion below, and **support was still counted as 58,000**.
  > **A trader reading only the highest OI would give up long before price reached the level that
  > actually mattered.**
- **PV (point value) = HALF the gap between two strike prices** (V106). A ₹20 strike gap → PV ₹10.
  This is the only explicit expected-move formula in the corpus.

### 9.7 The reversal-price GAP rule — a directional signal in its own right (V126)

**Baseline expectation:**
- a **call-side** reversal price should sit **ABOVE** its strike;
- a **put-side** reversal price should sit **BELOW** its strike.

| Observed | Reading |
|---|---|
| **Both sides pushed DOWN** (call reversal below its strike; put reversal unusually far below) | **BEARISH** |
| **Both sides pushed UP** | **BULLISH** |
| **Both sides equal / near-equal** | **CONSOLIDATION, no volatility** |

**The gap SIZE measures the strength; the CHANGE OVER TIME is the signal.**
Worked (Sensex 4 June): the 74,400 strike showed a reversal of 74,200 — 200 points below where it
should have been above → bearish; price fell. By 9:30 the gap narrowed to ~150 and stayed there →
**bearish pressure easing** → price turned up. **Total analysis: five minutes at the open, no volume,
no Greeks, no indicator.**

**Its stated practical use is EXIT TIMING**: while holding from *any* method, a steady gap means the
position is fine; **a sudden reversal or abnormality in the gap is an early warning to exit.**

**A related asymmetry read (V72):** when call-side reversals sit almost *on* their strikes while
put-side reversals sit ~30 points below, the market has **capacity to fall ~30 points and none to
rise**. **At expiry all reversal prices converge to intrinsic value.**

---

## 10. The Game of Percentage

Two distinct uses. Do not conflate them.

### 10.1 Use A — resolving scenarios 8 and 9 (V23)

When resistance is WTT (bullish) and support is WTB (bearish), the two cancel. Then:

- **First behaviour: the market CONSOLIDATES** between the call-side divergence of the strike and the
  put-side divergence — a band roughly one strike wide. Sell the top, buy the bottom.
- **Whichever percentage is HIGHER wins.** (96–99 WTB vs 84–87 WTT → downward pull.)
- **Then classify by the DIRECTION OF CHANGE of the two percentages:**

  | Resistance % | Support % | Market |
  |---|---|---|
  | Increasing | Stable | **Bullish** |
  | Decreasing | Stable | **Bearish** |
  | Stable | Stable | **Consolidation** |
  | Increasing | Increasing | **Consolidation** |
  | Decreasing | Increasing | **Bearish** |
  | Stable | Increasing | **Bearish** |
  | Stable | Decreasing | **Bullish** |
  | Increasing | Decreasing | **Bullish** |
  | Decreasing | Decreasing | **Consolidation** |

**This is a SECOND nine-way table. It is not the COA 1.0 nine scenarios.**

**V92 gives the same logic as a rule of thumb, and notes the sides are REVERSED:**
- **Resistance side:** a **rising** % means the bearish pressure is **dissolving** (turning WTT again);
  a **falling** % means the bearish pressure **stays stable**.
- **Support side:** a **falling** % means the support is **shifting cleanly and bullish pressure
  continues**; a **rising** % means the **shift is failing and the market turns bearish**.

**Two cautions (V23):** when the imaginary line moves, a level can turn grey and a spurious "WTT"
label can appear — **check the raw volume numbers, not the colour**. And **use the Compare feature to
pick the right strike to compare against**, or the percentage is meaningless.

### 10.2 Use B — confidence and holding, not entries (V109)

> **The percentage does NOT generate entries.** Entries come from your value — a divergence,
> R Moderate, R Risky, S Risky. **Its job is to tell you how much CONFIDENCE to place in a trade
> before taking it, and HOW LONG TO STAY IN IT afterwards.**

Interpretation depends on the **label**, not the number:

| Level state | % rising | % falling |
|---|---|---|
| Resistance in **WTB** | drags the market **down** | lets the market **rise** |
| Resistance in **WTT** | **lifts** the market | **weakens** it |
| **Both sides' % falling** | → **bullish** | |

### 10.3 ⚠ THE INVERSION — the rule most likely to be implemented wrong

> **Once a level COMPLETES its shift and settles at the new strike, the reaction INVERTS.
> The SAME rising percentage that was BULLISH before the shift becomes BEARISH after it.** (V109)

**The state machine must carry a "has this shift completed?" flag.** Without it the percentage is
uninterpretable.

### 10.4 Watch all FOUR numbers

There are **four** figures — the pulling percentages on the call side and the put side, **in both
directions**. The named trap: you watch one number falling and conclude bullish while **a lower
strike on the same side is quietly climbing and will pull the market down**. **The tool BOLDS these.**
When percentages on **opposite** sides both rise, it is a tug of war (V109).

### 10.5 Percentage-driven exits, as stated

| Situation | Action | Source |
|---|---|---|
| In a bearish trade, the % climbs to 100 and holds | **Exit even though flat** | V109 |
| In a Call trade during a WTT shift, % above ~85 | **Stay in** | V29 |
| …% falls below 85 | **Shift is completing → market turns bearish → reverse the trade** | V29 |
| Holding a Put against a WTT resistance, % climbing to 90/95/97 | **Volume is shifting → exit and book the loss** | V15 |
| WTT % falling 99 → 97 → 93 → 92 → 80 → 79 | **Shift progressing; near 79–80 the level is close to becoming strong → stay in the Call** | V24 |
| In an SOC trade, the confused side's % slides 85 → 82 → 80 | **Exit** | V16 |
| Percentage at the strike **below** current support starts **rising** | **Support is preparing to shift back DOWN**; S Max Pain will move down with it | V62 |
| Percentage moves against you at all | **Exit, even at breakeven** | V109 |
| Two or four contrary candles while the % still supports you | **Ignore them** | V109 |

**Two stop-loss styles offered (V62):** hold to 100% and treat that as the stop, or exit at a chosen
level before 100 (80/90/95/98). **Which to use is a personal risk decision.**

---

## 11. Layer 7 — the three line modes

| Mode | When computed | Static? | What it draws |
|---|---|---|---|
| **Live LTP** | Continuously | **Recomputed as levels shift** (V47, V51) — but V58 calls them "static lines at whatever the current EOR/EOR+1/EOS/EOS−1 are" → **OQ-20** | EOR+1, EOR, EOS, EOS−1 |
| **920** | **Once, at 9:21**, from the 9:20 chain | **Yes — fixed for the day and in the historical record** | EOR+1, EOR, EOS, EOS−1 |
| **AI LTP** | Continuously, per market state | Redrawn on state change; **grey = vanished** | Up to 8 named lines |
| **Stock (Live)** | **Once at 9:25**, from the first ~2 candles | **Yes — static for the day** | P2, P1, C1, C2 |

### 11.1 The 9:20 lines

- Generated at **9:21** despite the name (V49, V76, V77), from a **5–6 minute** analysis window
  starting at 9:15 (V51, V52, V99). → **OQ-18** on the exact window.
- **Top to bottom: EOR+1, EOR, EOS, EOS−1.**
- **The top two are PUT levels; the bottom two are CALL levels** (V48).
- **Outer two = SAFE (stop close). Inner two = RISKY (stop far).** (V48, V51)
  **"Risky" refers to the SIZE OF THE STOP, not how often it is hit.** (V51, V52)
- **Only the FIRST touch of each line counts. That caps the day at four trades.** Some days give
  four, some one, some none (V48).
- **New trades 9:20 → 11:30. Manage until 2:30. Everything closed at 2:30.** (V48; V117 repeats the
  11:30 cut-off.)
- **Target = the next line in the direction of the trade** (V48); or **the reversal price nearest the
  current market price** (V61); or **the matching reversal price on the OPPOSITE side of the chain**
  (V51, V52). → these are compatible statements of the same idea but are worded differently. **OQ-15.**
- **If price moves against you to the next line out → AVERAGE with the same lot size. If you cannot
  fund the average, do not take the inner line at all** (V48).

**Reading the stop loss off the chain (V48, V49, V61) — the three-step version:**

```
Buying a PUT (read from the CALL side):
  1. Take the value next to the line you are trading            e.g. 643
  2. Move to the strike just BELOW that value, read its value   e.g. 708
  3. ADD 10 points                                              → stop = 718

Buying a CALL (read from the PUT side): mirror, SUBTRACT 10 points.
```

Or, stated structurally (V61): **the stop-loss reversal sits TWO STRIKES above the 9:20 resistance
strike, or TWO STRIKES below the 9:20 support strike.**
**Both the risky and the safe trade on the same side SHARE the same stop** — "the top of the market
is a property of the market, not of your entry" (V49).

### 11.2 The missing-line rule

**Stated twice as a prohibition, once as a forecast:**

| Form | Statement | Source |
|---|---|---|
| Prohibition | **No upper line → do not buy Puts (and do not short futures). No lower line → do not buy Calls.** | V99, V107, V117 |
| Prohibition | "When a line is missing on one side, no trade is taken on that side" | V80 |
| **Forecast** | **Only the lower two drawn → expect a good BULLISH move. Only the upper two → expect a BEARISH one.** | V61 |
| Mechanism | Lines go missing **when the market opens ABOVE its resistance reversal or BELOW its support reversal. At least two of the four always appear.** | V117 |
| For stocks | **Only three lines appearing means two values have COINCIDED → skip the stock.** | V106 |
| Never observed | A day where **both** sides were missing | V99 |

The prohibition and the forecast are consistent (a missing upper line means no fixed upside
destination → bullish → do not buy puts). → **OQ-22** is about whether they are meant to be used
together.

### 11.3 The AI LTP lines (V54, V100)

**Up to eight lines. Red = R = bearish. Green = S = bullish.**

```
        R Max Pain     ← OUTERMOST.  STOP LOSS for any bearish trade
        R Moderate     ← conservative bearish entry (smallest stop)
        R Risky        ← bearish entry for risk takers
        R Max Gain     ← TARGET for a bearish trade
  ─────────── price ───────────
        S Max Gain     ← TARGET for a bullish trade
        S Risky        ← bullish entry for risk takers
        S Moderate     ← conservative bullish entry
        S Max Pain     ← OUTERMOST.  STOP LOSS for any bullish trade
```

**⚠ TERMINOLOGY WARNING: "Max Pain" here means STOP LOSS. "Max Gain" means TARGET.
Neither carries its industry meaning. Do not import the classical max-pain-strike definition.**

**Roles are fixed (V100):**
`entry = Risky or Moderate` · `stop = Max Pain on that side` · `target = Max Gain on that side`.
**A Moderate line gives a TIGHTER stop than a Risky line because it sits NEARER to Max Pain.**

**Where each line comes from (V110 — the only file that says):**

| Line | Derived from |
|---|---|
| **S Risky** | the reversal price of the strike where support is **weak-towards-top** |
| **S Moderate** | the reversal price of the **support strike itself** |
| **S Max Pain** | the reversal price **two strikes BELOW support** |

Confirmed independently by **V114**: *"stop loss sits at extension +2, the max pain line."*
**Below S Max Pain, close up for the day — no stop loss belongs beyond it.**

**V125 adds which strike the entry is taken from:**
> **The buy level is the reversal price calculated at the strike holding the HIGHEST OPEN INTEREST
> SITTING UNDER THE HIGHEST VOLUME. Nearer reversal prices exist, but only the one at the heaviest
> strike is offered.**

**V55** confirms the anchoring: when both the highest volume and the highest OI sat at the 24,500
strike, **the model widened the stop around that strike.**

**Behavioural properties:**
- **The profit-target line only appears once price actually REACHES the entry level** — an empty
  target field means price has not arrived (V110).
- **A GREY line is history/stale.** It disappears on refresh; only your device remembers it
  (V65, V110). **In a blood bath the S lines turn grey and buying disappears** (V57).
- **Max Gain levels are RECREATED as the market moves** (V109).
- **A Moderate value holds only while its yellow percentage marker is alive. Once the marker moves or
  a WTT forms, that line stops mattering and disappears** (V123).

### 11.4 The scenario → line-set mapping (V100) — the core of the AI layer

| Scenario | Lines drawn | Trade permitted |
|---|---|---|
| **Slight bullish** | All four **S** lines; only **three R** lines (**no R Moderate**) | Bullish in favour of COA 1.0; any bearish trade highly risky |
| **Slight bearish** | All four **R** lines; **S Moderate missing** | Bearish in favour |
| **Bull run** | **Only the four S lines** | Bullish only. A sell may be attempted **only from S Max Gain, and only if resistance is strong** |
| **Blood bath** | **Only the four R lines** | Bearish only. A counter-trade from **R Max Gain** requires **support to be strong** |
| **Both side risky 8** | **All eight** | Both directions AGAINST COA 1.0 |
| **Both side risky 9** | All eight **minus R Moderate and S Moderate** | The riskiest; the guest says he now avoids it entirely |
| **Bullish SOC** | — | Trade **exactly like a BULL RUN** |
| **Bearish SOC** | — | Trade **exactly like a BLOOD BATH** |

> **THE NUMBER OF LINES SHOWING IS ITSELF PART OF THE SIGNAL** (V54, V55).
> Under blood bath all the **S values print "NA"** (V58).

⚠ Line-count claims vary: V54/V100 say up to 8; V60 says **AI LTP draws a minimum of 3 and up to 6**;
V110 works with 6. → **OQ-21.**

**The counter-trend permission rule (V100):**
> **A counter-trend trade is only allowed when the level you are FADING shows NO YELLOW.**
> Live demonstration: he refuses a sell at S Max Gain because resistance is WTT and its percentage is
> still rising; resistance then shifts and S Max Gain moves away, confirming the refusal.

### 11.5 The stock line set — C1, C2, P1, P2

Entirely separate from the index path.

```
   P2   ← red, SELL
   P1   ← red, SELL
 ─── price ───
   C1   ← green, BUY
   C2   ← green, BUY
```

- **Generated at 9:25**, after the first ~2 candles, then **static for the day** (V63, V80, V106).
- **Each line carries its own ENTRY, MAX PAIN (stop) and MAX GAIN (target)** (V59, V61, V63, V80).
- **Sell at P1; if price pushes above P1, sell again at P2. Buy at C1; if it falls further, buy at C2**
  (V63).
- **Computed from Greeks, volume and OI — no trendlines, no candlestick patterns** (V106).
- **⚠ The market state is NOT used in the stock screen at all** (V71) — blood bath and the other
  scenarios play no part. **Index trades are state-driven; stock trades are line-and-risk-driven.**

---

## 12. Layer 8/9 — the filters and vetoes

### 12.1 Index-side filters

| Filter | Rule | Source |
|---|---|---|
| **Scenario permission** | Never trade the side the scenario forbids. On a slightly-bullish day, no bearish trade — **accept two trades a month if that is what it comes to.** | V110, V13, V59 |
| **First touch only** | Trade a level **once**. A second touch is not a trade. | V48, V57, V66, V100, V125 |
| **Ratio gate** | **Never take a trade whose stop is larger than its target.** Compare the Risky and Moderate versions and take the better ratio, **or take neither.** | V57, V58, V60 |
| **Max Pain must exist** | **If R Max Pain is missing, do not buy puts at all. Without a stop loss there is no trade.** Same for S Max Pain and calls. | V60 |
| **Entry ≠ target** | **If S Risky and S Max Gain print at the same place, there is NO TRADE, even in a bull run.** | V109, V116 |
| **Max Pain on the entry** | **When Max Pain moves onto the entry price itself, do not enter.** | V66 |
| **Outside the range** | **When the market runs above every line on the screen, it is outside the tool's tradeable range — take nothing.** | V109 |
| **Scenario about to expire** | **Before entering on a scenario's rule, check the percentage has not run up towards 100 on the way there.** If it has, the scenario is about to end. | V109 |
| **IV gate** | Stable IV → the levels reverse accurately. **Rising IV on BOTH sides → they will not.** Settled condition: **call-side and put-side IV within ~1 point of each other.** A large intraday drift (11.7 → 15) is the other warning. | V21, V104, V107 |
| **Counter-trend permission** | Only fade a level that shows **no yellow**. | V100, V105 |
| **Event suspension** | During a policy/data release, **treat everything except the range as suspended** — order flow, not structure, is breaking levels. | V110 |

### 12.2 Stock-side filters (LTP Blast) — the full set

Consolidated from V35, V51, V52, V59, V61, V63, V71, V80, V106:

| # | Filter | Rule |
|---|---|---|
| 1 | **Risk rating** | **Bullish risk** governs C1/C2; **bearish risk** governs P1/P2. Scored **0–10**. **Only 0 or 1 is tradeable. 2+ kills that side.** (V51 grades 0 best / 1 risky / 2 highly risky / 3 rarest-and-worst.) |
| 2 | **All four lines present** | Three, two, one or none → **the stock is not traded at all that day.** Three lines means **two values coincided** (V106). |
| 3 | **Pairing** | **C1↔P1 and C2↔P2 are pairs. If one fires, its partner is dead for the day** — **even if you personally did not take the trade** (V80). |
| 4 | **C2/P2 override** | **If the market reaches C2 or P2 at any point, including at the open, ONLY that line is traded and the other three are dropped.** |
| 5 | **Open-at-outer-line** | **If a stock OPENS at (or beyond) C2 or P2, it is untradable all day.** |
| 6 | **Stop already hit** | If the first (or second) candle already reached that line's **Max Pain**, the line is eliminated. Asian Paints: first-candle low 2,519.60 below C1's stop of 2,521.50 → **C1 counts as executed and stopped out; with C1 gone, P1 is automatically gone too.** |
| 7 | **Target already hit** | Same for **Max Gain** — ICICI Bank, Axis Bank and Infosys were all rejected this way. |
| 7a | **Qualifier** | **Rule 6/7 only applies if the ENTRY was reachable in the same window.** Reliance's first-candle low was below its stop, but **the entry had never been touched, so the stop was not relevant** (V71). |
| 8 | **Pre-9:25 trade discarded** | A trade that completed inside the first candle, before the lines existed, is **discarded — you cannot claim a trade you could not have seen** (V106). |
| 9 | **Duplicate values** | **If C1 and P1 print the same value, skip the stock entirely** (V59). |
| 10 | **Liquidity** | **Avoid stocks whose strikes show volumes of 20/30/80 contracts** (V106). |
| 11 | **Tie-break** | Two valid setups → **take the lower risk number** (V71). Both C2 and P2 available → **take the side with the lower risk score** (V106). |
| 12 | **Near-miss** | **Treat a target or stop reached within a rupee as REACHED** (V61). Power Grid came within 30 paise of its target → **skip**. |
| 13 | **Portfolio size** | **Aim for about FIVE stocks** so the intraday book is diversified (V63). Expect **2–5 usable trades in the first hour** (V106). |

**The older, pre-AI three-rule version (V35), for stocks read off the chain manually:**
1. **Level type** — to buy a Call, **neither** level may be WTB; to buy a Put, **neither** may be WTT.
2. **Zeros on the ITM side** — check the ITM LTP column on your side. *(V12: **any** zero → skip.
   V35: **one** zero tolerable, more than one or two is dangerous. A price of 37.1 is not a zero.
   → **OQ-10**.)*
3. **Implied volatility** — IV around ATM should sit **around 20 and must not exceed ~25–28**.

**Stock-specific target rule (V35):** price *can* run to the WTT resistance, **but in stocks book at
the FIRST DIVERGENCE only** — stocks are slower, with less volume and fewer traders.

---

## 13. Layer 10 — entry, stop, target, and management

### 13.1 The Six Kinds of Reversals — the original trade table (V09)

| Open a trade at | Close that trade at |
|---|---|
| **Extension of resistance** | Diversion |
| **Extension of support** | Diversion |
| **End of diversion** | Support or resistance |

**At an extension of resistance:** buy a Put, write a Call, or short cash/futures.
**At an extension of support:** the Call side.

### 13.2 Safe vs risky (V11)

```
   EOR      ← safe PUT          ┐
   div      ← risky PUT         │  upper two = PUT levels
 ──────────── price ────────────
   div      ← risky CALL        │  lower two = CALL levels
   EOS      ← safe CALL         ┘
```
*(The 9:20 variant in V48/V51 puts the safe line OUTSIDE — at EOR+1 / EOS−1 — because there the stop
is shared and the outer entry is closer to it. Both are "safe = smaller stop".)*

### 13.3 ⚠ First touch vs second touch — repeated more than any other rule

| Statement | Source |
|---|---|
| **The first touch of an extension is the safest entry. Risk rises with every later touch.** | V10, V12, V30, V38 |
| **On the second hit: a risky trader may still enter at the extension and average at OR+1 / OS−1. A SAFE trader skips the extension entirely and waits for OR+1 / OS−1.** | V38 |
| **The OPEN itself counts as a touch** if the market opened at the extension. | V20 |
| **Do not re-trade a level that has already given its trade and hit its target that day.** | V53 |
| **Use each line ONCE; if price returns later the same day, do not re-enter.** | V100 |
| **How the rule was derived:** he traded it, reviewed the losses, found S Risky and S Moderate entries **were failing on repeat touches**, concluded **a level weakens once it has been hit**, and wrote the rule in to close the gap. | V125 |
| **Do not use COA 2.0 on the FIRST hit** — it will point the opposite way and talk you out of a valid trade. | V31 |

### 13.4 ⚠ Never enter at the running price

**Stated as "the single biggest mistake"** (V28): with an SOC confirmed and the market at 19,438, the
temptation is to buy immediately. **The correct action is to click the strike, read the value
(≈19,420–19,425), and WAIT for price to come to it.** It came at 11:15.

Reinforced everywhere: "you wait at a fixed level the way you wait at a station for a train" (V29);
"a train stops at a station, not at a red signal" (V64); **"if price runs away before reaching your
level, LET IT GO — buying late puts your stop loss hundreds of points behind"** (V110);
**"read a red candle in a bull run as the market TRAVELLING TOWARDS YOUR ENTRY, not as a signal you
missed the move"** (V110).

**Corollary (V17, V107): pre-compute the PREMIUM at your intended entry level and place a limit order
at that premium in advance.** The OC tab / premium projector takes a spot level + a strike + a side
and returns the premium the option will carry there. Example: intending to enter when Nifty reaches
25,824, the projector showed ₹156 against ₹196 currently → **bid ₹156.**

**And always use LIMIT orders** (V98): a market order fills at the standing ask, not the LTP —
Nifty LTP 39.85 filled at 40.70; an Ambuja put with LTP ₹14.70 filled at **₹16.55, on a trade whose
whole target was about ₹2.**

### 13.5 Stop loss — never a fixed number of points

**V111 is the clearest argument in the corpus:**
> A 20-point stop is a number **the trader** chose. The market does not know it. Because the loss
> looks small (20 × 75 ≈ ₹1,500) the trade feels easy, so the trader only plans the favourable case.
> When price goes against the position **the stop gets MOVED** — to the extension of support, then to
> the next diversion — and the planned ₹1,500 becomes 150 or 220 points. **Eight winners of 50 points
> and two losses of that size leave the account flat or negative.**
> **A stop loss has to come from MARKET STRUCTURE.**

**Where the stop actually comes from, by mode:**

| Mode | Stop |
|---|---|
| AI LTP | **Max Pain on that side** — and it is not yours to choose (V60) |
| 9:20 | Read off the **opposite side of the chain**, ±10 points (§11.1) |
| Stock lines | **Max Pain** printed on the line |
| Scenario-1 extremes | **Below the STRIKE price** — "if price goes there, the scenario itself has changed" (V30) |
| LTP Swing | **A STATE, not a price** — exit when the OI status flips (§15) |
| Short strangle | **The combined premium of both legs** (V81, V83, V85) |
| Hedged positional | **The option premium paid** (V79, V91, V106) |

**And the named biggest mistake (V60):** *taking a Risky-line entry and then substituting your own
20-point stop because the real one is 100 points wide.*

### 13.6 Choosing your entry by choosing your risk (V60, V108)

> **Choose your ENTRY by how far you are willing to sit from Max Pain.** Want a 50-point stop? Wait
> for a line 50 points inside it. Want a 5-point stop? **Accept that such a setup might appear four
> times in a year.**
>
> **The trade-off, stated plainly: the tighter the stop, the safer the trade, the RARER it is, and
> the lower the total return.** A setup that triggers once in 10–25 days cannot produce much. A loose
> stop triggers constantly but loses more often.
>
> **Think about HOW OFTEN a trade will actually be executed, not how many points it might make.**

Blood-bath illustration (V108): selling at the current price, far from Max Pain, meant a **~1,170
point** stop. Waiting until price came within a few points of Max Pain meant a **5-point** stop.

**Eligibility (V60):** **Risky lines are only for traders profitable for at least 3–6 months.
A losing or break-even trader should never take them, even if that means no trade for six months.**
(V59 says 6 months for counter-trend trades.)

### 13.7 Target

| Method | Rule | Source |
|---|---|---|
| AI LTP | **Max Gain** on that side | V54, V60, V109 |
| Partial exits | **Every reversal price between your entry and Max Gain is a divergence, and each is a valid place to book part of the position** | V57, V59 |
| 9:20 | **The next line in the direction of the trade** / the nearest reversal price / the matching value on the opposite side | V48, V51, V52, V61 |
| Set D | **D1, D2 or D3.** **The less experienced you are, the closer you should stop — beginners take D1 only** | V76 |
| Stocks | **Book at the FIRST divergence only** | V35 |
| Positional | **The Call HOI reversal** (long) / **the Put HOI reversal** (short) | V79, V91 |
| Divergence scalping | **Equal to the stop. 1:1. Max 25 points, and never more than the strike gap** | V108 |

**And: exit at your stated value. Do not book 5 or 10 points early because the target looks close**
(V100) — which sits awkwardly beside V119, where he takes a three-point profit and defends it.
→ **OQ-34.**

### 13.8 ⚠ Averaging — the most dangerous rule in the corpus, and its one legitimate form

The instruction to average rather than stop out appears in **V10, V11, V15, V25, V28, V30, V39, V47,
V48, V49, V51, V52, V57, V61, V65, V76, V101**. The source files repeatedly flag it as the riskiest
advice given. **V116 is the file that finally constrains it:**

> **Averaging is ONLY valid when the SITUATION YOU ENTERED ON IS STILL THE SITUATION ON SCREEN.**
> You are bearish, the market is still bearish, and price has simply come a little above your entry.
>
> **If the PRESSURE HAS TURNED AGAINST YOU, adding a lot is NOT averaging. It is building a SECOND
> position against yourself on top of one already trapped.**
>
> **Price sliding towards a line is NOT a reason to add. The reason to add is that the READINGS still
> favour you.**
>
> Framed as **eligibility**: you earn the right to average only once you can read the percentage
> pressure and say what would end the current scenario.

**Supporting constraints:**
- **Average only at the NEXT FULL VALUE — the safe line. Never at prices in between** (V11).
- **If the S/R picture changes while in a risky trade → do NOT average; book the loss** (V11).
- **Average only if you trade multiple lots. A single-lot trader should not average — hold back to
  cost instead** (V30).
- **If you cannot fund the average, do not take the inner (risky) line at all** (V48, V51, V61).
- **Set D version: one lot at US, TWO lots at US−1** (V76).
- **When the AI says exit, exit. Do not average, hold, or wait for a reversal** (V58).
- **Never hold a stuck bought option in hope. If you cannot exit cleanly, book the loss** (V30).

### 13.9 Exiting on a state change

**The ordered rule (V64):**
1. Know the exact point value of your stop when you enter.
2. When the scenario changes, ask whether the change **favours** you.
3. **Check whether the stop DISTANCE has GROWN or SHRUNK.**
   - **Shrinking stop → the scenario is in your favour → stay.**
   - **Growing stop → against you → exit immediately.**

Restated in V60 as a Max Pain test:
- **Max Pain moves CLOSER to your entry → risk shrank → stay.**
- **Max Pain moves FURTHER away → stop widened → better to exit.**
- **Max Pain turns grey or VANISHES → EXIT IMMEDIATELY, because the stop that justified the trade no
  longer exists.**

And: **a support that shifts DOWN does not change the target but WIDENS the stop** (V64) — which is
exactly why a rising percentage is a *weakness* for a long trade.

**V114:** exit when the scenario changes against the position. **Do not hold on because it might come
back.** It may come back four or six times out of ten; the time it does not, you are trapped.

### 13.10 The SWOT check (V64, V90)

Run every signal through **strength / weakness / opportunity / threat** — a mental exercise, seconds
long. **The point is COMPARISON: when two setups are live, the SWOT tells you which to take.**
**Each time the market state changes, the old SWOT is VOID and must be redone.**

**The six questions, asked FOUR times over (once per SWOT box):**
1. Target vs stop loss — how many points each, and what ratio?
2. Is the chart pointing in a direction that favours the trade?
3. If the scenario changes, does it change in your favour or against you?
4. If the market is in an SOC, what direction is likely to follow?
5. Is the momentum to that level **already complete**, or is there move left?
6. Is the percentage **rising or falling**?

**Confluence rule (V64):** where two independent signals land at the same price (e.g. the 9:20 top
line and the R+1 level), **count that overlap as an added strength.**

**Distance-to-threshold as a risk measure (V65):** a support at 73% is a real threat because 73→75
takes almost no time, whereas a resistance at 51% moving to 75 would take much longer.

---

## 14. Chart of Accuracy 2.0 — a separate framework

**Purpose (V31):** decide direction when the market is **stuck** — after price has reached its
extensions, mid-market between divergences, or **on a SECOND hit** of an extension.

**⚠ Do NOT use it on the FIRST hit.** It will point the opposite way and talk you out of a valid trade.

**⚠ And (V110) — the precondition V31 does not state:**
> **2.0 is USELESS AT THE SUPPORT OR RESISTANCE STRIKE ITSELF.** There the call and put OI differ by
> an order of magnitude and a few thousand new contracts cannot move a position that large.
> **Use it ONLY at INTERMEDIATE strikes where call and put OI are roughly COMPARABLE.**

**How to read it:** click **"OI Change"** on either side → a two-line graph.
**RED = put-side OI. GREEN = call-side OI.**
(V110's shorthand: green on top with red falling = bearish; red rising above green = bullish;
**parallel lines = price keeps hitting that level and reversing rather than breaking out.**)

**The nine scenarios (V31):**

| # | Call OI | Put OI | Reading |
|---|---|---|---|
| 1 | Flat | Flat (parallel) | **Consolidation** |
| 2 | Rising sharply | Flat | **Bearish** from that strike's divergence |
| 3 | Falling | Flat | **Mildly bullish** from that strike's divergence |
| 4 | Flat | Rising sharply | **Mildly bullish** from the strike where put OI is rising |
| 5 | Rising sharply | Rising sharply | **Boxed** between the two strikes. Breaks below the call-side divergence, rises above the put-side divergence. **~50 pts range in Nifty, ~100 in Bank Nifty, the strike gap in stocks** |
| 6 | Falling sharply | Flat | **Strong bullish run** off that strike's divergence |
| 7 | Flat | Falling steeply | **Price falls** from that strike |
| 8 | Rising | Falling | **Price falls** off that strike's divergence |
| 9 | Falling | Falling | Whole market **consolidates** until a direction appears |

**Usage: identify the STRIKE at which the behaviour is happening. THAT strike's DIVERGENCE is the
level the move starts from.**

Scenarios 6 and 7 are the most garbled part of that transcript. → **OQ-8.**

---

## 15. The positional path — LTP Swing

**Horizon: 10–15 days** (V26, V79).
**Timing: open new positions ONLY in the first 10–15 days of a new expiry month. The rest of the
month is for squaring off.** (V26, V79, V101 — V101 quantifies it as the first ~11 of ~22 trading days.)
**Read OPEN INTEREST, not volume** (V26).
**Only stocks with a live option chain qualify** (V79).

**Path:** menu → **Reports** → **LTP Swing** → Bullish / Bearish / **Read More** (opens the published
flowchart and the term table) (V91).

**Report columns:** time, symbol, lot size, **Shifting Status**, **CMP**, **Put HOI Reversal**,
**Call HOI Reversal**, **OI**, **Star Rating** (V79).

### 15.1 The decision tree

| | **BULLISH** | **BEARISH** |
|---|---|---|
| **Shifting Status** | **Strong or WTT** | **Strong or WTB** |
| **Star rating** | **0 or 1** (2+ → reject) | **0 or 1** |
| **Reversal condition** | **Put HOI reversal = "breakdown" OR ≈ CMP** | **Call HOI reversal = "breakout" (V79) / "breakdown" (V91) OR ≈ CMP** → **OQ-31** |
| **Entry** | **Buy at CMP** | **Sell at CMP** |
| **Instrument** | **Cash or futures** | **FUTURES ONLY** |
| **Target** | **The Call HOI reversal** (the 100%-OI strike on the call side) | **The Put HOI reversal** |
| **Stop loss** | **The put-side 100% OI turning WTB** | **The call-side 100% OI turning WTT** |

**⚠ The stop is a STATE, not a price. V101 is explicit: "you exit on that flip EVEN IF THE POSITION
IS CURRENTLY IN PROFIT."**

**Examples (V79):** REC CMP ≈₹351, WTT, breakdown, star 0, target ₹401. Exide ₹397, entry ₹395,
star 1. HFCL ₹69.30, entry ₹68.25, target ₹75. **HDFC Life ₹775 rejected purely on a star rating of 3.**

**Neither side is for naked option buying. Options appear only as the hedge.**

### 15.2 The hedge (replacing the stop loss)

```
expected move = Call HOI reversal − Put HOI reversal      (or − CMP)
buy a protective option whose premium ≈ 5–7% of that move
for the SAME quantity as the position
→ that premium IS the stop loss
```
(V79, V91.)

**REC worked example:** lot 1,275 shares, CMP ≈₹350, target ₹400, **buy the 350 put for ₹10**.
- Reaches ₹400 → spot gain 1,275 × ₹50, put worthless at 1,275 × ₹10 → **net 1,275 × ₹40**.
- Closes at ₹350 → **the ₹10 premium is the entire loss**.
- Falls to ₹340 / ₹330 / ₹320 → **the put offsets the spot loss → no profit, no loss however far it
  falls. Because there is no stop-out, a later reversal can still turn it profitable.**

**When hedging is NOT available (V79):**
- The hedge only works when the protective premium is **small**, i.e. the strike is near ATM.
  **If the strike is far from ATM the premium eats the target** → fall back on the WTB status stop.
- **If the 100% OI strike is DEEP ITM, skip it and use the next-ranked OI strike** (LIC Housing: the
  100% OI sat at 550, deep ITM, so the **88% OI strike** was used).
- **A stock appearing in BOTH the bullish and bearish lists with the 100% OI reversal at the same
  place on both sides is not hedgeable** (IGL).

**⚠ The 5–7% rule and the REC example contradict each other** — ₹10 against a ₹50 move is **20%**.
And **V106 uses a completely different denominator: "the ATM premium should be ~1% of the PRICE."**
→ **OQ-27.**

### 15.3 The scanner as a market-wide signal (V32)

The swing list separates bullish and bearish candidates. **On 2 January the bullish side was
completely empty and only bearish names appeared.** He reads an **empty bullish list as market-wide
selling pressure: if no stock can turn bullish, the index cannot either.** Nifty printed a large red
candle that session.

**An appearance on the list is a RESEARCH TRIGGER, not a trade signal** (V32).

### 15.4 The trap filter — where did the OI come from? (V26)

> **The yellow band alone is not enough. Open the historical data and find out where that Open
> Interest CAME FROM.**
> - OI has moved **UP INTO** the strike from a lower one → genuinely strengthening → **good buy**.
> - OI is **drifting DOWN** towards a lower strike → **the "support" is a TRAP.**

**Confirmation signal: a falling weakness percentage with a LIGHTENING yellow shade means the level
is firming up** (V26, V24). **Darkening = holding; fading = pressure coming off** (V33).

**Discount or ignore expiry-day OI** — positions are unwinding that day (V32).

### 15.5 "OI moves, price follows" (V33)

- Highest **put** OI = floor; highest **call** OI = ceiling. **Buy near the floor with the ceiling as
  target.**
- **The OI moving to a higher strike is PERMISSION for price to follow it.**
- **When OI leaves a level and rebuilds one strike higher, expect the old resistance to become the
  new support.**
- **Exit at the strike the crowd has moved to, rather than holding through it.**
- Timescale framing: **a ~₹10 move on a ₹350 stock is good momentum, expected in 2–5 days.**

---

## 16. The weekly and monthly RANGE (the W / M buttons)

### 16.1 What it is

**Six lines: L1, L2, L3 of support below and RL1, RL2, RL3 of resistance above** (V50, V74, V83).
Displayed under a **"Four Magical Spot Line"** block; **W = weekly, M = monthly** (V83).

**Hit rates, given as standard deviations** (V50, V74, V83, V88, V89, V101, V118):

| Band | Claimed hit rate |
|---|---|
| **L1** | ~65–66% |
| **L2** | ~95% |
| **L3** | >99% — "rarely even reached", "capable of stopping the market" |

→ essentially 1σ / 2σ / 3σ. **Stated as mathematical fact; never demonstrated.** → **OQ-16.**

### 16.2 Which instrument gets which range

| Instrument | Range | Generated |
|---|---|---|
| **Nifty** | **Weekly** | V74: **Thursday evening ~4 PM**. V88: **4:00 PM on the previous TUESDAY expiry**. V123: **Tuesday 5:30 PM**. → **OQ-25** (the expiry day moved; all three may be correct for their date) |
| **Bank Nifty, Fin Nifty, Midcap Nifty** | **Monthly** | V74 |
| **Individual F&O stocks** | **Monthly** | **The day AFTER the previous monthly expiry** (V74, V88) |

### 16.3 The key property

> **The levels are STATIC. Calculated once, then fixed for the whole period. They do not move as
> price moves.** (V88)

### 16.4 What it is computed from

**Not historical price, not trend lines, not indicators** (V74, V83, V88). Stated inputs:
- **How much OI sits at each strike**
- **Vega, and the volatility it implies**
- **How the other Greeks behave under that volatility**
- **Implied volatility**
- **Pending events — results, news**
- **The gap between spot and futures**, and the Greeks that gap generates (V88)
- **Standard-deviation rules**
- The system **watches the market 9:15→3:30 AND at the 4:00 settle**, and generates the range from that (V88)

### 16.5 How it is used

| Use | Rule | Source |
|---|---|---|
| **First filter of the day** | Price **on/near a support line → treat the day BULLISH**; on a resistance line → **BEARISH**; **in the MIDDLE of the six → NO VIEW, which is a valid third answer → move to the 920 button** | **V131** |
| **Week size / volatility / bias** | On the first day of a new expiry: **range top − range bottom = the week's expected travel**; compare **ATM IV** to last week's opening IV; **both levels higher than last week → bullish; both lower → bearish** | **V36** |
| **Big candles** | Produced **not by high IV but by a sharp JUMP in IV within the week**. Flat IV → gap-ups/downs with consolidation between | V36 |
| **Option writing** | **Write paired strikes at the SAME level number — L1 call against L1 put, or L2 against L2. NEVER mix L1 with L2.** Stop = the combined premium of both legs, squaring off only the losing side | V74, V83 |
| **Writing risk** | **Day-one volatility is the main risk. The further into the week, the more reliable the stop.** Do not chase the day-1/day-2 premium spikes | V83, V88, V89 |
| **Futures hedge** | At **RL1**: short the future + buy a call at the nearest strike. At **SL1**: buy the future + buy a put. **Max loss = the premium paid.** Wait for price to actually REACH L1 | V83 |
| **Positional stock entry** | **Trade the extremes only; open in the first 15 days of the month; if price runs past L1 to L2, AVERAGE, since L2 has the higher reversal probability.** Modest ambition: **1–2.5% is a full target** | V101 |
| **Expiry close** | **The market tends to close near whichever level is NEAREST to current price** — judged by how many points away against how many hours remain | **V119** |
| **Expiry return** | **Expect the close to come back INTO the weekly range.** A push above RL1 on expiry is expected to return | V131 |
| **Anchor in a crash** | On a heavy gap-down, price **rested exactly on** the Weekly Range support calculated the previous Tuesday. **Selling while standing ON weekly-range support is self-contradictory** | **V123** |
| **Combine with direction** | **The Greeks can read bullish while the Weekly Range POSITION says the move is nearly exhausted.** Also ask: **where is price COMING FROM** — one day ago, two days ago? | **V126** |
| **Eliminate the factor** | **If RL1 and SL1 are both far from price, the weekly range is not pulling the market — discard it as a factor for today** | **V92** |

### 16.6 The ±375 projection (V50)

**Take the expected expiry close; ADD 375 → next week's resistance; SUBTRACT 375 → next week's
support.** Said to be derived from Option Greeks; the derivation is not repeated.
**The video never says how often 375 is recalculated or how it scales with the index level.**
→ **OQ-17.**

### 16.7 The straddle projection (V118) — the better-specified alternative

```
1. On expiry day, open the NEXT expiry's chain (not the one settling).
2. straddle = ATM call LTP + ATM put LTP            e.g. 700 points
3. discount by time of day:
       before 12:00  → ×0.90
       after 12:00   → ×0.92–0.93
       after 14:00   → ×0.95                        700 → ~650
4. next RL1 = spot + that number ; next SL1 = spot − that number
5. COMPARE against the CURRENT week's RL1 / SL1.
```

**Decision rule:**
- **Next RL1 HIGHER than current → do NOT take a bearish cheap-option punt this expiry.**
- **Next SL1 HIGHER than current AND price near support → the BULLISH punt is the one worth taking.**
- **Distance matters: 400–500 points away has room to work; 1,500 points away does not.**

---

## 17. Writing / income strategies

### 17.1 Expiry-day short strangle (V81, V85)

**Structure:** sell one OTM call and one OTM put, **intraday, expiry day only**.
**Stop loss = the SUM of the two premiums. If EITHER leg alone reaches that figure, exit the whole trade.**
**Target: both legs to near zero — exit at 25 paise.**

**Three ways to pick the strikes:**

| Method | Call strike | Put strike | Combined stop |
|---|---|---|---|
| **1 — AI LTP** | nearest above **R Max Pain** (24,786 → 24,800 call ≈₹6) | nearest below **R Max Gain** (24,583 → 24,600 put ≈₹13) | **₹19** |
| **2 — 9:20 lines** | nearest **below UR+1** (24,765 → 24,750 call ≈₹15) | nearest **below EOS−1** (24,582 → 24,600 put ≈₹12) | **₹27** |
| **3 — weekly range + volume support** (called the riskiest; "a prediction") | the strike the weekly range points to (24,700 call ≈₹31) | the **nearest volume-based support** (24,650 put ≈₹20) | **₹51** |

**Trade-off:** further strikes collect least but are safest; nearer strikes collect more and are much
more likely to be stopped. **It is a bet on consolidation.**
**HARD RULE: strictly intraday. Never carried overnight — a gap means the stop cannot execute.**

### 17.2 The 9:20 writing strategy (V76)

**Precondition: click 920 at/after 9:21. All four lines present → trade. Lines missing on one side →
no trade created on that side.**
**Sell the call strike ABOVE UR+1. Sell the put strike BELOW US−1.**
**Stop = the combined premium. If one side hits it, square off THAT LEG ONLY and let the other decay.**
**Outcome ≈ no profit no loss. If neither is hit, exit both at 2:30 (3:30 on expiry day).**

### 17.3 The rolling strangle around the 9:20 lines (V107)

**Sell premium on both sides, ONE STRIKE beyond the upper and lower levels.**
**When the market runs one way, ROLL THE WINNING SIDE INWARDS** — buy back the far option you sold
and write a nearer one, **adding pressure in the direction the market is already moving.
LEAVE THE LOSING SIDE ALONE.**
Worked: sold a call ≈61 and a put ≈43; the market fell; the call dropped to 37 (+24) while the put
rose to 63 (−20) → net ≈+4; a second call was then written closer, adding a few more points.
**Described as a CONTINUOUS position, not scalping — nothing is squared off between adjustments.**

### 17.4 Range writing (V74, V83)

**Write paired strikes at the same range level on both sides. L1 = most aggressive, L2 safer,
L3 safest. Start from day one of the month so the whole month's time value works for you.
Treat L1 writing on individual STOCKS as only moderate risk**, since stocks move less than the indices.

---

## 18. Arbitrage (V101, V103)

**Structure:** **sell one futures lot and simultaneously buy the identical share quantity in cash.**
**Open in the first two or three days of the month. Close both legs when spot and futures converge**,
which happens naturally by expiry.
**Path: menu → Reports → LTP ARBITRAGE STOCKS**, which filters by the size of the spot–futures gap.
**Index contracts are excluded — individual stocks only.**

Examples: Aditya Birla Capital spot 278 / futures 280 / lot 3,100 → expected profit ≈**₹6,200** if
opened at the start of the month, ≈**₹78** near month end. SBI Card spot 928 / futures 937 →
≈₹7,100 on ≈₹8.7 lakh deployed, **flagged as an unusual gap probably caused by a large trade away
from the prevailing price.**

**Stated limitations:** gaps are usually tiny; they cannot be found by manual searching; **both legs
must be funded, so it needs substantial capital**; brokerage eats into it.
**"Cannot incur loss" overstates it** — the source files flag this.

---

## 19. Expiry-day logic

| Fact / method | Source |
|---|---|
| **On expiry day a premium is PURE INTRINSIC VALUE.** Call = spot − strike; put = strike − spot; everything on the wrong side expires at zero, and a premium never goes negative | V18, V68, V99, V105 |
| **Below the close, each 50-point step adds exactly 50 to the premium** | V68, V105 |
| **The SETTLEMENT price (~4:00 PM), not the 3:30 screen price, determines expiry value** — the screen showed 25,185 but settlement was 25,169 | **V99** |
| **IV must reach zero on expiry day**, because OTM options have only time value and it has to be extinguished | V58 |
| **Spot and futures are forced to CONVERGE at expiry, and that convergence drives IV to zero** | V58, V107 |
| **Weekly vs monthly:** spot and futures converge only on **MONTHLY** expiry, not weekly — which is why futures consolidation is rejected as a weekly-expiry predictor | **V119** |
| **Expiry-day OI is unreliable** — positions are unwinding. Discount it | V32 |
| **A margin rule roughly DOUBLES margin on expiry day** — carry double from the previous day or square off | V58 |
| **Expiry days resolve one of two ways:** the market dies inside the range, or it produces one sharp 100+ point move right at the end | V118 |
| **Hero-zero trades (buying a ₹5–₹10 premium) go to zero 8 times out of 10.** Substitute: after 12 noon, near a weekly-range level, **take the same view in FUTURES** | V118 |
| **Expiry close prediction:** only the **Weekly Range** method survives testing. Change-in-LTP, OI change, delta, futures convergence and historical data are each rejected, with reasons | **V119** |
| **Fin Nifty values are only trusted on expiry day** (volume too thin otherwise) | V14 |
| **Expiry cadence:** Nifty options every Tuesday (new position built Wednesday); Bank Nifty, Fin Nifty, Midcap Nifty and STOCK options on the last Tuesday of the month; futures on the last Tuesday | V98 |

### 19.1 ⚠ The last-hour time-value boundary (V118) — a technique that appears only once

> **Look at the TIME-VALUE column on the IN-THE-MONEY side of the chain (the app shades it GREY).
> Intrinsic value is irrelevant on the day contracts expire.**
>
> **A writer will sell wherever the most money is still lying, then the next-best strike, working
> outwards. WHERE TIME VALUE GOES TO NEAR ZERO OR NEGATIVE, NO WRITER WILL SHOW UP, because brokerage
> would eat the whole premium. THAT STRIKE MARKS A LEVEL THE MARKET WILL NOT BE SEEN PAST IN THE
> REMAINING TIME.**
>
> Worked: put-side time value turned negative around 23,150 → no put writer would arrive there → the
> market was unlikely to trade above it. On the call side money was still available five or six
> strikes out → call writers could keep pressing the market down.
>
> **SCOPE, stated firmly: expiry day only, last hour only, grey side of the chain only.**

---

## 20. Implied volatility — the gate on everything

| Rule | Source |
|---|---|
| **IV comes from the spot–futures gap.** Nifty spot 25,966 vs futures 26,040 = 70 points. **The wider the gap, the more volatile.** At expiry the two converge and the contract stops moving | V58, V107 |
| **Settled condition: call-side and put-side IV within ~1 POINT of each other** | **V104** |
| **Two warning conditions: (a) a large DIFFERENCE between the two sides; (b) a large MOVE in IV across the day** (11.73 → 14/15/16) | **V107** |
| **When IV swings: price-action patterns break, indicator trades that were working suddenly fail, and stops are hit on setups identical to earlier winners** | V107 |
| **Rising IV on BOTH sides makes the divergence levels untrustworthy.** Stable IV (9.6–9.9) → the levels reverse accurately | **V21** |
| **VERY LOW IV — 4/5/6/7 sustained for 10–15 days — signals a CONSOLIDATION PHASE. A jump to 8–10 marks the END of that phase** | **V107** |
| **Big candles come from a sharp JUMP in IV within the week, not from a high absolute level** | V36 |
| **Named high-IV events:** 4 June 2024 (election results), budget days, major data announcements | V107 |
| **Stock filter: IV around ATM should be ~20 and must not exceed ~25–28** | V35 |
| **Unbalanced IV makes premiums refuse to expand, futures stop tracking spot, AND SHIFTS THE REVERSAL PRICE LEVELS** | **V104** |
| **When IV collapses, a 35–40 point move can leave the buyer with nothing** — and **a ZERO-time-value strike does NOT behave like futures over a round trip** (time value is added on the way out and taken back on the way home) | **V72** |
| **Habit: note the IV each morning and check it a few times during the day** | V107 |

---

## 21. Strike selection — and the one real contradiction

### 21.1 The 50-point shortcut (V19)

> **A 50-point move in the index pushes a strike's premium to roughly whatever the ADJACENT strike's
> premium is right now.** Verified both ways with the OC box.
> **So a rough target needs no calculation — read down or up the chain in steps of the strike gap.**

### 21.2 The selection table (V19)

For each strike record: premium now, premium after +50, profit, premium after −50, loss.
In the worked example the profit on a 50-point move ran **13, 16, 20, 25, 27, 31, 38, 37, 38** moving
from far OTM towards deep ITM — **but the deepest ITM strikes lose 37–38 on the same move against.**
**Best pairing: the 19,450 call — about +38 up against about −31 down.**
**Choose on the profit-to-loss GAP, never on the largest profit alone.**
**OTM strikes give a small gain AND a small loss — the movement simply is not paid for.**

**V19's general rule: the best strike is usually the SECOND strike in from the imaginary line on the
IN-THE-MONEY side, occasionally the third — on both sides.**

### 21.3 ⚠ The contradiction

| File | Recommendation |
|---|---|
| **V19** | Second (sometimes third) strike in from the line, **on the ITM side** |
| **V107** | **For intraday INDEX trading, choose DEEP in-the-money strikes** — an ITM/ATM call captured ~30 of a 50-point move, one out ~26, further ~20, then ~15, while **a deep ITM call captured ~36 of 50**. **In STOCKS, stay AT the money — low volatility makes deep ITM a trap** |
| **V116** | **"Choose strikes NEAR the money rather than deep in the money"** — the 25,200 put was "far too deep in the money" and **deep-ITM options magnify the LOSS as much as the gain** |

→ **OQ-9.** The reconcilable reading is: *deep ITM for a short-hold directional index scalp where you
want maximum points per move and will exit fast; near-ATM when you may have to sit in the position.*
**But the corpus never says that.**

### 21.4 Delta as a split (V67, V107)

> **The total move for a ₹1 change in the index is ₹1, SPLIT ACROSS THE TWO SIDES.** Call side 60
> paise, put side 40 paise. **The strike price is the dividing line.**
> **The points "missing" from an OTM call go into reducing the put-side premium.**

*(Flagged in-source as a useful intuition rather than a formal definition — the real cause is delta
and gamma.)*

### 21.5 The zero-LTP filter

**Before buying a Call, check the ITM CALL LTP column; before a Put, the ITM PUT LTP column.**
**V12: any zero → skip. V35: one zero tolerable, more than one or two is dangerous; 37.1 is not a
zero.** → **OQ-10.** **It matters more in stocks, where many strikes carry no volume** (V12).

---

## 22. The session clock

Everything in the system is time-gated. Consolidated:

| Time | What happens |
|---|---|
| **Pre-open** | **Be NEUTRAL.** If you have already decided you are bullish or bearish, the market is not yours today (V121). He deliberately ignores overnight news, Gift Nifty and US markets to avoid recency bias (V121) — **though V103 uses Gift Nifty to anticipate the open. OQ-32** |
| **9:15** | First tick. **The lines on screen are still YESTERDAY's** (V58). **Volume starts from zero.** **Read the chain from the FIRST tick — starting at 9:30 can hide the shift that set the day's direction** (V25). **Gap detection: ±100 in the LTP-change column on both sides = a large gap; call green + put red = gap up; call red + put green = gap down** (V16) |
| **9:15 – 9:21** | The AI's analysis window (5–6 min). **Do not look at price in the first four minutes** (V121). **Wait ~5 minutes before classifying** (V39); **5–7 minutes before trusting the AI state** (V54, V55); **3–5 minutes** (V57) |
| **9:20** | The chain snapshot the 920 lines are computed from |
| **9:21** | **The four 920 lines appear and are FIXED for the day** |
| **9:25** | **LTP Blast publishes the stock levels. The report will not open before 9:25 or after 3:30** (V80). The C1/C2/P1/P2 lines are static from here |
| **9:25 – 9:30** | **Wait until now before reading the chain for the day** (V11, V12). **Volume has to build first** — on one day the levels only appeared from ~9:50 (V30) |
| **9:20 – 11:30** | **The window for initiating 920 trades** (V48, V117) |
| **before 10:30** | **Take only the FIRST trade of the morning** under the Chart-1.0 "promise" (V13) |
| **~11:30** | **After this, do not initiate 920 trades** (V117) |
| **first 2 hours** | **Trade only the first two hours of your session — the brain operates at full capacity for about two hours** (V119) |
| **2:30 PM** | **Close all option-chain positions. Take no new trades.** Repeated in V10, V11, V20, V28, V29, V48 |
| **after 2:30** | **The option chain stops being reliable** — square-offs and fresh positions distort it. "A green traffic signal stops meaning much when a school empties onto the road" (V11) |
| **3:30 PM** | Close. On **expiry day** the writing strategies hold to 3:30 (V76) |
| **~4:00 PM** | **Settlement price** — what actually determines expiry value (V99). **The weekly/monthly range is generated at/after the settle** (V88) |

**Backtest-derived time filters (V117), which sharpen the above:**
- **Midcap Nifty made its money between 9 and 11 and LOST after 12.**
- **Nifty was loss-making at 9 AM and at 12, and made its profits between 10 and 11.**
- **Trade duration is a live warning: Midcap winners resolved in 14–18 minutes; Nifty trades averaged
  61 minutes, and beyond that he treats the trade as likely lost.**

---

## 23. The one set of measured results in the whole corpus (V117)

**9:20 strategy, 1 January – 7 April, mechanical 50-point target and stop, no averaging:**

| Instrument | Result |
|---|---|
| **All symbols together** | **−466 points** |
| FinNifty | loss |
| Bank Nifty | **heavy loss** |
| **Midcap Nifty** | **+243** — 37 wins / 21 losses; longest win streak 8, loss streak 3 |
| **Nifty** | **+127** — 47 wins / 37 losses; 56% hit rate; risk-reward 1.84 |

**The filters that separated winners from losers:**

| Filter | Finding |
|---|---|
| **GAP WIDTH between the two extension lines — readable at 9:21, the fastest filter** | Midcap: **≤50 points → 37 wins / 14 losses. 51–100 points → NO WINNERS AT ALL.** Nifty: **gaps >100 points lost all twelve times** |
| **Time of day** | Midcap earns 9–11, loses after 12. Nifty loses at 9 and at 12, earns 10–11 |
| **Day of week** | Midcap best on Tuesday. **Nifty worst on Thursday**; Monday and Friday fine |
| **Expiry cycle** | Midcap earns on expiry day and the first day or two of a new cycle; **loses most five days before expiry**. **Nifty's strongest day is the one immediately AFTER expiry** |
| **Which line** | Midcap: **81% at EOS, 66% at EOR, 41% at EOS−1, 40% at EOR+1**. Nifty: **70% at EOR, 60% at EOS, 33% and 20% at the ±1 lines** |

**⚠ Two things to carry forward from this:**

1. **Win rate alone is not a selection criterion.** Nifty's extension-of-support trades **won 60% of
   the time and still lost 182 points overall**, because the wins were smaller than the losses.
2. **This backtest CONTRADICTS the published safe/risky mapping.** V48/V51/V61 make the **outer
   (+1/−1) lines the SAFE trades**; this data shows the outer lines have the **worst** hit rates
   (33–41% vs 60–81%). → **OQ-33.**

**And the separate stop-size backtest (V99), Nifty 1–25 September:**

| Target / stop | Trades | Win rate | Result |
|---|---|---|---|
| 10 / 10 (EOR & EOS only) | 19 | 26% | **−86** |
| 10 / 10 (all four) | — | — | **−70** |
| 20 / 20 | 28 | 50% | **+12** |
| **30 / 20** | 28 | **46%** | **+96** |
| 30 / 30 | 28 | 54% | **+93** |
| 50 / 30 | 28 | 36% | worse |

> **A 10-point stop was cutting trades that would have turned profitable. WIDENING THE STOP, NOT
> IMPROVING THE ENTRY, is what flipped the month from loss to profit. A 46% win rate produced the
> best result.**

---

## 24. What each output actually means — a reader's key

| Output | Meaning |
|---|---|
| **Red horizontal line on the chain** | The imaginary line = current spot, between two strikes |
| **Grey shading** | The OTM region on each side (above the line on calls, below on puts) |
| **Blue highlight** | Highest **volume** on that side (=100%) |
| **Pink highlight** | Highest **call OI** |
| **Green highlight** | Highest **put OI** |
| **Yellow highlight (5 shades)** | The qualifying **second-highest** (≥75%). Darker = pressing harder. **Fading = pressure releasing** |
| **Bold (not yellow)** | Another strike also ≥75% but not the strongest challenger — **do not read this one** |
| **A percentage beside a strike** | `second ÷ highest × 100` — how hard that side is pulling |
| **WTT / WTB / Strong** | The level's grade. **Only a first approximation of direction** |
| **"WTB to Strong" / "shifted from bottom to top"** | **The transition line — this is what actually tells you the pressure** |
| **An arrow** | **The NET PRESSURE**, used precisely because WTT/WTB can mean opposite things |
| **SOC + duration (1R/2R/3R) + colour** | State of Confusion; **red = the confusion is on the support side** |
| **Banner ("Nifty in Blood Bath")** | The COA 1.0 scenario. **Clicking it shows the REASON** |
| **"breakout" / "breakdown"** instead of a number | Sentinel from the reversal-price calc; becomes a *condition* in LTP Swing |
| **"NA" on the S values** | Blood bath — **no bullish trade exists** |
| **A grey line on the chart** | **Stale/vanished.** The trade it represented is no longer valid. Disappears on refresh |
| **An empty target field** | **Price has not yet reached the entry level** — the target line only appears then |
| **Fewer than 8 AI lines** | **Itself a signal** — see the scenario→line-set table |
| **Only 3 of 4 stock lines** | **Two values coincided → skip the stock** |
| **Star rating (LTP Swing)** | Quality of the positional setup. **0 or 1 only** |
| **Bullish / bearish risk (0–10)** | Per-side stock risk. **0 or 1 only** |
| **PV** | Expected move = **half the strike gap** |
| **Max Pain** | **STOP LOSS** (not the classical max-pain strike) |
| **Max Gain** | **TARGET** |

---

## 25. The complete decision flow

```
MORNING
  0. Be neutral. Form no view.
  1. W  → where is price inside the weekly/monthly range?
          on a support line → bullish bias
          on a resistance line → bearish bias
          in the middle → NO VIEW → go to step 2 without a bias
  2. Mark the outer range: support strike & one below; resistance strike & one above.   [V121]
  3. 9:21 → 920 lines. Check the GAP between the extensions.
          Nifty/Midcap only. Gap ≤50 pts is the good case; >100 pts historically loses. [V117]
          Any line missing? → that side is off for the day.
  4. 9:25 → LTP Blast for stocks (a separate, state-independent path).

DURING THE SESSION  (re-evaluated continuously)
  5. For each side, compute PRESSURE from its five-state history (not from a snapshot).
  6. Combine → SCENARIO. Check for SOC (1h / 2h test, other side must be strong).
  7. Scenario decides WHICH SIDE may be traded and WHICH LINES are drawn.
  8. Read the entry/stop/target off the line set:
          entry  = Risky or Moderate  (choose by how far you will sit from Max Pain)
          stop   = Max Pain on that side
          target = Max Gain on that side
  9. VETO GATES — any one of these kills the trade:
          · wrong side for the scenario
          · this line already touched today
          · stop > target
          · Max Pain missing, or sitting on the entry
          · entry == target
          · price outside every line
          · IV unbalanced (>~1 pt apart) or drifting hard
          · the scenario is about to expire (% running to 100)
          · fading a level that still shows yellow
 10. SWOT: six questions × four boxes. Compare against the other live setup.
 11. WAIT for price to reach the value. Never enter at the running price.
          Pre-compute the PREMIUM at that level and place a LIMIT order.

IN THE TRADE
 12. Watch the percentage:  supporting → hold (ignore contrary candles)
                            against    → exit, even at breakeven
 13. Watch Max Pain:  closer → stay        further → exit
                      grey/vanished → EXIT NOW
 14. Watch the scenario: changed against you → exit; do not wait to be proved right
 15. Average ONLY if the situation you entered on is still on screen,
     ONLY at the next full value, ONLY if you can fund it, ONLY if multi-lot.
 16. Book at divergences on the way to Max Gain, or hold to Max Gain. Exit at your stated value.

CLOSE
 17. 2:30 PM — flat. No new trades.
```

---

## 26. Scenarios and edge cases that must be handled

| Case | Behaviour |
|---|---|
| **Spot exactly ON a strike** | **The tool stops calculating; highlights vanish** (V08). Needs explicit handling |
| **Before ~9:25** | No volume → no levels. **The lines shown are yesterday's** |
| **A level shifts mid-trade** | The scenario is **cancelled** and a new one begins (V22). Re-evaluate everything |
| **Double shifting** (two shifts in the same direction) | **The move does NOT stop at EOS−1** — extend to EOS−2, then the next divergence (V22). Two bullish shifts = a **bull run** (V24) |
| **The disguised blood bath** | Resistance reads **strong** but only because it **migrated DOWN** from a higher strike, with support WTB. **Looks like scenario 4, is actually scenario 6** (V37) |
| **Double cross** | Volume moves one way while OI drifts the other. **Follow the VOLUME** (V28) |
| **Both sides in SOC** | **Movement dies.** No trade (V47) |
| **Consolidation (both levels moving toward each other)** | **No trade under COA 1.0** (V29). When both sides say "wait", **the day belongs to WRITING, not direction** (V92) |
| **Blood bath** | **No floor.** Price may run through 1–4 divergences. **Book progressively; do not predict the bottom** (V37) |
| **Market outside every line** | **Outside the tradeable range — take nothing** (V109) |
| **Price opens beyond a reversal** | **That line is missing.** At least two of four always appear (V117) |
| **Scheduled event (RBI, budget, results)** | **Suspend everything except the range.** Order flow, not structure, is moving price (V110) |
| **IV spike / imbalance** | **Levels untrustworthy.** Stand aside, or trade futures instead (V21, V104, V121) |
| **Very low IV for 10–15 days** | **Consolidation phase.** Buying premium earns nothing (V107, V72) |
| **Expiry day** | Separate rule set entirely (§19) |
| **Three-day / short week** | **Usually consolidates** (V80) |
| **Grey line appears** | Stale. **Refresh.** If it is your Max Pain, **exit** |
| **First candle already hit the stop or target (stocks)** | **Line eliminated** — unless the entry was never reachable in that candle (V71) |
| **C1 and P1 print the same value** | **Skip the stock** (V59) |
| **Only 3 stock lines** | **Two values coincided → skip** (V106) |
| **Thin option volume** | **Avoid the instrument.** Between two instruments with the same setup, **take the higher volume** (V69) |
| **Historical replay** | 2-minute steps, so fast shifts are invisible. **Very low volume figures = today's open; a large figure = you rewound into yesterday** (V39) |

---

## 27. Dependency map — what breaks what

```
reversal price (UNKNOWN FORMULA)
   ├── extensions (EOS, EOR)         ─┐
   ├── divergences                    │
   ├── EOR±n / EOS±n                  ├── ALL line sets
   ├── Max Pain (= extension ±2)      │   (Live / 920 / AI LTP / stock C-P)
   ├── Max Gain                       │
   └── HOI reversals (LTP Swing)     ─┘
        │
        └── the reversal-price GAP rule (a directional signal in its own right)

support / resistance location
   ├── needs: spot, strike ladder, per-strike volume + OI
   └── feeds: which strike each line is taken from

level grading (75% threshold)
   ├── needs: highest + second-highest on each side
   └── feeds: PRESSURE

PRESSURE (five states)
   ├── needs: THE LEVEL'S INTRADAY HISTORY  ← cannot be done from a snapshot
   └── feeds: SCENARIO

SCENARIO (COA 1.0)
   └── decides: which lines are drawn, which side may be traded

percentage (Game of Percentage)
   ├── needs: the has-the-shift-completed flag   ← or it inverts and is wrong
   └── feeds: confidence, hold/exit — NOT entries

weekly/monthly range
   ├── needs: OI per strike, Vega, IV, the Greeks, spot-futures gap, events, the 4pm settle
   └── independent of the intraday layers; used as the FIRST filter and as the expiry anchor

implied volatility
   └── GATES everything: when unbalanced or swinging, the reversal prices themselves shift
```

**Three consequences for any implementation:**

1. **Without the reversal-price formula, nothing below the top box exists.** → OQ-1.
2. **Pressure and the percentage both require persisted intraday history.** A stateless,
   snapshot-driven implementation will produce wrong labels — this is exactly the V25 failure mode
   ("scenario 1" when it is really "scenario 5 with the support already shifted").
3. **IV is not a display field. It is a gate.** When IV is unbalanced, the corpus says the levels
   themselves move and the whole output should be distrusted.

---

## 28. What the corpus itself says about when the method fails

Worth recording, because the speaker makes a virtue of it (V124: *"a genuine researcher tells you
where their method fails; an influencer only shows you the trades where it worked"*).

| Failure condition | Source |
|---|---|
| **In a bullish market standing at its top, he will NOT buy at the top.** The trade is only taken from the bottom. Taking it at the top repeatedly is where the loss comes from | **V124** |
| **Rising/unbalanced IV makes the levels unreliable** | V21, V104 |
| **After 2:30 PM the chain is distorted** | V11 |
| **Expiry-day OI is unreliable** | V32 |
| **Fin Nifty and Bank Nifty have too little volume to trust** (9:20 backtest: both lost) | V61, V117 |
| **The 920 gap filter:** gaps >100 points lost every time in Nifty | V117 |
| **COA 2.0 fails on the first hit, and fails at the S/R strike itself** | V31, V110 |
| **A second touch of a level is materially worse than the first** — derived from his own reviewed losses | V125 |
| **A correct entry, a correct average and a correct exit can still produce almost no money** (a session shown deliberately) | **V47** |
| **The live-demonstration failure:** the basic reversal-ladder method was shown **losing twice in a row** on stage before working on the third attempt, and the losses were left in | **V122** |
| **He got a public prediction wrong on stage** (predicted a close ≈23,315; the market ran ~600 points up) and said so on air | **V58** |
| **He stayed out of a trade his own tool called correctly**, holding for 23,050 while 23,134 was visible and worked | **V123** |
| **Scope limit, stated plainly: the research covers INTRADAY and WEEKLY horizons only.** He cannot forecast one, two, three or six months out | **V123** |

---

## 29. Where to go next (not yet — this is the "after understanding" list)

Not to be acted on at this stage. Recorded so it is not lost:

1. **Resolve OQ-1** (the reversal-price formula). Everything else is blocked on it. The most likely
   route is to reconstruct it from V18's theoretical bridge (peak time value) plus V124's exact input
   list, and validate against the worked examples scattered through the files.
2. **Resolve OQ-35** (arrow/orientation convention) before drawing a single pixel.
3. **Decide our own position on the contradictions** — particularly OQ-9 (strike depth), OQ-33
   (safe/risky vs the backtest), OQ-2 (volume vs OI reliability), and OQ-27 (hedge sizing).
4. **Note the architectural split we will need anyway:** the index path is **state-driven**; the
   stock path is **line-and-risk-driven and ignores the state entirely** (V71).
5. **Note what we already have in this repo that maps across:** the existing Option Chain section
   already gives per-strike volume, OI, IV and Greeks, and `PeakOiStore` already persists
   intraday-history-shaped data — which is exactly the shape the PRESSURE layer needs.
