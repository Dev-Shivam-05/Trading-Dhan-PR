# V2 delta — what the English re-extraction changes

## What KEY-POINTS-V2 actually is

**Not new videos.** `KEY-POINTS-V2/` holds `INDEX.md` + **35 video files**, and every one of them is a
video already covered in `KEY-POINTS/`. Its own header says why:

> These 35 videos were originally summarised from their **Hindi caption stream**. Their transcripts
> have since been **translated to English**, so the key points were rebuilt from the cleaner text.
> The first versions are kept unchanged in `..\KEY-POINTS\` for comparison.
> The other 92 videos were already in English and were not redone.

**So V2 is a higher-fidelity second pass over 35 of the 127.** It is not additional material.

| | V1 (`KEY-POINTS/`) | V2 (`KEY-POINTS-V2/`) |
|---|---|---|
| Files | 128 (127 videos + INDEX) | 36 (35 videos + INDEX) |
| Size | 866 KB / ~104,000 words | 224 KB / ~25,800 words |
| Source | Hindi ASR captions | **English translations of the same transcripts** |
| Videos covered | 00–132 (gaps at 34, 70, 95, 127–129) | **04, 41, 56, 58, 67, 68, 69, 71–94, 96–99** |

**Which files are re-cut, and why it matters:** the 35 include several of the most load-bearing files
in the whole corpus — **V75** (ATM by time value, WTT/WTB/SOC, the 75% threshold), **V79** and **V91**
(LTP Swing), **V80** (LTP Blast), **V83**/**V88**/**V89** (the weekly/monthly range), **V93** (the
second-highest-volume rule), **V98** (support/resistance definition), **V99** (the Greeks and the 9:20
backtest). V2 therefore has real authority over parts of `05-CONSOLIDATED-LOGIC.md`.

**Where V2 is silent, V1 stands.** The 92 videos not re-done — including the entire EP 01–EP 40 core
theory series (V01–V33), the Chart of Accuracy files (V13, V22, V24, V31, V37, V38), the state-of-
confusion files (V16, V27, V28), the AI-line spec (V54, V60, V100), the percentage files (V23, V109),
and the 9:20 backtest statistics (V117) — remain sourced only from the Hindi ASR pass.

---

## 1. Open questions V2 RESOLVES

### OQ-24 — free tier: live or delayed? **RESOLVED**
V1's V73 was internally contradictory. V2 separates the two things cleanly:

> "The tool was subscription-only until now. A free tier has been added that **serves delayed data**.
> The free tier includes the option chain and **live charts**; **the delay applies to the data feed**."

**Answer: the CHARTS run live (matched tick-for-tick against TradingView on screen — 24,964 / 24,961
/ 24,970 on both); the DATA FEED is delayed** (5 minutes, per V75/V80/V88). The two screens disagreeing
slightly on one strike's volume (27,35,000 vs 27,46,000) is the delay showing, not an error.

### OQ-25 — when is the weekly range generated? **RESOLVED**
The V1 files gave Thursday (V74), Tuesday (V88), and Tuesday 5:30 PM (V123). **V2's V98 explains it:**

> "Options expire on the Tuesday of each week for Nifty… **Nifty's weekly expiry used to be Thursday
> and has moved to Tuesday.**"

**It was never a contradiction — it is a real-world change that happened between recordings.**
V2 pins the rest:
- **"Calculated after Tuesday's expiry at 4:00 pm and then fixed for the week"** (V88).
- **"The week runs from the Wednesday after expiry"** (V88).
- Monthly ranges for stocks start **the day after the previous monthly expiry** (V74, V88).

**The rule should be written as "after the settle on expiry day", not tied to a weekday.**
V123's 5:30 PM remains the one unreconciled figure.

### OQ-28 — do Max Gain / Max Pain repeat across all four stock lines? **RESOLVED — NO**
V1's V80 carried the sentence *"Only Max Gain and Max Pain repeat across all four lines"*, which its
own worked example contradicted. **V2 drops that sentence entirely** and states the clean rule:

> "**Every line carries three values. The line's own number is the entry, Max Pain is the stop loss,
> and Max Gain is the target.**"

with all four Asian Paints lines carrying **different** stops and targets. V2 also notes the transcript
itself corrupts one figure (C1's Max Gain quoted as both 2543.50 and 2543.30).
**Answer: values are per line. The V1 sentence was an extraction artifact.**

### OQ-31 — LTP Swing bearish: "breakout" or "breakdown"? **RESOLVED — BREAKOUT**
V2's V79 is unambiguous:

> "The bearish version is the mirror image: bearish tab, status Strong or WTB, **call-side reversal
> showing a BREAKOUT** or equal to the current price, star rating 0 or 1, then sell in futures with
> the put-side reversal as target."

V2's V91 still says "break down" — but **V91's transcript is demonstrably the more damaged of the two**
(it also garbles the star-rating rule, which V2 flags in its own "Worth knowing"). **Use V79: breakout.**
This also restores the symmetry — bullish needs the *put* reversal in **breakdown**, bearish needs the
*call* reversal in **breakout**.

---

## 2. Open questions V2 NARROWS but does not close

### OQ-27 — hedge sizing (5–7% of the move vs 20% in the example vs 1% of price)
**The "5–7%" figure now appears in only ONE place.**

| File | V1 said | V2 says |
|---|---|---|
| **V79** | "premium costs roughly **5–7%** of that move" | **"buy an option whose premium is a small fraction of it"** — *no percentage at all* |
| **V83** | "the cheaper the hedging option relative to the distance to target, the better" | **"The premium paid should be small relative to the distance to target"** — no percentage |
| **V91** | "roughly **5% to 7%** of that difference" | **"about 5-7% of that difference"** — retained |

So **5–7% survives only in V91, the flowchart read-through.** V79's own worked example (REC: ₹10 on a
₹50 move = **20%**) is unchanged in V2, and V106 (not re-cut) uses a different denominator entirely
(**ATM premium ≈ 1% of the PRICE**).

**Working conclusion: the 5–7% is a property of the published flowchart and may be mis-transcribed.
The three examples that carry real numbers (REC ₹10/₹50, BEL ₹9.35 on a ₹34 move, SBI ₹8 on ₹905)
all sit near 20% of the move and near 1% of price.** Prefer V106's 1%-of-price test, which is the only
rule whose worked example matches it. Still needs the published flowchart to settle.

### OQ-23 — the unnamed mistake in V71 — **STRONG CANDIDATE NOW**
V2 corrects a number that changes the answer. V1 recorded *"ICICI Bank (risk 0) was preferred over
Bajaj Finserv (risk **1**)"*. **V2 says risk FOUR:**

> "When two open trades compete, take the one with the lower risk number. **ICICI Bank at risk zero was
> chosen over Bajaj Finserv at risk four.**"
> …and in the stock list: "**Bajaj Finserv** — target 2017.1, stop loss 2039.1, price 2032. Open trade
> but higher risk."

**A risk score of 4 fails the tool's own "0 or 1 only" rule outright.** Bajaj Finserv should never have
been on the list of five at all. **That is very likely the one mistake the teacher refused to name.**
Recorded as the leading hypothesis, not as fact — he still does not say.

V2 also adds the per-stock numbers V1 lacked: Tata Steel high **158.96** against a 158.2 target (and the
stop also touched); Piramal high **1330.3**; Reliance high **1478**; Sun Pharma skipped on bearish risk 2.

### OQ-35 — the arrow / orientation convention — **NEW EVIDENCE, SHARPER PROBLEM**
V2's V75 describes the same event V1 did, and the label does not fit the numbers:

> "Support changed at 10:40 am, **shifting from 25,000 to 24,900**, a **bottom-to-top shift**. Despite
> carrying a WTB label, the shift itself was bullish."

**25,000 → 24,900 is a move to a LOWER strike, yet it is called "bottom to top".** Both extractions
agree on the numbers independently, so this is not an ASR slip in one pass.

Three readings, and we cannot yet choose:
1. **"Top/bottom" in shift labels is SCREEN direction, not price direction** — on a chain printed
   smallest-strike-at-top, 25,000 → 24,900 moves *up the screen*. This matches V45's explicit display
   trap ("because strikes are printed smallest at the top, a falling market appears to move the line
   upward on screen") and would reconcile V121's "upward arrow means bearish" with V112's "an arrow
   from a smaller strike to a larger one is bullish".
2. The V2 extractor mislabelled it.
3. The direction of the shift is transcribed backwards in both passes.

**This now looks like the most likely explanation of OQ-35 — but it also means every "top"/"bottom"
label in the corpus may be screen-relative rather than price-relative, which would touch WTT, WTB,
"shifted bottom to top" and the five-state table.** Do not draw a single arrow until this is confirmed
against a video. **Severity raised from HIGH to BLOCKER-adjacent.**

*(Note the reading is still internally consistent either way: support moving to a lower strike is
"healthy shifting" under V05, and paired with resistance going WTB→Strong (bullish, V108) the day reads
bullish — which is what the session did.)*

---

## 3. New facts V2 adds that V1 did not have

### The 75% threshold is what TRIGGERS an SOC — V75
V1 had the 75% threshold and the SOC one-hour test as separate mechanisms. V2 connects them:

> "**SOC is triggered by the 75% threshold.** When the second open interest or volume passes 75% of the
> leader, the tool warns that it could take over at any moment. **Below 74.99% the warning clears.**"

**So: 75% crossing RAISES the SOC warning; the one-/two-hour test (V16, V27) is what CONFIRMS it; the
duration grading 1R/2R/3R (V112) is what is displayed.** That is a three-stage lifecycle, and it
partly answers **OQ-13** — V45's "stage two" is plausibly the warning-raised-but-not-yet-confirmed state.

### The line-set selector has FOUR modes, not three — V83
> "the line-set selector offers **Live, W, 9:20 and AI LTP**"

V1 (from V57) had three tabs: Live Lines, 920 Lines, AI LTP. **W (the range) is a fourth peer**, not a
separate control. Consistent with the W → 920 → AILTP reading order in V130/V131.

### The hedge direction, stated explicitly — V83
> "**buy a put if you are long futures, buy a call if you are short**"

V1 had this only implicitly from the worked examples.

### Averaging is REQUIRED past L1 on the futures-range trade — V83
> "buy futures at support L1, sell futures at resistance L1. **Above those levels, averaging is required.**"

### "WTB rarely appears" — V79
A frequency observation absent from V1. Relevant to how often the bearish LTP Swing branch can fire at all.

### The settlement worked example, completed — V99
V1 had "settlement 25,169 vs the 3:30 screen price 25,185". **V2 completes it:** the **25,150 call then
carried an LTP of roughly ₹19 — exactly settlement minus strike**, with all time value gone.
A clean, checkable proof of the expiry rule.

### The "both sides must guide" rule, stated cleanly — V93
> "**A move extends only when the call side and the put side are guiding the same way.**"
> "The second highest volume is highlighted in yellow **and only when it is actually guiding.
> If it is neither bold nor highlighted, it is giving no signal.**"

Sharper than V1's version of the same rule.

### L1 honesty — V89
> "**L1 fails roughly a third of the time, so size an L1 write accordingly rather than treating it as a
> certainty.**"

V1 reported the 65% figure without this framing.

### Eligibility checklist gains an item — V97
**"Do you own your home?"** is in the V2 list and absent from V1's.

### Corrections to names and numbers
| Item | V1 | V2 |
|---|---|---|
| Stock in the V88 monthly-range walk | Bank of **Baroda** | **Bank of India** |
| Bajaj Finserv risk (V71) | 1 | **4** |
| LTP Swing new-position window (V79) | first **10–15** days | **"roughly the first ten days"**, with 10–15 days to square off |
| SEBI figure (V56) | flagged as garbled | V2 states the transcript has profit/loss **swapped by translation**; the published study reading is 93% lost |

---

## 4. Where V2 is WORSE than V1, or introduces new doubt

### NEW — OQ-39: the LTP Swing star-rating rule is now ambiguous
V2's V91 says **"Star rating must NOT BE ZERO, and not more than one"** — i.e. it would *require* a
rating of exactly 1. V2's own "Worth knowing" flags the transcript as self-contradictory here
("at one point 'not zero or more than one', at another 'not more than zero and one'").
**V2's V79 says the opposite and is clean: "Star rating must be 0, or at most 1."**
**Use V79 (0 or 1 allowed). Confirm against the published flowchart.**

### V2 introduces an extraction error on V92
> "The transcript puts both the day's resistance and its support at 25,300, **which cannot both be
> right** — speech recognition has mangled at least one of them."

**That inference is wrong.** Support and resistance sitting on the *same strike* is an explicit,
taught case in this framework — V11 counts it as **−1 diversions**, and V12 and V23 both work whole
sessions around it. The V2 extractor did not have the framework and flagged a valid reading as damage.
**A reminder that both passes are summaries with their own failure modes, not ground truth.**

### V2 loses detail V1 had
V1's larger word budget kept material V2 drops. Examples: V75's five-shade yellow and the 57%/75.85%/83%
highlighting evidence; V80's LTP Blast path detail and the "even if you personally did not take the
trade" pairing clause; V71's Reliance first-candle-low nuance; V79's LIC Housing "skip the deep-ITM
100% OI strike, use the 88% strike" rule; V93's institutional 16–25% annual-return framing.
**Read V1 and V2 together for these 35. Neither supersedes the other outright.**

---

## 5. What this does NOT change

The core model in `05-CONSOLIDATED-LOGIC.md` survives V2 intact:

- **OQ-1 stands unresolved and still BLOCKER.** None of the 35 re-cut files gives the reversal-price
  formula. V75, V79, V83, V88, V91, V92 and V98 all reference reversal prices and none derives one.
  V2's V83 adds only that the speaker "describes reversal prices as his own innovation".
- The support/resistance scan rule (V98 V2) is **word-for-word the same** as V1's.
- The ATM-by-highest-time-value rule (V75 V2) is **unchanged**.
- The 75% threshold, WTT/WTB, Max Pain = stop loss, Max Gain = target, C1/C2/P1/P2 pairing, the
  9:20 static-at-9:21 lines, the 65/95/99 bands, the short-strangle combined-premium stop, and the
  V99 backtest table are all **confirmed verbatim**.
- **The V117 backtest (OQ-33, the safe/risky contradiction) is untouched** — V117 is not in the V2 set.

---

## 6. Running open-question status after V2

| Status | Items |
|---|---|
| **Resolved by V2** | OQ-24, OQ-25, OQ-28, OQ-31 |
| **Narrowed by V2** | OQ-13 (SOC lifecycle), OQ-23 (strong candidate), OQ-27 (5–7% isolated to V91) |
| **Made sharper / worse by V2** | **OQ-35** (arrow orientation — new evidence, now the second-most urgent item) |
| **New** | **OQ-39** (star rating: is 0 allowed or excluded?) |
| **Unchanged, still BLOCKER** | **OQ-1** (the reversal-price formula) |
| **Unchanged** | OQ-2, OQ-3, OQ-4, OQ-5, OQ-6, OQ-7, OQ-8, OQ-9, OQ-10, OQ-11, OQ-12, OQ-14, OQ-15, OQ-16, OQ-17, OQ-18, OQ-19, OQ-20, OQ-21, OQ-22, OQ-26, OQ-29, OQ-30, OQ-32, OQ-33, OQ-34, OQ-36, OQ-37, OQ-38 |

**Ranked list for whoever picks this up next:**
1. **OQ-1** — the reversal-price formula. Nothing can be built without it.
2. **OQ-35** — arrow / top-bottom orientation. V2 made this urgent; getting it backwards inverts every
   directional read on screen, and it may affect WTT/WTB and the five-state table too.
3. **OQ-33** — the safe/risky mapping vs the V117 backtest.
4. **OQ-27 / OQ-30 / OQ-39** — all three need the **published LTP Swing flowchart**, which we do not have.
