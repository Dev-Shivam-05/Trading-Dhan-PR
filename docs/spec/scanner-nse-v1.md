# SPEC LOCK — P13 9:20 F&O scanner on NSE data

Status: **locked** 2026-09-17. The 12-row proposal was approved with `go`; the same message carried a
second recording that changes rows 2 and 6 and adds a pre-defined F&O list. Those changes are the
user's words, not new choices, and are marked **AMENDED (rec 2)**.

A future session with no memory of the approving conversation must be able to build the identical
thing from this file. Implementation may not introduce a value that is not in this table.

Sources:
- `docs/Recording-14-09-2026.md` — three voice notes (`assets/voice-recordings/Yash-Sir-14-09-2026-*`),
  re-transcribed with whisper on 2026-09-17 and found word-for-word identical to the file. They restate
  P8 (`scanner-v1.md`); what they add is the named data source, "NSE spurt".
- The second recording, pasted into the approving message (dashboard Run button, top 20 "ya 25 ya 30",
  F&O list cross-verification). Its transcript is kept verbatim at the end of this file.
- `data/fno-list.txt` — the user's pre-defined F&O list (was `docs/F&O-List.txt`).

## What it is

A manually run scan that follows exactly what the user does by hand on nseindia.com:

    210 F&O stocks -> top N gainers + top N losers -> |chg| >= 2% -> OI Spurts OI chg >= +7%

and prints the survivors as Long / Short lists with the whole funnel. P8's Dhan scanner is kept,
untouched, as the second source.

## Measured before locking (2026-09-17, after the close)

