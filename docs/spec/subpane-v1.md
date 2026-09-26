# P58 — A lower pane for RSI, MACD and volume (the rest of P57's "ETC")

**Locked 2026-09-26 by delegation.** The user asked for "VWAP, EMA, Supertrend ETC", and P57 row 12 boarded the
indicators that need their own scale. Every GUESS row can be vetoed in one word.

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | How many panes | **One** lower pane, showing **one** of: none (default), RSI, MACD, Volume. **GUESS** | The strip is 200 px by default (P22). Two stacked panes would leave the price plot under 100 px |
| 2 | Geometry | Inside the same SVG, **below the time-axis row**: `paneH = max(48, round(0.30 × H))`, with H the strip's SVG height. The candle renderer is handed `H − paneH`, so the price plot, its time labels, the drawings, the crosshair and the axis drag all stay in the top part, unchanged. The chart-tools overlays (`#chartSurface`, `#chartAxis`) get `bottom = 8 + paneH` px, so nothing can be drawn or dragged over the pane. With the pane off, **nothing about the strip changes** | Every existing criterion (P6, P19, P22, P25) keeps its geometry by default |
| 3 | **RSI** | Period 14 (2–100). Wilder: the first average gain/loss is the plain mean of the first n changes, then `(prev × (n − 1) + x) / n`. `RSI = 100 − 100 / (1 + gain / loss)`; 100 when the loss is 0. Fixed 0–100 scale, guides dashed at 70 and 30, faint at 50 | `ta.rsi`, TradingView's default |
| 4 | **MACD** | 12, 26, 9, fixed (**GUESS**: TradingView's defaults, with no inputs, to keep the chip row short). MACD = EMA12 − EMA26 (P57 row 3's EMA). Signal = the EMA 9 of MACD, seeded with the mean of its first 9 values. Histogram = MACD − signal, drawn as bars in the up/down colours. The scale is symmetric about 0: ±max\|value\| in the window | `ta.macd` |
| 5 | **Volume** | Bars in the candle's up/down colour at 60% opacity, scaled 0 → max in the window. With no volume, the pane reads "no volume" | P57 found Dhan's index candles carry volume |
| 6 | Pane legend | Top-left of the pane, 10 px `MONO`: `RSI 14 56.30`, `MACD 12,26,9 12.40 / 10.10 / 2.30`, `Vol 5,885`, at the hovered candle (else the last in the window) | P57 row 11's rule for the price legend |
| 7 | Settings | Four more chips after P57's, a radio group "Pane": `—`, `RSI` (with its period input), `MACD`, `Vol`. Stored in `chartStyle:v1` as `ind.pane = { kind, rsi }`, sanitised field by field | P57 row 15's chip bar |
| 8 | Window | The math runs over the whole fetched window; only the rendered session is drawn (P57 row 2) | |
| 9 | Code | `rsiSeries`, `macdSeries` in `public/indicators.js`; `renderPane()` in `public/ucandles.js`; app.js and the preview call it after `renderSvg` | |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | `npm run ind:test`: RSI and MACD by hand on a short series and against a second implementation on 2,000 candles, 0 mismatches. RSI is 100 on a series with no losses |
| AC2 | With each pane on: the price plot is `H − paneH` tall, the pane is drawn below the time labels, and the surface/axis overlays stop above it. A drag in the pane creates no drawing. **Screenshots** of RSI, MACD and Volume |
| AC3 | The pane's legend value equals the recomputed series at the last candle (RSI, MACD, volume) |
| AC4 | The choice persists across a reload; switching to `—` restores the full-height strip exactly (the frame's H is back to the SVG height) |
| AC5 | Paint p95 < 8 ms with the MACD pane and every P57 overlay on |
| AC6 | With the pane off (the default), P19 62/62, P25 44/44 and P57's own browser check still pass |

## Out of scope
More than one pane, resizing the pane by drag, per-pane crosshair values, and user-editable MACD parameters.

## Result (2026-09-26, built on `p58-subpane`)
- `npm run ind:test` **38/38**: RSI reproduces StockCharts' published Wilder example (19 values to 2 dp). RSI and MACD
  agree with second implementations over 2,000 candles, 0 mismatches. RSI is 100 with no losses, and a straight line
  gives MACD the constant lag difference (1.5 for 3/6).
- `.cache/p58-verify.js` **22/22**:
  - Each pane gives a frame of `H − paneH` (312 − 94), the overlays stop 102 px up, and the time labels sit above the pane.
  - Each pane's legend equals the recomputed series at the last candle.
  - A drag over the pane draws nothing, **and the same drag over the price plot draws a trendline**, so the check can
    fail.
  - The choice persists across a reload, `—` restores the full height exactly, and there are zero console errors.
- **AC5, frame time.** The first run read p95 3.9 ms. Three later runs read 9.0–10.2 ms, but at the same time the "nothing
  on" baseline read 8.1 ms, so the machine was busy (a research agent was running). On a quiet machine, the median of
  three runs per configuration, interleaved: nothing 2.5, P57 defaults 2.8, every overlay 2.9, **every overlay + MACD
  3.0 ms**. The pane and the overlays cost about 0.5 ms.
- AC6: with the pane off, P19 **62/62**, P25 **44/44** and P57 **20/20**.
- One fix came from the screenshots: the "Pane" label wrapped away from its chips. Label and chips now wrap as one unit.
