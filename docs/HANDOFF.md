# HANDOFF — Dhan Option Chain Terminal — Phase 10 (spec lock, **not** build) — 2026-09-01

## Done
- **`docs/spec/terminal-redesign-v1.md` exists — 22 rows, and it says `PROPOSED, NOT LOCKED` in
  its own first line.** The table was emitted for approval and **no `go` came back**, so it was
  persisted with that status rather than as a locked spec. Nothing was built.
- **The P10 row is split into P10a and P10b in `docs/PHASES.md`, at 5 code files each.** The old
  row carried `~12` against the 8-file rule and said in its own text that it splits at spec-lock
  time. The cut is chosen so **nothing built in P10a is thrown away in P10b**: P10a builds the
  shell and the chain and leaves the `.lat` right dock working and untouched inside it; P10b
  deletes the dock and adds the rail and drawer.
- **The three things `DECISIONS.md` said had to become numbers first now have answers.**
  "TradingView-like" is **five binary facts** (row 1): a resizable multi-pane shell, zero-gap 1px
  pane seams, a spine pinned so it cannot scroll out of view, a default column set that fits
  1440px, and dark by default. The latency panel's new form is a **26px always-on status rail plus
  a closed-by-default horizontal four-column drawer**, with the 380px right dock deleted (rows
  12–14). The P2–P6 re-proof is a **named, scripted checklist** (`.cache/p10-verify.js`) covering
  P2 through P9, not a promise.
- **Three answers changed because the proposal was written against the real screen, not the
  requirements.** They are the reason this session was worth a session.
- **Zero `src/` and zero `public/` files were touched.** Only docs and the new spec.

## Files changed
- `docs/spec/terminal-redesign-v1.md` — **new.** The 22-row table, out-of-scope list, three blocks
  of acceptance criteria, four risks. Marked `PROPOSED, NOT LOCKED`.
- `docs/PHASES.md` — the P10 row replaced by P10a and P10b rows; `## Now` and `## Next 3`
  rewritten; one session-log row appended.
- `docs/DECISIONS.md` — five entries appended (append-only, as always).
- `CLAUDE.md` — two traps added: the centred-spine sticky geometry, and reading the code before
  writing a redesign spec.

## Decisions made
- **The spec is persisted as `PROPOSED`, not as `locked`.** A file that claims approval nobody gave
  is worse than no file, because the next session builds from it without asking. The status line is
  the first thing in the file for that reason.
- **"No ATM window, no hidden rows" is an invariant, not a rebuild.** The grid **already** renders
  the complete strike list in one scrollable table with a sticky header; nothing windows strikes on
  the server (`derive.ts` sorts and pads-filters, no slice) or on the client. So row 8 states it as
  a rule — `tr.hidden` is only ever set by an explicit filter, and when a filter hides anything the
  header reads `showing n of N strikes` — instead of specifying work that is already done.
- **The sticky spine needs `left:0` AND `right:0`.** The obvious `position:sticky;left:0` does
  nothing on this screen: the spine is column 13 of 25, sits at x≈696, and the horizontal overflow
  at 1440px is 44px, so it would need ~700px of scroll before it ever pinned. Symmetric offsets pin
  it in both directions and only conflict if the scrollport is narrower than the 92px cell — far
  below the 1024px floor.
- **Greeks hidden by default (row 7)**, giving 17 columns / 1132px. The 1484px table does not fit
  the 1440px floor; the P2 deviation row already priced this as "44px of horizontal scroll" and
  handed the final column layout to P10. This is that debt being paid.
- **Dark as the default theme (row 11).** One line in `applyTheme()`, fully reversible, and the
  loudest available "terminal" signal.

## Known broken / deliberately skipped
- **The spec is not approved.** It needs one word — `go`, or `change 7,11` with values. **No UI
  file may be opened until the file stops saying PROPOSED.**
- **Rows 7 and 11 are readings, not measurements**, and are flagged in the file itself as the
  likely vetoes. Row 7 hides the greeks by default; row 11 makes dark the default theme. Each is
  one flag. Every other row cites a value already in the codebase or an existing spec row.
- **Nothing was built and nothing was measured.** No `npm run dev`, no browser, no screenshots.
  There is nothing to verify in this session's output except the file itself.
- **Three risks in the spec are unproven guesses about the code** and should be checked before
  building, not after: whether `td.spine` ever receives `.flash` (its `background:transparent`
  end-state would defeat the sticky cell), whether `.spotpill`'s `z-index:4` collides with the new
  sticky header spine, and the ~20 element ids inside `.lat` that `app.js` writes to — one missing
  node after P10b deletes the dock presents as the whole page dying, not as a missing panel.
- **P8's AC5 is still the one open criterion in the project** — the chain poll's 3000 ms gap across
  a scan. It needs an open market and a live plan; replay makes no `dhanPost` calls at all.
- **The live path has never run for P7, P8 or P9.** `dataPlan: Deactive`.
- **`docs/shots/` still holds the 17 pre-P6 reference images.** Spec row 22 puts the single
  deliberate `npm run shots` at the **end of P10b**. Never run it for an ad-hoc check.
- **Six branches, none with a PR.** Stacked: merge `p6-chart-tools`, then `p8-p9-spec-lock`, then
  `p7-peak-oi`, then `p8-scanner`, then `p9-option-candles`, then `p10-spec-lock`, in that order.

## Next session starts here
- Phase 10a: **build the terminal shell and the chain** — but only after the spec is approved;
  read `docs/spec/terminal-redesign-v1.md` and get one word on it first.
- First command: `npm run check`
- Watch out for: **the spec file says PROPOSED and that is not a formality.** Two of its 22 rows
  change what the screen looks like on first paint (greeks off, dark default) and were chosen by
  reading, not by measurement. Building from an unapproved table is how a redesign gets reopened.
  Second: **P10a rewrites a screen carrying nine phases of passing acceptance criteria.** Write
  `.cache/p10-verify.js` — the re-proof block covering P2 through P9 — **before** the first CSS
  change, not after; it is most of the phase, and it is the only thing that will tell you the
  rebuild broke P5's orphan count or P6's anchors.
