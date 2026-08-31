# SPEC LOCK — P7 peak-OI tracking

Status: **locked and built** 2026-08-31. Approved with `go`; rows 21 and 22 were added during the
build and are marked as such. Verified in `REPLAY=1` only — the live path has never run, because
the Data API plan is inactive and the token expired 2026-08-28.

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table.

## What it is

Dhan's option chain returns `previous_oi` = yesterday's **closing** OI. That hides the day's real
high-water mark: a strike that built 4.2 L of OI at 13:45 and closed at 2.1 L looks half as busy as
it was. P7 fetches yesterday's **peak** OI per contract from the candle endpoint, puts it in the
grid next to live OI, and flags the moment live OI crosses it.

    peak(contract) = max(open_interest) over the previous session's 1-minute candles
    breach         = live OI  >  peak

## Decision table

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | Which day is "yesterday" | The previous **trading** session, derived from the data: the latest IST date strictly before today that has candles. No holiday calendar, no weekday arithmetic | A hardcoded `today - 1` is wrong every Monday and every exchange holiday. The candle series already knows which days traded |
| 2 | How that date is found | **One** `POST /v2/charts/intraday` on the **underlying** (`interval: 1`, `oi: false`, `fromDate` = today − 7 calendar days, `toDate` = today), bucketed to IST dates. `instrument` is `INDEX` for `IDX_I`, `EQUITY` for `NSE_EQ`, `FUTCOM` for `MCX_COMM`. Cached per `(instrumentId, todayIso())`. If it fails, fall back to the same 7-day window on the first contract | 7 days covers a two-day exchange holiday plus a weekend. One call per instrument per day, not one per contract, and the trading calendar is identical across every contract on that exchange |
| 3 | Candle interval for the peak | **1 minute** | The board row says 1-min. It is the finest resolution the endpoint offers, so the peak cannot be smoothed away by bucketing |
| 4 | Fetch window per contract | `fromDate` = the date from row 1, `toDate` = today. `exchangeSegment` = the contract's own segment from `optionContracts()`, `instrument` = `OPTIDX` / `OPTSTK` / `OPTFUT`, `"oi": true` | About 750 candles per contract instead of the ~2,600 a 7-day window would return, and `toDate` = today avoids depending on an untested `fromDate == toDate` request |
| 5 | What "peak" is, exactly | `Math.max(...open_interest[i])` over **only** the candles whose IST date equals the row-1 date. Today's candles are fetched (they arrive in the same window) and are **discarded** for this purpose | The number must mean "yesterday's high-water mark". Letting today's OI leak in makes the breach test compare a value against itself |
| 6 | Which contracts get a peak | Every strike in the **current snapshot**, both CE and PE — 82 contracts for a 41-strike NIFTY chain. Fetched **ATM-outward**, so the strikes being read fill first | Matches how the tick feed already picks contracts (`syncContractSubs`): the master's several hundred strikes are not on screen and must not be fetched |
| 7 | Rate limiting | Every call goes through `dhanPost` with the **one shared** slot key `peak:oi`, `cadenceMs: 1000`, so the backfill is strictly serial. The chain poll's own 3 s key is untouched | `waitForSlot` is per key — a key per contract would fire all 82 at once and trip the 1 req/s quote limit. Same shared-key pattern as `scanner-v1.md` row 4 |
| 8 | Cache | `.cache/peak-oi.json`, key `` `${sessionDate}|${securityId}` ``, value `{ peak, at, candles }`. Entries older than **7 days** pruned at load. Never re-fetched once present | Yesterday's peak is a historical fact and cannot change. Mirrors the existing `BaselineStore` in `poller.ts` and P6's stale-key pruning |
| 9 | When the backfill runs | Starts on the first snapshot of a subscribed (instrument, expiry) and stops with the poller — the existing 30 s unsubscribe grace applies. No timer, no prefetch of unopened chips | Contains the ~82-call cost to what the user is actually looking at. Six chips would otherwise cost ~490 calls a day for screens nobody opened |
| 10 | How it reaches the browser | On the SSE `snapshot` frame as `peaks: { [strike]: { ce, pe } }` and `peakProgress: { done, total, skipped }`. **No new route and no new `public/*.js`** | A separate `public/*.js` would need a `STATIC` allow-list row or 404 as a dead client. Riding the snapshot also keeps `derive.ts` pure — it derives from the chain response and nothing else, so its P1 acceptance criteria are untouched |
| 11 | The grid column | One per side, header `Pk %`, **48px**, inserted between `OI` and `OI Chg`, mirrored on PE. Value `Math.round(oi / peak * 100)` with a `%` suffix, `--fg-muted`, tabular | Adjacent to the OI it is a ratio of. A percentage is readable at 48px where a second abbreviated OI figure is not |
| 12 | The absolute peak figure | Not a column. The cell's `title` reads `peak 4.21 L at 13:45 · 28 Aug` using the existing `abbr()` | A 25th and 26th numeric column costs more width than the number is worth; the exact figure is a hover away |
| 13 | Breach highlight | `oi > peak` strictly. The `Pk %` cell turns `--warn`, weight 700, prefixed `▲`, on a `--accent-wash` background; the OI bar gains a 1px `--fg-faint` marker at the peak's position. `oi === peak` reads `100%` and is **not** a breach | `--warn` already exists and means "notable, not broken" on this screen. Red would collide with `--down`, and the accent already means OI bar and drawing |
| 14 | Breach must follow ticks, not just polls | `applyCellTick()` recomputes `Pk %` and the breach class from the same `it.o` it already writes into the OI cell | The OI cell updates at 10 Hz from the feed while the chain poll is 3 s. Leaving `Pk %` on the poll would print 97% next to an OI that has already crossed — exactly the silently-wrong number this project refuses |
| 15 | The filter | A `Breached` toggle button in the header strip, keyboard **`P`**, hiding rows where neither side breached. Reuses the existing `hidden` class and **ANDs** with the strike search | `P` collides with nothing: `1-9`, `/`, `L`, `T`, `E`, `C`, `Home` and P6's `V D H R B Esc Delete` are taken, `S` is reserved by P8 |
| 16 | Missing peak | `—`, never `0%`, never `NaN`. The `title` says why: `no candles for 28 Aug`, `request failed (806)`, `not fetched yet`. Counted in `peakProgress.skipped` | `option-chain-v1.md` row 14. A blank cell is indistinguishable from a rendering bug at this density |
| 17 | Backfill progress | A `PEAK OI 24 / 82` chip in the header stat strip, hidden once `done === total` and `skipped === 0`; otherwise it stays as `PEAK OI 80 / 82 · 2 skipped` | A column that fills in over 80 seconds looks broken without a count next to it |
| 18 | GOLD / MCX | Attempted like any other contract with `instrument: OPTFUT`. If Dhan rejects it, every GOLD cell degrades to `—` with the error in the tooltip and the chip reads `82 skipped` | MCX intraday-with-OI is unverified. Declaring it out of scope in advance would be guessing in the other direction; degrading is honest either way |
| 19 | Replay behaviour | `REPLAY=1` synthesises the **full candle payload** — `timestamp` + `open_interest` arrays for 375 1-minute candles across the previous session and today — from a fixed seed per `(securityId, date)`. The peak comes out of the **same `max()` code path** as live. Seeded so that **exactly 5** contracts (3 CE, 2 PE) are breached on the first NIFTY snapshot | Synthesising the peak directly would test nothing. Synthesising the series means the done-when criterion ("peak equals the hand-computed max") is checkable today, and the live path differs only in transport |
| 20 | Cost of the column in width | `table.oc` min-width goes **1392px → 1484px**. Below that the grid scrolls horizontally, which is already its behaviour with the latency panel open | 44px of horizontal scroll at 1440px. If that is unacceptable, the cheapest trade is dropping `Vol Chg%` (56px × 2 = 112px) — say so and it goes. P10 owns the final column layout either way |
| **21** | **Added during the build.** What updates the column between polls | The store fires on every contract that lands; the poller re-emits its **last snapshot** with the new peaks, throttled to **750 ms** | On a **closed market** the poller takes one snapshot and then only re-checks the session every 60 s — it never emits again. Without this the column would stay empty until the next trading day for anyone who opens the app after 15:30. During a session the 3 s poll would carry the peaks anyway, so this costs nothing there |
| **22** | **Added during the build.** What OI the replay tick feed prints | Seeded from that contract's OI in the snapshot (`oiBase` on the subscription) and random-walked **±0.2% per tick**. Replay chain OI drift also changed from a flat `900/poll` to **0.025%/poll of the contract's own OI** | The feed drew a fresh uniform random `1e5 + rand*4e6` for **every contract on every tick**, so a strike's OI teleported between 1 L and 41 L ten times a second with no relation to the chain. Any ratio taken against it — which is exactly what `Pk %` is — was noise. The flat chain drift had the same flaw at the wings: +900/poll on a 24 K strike is +3.7%, so a wing crossed any fixed peak within minutes |

