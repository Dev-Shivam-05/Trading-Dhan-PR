# HANDOFF — Dhan Option Chain Terminal — Phase 6 (preview run) — 2026-08-28

## Done
- The app was launched and driven end to end in replay mode (`REPLAY=1 npm run dev`) and is
  serving at <http://127.0.0.1:8787>. This was a run-and-verify session, not a code session.
- `/api/health` reports **6/6 instruments resolved**. GOLD now resolves by itself
  (`scrip=483079 seg=MCX_COMM lot=1`) — the P0 blocker is closed. The other five are unchanged:
  NIFTY 13/65, BANKNIFTY 25/30, SENSEX 51/20, RELIANCE 2885/500, HDFCBANK 1333/650.
- Grid renders 41 rows x 23 columns for NIFTY with the strike spine centred on ATM 24,100.
- Verified it is genuinely streaming, not a static render: two frames 6 s apart showed spot
  24,078.67 -> 24,112.47, the chart advancing, tick rate 49 -> 56 t/s, RTT 220 -> 192 ms, and
  per-cell change flashes firing.
- Chip rail exercised: GOLD (31 rows), BANK NIFTY (41), RELIANCE (31) all switch and load.
- Zero browser console errors, zero page errors across both drives.

## Files changed
- `docs/PHASES.md` — added P5 (tick feed, retro-filled: it was in the session log but missing
  from the table), P6 (chart price axis + drawing tools), P7 (peak-OI tracking). Added
  `## Now` / `## Next 3`. Added this session's log row.
- `docs/HANDOFF.md` — created (previous session ended without one).
- `docs/DECISIONS.md` — created.
- `CLAUDE.md` — created, with the traps found while running the app.
- **No `src/` changes.** Nothing in the application code was touched this session.

## Decisions made
- Screenshots for verification were written to the session scratchpad and driven by a throwaway
  script in `.cache/` (gitignored), **not** via `npm run shots` — that script overwrites the 17
  committed reference images in `docs/shots/`, which is a real diff nobody asked for.
- P7 (peak-OI) was added to the board rather than built. It is a genuine feature with a hard
  data dependency (see below), so it needs its own session, not an absorb.
- P5 was retro-filled into the table for a contiguous board. Its wording is taken verbatim from
  the existing 2026-08-27 session log — no new claims were invented.

## Known broken / deliberately skipped
- **Live Dhan data is still blocked.** `npm run check` this session: profile OK (token valid to
  28/08/2026 16:52) but option chain returns `806 Data APIs not Subscribed`, and the profile
  reports `dataPlan: Deactive`. Every number currently on screen is synthetic Black-Scholes
  output from `src/server/replay.ts`, which is why the yellow banner is up.
- Because of that, the WebSocket binary packet parser in `src/server/feed.ts` has still never
  run against real Dhan bytes. `npm run feed:probe` exists to check it the moment the plan is active.
- **CORRECTED 2026-08-28 (later same day).** An earlier version of this handoff said yesterday's
  peak OI cannot be obtained from Dhan and must be self-recorded from day one. That was wrong.
  `POST /v2/charts/intraday` with `"oi": true` returns `open_interest` per candle for `NSE_FNO`
  options, up to 90 days back, so the peak is a `max()` over yesterday's candles and is
  back-fillable. P7 does **not** need a warm-up day. See DECISIONS.md 2026-08-28 (superseding).

## Next session starts here
- Phase 7: peak-OI tracking — record a per-strike running max of OI, persist it on the existing
  `BaselineStore` pattern in `src/server/poller.ts`, and compare live OI against yesterday's peak
  instead of `previous_oi`.
- First command: `npm run check`
- Watch out for: the OI ceiling is not the 3 s REST poll. `src/server/feed.ts` already carries OI
  on the tick socket (`PACKET.OI`, code 5, 12 bytes), so the running max should be fed from the
  tick stream, not from the chain snapshot — otherwise you record a 3-second-sampled peak and
  systematically under-report the real high.
