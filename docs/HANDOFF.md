# HANDOFF — Dhan Option Chain Terminal — Phase 13 (card layout) — 2026-09-17

Built in a **separate git worktree** (`D:/Temp/Dhan-p13`, branch `p13-card-layout`, forked from
`p12-live-verify` at `30e8a0d`) while another session was working on P12 in `D:/Temp/Dhan`. That
checkout, its branch and its server on port 8787 were never touched.

## Done
- The screen follows the user's reference screenshot (a light, card-based options screen):
  - a 44px black nav with **Option Chain · Scanner · Latency**, the REPLAY/LIVE badge, the IST date and the theme toggle;
  - a slim yellow replay banner;
  - an index strip of the six underlyings (`NIFTY 50 / BANK NIFTY / …`), active one green-underlined, IST clock right;
  - one row of three cards: **Underlying** (spot, change, state chips) · **Chain summary** (7 stats with dividers) · **Connection** (the old status rail);
  - full-width **chart**, **option chain** and **latency drawer** cards with 12px draggable gaps.
- Light is the default theme; `T` still switches to dark and persists. Inter font, tabular numerals.
- The chain header carries Calls **CE** / Puts **PE** pills, and the Breached filter is a switch.
- **No chain value is clipped at 1440x900**: 0 text overflows across all six replay underlyings. The
  first build clipped 2,005 cell samples; see the decisions below.
- **38/38 acceptance checks pass in replay** (`docs/spec/card-layout-v1.md` AC 1-15, plus two added
  mid-build): nav and cards, 17-column fit at 1440px, sticky spine at 1024px greeks-on, row count ===
  payload strikes, ATM and PCR recomputed from the raw SSE payload, splitter drag and persistence,
  drawer costs height not width, every keyboard shortcut, candle mode, scanner Esc and close, theme
  default and persistence, and zero console errors over a 60 s run and at 1024px. All 89 element ids
  from `30e8a0d` are still present.
- Screenshots: light and dark at 1440, 1024 greeks-on, drawer open, 1024 drawer open, scanner open,
  candle mode, error state. They are in the session scratchpad, not in `docs/shots/`.

## Files changed
- `public/index.html` — the new structure (nav, index strip, summary row, card shell). Every id kept, so the JS wiring is unchanged.
- `public/app.css` — rewritten on the P13 tokens (light and dark); every selector the JS emits is still styled.
- `public/app.js` — light default theme, the nav date, and `CE_COLS` side widths re-measured (still 520px per side).
- `public/panes.js` — chain floor 200 -> 244 (+44px card header); the chart re-clamps when `#shell` resizes.
- `public/telemetry.js` — the same 244px chain floor.
- `docs/spec/card-layout-v1.md` — the spec: 17 rows, amendment rows 18-20, and an "as built" note.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `CLAUDE.md` — board, decisions, two new traps.

## Decisions made
- **Visual language only, not the reference's features.** No payoff chart, strategy legs, Execute, margin or positions: the app is read-only and has no data for them.
- **Sidebar abandoned mid-build (user approved with one `go`).** A 248px left column left the chain 1154px wide and clipped values by up to 32px. The three cards moved into one row above the chart.
- **Column widths come from measured text**, across all six underlyings. The 1132px total is unchanged.
- **Light replaces dark as the default** (supersedes P10 row 11). The 26px rail and the 1px seams are superseded too.
- **`#feedPill` stays visible in candle mode** (CSS override). Hiding it re-flowed the summary row on every mode switch.

## Known broken / deliberately skipped
- **1024x800 with the drawer open**: the chain gets 160px, below its 244px floor. The summary row wraps to two lines at 1024 (201px vs 123px at 1440), so chart 70 + drawer 88 + chain 244 no longer fit. P10b's "the chain floor is never broken" does not hold there — it needs a compact summary row below 1280px.
- **Greeks on at 1440** clips values. With greeks on, the table (1484px) is wider than the viewport, so nothing scales up. This was already true in P10, and AC 15 covers greeks-off only.
- **Column widths are sized from replay values only.** Live values wider than replay's (e.g. a 6-digit Vol Chg %) would clip again. Re-run the width measurement once P12 has live data.
- **`docs/shots/` not re-baselined.** Out of scope by the spec, and it would conflict with the P12 branch.
- **P10a/P10b/P10 re-proof scripts not re-run.** Several of their checks (26px rail, 1px seams, dark default) are superseded. `.cache/p13-verify.mjs` covers the rest.
- **At 1024 the chart header wraps** and puts the collapse button on its own line. Cosmetic.
- **Not merged or PR'd.** The branch is pushed. The replay server on 8788 was stopped at session end.

## Next session starts here
- Phase: **look at P13 in the browser and decide whether it ships**; then P12 still needs live credentials.
- First command: `cd D:/Temp/Dhan-p13 && PORT=8788 REPLAY=1 npm run dev`, then open http://127.0.0.1:8788. Re-verify with `node .cache/p13-verify.mjs <outdir>` (the script lives in the worktree's gitignored `.cache/`).
- Watch out for: **two sessions, two checkouts, two ports.** `taskkill //F //IM node.exe` (the CLAUDE.md reflex) kills the other session's server too — stop servers by PID. And `p13-card-layout` forks from `30e8a0d`, so rebase it if `p12-live-verify` moves.
