/**
 * SPIKE-01 - resolve the GOLD UnderlyingScrip.
 *
 * MCX commodity options (OPTFUT) hang off a futures contract, not a spot index, and Dhan's
 * docs only give index examples. So the value is proven with real calls rather than guessed.
 *
 * Order of attempts, each against POST /v2/optionchain/expirylist with UnderlyingSeg MCX_COMM:
 *   1. Dhan security id of the near-month GOLD FUTCOM contract (read from the master)
 *   2. UNDERLYING_SECURITY_ID carried on the GOLD OPTFUT rows (the MCX-side token)
 *
 * On success it fetches one real option chain to prove the whole path works, prints whether
 * greeks are present, and writes .cache/gold-resolution.json which instruments.ts picks up.
 *
 * Run: npm run spike:gold
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadMaster } from '../src/server/master.ts';
import { nearMonthGoldFuture, todayIso, GOLD_RESOLUTION_FILE, type GoldResolution } from '../src/server/instruments.ts';
import { readCredentials, fetchExpiryList, fetchOptionChain, explain } from '../src/server/dhan.ts';

const SEG = 'MCX_COMM';

const creds = readCredentials();
if (!creds) {
  console.error('\nSPIKE-01 cannot run: DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN are not set.');
  console.error('Copy .env.example to .env, fill both values, then run: npm run spike:gold\n');
  process.exit(2);
}

console.log('SPIKE-01  resolving GOLD UnderlyingScrip for UnderlyingSeg=MCX_COMM\n');

const { rows } = await loadMaster();
const today = todayIso();

const optfut = rows.filter(r =>
  r.exchId === 'MCX' && r.instrument === 'OPTFUT' && r.underlyingSymbol === 'GOLD' && r.expiry && r.expiry >= today);
const future = nearMonthGoldFuture(rows, today);
const mcxToken = Number(optfut[0]?.underlyingSecurityId ?? 0);

console.log(`master: ${optfut.length} live GOLD OPTFUT contracts, ` +
  `near-month future ${future ? `${future.displayName} (id ${future.securityId}, exp ${future.expiry})` : 'NOT FOUND'}\n`);

type Candidate = { value: number; why: string };
const candidates: Candidate[] = [];
if (future) candidates.push({ value: future.securityId, why: `near-month FUTCOM ${future.displayName}` });
if (mcxToken > 0) candidates.push({ value: mcxToken, why: 'UNDERLYING_SECURITY_ID on GOLD OPTFUT rows' });

if (candidates.length === 0) {
  console.error('No candidate found in the instrument master. GOLD stays blocked.');
  process.exit(1);
}

let winner: { candidate: Candidate; expiries: string[] } | null = null;

for (const c of candidates) {
  process.stdout.write(`try UnderlyingScrip=${c.value}  (${c.why})  ... `);
  const call = await fetchExpiryList(creds, c.value, SEG);
  if (call.ok && Array.isArray(call.data?.data) && call.data!.data.length > 0) {
    console.log(`OK  ${call.timing.roundTrip} ms  ${call.data!.data.length} expiries`);
    winner = { candidate: c, expiries: call.data!.data };
    break;
  }
  const e = call.error;
  console.log(`FAIL  ${e?.code ?? '?'}  ${e?.message ?? 'no expiries returned'}`);
  if (e) console.log(`      ${explain(e.code)}`);
  if (e?.code === 'DH-901') {
    console.error('\nStopping: the access token itself is rejected. Fix .env before re-running.\n');
    process.exit(1);
  }
}

if (!winner) {
  console.error('\nSPIKE-01 FAILED. Both candidates were rejected.');
  console.error('Next step per docs/spec/dhan-api-contract.md: raise a Dhan API support ticket and');
  console.error('ship the other five chips with GOLD behind a feature flag.\n');
  process.exit(1);
}

console.log(`\nexpiries: ${winner.expiries.slice(0, 8).join(', ')}${winner.expiries.length > 8 ? ' ...' : ''}`);

// Prove the full path, not just the expiry list.
const expiry = winner.expiries[0]!;
process.stdout.write(`\nfetch chain  scrip=${winner.candidate.value} expiry=${expiry} ... `);
const chain = await fetchOptionChain(creds, winner.candidate.value, SEG, expiry);

if (!chain.ok) {
  console.log(`FAIL  ${chain.error?.code}  ${chain.error?.message}`);
  console.error('\nExpiry list works but the chain does not. Recording nothing; GOLD stays blocked.\n');
  process.exit(1);
}

const oc = chain.data!.data.oc ?? {};
const strikes = Object.keys(oc);
const sample = oc[strikes[Math.floor(strikes.length / 2)] ?? '']?.ce;
const hasGreeks = Boolean(sample?.greeks && Number.isFinite(sample.greeks.delta));

console.log(`OK  ${chain.timing.roundTrip} ms  ${(chain.bytes / 1024).toFixed(0)} KB`);
console.log(`  spot        ${chain.data!.data.last_price}`);
console.log(`  strikes     ${strikes.length}`);
console.log(`  greeks      ${hasGreeks ? 'present' : 'MISSING - columns will render as em dashes'}`);
console.log(`  timing      server ${chain.timing.server} ms | download ${chain.timing.download} ms | parse ${chain.timing.compute} ms`);

const resolution: GoldResolution = {
  underlyingScrip: winner.candidate.value,
  via: winner.candidate.why,
  confirmedAt: new Date().toISOString(),
};
await mkdir(path.dirname(GOLD_RESOLUTION_FILE), { recursive: true });
await writeFile(GOLD_RESOLUTION_FILE, JSON.stringify(resolution, null, 2));

console.log(`\nSPIKE-01 RESOLVED -> UnderlyingScrip ${resolution.underlyingScrip} (${resolution.via})`);
console.log(`written to ${GOLD_RESOLUTION_FILE}`);
console.log('Also record this value in docs/spec/dhan-api-contract.md section 6.\n');
