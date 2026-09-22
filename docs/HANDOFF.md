# HANDOFF — Dhan Terminal — P28 — 2026-09-22

> P25's handoff is superseded here but not lost: its full text is in git history, its session-log row
> is in `docs/PHASES.md`, and its decisions are in `docs/DECISIONS.md`.

## Done

**P28 — LTP Calculator source analysis. Understanding only. No code, no spec, no PRD.**

The user supplied ~133 videos' worth of key-point transcripts for a third workspace, **LTP Calculator**,
to sit alongside Scanner and Option Chain. This session read all of it and reconstructed the system.

- **Every source file read in full, not sampled.**
  - `LTP-CALCULATOR/KEY-POINTS/` — **127 of 127** video files + `INDEX.md` (~104,000 words).
  - `LTP-CALCULATOR/KEY-POINTS-V2/` — **35 of 35** video files + `INDEX.md` (~25,800 words),
    which arrived mid-session.
- **`KEY-POINTS-V2` is NOT new videos.** It is a **re-extraction of 35 videos already in V1**,
  rebuilt from **English translations** of the same transcripts rather than the Hindi ASR captions.
  Its own `INDEX.md` says so. The other 92 were already English and were not redone.
  Neither folder supersedes the other — V2 is cleaner on its 35; V1 has more detail and covers all 127.
- **The whole system is reconstructed** in `LTP-CALCULATOR/ANALYSIS/` (9 documents, ~85,000 words):
  per-file notes for all 127 files, one consolidated logic document, a glossary, a traceability
  matrix, 39 numbered open questions, and a V2 delta.
- **The core finding, and the thing that blocks any build:** the whole product rests on one primitive
  — the **reversal price** per strike per side. Every line it draws (extensions, divergences, the four
  9:20 lines, the eight AI lines, Max Pain, Max Gain, the weekly/monthly range, the LTP Swing HOI
  reversals) is a selection of which strike's reversal price to show. **~20 files say it is "derived
  from the Option Greeks". Not one gives the formula.** That is OQ-1.
- **V2 resolved four open questions** (OQ-24, OQ-25, OQ-28, OQ-31), narrowed three, and made one
  worse (OQ-35, the arrow/orientation convention — now the second-most urgent item).

## Files changed

- `LTP-CALCULATOR/ANALYSIS/00-INDEX.md` — new. Method, coverage, the three properties of the source
  a developer must know before reading anything else.
- `LTP-CALCULATOR/ANALYSIS/01-FILE-NOTES-A.md` — new. VIDEO-00 → VIDEO-33: the core theory series
  (imaginary line, volume vs OI, the support and resistance definitions, level grading, the six
  reversals, extensions and divergences, the nine scenarios, shifting, SOC, positional trading).
- `LTP-CALCULATOR/ANALYSIS/02-FILE-NOTES-B.md` — new. VIDEO-35 → VIDEO-69: the stock filters, the
  weekly range, the blood-bath signature, the detailed COA scenarios, the 9:20 strategy, the AI lines.
- `LTP-CALCULATOR/ANALYSIS/03-FILE-NOTES-C.md` — new. VIDEO-71 → VIDEO-104: LTP Blast, LTP Swing,
  the L1/L2/L3 range, expiry writing, IV behaviour, strike selection.
- `LTP-CALCULATOR/ANALYSIS/04-FILE-NOTES-D.md` — new. VIDEO-105 → VIDEO-132: the five-state pressure
  model, the Game of Percentage, the live six-line read, expiry-day methods, the indicator critiques.
- `LTP-CALCULATOR/ANALYSIS/05-CONSOLIDATED-LOGIC.md` — new. **The main deliverable.** The system as
  one pipeline: inputs → imaginary line → S/R → grading → pressure → scenario → reversal price →
  line sets → filters → entry/stop/target → management, plus the session clock, the dependency map,
  the edge cases, and the only measured results in the corpus.
