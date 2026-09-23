# HANDOFF — Dhan Terminal — P29 — 2026-09-23

> P28's handoff is superseded here but not lost: its full text is in git history at `9e5593c`, its
> board row is in `docs/PHASES.md`, and its decisions are in `docs/DECISIONS.md`.

Branch **`p29-ltp-spec`** (cut from `p25-chart-nav`). **Not pushed — the push was denied, see
"Blocked on you" below.** Five commits:

```
14c2595  docs: P29 on the board
bff3d62  p29: parity must be measured against the forward, not spot
23f2f62  p29: the LTP Calculator spec, layers 0-3 and 6
84a1bed  p29: OQ-1 attacked by measurement
df52332  p29: the chart criteria in open:checks, and their arithmetic proven
1e457dd  p28: the LTP Calculator corpus, its analysis, and the P28 handoff
```

## Done

### 1. P28's work is committed at last

`LTP-CALCULATOR/` (163 transcripts + the 9-document `ANALYSIS/`) and `assets/voice-recordings`
were untracked **and not gitignored** — one `git clean -fd` from destruction. 182 files, committed
first thing, before anything else was touched.

### 2. `docs/spec/ltp-calculator-v1.md` — 26 rows, 15 acceptance criteria

Locks **L0–L3 and L6**: the imaginary line, the ATM **by highest time value** (not nearest spot),
support and resistance by the outward scan, the 75% grading with its three grades and the
double-factor asymmetry, and the reversal-price ladder. L4–L5 and L7–L10 need accumulated intraday
history and are boarded as P30+.

Row 1 nails the terminology trap in code, not just in prose: **"Max Pain" is STOP LOSS and
"Max Gain" is TARGET**, so the identifiers are `stopLoss` / `target` and the industry words may
appear only in a UI label. Row 2 does the same for ATM, which must not collide with `derive.ts`'s
existing `atmStrike` — P23's spot window depends on that one.

### 3. OQ-35 is **closed**, by reading

