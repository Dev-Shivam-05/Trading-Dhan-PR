# SPEC LOCK — Dhan Option Chain Terminal v1

Status: **awaiting approval**. Reply `go` to build all of it, or `change 4,11` with your values.
Nothing in `src/` may use a value that is not in this table.

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | "live data" | Chain (OI, greeks, IV, volume) refreshes every **3000 ms**; underlying spot updates on **every WebSocket tick**. Two different freshness indicators, never merged. | Dhan's option chain API is hard limited to 1 unique request per 3 s. Anything faster is a `DH-904`. Spot has no such limit. |
| 2 | "24x7 data" | **MCX GOLD**, 09:00 to 23:30 IST, Mon to Fri (23:55 during US winter DST). Outside that window the chip shows `MARKET CLOSED — last snapshot HH:MM:SS`. | No instrument on Dhan trades 24x7. GOLD is the longest session on the platform at about 14.5 h/day against 6.25 h for equities. |
| 3 | The 6 instrument chips | `NIFTY 50 (13, IDX_I)`, `BANK NIFTY (25, IDX_I)`, `SENSEX (51, IDX_I)`, `RELIANCE (2885, NSE_EQ)`, `HDFCBANK (1333, NSE_EQ)`, `GOLD (SPIKE-01, MCX_COMM)` | All five non-GOLD ids read from the live Dhan instrument master on 2026-08-19. GOLD needs one API call to confirm; see SPIKE-01. |
| 4 | "extraordinary UI" — visual identity | **Instrument-panel** direction. Ground `#0A0D14` dark / `#F7F8FB` light with blue-biased neutrals; single accent brass `#C8912A`; semantic up `#0E8A5F` / down `#D14343` kept separate from the accent. Display face **Archivo** 700, body **Newsreader** 400, data face **IBM Plex Mono** 500 with `tabular-nums`. | A trading terminal is read as an instrument, not a document. Brass reads as a dial marking and ties to the GOLD chip; keeping red/green semantic means colour never fights the accent. Grotesque + serif + mono avoids the default AI look. |
| 5 | "extraordinary UI" — density | Row height **30px**, data type **12px/1.35 IBM Plex Mono**, column padding **8px**, header row **34px**, 21 rows visible at 900px without scrolling. | Matches the reference screenshot's information density. Anything taller turns a 60-strike chain into three screens. |
| 6 | Grid column order | `Vega Theta Gamma Delta OI OI-Chg Volume Vol-Chg% IV LTP-Chg LTP` then `STRIKE` then the exact mirror for PE. | Identical to the reference screenshot, so muscle memory transfers. |
| 7 | "compare request and response time" | Eight timestamps per call: `queued, dispatched, ttfb, downloaded, parsed, pushed, received, painted`. Headline number is **`round_trip = downloaded - dispatched`**. `end_to_end = painted - queued`. | These are the only boundaries that can be measured without guessing. Cross-clock subtraction is limited to one clearly labelled value. |
| 8 | Latency panel size and position | Right rail, **380px** fixed, sticky, collapsible to a **44px** strip; state in `localStorage`. | Wide enough for a 20-row call log with tabular numbers; narrow enough to leave 1000px+ for the chain at 1440px. |
| 9 | Latency history window | Ring buffer of **500** samples in memory; sparkline shows the last **60**; call log shows the last **20**; export dumps all 500. | 500 samples at a 3 s cadence is 25 minutes of history, which covers a full session's worth of spikes without unbounded memory. |
| 10 | Backoff on rate limit | `DH-904` triggers 3 s, 6 s, 12 s, 30 s cap; reset to 3 s on first success. Amber throttle chip with a live countdown. | Doubling from the natural cadence recovers quickly without hammering; a 30 s cap keeps the screen from going silently dead. |
| 11 | Stale thresholds | Green under **6 s**, amber **6 to 15 s**, red over **15 s** plus a `STALE` chip. Grid drops to 85% opacity from amber onward. | 6 s is two missed polls, which is the first point a human should distrust the numbers. |
| 12 | "IV Change %" | `(atmIV_now - atmIV_baseline) / atmIV_baseline * 100`, baseline = first successful snapshot of the session for that (underlying, expiry), persisted to disk by date. Hover shows the baseline time. | Dhan returns no previous IV. This is stated in the UI as an approximation instead of quietly differing from Dhan's own number. |
| 13 | Number abbreviation | Under 1,000 raw; under 1e5 `K`; under 1e7 `L`; 1e7 and above `Cr`. 2 decimals, trailing zeros stripped. | Reproduces `51.09 K`, `2.98 L`, `16 Cr` exactly as the screenshot renders them. |
| 14 | Null and divide-by-zero | Renders as an em dash. Never `NaN`, `Infinity`, `0%`, or a blank cell. | A blank cell is indistinguishable from a rendering bug at this density. |
| 15 | Credential handling | `DHAN_CLIENT_ID` and `DHAN_ACCESS_TOKEN` in `.env`, read by the Node backend only. Browser bundle is grepped in CI. `.env` git-ignored, `.env.example` has key names only. | The token cannot reach the browser: it is a bearer credential for a live trading account. |
| 16 | Motion vocabulary | `instant 120ms`, `base 180ms`, `slow 280ms`, ease-out `cubic-bezier(0.16,1,0.3,1)`. Cell update flash 400 ms. All wrapped in `prefers-reduced-motion`. | One scale, no ad-hoc durations. 400 ms is long enough to catch a changed cell peripherally, short enough not to smear at a 3 s cadence. |
| 17 | Breakpoint floor | Full experience at 1440px, degraded at 1024px, blocking "wider screen" state below 1024px. | 23 numeric columns cannot be honestly shown on a phone; a fake responsive layout would be worse than an honest refusal. |

## OUT OF SCOPE (will NOT build)
- Any order, position, fund or write call to Dhan.
- Strategy builder, payoff diagrams, max pain, OI time series.
- Historical storage or replay beyond the in-session ring buffer.
- Mobile or tablet layout.
- Multi-user accounts, login screen, or hosted deployment.
- Alerts, notifications, or auto-trading of any kind.

## ACCEPTANCE CRITERIA
Full binary list lives in `docs/PRD.md` section 9. Headline five:
- [ ] Grid row count equals `Object.keys(response.data.oc).length` for every instrument.
- [ ] ATM IV and PCR match hand computation on a captured fixture to 2 dp.
- [ ] No two requests for the same (underlying, expiry) inside 3000 ms across a 10-minute log.
- [ ] All eight stage timestamps present on every call in the exported CSV.
- [ ] The built browser bundle contains no credential string.

## RISKS
- GOLD `UnderlyingScrip` unresolved — SPIKE-01, 30 minutes, blocks the GOLD chip only.
- Greeks may be absent for stock options — one live call per instrument in Phase 1 settles it.
- IV Change % will differ from Dhan's own figure by construction; row 12 documents why.

Reply `go` to build all of it, or `change 2,4` with your values.
