/**
 * Keeps the Dhan access token alive without a human pasting one every morning (P17).
 *
 * Facts this module is built on, measured 2026-09-19 against the live API:
 *  - A token from Dhan Web lives exactly 24 h.
 *  - `GET /v2/RenewToken` (headers `access-token`, `dhanClientId`) answers
 *    `{ createTime, expiryTime, token }` with a NEW token good for another 24 h.
 *    `POST`, which the docs show, answers DH-905.
 *  - Renewing INVALIDATES the old token at once (profile -> DH-906 "Invalid Token").
 *
 * The last fact means exactly ONE process may renew: this server. It swaps the new token into the
 * shared `creds` object (every service holds that same object, so the poller, candles and the
 * feed's next reconnect all pick it up) and writes it back to `.env`, so `npm run check` and a
 * restart see the live token rather than the one it replaced. Never copy `.env` to a second
 * machine that also runs the server: whichever renews first kills the other's token.
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { Credentials } from './dhan.ts';

const ENV_PATH = path.resolve(process.cwd(), '.env');

/** The JWT's `exp` in ms, or null if the token is not a readable JWT. No signature check - Dhan does that. */
export function tokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch { return null; }
}

/** 09:00-15:45 IST, Mon-Fri. A renewal is a moment with a dead token in flight; not during trading. */
function inMarketHours(nowMs: number): boolean {
  const ist = new Date(nowMs + 5.5 * 3600_000);
  const day = ist.getUTCDay();
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return day >= 1 && day <= 5 && mins >= 9 * 60 && mins <= 15 * 60 + 45;
}

/**
 * Renew when under 12 h remain outside market hours, or under 2 h remain at any time. With a
 * 24 h token and a 15-minute check that renews about twice a day and never during a session
 * unless the token would otherwise die in it.
 */
export function shouldRenew(expMs: number, nowMs: number): boolean {
  const left = expMs - nowMs;
  if (left <= 0) return false;              // expired: RenewToken refuses these; a human must act
  if (left < 2 * 3600_000) return true;
  return left < 12 * 3600_000 && !inMarketHours(nowMs);
}

export type RenewResult = { ok: true; expiresAt: string } | { ok: false; why: string };

export async function renewToken(creds: Credentials): Promise<RenewResult> {
  let res: Response;
  try {
    res = await fetch('https://api.dhan.co/v2/RenewToken', {
      method: 'GET',
      headers: { 'access-token': creds.accessToken, dhanClientId: creds.clientId, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, why: `network: ${(err as Error).message}` };
  }
  const text = await res.text();
  let body: { token?: string; expiryTime?: string; errorCode?: string; errorMessage?: string } = {};
  try { body = JSON.parse(text); } catch { /* reported below */ }
  if (!res.ok || typeof body.token !== 'string' || !body.token.startsWith('eyJ')) {
    return { ok: false, why: `HTTP ${res.status} ${body.errorCode ?? ''} ${body.errorMessage ?? text.slice(0, 80)}`.trim() };
  }
  creds.accessToken = body.token;
  await persist(body.token);
  const exp = tokenExpiryMs(body.token);
  return { ok: true, expiresAt: exp ? new Date(exp).toISOString() : String(body.expiryTime) };
}

/** Rewrite the DHAN_ACCESS_TOKEN line of .env via a temp file, so a crash cannot leave it half-written. */
async function persist(token: string): Promise<void> {
  let text = '';
  try { text = await readFile(ENV_PATH, 'utf8'); } catch { /* no .env: create one */ }
  const line = `DHAN_ACCESS_TOKEN=${token}`;
  text = /^DHAN_ACCESS_TOKEN=.*$/m.test(text)
    ? text.replace(/^DHAN_ACCESS_TOKEN=.*$/m, line)
    : text.replace(/\n?$/, '\n') + line + '\n';
  const tmp = ENV_PATH + '.tmp';
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, ENV_PATH);
}

/** Check every 15 minutes and renew per `shouldRenew`. Logs expiry times, never the token. */
export function keepAlive(creds: Credentials | null, log: (msg: string) => void = console.log): void {
  if (!creds) return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    const exp = tokenExpiryMs(creds.accessToken);
    if (exp === null || !shouldRenew(exp, Date.now())) return;
    busy = true;
    try {
      const r = await renewToken(creds);
      log(r.ok ? `[token] renewed, now expires ${r.expiresAt}` : `[token] renewal FAILED: ${r.why}`);
    } finally { busy = false; }
  };
  void tick();
  setInterval(() => { void tick(); }, 15 * 60_000).unref();
}