## Out of scope (will NOT build)

- Peak OI for the **underlying or its futures** — that is `scanner-v1.md` row 7, and it uses the closing OI, not the peak
- Peak OI for any session before yesterday, or a multi-day peak
- Charting the intraday OI series, or a peak-OI sparkline
- Alerts, sound or notifications on a breach
- Expired contracts (there is a separate "Expired Options Data" API)
- Building peaks from the WebSocket tick feed — it would only ever know the session it was running for
- Persisting breaches, or a breach history log

## Acceptance criteria (binary, testable in `REPLAY=1`)

- [ ] For one contract, `peaks[strike].ce` equals `Math.max(...open_interest)` recomputed by hand from that contract's previous-session candles in the replay payload.
- [ ] Injecting a candle dated **today** with an OI far above the peak does not change `peaks[strike].ce`.
- [ ] Exactly **5** cells are breached on the first rendered NIFTY snapshot — 3 CE, 2 PE.
- [ ] A synthetic tick pushing one contract's OI above its peak flips that cell to breached inside one 100 ms tick batch, with no full grid re-render.
- [ ] `Breached` on shows exactly the breached rows; with `24500` also typed in the search it shows the intersection, not the union.
- [ ] The chain poll's minimum gap stays at or above **3000 ms** across a full cold backfill, read from `/api/telemetry.csv`.
- [ ] A contract with no peak renders `—` with a reason in its `title`, and the chip's `skipped` count equals the number of such contracts.
- [ ] Cold backfill of an 82-contract chain completes in **≤ 90 s**; a second run with the cache warm issues **0** calls and the column is fully populated on the first snapshot.
- [ ] Screenshots in both themes: column populated, a breached row, the backfill chip mid-fill, the `Breached` filter on.

