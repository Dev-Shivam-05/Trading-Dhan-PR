# SPEC LOCK — P29 LTP Calculator, layer 0 to layer 6

Status: **LOCKED** 2026-09-23 — approved by the user with `GO` on row 12 (OQ-1) and on the table.
Implemented in `src/server/ltp.ts` (pure engine), `/api/ltp`, and `public/ltp.js` (the third
workspace, `ws=ltp`). `npm run ltp:test` — 29 checks. Browser: `.cache/p29-ltp-ui.js` — 17 checks.

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table.

Source of every "why": `LTP-CALCULATOR/ANALYSIS/`, which reconstructs 163 transcript files.
`05-CONSOLIDATED-LOGIC.md` is the main document; `08-V2-DELTA.md` overrides parts of
`07-OPEN-QUESTIONS.md`. **Do not re-read the transcripts** — ~150k tokens to learn nothing new.

---

## What this phase is, and what it is not

The corpus describes ten layers (L0 raw chain → L10 trade management). This spec locks **L0 to L3
and L6** — the part that is a *reading of the chain at one instant*:

```
L0  raw chain (LTP, volume, OI) + spot + futures + strike ladder     <- locked here
L1  imaginary line -> the pair -> ATM by highest time value          <- locked here
L2  locate SUPPORT (put side) and RESISTANCE (call side)             <- locked here
L3  grade each level: built-on, challenger %, Strong / WTT / WTB     <- locked here
L4  PRESSURE (5 states)          <- NOT here: needs accumulated intraday history
L5  SCENARIO (COA 1.0, 9 cases) + SOC                                <- NOT here
L6  reversal price -> extensions, divergences, EOR/EOS ladder        <- locked here
L7  line sets (Live / 9:20 / AI LTP / stock C-P)                     <- NOT here
L8  scenario decides which lines are drawn                           <- NOT here
L9  filters and vetoes                                               <- NOT here
L10 entry / stop / target / management                               <- NOT here
```

L4 upward needs a **time series** the server does not yet keep, and it is where most of the
remaining open questions live. L0–L3 + L6 is a complete, useful screen on its own: the imaginary
line, the ATM, support and resistance located by the scan rule, each graded, and the reversal-price
ladder. It is also the foundation every later layer stands on, so getting it wrong is expensive and
getting it right is reusable. Later layers are boarded in `docs/PHASES.md` as P30+.

---

## What was undefined, and what this file does about it

Three things blocked this spec on the board. Two are now resolved **by reading**, not by guessing,
and one is reduced to a single question.

| Was | Now |
|---|---|
| **OQ-1** — the reversal-price formula is in no file | A **candidate**, tested against the corpus's own 17 worked pairs and against live Dhan data. Row 12. **Still needs your word.** |
| **OQ-35** — the arrow convention is stated two opposite ways | **Resolved.** All four sources agree once orientation is normalised. Row 5. |
| **OQ-33** — safe/risky contradicts the only backtest | **Reduced to a labelling decision.** Row 19. Recommendation given. |

---

## Decision table

### Terminology — the trap that would corrupt everything downstream

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | "Max Pain" and "Max Gain" | In this product **Max Pain = STOP LOSS** and **Max Gain = TARGET**. Neither carries its industry meaning. The identifiers in code are `stopLoss` and `target`; the strings `maxPain` / `maxGain` may appear **only** in the UI label and in one comment naming this row | Classical max pain is the strike minimising option-holder payout. Importing that produces a plausible number that is silently wrong everywhere. Naming the variables after the meaning, not the label, makes the mistake unrepeatable |
| 2 | "ATM" | **The strike carrying the highest TIME VALUE**, not the strike nearest spot (V18, V75). Exposed as `ltpAtm` and never as `atm`, because `derive.ts:124` already owns `atmStrike` = nearest spot and P23's spot window depends on it | Two different definitions of ATM in one codebase, sharing a name, is the same failure as row 1. The existing `atmStrike` must not change meaning — the option chain grid centres on it |
| 3 | "Support" / "Resistance" | Support is the **put**-side level, resistance is the **call**-side level, both located by the outward scan of row 8. A level is a **strike**, not a price | The corpus is consistent here across V05, V06, V43, V75, V98, V111 |
| 4 | "Reversal price" | A **price level** (an index/stock value), per strike, per side. Not a premium, not a strike | Every worked example compares it against spot: "support at 58,000 had a reversal price near 57,700 — price could drop roughly 300 points below the strike and the level would still be doing its job" (V111) |

