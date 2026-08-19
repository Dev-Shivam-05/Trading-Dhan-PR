# PRD — Dhan Option Chain Terminal (v1)

Owner: Shivam · Date: 2026-08-19 · Status: awaiting spec-lock approval
Companion docs: `docs/spec/dhan-api-contract.md`, `docs/spec/ui-contract.md`,
`docs/spec/option-chain-v1.md`, `docs/PHASES.md`

---

## 1. One line

A single-screen desktop web terminal that renders the full Dhan option chain — every strike,
both CE and PE, with OI, volume, IV and all four greeks — for six switchable underlyings, next
to a latency panel that shows exactly when each request left for Dhan, when the response came
back, and how long every stage in between took.

## 2. Why this exists

Two questions the current tooling cannot answer at the same time:

1. *What is the option chain doing right now?*
2. *How stale is what I am looking at, and where did the delay come from — Dhan, the network, or my own code?*

v1 answers both on one screen. It places no orders. It gives no advice.

## 3. Scope

### In scope
- Six underlyings, switchable by a single click, with live data: NIFTY 50, BANK NIFTY, SENSEX,
  RELIANCE, HDFCBANK, GOLD (MCX).
- Expiry selector per underlying, populated from Dhan's expiry-list API.
- Full option chain grid: every strike Dhan returns, CE columns mirrored against PE columns,
  strike price in the centre.
- Header strip: underlying name, spot, absolute and % change, ATM IV, IV change %, PCR,
  market lot, days to expiry.
- Latency and telemetry panel: per-request stage waterfall, rolling percentiles, rate-limit
  budget, error log, CSV/JSON export.
- Light and dark themes.

### Out of scope for v1 (explicitly not building)
- Order placement, positions, funds, or any write call to Dhan.
- Strategy builder, payoff diagrams, max-pain, OI charts over time.
- Historical playback or persistence beyond the current session.
- Mobile layout. Target is 1440px desktop; 1024px degrades gracefully, below that shows a
  "use a wider screen" state.
- Multi-user auth. This is a single-operator local tool.

## 4. Data contract — screenshot column, source, formula

Every column in the reference screenshot, and where its value actually comes from. `ce` / `pe`
refer to the Dhan option chain node for a given strike.

| # | Column (both sides) | Source | Formula |
|---|---|---|---|
| 1 | Strike Price | `oc` object key | `parseFloat(key)` |
| 2 | LTP | `last_price` | direct |
| 3 | LTP Change | `last_price`, `previous_close_price` | `abs = last_price - previous_close_price`; `pct = abs / previous_close_price * 100` — render `-107.10 (-20.03%)` |
| 4 | IV | `implied_volatility` | direct, 2 dp |
| 5 | Volume | `volume` | direct, Indian abbreviation |
| 6 | Vol Change% | `volume`, `previous_volume` | `(volume - previous_volume) / previous_volume * 100` |
| 7 | OI | `oi` | direct, Indian abbreviation |
| 8 | OI Change % | `oi`, `previous_oi` | `abs = oi - previous_oi`; `pct = abs / previous_oi * 100` — render `1.15 L (63.65%)` |
| 9 | Delta | `greeks.delta` | 2 dp |
| 10 | Gamma | `greeks.gamma` | 5 dp |
| 11 | Theta | `greeks.theta` | 2 dp |
| 12 | Vega | `greeks.vega` | 2 dp |

Header strip:

| Field | Source | Formula |
|---|---|---|
| Underlying name | instrument registry | static per chip |
| Spot | `data.last_price`, or WebSocket ticker between polls | direct |
| Spot change | spot, previous close of underlying (`/marketfeed/ohlc`) | `abs` and `pct` |
| **ATM strike** | derived | strike with `min(abs(strike - spot))` |
| **ATM IV** | derived | `(ce.implied_volatility + pe.implied_volatility) / 2` at the ATM strike. *Verified against the reference screenshot: spot 24,078.30 gives ATM 24,100, where CE IV 9.01 and PE IV 9.61 average to 9.31 — exactly the value Dhan displays.* |
| **IV Change %** | derived, session baseline | `(atmIV_now - atmIV_baseline) / atmIV_baseline * 100`, where the baseline is the first successful snapshot of the session for that (underlying, expiry). **This is an approximation** — Dhan returns no previous IV. The UI shows the baseline time on hover. |
| **PCR** | derived | `sum(pe.oi) / sum(ce.oi)` across every strike in the response, 2 dp |
| **Market Lot** | instrument master `SEM_LOT_UNITS` | for the option contracts of that underlying and expiry |
| **Days for Expiry** | derived | calendar days from today to the expiry date |

