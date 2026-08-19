# Dhan API Contract — verified facts only

> Every number and field name below was read from Dhan's own documentation or from the live
> instrument master on 2026-08-19. Nothing here is inferred. If a value is unknown, it is
> marked **SPIKE** and must be resolved by a real API call before it is used in code.

## 1. Authentication

| Item | Value |
|---|---|
| Headers on every REST call | `access-token: <JWT>`, `client-id: <dhan client id>`, `Content-Type: application/json` |
| WebSocket auth | query string: `?version=2&token=<JWT>&clientId=<id>&authType=2` |
| Data subscription | DhanHQ Data API subscription required for market feed / quotes / option chain (₹499 + tax per month, renews every 30 days) |
| Token validity | Chosen at generation time in Dhan Web. **Do not hardcode an assumption.** Detect `DH-901` and raise the re-auth banner. |

`DHAN_CLIENT_ID`, `DHAN_ACCESS_TOKEN` live in `.env` only. Never in source, never in a commit,
never sent to the browser.

## 2. Endpoints used by this project

### 2.1 Expiry list
```
POST https://api.dhan.co/v2/optionchain/expirylist
{ "UnderlyingScrip": 13, "UnderlyingSeg": "IDX_I" }
-> { "data": ["2026-08-25", "2026-09-01", ...], "status": "success" }
```

### 2.2 Option chain
```
POST https://api.dhan.co/v2/optionchain
{ "UnderlyingScrip": 13, "UnderlyingSeg": "IDX_I", "Expiry": "2026-08-25" }
```
Response shape (verbatim field names):
```jsonc
{
  "data": {
    "last_price": 24078.30,            // underlying spot
    "oc": {
      "24100.000000": {
        "ce": {
          "average_price": 0.0,
          "greeks": { "delta": 0.52, "theta": -12.52, "gamma": 0.0014, "vega": 12.51 },
          "implied_volatility": 9.01,
          "last_price": 123.10,
          "oi": 9891000,
          "previous_close_price": 205.45,
          "previous_oi": 7047000,
          "previous_volume": 45600000,
          "security_id": 35084,
          "top_ask_price": 123.25, "top_ask_quantity": 650,
          "top_bid_price": 123.05, "top_bid_quantity": 325,
          "volume": 160000000
        },
        "pe": { /* identical shape */ }
      }
    }
  },
  "status": "success"
}
```

**Not returned by this endpoint:** any server timestamp, ATM IV, IV change, PCR, days to expiry,
market lot, OI change %, volume change %, LTP change. All of those are **derived by us**
(see `docs/PRD.md` §4) or read from the instrument master.

### 2.3 Market Quote (snapshot) — used only as WebSocket fallback
```
POST https://api.dhan.co/v2/marketfeed/ltp     body: {"IDX_I":[13]}
POST https://api.dhan.co/v2/marketfeed/ohlc
POST https://api.dhan.co/v2/marketfeed/quote
```
Up to 1000 instruments per request, rate limit 1 request per second.

### 2.4 Live Market Feed (WebSocket) — spot ticks between chain polls
```
wss://api-feed.dhan.co?version=2&token=<JWT>&clientId=<id>&authType=2
subscribe:   { "RequestCode": 15, "InstrumentCount": 1,
               "InstrumentList": [{ "ExchangeSegment": "IDX_I", "SecurityId": "13" }] }
disconnect:  { "RequestCode": 12 }
```
Limits: 5 WebSocket connections per user, 5000 instruments per connection, 100 instruments per
JSON message. Binary packets, **little endian**. Response codes: `2` ticker (LTP + LTT),
`4` quote, `5` OI, `6` prev close, `8` full (quote + OI + 5×20-byte depth).

## 3. Rate limits that shape the architecture

| Limit | Value | Consequence |
|---|---|---|
| Option Chain API | **1 unique request every 3 seconds** per (underlying, expiry) | Chain refresh cadence is 3000 ms. "Live" for OI/greeks means 3 s, not tick-by-tick. Different instruments may be polled concurrently. |
| Market Quote API | 1 request / second, ≤1000 instruments | Fallback spot source only |
| WebSocket | 5 connections, 5000 instruments each | One connection is enough for 6 underlyings |

Dhan's stated reason for the 3 s limit: OI data updates slowly compared with LTP.

## 4. Error codes

| Code | Type | App behaviour |
|---|---|---|
| `DH-901` | InvalidAuthentication | Stop polling. Re-auth banner. |
| `DH-904` | RateLimit | Exponential backoff 3 s → 6 s → 12 s, cap 30 s. Show throttle chip. |
| `DH-905` | InputException (bad fields, or non-whitelisted IP) | Log the exact payload; do not retry blind. |
| `805` | Too many requests (WebSocket) | Reconnect with backoff. |