### Orientation — OQ-35, resolved

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 5 | Which way is bullish | **Every rule, every stored value and every comparison is in STRIKE SPACE.** Higher strike = bullish = "towards the top of the chain". Lower strike = bearish. **No rule is ever written in screen terms.** The screen direction is derived at paint time from the grid's own ordering, in exactly one function, `screenDir(fromStrike, toStrike)` | This is what makes the four "contradictory" sources agree. §3.2 defines *top of the chain* = the **highest strike**, while the grid prints **smallest strike first**. So: V112 "an arrow from a smaller strike to a larger one is bullish" is strike space; V121 "an upward arrow means bearish" is screen space on a smallest-at-top display — up the screen is towards smaller strikes, which is bearish; V45 says so outright ("because strikes print smallest-at-top, a falling market appears to move the line UPWARD"); V13's "support drawn ABOVE" is support at a lower strike printing above. **All four are one fact.** OQ-35 is closed |
| 6 | Our grid's ordering | **Ascending, smallest strike at the top** — which is what `derive.ts:106` already does (`.sort((a, b) => a.strike - b.strike)`) and therefore the same orientation as every video. `screenDir` returns `'up'` for a move to a **smaller** strike | Codebase fact, not a preference. It also means an arrow drawn from this spec matches what the user has seen on screen in the source material |

### Inputs

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 7 | What the engine reads | Per strike per side: **LTP, volume, open interest** — the only three raw exchange fields (V51). Per instrument: **spot**, **futures**, the **strike ladder and its gap**, **lot size**, **current and next expiry**. Everything else (IV, Greeks, change in OI, intrinsic, time value) is **derived**, never read | V51 states it explicitly, and it matches what `/api/stream`'s snapshot already carries. **All S/R definitions are built on SPOT, never futures** (V17, V42) |
| 8 | Where they come from | The existing `ChainPoller` snapshot. **No new Dhan call.** The LTP Calculator is a second *reading* of the same payload the option chain already subscribes to | CLAUDE.md: a second Dhan call inside the poll loop is a cadence bug waiting to happen, and `dhanPost`'s gate is per key. A new poller for the same chain would double the load for nothing |

### L1 — the imaginary line and the pair

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 9 | The imaginary line | Sits **between the two adjacent strikes that bracket spot**. `lower = greatest strike < spot`, `upper = least strike > spot`. Those two are **the pair**. It re-seats whenever spot crosses out of the band (V01, V02) | Stated with three worked examples in V01 (19,553 → between 19,550 and 19,600) |
| 10 | Spot exactly on a strike | **The engine returns `null` and the screen says so in words.** It does not round, does not pick a side, and does not silently keep yesterday's pair | V08 names this: Tata Power at exactly 257.50 produced no output and the highlights vanished; at 257.25 it worked. The real tool degrades this way, and a silently-picked side is a wrong level with nothing on screen to say so — the exact failure this project's verification bar exists to prevent |
| 11 | `ltpAtm` (row 2) | Of the pair, the strike whose **call time value + put time value** is higher. Time value = `premium − intrinsic`; intrinsic is `max(0, spot − strike)` for calls and `max(0, strike − spot)` for puts, **never negative** (V99). Ties resolve to the **lower** strike and the tie is reported in the payload as `ltpAtmTie: true` | V18/V75 define ATM by highest time value and state that the same strike carries it on both sides — so summing the two sides is the reading that cannot disagree with itself. The tie flag exists because V75's refinement (OQ-26) is unresolved and a silent tiebreak would hide it |

### L6 — the reversal price. **OQ-1. This row is the one that needs your word.**

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 12 | The reversal-price formula | **`reversal(K, call) = K + callLTP(K)` and `reversal(K, put) = K − putLTP(K)`** — the writer's break-even at that strike. Implemented behind **one** function, `reversalPrice(strike, side, chainRow, greeks)`, which is the only place in the codebase that knows it, so replacing it is a one-function change | See the evidence block below. **This is a candidate, not a fact.** No file in the corpus gives a formula |

**The evidence, in full, because this row decides the product.**

`npm run oq1:test` — the candidate against the corpus's **17 worked (strike → reversal) pairs**:

- **Sign.** A premium cannot be negative, so the candidate forbids a call reversal below its strike
  and a put reversal above its strike. **16 of 17 obey.** The one exception is the Sensex passage,
  and **the source itself calls that reading inverted** — *"200 points BELOW, where it should have
  been ABOVE"* — and treats the inversion as the bearish signal. It is kept in the dataset and is
  **not scored as a pass**.
