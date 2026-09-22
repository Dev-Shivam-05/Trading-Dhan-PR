# Glossary and traceability

## Part 1 — Glossary

Almost every term below is **the speaker's own coinage**, not standard option-chain vocabulary.
Where a term collides with an industry term that means something else, that is marked **⚠ COLLISION**.

### Core geometry

| Term | Definition | First / best source |
|---|---|---|
| **Imaginary line** | The red horizontal line drawn between the two adjacent strikes that bracket the current **spot** price. Moves through the day. V75 refines: it is drawn using the **highest time value**. | V01, V02, V75 |
| **Pair of strike prices on the imaginary line** | The two strikes immediately above and below the line. The starting point for locating support and resistance. | V02 |
| **Top / Bottom** (of the chain) | Top = the **highest** strike. Bottom = the **lowest** strike. | V02 |
| **Movement towards top / bottom** | Market rising / falling. **Not** the same as "weak towards top/bottom". | V02 |
| **ATM** | ⚠ **COLLISION.** Here: **the strike carrying the HIGHEST TIME VALUE** — not the strike nearest spot. Only ever one. | V18, V75 |
| **ITM / OTM** | Strikes with / without intrinsic value. On the display, the **grey-shaded** region on each side is the OTM region. | V18, V42 |

### Levels

| Term | Definition | Source |
|---|---|---|
| **Support** | Scan the **put** side outward (downward) from the **HIGHER** strike of the pair. The first of highest-volume / highest-OI, **whichever is closer to the line**. | V05, V43, V75, V98 |
| **Resistance** | Scan the **call** side outward (upward) from the **SMALLER** strike of the pair. Same tie-break. | V06, V43, V75, V98 |
| **Single factor / Double factor** | Level built on volume alone or OI alone / on both at the same strike. Different grading rules. | V114 |
| **Challenger** | The **second-highest** volume (or OI) on that side. | V07 |
| **Strong** | No challenger at ≥75%. | V07, V112 |
| **WTT** — weak towards top | The qualifying challenger sits at a **HIGHER** strike than the level. | V07 |
| **WTB** — weak towards bottom | The qualifying challenger sits at a **LOWER** strike than the level. | V07 |
| **Shifting** | The **highest** volume/OI actually MOVING to a new strike. **Not the same as WTT/WTB.** Complete only when the volume gap between old and new strike closes to near zero. | V15, V21, V23 |
| **Double shifting** | Two shifts in the same direction in a row. Bearish → the fall does not stop at EOS−1. Bullish → a bull run. | V22, V24 |
| **Double cross** | Volume moves one way while OI drifts the other. **Follow the volume.** | V28 |
| **Pressure** | The net directional force of a level, derived from its **five-state history**. What the ARROW records. | V108, V112 |

### The five states (V108)

| State | Pressure |
|---|---|
| Stable Strong | Neutral |
| WTT → Strong | **Bearish** |
| WTB → Strong | **Bullish** |
| Shifted Bottom → Top | **Bullish** |
| Shifted Top → Bottom | **Bearish** |

### Prices and lines

