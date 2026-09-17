# HANDOFF — Dhan Option Chain Terminal — Phase 14 (9:20 scanner on NSE data) — 2026-09-17

## Done
- **The scanner now works without Dhan.** Press `Scan` (or `S`). Source `NSE`, the default, reads
  nseindia.com through an off-screen Chrome window and runs the user's three steps:
  - **Step 1:** the top N gainers and top N losers among the stocks in the F&O list.
  - **Step 2:** keep stocks whose price moved at least 2% either way.
  - **Step 3:** keep stocks whose OI rose at least +7%, per NSE's OI Spurts.
- **Top N is 20, 25 or 30**, picked in the panel. Changing N re-ranks the same fetch; Rescan
  fetches again. Source `Dhan` is P8, unchanged.
- **The user's F&O list is `data/fno-list.txt`.** It holds 210 symbols and matched four independent
  sources exactly: NSE master-quote, NSE underlying-information, NSE OI Spurts and the Dhan master.
  A mismatch in either direction is named on screen.
- **Result on 17-Sep closing data:** `210 → 40 → 26 → 4`. Long MFSL; Short POLICYBZR, PNBHOUSING,
  FEDERALBNK.
- **Verified:**
  - Server **31/31** (includes a second implementation and 7 broken fixtures).
  - Browser **35/35**, both themes, at 1440 and 1024.
  - Two real NSE scans: **5.4 s** and **9.1 s**.
  - Every earlier suite re-run green against this build on port 8788: P8 10/10 + 22/22, P2–P9
    37/37, P10a 41/41, P10b 30/30. `tsc` is clean.
- **Two CLAUDE.md facts corrected:** NSE *is* reachable (headed Chrome only), and OI Spurts lists
  all 216 underlyings, not 25.

## Files changed
- `src/server/nse.ts` — **new.** Headed Chrome off-screen, the two NSE feeds, row-level validation
  (symbol regex, finite numbers, `pChange` and `avgInOI` each recomputed within 0.01), and evidence
  saved to `.cache/nse/`. `NSE_FIXTURE=<dir>` reads a fixture instead.
- `src/server/scanner-nse.ts` — **new.** List parser, pure `nseFunnel()`, counted-at-rejection
  reconciliation, `NseScanner` (joins an in-flight fetch; `reuse`), CSV.
- `src/server/index.ts` — `/api/scan`, `/api/scan/status` and `/api/scan.csv` take a whitelisted
  `source=nse|dhan` (default `nse`), `n=20|25|30` and `reuse=1`.
- `public/scan.js`, `public/index.html`, `public/app.css` — Source and Top pickers, NSE table and
  header, "not in your F&O list" disclosure, header wrap, aligned columns, and no false "nothing
  skipped" line under an error (P8 had that bug too).
- `package.json` / lock — `playwright` moved to `dependencies` (still 1.62.1), because the server
  now needs it at runtime.
- `data/fno-list.txt` (moved from `docs/F&O-List.txt`), `test/fixtures/nse-2026-09-17/`,
  `docs/Recording-14-09-2026.md`.
- `docs/spec/scanner-nse-v1.md` (17 rows, locked), `docs/PHASES.md`, `docs/DECISIONS.md`,
  `CLAUDE.md`, this file.

## Decisions made
- **NSE is the source.** The user named it, it is reachable, and Dhan is dead. P8 stays selectable.
- **"Top 20" means the top 20 of the F&O stocks.** The pasted analysis said "whole market, then
  cross-match", but the transcript says the opposite. Measured: the whole-market top 20 held zero
  F&O stocks.
- **OI filter is `>= +7` for NSE** ("equal to 7 or greater than 7"). P8's absolute rule is not
  reopened.
- **The trigger is manual, with no session gate.** The panel prints NSE's own timestamps and market
  status instead. If the price and OI feeds carry different trading dates, the scan fails.
- **Renamed P13 → P14.** Another session already owns P13 (see below). The first two commits still
  say `p13:`; history was not rewritten.

## Known broken / deliberately skipped
- **Unmeasured: a scan at 09:20 IST on a trading day.** Nobody knows whether NSE's two feeds are
  fresh by then. The header shows their timestamps, so a stale feed will be visible, not silent.
- **Merge conflict ahead with `p13-card-layout`** (worktree `D:/Temp/Dhan-p13`, the other session).
  That branch moved `<section id="scan">` to the end of `<body>` and renamed its h2 to
  "F&O Scanner". It also restyled `.scan*` as a white modal card with new tokens, so the accent is
  `#111` in light mode and `.mono` no longer sets a monospace font. This branch adds two `<label
  class="scan-opt">` pickers inside `.scan-h` and a CSS block after `.scan-meta`: `.scan-opt`,
  `.scan-h` wrap rules, and `table.scan-t.nse`. Resolve it by keeping their markup and position,
  re-inserting the two labels, and re-running `.cache/p13-verify-ui.js`. Its "one line"
  and column-alignment checks will catch a bad merge.
- **NSE's terms of use restrict automated access.** It's 3 page loads per button press; the user
  has been told.
- **A Chrome window is created at -32000,-32000 for ~3–9 s per scan** and may flash in the taskbar.
- **P12 is still blocked** (expired token). Nothing in P14 depends on it.
- **Nothing is pushed yet** at the time of writing; see the final commit.

## Next session starts here
- Phase: **P14's last criterion.** On a trading day at 09:20 IST, start the server and press Scan.
  Record `prices as of` / `OI as of` from the header, and check `.cache/nse/` got two new files.
- First command: `git worktree list` and `netstat -ano | grep LISTEN | grep ':878'`. Another
  session may hold 8787; run this one on `PORT=8788` if so.
- Watch out for: **never `taskkill //IM node.exe`** — it kills MCP servers and the other session.
  Kill by the PID that owns the port.
