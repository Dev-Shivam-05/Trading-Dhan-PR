# HANDOFF — Dhan Terminal — Phase P20 — 2026-09-19

## Done
- **The chain shows only the ATM row and 8 strikes each side (17 rows).** It re-centres on every
  3 s snapshot from the ATM the bar prints. The chip reads `ATM ±8 · 17 of N strikes`. Strike
  search still reaches the whole chain; Breached filters inside the window.
- **A CE / PE click opens that contract's chart in a floating window** (P9's candles, blue/yellow,
  1m/5m/15m, tooltip, no option chain). It drags by its title bar, resizes from the corner, and
  remembers its position and size. × / Esc / a chip switch close it; the Scanner hides it.
- **The NIFTY chart is never taken over now.** It stays on screen with its drawing tools; ▾ / `C`
  still collapse it by hand.
- Verified: `.cache/p20-verify.js` **29/29**, 60 s soak with zero console errors. Older suites with
  the superseded checks rewritten (not dropped): P10a 42/42, P2–P9 re-proof 37/37, P9 22/22,
  P19 62/62, P10b 30/30, P16 35/37. The 2 P16 reds are the live-NSE funnel, identical before P19.
  `docs/shots/` re-baselined; `01-chain-dark.png` opened and checked.
- P19 earlier this session: underlying candles + the Chart Style dialog (branch `p19-candles`).

## Files changed
- `public/app.js`: `windowRows()` (ATM ± 8) in `renderGrid`, the chip text, the `window.__grid`
  test seam; the P9 early return that blanked the strip is removed.
- `public/candles.js`: a window instead of `body.optmode`; place / drag / resize / persist
  (`localStorage.optWin`), clamped into the viewport.
- `public/index.html`: the option chart markup moved out of the strip into `<section id="optWin">`.
- `public/app.css`: the dead `.opt` / `optmode` rules removed; `.optwin` styles, hidden while the
  Scanner is showing.
- `docs/spec/strike-window-v1.md` (16 rows + build notes), `PHASES.md`, `DECISIONS.md`,
  `CLAUDE.md` (2 lessons), `docs/shots/`.

## Decisions made
- UI-only window; the server still polls and subscribes the whole chain. P7 already backfills
  nearest-ATM first.
- Superseded invariants are rewritten in `-p20` copies of the old suites, so they keep measuring.

## Known broken / deliberately skipped
- **The default window spot hides the PE columns of the lower rows, ATM included** (at 1024 wide,
  nearly the whole PE side). It is movable and remembered. Recommendation for the user: open it
  over the side that was NOT clicked. Waiting for their word.
- **AC2 (the window following a moving ATM) is proven only indirectly.** Replay's ATM never moved
  in 30 s. Watch it live on Monday.
- From P19, still open: the forming candle live (Monday 09:15+); SMA 50's colour equals the
  drawing accent; the leftover worktree `D:/Temp/Dhan-p19base`; replay servers on 8790 / 8788.

## Next session starts here
- Phase: the option-window default-spot decision (one word from the user), then the Mon 21 Sep
  09:15 market-open checks (PHASES Next 3 #2), including P19's forming candle and P20's re-centring.
- First command: `git worktree list; netstat -ano | grep LISTEN | grep ':87'; npm run check`
- Watch out for: 8787 is the **one token owner**. Kill it only by its PID, start ONE plain
  `npm run dev`, then assert a single listener, zero `EADDRINUSE`, and the new build in
  `/api/health`.
