# P57 — Chart indicators: VWAP, EMA, Supertrend (and Bollinger Bands for "etc")

**Asked by the user on 2026-09-26, mid-session:** "YOU ALSO HAVE TO ADD NEW INDICATORS 1. VWAP 2. EMA 3. SUPERTREND ETC".
**Locked by delegation** under the same instruction ("complete everything without stopping"). "ETC" is not defined, so
row 12 picks **one** extra overlay and boards the rest. Every GUESS row can be vetoed in one word.

The indicators live on the **underlying chart** (the candle strip and the Chart Style preview), next to P19's three SMA slots.
Option candles never read Chart Style (P19 row 22), and that stays true.

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | Where the math lives | A new leaf module `public/indicators.js` (pure, no DOM, no `window`), imported by `ucandles.js` and by the Node test. It gets a row in `STATIC` in the same commit (CLAUDE.md: a new public file 404s until it has one) | Testable from Node without a browser, the same as `smaSeries` should have been |
| 2 | The window | Every indicator runs over the **whole fetched window** (context days included), as P19's SMA does (row 12). Only the rendered session is drawn | A 20-period line at 09:15 needs the previous session's candles |
| 3 | **EMA** | Two slots. `α = 2 / (n + 1)`, seeded with the SMA of the first n closes (TradingView's `ta.ema`). Null before candle n. Period 2–200 | The standard definition. Two slots because there are already three SMA slots and a crossover needs two lines |
| 4 | **VWAP** | **Session-anchored**: it resets at each IST date's first candle. Typical price (h + l + c) / 3, weighted by the candle's volume, cumulative within the session. Null while the session's volume is 0 | TradingView's default anchor ("Session") and source (hlc3) |
| 5 | VWAP without volume | **NIFTY and other indices carry no volume** on Dhan's index candles, so VWAP is **not drawn** there, and the legend says `VWAP — no volume on an index`. No proxy volume (the future's) is borrowed | A VWAP weighted by another instrument's volume is a different indicator under the same name, and a silently wrong number is worse than a visible gap (project bar) |
| 6 | Volume in the payload | `/api/ucandles` candles gain `v` (the candle's volume, 0 when Dhan sends none). Replay already synthesises underlying volume | The server dropped it; VWAP cannot exist without it |
| 7 | **Supertrend** | ATR period **10**, multiplier **3** (TradingView defaults). ATR is Wilder's (RMA) of true range, seeded with the SMA of the first 10 TRs. Bands `hl2 ∓ m·ATR` ratchet: the lower band only rises while the previous close stays above it, the upper band only falls while the previous close stays below it. The trend flips up when the close crosses above the upper band and down when it crosses below the lower band. It is drawn as the active band, in the **up colour while up and the down colour while down**, with a break at each flip | `ta.supertrend(3, 10)`. Colours reuse the candle colours already on screen (P19 rows 16–18 keep them at ≥ 3:1) |
| 8 | Periods | EMA 2–200; Supertrend ATR 2–100, multiplier 0.5–10 in steps of 0.5; Bollinger 2–200, σ 0.5–5 in steps of 0.5. Out-of-range input snaps back, as P19's SMA input does | Same validation pattern as P19 |
| 9 | Defaults (**GUESS**) | **VWAP on, EMA 9 on, EMA 21 off, Supertrend (10, 3) on, Bollinger off.** SMA 20 stays as saved | The user asked to see these three. With all of them on, the screen would be two SMAs + two EMAs + BB = too many lines |
| 10 | Colours (**GUESS**) | VWAP `#38BDF8` (sky), EMA 9 `#F472B6` (pink), EMA 21 `#34D399` (emerald), Bollinger `#A1A1AA` (grey: bands 1px, basis dashed). They are distinct from P19's SMA colours (`#FACC15`, `#F5A524`, `#8B7CFF`) and from the up/down swatches' defaults | Each line must be identifiable by colour alone, since the legend names them |
| 11 | Legend | A second line under P19's OHLC readout (y = 25 px), in the `MONO` family at 10 px. It shows each active indicator's value at the hovered candle (else the last one in the window): `VWAP 23,410.20 · EMA 9 23,398.10 · ST ▲ 23,350.00 · BB 23,512 / 23,301`. Each name is in its line's colour | The readout already follows the hover. A line with no label is a guess about which line is which |
| 12 | "ETC" (**GUESS**) | **Bollinger Bands (20, 2)** only: an overlay on the same price axis, population σ (TradingView's `ta.stdev`). **RSI / MACD / volume need a separate pane** under the chart, which is its own layout phase, so they are boarded as **P58**, not built here | The one "etc" indicator that fits the existing single-pane chart without a layout change |
| 13 | Price range | Every drawn indicator value inside the time window joins the price auto-fit, as the SMAs do (P25) | Otherwise a Supertrend band sits off the plot on a trending day |
| 14 | Persistence | In P19's `chartStyle:v1` under a new `ind` field. An old saved style without it gets row 9's defaults. A malformed field falls back field by field (P19's `sanitize`) | No reset of the user's saved colours and SMAs |
| 15 | The dialog | A new "Indicators" section under "SMA Indicator", with the same switch-cell pattern (`role="switch"`, click or Space/Enter to toggle, number inputs that do not toggle). Supertrend and Bollinger cells span both columns (two inputs). The preview paints the draft; Save commits (P19 row 19) | No new interaction pattern |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | `npm run ind:test`: EMA, VWAP, ATR/Supertrend and Bollinger against **hand-worked** values on a short series and against a **second, independently written** implementation on 2,000 synthetic candles (0 mismatches beyond 1e-9). Plus: the VWAP resets at a date change, is null on zero volume, and the Supertrend flips on a hand-built reversal |
| AC2 | The replay chart draws VWAP, EMA 9 and Supertrend by default (SVG `data-ind` paths present) and the legend line names them with values. **Screenshot** |
| AC3 | The dialog toggles each indicator, edits EMA / Supertrend / Bollinger parameters, and Save repaints the strip. After a **reload** the choice persists. Esc still closes the dialog after a click on a new cell (CLAUDE.md, P19). **Screenshots**: the dialog, the strip with everything on |
| AC4 | An index (NIFTY live, where candles carry `v = 0`) draws no VWAP, and the legend says so. Replay NIFTY has synthetic volume, so this is tested on a candle series with `v = 0` in the unit test **and** by the browser check forcing zero volume through `window.__ucandles` |
| AC5 | Frame time: `drawCandleStrip` p95 over 120 frames with all indicators on stays under **8 ms** (CLAUDE.md: stated as p95, never max; measured with nothing else running) |
| AC6 | `/indicators.js` returns 200 from a freshly started server. tsc clean. The P19 / P25 browser suites that touch the candle strip still pass, or each red is explained |

## Out of scope
RSI, MACD, volume bars and any sub-pane (**P58**); indicators on option candles; alerts on crossovers; anchoring VWAP
anywhere but the session.
