/**
 * Live feed probe — run this the first time the Data API plan goes active.
 *
 *     npm run feed:probe            # NIFTY 50 index
 *     npm run feed:probe -- BANKNIFTY
 *
 * Why it exists: the binary packet offsets in src/server/feed.ts come from the DhanHQ docs and
 * have never been checked against real bytes, because the account had no Data API plan while the
 * parser was written. A misaligned parser does not crash - it prints confident nonsense. So this
 * dumps the raw hex beside the parsed values and lets you see, in one screen, whether the numbers
 * are sane. If LTP looks like a real index level, the offsets are right.
 */

import { readCredentials } from '../src/server/dhan.ts';
import { resolveRegistry } from '../src/server/instruments.ts';
import { _internals, type Tick } from '../src/server/feed.ts';

const { parsePackets, REQ } = _internals;

const creds = readCredentials();
if (!creds) {
  console.error('\n  .env has no credentials. Fill it and run npm run check first.\n');
  process.exit(2);
}

const wanted = (process.argv[2] ?? 'NIFTY').toUpperCase();
const registry = await resolveRegistry({ creds });
const inst = registry.instruments.find(i => i.id === wanted);

if (!inst || inst.underlyingScrip === null) {
  console.error(`\n  unknown or unresolved instrument "${wanted}".`);
  console.error(`  try one of: ${registry.instruments.map(i => i.id).join(', ')}\n`);
  process.exit(2);
}

console.log(`\nfeed probe — ${inst.displayName}  (${inst.underlyingSeg} ${inst.underlyingScrip})`);
console.log(`session: ${inst.session.window}  ->  ${inst.session.reason}`);
if (!inst.session.openNow) console.log('NOTE: the market is closed, so expect few or no ticks.\n');
else console.log('');

const url = `wss://api-feed.dhan.co?version=2&token=${encodeURIComponent(creds.accessToken)}`
  + `&clientId=${encodeURIComponent(creds.clientId)}&authType=2`;

const ws = new WebSocket(url);
ws.binaryType = 'arraybuffer';

let packets = 0;
let ticks = 0;
const SHOW = 8;

const timer = setTimeout(() => {
  console.log(`\ndone — ${packets} frames, ${ticks} ticks parsed.`);
  if (ticks === 0) {
    console.log('No ticks. Either the market is shut, or the Data API plan is not active');
    console.log('(a plan problem shows up as an immediate close with code 1006).');
  }
  try { ws.close(); } catch { /* already closing */ }
  process.exit(ticks > 0 ? 0 : 1);
}, 20_000);

ws.onopen = () => {
  console.log('connected. subscribing (quote packet)...\n');
  ws.send(JSON.stringify({
    RequestCode: REQ.SUB_QUOTE,
    InstrumentCount: 1,
    InstrumentList: [{ ExchangeSegment: inst.underlyingSeg, SecurityId: String(inst.underlyingScrip) }],
  }));
};

ws.onmessage = (ev: MessageEvent) => {
  const buf = Buffer.from(ev.data as ArrayBuffer);
  packets++;

  if (packets <= SHOW) {
    console.log(`frame ${packets}: ${buf.length} bytes`);
    console.log(`  hex   ${buf.subarray(0, Math.min(64, buf.length)).toString('hex').replace(/(.{8})/g, '$1 ')}`);
    console.log(`  head  code=${buf.readUInt8(0)} declaredLen=${buf.readInt16LE(1)} ` +
      `seg=${buf.readUInt8(3)} securityId=${buf.readInt32LE(4)}`);
  }

  parsePackets(buf,
    (t: Tick) => {
      ticks++;
      if (packets <= SHOW) {
        console.log(`  tick  ltp=${t.ltp}  ltt=${t.ltt ? new Date(t.ltt * 1000).toLocaleTimeString('en-IN') : '-'}` +
          `  vol=${t.volume}  oi=${t.oi}  ohlc=${t.open}/${t.high}/${t.low}/${t.close}\n`);
      }
    },
    (reason: number) => console.log(`  DISCONNECT packet, reason code ${reason}\n`));
};

ws.onerror = () => console.log('socket error');

ws.onclose = (ev: CloseEvent) => {
  clearTimeout(timer);
  console.log(`\nsocket closed: code=${ev.code} reason=${ev.reason || '(none)'}`);
  if (ev.code === 1006 && ticks === 0) {
    console.log('Code 1006 with no reason almost always means the Data API plan is not active.');
    console.log('Check: npm run check');
  }
  console.log(`${packets} frames, ${ticks} ticks parsed.\n`);
  process.exit(ticks > 0 ? 0 : 1);
};
