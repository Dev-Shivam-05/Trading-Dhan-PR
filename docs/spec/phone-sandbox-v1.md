# P40–P42 — Trades on the phone, a no-look-ahead sandbox, risk rules

**Locked 2026-09-25 with one `go`** on the table the user was shown on 24 Sep night, which is copied below. Built in
the order P40 → P41 → P42.

## What was established before locking
- **No free broker API puts outside paper trades into its own phone app.** This comes from a research agent's report,
  2026-09-24. It relied on official pages where it could and marked what it could not verify.
  - FrontPage has paper trading but no API or webhook.
  - The Dhan sandbox fills every order at ₹100 and shows nothing in the Dhan app.
  - The Upstox sandbox only validates payloads.
  - Tradetron's free plan is the only paper-trading app with an inbound API, and it has catches: its own fills and no alerts
    on the free plan.
  - NSE's data policy bars supplying market data for virtual trading.
  - The free route that works is a push per event to ntfy (already configured, P17) or Telegram.
- **Dhan has no historical ticks**, only 1-minute candles going back 90 days. A tick-by-tick past day therefore exists
  only if it was recorded live.

## Rows

| # | Row | Value |
|---|---|---|
| **P40** | **Trades on the phone** | |
| 1 | Channel | ntfy (`NTFY_TOPIC`, already set up). Telegram is added once the user creates a bot (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`); `notify.ts` already sends to both when configured. |
| 2 | What is pushed | Each entry (future and option legs), each exit with price, P&L and reason, a **09:30** digest (what is waiting and at which level, what was not taken and why), and a **15:20** day summary. Live only; replay never pushes. Sandbox runs are tagged `SANDBOX`. At most about 40 a day, under ntfy's 250. |
| **P41** | **Sandbox** | |
| 3 | Tick recording | Weekdays **09:14–15:31 IST**: all near-month F&O stock futures from 09:14. Once a future has a price at or after **09:20**, add the CE and PE at the **5** strikes nearest that price. That is about 2,310 instruments, inside Dhan's 5,000 per socket. Written to `.cache/ticks/<date>/ticks.csv` (`recv_ms,ltt,seg,security_id,ltp,volume,oi`) with `instruments.json` and, at 15:31, `summary.json` (ticks per instrument). Live only. |
| 4 | Older days | Synthetic ticks from 1-minute candles: open, then low and high in the order the candle's colour implies (up candle: O, L, H, C; down candle: O, H, L, C), 15 s apart. Labelled `synthetic`. |
| 5 | No look-ahead | The sandbox drives the **same `PaperTrader`** the live server uses, one tick at a time, with the clock set to that tick. 5-minute candles are built only from ticks already delivered. The 09:20 scan is released at its own `priceAsOf`. |
| 6 | Proof | Cutting a day's data at time T and replaying it must give identical decisions before T, and the same day replayed twice must give identical trades. |
| 7 | Controls | A **Sandbox** section on the Paper tab: pick a date, choose speed (1×, 10×, 60× or max), play, pause, restart. It keeps its own ledger and never touches the live or replay files. |
| **P42** | **Risk rules, tested in the sandbox first** | |
| 8 | Stop-loss | The opposite side of the opening range, checked on every tick. The SMA exit stays, and whichever comes first wins. |
| 9 | Target | 2 × risk (entry to stop-loss). **GUESS.** |
| 10 | Frozen range | Skip the stock when its range is narrower than **0.3%** of its price. **GUESS.** |
| 11 | OI disagreement | Flag the trade when NSE's OI % and the near-month futures OI % point opposite ways. It is **still taken**. |
| 12 | Daily loss cap | No new entries once the day's gross P&L reaches **−₹50,000**. **GUESS.** |
| 13 | Switching rules | Rules 8–12 can each be switched on or off per sandbox run and for live. **Live switches only on the user's word**, and all start off. |

## Out of scope
Real orders. Tradetron (it can be added later as a second viewer). **Combining the calculators** is P43, and needs the user's
definition first.

## Acceptance criteria
| # | Criterion |
|---|---|
| AC1 | Every live paper entry and exit reaches the phone within 5 s (measured by reading the ntfy topic back). |
| AC2 | Friday 25 Sep's ticks are recorded, and the count per instrument is printed. |
| AC3 | The cut-at-T test and the twice-replayed test pass (row 6). |
| AC4 | 24 Sep replays in the sandbox and shows on the Paper tab. |
| AC5 | Each P42 rule is shown taking and rejecting a trade. |