- **Parity — the test that could have falsified it.** Fitting a premium to one reversal price is
  trivial. Put-call parity is not, and the candidate never mentions it:
  `F = revCall + revPut − K`. On the three passages that give **both** sides and state the spot
  separately, the recovery lands at **+8, +12 and −6 points** (+3, +5, −2 basis points) of a number
  the candidate was never shown.
  **Note the recovery yields the FORWARD, not spot, so that residual is the carry and is expected
  to be small and usually positive** — which is the sign two of the three have. Measured live on
  2026-09-23: a 6-day NIFTY chain carries **+80.5 points (34 bp)** of basis, and an expired one
  carries **zero**. The first version of this check compared against spot and read a median
  deviation of 80.45 — not a data fault, the carry. It now tests the invariant that needs no
  external futures price at all: **every strike must imply the same forward**, `c − p + K`.
  Live, 13 strikes agree to **7.3 points** against a tolerance of one fifth of the strike step.
- **Expiry.** *"At expiry all reversal prices converge to intrinsic value"* (V-C:81). `npm run
  oq1:live` on the just-expired 22-Sep NIFTY chain: **every in-the-money reversal lands on spot**
  (23,328.4 – 23,329.6 against spot 23,329) and **every out-of-the-money one collapses onto its own
  strike**. Reproduced numerically, not argued.
- **What it eliminates.** That same expiry line rules out `reversal = strike` (no asymmetry),
  `strike ± a fixed offset` (does not vanish), and a **literal** reading of V18 — "the spot at which
  time value peaks" is *exactly the strike* for any Black-Scholes call or put, since `dTV/dS` is
  `delta` below the strike and `delta − 1` above it. V18's wording, taken literally, degenerates.
- **What it does NOT establish.** That the paid tool uses this. A break-even from the **market's**
  LTP and one from a **Black-Scholes theoretical** price differ by the spread and the smile — which
  is the most likely reason V124's input list carries delta, theta, vega, gamma, rho and IV at all.

**Your options, one word each:**

| | |
|---|---|
| **`go`** | Ship row 12 as written, using the market's own LTP. |
| **`theoretical`** | Same break-even, but priced from Black-Scholes using the chain's IV instead of the traded LTP. Costs a pricer; removes the stale-LTP exposure CLAUDE.md records on MCX. |
| **`api`** | The app you learned this from exposes the number — give me the endpoint or a screenshot of ten strikes and I will fit against it instead. |
| **`hold`** | Build L0–L3 only and leave every reversal-derived line out until this is settled. |

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 13 | Where the reversal price is used | Only through `reversalPrice()`. The **level's reach** is its reversal price, **not its strike**: price may travel to a support's reversal price and the level is still counted as holding (V111 — Bank Nifty support 58,000 with a reversal near 57,700 survived a low of 57,528) | V111 states it as a rule and gives two worked examples. It is also the single thing a trader reading only the highest OI gets wrong |
| 14 | Staleness | A reversal price is recomputed on every snapshot (3 s). It is expected to move **5–7 points, rarely more**, between reads (V10, V22); a jump beyond **3×** that is flagged in the payload as `reversalJump: true` rather than smoothed | V10/V22 give the number. Smoothing would hide exactly the event the flag exists to show, and CLAUDE.md's MCX finding — a chain `last_price` hours stale while the rest of the payload is live — is the failure mode this catches |

### L2 — locating the levels

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 15 | Resistance (call side) | Start at the **smaller** strike of the pair, scan **upward** on the call side. Find the strike with the highest **volume** and the strike with the highest **OI**. Different strikes → the one **closer to the imaginary line** is resistance. Same strike → that strike is resistance on both factors | V05, V06, V43, V75, V98, V111 — the most-repeated rule in the corpus. The direction is not arbitrary: the call side has already pushed the line up to that point, so only strikes still *ahead* can stop the move (V04, V06) |
| 16 | Support (put side) | The exact mirror: start at the **bigger** strike of the pair, scan **downward** on the put side, same tie-break | Stated as an exact mirror in §4.2 |
| 17 | In-the-money levels | An ITM strike **can** be the level — the rule is only ever "whichever you meet first" (V06) — **but support may never sit more than ONE strike in the money** (V111). A highlighted or high-percentage strike is **not** automatically the level: the scan-direction rule wins (V111, V112), and a deep-ITM highlight carries no meaning (V112) | V06 and V111 are in tension (OQ-6); V111's one-strike bound is the narrower claim and the only one stated as a limit, so it is the one that binds. The "highlight is not the level" rule has two worked counter-examples (BSE's 83%, Divi's 92% at 7,000 rejected for 6,800) |
| 18 | Persistence | A level formed at 9:15 **stays valid for the whole day even after price trades through it**, provided the largest OI at that strike has not unwound | V111, with Bank Nifty 58,000 holding its status all session while price fell through it |

