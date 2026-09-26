# HANDOFF — Dhan Terminal — Phases P50–P58, P38, P39, P43, P45, P55 — 2026-09-26

> The branches are stacked, and each is pushed at its own head:
> `p49-ltp-state` → `p50-ltp-lines` → `p51-index-backtest` → `p52-oq-by-data` → `p54-weekly-range` → `p57-indicators`
> → `p58-subpane` → `p55-ltp-docs` → `p53-index-paper` → `p45-shadow` → `p38-backtest-panel` → `p39-opthist` →
> **`p43-combine`** (the current branch, which holds everything). Nothing is merged to `main`: open PRs in that order.

## Done
- **P50 LTP line sets:** the 920 and AI LTP lines, the scenario → line-set table, first touch and the vetoes, over 680 NIFTY days. `ltplines:test` 65/65, and a second implementation agrees on all 680 days with 0 mismatches.
- **P51 index option backtest:** with P34's rules, the 920 book loses under both fills (−₹61k / −₹86k). Only one of V117's six claims reproduces. `ltpbt:test` 27/27.
- **P52 open questions by data:** five settle. OQ-33 goes to the outer lines (smaller stops, better per trade). Nothing live changed. `ltpoq:test` 6/6.
- **P54 weekly range:** ±1/2/3σ bands from the ATM IV reproduce the corpus's 65/95/99% as expiry-close containment over 142 weeks. `ltprange:test` 16/16.
- **P55 research:** the LTP Calculator's formulas are not public. The app gets its reversal prices and weekly levels ready-made from the server, so OQ-1 stays blocked.
- **P57 + P58 chart indicators (your request):**
  - VWAP, EMA ×2, Supertrend and Bollinger on the chart. VWAP, EMA 9 and Supertrend are on by default.
  - An RSI, MACD or volume pane is available under **Style → Indicators / Pane**.
  - Live on 8787 now. `ind:test` 38/38, browser 20/20 + 22/22, P19 62/62, P25 44/44.
- **P53 NIFTY index paper book:** live on 8787, armed, first session Mon 28 Sep. It runs P50's engine unchanged every minute. The live and backtest first entries agree on 12/12 book-days. `ipaper:test` 14/14.
- **P45 shadow + P38 backtest panel:**
  - Each night after 16:00, P44's pick is re-run by its own engine on days it has never seen.
  - The Paper tab now shows the P37, P44 and P45 results read-only.
  - `shadow:test` 6/6, panel 9/9.
- **P39:** expired stock options can be rebuilt. On a 10-symbol sample, the option leg P44 never modelled **lost under both fills**. `opthist:test` 13/13.
- **P43:** gating the stock ORB trades on NIFTY's LTP scenario would roughly halve the pick. The trades against the scenario did better, so it was **not adopted**. `combine:test` 19/19.
- **Regression:** all 22 Node suites are green and tsc is clean (the sweep at 00:50).

## Files changed
- `src/server/idxhist.ts`, `scripts/idxhist.ts`: NIFTY's 1-minute index OHLC (253,940 minutes), so touches read the minute's high and low.
- `src/server/ltp-lines.ts` and the `ltp-lines` scripts: the P50 engine.
- `src/server/ltp-backtest.ts`, `scripts/ltp-backtest*.ts`, `scripts/lib/ltp-books.ts`: the P51 engine, with a cached prepared-day loader.
- `scripts/ltp-oq*.ts`, `scripts/lib/ltp-verdict.ts`: the P52 questions and the one verdict rule.
- `src/server/ltp-range.ts`, `scripts/ltp-range*.ts`, `scripts/lib/ltp-weeks.ts`: P54.
- `public/indicators.js` (new, and in `STATIC`), `public/ucandles.js`, `public/chart-style.js`, `public/app.js`, `public/app.css`, `public/index.html`: P57/P58 indicators, the legend, the lower pane and the chips.
- `src/server/ucandles.ts`: the candle volume `v` (VWAP needs it).
- `src/server/index-paper.ts`, `scripts/index-paper-test.ts`, `src/server/index.ts` (routes, feed key −3), `public/paper.js`: the P53 index book.
- `src/server/shadow.ts`, `scripts/shadow*.ts`: P45, which runs inside the nightly job after the backtest.
- `src/server/backtest-panel.ts`, `/api/backtest`: P38.
- `src/server/opthist.ts`, `scripts/opthist*.ts`: P39.
- `scripts/combine*.ts`, `scripts/lib/combine-lib.ts`: P43.
- Specs, each with a Result section: `ltp-lines-v1`, `ltp-backtest-v1`, `ltp-oq-v1`, `ltp-range-v1`, `indicators-v1`, `subpane-v1`, `index-paper-v1`, `shadow-v1`, `backtest-panel-v1`, `opthist-v1`, `combine-v1`, and `docs/research/ltp-official-docs-v1.md`.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/spec/GLOSSARY.md`, `CLAUDE.md` (five new lessons).

## Decisions made
- **Every spec was locked by delegation** ("complete everything without stopping"). Each unsourced value is marked GUESS and can be vetoed in one word.
- **No live trading rule changed.** P52, P43 and P39 are recommendations or findings, and P45 is a shadow, not a second trader.
- **The index book is armed by default and posts to the phone** (P53 rows 9 and 12, GUESSes).
- **The live server was restarted three times** (21:15, 21:40, and once for P57), at night with the market shut. Paper is still armed, and the token was renewed to 27 Sep 20:46 IST.
- **Two findings to act on:**
  - Our reversal prices sit about 2.7× further out than V09 says (P50/P52 Q11). That is OQ-1.
  - The option leg is a drag on the P44 trades (P39).

## Known broken / deliberately skipped
- **P35 real-money switch**: not built. Real money needs your explicit word, and no rule allows otherwise.
- **P18 public URL**: still blocked on your decision (the tunnel was denied before, and it faces outward).
- **P13**: belongs to the `Dhan-p13` worktree's session, not this one.
- **Monday-only halves are still open**, because the market is shut on a Saturday: P56 intraday OI, P47 AC5, P48 AC3, P46, P41, the live paper day, **P53 AC8** and **P45 AC5**.
- **P39 covered 10 symbols only.** Two INFY months failed on timeouts. The full year is `npm run opthist -- --all` (about 15,000 calls, several hours).
- **The P49/P50 rules have no ground truth.** Everything in the LTP track measures our reconstruction, not the tool.

## Next session starts here
- **Phase:** Monday 28 Sep's measurements. Before 09:10 run the checks. After 09:21, read the index book's 920 lines (Paper tab, or `curl http://127.0.0.1:8787/api/index-paper`). After 16:00, read the shadow (`/api/shadow`), then HANDOFF P49's list (P56, P47, P48 AC3).
- **First command:** `npm run check`. It must say READY, and 8787 must be running on build `cc19561`-era code with `/api/index-paper` returning 200.
- **Watch out for:** the live server must stay running from tonight to renew the token (it expires Sun 27 Sep 20:46 IST) and to run the index book at the open. A sleeping laptop or a stopped 8787 means Monday records nothing.