| Term | Definition | Source |
|---|---|---|
| **LTP** | Last Traded Price. The origin of the product's name. | V46, V69, V103 |
| **Reversal price** | **The primitive.** Per strike, per side: the spot level at which the market is expected to turn at that strike. Derived from the Greeks + IV + both LTPs + spot + futures. **Formula never given.** | V111, V122, V124 |
| **"breakout" / "breakdown"** | **Sentinel values** returned instead of a number by the reversal calculation (call side / put side). Become *conditions* in LTP Swing. | V14, V79, V91 |
| **Extension of support (EOS / US / OS)** | The reversal price at the support strike, put side. | V10, V38 |
| **Extension of resistance (EOR / UR / OR)** | The reversal price at the resistance strike, call side. | V10, V38 |
| **EOS−1 / OS−1 / US−1** | Reversal price of the strike **one below** support. | V22, V38 |
| **EOR+1 / OR+1 / UR+1** | Reversal price of the strike **one above** resistance. | V22, V38 |
| **EOS−2 / EOR+2** | Two strikes out. **V114: extension ±2 IS the Max Pain line.** | V22, V114 |
| **Divergence / Diversion** | ⚠ **COLLISION** — nothing to do with indicator divergence. The reversal price at an **intermediate** strike between support and resistance. Count = (strikes between) + 1. | V09, V11 |
| **End of diversion** | The paired level of a diversion, in the six-reversal table. | V09 |
| **Extra divergence** | The outer boundary when both levels are strong — one strike beyond each extension. | V30 |
| **PV (point value)** | **Half the gap between two strike prices.** The expected move. | V106 |
| **Max Pain** | ⚠ **COLLISION.** Here: **the STOP LOSS line**. Derived as ~two strikes beyond the level. Not the classical max-pain strike. | V54, V60, V110, V114 |
| **Max Gain** | **The TARGET line.** | V54, V100 |
| **Risky line** | The entry **further** from Max Pain → **wider stop**. "Risky" = stop SIZE, not hit frequency. | V51, V52, V100 |
| **Moderate line** | The entry **nearer** Max Pain → **tighter stop**. | V51, V100 |
| **S / R prefix** | S = support side (green, bullish trades). R = resistance side (red, bearish trades). | V54 |
| **C1 / C2 / P1 / P2** | The four **stock** lines. C = buy (green), P = sell (red). C2/P2 are the outer pair. | V51, V63, V80 |
| **D1 / D2 / D3 ("Set D")** | Selectable divergence targets/stops. **Beginners take D1 only.** | V76, V108 |
| **HOI reversal** | "High-OI reversal" — the reversal price of the 100%-OI strike. Used as the target in LTP Swing. | V79, V91 |

### Scenarios and states

| Term | Definition | Source |
|---|---|---|
| **Chart of Accuracy 1.0 / Chart 1.0 / COA** | The nine-scenario framework built from support pressure × resistance pressure. | V13, V38, V112, V121 |
| **Chart of Accuracy 2.0** | A **separate** nine-scenario framework read off the **OI-change graph** (green = call OI, red = put OI). For stuck markets and second hits only. | V31, V110 |
| **Game of Percentage** | The percentage-direction framework. Two uses: resolving scenarios 8/9, and sizing confidence / deciding when to exit. | V23, V109 |
| **Bull run** | Both sides bullish. Calls only. Only the four S lines drawn. | V13, V100 |
| **Blood bath** | Both sides bearish. Puts only. Only the four R lines drawn; S values print "NA". | V37, V100, V58 |
| **Both sides risky (8 / 9)** | The two scenarios COA 1.0 cannot resolve alone. 8 = all eight lines; 9 = all eight minus both Moderates. | V54, V100 |
| **Neutral** | Price expected to touch both levels once, then the state resolves. | V66 |
| **State of Confusion (SOC)** | One side cannot settle on a strike for ≥1 hour **while the other side is strong**. **The market moves TOWARDS the confused side.** Graded 1R / 2R / 3R by duration. | V16, V27, V28, V112 |
| **Both-side SOC** | Both sides confused. **Movement dies.** | V47 |

### Screens, reports and controls

