# Underlying candles + Chart Style — v1 (P19)

Locked 2026-09-19 with one `go`. Source request (2026-09-19): "I need candles in the UI, the same
candles, red and green", followed by a reference image of a "Chart Style" dialog (Candle / Line
switch, background swatches, up / down candle swatches, SMA indicator slots, Save / Reset, a live
chart preview with a price axis and a last-price pill on a dotted background).

Rows marked **(guess)** had no value in the codebase or the reference behind them.

| # | Topic | Locked value | Why |
|---|---|---|---|
| 1 | What is charted | The main (underlying) chart strip draws OHLC candlesticks for all six chips. A **Candle \| Line** switch picks the mode; **Candle is the default**. Line is the P5 tick line, unchanged | The request. P5's line and its range buttons stay as they are |
| 2 | Source | `GET /api/ucandles?key=<id>&interval=<1\|5\|15>` -> `/v2/charts/intraday` on the underlying (`IDX_I`/`INDEX`, `NSE_EQ`/`EQUITY`, `MCX_COMM`/`FUTCOM`). Window 5 calendar days; **only the latest session is drawn**, the earlier days feed the SMAs. 400 on an unknown key or interval | P9's window and endpoint. A shut market still shows the last session. Live-probed 2026-09-19: `IDX_I`/`INDEX` and `NSE_EQ`/`EQUITY` both answer, epoch seconds, 75 candles per 5m session |
| 3 | Intervals | `1m / 5m / 15m`, default `5m`, `localStorage.ucandleInterval`. In Candle mode the header shows these instead of the `1m/5m/15m/All` window buttons | P9 row 4 |
| 4 | Live update | Re-fetch every **60 s** only while `session.openNow`, otherwise once. Each underlying tick updates the forming candle (`h = max`, `l = min`, `c = p`); a tick past `open + interval` opens a new candle aligned to the session's first open; a tick on a different IST date than `sessionDate` is ignored | P9 row 14 cadence; without the merge the last candle is up to 60 s stale |
| 5 | Replay | `replayUnderlyingCandles(key, interval, dates)` in `replay.ts`: seeded walk whose **last close equals `replayBasePrice(key)`**, so replay ticks continue it. 375-minute NSE sessions, 870-minute MCX. Nothing persisted | CLAUDE.md "anchor both ends"; no cache file means replay and live cannot share one |
| 6 | X scale | Time-scaled from the first drawn candle's open to the last one's open + interval, via `chart-tools` `X()/Y()`; a candle's centre is `t + iv/2` | P6 drawings are (time, price) and keep working unchanged |
| 7 | Candle geometry | Body `min(15, slot × 0.68)` px, 1px wick, min body 1px; one `<path>` per colour group | P9 `drawCandles()` |
| 8 | Price scale | Fit to visible highs/lows and visible SMA values, pad 8%, then `tools.applyZoom` (axis drag works). Labels at a nice step (1 / 2 / 2.5 / 5 × 10ⁿ), **≥ 28px apart (guess)**, 10px Geist Mono `--fg-faint` | P9's 8% pad |
| 9 | Grid | Chart body background: 1px dots at a **16px pitch (guess)** in `--grid-line`. No horizontal rules. Both modes | The reference image |
| 10 | Last-price pill | 18px pill on the axis, filled with the last candle's colour, 11px/600 mono | P9 / P5 behaviour; the reference |
| 11 | OHLC readout **(guess)** | Top-left of the plot: `O … H … L … C … ±chg (±%)`, 11px mono, the candle's colour; hovered candle, else the last one. Change is vs the previous candle's close. Crosshair snaps to candle closes | TradingView pattern. No volume shown |
| 12 | SMA | Three fixed slots: **SMA 9 `#FACC15` off, SMA 20 `#F5A524` on, SMA 50 `#8B7CFF` off**. Click toggles; period editable 2–200. 1.5px line. Drawn only where a full window exists; earlier days in the window count | The reference's three coloured lines |
| 13 | Chart Style dialog | Opened by a **Style** button (28px icon) in the chart header. `min(1040px, 100vw−48px)` × `min(640px, 100vh−96px)`, radius 28px, backdrop `rgba(0,0,0,.55)`. Left card 340px, radius 20px, `--bg-subtle`. Right: live full-size preview with the instrument label 22px, display name 13px muted, 40px round × button | The reference |
| 14 | Dialog controls | Title "Chart Style" 22px/600; subtitle "Chart Style overrides Layout and Light/Dark mode settings" 13px muted with a `?` tooltip; Candle \| Line segmented (44px pill); **Background**, **Candle up ↑**, **Candle down ↓**, **SMA Indicator**; **Save** (40px pill, `--fg-base` fill) and **Reset** (40px, `--bg-inset`). Only the 8-size scale | The reference, fitted to redesign-v2 row 7 |
| 15 | Background swatches | Theme (default, `--bg-panel`) · Graphite `#141414` · Indigo `#1B1A2E` · Forest `#0F1E17` · Navy `#0F172A` · Maroon `#231515` · Plum `#24142A` · `+` (colour picker). 28px circles, 2px selection ring | The reference's seven |
| 16 | Up swatches | Theme green `--up` (default) · Blue `#2F7BFF` · Violet `#8B5CF6` · Cyan `#22D3EE` · Lime `#A3E635` · White `#F4F4F5` · `+`. Candle glyph in a 32px circle | Red / green by default per the request |
| 17 | Down swatches | Theme red `--down` (default) · Pink `#F472B6` · Orange `#F97316` · Coral `#FB6F4F` · Yellow `#FACC15` · Grey `#A1A1AA` · `+` | The reference |
| 18 | Contrast guard | An up/down colour under **3:1** against the effective background is disabled ("too close to the background"); a custom one under 3:1 is refused inline. A custom background makes the chart area use the dark-theme text tokens | WCAG non-text minimum; White on the light theme would vanish |
| 19 | Save / Reset / close | Changes preview in the dialog only. **Save** applies to the strip and persists `localStorage['chartStyle:v1']`. **Reset** loads the defaults into the dialog (applied on Save). **× / Esc / backdrop** close and discard. The header's Candle \| Line switch saves at once | The reference |
| 20 | Motion / a11y | Open: opacity 0→1 + scale .98→1, 180ms `var(--ease)`; swatch hover 120ms; reduced motion respected. `role=dialog aria-modal`, focus trapped and returned to the Style button, swatch rows are radiogroups with arrow keys | P4 / existing `--ease` |
| 21 | States | `loading candles…` · `<server error> — retrying in 60 s` · `no candles for NIFTY 50 in the last 5 days`. Shut session: `session 18 Sep · market closed` beside the interval buttons | P9's states |
| 22 | Scope of style | Underlying chart only. **Option candles (P9) keep green/red + blue/yellow** | Blue there means "big player entering" |
| 23 | Strip height | Stays **112px** (P16). The dialog preview is the big view; the strip can be dragged taller | P16's ≥ 19 chain rows |
| 24 | Files | `src/server/ucandles.ts` (new), `replay.ts`, `index.ts`, `public/ucandles.js` (new leaf), `public/chart-style.js` (new leaf), `index.html`, `app.css`, `app.js`. 8 code files | Inside the ~8 rule |

