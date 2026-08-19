/**
 * Credential check. Run this right after pasting a new token into .env:
 *
 *     npm run check
 *
 * It reads .env, reports what the token says about itself, then makes two real calls and
 * prints a verdict. No guessing about whether the swap worked.
 */

import { readCredentials, dhanPost, fetchExpiryList, explain } from '../src/server/dhan.ts';

const creds = readCredentials();

if (!creds) {
  console.error('\n  .env is missing DHAN_CLIENT_ID or DHAN_ACCESS_TOKEN.');
  console.error('  Copy .env.example to .env and fill both, then run this again.\n');
  process.exitCode = 2;
} else {
  console.log('\nDhan credential check\n');

  /* 1. What the token says about itself, before we ask Dhan anything. */
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(Buffer.from(creds.accessToken.split('.')[1] ?? '', 'base64url').toString());
  } catch {
    console.log('  token      NOT A VALID JWT - check for a truncated or wrapped paste');
  }

  const exp = Number(payload.exp ?? 0);
  const iat = Number(payload.iat ?? 0);
  const embeddedId = String(payload.dhanClientId ?? '');
  const now = Math.floor(Date.now() / 1000);

  console.log(`  client id  ${creds.clientId}`);
  if (embeddedId && embeddedId !== creds.clientId) {
    console.log(`  MISMATCH   the token belongs to client ${embeddedId}, not ${creds.clientId}`);
  }
  console.log(`  type       ${String(payload.tokenConsumerType ?? 'unknown')}`);
  if (iat) console.log(`  issued     ${new Date(iat * 1000).toLocaleString('en-IN')}`);
  if (exp) {
    const hoursLeft = (exp - now) / 3600;
    console.log(`  expires    ${new Date(exp * 1000).toLocaleString('en-IN')}` +
      (hoursLeft > 0 ? `  (${hoursLeft.toFixed(1)} h left)` : '  ALREADY EXPIRED'));
  }

  /* 2. Ask Dhan. Two calls: identity, then the endpoint this app actually lives on. */
  console.log('');
  process.stdout.write('  profile        ... ');
  const profile = await dhanPost<{ dhanClientId?: string; dhanClientName?: string; tokenValidity?: string }>(
    '/v2/profile', null, { creds, key: 'check:profile', cadenceMs: 0, method: 'GET' });
  console.log(profile.ok
    ? `ok  ${profile.timing.roundTrip} ms  ${profile.data?.dhanClientName ?? ''} ${profile.data?.tokenValidity ? `(token valid till ${profile.data.tokenValidity})` : ''}`.trimEnd()
    : `FAIL  ${profile.error?.code}  ${profile.error?.message}`);

  process.stdout.write('  option chain   ... ');
  const chain = await fetchExpiryList(creds, 13, 'IDX_I');   // NIFTY 50
  const expiries = chain.data?.data ?? [];
  console.log(chain.ok
    ? `ok  ${chain.timing.roundTrip} ms  ${expiries.length} NIFTY expiries, nearest ${expiries[0] ?? '?'}`
    : `FAIL  ${chain.error?.code}  ${chain.error?.message}`);

  /* 3. Verdict. */
  console.log('');
  if (chain.ok) {
    console.log('  READY. Run `npm run dev` and open http://127.0.0.1:8787\n');
  } else {
    const code = chain.error?.code ?? 'UNKNOWN';
    console.log(`  NOT READY - ${code}`);
    console.log(`  ${explain(code)}`);
    console.log('  New token: https://web.dhan.co -> My Profile -> DhanHQ Trading APIs\n');
    process.exitCode = 1;
  }
}
