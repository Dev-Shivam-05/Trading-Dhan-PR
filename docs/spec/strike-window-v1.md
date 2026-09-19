# ATM ±8 strike window + option chart window — v1 (P20)

Locked 2026-09-19 with one `go`. Source request (2026-09-19, after P19): "I do not need all the
strike prices. I just need 8 strike prices from up and 8 from down … I do not need data more than
that in the UI", and "the NIFTY 50 chart is mandatory to view, we can manually minimize it, but when
clicking on a certain strike price CE or PE … a small window type, small box, where the chart of it
must be visible, no extra option chain in that".

Supersedes: P2's "row count equals the response strike count", P10a's "zero `.hidden` rows" and
"no ATM window" invariant, and P9 rows 1, 2 and 17 (a CE/PE click switched the chart strip into
option mode and disabled the drawing tools). The user asked for exactly this reversal.

| # | Topic | Locked value | Why |
|---|---|---|---|
| 1 | Strikes shown | **ATM row + 8 below + 8 above = 17 rows.** Rows outside are not rendered at all. NIFTY at ATM 24,000 → 23,600 … 24,400 | The request |
| 2 | ATM | The snapshot's `atmStrike` (nearest strike to spot, `derive.ts`), the same number the instrument bar prints as ATM. No ATM (no spot) → all rows | One definition on screen |
| 3 | Re-centring | On every snapshot (3 s). Ticks between snapshots do not move rows | Rows moving at 10 Hz are unreadable |
| 4 | Chain edge | Fewer than 8 on a side → show what exists; no padding from the other side | Never invent rows |
| 5 | Row label | Filter chip always reads `ATM ±8 · 17 of 236 strikes` (count = rendered, visible rows) | A short list must read as a filter |
| 6 | Strike search | Searches the **full** chain | An explicit lookup |
| 7 | Breached filter | Inside the window only | "No data more than that" |
| 8 | Server | Unchanged. P7's backfill already orders contracts nearest-ATM first (`peakoi.ts` `track`) | UI-only |
| 9 | NIFTY chart | Always on screen; a CE/PE click never replaces it. ▾ / `C` still collapse it by hand | The request |
| 10 | CE / PE click | Opens a **floating window** with that contract's P9 candles (green/red + blue/yellow, 1m/5m/15m, tooltip). No option chain inside | The request |
| 11 | Window size / place **(guess)** | 560 × 340 px, bottom-right of the chain pane, 16px inset. `min(560px, 100vw − 32px)` wide | Covers far-OTM PE columns, not ATM |
| 12 | Window behaviour **(guess)** | Drag by the title bar; resize from the corner (min 360 × 240); position and size persisted (`localStorage.optWin`), clamped into the viewport. One window: another click replaces the content | "A small box" |
| 13 | Header | `NIFTY 24,100 CE · 22 Sep` · `75 × 5m · 1 blue · 0 yellow` · 1m/5m/15m · × | P9's header |
| 14 | Close | × or Esc; an instrument or expiry switch closes it; the picked half-row keeps its outline while open. Hidden while the Scanner workspace is showing | P9's rules |
| 15 | Drawing tools | Stay enabled on the NIFTY chart while the window is open | The strip is no longer taken over |
| 16 | Files | `public/app.js`, `public/candles.js`, `public/index.html`, `public/app.css`. 4 code files | Inside the ~8 rule |

## Build notes (2026-09-19)

- **Row 11's "why" was wrong on screen.** With only 17 rows there are no far-OTM rows for the window
  to sit over: at 560 × 340 bottom-right it hides the PE columns right of LTP for the lower half of
  the rows, ATM included (at 1024 wide, nearly the whole PE side). The window moves and remembers
  its place, which is what the user accepted with `go`. A better default is the user's call.
- **Superseded checks, rewritten in `-p20` copies (never dropped):** `.cache/p10a-verify-p20.js`
  (row count = the window; the chip always reads `ATM ±8 · n of N`), `.cache/p10-reproof-p20.js`
  (feed subscriptions = 2 × snapshot strikes + 1, because the server still subscribes the whole
  chain; Pk % cells = 2 × rendered rows; the option chart opens in its window and the strip stays),
  `.cache/p9-verify-p20.js` (window open, strip visible, tools enabled; the illiquid check aims at
  ATM − 16 strikes, because the rendered top row is now only 8 out), `.cache/p16-verify-p20.js`
  (all 17 rows visible instead of ≥ 19 / 23 / 24), and `.cache/p19-verify.js` (a CE click leaves
  the underlying candles on screen).
- **AC2 is proven indirectly.** Replay's ATM stayed at 24,100 for the whole 30 s sample, so the
  window was never seen moving. What was proven: every render was centred on the ATM the bar
  printed (60/60 samples), and `windowRows()` handles different ATMs and both chain edges through
  the test seam `window.__grid`.

## Out of scope
More than one option window; a setting for the 8; server-side trimming of the chain or the feed.

## Acceptance criteria
- [ ] NIFTY replay renders exactly the rows `atmStrike ± 8 × step` recomputed from the payload, ATM in the middle (17).
- [ ] When the ATM moves, the window follows within one snapshot.
- [ ] Near a chain edge the row count equals what exists.
- [ ] A search for a strike outside the window shows that row.
- [ ] A CE click opens the floating window with that contract's candles; the seeded day still reads 3 blue / 2 yellow.
- [ ] The NIFTY chart stays visible and a drawing can be made on it while the window is open.
- [ ] Esc, × and an instrument switch each close the window.
- [ ] A dragged and resized window keeps its position and size after a reload.
- [ ] Zero console errors over 60 s; screenshots read at 1440×900 and 1024×800, dark and light.
- [ ] The superseded P2 / P10a / P9 checks are rewritten to the new rule and recorded, not dropped.

## Risks
- The window covers part of the PE side. It moves and remembers where it was put.
