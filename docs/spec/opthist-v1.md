# P39 — History older than the window: expired stock options, and the option leg P44 did not model

**Locked 2026-09-26 by delegation.** Probes first, as the board asked: one call per endpoint (`.cache/p39-probe.ts`).

## Measured before the spec (2026-09-26)
| Probe | Result |
|---|---|
| A. `POST /v2/charts/rollingoption` with `instrument: OPTSTK`, RELIANCE (`securityId` = the share's 2885), `expiryFlag: MONTH`, `expiryCode: 1`, `ATM`, `CALL`, 1–8 Jul 2026 | **ok, 2,250 one-minute candles** (6 sessions × 375). The first has strike 1300, spot 1297.5, OI 5,168,000. **Expired stock options can be rebuilt**; P48 had only proved `OPTIDX` |
| B. `POST /v2/charts/intraday` on the **current** RELIANCE future (68777, Sep expiry) from 1 Jun | **ok from 1 Jul only**: a futures contract's history starts at its listing, about 3 months before expiry. The expired Jul and Aug contracts have no securityId in today's master and are **not** reachable this way |

So "older than the window" splits in two. **Stock options: yes**, by the same endpoint P48 used, per stock and month.
**Stock futures before the current contract's listing: no.** That stays the limit P37 already states. P44 moved to cash
candles for exactly this reason.

## Decision table
| # | Ambiguity | Locked value | Why |
|---|---|---|---|
| 1 | What is fetched | Per stock and calendar month: `rollingoption`, `OPTSTK`, `MONTH` / `expiryCode 1` (that day's near-month monthly), offsets **ATM−1, ATM, ATM+1** × CALL/PUT, 1-minute. That is 6 calls per stock-month on gate key `history` at 1100 ms. Each candle is filed under its own `strike` (P48 row 5's stitching) | The nearest strike at a trade's entry is almost always within ±1 of ATM. P44 row 10 costed the option leg at "about 10 calls per stock per day"; per month, it is 6 calls per stock |
| 2 | Storage | `.cache/history/optstk/<SYMBOL>/<YYYY-MM>.json.gz`. A month is written only when all 6 series returned, and a written month is never re-fetched (except the current month, which grows). Replay refuses. Disk guard as P48 (2 GB free) | P48 rows 3, 6 and 7 |
| 3 | Which stock-months, now | A **bounded first fetch**: the 20 symbols with the most P44 recommended-setting trades × the months **Jun–Sep 2026**, about 480 calls (~9 min). `npm run opthist -- --all` fetches the rest (P44's 210 × 12 months ≈ 15,000 calls, ~4.6 h), and is resumable | A measured answer tonight, and a path to the whole thing that the user can start |
| 4 | Pricing a trade's option leg | P33 row 6's rule: a BUY trade buys the **CE**, a SELL trade the **PE**, at the strike **nearest the trade's entry price** (ties to the lower strike), from that day's near-month monthly. Entry and exit at the leg's **1-minute close** of the entry and exit minutes (`level`), or of the minute after (`late1m`). Quantity is the stock's lot. Costs are P51 row 8's option costs. No price at either end → `no-price`, counted, never guessed | The paper trader's own leg rule. Both fills, always (CLAUDE.md, P44) |
| 5 | The report | For each P44 setting kept in `train-report.json` (the baseline, the pick, its twin), over the stock-months that are fetched: the future leg's net (P44's own number), the option leg's net and the two together, under both fills, with `no-price` counted | Answers P44's stated gap: "the option leg is not modelled" |

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | The stitcher files each candle under its own strike: on a hand-built pair of series where ATM moves from 1300 to 1310 mid-day, the 1300 strike's minutes come from the ATM series first and the ATM−1 series after |
| AC2 | Pricing on a hand-built day: CE for a BUY and PE for a SELL, the nearest strike with a tie to the lower, `level` vs `late1m` one minute apart, a missing minute → `no-price` |
| AC3 | Accounting: priced + no-price = the trades whose stock-month is on disk, counted independently |
| AC4 | Two pricing runs are byte-identical; the fetch refuses replay; nothing is imported that can place an order |
| AC5 | The bounded fetch completes (or names every failure), and the report prints for the pick and the baseline under both fills |

## Amendment at build (2026-09-26)
- **Row 3's bounded fetch is the top 10 symbols, not 20.** The stock-option months answered at about 2 calls a minute
  (about 30 s a call, against P48's 2–3 s for index months), so 480 calls would have taken about 4 hours. The five
  stock-months already written were kept, since the fetch resumes by month. `--top 20` or `--all` fetches more.