| Name | What it is | Source |
|---|---|---|
| **W / M buttons** | Weekly / monthly range (L1, L2, L3 each side). | V50, V83 |
| **920 button** | Draws the four static lines at 9:21. A **question-mark button** beside it opens the in-tool rule sheet / flow chart. | V48, V76, V77 |
| **AILTP toggle** | The AI line set + the market-state banner. | V54, V57 |
| **Live toggle** | EOR+1 / EOR / EOS / EOS−1 for the index; C1/C2/P1/P2 for stocks. | V58, V80 |
| **Spot button** | Switches the chain display from LTPs to **reversal prices** (V122); also makes premiums appear beside strikes (V81, V85). |
| **OC tab / premium projector** | Enter a spot level against a specific strike and side → returns the premium that option will carry there. | V17, V107 |
| **IVTV tab** | Splits every strike into intrinsic value and time value. | V18, V75 |
| **Compare** | Pick a second strike to compare against; returns the percentage. Runs on ~1.2 s delayed data. | V20, V23, V45 |
| **COA button** (saffron, top right) | Opens the Chart 1.0 nine-scenario screen. | V13 |
| **OI Change** | Opens the COA 2.0 two-line graph. | V31 |
| **LTP Blast** | Intraday **stock** report. Generated 9:25; only opens 9:25–3:30. **Show Nearest Stocks** narrows it. | V63, V80 |
| **LTP Swing / IDD Swing** | Positional (10–15 day) **stock** screener. Columns include Shifting Status, CMP, Put/Call HOI Reversal, OI, Star Rating. **Read More** opens the published flowchart. | V26, V79, V91 |
| **LTP Arbitrage Stocks** | Filters stocks by the size of the spot–futures gap. | V103 |
| **IDD Picks / IDD Dips / Rally Stocks** | The other three stock tools on the home screen (only IDD Picks is taught). | V35 |
| **History player** | Replays any past date tick by tick at 1×, 2×, 4×. **2-minute steps.** | V51, V52 |
| **Star rating** | LTP Swing setup quality. **0 or 1 only.** | V79, V91 |
| **Bullish / Bearish risk** | Per-side stock risk, scored 0–10. **0 or 1 only.** | V51, V63, V106 |

### Colour and highlight key

| Visual | Meaning | Source |
|---|---|---|
| **Blue** | Highest **volume** on that side (100%) | V06, V93, V98 |
| **Pink** | Highest **call OI** | V06, V98 |
| **Green (highlight)** | Highest **put OI** | V98 |
| **Green (line / indicator)** | Bullish pressure / bullish-side line | V123, V125 |
| **Red (line / indicator)** | Bearish pressure / bearish-side line | V123, V125 |
| **Yellow (5 shades)** | The qualifying second-highest (≥75%). Darker = harder pressure. **Fading = releasing.** | V07, V26, V33 |
| **Bold, not yellow** | Also ≥75% but not the strongest challenger — **do not read this one** | V112 |
| **Grey (line)** | **Stale / vanished.** Disappears on refresh. | V57, V65, V110 |
| **Grey (chain shading)** | The OTM region on each side | V42 |
| **Grey (expiry-day time-value column)** | The ITM side, where the last-hour writer boundary is read | V118 |
| **Flashing yellow** | A level that has just crossed 75% | V65 |

---

## Part 2 — Traceability matrix

Every substantive logic → the files that establish it. Bold = the primary/clearest source.