### Number formatting (locked)
- Indian abbreviation: below 1,000 raw; below 1e5 `K`; below 1e7 `L`; 1e7 and above `Cr`.
- 2 decimals, trailing zeros and trailing dot stripped: `51.09 K`, `2.98 L`, `16 Cr`.
- Prices and greeks: fixed decimals per the table above, `font-variant-numeric: tabular-nums`.
- Every derived percentage is `null` when its denominator is `0` or missing, and renders as an
  em dash, never as `Infinity`, `NaN`, or `0%`.

## 5. Three things that constrain the design

**5.1 Nothing on Dhan is 24x7.** MCX GOLD is the longest session available: 09:00 to 23:30 IST
Monday to Friday (23:55 in the US winter DST window), closed on weekends. There is no Dhan
instrument that trades round the clock. GOLD is therefore the "long session" chip — roughly
14.5 hours a day versus 6.25 for the equity chips — and the UI must have an explicit
`MARKET CLOSED — showing last snapshot at HH:MM:SS` state rather than pretending the numbers
are live.

**5.2 "Live" means 3 seconds, not real time.** The option chain API is rate limited to one
unique request every 3 seconds per (underlying, expiry). Greeks, OI and volume therefore refresh
on a 3000 ms cadence. Only the underlying spot is genuinely tick-live, via the WebSocket feed.
The UI states this honestly: a spot value carries a live pulse dot, chain values carry an age
counter.

**5.3 The access token cannot live in the browser.** Dhan requires `access-token` and `client-id`
headers, ties some operations to whitelisted IPs, and sends no CORS headers for browser origins.
v1 therefore ships a thin local backend. This is not architecture for its own sake — it is the
only place the credential can safely sit, and it also lets one poller serve one 3 s budget
instead of every open tab racing the rate limit.

## 6. Architecture

```
 browser (React + TS)                 local backend (Node 20 + Fastify)            Dhan
 --------------------                 ---------------------------------            ----
 OptionChainGrid   <-- SSE stream --  ChainPoller (one timer per active key) --> POST /v2/optionchain
 HeaderStrip                          DeriveEngine (section 4 formulas)             (1 req / 3 s)
 LatencyPanel      <-- SSE stream --  TelemetryBus (ring buffer, 500 samples)
 InstrumentChips   --  REST       ->  /api/instruments  /api/expiries          --> POST /v2/optionchain/expirylist
 SpotTicker        <-- SSE stream --  FeedClient (single WS, 6 instruments)     --> wss://api-feed.dhan.co
                                      InstrumentMaster (CSV cache, daily 08:00) --> images.dhan.co CSV
```

Rules:
- One `ChainPoller` per active `(underlying, expiry)` key. Switching chips **pauses** the old
  poller after a 30 s grace period instead of killing it, so a toggle back is instant.
- The poller schedules on a fixed 3000 ms interval measured from response completion, not from
  request start, so a slow response can never stack two in-flight requests.
- Backoff on `DH-904`: 3 s, 6 s, 12 s, 30 s cap, reset on first success.
- The backend never transforms away raw values. It sends both the raw Dhan node and the derived
  block, so the latency panel can prove what came from Dhan and what we computed.

### Stack (boring on purpose)
Vite + React 18 + TypeScript; Fastify; `undici` for HTTP with per-stage timing hooks; `ws` for
the feed; no UI kit, no chart library, no state library. Sparklines and the waterfall are
hand-drawn SVG. Rows are plain CSS grid — a 100-strike chain does not need virtualisation.

## 7. The latency panel

### 7.1 What is measured, per request

| Stage | Boundary | Where measured |
|---|---|---|
| `queued` | poller decides to fire | backend |
| `dispatched` | socket write begins | backend (`undici` diagnostics) |
| `ttfb` | first response byte | backend |
| `downloaded` | last response byte | backend |
| `parsed` | JSON parsed and section 4 derivations complete | backend |
| `pushed` | SSE frame written | backend |
| `received` | SSE frame arrives | browser |
| `painted` | grid committed, measured in the `requestAnimationFrame` after the React commit | browser |

Derived durations, all in milliseconds, all displayed:
`server = ttfb - dispatched`; `download = downloaded - ttfb`; `compute = parsed - downloaded`;
`transport = received - pushed`; `render = painted - received`;
**`round_trip = downloaded - dispatched`**; **`end_to_end = painted - queued`**.

