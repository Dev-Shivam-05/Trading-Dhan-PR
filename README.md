# Dhan Option Chain Terminal

Read-only option chain for six underlyings, with a panel that shows exactly when each request
left for Dhan, when the response came back, and where the milliseconds went.

Spec: [docs/spec/option-chain-v1.md](docs/spec/option-chain-v1.md) ·
PRD: [docs/PRD.md](docs/PRD.md) ·
API facts: [docs/spec/dhan-api-contract.md](docs/spec/dhan-api-contract.md) ·
Screenshots: [docs/shots/](docs/shots/)

## Run

```bash
npm install

cp .env.example .env      # then fill DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN
npm run dev               # live data from Dhan
```

Open <http://127.0.0.1:8787>.

No build step: Node 22.6+ runs the TypeScript directly, and the UI is plain ES modules.

### Without a Dhan token

```bash
REPLAY=1 npm run dev
```

Replay serves synthetic chains in Dhan's exact response shape through the same poller, derive
engine, SSE stream and UI. Every number is generated locally from a Black–Scholes shape — the
screen carries a loud banner saying so. Use it to see the interface, never to read a market.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Backend + UI on port 8787 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run master:refresh` | Force a fresh download of Dhan's instrument master |
| `npm run spike:gold` | SPIKE-01 — resolve the GOLD `UnderlyingScrip` (needs a valid token) |
| `npm run shots` | Screenshot every UI state into `docs/shots/` (server must be running) |

## Keyboard

`1`–`6` switch instrument · `/` search a strike · `Home` jump to the ATM row ·
`L` toggle the latency panel · `T` toggle theme · `E` focus the expiry select

## How it fits together

```
browser  ──REST──►  /api/instruments   registry read from Dhan's instrument master
         ◄──SSE──   /api/stream        snapshot + status + telemetry per (instrument, expiry)
         ──REST──►  /api/telemetry.csv full ring buffer export

backend  ──HTTPS─►  POST /v2/optionchain            one request per 3 s per key
                    POST /v2/optionchain/expirylist
                    POST /v2/marketfeed/ohlc        previous close, once per day per instrument
```

- `src/server/master.ts` — streaming download, cache and parse of the instrument master
- `src/server/instruments.ts` — the six-instrument registry, id assertions, session windows
- `src/server/dhan.ts` — timed REST client, 3 s-per-key rate gate, DH-9xx error mapping
- `src/server/derive.ts` — everything Dhan does not return (LTP/OI/volume change, ATM IV, PCR)
- `src/server/poller.ts` — one poller per key, telemetry ring buffer, IV baseline store
- `src/server/replay.ts` — synthetic chains, explicit and clearly labelled
- `public/` — the UI: three files, no framework, no bundler

## Things worth knowing

- **The chain refreshes every 3 seconds, not tick by tick.** Dhan rate limits the option chain
  to one unique request per 3 s per (underlying, expiry). The panel shows the countdown and the
  age of what is on screen so the cadence is visible rather than mysterious.
- **Nothing on Dhan trades 24×7.** MCX GOLD is the longest session at 09:00–23:30 IST Mon–Fri
  (23:55 outside US DST). Outside its window a chip shows `MARKET CLOSED` and the last snapshot.
- **IV Change % is an approximation.** Dhan returns no previous IV, so it is measured against
  the first snapshot of the session, persisted per day. Hover the number for the baseline time.
- **The token never reaches the browser.** It is read from `.env` by the Node process only, and
  `.env` is git-ignored.
- **GOLD needs SPIKE-01.** MCX commodity options hang off a futures contract rather than a spot
  index, and Dhan documents index examples only. `npm run spike:gold` proves the right value with
  real calls instead of guessing it.
