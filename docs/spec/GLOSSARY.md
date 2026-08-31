# GLOSSARY

Terms that have a fixed meaning in this project. Do not redefine them in a later session — if a
term needs to change, change it here and say which spec row moved.

| Term | Fixed meaning | Fixed by |
|---|---|---|
| **plot area** | The tick chart's drawable rectangle: `x = 0 … W-76`, `y = 0 … H-16` in the SVG viewBox, where `PAD_R=76` is the price-axis gutter and `PAD_B=16` the time-label strip. Everything a user can draw on lives here. | `chart-tools-v1.md` rows 1, 17 |
| **price zoom** (`zoom`) | A multiplier on the *half-span* of the auto-fitted price range, applied about that range's midpoint. `1` = auto-fit as computed from the visible ticks. `>1` compresses (more price on screen), `<1` expands. Never an absolute price range. | `chart-tools-v1.md` rows 2, 3 |
| **anchor** | A drawing's stored position, always `{t: epochMs, p: price}` — never pixels. Pixels are derived per frame through `X()`/`Y()`, which is why drawings survive a scale drag, a range change and a reload. | `chart-tools-v1.md` row 15 |
| **scope key** | `draw:v1:<instrumentId>:<expiry>` — the localStorage key one set of drawings belongs to. Drawings never cross an instrument or an expiry. | `chart-tools-v1.md` row 22 |
| **one-shot tool** | A drawing tool that reverts to the cursor after a single completed shape. All four drawing tools are one-shot. | `chart-tools-v1.md` row 13 |
| **handle** | The r3.5 accent circle shown on a *selected* shape's anchors. Dragging a handle re-anchors that end. Dragging a shape's body is deliberately not implemented. | `chart-tools-v1.md` rows 18, 19 |
| **replay mode** | `REPLAY=1 npm run dev`. Synthetic Black-Scholes prices, no credentials, yellow banner, `REPLAY` badge. Expiry dates and the instrument master are still real. | `CLAUDE.md` |
| **F&O universe** | Exactly **210** NSE stocks — the `OPTSTK` underlyings from the instrument master with the 18 `NSETEST` dummy scrips dropped. Never "about 200", never a hardcoded list. | `scanner-v1.md` row 2 |
| **the funnel** | The scanner's four counts, always shown together: `210 -> 100 -> n -> m` (universe, top 50 gainers + top 50 losers, past the 2% LTP filter, past the 7% OI filter). A zero is only legible as a zero when the whole funnel is printed. | `scanner-v1.md` rows 1, 13 |
| **OI baseline** | The previous session's **closing** OI of a contract, taken as the `open_interest` of the last candle returned by `POST /v2/charts/intraday` with `"oi": true` for that session. Cached per `(securityId, sessionDate)`. Not `previous_oi` from the option chain — that is yesterday's close for options and is a different field on a different instrument. | `scanner-v1.md` row 7 |
| **long candidate / short candidate** | A scanner result from the gainer side / the loser side respectively. The two are always printed as separate counted sections, never merged into one list. | `scanner-v1.md` row 10 |
| **vibration** | Fixed to one number: a candle whose `volume >= 3.0 x median(volume of the previous 20 candles)`. The word carries no other meaning in this project. | `option-candles-v1.md` row 6 |
| **fired** | A closed candle that passes **both** the volume test and the OI test. `fired` alone does not say which colour — the sign of `dOI` does. | `option-candles-v1.md` rows 5, 8 |
| **entering / exiting a strike** | `dOI > 0` across a candle is a big player **entering** (blue, buy side); `dOI < 0` is **exiting** (yellow, sell side). `dOI` is always against the previous candle, never against the day's open. | `option-candles-v1.md` rows 7, 8 |