Backend and browser clocks are never subtracted from each other except for `transport`, which is
labelled with a tilde in the UI because the two clocks are not synchronised. Everything else is
measured inside a single clock domain. This caveat is printed in the panel, not hidden in a doc.

### 7.2 What the panel shows

1. **Three live numbers**, 40px tabular: `ROUND TRIP` ms; `DATA AGE` s (now minus downloaded,
   ticking); `NEXT POLL` s (countdown).
2. **Stage waterfall** for the most recent call: one horizontal stacked bar, segment per stage,
   each labelled with its ms value, colour-coded by stage family (network / compute / render).
3. **Sparkline**, last 60 calls of `round_trip`, with a p50 line and a p95 line, endpoint dot
   emphasised.
4. **Percentile row**: p50 / p90 / p99 / max over the visible window, plus success rate.
5. **Rate-limit budget**: a 3 s ring that fills between calls. Green at or under the 3 s cadence,
   amber when a response lands after the next slot was due, red on `DH-904`.
6. **Call log**, last 20 rows: time, instrument, expiry, endpoint, HTTP status, Dhan `status`
   field, round trip, payload bytes, strike count, outcome. Row expands to the full stage table.
7. **Error ribbon**: Dhan error code and message, plain-language explanation, current backoff.
8. **Export**: copy or download the last 500 samples as CSV or JSON.

### 7.3 Latency acceptance thresholds
Not targets for Dhan — thresholds for our code, which is all we control:
`compute` at most 15 ms for a 100-strike chain; `render` at most 50 ms;
`end_to_end - round_trip` at most 80 ms. If our own overhead exceeds Dhan's round trip, the panel
says so in words.

## 8. UI specification

### 8.1 Layout, 1440x900 reference
```
+------------------------------------------------------------------------------+
| TOP BAR  56px   logo | connection pill | clock IST | theme toggle             |
+------------------------------------------------------------------------------+
| CHIP RAIL 52px  [NIFTY 50][BANK NIFTY][SENSEX][RELIANCE][HDFCBANK][GOLD]      |
+------------------------------------------------------------------------------+
| HEADER STRIP 96px  name + spot + change | ATM IV, IV Chg%, PCR, Lot,          |
|                    Days to Expiry | expiry select, search, refresh            |
+-----------------------------------------------+------------------------------+
| OPTION CHAIN GRID           flexible, scrolls  | LATENCY PANEL 380px, sticky  |
|  CE columns | STRIKE | PE columns              |                              |
+-----------------------------------------------+------------------------------+
```
The latency panel collapses to a 44px rail showing the round-trip number only; state persists in
`localStorage`.

### 8.2 Grid rules
- Column order, left to right, exactly mirroring the reference:
  `Vega Theta Gamma Delta OI OI-Chg Volume Vol-Chg% IV LTP-Chg LTP | STRIKE | LTP LTP-Chg IV Vol-Chg% Volume OI-Chg OI Delta Gamma Theta Vega`
- Strike column is sticky horizontally; the header row is sticky vertically.
- ITM shading: strikes below spot are tinted on the CE side, strikes above spot on the PE side,
  using `bg/inset` at 60% — a tint, never a border.
- The spot marker is a 2px dashed accent line drawn *between* the two strike rows that bracket
  spot, with the live spot price in a pill centred on the strike column.
- The ATM row carries a 3px accent left-edge stripe on the strike cell.
- OI intensity: the `OI` cell gets a horizontal bar behind the number, width proportional to
  `oi / max(oi across the chain on that side)`, at 12% opacity. This is the only heatmap; the
  rest of the grid stays quiet.
- Signed values are coloured by sign only (`up` / `down` tokens). Colour is never the sole
  carrier — every signed number keeps its plus or minus.
- Row height 30px, 12px monospace numerals, `tabular-nums` everywhere.
- Updated cells flash their background for 400 ms on change, opacity-only under
  `prefers-reduced-motion`.
- Keyboard: up/down move row, left/right move column group, `Home` jumps to ATM, `1`-`6` switch
  instrument, `E` opens expiry, `L` toggles the latency panel, `/` focuses search.