| Logic | Files |
|---|---|
| **Imaginary line — definition** | **V01**, V02, V42, V45, V75, V98, V122 |
| **Imaginary line — movement** | **V02**, V45 |
| **Imaginary line drawn by highest time value** | **V75** |
| **Spot-exactly-on-strike breaks the calculation** | **V08** |
| **All calculations built on SPOT, not futures** | **V17**, V42 |
| **Volume vs OI mechanics** | V03, **V43**, V93, V98, **V107** |
| **Volume never falls / resets daily; OI can fall / carries forward** | **V05**, V43, V107 |
| **Bid/ask are not trades** | **V98** |
| **Resistance definition** | **V06**, V43, V75, V98, V111 |
| **Support definition** | **V05**, V43, V75, V98, V111 |
| **Tie-break: closer to the imaginary line** | V05, V06, **V43**, V75, V98 |
| **ITM strikes can/cannot be the level** | V06, V08, **V111**, V112 |
| **Support persists after price trades through it** | **V111** |
| **Volume vs OI reliability ranking** | **V05**; contradicted in **V43** |
| **Volume for intraday, OI for positional** | V26, **V79**, V91, V105 |
| **Grading: strong / WTT / WTB** | **V07**, V75, V112 |
| **The 75% threshold** | V47, V59, **V65**, **V75**, V105, **V110**, **V112** |
| **The percentage formula (second ÷ highest)** | **V23** |
| **Second-highest / challenger concept** | **V07**, V20, **V93**, **V125** |
| **Second-highest volume guides direction** | **V93**, V125 |
| **Double-factor tie-break** | **V08**, **V114** |
| **Double cross — follow the volume** | **V28** |
| **The five states → pressure** | **V108**, V75, V112 |
| **Arrows record net pressure, not the label** | **V112**, V121 |
| **Pressure needs intraday history, not a snapshot** | **V25**, V39, V40, V108, V111, V112 |
| **Transition line ("WTB to Strong")** | **V75**, V112 |
| **Duration display as an instruction to rewind** | **V16**, V75 |
| **Shifting is a process; gap→zero test** | **V21**, V23, V16 |
| **Shift complete ≠ level strong; clock restarts** | **V29** |
| **Side that finishes shifting first gets priority** | **V29** |
| **Rule flip before vs after shifting** | **V16** |
| **Double shifting extends the target** | **V22**, V24 |
| **Six kinds of reversals (the trade table)** | **V09** |
| **Extensions / divergences — reading them off the chain** | **V10**, V11, V12, V38 |
| **Side-crossing rule (click put side for the call entry)** | **V12**, V17 |
| **Diversion counting rule (+1, and −1 for same-strike)** | **V11** |
| **Safe vs risky line mapping** | **V11**, V48, V51, V52 |
| **First touch vs second touch** | V10, V12, V20, V30, **V38**, V53, V100, **V125** |
| **The open itself counts as a touch** | **V20** |
| **Two rules agreeing fixes the day's floor** | **V20** |
| **COA 1.0 — the nine scenarios** | **V13**, V38, V108, **V112**, V121 |
| **Scenario 1 (both strong) in detail** | V10, **V38** |
| **Scenario 1 — the "late strength" variant** | **V39** |
| **Scenario 1 — the mirror variant** | **V40** |
| **Scenario 2 (support strong, resistance WTB)** | **V22** |
| **Scenario 3 (support strong, resistance WTT) + the ceiling rule** | **V15** |
| **Scenario 5 (support WTT, resistance strong) + the 60-min rule** | **V24**, V25 |
| **Scenario 6 — blood bath signature** | **V37**, V108 |
| **Scenarios 8 & 9 — the Game of Percentage** | **V23**, V109 |
| **The nine percentage combinations table** | **V23** |
| **Percentage direction logic (sides reversed)** | **V92**, V109 |
| **⚠ The post-shift INVERSION** | **V109** |
| **Percentage = confidence & holding, NOT entries** | **V109** |
| **Watch all four percentage figures** | **V109** |
| **Percentage-driven exits** | V15, V16, V24, V29, V47, V62, **V109** |
| **Two stop-loss styles (100% vs early %)** | **V62** |
| **State of Confusion — definition** | **V16**, V27, V28, V47 |
| **SOC — the two confirmation forms / 1h+1h** | **V27** |
| **SOC — direction rule (market moves towards the confused side)** | **V16**, **V27**, V28, V112 |
| **SOC — 1R / 2R / 3R grading** | **V112**, V75 |
| **SOC traded like bull run / blood bath** | **V100** |
| **SOC pauses rather than ends a bull run** | **V45** |
| **SOC ends → blocked pressure takes over** | **V112** |
| **Both-side SOC kills movement** | **V47** |
| **COA 2.0 — the nine OI-change scenarios** | **V31** |
| **COA 2.0 — not on the first hit** | **V31** |
| **COA 2.0 — useless AT the S/R strike itself** | **V110** |
| **Reversal price — "from the Greeks"** | V09, V47, V48, V50, V54, V65, **V111**, V122, **V124**, V131 |
| **Reversal price — the manual prototype input list** | **V124** |
| **Reversal price — theoretical bridge (peak time value)** | **V18** |
| **Reversal price — sentinel "breakout"/"breakdown"** | **V14**, V79, V91 |
| **Reversal price defines a level's REACH** | **V111** |
| **⚠ The reversal-price GAP rule** | **V126** |
| **Reversal-price asymmetry read** | **V72** |
| **PV = half the strike gap** | **V106** |
| **The 9:20 strategy — full rules** | **V48**, V49, V51, V52, V76, V77, V117 |
| **9:20 — stop loss off the opposite side ±10** | **V48**, **V49**, V52, V61 |
| **9:20 — target rule** | V48, V51, V52, **V61**, V117 |
| **9:20 — missing-line rule** | **V99**, V107, V117, V80, V61 |
| **9:20 — the writing strategy** | **V76** |
| **9:20 — Set D (D1/D2/D3)** | **V76**, V108 |
| **⚠ 9:20 — three months of backtest statistics** | **V117** |
| **9:20 — stop-size backtest (Sept)** | **V99** |
| **AI LTP — seven states, eight lines** | **V54**, V55, V57, **V100** |
| **AI LTP — scenario → line-set mapping** | **V100** |
| **AI LTP — where each line comes from** | **V110**, V114, V125, V55 |
| **Max Pain as the anchor; missing Max Pain = no trade** | **V60** |
| **Max Pain moving closer/further = stay/exit** | **V60**, V64 |
| **Grey line = vanished trade** | V57, V65, **V110** |
| **Ratio test (stop vs target)** | **V57**, V58, **V60** |
| **Risky lines only for the 3–6-month profitable** | **V60**, V59 |
| **Counter-trend only when the level shows no yellow** | **V100**, V105 |
| **Entry == target → no trade** | **V109**, V116 |
| **Max Pain on the entry → no trade** | **V66** |
| **Outside every line → no trade** | **V109** |
| **Never enter at the running price** | **V28**, V29, V64, V110 |
| **Pre-compute the premium; place a limit order** | **V17**, V107, V52 |
| **Limit orders, never market orders** | **V98** |
| **Stop loss must come from structure, not a point count** | **V111** |
| **Choosing entry by choosing your stop distance** | **V60**, **V108** |
| **⚠ Averaging — when it is legitimate** | **V116**; constrained in V11, V30, V48, V58 |
| **Exit on a state change (stop grew/shrank)** | **V64**, V60, V114 |
| **SWOT / the six questions** | **V64**, **V90** |
| **Confluence counts as added strength** | **V64** |
| **Distance-to-threshold as a risk measure** | **V65** |
| **Stock filters — the modern set** | V51, V52, V59, V61, **V63**, V71, **V80**, **V106** |
| **Stock filters — the older three rules** | **V35** |
| **Stock path ignores the market state** | **V71** |
| **Stock target = first divergence only** | **V35** |
| **Liquidity filter for stocks** | **V106**, V69 |
| **LTP Swing — the positional rule set** | V26, **V79**, **V91**, V101 |
| **LTP Swing — stop is a STATE, not a price** | **V101**, V79, V91 |
| **LTP Swing — the hedge (5–7%)** | **V79**, **V91** |
| **The 1% ATM hedge filter** | **V106** |
| **Empty bullish list = market-wide selling** | **V32** |
| **The OI-origin trap filter** | **V26** |
| **"OI moves, price follows"** | **V33** |
| **Colour intensity (darkening/fading)** | **V33**, V26 |
| **Weekly / monthly range — L1 L2 L3** | **V50**, **V74**, **V83**, V88, V89, V101, V118 |
| **Range is static, fixed at the settle** | **V88**, V83 |
| **Range inputs (Vega, IV, OI, events, spot-futures gap)** | **V83**, V88, V74 |
| **Range as the FIRST filter / three-way verdict** | **V131**, V130 |
| **Range: week size, IV comparison, bias** | **V36** |
| **Big candles from an IV JUMP** | **V36** |
| **Range writing (paired L1/L1, L2/L2)** | **V74**, **V83**, V88, V89 |
| **Futures + option hedge at L1** | **V83**, V106 |
| **±375 projection** | **V50** |
| **Straddle → next week's range** | **V118** |
| **Range as the expiry-close predictor** | **V119**, V131, V123 |
| **Weekly range as a crash anchor** | **V123** |
| **Discard the range when L1s are far away** | **V92** |
| **Combine range position with direction; where is price coming from** | **V126** |
| **Short strangle — three strike-selection methods** | **V81**, V85 |
| **Rolling strangle around the 9:20 lines** | **V107** |
| **Cash-futures arbitrage** | **V101**, **V103** |
| **Expiry — premium = pure intrinsic value** | **V18**, V68, V99, V105 |
| **Expiry — settlement price ≠ 3:30 screen price** | **V99** |
| **Expiry — IV must reach zero; spot/futures converge** | **V58**, V107 |
| **Weekly vs monthly convergence** | **V119** |
| **Expiry — the last-hour time-value boundary** | **V118** |
| **Expiry — hero-zero trades / futures substitute** | **V118** |
| **Expiry — margin doubling** | **V58** |
| **Expiry cadence (Tuesday)** | **V98** |
| **IV gate — stable vs rising** | **V21**, **V104**, **V107** |
| **IV — the ~1-point balance test** | **V104**, V123 |
| **IV — low IV = consolidation phase** | **V107** |
| **IV — stock ceiling ~20, max 25–28** | **V35** |
| **IV collapse: a 40-point move pays nothing; zero-TV strike traps** | **V72**, V87 |
| **Intrinsic / time value; ATM by time value** | **V18**, V75, V99 |
| **Strike selection — the 50-point shortcut and the table** | **V19** |
| **Strike selection — deep ITM for index intraday** | **V107** |
| **Strike selection — near ATM** | **V116**, V107 (stocks) |
| **Delta as a split across the two sides** | **V67**, V107 |
| **Zero-LTP filter** | **V12**, **V35** |
| **Round trip leaves the option worth less** | **V87**, V72 |
| **Session clock / 2:30 rule** | V10, **V11**, V20, V28, V29, V48 |
| **Read from the FIRST TICK** | **V25**, V28, V37 |
| **Gap detection at the open** | **V16** |
| **Morning enumeration drill** | **V121** |
| **Read big → small (W → 920 → AILTP)** | **V130**, **V131** |
| **Be neutral pre-open** | **V121**, V58, V131 |
| **Options as insurance** | **V46**, **V68**, V105 |
| **Cheap premium = larger real risk** | **V105** |
| **Naked trade / naked buying** | **V46**, V105 |
| **Instrument choice by volume** | **V69** |
| **Gift Nifty as an opening clue** | **V103**; contradicted in **V121** |
| **When the method fails (the speaker's own list)** | **V124**, V125, V47, V122, V123, V117 |

---

## Part 3 — Coverage check

All 127 video files were read in full. Files that contain **no** LTP-Calculator logic and are recorded
only for completeness:

**V00** (series announcement), **V56** (zero-sum essay), **V78** (property tax), **V84** (investor vs
entrepreneur), **V86** (29-second teaser), **V94** and **V96** (challenge promos), **V97** (suitability
checklist — conceptual only), **V102** (third-party terminal review), **V120** (mutual-fund macro talk),
**V132** (podcast; three market-structure facts kept).

Partially non-core (a promo or off-topic block inside an otherwise useful file), noted in place:
**V12, V20, V21, V26, V29, V31, V36, V37, V38, V39, V40, V43, V44, V48, V49, V62, V101, V103**.

Source numbering gaps (absent from the folder): **VIDEO-34, 70, 95, 127, 128, 129**.
The series header says "of 133"; 127 files are present.