## 5. Exchange segment enums

| Enum | Exchange | Segment | Code |
|---|---|---|---|
| `IDX_I` | Index | Index value | 0 |
| `NSE_EQ` | NSE | Equity cash | 1 |
| `NSE_FNO` | NSE | F&O | 2 |
| `NSE_CURRENCY` | NSE | Currency | 3 |
| `BSE_EQ` | BSE | Equity cash | 4 |
| `MCX_COMM` | MCX | Commodity | 5 |
| `BSE_CURRENCY` | BSE | Currency | 7 |
| `BSE_FNO` | BSE | F&O | 8 |

Instrument types: `INDEX, FUTIDX, OPTIDX, EQUITY, FUTSTK, OPTSTK, FUTCOM, OPTFUT, FUTCUR, OPTCUR`.

## 6. Instrument registry — read from the live master on 2026-08-19

Source files (refresh daily at 08:00 IST, cache to disk):
- compact: `https://images.dhan.co/api-data/api-scrip-master.csv`
- detailed: `https://images.dhan.co/api-data/api-scrip-master-detailed.csv`

| Chip | Display | `UnderlyingScrip` | `UnderlyingSeg` | Option instrument | Lot | Session IST |
|---|---|---|---|---|---|---|
| `NIFTY` | Nifty 50 | `13` | `IDX_I` | OPTIDX / NSE_FNO | 65 | 09:15–15:30 Mon–Fri |
| `BANKNIFTY` | Nifty Bank | `25` | `IDX_I` | OPTIDX / NSE_FNO | 30 | 09:15–15:30 Mon–Fri |
| `SENSEX` | Sensex | `51` | `IDX_I` | OPTIDX / BSE_FNO | 20 | 09:15–15:30 Mon–Fri |
| `RELIANCE` | Reliance Industries | `2885` | `NSE_EQ` | OPTSTK / NSE_FNO | 500 | 09:15–15:30 Mon–Fri |
| `HDFCBANK` | HDFC Bank | `1333` | `NSE_EQ` | OPTSTK / NSE_FNO | 650 | 09:15–15:30 Mon–Fri |
| `GOLD` | MCX Gold | **SPIKE** | `MCX_COMM` | OPTFUT / MCX_COMM | 1 | 09:00–23:30 Mon–Fri |

Verification evidence (compact master rows):
```
NSE,I,13,INDEX,...,Nifty 50               BSE,I,51,INDEX,...,Sensex
NSE,I,25,INDEX,...,Nifty Bank             NSE,E,2885,EQUITY,...,Reliance Industries
NSE,E,1333,EQUITY,...,HDFC Bank
NSE,D,35084,OPTIDX,0,NIFTY-Sep2026-29150-CE,65.0,...      <- lot 65, matches the Dhan screenshot
NSE,D,35000,OPTIDX,0,BANKNIFTY-Sep2026-72600-CE,30.0,...
BSE,D,1100470,OPTIDX,0,SENSEX-Sep2026-68000-CE,20.0,...
MCX,M,513413,OPTFUT,0,GOLD-31Aug2026-163500-CE,...        <- GOLD options exist, lot 1
```

### 6.1 SPIKE-01 — resolve the GOLD underlying scrip (30 min, blocking for the GOLD chip)

Dhan's docs give `UnderlyingScrip` examples for indices only. MCX commodity options
(`OPTFUT`) hang off a **futures contract**, not a spot index, so the correct value must be
proven, not guessed. Procedure, in order, calling `/v2/optionchain/expirylist` with
`UnderlyingSeg: "MCX_COMM"`:

1. Dhan security id of the near-month GOLD `FUTCOM` contract — e.g. `483079` (GOLD OCT FUT, expiry 2026-10-05).
2. The `UNDERLYING_SECURITY_ID` value from the detailed master for GOLD `OPTFUT` rows: `114`.
3. If both return `DH-905`, open a Dhan API support ticket and park the GOLD chip behind a
   feature flag; ship the other five.

Record the winning value in this file and in `src/server/instruments.ts`. Because GOLD futures
roll, the resolver must re-read the master daily and pick the contract whose expiry is the
nearest one that is still ≥ today.

## 7. Sources

- https://dhanhq.co/docs/v2/option-chain/
- https://dhanhq.co/docs/v2/live-market-feed/
- https://dhanhq.co/docs/v2/market-quote/
- https://dhanhq.co/docs/v2/instruments/
- https://dhanhq.co/docs/v2/annexure/
- https://dhan.co/support/platforms/dhanhq-api/
