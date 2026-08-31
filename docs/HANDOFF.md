# HANDOFF — Dhan Option Chain Terminal — Phase 8/9 spec lock + P10 boarded — 2026-08-31

## Done
- **P8 and P9 are spec-locked.** Two files, 36 locked rows between them, approved with one `go`.
  All **15 open questions are closed** — a future session can build both from the files alone.
- The two questions the previous session called undecidable are answered **from the material,
  not invented**:
  - **"top gainer/loser" = the 210-stock F&O universe's own top 50 gainers + top 50 losers.**
    The 50 comes from the user's own worked example ("maan lo 50 stock aaye"). DhanHQ v2 has no
    gainer/loser endpoint and `nseindia.com` is unreachable from here, so no external list exists
    to use even if one were wanted. The three filters stay distinct: `210 -> 100 -> n -> m`.
  - **blue = `dOI > 0` = a big player entering the strike = buy; yellow = `dOI < 0` = exiting =
    sell.** Read off the board's own wording ("a big player entering or exiting a strike"), not
    guessed. The spec names row 8 as the row to revisit first if the screen ever looks backwards.
- The **Rec 01 / Rec 02 contradiction is resolved as AND**, not by picking a side: OI cannot move
  without volume, so `OR` collapses into the OI test alone and Rec 01 stops meaning anything.
  **"Vibration" is now exactly one number** — `vol >= 3.0 x median(previous 20 candles)` — and is
  in the glossary so it cannot be redefined later.
- **Two build prerequisites surfaced by writing the specs against the real code**, both one-liners
  a session could otherwise lose an hour to: `FUTSTK` is missing from `KEEP_INSTRUMENTS`, so stock
  futures OI is unreachable and P8's third filter cannot work without it; and both new
  `public/*.js` files need `STATIC` allow-list rows or they 404 as a dead client.
- **P10 (terminal UI redesign) boarded** at the user's request and explicitly ordered **last**,
  after the recording-derived phases. Left unlocked on purpose.
- Branch **`p8-p9-spec-lock`** pushed, commit `3a86909`. **PR not opened.**

## Files changed
- `docs/spec/scanner-v1.md` — **new.** 17 locked rows, out-of-scope list, 7 acceptance criteria, 4 risks.
- `docs/spec/option-candles-v1.md` — **new.** 19 locked rows, out-of-scope list, 8 acceptance criteria, 4 risks.
- `docs/spec/GLOSSARY.md` — 7 terms appended: F&O universe, the funnel, OI baseline, long/short
  candidate, vibration, fired, entering/exiting a strike.
- `docs/PHASES.md` — P8 and P9 flipped to **spec locked** with their real done-when criteria;
  **P10 row added**; `## Now` and `## Next 3` rewritten; session log row added.
- `docs/DECISIONS.md` — five entries appended, one of them superseding the 2026-08-28 decision that
  left the gainer/loser question open.
- `CLAUDE.md` — the bash-heredoc trap that cost a step this session.
- **No `src/` changes.** Nothing in the application code was touched.

## Decisions made
- **Both undecidable questions were answered rather than escalated**, because both had an answer
  sitting in the material — the user's worked example for one, the board's own sentence for the
  other. Neither is a number pulled from nowhere, and the one that is a *reading of intent*
  (blue/yellow) says so in its own row and isolates itself so flipping it is a one-line change.
- **Volume AND OI, never OR.** See DECISIONS 2026-08-31.
- **P8 and P9 got their own spec files rather than one combined spec.** They are two systems that
  share nothing but an endpoint; a merged file would be read by two different future sessions.
- **P10 is boarded last and stays unlocked until its turn.** Locking it now would write a spec
  against a screen about to grow a peak-OI column, a scanner overlay and a candle chart mode —
  guaranteed churn. It is also ~12 files against the 8-file rule and splits into P10a / P10b.
- **This branch is stacked on `p6-chart-tools` on purpose.** The PHASES / DECISIONS / GLOSSARY
  edits build on the P6 versions of those files; branching from `main` would have silently dropped
  P6's doc content.

## Known broken / deliberately skipped
- **Two PRs are open-able and neither is opened.** `p6-chart-tools` (the P6 build) and
  `p8-p9-spec-lock` (docs only). **Merge P6 first** — the second is stacked on it.
- **No code was written for P8 or P9**, and none should be until the Data API plan is active.
- **Everything live is still blocked.** `dataPlan: Deactive`, option chain returns `806`, and
  `src/server/feed.ts`'s binary packet parser has still never seen real bytes.
- **Two numbers in the new specs are assumptions, flagged in their risk sections**, and one live
  call each settles them: the `/v2/charts/intraday` rate limit (1000 ms assumed, copied from the
  existing `ohlc` call) and whether option `open_interest` is reported in **contracts or units**
  (which decides whether P9's lot floor is `5` or `5 x lotSize`).
- **`docs/shots/` still holds the 17 pre-P6 reference images.** Now explicitly P10's problem — a
  redesign invalidates them anyway. `npm run shots` overwrites all 17, so it stays deliberate.
- **P10 has no spec at all**, by design. Do not start it. Three things must become numbers first:
  what "TradingView-like" fixes, what the latency panel's new form is, and how the P2-P6
  acceptance criteria get re-proved against a rebuilt screen instead of quietly dropped.

## Next session starts here
- Phase 7: **peak-OI tracking** — the smallest of the three blocked phases, and the one whose
  fetcher and `(securityId, sessionDate)` cache P8 then reuses for its OI baseline. Still gated on
  the Data API plan; if it is still `Deactive`, there is **no unblocked build work left** — the
  honest move is to open the two PRs and stop.
- First command: `npm run check`
- Watch out for: **a valid token is not data access.** `DH-906` / `808` means the token is dead;
  `806` with `dataPlan: Deactive` means the token is fine and the *account* has no Data API plan,
  which no amount of re-pasting fixes. `npm run check` prints which of the two you are looking at.
  Second trap: **do not start P10 because the specs look finished.** It runs after P9, by
  instruction, and unlocked specs are not a licence to begin.