### L3 — grading

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 19 | The percentage | `challenger ÷ level × 100`, where the **level** is the highest volume (or OI) on that side and the **challenger** is the second highest. **The threshold is 75%** | V23 gives the arithmetic directly (1.11 crore ÷ 1.35 crore → 82). 75% is stated in eight separate places (V75, V65, V110, V112, V59, V47), including a live case where 75% → 74.99% made the warning **disappear immediately**. `75` is a named constant, `CHALLENGE_PCT`, used everywhere |
| 20 | The three grades | **Strong** — no challenger ≥ 75%. **WTT** (weak towards top) — the qualifying challenger sits at a **higher** strike. **WTB** (weak towards bottom) — at a **lower** strike. Purely positional, identical on both sides (V07). Where several strikes are ≥ 75%, the **strongest qualifying one** is the reading (V112) | V07 defines them; V112 resolves the multi-challenger case |
| 21 | Single vs double factor | Single factor (volume **or** OI): whatever that factor is doing, the level is doing (V114). Double factor (both at one strike) is **deliberately asymmetric** — **resistance** turns WTB if **either** factor moves that way and WTT only if **both** do; **support** is the mirror. i.e. **the inward direction needs only one factor; the outward direction needs both** | V114 states the table; V08 states the same thing directionally and gives the worked case (Nifty support 19,500, OI challenger moving away, volume challenger moving towards the line → graded WTT). Where volume and OI disagree, **the market follows the volume** (V28) |
| 22 | Which factor leads | **Intraday: volume is primary.** OI is what writers are asking for; volume is what is actually executing, and a level is only real when execution agrees with writing (V105). Reliability ranking: volume+OI at one strike > volume only > OI only (V05) | V05's reason is structural and checkable: volume cannot fall during a session, OI can, which is why a chain has a *change in OI* column and never a *change in volume* column. **V43 contains an on-screen disagreement between the two hosts about volume-only levels (OQ-2); neither position is demonstrated, so V05's ranking — the one with a stated reason — is taken** |

### Where it lives

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 23 | The workspace | A **third** workspace beside Scanner and Option Chain, `ws=ltp`, on the existing 48px nav. It reuses the chip rail, the expiry select and the snapshot stream unchanged | P16 built the two-workspace shell; a third is a nav entry and a panel, not a rewrite |
| 24 | The server seam | One pure module, `src/server/ltp.ts`, exporting `readChain(snapshot) → LtpReading`. **No I/O, no clock, no `Date.now()`** — the session time is an argument, as P9's `nowMs` is | CLAUDE.md: any rule that reads the clock has an acceptance criterion that cannot be run outside 09:15–15:30 IST unless the clock is injected. Almost every session on this project is outside those hours |
| 25 | The test seam | `window.__ltp` exposes `reading() levels() pair() reversal(strike, side)` read-only, as `window.__chart` and `window.__grid` already do. Nothing in the app reads it | Without it, P23's rule was not measurable from outside at all — CLAUDE.md records exactly that |
| 26 | Serving it | Every new `public/*.js` and `*.css` gets a row in `STATIC` in `src/server/index.ts` **in the same commit that creates it** | The allow-list is not a static directory. A missing row 404s and the failure looks like the whole client dying |

---

## Acceptance criteria

Each is binary, and each is measurable **outside** market hours unless it says otherwise.