## Verification — `REPLAY=1`, 2026-08-31, 1440x900

23/23 checks pass: 7 against the SSE payload (`.cache/verify-peak.mjs`) and 16 in the browser
(`.cache/shots-peak.mjs`). Both harnesses recompute the number and compare; neither trusts a field
because the server sent it.

| Criterion | Measured |
|---|---|
| AC1 peak = hand-computed max | NIFTY 23100 CE: **52,884 = 52,884** over 375 candles. GOLD 156500 CE: **136,909 = 136,909** |
| AC2 today's candles excluded | a today-dated candle at **99x** the peak leaves it at 52,884 |
| AC3 exactly 5 breached | **3 CE, 2 PE** in the payload and **5** cells on screen, all carrying `▲`, at the seeded offsets (NIFTY 24000/24150/24300 CE, 23950/24350 PE) |
| AC4 tick path | 3 distinct OI values over 9 s on GOLD, **0** cells inconsistent with their OI and tooltip peak |
| AC5 filter | Breached alone → 5 rows; Breached + `23950` → **1** row; Breached + a non-breached strike → **0** rows. `P` toggles it |
| AC6 chain cadence | **min 3133 ms** per key across 10 gaps / 12 calls **while the backfill ran** |
| AC7 no lies | 82/82 cells agree with the OI cell and the tooltip peak within 2pp of abbreviation rounding; **0** cells read `0%`, `NaN` or `Infinity` |
| AC8 cold / warm | cold **6.5 s** for 82 contracts (NIFTY), **5.0 s** for 62 (GOLD); warm cache serves **82/82 on snapshot 1** with 0 calls |
| AC9 screenshots | 6 reviewed in both themes: column populated, breached row, mid-fill chip at `PEAK OI 9 / 82`, filter on |
| — | 25 cells / 25 cols / colspan 12+12, table **1484px**, 82 peak markers on the OI bars, **zero** console errors |

Two numbers here are replay artefacts, not measurements of the live path: the cold backfill time
(replay has no transport, so a 60 ms delay per contract stands in for the 1 req/s slot key — live
is bounded at ~82 s for 82 contracts), and every OI value on the screen.

## Risks

- **The `/v2/charts/intraday` response shape is unverified against a live plan.** The parser expects parallel arrays including `timestamp` (epoch seconds) and `open_interest`. One live call settles it, and it is the same call `scanner-v1.md` and `option-candles-v1.md` both depend on.
- **Whether `IDX_I` and `MCX_COMM` are accepted by that endpoint** is untested — rows 2 and 18 both degrade rather than fail, but the fallback path has never run.
- **~82 calls per (instrument, expiry, day) cold.** If Dhan enforces a daily quota, this is the first phase that will find it. The disk cache means the cost is paid once per day per screen.
- **`open_interest` units (contracts vs units)** affect only the tooltip's absolute figure, not the ratio or the breach.
- **44px of horizontal scroll at 1440px** — row 20, and the one row with a ready-made alternative.

Reply `go` to build all of it, or `change 11,20` with your values.
