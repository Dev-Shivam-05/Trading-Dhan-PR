# Spot window — v1 (P23)

2026-09-19. Source request, with a screenshot of NIFTY at 23,346.40: "now i need only the top and
down 8 strikes … nifty 346 me hai and muje lower me 23,700 tak ke strike price chaiye and upper
mein 22,950". The user gave both ends, so there was nothing to propose; this file records the rule.

Supersedes `strike-window-v1.md` rows 1, 2 and 5 (ATM row + 8 each side = 17 rows). Every other
P20 row (re-centring per snapshot, chain edges, strike search reaching the whole chain, Breached
inside the window, the option window) is unchanged.

| # | Topic | Value | Why |
|---|---|---|---|
| 1 | Strikes shown | **8 strikes strictly below the spot + 8 strikes at or above it = 16 rows** | The user's example: 23,346.40 → 22,950 … 23,300 and 23,350 … 23,700 |
| 2 | Anchor | The snapshot's `spot` (not `atmStrike`). A spot exactly on a strike counts that strike as "above". No spot → all rows | The request names the spot; the ATM row can sit on either side of it |
| 3 | Chip | `Spot ±8 · 16 of 236 strikes` | "ATM ±8" would describe the old rule |
| 4 | Chain edge | Fewer than 8 on a side → show what exists, nothing borrowed | P20 row 4 |
| 5 | Files | `public/app.js` only | UI-only |

## Acceptance criteria
- [ ] Live NIFTY (spot 23,346.40, shut market): rows are exactly 22,950 … 23,700, 16 of them.
- [ ] Replay, every chip: 8 rendered strikes < spot and 8 ≥ spot, recomputed from the snapshot's
      own strike list and spot, not from `windowRows()`.
- [ ] Seam: spot on a strike, spot below / above the whole chain, a 5-strike chain — each gives
      the rows row 1 and row 4 say.
- [ ] 16 rows fully visible at 1440×900 live; earlier suites still green, superseded checks
      rewritten.
