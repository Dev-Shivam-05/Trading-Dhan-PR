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