| # | Criterion | How it is measured |
|---|---|---|
| AC1 | The imaginary line brackets spot, and re-seats when spot crosses a strike | Replay: drive spot across a strike boundary; `pair` changes at the crossing and at no other tick |
| AC2 | Spot exactly on a strike returns `null` and says so | Unit: feed `spot === strike`; the reading is null, the screen shows the words, and no level is drawn |
| AC3 | `ltpAtm` is the higher-total-time-value strike of the pair, not the nearer one | Unit, on a fixture where they **differ** — if no such fixture exists the criterion is unmeasurable, not passed |
| AC4 | The reversal ladder obeys its sign rule on a live chain | `npm run oq1:live` — every call reversal ≥ its strike, every put reversal ≤ its strike |
| AC4b | Every strike implies the same forward | `npm run oq1:live` — `c − p + K` agrees across the near-ATM strikes to within a fifth of the strike step. Tested as a spread, never against spot: a constant offset **is** the basis and must not count against the chain |
| AC5 | The reversal ladder converges at expiry | `npm run oq1:live` on an expiring contract: ITM reversals land on spot, OTM on their own strike |
| AC6 | The corpus's 17 worked pairs still reproduce | `npm run oq1:test` — 5/5, with the Sensex counter-example still present and still not scored |
| AC7 | Resistance and support are found by the scan rule, not by the highlight | Fixture with the highest-volume strike **deep ITM** and a nearer qualifying strike: the nearer one wins. Both of V111/V112's counter-examples are in the fixture |
| AC8 | Support never sits more than one strike ITM | **Found while building: this bound is EMERGENT, not an independent filter.** The support scan starts at `pair.upper`, which is by definition the first strike ABOVE spot, so the deepest a put support can sit is that strike — at most one step ITM, and the rejection branch is unreachable through `locate()`. So it is tested as an invariant swept across 176 spot positions, not by a fixture engineered to reach a dead branch. The guard stays in `readChain` as defence-in-depth (an irregular ladder, or a pair supplied from elsewhere) |
| AC9 | 75% is a threshold, not a range | Fixture at 74.99% → Strong; at 75.00% → WTT or WTB. **Both** must be exercised: a fixture where nothing is ever rejected has not tested the filter |
| AC10 | The double-factor asymmetry is exercised in **all four** directions | Four fixtures: resistance-WTB-on-one, resistance-WTT-needs-both, support-WTT-on-one, support-WTB-needs-both. A fixture set that only shows agreement has not tested the asymmetry |
| AC11 | Orientation: no rule is written in screen terms | Grep — `screenDir` is the only function in `src/server/ltp.ts` or the LTP client that mentions up/down, and `src/server/ltp.ts` does not import it |
| AC12 | A reversal jump is flagged, not smoothed | Fixture with a >21-point step between snapshots: `reversalJump: true`, and the printed value is the new one |
| AC13 | The engine makes no Dhan call | Grep + a replay run: `src/server/ltp.ts` imports nothing from `dhan.ts`, and a 60 s run adds zero rows to the telemetry ring |
| AC14 | Every new static file is served | Each new `public/` file returns 200 from a freshly started server |

---

## Deviations from the corpus, declared

| Corpus says | We do | Why |
|---|---|---|
| The tool prints S/R at the top of the screen and you cross-check your manual read against it (V43, V98, V111, V112, V114) | We **are** the tool, so there is nothing to cross-check against. The screen shows **how** the level was found — which factor, which challenger, what percentage — so the read is auditable instead | This project's bar: a number that is silently wrong is worse than a visible error. Showing the derivation is the only cross-check available to us |
| Free tier is 5-minute delayed; live refreshes ~every 3 s (V10, V22, V75) | Our chain poll is **3 s**, rate-limited to 1 request / 3 s per (underlying, expiry) | Codebase fact. It happens to match the source tool's live cadence |
| The lines visible **at** the open are the previous day's (V58); at 9:19 the levels may not exist at all | We show **nothing** and say the session has not built enough data yet, until both sides have a non-zero volume | Carrying yesterday's line into today under today's label is the stale-value failure this project keeps finding. Volume resets to zero at 9:15 (V05, V43, V93, V107), so "enough data" is measurable rather than a guess |

---

## Still open after this spec — boarded, not forgotten

| | |
|---|---|
| **OQ-1** | Row 12. Needs one word. |
| **OQ-33** | Safe/risky. **Not in this phase** — it belongs to L10. The published mapping (V48/V51/V52/V61) calls the **outer** lines safe because the stop is close; V117's three-month backtest gives the **inner** lines 60–81% and the outer ones 20–41%, and instructs *"take the trade at the extension lines rather than the +1 and −1 lines"*. These reconcile — "safe" is about stop **size**, not hit **rate** — but the instruction flips. **Recommendation when L10 is specified: label both, default the entry to the inner lines per V117, and print the stop size so "safe" stays visible.** |
| **OQ-26** | Whether the imaginary line is the arithmetic midpoint or the highest-time-value point (V75's refinement). Row 11 reports the tie rather than hiding it, so this can be decided later from real data. |
| **OQ-2** | Volume-only vs OI-only strength. Row 22 takes V05's ranking because it is the only one with a stated reason; V43's on-screen disagreement is neither demonstrated nor resolved. |
| **OQ-6** | The ITM tension between V06, V08 and V111. Row 17 takes V111's one-strike bound as the binding one. |
| **OQ-30 / OQ-39 / OQ-35** | OQ-35 is **closed** by row 5. OQ-30 and OQ-39 need the *published* LTP Swing flowchart and belong to the positional phase. |
