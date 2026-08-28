# Dhan Option Chain Terminal — project rules

Global rules live in `~/.claude/CLAUDE.md`. These are the ones specific to this repo.

## Running it
- `REPLAY=1 npm run dev` — the no-credentials path. Synthetic Black-Scholes numbers, loud yellow
  banner, badge reads `REPLAY`. Use this for any UI work.
- `npm run dev` — live. Needs a valid token **and** an active Data API plan.
- `npm run check` — the one-line verdict on credentials. **Run this before assuming live data works.**

## Two failure modes that look identical and are not
A valid token does **not** mean data access. They are separate gates:
- `DH-906` / `808 Authentication Failed` -> the token is bad or expired. Get a new one.
- `806 Data APIs not Subscribed` + profile `dataPlan: Deactive` -> token is fine, the **account has
  no Data API plan**. No amount of re-pasting tokens fixes this. Subscribe at web.dhan.co ->
  My Profile -> DhanHQ Trading APIs -> Data APIs.
Tokens last about a day. `npm run check` prints which of the two you are looking at.

## Never run `npm run shots` for an ad-hoc check
It overwrites the 17 committed reference images in `docs/shots/`. Only run it when deliberately
re-baselining. For ad-hoc UI verification, write a throwaway Playwright script to `.cache/`
(gitignored) and screenshot into the session scratchpad.

## Playwright scripts must live inside the repo
Node resolves `import { chromium } from 'playwright'` from the **script's own location**, not the
cwd. A driver script in the system temp dir fails with `ERR_MODULE_NOT_FOUND` even when run from
the project root. Put it in `.cache/`.

## Data facts worth not re-deriving
- Dhan's option chain returns `previous_oi` = yesterday's **closing** OI. There is **no** endpoint
  for yesterday's intraday peak/high OI. Anything peak-based has to be self-recorded.
- The chain REST poll is rate-limited to 1 request / 3 s per (underlying, expiry). OI and greeks
  are therefore 3 s data, not tick data.
- The WebSocket feed carries LTP, volume and OI only (`PACKET.OI`, code 5, 12 bytes) — **not** IV
  or greeks. Anything needing tick-resolution OI reads the feed; anything needing IV reads the poll.
- Expiry dates in the UI are always in the future — that is what an option expiry is. They come
  from the real instrument master even in replay mode. Only prices/OI/IV/greeks are synthetic.

## Verification bar for this project
It is a trading screen. "It compiled" is not done, and a number that is silently wrong is worse
than a visible error. Any derived value gets recomputed from the payload and compared before it is
called done — see the replay verifications in `docs/PHASES.md`.
