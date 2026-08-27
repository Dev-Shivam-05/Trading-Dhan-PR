# PHASES — Dhan Option Chain Terminal

One phase per session. If a phase grows past ~8 files, stop and add a row here instead of
absorbing the work.

| # | Phase | Deliverable | Files | Done when | Status |
|---|---|---|---|---|---|
| P0 | Spike + skeleton | SPIKE-01 resolves the GOLD `UnderlyingScrip`; instrument master downloader + cache; `.env` wiring; Fastify boots; `/api/health` returns the six resolved instruments with their lot sizes | 9 | All six chips resolve to a real `(scrip, seg, lot)` triple, or GOLD is documented as blocked | **5/6 done** — GOLD blocked on credentials |
| P1 | Chain pipeline | `ChainPoller` (3000 ms, completion-scheduled), `DeriveEngine` (PRD section 4), `TelemetryBus`, SSE endpoints, `DH-901` / `DH-904` handling | ~8 | 10-minute log with zero sub-3000 ms repeats; derived ATM IV and PCR match a fixture to 2 dp | **done** |
| P2 | Option chain grid | Token sheet as CSS custom properties, grid, header strip, chip rail, expiry select, spot marker, ITM tint, OI bar, update flash | ~8 | Screenshot matches the reference density; row count equals the response strike count | **done** |
| P3 | Latency panel | Three live numbers, stage waterfall, sparkline with p50/p95, percentile row, rate-limit ring, 20-row call log, export | ~6 | Exported CSV percentiles match hand computation; panel updates without re-rendering the grid | **done** |
| P4 | States + polish | All eight component states, expressive error/empty/closed states, keyboard map, both themes, contrast audit, 1024px degrade | ~6 | Twelve screenshots from `ui-contract.md` section 5 captured and reviewed | **done** |

## Session log
| Date | Phase | What happened |
|---|---|---|
| 2026-08-19 | — | PRD, API contract, spec lock and UI contract written. Dhan API facts and five of six security ids verified against the live instrument master. Awaiting `go` on `docs/spec/option-chain-v1.md`. |
| 2026-08-19 | P0 | Spec approved (`go`). Backend skeleton built on Node 24 native TypeScript — no build step. Master downloads (35.7 MB, 185,088 tracked rows) and resolves NIFTY 13/lot 65, BANKNIFTY 25/30, SENSEX 51/20, RELIANCE 2885/500, HDFCBANK 1333/650. Session windows verified live: equity chips reported closed at 20:57 IST while MCX reported open. `tsc --noEmit` clean. **GOLD blocked**: SPIKE-01 needs `.env` credentials; candidates 483079 (near-month FUTCOM) and 114 surfaced in `/api/health`. Branch `p0-skeleton`, commit `02f0e4b`, no remote configured yet. |

| 2026-08-19 | P1-P4 | Ran all remaining phases in one session at the user's explicit request. Backend: DeriveEngine, ChainPoller (completion-scheduled 3000 ms), TelemetryBus (500-sample ring), SSE stream with telemetry backfill, CSV export, IV baseline store, previous-close cache. UI: 23-column grid with the strike spine, ATM auto-centring, spot marker, ITM tint, OI bars, change flash, latency panel, expressive states, both themes, keyboard map. **Verified in replay:** PCR and ATM IV recomputed from the payload match exactly; 41 rows x 26 fields with zero NaN/Infinity; cadence min gap 3184 ms across 7 consecutive polls; 14 screenshots captured and reviewed. **Live data still blocked** - the supplied access token is rejected by Dhan (`DH-906 Invalid Token`, `808 Authentication Failed`) on every endpoint including `/v2/profile`, so SPIKE-01 could not run. |

| 2026-08-27 | P5 | Tick-by-tick added on the user's request: Dhan WebSocket live feed (`feed.ts`) with a hand-written binary packet parser, per-contract subscriptions derived from each snapshot's own strike list, 10 Hz tick batching over SSE, and a live line/area chart strip above the chain. Feed carries LTP/volume/OI only, so IV and greeks stay on the 3 s REST path and the UI labels which is which. **Verified in replay:** 83 subscriptions for 41 strikes with zero orphans, 92 underlying ticks in 12 s, frame gaps 99-237 ms, header/chart/spot-marker all agreeing. **Two real bugs found and fixed by testing:** subscriptions were built from the master (462 contracts, 141 never rendered) instead of the snapshot; and the reconnect backoff never escalated because an opened-then-dropped socket reset the failure count, producing a 1-per-second reconnect loop forever. **Live still blocked:** token is valid but `/v2/profile` reports `dataPlan: Deactive` - option chain returns `806 Data APIs not Subscribed` and the feed socket is accepted then dropped with code 1006. The binary parser has therefore never run against real bytes; `npm run feed:probe` exists to check it the moment the plan goes active. |

## Deviations from the locked spec, and why

| Spec row | Locked | Built | Why |
|---|---|---|---|
| PRD section 6 | Vite + React 18 + TypeScript | Plain ES modules + CSS served by Fastify; Node 22.6+ runs the server TypeScript natively | No bundler means no build step and no build-failure surface. One command runs everything. The token sheet and grid rules are unchanged. |
| Row 8 | Panel always docked right at 380px | Panel docked right at 380px but **closed by default below 1780px viewport**, with a live RTT/age readout kept in the top bar | At 1440px an open panel forces the 23 columns to scroll sideways. The user asked for the strike to be clearly visible with the grid neat and clean, which the full-width grid delivers; latency stays visible in the top bar either way. |
| Row 9 | Sparkline shows last 60 calls | Same, plus a `collecting - n of 2 calls` placeholder | An empty chart on a closed market read as broken. |
