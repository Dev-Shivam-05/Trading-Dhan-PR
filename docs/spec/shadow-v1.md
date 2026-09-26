# P45 — Shadow-trading P44's recommended setting on days it has never seen

**Locked 2026-09-26 by delegation** (the user: "complete all the pending phases … without stopping"). The board row said
"needs the user's word to start". The user's instruction of 2026-09-26 is taken as that word **for a shadow only**. **No
live or paper rule changes** (P37 row 13; memory: delegated decisions).

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | What is shadowed | Three settings, side by side: the **baseline** (the live rules minus the OI filter, P44 row 12), the **recommended** `chg0/either/r3/sma20/x3/SL/noT/nofrz` (the last training report's pick), and its **`T2R` twin** (the pick the spec's text and the board row still name). Every one is computed under **both** fill models | P44's report moved the pick from T2R to noT, and says the two are "the same strategy for any practical purpose". Shadowing both removes the question instead of guessing it |
| 2 | Which days | Only sessions **after 2026-09-25**, the last session the recommendation was trained on. The first is **Mon 28 Sep** | A forward test is only a forward test on unseen days |
| 3 | How (**deviation from the board row, declared**) | Not a second live trader on the feed. **P44's own engine** (`train.ts` `runGrid`) is run each evening on the day's 1-minute cash candles, the same data and code that produced the recommendation. The live stock book keeps running untouched beside it | A live re-implementation of `r3/sma20/x3/either` would be a second, untested copy of the rules. Running the trained engine on new days tests exactly what was recommended |
| 4 | When | Inside the live server, after the nightly backtest (P37 row 14, at or after 16:00 IST): fetch the missing cash history (`updateTrainData`, about 210 calls on one gate key), then compute. `npm run shadow` does the same by hand. Replay refuses | One process owns the token (CLAUDE.md) |
| 5 | Output | `.cache/history/shadow-report.json`: per setting and fill, the per-day net and trade count and the running total. `GET /api/shadow`. A card on the Paper tab | P38's panel reads the same routes |
| 6 | What it does not do | No option leg (P44 did not model it); no OI filter (P44's baseline has none); lot sizes are today's | P44's stated limits carry over unchanged |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | `computeShadow()` over a past range equals `runGrid()` for the same sessions, settings and fills, to the paisa |
| AC2 | No session on or before 2026-09-25 ever enters the shadow (tested with a since-date in the past, and with the real one) |
| AC3 | `/api/shadow` answers from a replay server, and the Paper tab card shows the empty state ("first forward session: Mon 28 Sep, after 16:00"). **Screenshot** |
| AC4 | The shadow code imports nothing that can place an order, and the nightly step refuses replay mode |
| AC5 | **Live, Mon 28 Sep after 16:00:** the report holds 28 Sep for all 3 × 2 rows. Measured in the next session, not claimed here |

## Result (2026-09-26, built on `p45-shadow`; the panel in P38)
- `npm run shadow:test` **6/6**.
  - **AC1:** `computeShadow` over 11–25 Sep equals `runGrid` for 3 settings × 2 fills to the paisa (10 sessions, 452 trades).
  - **AC2:** no session on or before the since-date enters the shadow; with the real date, 0 forward sessions are on disk.
  - **AC4:** only a type comes from `dhan.ts`, and the step refuses replay.
- **AC3:** `/api/shadow` answers on a replay server, and the Paper tab shows "First forward session: Mon 28 Sep, after
  16:00" (P38's check, 9/9).
- **Live:** 8787 restarted on build `7c20f4b`. The shadow runs inside the nightly job after the backtest (at or after
  16:00 on a weekday). **AC5 is open until Mon 28 Sep after 16:00.**
