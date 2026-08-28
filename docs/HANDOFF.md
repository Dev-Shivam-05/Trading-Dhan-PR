# HANDOFF — Dhan Option Chain Terminal — Phase 8/9 spec capture — 2026-08-28

## Done
- Six voice recordings turned into a written requirements set. They describe **two separate
  systems**, not one, and they are now on the board as P8 and P9.
- Rec 03 and Rec 04 are word-for-word duplicates, so the scanner has **three** filter steps, not four.
- Feasibility of both systems verified end to end against the real instrument master and the
  DhanHQ v2 docs. No numbers were invented; both specs are deliberately left **unlocked**.
- A wrong claim made earlier the same day was found and corrected across three files.

## Files changed
- `docs/PHASES.md` — P8 (9:20 F&O scanner) and P9 (option candle colouring) added, both marked
  **spec NOT locked**; P7 rewritten now that peak OI turns out to be fetchable; `## Now` /
  `## Next 3` rewritten; session log row added.
- `docs/DECISIONS.md` — appended: the superseding peak-OI entry, why P8/P9 were boarded unlocked,
  and why NSE Spurts will not be scraped without an explicit decision.
- `CLAUDE.md` — added the verified F&O-universe facts and the nseindia.com unreachability, so the
  next session does not re-derive them.
- **No `src/` changes.** Nothing in the application code was touched.

## Decisions made
- **Both specs left unlocked on purpose.** The recordings are mostly thresholds, and the standing
  rule is that a number or colour that is not written down does not get invented. Fifteen open
  questions are listed below.
- **NSE Spurts not swapped for a Dhan-computed equivalent.** The equivalent was presented and it is
  strictly better on both blockers, but the user named NSE Spurt specifically, so replacing a named
  data source is their call, not something to absorb quietly.
- **P9's trigger left undecided** rather than picking one. Rec 01 says volume triggers the colour,
  Rec 02 says OI does. They are different signals — a candle can carry huge volume with no OI change
  at all, which is the exact opposite of a big player taking a position.

## Verified this session (facts, not estimates)
- The NSE F&O stock universe is **exactly 210** — `FUTSTK` and `OPTSTK` underlyings are identical
  after dropping 18 `NSETEST` dummy scrips the master ships.
- All 210 fit in **one** `POST /v2/marketfeed/quote` call (limit 1000, 1 req/sec), which returns
  `net_change` against previous close — so scanner filters 1 and 2 cost roughly one second against
  the user's two-minute budget. DhanHQ v2 has **no** top-gainer/loser endpoint and does not need one.
- `POST /v2/charts/intraday` accepts `NSE_FNO` with `OPTSTK` / `OPTIDX` / `FUTSTK`, takes
  `"oi": true`, and returns `open_interest` per candle at 1/5/15/25/60 min for up to 90 days.
- `nseindia.com` refuses connection from this machine (**HTTP 000**) while example.com and
  dhanhq.co return 200 on the same run; its OI Spurts page lists only the **top 25** underlyings.

## Known broken / deliberately skipped
- **Correction to this morning's handoff.** It stated that yesterday's peak OI cannot be obtained
  from Dhan and must be self-recorded from day one. That was wrong, and wrong in the expensive
  direction — it would have had us build a recorder for data Dhan already serves. `/v2/charts/intraday`
  with `"oi": true` gives per-candle `open_interest`, so yesterday's peak is a `max()` and 90 days
  are back-fillable. P7 needs no warm-up day.
- **Untested:** whether Dhan really retains 90 days of per-candle OI for *option* contracts, and how
  expired contracts behave (there is a separate "Expired Options Data" API). One call settles both.
- **Still blocked on the Data API plan** (`dataPlan: Deactive`, option chain -> `806`). Market Quote,
  Historical Data and the tick feed all sit behind it, so P7, P8 and P9 cannot run at all yet. The
  binary packet parser in `src/server/feed.ts` has still never seen real bytes.

## Open questions — P8 (scanner)
1. **What is "top gainer/loser" measured over?** If it is the 210-stock F&O universe itself, filters
   1 and 2 are the same filter and the scanner is 2 steps. The worked example ("maan lo 50 stock
   aaye") implies an external list instead. **This changes the architecture — answer it first.**
2. Is the 2% measured against previous close (`net_change`) or against the 9:15 open?
3. Is the 7% OI change positive-only, or absolute (|7%|)? No direction was stated.
4. Does the scanner run once at 9:20, or repeat until 9:30?
5. Does the output distinguish gainers from losers (long vs short candidates)?
6. Screen only, or persisted / alerted?
7. 9:20 or 9:25 — Rec 02 left it open, Rec 03/04/06 all say 9:20.

## Open questions — P9 (candle colouring)
8. **What separates a blue candle from a yellow one?** Both colours and both actions were given
   (blue -> buy, yellow -> sell); the conditions were not. **Biggest single gap in the whole spec.**
9. **Volume or OI?** Rec 01 says volume triggers, Rec 02 says OI. AND, OR, or OI-primary?
10. What does "vibration" mean numerically? Never defined in any of the six recordings.
11. Volume threshold value — and compared against what (previous candle, N-candle average, day average)?
12. OI threshold value — absolute contracts, or % change, and against which baseline?
13. Candle interval — 1, 5, 15, 25 or 60 min are what Dhan offers; none was chosen.
14. Which contracts get charted — ATM only, ATM +/- N strikes, or all 41? Which expiry?
15. Colour decided on candle **close** (confirmed but late) or **during formation** (early but can flip)?

## Next session starts here
- Spec-lock P8 and P9. Questions 1 and 8 first — nothing downstream of them can be designed.
- First command: `npm run check`
- Watch out for: the temptation to start building P8 because it "sounds simple". Question 1 decides
  whether it is a two-step or three-step scanner, and question 8 has no defensible default at all —
  guessing which colour means buy would put a wrong signal on a trading screen, which is the one
  failure mode this project explicitly refuses.
