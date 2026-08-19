# Dhan Option Chain Terminal

Read-only option chain for six underlyings — every strike, CE and PE, with OI, volume, IV and all
four greeks — next to a panel that shows exactly when each request left for Dhan, when the
response came back, and where the milliseconds went.

Places no orders. Gives no advice.

![Option chain](docs/shots/02-grid-fullwidth-dark.png)

---

## Quick start

```bash
git clone https://github.com/Dev-Shivam-05/Trading-Dhan-PR.git
cd Trading-Dhan-PR
npm install
```

You need **Node 22.6 or newer** (`node --version`). There is no build step — Node runs the
TypeScript directly and the UI is plain ES modules.

### See it working right now, without a Dhan account

```bash
# Windows PowerShell
$env:REPLAY='1'; npm run dev

# macOS / Linux / Git Bash
REPLAY=1 npm run dev
```

Open <http://127.0.0.1:8787>.

The screen carries a yellow banner: the numbers are generated locally from a Black–Scholes shape,
nothing came from Dhan. Use it to look at the interface, never to read a market.

### Live data

**Only one file changes. Nothing in the code.**

1. Copy `.env.example` to `.env`
2. Open `.env` and fill two values:

```ini
DHAN_CLIENT_ID=1103575055
DHAN_ACCESS_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9...
```

3. Run it:

```bash
npm run dev
```

That is the whole switch. No `REPLAY` variable means live mode. The banner disappears, the badge
in the top bar turns from `REPLAY` to `LIVE`, and the GOLD underlying resolves itself at boot.

#### Where those two values come from

| Value | Where |
|---|---|
| `DHAN_ACCESS_TOKEN` | Dhan Web → Profile → **DhanHQ Trading APIs** → generate an Access Token |
| `DHAN_CLIENT_ID` | The same page shows it. It is also encoded inside the token as `dhanClientId`. |

A **DhanHQ Data API subscription** (₹499 + tax per month) is required — the option chain, market
quotes and live feed all sit behind it.

The API key / secret pair that Dhan also gives you is for the partner browser-login flow. This app
does not use it and does not need it.

#### If the screen says the token was rejected

The error panel prints the exact Dhan code and what to do about it:

| Code | Meaning | Fix |
|---|---|---|
| `808` | Client id or token invalid | Token is revoked, or a newer one replaced it. Generate a fresh one, paste into `.env`, restart. |
| `810` | Client id invalid | Check `DHAN_CLIENT_ID`. |
| `DH-901` / `DH-906` | Token invalid or expired | Same as 808. |
| `DH-904` | Rate limited | Nothing to do — the app backs off 3 → 6 → 12 → 30 s by itself. |
| `DH-905` | Bad request, or this IP is not whitelisted | If you whitelisted static IPs in Dhan, add the machine's IP. |
| `DH-907` | Data API problem | The Data API subscription is not active. |

Restart the server after editing `.env` — Node reads it once at startup.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Backend + UI on <http://127.0.0.1:8787> |
| `REPLAY=1 npm run dev` | Same, with synthetic data and no Dhan account |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run master:refresh` | Force a fresh download of Dhan's instrument master |
| `npm run spike:gold` | Diagnose the GOLD underlying by hand (boot does it automatically) |
| `npm run shots` | Screenshot every UI state into `docs/shots/` (server must already be running) |

Change the port with `PORT=9000 npm run dev`.

## Keyboard

`1`–`6` switch instrument · `/` search a strike · `Home` jump to the ATM row ·
`L` toggle the latency panel · `T` toggle theme · `E` focus the expiry select

---

## What is on the screen

**The chain.** 23 columns mirroring Dhan's own layout: eleven CE columns, the strike, eleven PE
columns. The strike is rendered as a spine — its own background, heavier borders, larger type — so
it reads first. On load the grid centres itself on the at-the-money row. A dashed line with a price
pill sits between the two strikes that bracket spot, in-the-money sides carry a tint, OI cells
carry an intensity bar, and a cell whose price moved flashes for 400 ms.

**The header.** Spot with change, ATM strike, ATM IV, IV change %, PCR, market lot, days to
expiry, strike count. Lot sizes come from Dhan's instrument master on every boot, never from a
constant in code.

**The latency panel.** Eight timestamps per call. Headline is the round trip; beside it the age of
what you are looking at and a countdown to the next poll. Then a stage waterfall (server,
download, compute, transport, render), a 60-call sparkline with p50 and p95 lines, p50/p90/p99/max,
a 20-row call log, and CSV export of the whole 500-sample buffer. Press `L` to hide it — the round
trip and age stay in the top bar.

---

## Three things worth knowing before you trust the numbers

**The chain refreshes every 3 seconds, not tick by tick.** Dhan rate limits the option chain to one
unique request every 3 s per (underlying, expiry) — their stated reason is that OI updates slowly.
The countdown ring and the age counter exist so that cadence is visible instead of mysterious.

**Nothing on Dhan trades 24×7.** MCX GOLD is the longest session available: 09:00–23:30 IST Monday
to Friday, 23:55 outside US daylight saving, closed on weekends. Outside its window a chip shows
`MARKET CLOSED` with the last snapshot rather than pretending to be live.

**IV Change % is an approximation.** Dhan returns no previous IV, so it is measured against the
first successful snapshot of the session, persisted per day. Hover the number to see the baseline
time. Every other value is either straight from Dhan or arithmetic on Dhan's own fields.

---

## Where things live

```
src/server/
  master.ts        streaming download, cache and parse of Dhan's instrument master
  instruments.ts   the six-instrument registry, id assertions, session windows, GOLD resolver
  dhan.ts          timed REST client, 3 s-per-key rate gate, DH-9xx and 8xx error mapping
  derive.ts        everything Dhan does not return: LTP/OI/volume change, ATM IV, PCR
  poller.ts        one poller per key, telemetry ring buffer, IV baseline store
  replay.ts        synthetic chains, only under REPLAY=1, loudly labelled
  index.ts         REST + SSE + serves the UI
public/
  index.html  app.css  app.js      the whole UI: no framework, no bundler
scripts/
  spike-gold.ts    manual GOLD diagnosis
  shots.ts         screenshot every state
docs/
  PRD.md  prd.html  PHASES.md  spec/  shots/
```

### If you want to change something

| Want to change | Edit |
|---|---|
| Which instruments appear | `REGISTRY` in `src/server/instruments.ts` |
| Refresh cadence | `CADENCE_MS` in `src/server/dhan.ts` (3000 is Dhan's floor — going lower earns `DH-904`) |
| Rate-limit backoff | `BACKOFF_MS` in `src/server/poller.ts` |
| Stale thresholds (6 s amber, 15 s red) | the tick loop near the bottom of `public/app.js` |
| Colours, spacing, type | the token block at the top of `public/app.css` |
| Column order or widths | `CE_COLS` in `public/app.js` and the `<thead>` in `public/index.html` |
| Session windows | `sessionState()` in `src/server/instruments.ts` |

Full spec and acceptance criteria: [docs/spec/option-chain-v1.md](docs/spec/option-chain-v1.md)
and [docs/PRD.md](docs/PRD.md). A visual walkthrough: open [docs/prd.html](docs/prd.html) in a
browser.

## Security

`.env` is git-ignored and read only by the Node process. The access token never reaches the
browser — the UI talks to `127.0.0.1:8787` and nothing else. If you ever paste a token somewhere
public, revoke it in Dhan Web.
