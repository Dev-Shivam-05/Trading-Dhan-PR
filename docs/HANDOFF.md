# HANDOFF — Dhan Terminal — Phase P19 — 2026-09-19

## Done
- **The main chart strip now draws the underlying as green/red OHLC candles** (the default mode),
  1m / 5m / 15m, with the latest session drawn and an SMA 20 on by default. It works for all six
  chips, and on a shut market it shows the last session (`session 18 Sep · market closed` top-right).
- **Chart Style dialog** (the button with the sliders icon in the chart header), modelled on the
  user's reference image: Candle / Line, 7 backgrounds + picker, 6 up + 6 down colours + picker,
  three SMA slots (9 / 20 / 50, editable 2–200), a live full-size preview, and Save / Reset.
  × / Esc / backdrop discard. Colours under 3:1 against the background are disabled or refused.
- **Line** mode is P5's tick line, unchanged. P6 drawings work in both modes, because they are
  (time, price) through chart-tools' X/Y.
- Verified: `.cache/p19-verify.js` **62/62**, three runs in a row, 60 s soak with zero console
  errors, paint p95 5.6 ms at 375 candles + 3 SMAs. **Live history:** `.cache/p19-live.ts` got
  6/6 exact matches with direct Dhan calls (NIFTY, RELIANCE × 1/5/15m, every OHLC value).
- Regressions: P10a 42/42, P10b 30/30, P9 22/22. P2–P9 re-proof 36/37 and P16 35/37 fail
  **identically on the pre-P19 commit `be8dfff`**, so those failures are environmental (details
  below).
- `docs/shots/` re-baselined once. 09/10 now switch to Line first; 14 (candle strip) and 15 (the
  dialog) are new. Images 15 and 09 were opened and checked.

## Files changed
- `src/server/ucandles.ts` (new): `UnderlyingCandleService` fetches intraday on the underlying over
  a 5-day window, marks `sessionStart`, persists nothing.
- `src/server/replay.ts`: `replayUnderlyingCandles`, a 1-minute walk anchored so the last close
  equals `replayBasePrice`, rolled up to 5m and 15m.
- `src/server/index.ts`: `GET /api/ucandles` (400 on a bad key or interval), plus 2 `STATIC` rows.
- `public/ucandles.js` (new leaf): data store, 60 s refresh, `mergeTick`, SMA, `buildView`,
  `renderSvg`, and the test seam `window.__ucandles`.
- `public/chart-style.js` (new): the saved style (`chartStyle:v1`), the contrast guard and the
  dialog.
- `public/app.js`, `index.html`, `app.css`: strip wiring, header controls, the dot grid, and the
  dialog markup and styles.
- `scripts/shots.ts`: tick shots switch to Line first; new shots 14 and 15.
- `docs/spec/underlying-candles-v1.md` (24 rows + amendments 25–34), `GLOSSARY.md` (3 terms),
  `PHASES.md`, `CLAUDE.md` (the focus-loss rule).

## Decisions made
- The candle source is `/v2/charts/intraday`, not candles built from ticks. Ticks alone draw nothing
  on a shut market, which is when most work here happens.
- Custom backgrounds reuse the existing theme tokens, picked by luminance. `#7A8597` measures
  4.56–4.94:1 on every dark swatch, so no new text colour was introduced.
- The session note moved from the header into the plot (amendment 28), because the header wrapped
  to 64px at 1024 wide.
- The Chart Style applies only to the underlying chart. Option candles keep their colours, because
  blue and yellow mean "big player" there.

## Known broken / deliberately skipped
- **The live forming-candle merge has not been watched live.** It needs Mon 21 Sep from 09:15;
  until then it is tested only through the seam.
- **SMA 50's colour `#8B7CFF` is the same as the drawing-tool accent**, so a trendline and SMA 50
  look alike. That colour was locked in row 12. It is the user's call; suggest a different colour.
- **Environmental reds, identical on `be8dfff`:** the P3 CSV percentile check (the telemetry ring
  is empty at the weekend) and P16's funnel plus zero state (it reads live NSE, now 210→40→29→3,
  against the P14 fixture's 210→40→26→4).
- **`.cache/p9-verify.js` predates P16's workspaces.** It needs `ws=chain` seeded; the patched copy
  is `.cache/p9-verify-8788.js`.
- **Leftovers to clean up by hand.** A worktree `D:/Temp/Dhan-p19base` (at `be8dfff`, no work in
  it, junction already removed) was left behind because `git worktree remove` was denied. Two replay
  servers are still running: 8790 and 8788.
- The live server on 8787 (PID 32412) still runs the old build `60e85b0` without `/api/ucandles`.

## Next session starts here
- Phase: restart the live server so the user sees P19 live, then the Mon 21 Sep 09:15 market-open
  checks (PHASES Next 3 #2), including P19's forming candle.
- First command: `git worktree list; netstat -ano | grep LISTEN | grep ':87'; npm run check`
- Watch out for: the 8787 server is the **one token owner**. Kill it only by its PID, start ONE
  plain `npm run dev`, then assert a single listener, zero `EADDRINUSE`, and `/ucandles.js` → 200.
