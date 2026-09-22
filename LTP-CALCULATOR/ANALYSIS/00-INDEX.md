# LTP Calculator — Source Material Analysis

**Stage:** Understanding only. No PRD, no architecture, no code. This folder is the
reconstruction of what the 127 transcripts in `../KEY-POINTS/`, plus the 35-file English
re-extraction in `../KEY-POINTS-V2/`, actually teach.

## What was analysed

| | |
|---|---|
| Source folders | `LTP-CALCULATOR/KEY-POINTS/` (V1, all 127 videos) and `LTP-CALCULATOR/KEY-POINTS-V2/` (V2, 35 of the same videos re-extracted from English translations) |
| Files present | V1: 128 (`INDEX.md` + 127 `VIDEO-*.md`). V2: 36 (`INDEX.md` + 35 `VIDEO-*.md`). |
| Files read in full | **All of both.** 127/127 V1 video files + 35/35 V2 video files, plus both `INDEX.md` files. |
| Numbering gaps in source | VIDEO-34, 70, 95, 127, 128, 129 absent from V1 (the series header says "of 133"). V2 covers only 04, 41, 56, 58, 67, 68, 69, 71–94, 96–99 — **no new videos**, a cleaner re-cut of ones already in V1. |
| Total source volume | V1 ~104,000 words / 866 KB; V2 ~25,800 words / 224 KB |
| Nature of source | These are **not** raw transcripts. They are already-structured key-point extractions, one per video, each with "In one line", topic sections, "What the video tells you to do", and a sceptical "Worth knowing" section. The raw Hindi ASR text referenced by `INDEX.md` as living in `_raw/` **is not present in this repo.** V2 is the same kind of document, rebuilt from **English translations** of 35 of those transcripts. |

## Documents in this folder

| File | What it holds |
|---|---|
| `00-INDEX.md` | This file. Method, coverage, how to read the rest. |
| `01-FILE-NOTES-A.md` | Per-file analysis, VIDEO-00 → VIDEO-33. The core theory series (EP 01–EP 34). |
| `02-FILE-NOTES-B.md` | Per-file analysis, VIDEO-35 → VIDEO-69. Scenarios, blood bath, 9:20 strategy, AI lines. |
| `03-FILE-NOTES-C.md` | Per-file analysis, VIDEO-71 → VIDEO-104. Stock screeners, ranges, writing, Greeks. |
| `04-FILE-NOTES-D.md` | Per-file analysis, VIDEO-105 → VIDEO-132. Percentage game, COA restated, expiry, indicator critiques. |
| `05-CONSOLIDATED-LOGIC.md` | **The main deliverable.** The complete LTP Calculator reconstructed as one system: inputs, derivation order, every rule, every output, every dependency. |
| `06-GLOSSARY-AND-TRACEABILITY.md` | Every term defined, plus a logic → source-file matrix. |
| `07-OPEN-QUESTIONS.md` | Everything unclear, contradictory, withheld, or unverifiable, with the files that raise it. |
| `08-V2-DELTA.md` | **Read after 05 and 07.** What the `KEY-POINTS-V2/` English re-extraction of 35 videos changes: 4 open questions resolved, 3 narrowed, 1 made worse, 1 new. |

## Reading order

1. `05-CONSOLIDATED-LOGIC.md` first if you want the system.
2. `06-GLOSSARY-AND-TRACEABILITY.md` alongside it — the vocabulary is almost entirely
   the speaker's own invention and nothing in the system parses without it.
3. `07-OPEN-QUESTIONS.md` before any build decision is made, then `08-V2-DELTA.md`, which overrides parts of it.
4. The four `FILE-NOTES` documents when you need the primary evidence for a specific rule.

## Three properties of this source material a developer must know up front

**1. The numbers are unreliable; the structure is not.**
Every source file carries the same footer: the transcripts are Hindi ASR and routinely drop
the leading digits of index levels (22,700 becomes "700"). Every extracted file flags this.
So: **treat every quoted price, strike and premium in the transcripts as illustrative only.**
The *relationships* between levels (this one sits one strike above that one; this one is the
entry and that one is the stop) are stated consistently across dozens of files and are reliable.
The digits are not.

**2. Almost all of it is one person's proprietary framework, not standard market practice.**
"Imaginary line", "extension of support", "divergence"/"diversion", "weak towards top",
"Chart of Accuracy", "state of confusion", "Max Pain"/"Max Gain" as used here, "LTP Blast",
"LTP Swing", "reversal price", the star/risk ratings — none of these are standard
option-chain terminology. Several are used by the speaker with a meaning that differs from
the industry's meaning of the same words (notably **Max Pain**, which here means *stop loss*,
not the classic max-pain strike). This matters when we build: we cannot look up a reference
implementation, and we cannot assume a library does the same thing.

**3. The core calculation is never shown.**
The single most important number in the entire system — the **reversal price** for a strike —
is stated in ~20 files to be "derived from the Option Greeks" (delta, theta, vega, gamma, rho)
plus implied volatility, both sides' LTPs, spot and futures. **No file gives the formula.**
Everything downstream (extensions, divergences, the 9:20 lines, the AI lines, Max Pain,
Max Gain, the weekly/monthly range) is built on it. This is the one genuine blocker, and it is
recorded as Open Question 1 in `07-OPEN-QUESTIONS.md`.

## How each file note is structured

Each entry covers, where the file actually contains them:

- **Type** — theory / worked replay / live session / product tour / promo / off-topic
- **Concepts** — what is being explained
- **Logic** — the complete rule set, stated as rules
- **Inputs** — what market data is required
- **Calc** — formulas, arithmetic, comparisons
- **Conditions** — decision rules and branches
- **Output** — what the reader/tool is supposed to produce
- **Examples** — the worked cases used
- **Exceptions** — edge cases, limits, "does not apply when…"
- **Depends on** — other videos/logic this one needs
- **Unclear / conflicting** — flagged, never silently resolved
- **Build note** — what this implies for the future LTP Calculator section

Files that teach no market logic (pure promotion, mutual-fund selling, tax commentary,
school advertising) are marked **NON-CORE** and kept short, but are still listed so the
coverage is provably complete.
