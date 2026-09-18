# HANDOFF — Dhan Terminal — P14 + P15 + P16 — 2026-09-17

## Where things stand
- **P14 — the 9:20 scanner on NSE data.** Works today, no Dhan account. `210 → 40 → 26 → 4` on
  17-Sep closing data. Spec `docs/spec/scanner-nse-v1.md`.
- **P15 — it runs itself.** `.github/workflows/nse-scan.yml` runs `npm run scan:nse` at **09:20 and
  09:25 IST Mon–Fri** on GitHub's Ubuntu **and** Windows runners; both reached NSE in three test
  runs. Logs are committed to the **`scan-logs`** branch (`LATEST-github-*.md`, `index-github-*.csv`,
  per-run `.md`/`.json` with the per-stock trace). PR #2 merged P6–P15 into `main` with the user's
  explicit approval, because `schedule:` only fires from the default branch. A GitHub ZIP of the
  branch was also run from an empty folder: `npm ci`, `npm run scan:nse` and the app all worked.
- **P16 — the redesign, built.** Two workspaces (Scanner, Option chain) under a 48px nav, Geist +
  Geist Mono, near-black with one violet accent, the ATM row as the single focal point, OI drawn as
  green/red butterfly bars, and the scanner as a full screen with funnel tiles, side-by-side
  Long/Short, the 40-row trace and an automatic-runs card. Spec `docs/spec/redesign-v2.md`
  (18 rows + amendments 19–26). Branch `p16-redesign`, pushed, **no PR yet**.

## Verified (all on port 8788, replay + the NSE fixture)
- P16 Stage B **37/37**: 19 chain rows with the chart (23 collapsed in replay, **24 live** — the
  28px replay line is the difference), 64px instrument bar including GOLD's 7-digit spot, exactly
  two fonts and every size in the scale (SVG labels included), scanner fits with no scroll in both
  themes, 60 s soaks with zero console errors.
- Earlier suites re-run green: **P10a 42/42** (one check amended), **P10b 30/30**, **P2–P9 37/37**,
  **P8 22/22 + 10/10**, **P14 35/35**, **scanner server 31/31**, `tsc --noEmit` clean.
- `docs/shots/` re-baselined once: 21 images.

## Files changed in P16
`public/index.html`, `app.css` (rewritten), `app.js`, `scan.js`, `panes.js`, `candles.js`,
`chart-tools.js`, `telemetry.js`, `scripts/shots.ts`, `docs/mock/redesign-v2.html`,
`docs/spec/redesign-v2.md`, `docs/PHASES.md`, `CLAUDE.md`, `docs/shots/*`.
**Eight code files — one over the ~8 guideline, recorded in amendment 26.**

## Decisions worth keeping
- **Two-stage approval for a look.** A static mock (`docs/mock/redesign-v2.html`, real numbers) was
  approved before any `public/` file changed. It cost one file and caught four defects.
- **Light mode's green/red/amber were changed before building**: the locked values were 3.39–4.18:1
  on white. Amendment 19.
- **The scanner is a workspace, not a route.** Still `position:fixed` over the chain, because a
  route change would tear down the chain poll and the tick feed.
- **`S` always means scan; `Esc` leaves.** Amendment 24.
- **Kept from P10 on purpose:** 92px spine, 26px rail, `#modeBadge`/`#clock` in the rail. P10a's
  108px scroll measurement and P10b's row 13 depend on them. Amendment 23.

## Known broken / deliberately skipped
- **`p13-card-layout` is not merged** (the other session's redesign; the user rated it −5/10). It
  rewrites the same `index.html` / `app.css` blocks. If it is ever merged, this branch wins on
  those files. Nothing in P16 depends on it.
- **The first `docs/shots` re-baseline was wrong** (all 18 "chain" images showed the Scanner) and was
  thrown away. `scripts/shots.ts` now seeds `ws=chain`. Read one image after any re-baseline.
- **Open: the first scheduled morning**, Fri 18 Sep 09:20 IST, and P14's "a scan pressed at 09:20 on
  a trading day".
- **The Windows task on this PC is not installed** — running `scripts/schedule-windows.ps1` with
  `-ExecutionPolicy Bypass` was denied in this session. GitHub covers the morning without it.
- **PR #3** (Windows-runner IST stamps + P15 docs) and **P16's branch** are both unmerged.
- **P12 is still blocked**: the token in `.env` expired 2026-08-28.

## Next session starts here
- **Read the morning first:** `git fetch origin scan-logs && git show origin/scan-logs:index-github-windows.csv`
  (and `-ubuntu`). Check `status`, `prices_as_of` (today, after 09:15) and the funnel.
- Then: merge PR #3, open a PR for `p16-redesign`, and drive the redesigned screens live once a
  Dhan token exists.
- First commands: `git worktree list` and `netstat -ano | grep LISTEN | grep ':878'` — another
  session may hold 8787; run this one on `PORT=8788`. **Never `taskkill //IM node.exe`.**