| Fact | Measured |
|---|---|
| Can this machine reach NSE? | `curl` HTTP 000; headless Chromium and headless Chrome `ERR_HTTP2_PROTOCOL_ERROR`; **headed Chrome placed off-screen: 200, ~2.9 s**. CLAUDE.md's "nseindia.com is not reachable" is superseded |
| OI Spurts coverage | `/api/live-analysis-oi-spurts-underlyings` returns **216** rows = the 210 F&O stocks + 6 indices. The "top 25 only" note is superseded |
| OI Spurts `avgInOI` | equals `(latestOI - prevOI) / prevOI * 100` on **216 / 216** rows — it is the OI change %, despite its name |
| Full F&O price feed | `/api/NextApi/apiClient/marketWatchApi?functionName=getIndicesData&symbol=SECURITIES%20IN%20F%26O` returns **210** rows, all `series: EQ`, `pChange` = `(lastPrice - previousClose) / previousClose * 100` on 210 / 210. It also carries `marketStatus` and `timestamp` |
| Does ranking it locally equal NSE's own list? | Top 20 by `pChange` = NSE's "F&O Securities" top 20 gainers, and the bottom 20 = its top 20 losers — **identical sets** on both sides |
| The user's F&O list | 210 rows, 0 malformed, 0 duplicates. Identical symbol set to NSE `master-quote`, NSE `underlying-information`, NSE OI Spurts, and the Dhan instrument master's `fnoUniverse()`. One company-name difference (NSE's `The Federal Bank  Limited` has a double space) |
| Whole-market top 20 ∩ F&O | **0 gainers, 0 losers** — every whole-market top-20 gainer moved 20-38%. Taking the whole market first returns nothing, which is why the recording itself says "poore market ke top gainer loser nahi chahiye" |
| Funnel on 2026-09-17 closing data | N=20: `40 -> 26 -> 4`; N=25: `50 -> 31 -> 4`; N=30: `60 -> 36 -> 4`. Long MFSL; Short POLICYBZR, PNBHOUSING, FEDERALBNK |

## Decision table

| # | Decision | Locked value | Why |
|---|---|---|---|
| 1 | Data source | nseindia.com JSON endpoints, fetched by a real Chrome (`playwright`, `channel: 'chrome'`, `headless: false`, window at `-32000,-32000`). P8's Dhan scanner stays, untouched, selectable as source `dhan` | The recording names NSE; Dhan has no access; measured above |
| 2 | **AMENDED (rec 2).** Step 1 | Rank the "Securities in F&O" feed by NSE's `pChange`; keep the **top N gainers + top N losers**, **N ∈ {20, 25, 30}, default 20**, chosen in the panel. Ties at the cut are broken by symbol A-Z, so a side is exactly N | Rec 2: "top 20 maan lo … fix nahi hai 25 maan lo ya 30 bhi le lo … pehle 20 pe try karke dekho". NSE's own page stops at 20, so N > 20 needs the full feed; the feed reproduces NSE's 20 exactly |
| 3 | **AMENDED (rec 2).** F&O cross-verification | Only symbols in `data/fno-list.txt` are ranked. An NSE row not in the list is excluded and **named** (`in NSE's F&O feed, not in your list`); a list symbol NSE did not return is **skipped and named** (`not in NSE's F&O feed`) | Rec 2: "wo list ek other list se verify hona chahiye … FNO wale hi stock". Naming both directions tells the user when the list needs updating |
| 4 | Step 2 | `abs(pChange) >= 2.00` | Recording: "2% bhag chuke ya 2% gir chuke" |
| 5 | Step 3 | OI Spurts `avgInOI >= 7.00` — **rising OI only** | "equal to 7 or greater than 7", said twice, and the recording's own analysis: new positions being built. Changes P8's absolute rule for this source only |
| 6 | Side | `pChange > 0` → Long, `< 0` → Short | Same as P8 row 10 |
| 7 | Stock with no OI Spurts row | Skipped with reason `not in OI Spurts` | Never silently dropped (P8 row 14) |
| 8 | **AMENDED (rec 2).** Trigger | **Manual** — the panel's Run / Rescan button and `S`. No timer | Rec 2: "dashboard pe run ka button hum press karenge 9:20 pe". Replaces the proposal's automatic 09:20 run |
| 9 | **AMENDED (rec 2).** When it may run | Always. The result carries NSE's own `timestamp`, trade date and market status, printed in the panel header (`NSE · market Closed · as of 17-Sep-2026 16:00:28`) | With a manual button the user decides when; a closed-market result is still a correct, labelled result. Replaces the proposal's holiday refusal and 60 s retry loop (row 8 of the proposal, which was the one guessed number) |
| 10 | Mixed days | If the price feed's date and OI Spurts' `currTradingDate` differ, the scan **fails** with both dates printed | A Long list built from today's prices and yesterday's OI is a silently wrong number |
| 11 | Boundary validation | Every NSE row is validated: symbol `^[A-Z0-9&-]{1,20}$`, numbers finite, `previousClose > 0`, `prevOI > 0`. `pChange` must agree with `(lastPrice - previousClose)/previousClose*100` within **0.01**, `avgInOI` with its own recomputation within **0.01**; otherwise skipped as `NSE figures inconsistent`. Non-JSON or a missing array fails the scan | NSE rounds to 2 dp, so an honest row is within 0.005. External input is validated at the boundary |
| 12 | Output | Panel header gets `Source [NSE|Dhan]` and `Top [20|25|30]`. NSE columns: Symbol, LTP, Chg %, OI Chg %, Latest OI, Prev OI, Volume. Funnel `210 → 40 → 26 → 4` labelled `F&O list / top 20 + 20 / chg ≥ 2% / OI chg ≥ 7%` | Same panel as P8, so nothing new to learn |
| 13 | Counts reconcile | `skipped + excluded-by-rank + rejected-2% + rejected-OI + survivors = list size`, each counted **at the point of rejection** and compared against the list's length read independently | CLAUDE.md: a self-check derived from its own answer is decoration |
| 14 | Evidence | Every raw body saved to `.cache/nse/<YYYY-MM-DD>-<HHmmss>-<name>.json` (IST) | Same as P12's probe |
| 15 | Calls per scan | 3 page loads: homepage (cookies), the F&O feed, OI Spurts. A second request while one is running joins it. Changing N re-computes from the last fetch **only if** it is the same scan request; a new Run always re-fetches | Minimal load on NSE |
| 16 | Test data | The 2026-09-17 closing bodies are committed at `test/fixtures/nse-2026-09-17/`. `NSE_FIXTURE=<dir>` makes the source read them instead of Chrome; the badge then reads `FIXTURE` | Real data, deterministic |
| 17 | Files | New `src/server/nse.ts` (browser + validation + evidence), `src/server/scanner-nse.ts` (pure funnel), `data/fno-list.txt`. Changed `src/server/index.ts`, `public/scan.js`, `public/index.html`, `public/app.css`, `package.json` | 7 code files, inside the ~8 rule |

## Out of scope (will NOT build)
- Automatic 09:20 run, alerts, sound (rec 2 makes it a button)
- Whole-market (non-F&O) ranking
- Contract-level OI Spurts, option-chain drill-down from a result
- Editing the F&O list from the UI — it is a text file
- Any change to P8's Dhan path

## Acceptance criteria
- [ ] With `NSE_FIXTURE=test/fixtures/nse-2026-09-17`, N=20 returns exactly **Long MFSL; Short POLICYBZR, PNBHOUSING, FEDERALBNK**, funnel **210 → 40 → 26 → 4**; N=25 `210 → 50 → 31 → 4`; N=30 `210 → 60 → 36 → 4`.
- [ ] A second implementation that does not import `scanner-nse.ts` recomputes all three funnels from the fixture and agrees on every count and every symbol.
- [ ] The counts reconcile (row 13) for all three N.
- [ ] Deliberately broken fixtures fail or skip as rows 3, 7, 10 and 11 say: a list symbol removed from the feed, an unlisted symbol added, a stock removed from OI Spurts, mismatched dates, a `pChange` off by 0.5, a non-JSON body.
- [ ] One **real** NSE scan from this machine returns HTTP 200 bodies, a result whose counts reconcile, and three evidence files in `.cache/nse/`.
- [ ] In the browser: `S` opens and runs; switching Top to 25 and 30 changes the funnel to the values above; switching Source to Dhan still runs P8 in replay; Esc closes; zero console errors.
- [ ] Screenshots, both themes: results, the N=30 funnel, the skipped disclosure, an error state.
- [ ] `npm run typecheck` clean.
- [ ] **Not measurable tonight:** a scan pressed at 09:20 IST on a trading day. Recorded as open, not as a pass.

## Risks
- **NSE's terms of use restrict automated access.** This is a personal tool making 3 page loads per button press. Flagged; the user's call.
- NSE's bot wall may start rejecting headed Chrome too. The scan then fails loudly (row 11), never returns partial numbers.
- Whether NSE's feeds are already updated at 09:20 is unverified. The header prints NSE's own timestamp so a stale feed is visible.
- A Chrome window is created off-screen for ~3 s per scan; it may flash in the taskbar.

## Second recording — verbatim, as provided
> "Hum 9 baj ke 20 minute ko jab ye scanner run karenge matlab dashboard pe run ka button hum press karenge 9 baj ke .20 minute pe hum run karayenge aur us time pe jo top gainer top loser aayenge wo top 20 maan lo apne filter kar liye usme se, lekin wo jo top 20 aayenge na usme se hamara ek criteria wo hai ki bhai wo jo stock nikal ke aaye wo FNO wale hi stock hum filter karenge, FNO ke alawa jo bhi stock hai use hum filter out nahi karenge matlab hume wo top gainer aur top loser ke pehle 20 ka list aisa fix nahi hai 25 maan lo ya 30 bhi le lo... pehle 20 pe ek baar try karke dekho ki 20 mein kya ho raha hai."
>
> "To 20 apne le liya to ab usme ek pre-defined hum list daal denge aur wo list milega tumhe Google pe search karo tum... 'FNO stock of Indian stock market' matlab FNO eligible stock jo hai... uski poori list aa jayegi. To hume wo list mein se hi top gainer aur top loser hai wo chahiye matlab poore market ke top gainer loser nahi chahiye. 5000 stock mein se wo nahi chahiye lekin FNO mein maan lo 250 stock aa rahe hain to 250 mein se kon ye top gainer loser mein aa raha hai wo wale chahiye."
>
> "Simple sa aisa karo ki ye top gainer loser ka jo 20 stock ka list nikala, wo list ek other list se verify hona chahiye... wo other list kya hai to wo Google pe search kar lo 'FNO stock list'. Toh Google pe tumhe poore FNO ke jitne available stock hai uska list mil jayega. Wo stock ka jo list hai usme se jitne stock top 20 mein aa rahe hain na wahi hume filter out karne hain. Saare stock nahi chahiye. FNO mein eligible hai jiska FNO run hota hai wo chahiye. Cash wala spot wala nahi chahiye. Baaki jo tune bataya bhai wo sab sahi hai ki usme se fir NSE spurt ki website pe jao wahan pe 7% wo sab sahi hai. Lekin ek cheez ye reh gayi thi apne ko chahiye FNO wale hi stock."

**Reading of the one contradiction.** The pasted analysis says "poore market (5000+) ke Top 20 … cross-match"; the transcript it summarises says the opposite ("poore market ke top gainer loser nahi chahiye … 250 mein se kon"). The transcript wins, and the measurement above settles it: the whole-market top 20 contains zero F&O stocks today.