## Amendments made during the build (2026-09-19)

Each one either fills a value the table left open or corrects a row that measurement proved wrong.

| # | Row | Amendment | Why |
|---|---|---|---|
| 25 | 6 | A candle's **centre sits at its open time**; the x range is `first open − iv/2` to `last open + iv/2` | chart-tools' crosshair prints the snapped point's time. With centres at `t + iv/2` it read 09:17:30 for the 09:15 candle, and fixing that inside chart-tools would have been a 9th file |
| 26 | 8 | Time labels on IST clock boundaries (5 / 15 / 30 / 60 / 120 / 240 min), the smallest step that keeps them **≥ 72px (guess)** apart, 10px mono | The row locked price labels only |
| 27 | 15, 18 | A custom background sets `data-chartbg="dark"` or `"light"` **by its luminance (> 0.4 = light)**, which swaps in that theme's existing text / up / down / grid tokens inside the chart. No new colour values: `#7A8597` measures 4.56–4.94:1 on all six dark swatches | Row 18 said "dark-theme tokens" only, which is wrong for a light colour picked with `+` |
| 28 | 21 | The session note (`session 18 Sep · market closed`, or the refresh error while candles are on screen) is drawn **in the plot's top-right**, 10px mono, not beside the interval buttons | Measured: the 198px note wrapped the strip header to 64px at 1024 wide. Without it the header is 28px |
| 29 | 15 | **Theme** background = the strip's existing `--bg-base`, not `--bg-panel` | `--bg-panel` would have changed P16's strip colour for every user who never opens the dialog |
| 30 | 13 | The Style button is **24px**, the same as `#chartBtn` | 28px made the header row taller than its 28px min-height |
| 31 | 16 | Candle swatches are **30px** | Eight 32px swatches plus the arrow column do not fit the 300px content width of a 340px card |
| 32 | 12 | The SMA grid's fourth cell reads "Click to show or hide · type a period, 2–200" | The reference has a `+` there; a fourth slot is out of scope, and an empty cell looked broken |
| 33 | 4 | A feed tick on a **later** IST date than the drawn session triggers a re-fetch, at most once per 60 s | A page opened while the market was shut has no 60 s timer (row 4), so on Monday's open it would otherwise keep Friday until reloaded |
| 34 | 20 | Re-rendering a swatch row hands focus to the rebuilt swatch, and the dialog owns the keyboard while open even if focus has left it | Found by the suite: after a swatch click focus fell to `<body>`, and Esc could no longer close the dialog |

