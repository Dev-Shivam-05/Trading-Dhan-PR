# P47 — NIFTY chain recorder

**Locked 2026-09-25.** The owner's answers:
- "Nifty hi chahiye" (NIFTY only; FINNIFTY and MIDCPNIFTY are dropped from the plan's P47);
- "okay start kijiye".

The plan is `docs/plan/ltp-index-intraday.md` §5. Values not stated by the owner or measured are marked **GUESS**.

## Why
The LTP Calculator's pressure (5 states), SOC and Game of Percentage all read a level's **history through the day**,
never one snapshot (`05-CONSOLIDATED-LOGIC.md` §6.1, §27). Dhan sells no historical chain snapshots. P48 rebuilds past
days at 1-minute resolution from `rollingoption`; this recorder keeps the live **3 s** resolution from now on, and
gives P48 a day to check its rebuild against.

## Rows
| # | Row | Value |
|---|---|---|
| 1 | What and when | NIFTY's chain for the **current and the next expiry** (the first two expiries on or after today; on expiry day, that expiry is still current). Weekdays **09:14–15:31 IST**, the tick recorder's window. **Live only**: replay chains are synthetic |
| 2 | Source | The existing `ChainPoller`, through `hub.get(NIFTY, expiry).subscribe()`. **No new endpoint.** For the expiry already on screen it adds no call at all. The next expiry adds one poller, at the documented 1 request / 3 s per (underlying, expiry) |
| 3 | Strikes kept | **±20 strikes around the snapshot's ATM** (the strike nearest spot), cut at the ladder's ends, never padded. **GUESS / design choice:** Dhan's full ladder is 231–269 rows (about 100 KB per snapshot, about 0.75 GB a day for two expiries). ±20 is 1,000 NIFTY points each side, twice P48's rebuild width, and wide enough for the LTP scan to find a far highest OI |
| 4 | Fields | Per snapshot: `t` (received, epoch ms), `spot`, `src` (quote / chain), `atm`, `atmIv`, `req` (the poller's request id), and `rows` as tuples `[strike, ceLtp, ceVol, ceOi, ceOiChg, ceIv, peLtp, peVol, peOi, peOiChg, peIv]`. Greeks are not kept: they follow from IV. The previous close's OI is `oi − oiChg` |
| 5 | Duplicates | A snapshot re-emitted with the same request id (P7's peak refresh) is written once. A replay snapshot is never written |
| 6 | Files | `.cache/chains/<date>/NIFTY-<expiry>.jsonl`, one line per snapshot. Measured on 25 Sep's real snapshots: about 4 KB each, so about 30 MB raw per expiry per day |
| 7 | Close | At 15:31 the buffers are written, `summary.json` records snapshots, first, last and the largest gap per expiry, and both pollers are released. `npm run ticks:pack` now packs closed chain days too (same SHA-256 check) |
| 8 | Failure isolation | A write or step failure is logged and never takes the live server down (the tick recorder's 25-Sep lesson). One step at a time |
| 9 | Keep-awake | Covered by P46, since the chain recorder's window is the tick recorder's |

## Acceptance criteria
| # | Criterion | Status |
|---|---|---|
| AC1 | Clock rules: nothing at 09:13:59; both expiries subscribed at 09:14; nothing starts while the registry has no expiries (a retry follows); still on at 15:30:59; released at 15:31; nothing on a Saturday; the expiry itself counts as current on its own day; a date change inside the window closes the old day and opens the new one | `chainrec:test` |
| AC2 | ±20 around the ATM (41 of an 81-row ladder), cut at the ends, and every tuple equals its snapshot field by field | `chainrec:test` and `.cache/p47-live-shape.ts` on real snapshots |
| AC3 | Duplicates and replay snapshots are not written; `summary.json` counts are right | `chainrec:test` |
| AC4 | `ticks:pack` packs a closed chain day, verifies it, and leaves an open one alone | Scratch `CACHE_DIR` run |
| AC5 | **One full live day:** both expiries recorded 09:15–15:30, the largest gap ≤ 10 s outside laptop sleep, counts printed | **Mon 28 Sep, unmeasured until then** |
