# P48 — NIFTY historical chain rebuild

**Locked 2026-09-25.** The owner's answer: "run whatever download you want I approved it — I just want the system to
be working". Two amendments made during the build are listed at the end. The plan is
`docs/plan/ltp-index-intraday.md` §5 (P48 row), narrowed to **NIFTY only** by the 2026-09-25 decision (§8.2).
Values that were not stated by the owner or measured are marked **GUESS**.

## Why
P49's state machine and P51's backtest read a level's history through the day. Dhan sells no historical chain snapshots,
and P47 records only from Mon 28 Sep onwards. `POST /v2/charts/rollingoption` returns, for each minute, the option that
sat at a given offset from the ATM. Stitching ATM−10…ATM+10 on both sides back together rebuilds a minute chain.

## Measured before the spec (2026-09-25, 20:10–20:20 IST; `.cache/p48-probe.ts`, `.cache/p48-probe2.ts`, raw bodies in `.cache/p48/`)
| # | Question | Answer |
|---|---|---|
| M1 | What `expiryCode` selects | 1-based. `WEEK` 1/2/3/4 on 25 Sep gave the 29 Sep, 6 Oct, 13 Oct and 19 Oct contracts (final OI within 0.2–4.7% and last price equal to the bhavcopy's for exactly one expiry each time). `MONTH` 1 gave 29 Sep and `MONTH` 2 gave 27 Oct. `expiryCode: 0` returns `DH-905 expiryCode is required` |
| M2 | How it rolls | Per day. On the expiry day itself, `WEEK 1` is still the expiring contract (22 Sep: ATM CE closed at 0.05 with OI 22.6 M). It moves to the next contract on the following session |
| M3 | Offset limit | ±10 exactly. `ATM+10` returned 385 candles. `ATM±11`, `±12`, `±15` and `±20` return **ok with zero candles**, not an error |
| M4 | Span per call | 32 days worked (23 sessions, 8,855 candles). Dec 2023 worked too |
| M5 | Candles per day | 385 (09:15–15:39) in Sep 2026, and 375/376 (to 15:29/15:30) in Jan 2024. 20 Jan 2024 (a Saturday special session) is present |
| M6 | Volume unit | Units. Summed over the day, it equals the bhavcopy's `TtlTradgVol` (contracts) × 65, within **0.0104%** on all 38 legs that were covered for all 385 minutes |
| M7 | Final OI and price | The last candle's OI is off NSE's bhavcopy by up to **5.01%** (this is P56's known EOD gap). Its close equals the bhavcopy's `LastPric` on 12/38 legs and is up to 2.30 away on the rest |
| M8 | Size | One series-day is 29 KB of JSON, or 10 KB gzipped |

## Rows
| # | Row | Value |
|---|---|---|
| 1 | Underlying and depth | NIFTY (`securityId 13`, `OPTIDX`), **ATM−10…ATM+10 × CALL/PUT = 42 series**, all 9 `requiredData` fields (open, high, low, close, iv, volume, strike, oi, spot). ±10 is the endpoint's ceiling (M3) |
| 2 | Expiries | **`WEEK 1` from 2024-01-01 to the last complete session.** **`WEEK 2` from 2026-09-01 only**, so both of P47's recorded expiries can be checked. **GUESS / design choice:** the full `WEEK 2` history doubles the disk (row 6) and no boarded phase reads it. It can be added later with one flag |
| 3 | Calls | One call per (series, calendar month). A month is at most 31 days, which is inside M4. That is about 42 × 33 = 1,386 calls for `WEEK 1` plus 42 for `WEEK 2`, at 1,100 ms on the **`history`** gate key (P37/P44's key and cadence, so it queues behind the 16:00 job). **Estimate: about 27 minutes** |
| 4 | When | Only complete sessions: before 16:00 IST today is never fetched (P44's rule). It is a CLI, `npm run chainhist`, run by hand after 16:00. It is **not** wired into the live server in P48 (that would be a second 16:00 job, and a new row on the board). Replay mode refuses to run |
| 5 | Stored shape | One file per (day, expiry code): `.cache/history/chains/NIFTY/<YYYY-MM-DD>-W<code>.json.gz` holding `{date, code, expiry, t[], spot[], atm[], legs: {"<strike>CE"/"<strike>PE": {o,h,l,c,v,oi,iv}}}`. Each leg's arrays align to the day's `t[]`, with `null` for the minutes when that strike sat outside ±10. `atm[i]` is the offset-0 strike. A strike seen under two offsets in one minute must agree field by field, or the day is marked `conflict` |
| 6 | Disk | About 660 sessions × 42 × 10 KB ≈ **0.28 GB** for `WEEK 1`, plus about 8 MB for `WEEK 2`. D: has about 5 GB free, and the tick recorder needs about 1.2 GB a day before packing. **The run refuses to start below 2 GB free (GUESS: the tick recorder's single-day need, plus margin)** |
| 7 | Resume | A day is written only when all 42 series returned it. A stored day is never fetched again. An interrupted run resumes at the first missing month. A retryable failure (805, a timeout) gets two more tries 3 s apart (P44's `withRetry`) |
| 8 | Expiry label | Each stored day carries the expiry date of its `WEEK 1` contract. That date comes from the weekday rule (**Thursday up to 2025-08-28, Tuesday from 2025-09-01**, moved to the previous session when that day has no candles). **GUESS**, from NSE's circular as I remember it, **checked by data in AC4**, not trusted |
| 9 | Test seam | `dhanPost` is injected, so `chainhist:test` runs without the network: stitching, the null gaps, conflict detection, resume, the refusal in replay and the disk guard |

## Acceptance criteria
| # | Criterion | How | Result (2026-09-25) |
|---|---|---|---|
| AC1 | M1–M8 are written in this spec from real calls | Probes | **PASS**: they are listed above |
| AC2 | **Volume:** for 25 Sep, every leg covered for all minutes sums to the bhavcopy's `TtlTradgVol` × `NewBrdLotQty` within **0.05%** (**GUESS: 5× the 0.0104% measured in M6**) | `chainhist-verify --bhav` | **PASS**: `WEEK 1`, 38 legs, worst 0.0104%. `WEEK 2`, 36 legs, worst 0.0191% |
| AC3 | **Against P47's recording** (the first session is Mon 28 Sep, **unmeasurable before 15:31 that day**). For every minute M and every strike K present in both: (a) the set of strikes rebuilt is inside the recording's ±20; (b) the recording's last LTP inside minute M lies inside that candle's `[low, high]` on **100%** of cells (an invariant, not a tolerance); (c) the recorded OI equals the candle OI of minute M or M−1 on **≥ 99%** of cells (**GUESS**); (d) the day's last recorded cumulative volume equals the summed minute volume within **0.05%** on legs covered all day. Both expiries (`WEEK 1` and `WEEK 2`) | `chainhist-verify --recording 2026-09-28` | **OPEN**: unmeasurable before Mon 28 Sep 15:31. The comparison logic is tested in `chainhist:test` |
| AC4 | **Expiry labels:** every calendar label is checked against the data (amendment A3). Every disagreement is listed by date. Zero are left unexplained | `chainhist-verify --expiries` | **PASS** after A4: 680 sessions, 143 expiries, 0 calendar errors. 2 days have one signal disagreeing: 18 Jan 2024 (cheap leg 12.25, but OI broke +261%) and 2 Aug 2024 (the gap-down morning of 5 Aug, 4 legs). **Before A4 it found a real error:** Diwali 2025 |
| AC5 | **Coverage is printed, not thresholded:** per day, how many strikes are covered for every minute, and how many days moved more than 10 strikes from the opening ATM (the plan's §9 trend-day risk) | `chainhist-verify --coverage` | **Printed**: 680 `WEEK 1` days, 2024-01-01 to 2026-09-25. Legs covered 09:15–15:29: min 0, **median 34**, max 44. **7 of 680 days (1.0%)** moved more than 10 strikes; the worst was 4 Jun 2024 (election results, 29 strikes, 0 full legs). One day has conflicts (18 May 2024, the Saturday DR session: 90 cells) |
| AC6 | `chainhist:test` is green. A second full run fetches **0** calls. The run prints its calls, time, failures and bytes written | Test + a real run | **PASS**: 50/50. The resumed run (April 2024 onwards, after 126 calls for Jan–Mar in the first run) made 1,302 calls in 2,861 s, with 0 left failed, and wrote 626 days / 148.8 MB (162.6 MB in total with the earlier pass). The re-run made **0 calls** |

## Files
`src/server/chainhist.ts` (new), `scripts/chainhist.ts` (new CLI), `scripts/chainhist-verify.ts` (new),
`scripts/chainhist-test.ts` (new), `package.json`, this spec, `docs/PHASES.md`.

## Amendments (build, 2026-09-25)
| # | Row | Change | Why |
|---|---|---|---|
| A1 | 5, 8 | The expiry label lives in `index.json` (`expiries[date].W1/W2`), not inside each day file | A holiday-moved expiry depends on whether a **later** day was a session. The day is written before that later day has been fetched, so the label is recomputed across all stored days after each month |
| A2 | AC3 (b), (c) | **Every** snapshot is judged, not only the last one in each minute. A snapshot's receive time gets **+4.6 s** (this PC's measured clock lag, CLAUDE.md 24 Sep), and snapshots within **3 s** of a minute boundary are left out | Which candle a snapshot belongs to is uncertain by the clock lag plus the round trip. Judging all the others is a stronger check than judging one per minute |
| A3 | AC4 | Two independent signals vote on every session: (A) the cheaper leg of the ATM straddle at 15:29, and (B) the next morning's OI break at ATM ±3. Each signal is cut at the largest gap in its own sorted log values, so no threshold is chosen. A label is an **error** only when every available signal contradicts it | The first version used (B) alone with "the two groups must not overlap". Over 676 pairs, one mislabelled day plus a few gap-open mornings made it unpassable, and it listed 30 "disagreements", most of them only relative to the outliers |
| A4 | 8 | **A special session is never an expiry day.** Sessions under 200 candles are excluded: the three measured were 60–107, and every regular session had ≥ 371 | Diwali 2025: Tue 21 Oct was a Muhurat session only, and the contract expired on **Mon 20 Oct**. The calendar had said the 21st. Both signals caught it: the cheap leg was 0.05 on the 20th and 120.30 on the 21st |

## Findings from the run (2026-09-25)
- **Time:** the resumed run's 1,302 calls took 48 min, where 27 min had been estimated for everything. A month of one series is about 530 KB and takes 2–3 s per call, not 1.1 s. The next run adds only the new days (one month's call per series).
- **Transient failures:** on the first pass, April and May 2024 each lost one series. Both were whole on the retry. The CLI now makes up to 3 passes.
- **`WEEK 2` before 16 Sep 2026 is incomplete:** only 14 of 42 series returned data for 1–15 Sep, so those 10 days were not written (row 7). The 8 days from 16 Sep are whole. AC3 needs `WEEK 2` only from 28 Sep, so nothing depends on the early days.
- **Candles after 15:29** (one at 15:30 in 2024, ten up to 15:39 in 2026) come for some offsets and not for others. So "covered all day" is judged over 09:15–15:29.
- **Special sessions stored:** 20 Jan 2024, 2 Mar 2024, 18 May 2024, 1 Feb 2025 (Sat), 1 Feb 2026 (Sun, Budget), and the Muhurat sessions of 1 Nov 2024 and 21 Oct 2025.