## Out of scope
Volume bars, EMA / VWAP / other indicators, a fourth SMA slot, horizontal pan / zoom across days,
intervals other than 1 / 5 / 15, restyling the P9 option candles.

## Acceptance criteria
- [ ] Replay NIFTY: 5m / 1m / 15m show **75 / 375 / 25** candles = the payload's session count; every candle's body and wick pixels, recomputed from the payload OHLC through `X/Y`, match within 0.5px.
- [ ] Up-coloured body count = payload count of `c ≥ o`; down likewise.
- [ ] Last SMA 20 = hand mean of the last 20 closes (earlier days included) to 2 dp; its point at `Y(sma)` ±0.5px.
- [ ] Picking Blue for up changes the preview immediately and the strip not at all; after Save the strip's up fill is `#2F7BFF` and survives a reload; Esc discards; Reset restores defaults.
- [ ] With the light theme and the Theme background the White swatch is disabled; every enabled swatch is ≥ 3:1 against the effective background.
- [ ] `mergeTick` via the test seam: a tick inside the forming candle changes only its h/l/c; one past it opens a new candle; one on another date changes nothing.
- [ ] **Live:** `/api/ucandles` NIFTY 5m for the last session equals a direct Dhan intraday call on OHLC for every candle, by a second implementation.
- [ ] A P6 trendline drawn in Line mode renders in Candle mode at `X(t)/Y(p)`; P6, P10a, P10b, P2–P9, P9 and P16 suites still green (Line mode seeded where a suite assumes the tick chart, and recorded).
- [ ] Paint p95 < 8 ms at 375 candles + 3 SMAs; zero console errors over 60 s.
- [ ] Screenshots read: strip Candle dark + light, dialog default, dialog Blue/Red + Graphite, dialog at 1024×800, Line mode, error, empty. `docs/shots/` re-baselined once, one image opened.

## Risks
- The live forming-candle merge is only observable Mon 21 Sep from 09:15; until then it is tested through the seam and recorded as open.
- A 96px plot at 112px is tight; changing row 23 trades against P16's 19 chain rows.
