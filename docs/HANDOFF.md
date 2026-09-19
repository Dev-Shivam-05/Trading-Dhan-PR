# HANDOFF — Dhan Terminal — P17 — 2026-09-19

## Where things stand
- **Live data works.** The user bought the Data API plan (₹499/month, until 17 Oct 2026) and gave
  a fresh token. `npm run check` READY. `npm run live:probe` 17 pass / 0 fail. The live NIFTY chain
  matched a direct Dhan call on 472/472 legs. The server runs live on 127.0.0.1:8787.
- **The token looks after itself.** The server renews it before the 24 h expiry, outside market
  hours, and rewrites `.env` (`src/server/token.ts`). Renewal kills the old token. See CLAUDE.md.
- **09:20 scan → phone.** Windows task `DhanNseScan0920` (Mon–Fri 09:20, runs on battery) runs
  `scripts/scan-task.cmd`, which runs the scan and sends ntfy / Telegram. Tested from Task Scheduler.
  The ntfy message was read back.
- **GitHub fix** (one job per runner at a time + a backup notification) is on branch
  `p17-live-deploy` and only takes effect once merged to `main`.
- **Login gate:** any request through a proxy/tunnel needs `APP_USER` / `APP_PASSWORD` (in `.env`).

## Blocked on the user
1. **Public URL (P18).** Starting an ngrok tunnel was denied by the permission classifier
   ("External Ingress Tunnel"). A GitHub-hosted encrypted token store, which a Vercel deployment
   would need, was denied as "Data Exfiltration". The user chooses: allow the tunnel (PC must be on),
   or pay for an always-on host (Render/Railway plus a disk).
2. **`gh secret set NTFY_TOPIC`** was denied, so the GitHub backup notification is silent until the
   user runs it.
3. **Telegram**: the user has to make a bot (@BotFather). Steps are in the README.
4. **Merge the PR** for `p17-live-deploy` (the global rule is: never push to main).

## Open
- First real 09:20 run: **Mon 21 Sep**. Read `.cache/scan-task.log` and check the notification
  arrived.
- P12 remainder: `npm run feed:probe`, P7/P8/P9 driven live, P8's AC5 with the market open.
- The user said yesterday's run was "not fully accurate" and had errors. They have not said which
  numbers were off or what the errors said, so ask.

## Next session starts here
`git worktree list`, `netstat -ano | grep LISTEN | grep ':878'`, then `npm run check` (shows the
token's expiry; renewal should have moved it).