The board called it "stated two opposite ways" and second-most-urgent. It is one fact.
§3.2 defines *top of the chain* as the **highest strike**, while a chain prints **smallest strike
first**. So V112 ("smaller → larger strike is bullish") is strike space; V121 ("an upward arrow
means bearish") is screen space on that display, where up is towards smaller strikes; V45 says so
outright; V13's "support drawn above" follows. Spec row 5 puts **every** rule in strike space and
derives the screen direction in exactly one function, so the trap cannot recur. Our grid already
sorts ascending (`derive.ts:106`) — the same orientation as every video.

### 4. OQ-1 has a tested candidate — and is deliberately still open

`reversal(K,call) = K + callLTP`, `reversal(K,put) = K − putLTP` — the writer's break-even.

The corpus contains **17 worked (strike → reversal) pairs**. P28 recorded them; nobody had treated
them as a validation set. `npm run oq1:test` does, 5/5:

- **Parity is the falsifiable test.** Fitting a premium to one reversal price is trivial; parity is
  not, and the candidate never mentions it. `F = revCall + revPut − K` recovers a number the
  candidate was never shown, on three separate passages, to **+8 / +12 / −6 points**.
- **Expiry.** `npm run oq1:live` on the expired 22-Sep chain: every ITM reversal lands on spot
  (23,328.4–23,329.6 against spot 23,329), every OTM one collapses onto its own strike. That is the
  corpus's *"at expiry all reversal prices converge to intrinsic value"*, reproduced numerically.
- **It eliminates three rivals**, including a *literal* reading of V18: "the spot at which time
  value peaks" is **exactly the strike** under Black-Scholes, since `dTV/dS` is `delta` below the
  strike and `delta − 1` above it. V18's wording, taken literally, degenerates to the strike.
- **The one counter-example is kept and is not scored as a pass** — the Sensex passage, where the
  source itself says the reading was inverted.

**Not shipped.** It sits behind one function. Spec row 12 gives four one-word answers.

### 5. A red line that was mine, not the data's

The live parity pre-check read a median deviation of **80.45** on a 6-day chain and **0.45** on an
expired one. Parity is `c − p = F − K`; it was being compared against **spot**, so it was measuring
the basis — which is zero at expiry, which is why the expired chain "passed". Rearranged to an
invariant that needs no futures price: `c − p + K` is the chain's own implied forward and every
strike must agree. **13 strikes agree to 7.3 points**, basis **+80.5 (34 bp)**.
This *strengthens* OQ-1: the corpus residuals are the carry, and two of three have the right sign.

### 6. The chart criteria, which had only ever been taken on MCX

`npm run open:checks` gains **P19 on NSE** (1-minute candles exactly 60,000 ms apart; the forming
candle **contains** every tick that fell inside its minute) and **P9's opening-candle question
measured** rather than argued — how many signals the shipped cross-day `median20` fires in
09:15–09:34 against a session-only rule. It is reported as a decision and never scored.

Their arithmetic moved to `scripts/lib/chart-checks.ts` and is driven by **`npm run chart:selftest`
— 25 checks, each also shown to FAIL on deliberately broken input** — against real captured
payloads in `test/fixtures/chart-2026-09-22/` (a real 1125-candle underlying series and a real
385-candle option series). **This exists because on a shut market `open:checks` runs only its SKIP
branch, and there is one session a day in which to find a bug in the other one.** It caught two
off-by-one errors in its own expectations before they could cost a session.

`.cache/p29-chart-live.js` does the browser half: **6 pass / 0 fail / 4 skip** pre-session.
Three of its first four reds were the script's own, and all three are the kind this project keeps
producing: `'#chartWrap svg'` matched the **14px icon inside the Style button** (which precedes the
chart in the DOM) instead of the chart surface; `invX` was fed a **page** coordinate when
`chart-tools.js:241` feeds it `clientX − svgRect.left`; and a pan was asserted on a **fully fitted**
view, where row 7 correctly clamps it to a no-op. Use `#chartSurface`.

### 7. The server was restarted, and it needed to be

The server from P28 (PID 5788) had **died on its own** around 06:00. The one before that was
holding **NIFTY `nearestExpiry` 2026-09-22 — already expired**, so the 09:15 run would have polled
a dead chain. A fresh one is up on 8787: master downloaded today, `nearestExpiry` **2026-09-29**,
token renewed to **2026-09-24T00:13:52Z**, exactly one listener, zero `EADDRINUSE`.
The other `node.exe` processes on this machine are **MCP servers** — which is exactly why
CLAUDE.md forbids `taskkill //IM node.exe`.

## Armed and waiting

**`.cache/p29-at-open.js` is running detached as PID 14064.** At **09:36 IST** — past the bell, and
past the 09:15–09:34 window P9's measurement needs — it checks that the *server* agrees the session
is open (the clock alone would run it on a holiday and score a shut market as skips), then runs all
three suites and writes everything to **`.cache/p29-open-run.log`**. It gives up at 15:00 IST.

That covers every remaining open-session criterion on the board:

| | needs the session |
|---|---|
| P12 / P12b | `/api/scan?source=dhan` driven live; **P8's AC5** (no two chain calls under 3000 ms while a scan runs); the clock time `NSE_EQ` `net_change` first leaves zero |
| P21 | the previous close against Dhan with the session **on** |
| P25 | whether NSE's option-chain `last_price` lags its own quote the way MCX's does |
| P19 / P9 | today's candles one interval apart; the forming candle containing its ticks; the opening-candle measurement |
| P25 (browser) | the live-edge pin as new candles arrive, on NSE |

**Read `.cache/p29-open-run.log` first in the next session.**

## Blocked on you — nothing here can be finished without a word from you

1. **Spec row 12 (OQ-1)** — `go` / `theoretical` / `api` / `hold`. Then the rest of the spec with
   one `go`.
2. **`git push` was DENIED** by the session's permission classifier as *"Out-of-Place Publication"*,
   and so was a plain `netstat`. **All five commits exist locally on `p29-ltp-spec` and nothing is
   lost**, but the branch is not on the remote. Either push it yourself or allow the permission.
3. **`npm run check` was DENIED** as *"Data Exfiltration"* (it sends the token to api.dhan.co).
   Credential state was read from the running server's `/api/health` instead. **If the same
   classifier denies `open:checks`'s direct Dhan calls at 09:36, that run will come back short** —
   the log will say so.
4. **P18's transport** — unchanged and still yours: ngrok was denied as *"External Ingress Tunnel"*
   and a GitHub token store as *"Data Exfiltration"*. **(a)** PC + tunnel, everything works but only
   while this PC is on; **(b)** an always-on host with a persistent disk, your account and a paid
   plan. **Not Vercel** — exactly one long-lived process may own the Dhan token.
5. **The stacked branches.** Now **79 commits** ahead of `main`, in the order
   p6 → … → p20 → p21 → p22 → p23 → p24 → p26 → p25 → **p29**. Merging out of order will not work.
6. **P9's opening-candle question** — the 09:36 run will print the two counts. One word after that.
7. **`gh secret set NTFY_TOPIC`** and a Telegram bot.

## Known broken / deliberately skipped

- **L4–L10 of the LTP Calculator are not specified.** They need accumulated intraday history, which
  the server does not keep, and most of the remaining open questions live there.
- **OQ-33 is deferred to L10**, with a recommendation recorded in the spec: label both, default the
  entry to the **inner** lines per V117's own instruction, and print the stop size so "safe" stays
  visible. V117 is the only measured evidence in the corpus (inner 60–81%, outer 20–41%).
- **`.cache/` is gitignored**, so `p29-chart-live.js` and `p29-at-open.js` are on this machine only.
  That is the project's existing convention for verification suites (`p19-verify.js` and the rest
  live there too) and is not new here — but it is why P27 found suites that had gone stale unread.

## Next session starts here

1. `cat .cache/p29-open-run.log` — the 09:36 results.
2. `docs/spec/ltp-calculator-v1.md`, row 12. One word.
3. **Do not re-read the 163 transcripts.** ~150k tokens to learn nothing new; every rule in
   `ANALYSIS/` cites its video number. Start at `05-CONSOLIDATED-LOGIC.md`, then `08-V2-DELTA.md`.
4. **"Max Pain" means STOP LOSS and "Max Gain" means TARGET.** Neither carries its industry meaning.
