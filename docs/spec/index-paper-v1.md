# P53 — NIFTY index paper book: P50's lines traded live, on paper

**Locked 2026-09-26 by delegation** (the user: "complete all the pending phases … without stopping"). Rows marked
**GUESS** state a value no source gives, and each can be vetoed in one word. **Paper only**: this code has no order
endpoint and never gets one here (P35 is the user's call). The rules are **P34's, the user's own** (P50/P51 defaults).
P52's variants are **not** traded (P52's decision: settled pieces are not stacked).

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | Instrument and chain | NIFTY, the **nearest** expiry. The chain comes from the shared `PollerHub` poller, the same one the Option Chain screen and the P47 recorder use: one more subscriber, **no new Dhan call** | CLAUDE.md: a second call inside the poll loop is a cadence bug; the recorder already keeps this poller alive 09:14–15:31 |
| 2 | One engine, live and history | The live book builds the day's **minute chain** from the snapshots: each minute's last snapshot becomes one column, and volume is turned back into per-minute volume from the cumulative. The minute's NIFTY bar comes from the feed's index ticks (o/h/l/c). At every minute close it runs **P50's `daySignals()` unchanged** over the day so far, so the 920 lines, the AI lines, the scenario and the first-touch history are the backtest's own | A live engine that re-implements the rules would drift from the one the history measured |
| 3 | Entries | **Tick-driven**: inside the forming minute, the first NIFTY tick that reaches a drawn entry line, coming from the side the last minute closed on, is the touch (P50 row 18's rule at tick resolution). The lines are the ones known at the last minute close (for AI, minute i−1's, as in P50). The vetoes are P50's `vetoOf()` in order: window, first touch, side, stop, target, ratio | "Never enter at the running price … wait at the level" (§13.4); the tick is the earliest moment the level is known to be reached |
| 4 | Books | Two, **920** and **AI**, each with **one position at a time** (P51 row 2). A touch while its book is open is recorded `busy` | V117: no averaging |
| 5 | The option and its fill | P51 row 3's strike (nearest the line, ties to the lower; one fallback toward the price), from the nearest expiry. The legs of every drawn entry line are **subscribed on the feed in advance** (at most 8 + 8 fallbacks). The fill is the **leg's last feed LTP at the touch tick**; with no tick yet, the snapshot's LTP of that strike (≤ 3 s old), recorded as `fill: 'chain'`. Neither exists → `no-price` | V17's "pre-computed premium" needs a pricer; the live LTP at the touch is the honest paper fill |
| 6 | Exits | On **NIFTY ticks**: the stop at P50's stop level, the target at its target level. At the fill: the leg's feed LTP at that tick. AI trades also exit at the **minute close** whose verdict no longer permits their side. The **time exit is at 14:30:00** (V48), also at the leg's LTP. Paper exits are never averaged or re-entered | P51 row 6 |
| 7 | Size | `lots = max(1, floor(20,000 / (premium × lot)))` with the **registry's** lot (65 today); `overBudget` when one lot costs more than ₹20,000 | DECISIONS 2026-09-25 |
| 8 | Costs | P51 row 8's option costs are computed and shown **beside** the gross P&L (the stock book's P&L is gross, P32 row 6). The net is displayed; nothing is deducted from anything real | Comparable with P51's backtest |
| 9 | Armed | Persisted, **armed by default** (GUESS: it is paper, and the user asked for everything to run). A toggle on the Paper tab disarms new entries | P32 row 10's pattern |
| 10 | Persistence | `.cache/index-paper.json` (replay: `.replay.json`, CLAUDE.md). It holds positions, the armed flag, and each day's 920 lines and used set. The day's minute columns go to `.cache/index-paper/<date>.json` at every minute close, so a restart **mid-day rebuilds** the chain and the AI state from them | CLAUDE.md: replay and live never share a persisted file. A restart must not reset the scenario to "stable" at 11:00 |
| 11 | Sleep and gaps | A gap of > 60 s between ticks while a position is open is marked on it (`blind`), like P36. There is no catch-up repricing (the option's 1-minute candles would be the way, and that is left to a later row) | Keep the first build small; the flag says when a result is not to be trusted |
| 12 | Phone | Entries and exits go through P40's `onEvent`, titled `NIFTY 920` / `NIFTY AI`. At most 4 entries a day per book (first touch caps it) | The user's phone already carries the stock book's trades |
| 13 | Where it lives | `src/server/index-paper.ts`: the pure core (`MinuteBuilder`, `IndexBook` with `onSnapshot/onTick/onClock` taking an injected clock) and a thin shell. `GET /api/index-paper`, `POST /api/index-paper/arm`. A read-only section on the Paper tab. `npm run ipaper:test` | The paper-trader pattern (P32) |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | The minute builder turns a stream of snapshots into a `ChainDay` whose `daySignals()` output equals the output from the same minutes built directly (per-minute volume recovered from cumulative to the unit) |
| AC2 | On a scripted session (synthetic snapshots + ticks, injected clock): a 920 line is touched by a tick, the position opens at the leg's feed LTP, and its target tick closes it; a second touch of the same line is `used`; a touch while the book is open is `busy` |
| AC3 | Every exit on the scripted session: stop, target, 14:30 time exit, AI state change; and each veto (window, used, side, ratio) rejects one scripted touch |
| AC4 | **Live and backtest agree**: replaying a real stored day (P48 chain + P50 index bars) through the live core, tick = minute bar path (o → h/l → c), gives the same **first entry of each book each day** (line, minute) as P51's `tradeDay` with the `touch` fill (amended at build: later entries can differ by design, because the live book exits on ticks inside the entry minute where P51 waits for the next minute, which changes what is `busy`; the full-list agreement is printed) |
| AC5 | Restart mid-day: a book rebuilt from the saved minute columns at 11:00 has the same lines, scenario and used set as one that never stopped |
| AC6 | Replay server: `/api/index-paper` answers, the Paper tab shows the section with zero console errors, `/index-paper` files use `.replay.json`. **Screenshot** |
| AC7 | No order endpoint is imported or called (grep: nothing from `dhan.ts` except types); tsc clean; `paper:test`, `ltplines:test`, `ltpbt:test` still pass |
| AC8 | **Live, Mon 28 Sep (open):** the book draws the 920 lines at 09:21 and logs every touch with its veto. Measured in the next session, not claimed here |

## Result (2026-09-26, built on `p53-index-paper`)
- `npm run ipaper:test` **14/14** on real stored days replayed through the live core with an injected clock.
  - **AC1:** the minute builder's ChainDay gives the same 920 lines, AI lines, verdicts and signals as the stored day
    (4 Jun 2024, 375 minutes), and it recovers per-minute volume to the unit.
  - **AC2/AC3:** over 16 days picked from P51's own trades (target, stop, time, state, busy days) plus 1–7 Aug 2026,
    the book took 12 trades from tick touches. It refused touches as `used` (47), `window` (178), `ratio` (13) and
    `busy` (1), and it exited by target 5, stop 3, time 2 and state 2. `side` never fired (P50 measured 2 in 680 days).
  - **AC4:** the first entry of each book each day equals the backtest's on **12/12** book-days, and on those days the
    whole entry lists are identical too.
  - **AC5:** a book rebuilt at 11:00 from the saved minute columns matches the one that never stopped.
  - **AC7:** nothing is imported from `dhan.ts`.
- **AC6** (`.cache/p53-ui-verify.js`) **6/6** on a replay server:
  - `/api/index-paper` answers and the section renders with its status;
  - arm and disarm both work;
  - replay writes `index-paper.replay.json` and never the live file;
  - zero console errors.
  - Two screenshots: idle, and a populated state seeded from 5 May 2026 replayed through the core, where EOS−1 hit its
    target for +₹8,334 net. The seed was moved out of `.cache` afterwards.
  - Two presentation fixes came from the screenshot: the notes are indented to match the tables, and touches after the
    entry window are counted in one line instead of listed one by one.
- **AC7:** tsc clean, `paper:test` 104/104, `ltpbt:test` 27/27, `ltplines:test` 65/65.
- **Live:** 8787 restarted at 21:15 on build `f44322e`: one listener, 0 EADDRINUSE. `/api/index-paper` is armed and
  idle until 09:14. The stock Paper trader is still armed, and the token was renewed to 27 Sep 20:46 IST.
- **AC8 is open:** Monday 28 Sep is the first live session. Read `/api/index-paper` (or the Paper tab) after 09:21 for
  the 920 lines, and after 15:31 for the touches and trades. A server that is not running then trades nothing.

**Known limits, stated:** the fill is the leg's feed LTP at the touch tick, not a limit at a pre-computed premium (row
5). A blind gap is flagged but not repriced (row 11). The phone gets index entries and exits (row 12, a GUESS; veto in one word).
