# PHASES — Dhan Option Chain Terminal

One phase per session. If a phase grows past ~8 files, stop and add a row here instead of
absorbing the work.

| # | Phase | Deliverable | Files | Done when | Status |
|---|---|---|---|---|---|
| P0 | Spike + skeleton | SPIKE-01 resolves the GOLD `UnderlyingScrip`; instrument master downloader + cache; `.env` wiring; Fastify boots; `/api/health` returns the six resolved instruments with their lot sizes | ~6 | All six chips resolve to a real `(scrip, seg, lot)` triple, or GOLD is documented as blocked | not started |
| P1 | Chain pipeline | `ChainPoller` (3000 ms, completion-scheduled), `DeriveEngine` (PRD section 4), `TelemetryBus`, SSE endpoints, `DH-901` / `DH-904` handling | ~8 | 10-minute log with zero sub-3000 ms repeats; derived ATM IV and PCR match a fixture to 2 dp | not started |
| P2 | Option chain grid | Token sheet as CSS custom properties, grid, header strip, chip rail, expiry select, spot marker, ITM tint, OI bar, update flash | ~8 | Screenshot matches the reference density; row count equals the response strike count | not started |
| P3 | Latency panel | Three live numbers, stage waterfall, sparkline with p50/p95, percentile row, rate-limit ring, 20-row call log, export | ~6 | Exported CSV percentiles match hand computation; panel updates without re-rendering the grid | not started |
| P4 | States + polish | All eight component states, expressive error/empty/closed states, keyboard map, both themes, contrast audit, 1024px degrade | ~6 | Twelve screenshots from `ui-contract.md` section 5 captured and reviewed | not started |

## Session log
| Date | Phase | What happened |
|---|---|---|
| 2026-08-19 | — | PRD, API contract, spec lock and UI contract written. Dhan API facts and five of six security ids verified against the live instrument master. Awaiting `go` on `docs/spec/option-chain-v1.md`. |