### 8.3 States
| State | Behaviour |
|---|---|
| First load | Skeleton grid with 21 shimmer rows, real column headers, no layout shift on data arrival |
| Live | Spot pulse dot, age counter green |
| Stale (over 6 s) | Age counter amber, grid drops to 85% opacity |
| Stale (over 15 s) | Age counter red, `STALE` chip in the header strip |
| Market closed | Grey `MARKET CLOSED` chip, `Showing last snapshot at HH:MM:SS`, polling stops; GOLD stays live if MCX is open |
| Rate limited | Amber throttle chip with the live backoff countdown, grid keeps last good data |
| Auth expired | Blocking re-auth banner, polling stops, expressive error state |
| Network error | Expressive error state inside the grid area only; top bar and chips stay usable |
| Empty chain | Expressive empty state: "No strikes came back for this expiry", with the expiry picker as the action |
| Below 1024px | Full-screen state: "Option chain needs a wider screen", plus the header strip numbers, which do fit |

Expressive states follow `docs/spec/ui-contract.md` section 3: inline SVG character, human
sentence, a real next action, and technical detail behind a collapsed `<details>`.

## 9. Acceptance criteria (binary — v1 is done when all pass)

**Data**
- [ ] Every strike present in the Dhan response is rendered; grid row count equals `Object.keys(oc).length`.
- [ ] All 12 columns render on both CE and PE sides with the decimals specified in section 4.
- [ ] ATM IV computed by the app equals `(ce.iv + pe.iv)/2` at the nearest strike, to 2 dp, checked against a captured fixture.
- [ ] PCR equals `sum(pe.oi) / sum(ce.oi)` over the full response, to 2 dp, checked against the same fixture.
- [ ] Market lot for NIFTY reads `65` from the instrument master, not a constant in code.
- [ ] A zero or missing denominator renders an em dash; no `NaN`, `Infinity` or `0%` appears anywhere.

**Instruments**
- [ ] All six chips load an expiry list and a chain, or the chip is disabled with a documented reason.
- [ ] Switching chips paints new data in 400 ms or less when the target chain is cached, and shows a skeleton otherwise.
- [ ] GOLD polls between 09:00 and 23:30 IST on weekdays and shows the closed state outside that window.

**Latency**
- [ ] Every request appears in the call log with all eight stage timestamps.
- [ ] The three live numbers update every 250 ms without re-rendering the grid (verified by React Profiler commit count).
- [ ] p50/p90/p99 match a hand-computed value over an exported CSV of the same window.
- [ ] The poller never issues two requests for the same key inside 3000 ms, proven by a 10-minute log with zero violations.
- [ ] A forced `DH-904` produces the amber throttle chip and the 3/6/12/30 s backoff, visible in the log.

**UI**
- [ ] Screenshots captured for: first load, live, stale, market closed, rate limited, auth expired, network error, empty, dark mode, 1024px.
- [ ] Zero layout shift when data replaces the skeleton (CLS = 0).
- [ ] Every interactive element has a visible 2px focus ring at 2px offset.
- [ ] Body text contrast at least 4.5:1, borders at least 3:1, in both themes.
- [ ] Full keyboard operation of chips, expiry select, search and panel toggle without a mouse.

**Security**
- [ ] `grep -rE "(access-token|DHAN_ACCESS_TOKEN|client-id)" dist/` over the built browser bundle returns nothing.
- [ ] `.env` is git-ignored; `.env.example` carries key names only.

## 10. Risks

| Risk | Impact | Cheapest way to find out |
|---|---|---|
| GOLD `UnderlyingScrip` cannot be resolved | GOLD chip dead; the long-session requirement fails | SPIKE-01 in `dhan-api-contract.md`, 30 min, before Phase 1 |
| Dhan returns no greeks for stock options | RELIANCE / HDFCBANK columns half empty | One live call each during Phase 1; if empty, render em dashes and label the columns "not provided for this segment" |
| 3 s cadence feels slow next to Dhan's own web terminal | Perceived as broken | Show the countdown ring and the age counter from day one so the cadence is legible, not mysterious |
| IV Change % baseline resets when the app restarts mid-session | Number differs from Dhan's | Persist the daily baseline to disk keyed by date, underlying and expiry; show the baseline time on hover |
| Token expiry mid-session | Silent stall | `DH-901` detection plus re-auth banner is a Phase 1 requirement, not polish |
| Instrument master changes lot size or ids on a roll day | Wrong lot displayed | Daily 08:00 IST refresh plus a startup assertion that all six chips resolve |

## 11. Phases

See `docs/PHASES.md`. Summary: P0 spike and backend skeleton; P1 chain fetch, derive engine, SSE;
P2 grid UI; P3 latency panel; P4 states, themes, keyboard, screenshots.