- `LTP-CALCULATOR/ANALYSIS/06-GLOSSARY-AND-TRACEABILITY.md` — new. Every term (almost all of it the
  speaker's own coinage), plus a logic → source-file matrix and a coverage check.
- `LTP-CALCULATOR/ANALYSIS/07-OPEN-QUESTIONS.md` — new. 38 numbered gaps, severity-ranked, each with
  what the files say, why it matters, and how it could be settled.
- `LTP-CALCULATOR/ANALYSIS/08-V2-DELTA.md` — new. What the V2 re-extraction changes, including OQ-39.
- `docs/HANDOFF.md`, `docs/DECISIONS.md`, `docs/PHASES.md`, `CLAUDE.md` — this handoff.

**No code was written. `src/`, `public/`, `scripts/` and `test/` are untouched.**

## Decisions made

- **Read every file rather than delegating to subagents.** 128 + 36 files is ~150k tokens, which fits
  in context. A subagent summary of a summary would have lost exactly the small details the user
  asked for — and did matter (V108's five-state table, V109's percentage inversion, V110's line
  provenance, V118's straddle projection, V126's reversal-gap rule each appear in one file only).
- **Did not resolve contradictions silently.** Where files disagree, both readings are recorded with
  their sources and a recommendation. 39 of them are numbered so they can be decided in one word.
- **Did not commit, and did not add the row to `docs/PHASES.md` until the handoff.** Three Claude
  sessions were live in this same checkout (`dhan-36`, `dhan-93`, `transcripts-1b`), and `PHASES.md`
  is the file most likely to be clobbered by two of them at once.
- **Treated `KEY-POINTS-V2` as a second pass, not a replacement.** Both folders are kept and both are
  cited; the delta document says which wins where.

## Known broken / deliberately skipped

- **OQ-1 — the reversal-price formula — is unresolved, and nothing can be built without it.**
  Best available inputs (V124, V111, V47): spot, futures, call LTP, put LTP, delta, theta, vega,
  gamma, rho, IV. Best available theory (V18): *the spot level at which that strike's time value
  peaks is where the writer commits hardest.* Unvalidated.
- **`LTP-CALCULATOR/` is untracked and NOT gitignored** — it sits in the same `??` pile as ~30 stray
  root PNGs and `assets/`. Deliberately left uncommitted: choosing the branch is the user's call, and
  this session is on `p25-chart-nav`, a finished phase's branch.
- **No spec, no PRD, no UI, no data model.** The user scoped this session to understanding only and
  said so explicitly.
- **Four questions can only be answered outside this repo:** OQ-1 (the formula), OQ-30/OQ-39 (need
  the *published* LTP Swing flowchart), OQ-35 (need to see the on-screen arrow orientation in a video).

## Still pending from earlier phases — carried forward, not new

These are **decisions waiting on the user**, not work P28 touched. They were in P25's handoff and
would otherwise survive only in `docs/PHASES.md` and in git history at `9e5593c`.

- **The branches are STACKED and must be merged in order.** **74 commits** ahead of `main`, none of
  it merged, in the order **p6 → … → p20 → p21 → p22 → p23 → p24 → p26 → p25**. Merging out of
  order, or merging one in isolation, will not work. That is the user's call.
  *(P25's handoff said 68; `git rev-list --count main..HEAD` now returns 74.)*
- **P18's transport** — the terminal reachable from any device. The server-side password gate exists
  from P17; the transport does not.
- **P9's opening-candle question** — should `median20` stay inside the session? Every live blue fires
  in the first 20 minutes because `median20` at the open reaches back into yesterday's quiet tail.
- **`gh secret set NTFY_TOPIC`**, and a Telegram bot.
- **Three servers may be up** — 8787 live (holds the token), 8791 replay, 8792 the pre-P25 baseline
  worktree at `D:/Temp/Dhan-p25base`. They belong to another session. `git worktree list` first,
  kill by the PID that owns the port, never `taskkill //IM node.exe`.

## Next session starts here

- **Phase P29: lock the LTP Calculator spec** — but only after OQ-1, OQ-35 and OQ-33 are decided.
  Everything downstream of the reversal price is already written up and does not need re-deriving.
- **First command:**
  `cat LTP-CALCULATOR/ANALYSIS/05-CONSOLIDATED-LOGIC.md`
  then `cat LTP-CALCULATOR/ANALYSIS/08-V2-DELTA.md` (it overrides parts of `07-OPEN-QUESTIONS.md`).
- **Watch out for:** **do not re-read the 163 transcript files.** They are already fully analysed and
  re-reading them costs ~150k tokens to learn nothing new. Everything is in `ANALYSIS/`, traced back
  to its source video, and the per-file notes cite the video number for every rule.
  The second trap: **"Max Pain" in this product means STOP LOSS and "Max Gain" means TARGET.**
  Neither carries its industry meaning. Importing the classical max-pain definition will silently
  produce wrong levels everywhere.
