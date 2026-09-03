/**
 * Backend: instrument registry, chain pollers, telemetry, SSE stream, and the static UI.
 *
 * The browser talks only to this process. The Dhan access token never leaves it.
 */

import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  resolveRegistry, optionContracts, sessionState, type Registry, type ResolvedInstrument,
} from './instruments.ts';
import { readCredentials } from './dhan.ts';
import { Scanner, scanCsv } from './scanner.ts';
import { CandleService, INTERVALS, type Interval } from './candles.ts';
import { PollerHub, type Snapshot, type PollerStatus } from './poller.ts';
import { isReplay, replayBasePrice } from './replay.ts';
import { FeedClient, TickHistory, type Subscription, type Tick, type FeedState } from './feed.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' } });
const creds = readCredentials();
const hub = new PollerHub(creds);
const feed = new FeedClient(creds);
const history = new TickHistory();
const scanner = new Scanner(creds);
const candles = new CandleService(creds);

/**
 * Which instruments each open SSE connection wants ticks for. The feed holds ONE socket, so it
 * subscribes to the union - two tabs on different underlyings both keep working, and Dhan's
 * 5-socket-per-user limit is never approached.
 */
const feedWants = new Map<number, Subscription[]>();
let feedConnSeq = 0;

function refreshFeedSubscriptions() {
  const union = new Map<string, Subscription>();
  for (const list of feedWants.values()) {
    for (const s of list) union.set(`${s.seg}:${s.securityId}`, s);
  }
  if (union.size === 0) feed.stop();
  else feed.setSubscriptions([...union.values()]);
}

/** Underlying ticks feed the chart, so they are kept in a ring buffer per instrument. */
const underlyingOf = new Map<string, string>();   // "SEG:securityId" -> instrument id
feed.on('tick', (t: Tick) => {
  const id = underlyingOf.get(`${t.seg}:${t.securityId}`);
  if (id && t.ltp !== null) history.push(id, t.at, t.ltp);
});

let registry: Registry;

function findInstrument(id: string): ResolvedInstrument | undefined {
  return registry.instruments.find(i => i.id === id);
}

/* ------------------------------------------------------------ static UI */

const STATIC: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.css': { file: 'app.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/chart-tools.js': { file: 'chart-tools.js', type: 'text/javascript; charset=utf-8' },
  '/scan.js': { file: 'scan.js', type: 'text/javascript; charset=utf-8' },
  '/candles.js': { file: 'candles.js', type: 'text/javascript; charset=utf-8' },
  '/panes.js': { file: 'panes.js', type: 'text/javascript; charset=utf-8' },
};

for (const [route, { file, type }] of Object.entries(STATIC)) {
  app.get(route, async (_req, reply) => {
    // Explicit allow-list: no path joining from user input, no traversal surface.
    const body = await readFile(path.join(PUBLIC_DIR, file), 'utf8');
    return reply.type(type).send(body);
  });
}

/* ---------------------------------------------------------------- REST */

app.get('/api/health', async (req) => {
  const force = (req.query as Record<string, string>)?.refresh === '1';
  if (force) registry = await resolveRegistry({ force: true, creds });
  return {
    status: registry.allResolved && (creds || isReplay()) ? 'ok' : 'degraded',
    node: process.version,
    mode: isReplay() ? 'replay' : 'live',
    credentials: { clientId: Boolean(creds?.clientId), accessToken: Boolean(creds?.accessToken) },
    master: registry.meta,
    allResolved: registry.allResolved,
    instruments: registry.instruments,
  };
});

app.get('/api/instruments', async () => ({
  mode: isReplay() ? 'replay' : 'live',
  instruments: registry.instruments.map(i => ({
    id: i.id, label: i.label, displayName: i.displayName, lot: i.lot,
    underlyingScrip: i.underlyingScrip, underlyingSeg: i.underlyingSeg,
    nearestExpiry: i.nearestExpiry, expiries: i.expiries,
    session: i.session, resolved: i.resolved, problems: i.problems, notes: i.notes,
  })),
}));

app.get('/api/feed', async () => ({
  status: feed.status,
  packets: feed.packetsSeen,
  ticks: feed.ticksEmitted,
  subscriptions: [...feedWants.values()].reduce((a, l) => a + l.length, 0),
}));

app.get('/api/telemetry', async () => ({
  stats: hub.bus.stats(),
  samples: hub.bus.recent(60),
}));

/** CSV export of the whole ring buffer - the panel's export button points here. */
app.get('/api/telemetry.csv', async (_req, reply) => {
  const head = 'at,key,endpoint,ok,httpStatus,errorCode,bytes,strikes,gateWaitMs,serverMs,downloadMs,computeMs,roundTripMs,replay';
  const lines = hub.bus.all().map(s => [
    s.at, s.key, s.endpoint, s.ok, s.httpStatus ?? '', s.errorCode ?? '', s.bytes, s.strikes,
    s.timing.gateWait, s.timing.server ?? '', s.timing.download ?? '', s.timing.compute ?? '',
    s.timing.roundTrip ?? '', s.replay,
  ].join(','));
  return reply.type('text/csv; charset=utf-8')
    .header('content-disposition', 'attachment; filename="dhan-latency.csv"')
    .send([head, ...lines].join('\n'));
});

/* ------------------------------------------------------------- scanner (P8) */

/**
 * Row 9: manual only. There is no timer and no 09:20 trigger anywhere in this process - the
 * button and the `S` key are the only things that start a scan.
 *
 * Enabled while the NSE equity session is open, OR in replay mode. Replay is the deviation:
 * without it the phase would be untestable outside 09:15-15:30 IST, which is when almost all
 * work on this project happens. Recorded in scanner-v1.md.
 */
function scanEnabled(): { enabled: boolean; sessionOpen: boolean; reason: string } {
  const session = sessionState('NSE_BSE_FNO');
  if (isReplay()) return { enabled: true, sessionOpen: session.openNow, reason: 'replay mode' };
  return { enabled: session.openNow, sessionOpen: session.openNow, reason: session.reason };
}

app.get('/api/scan/status', async () => ({
  ...scanEnabled(),
  mode: isReplay() ? 'replay' : 'live',
  progress: scanner.progress,
  hasResult: scanner.last !== null,
}));

app.get('/api/scan', async (_req, reply) => {
  const gate = scanEnabled();
  if (!gate.enabled) {
    return reply.code(409).send({ error: `the NSE equity session is closed - ${gate.reason}` });
  }
  // A scan already running is joined rather than duplicated: the fan-out spends a shared rate
  // limit, so two of them would be twice as slow and no more informative.
  return scanner.run();
});

app.get('/api/scan.csv', async (_req, reply) => {
  if (!scanner.last) return reply.code(404).send({ error: 'no scan has been run yet' });
  return reply.type('text/csv; charset=utf-8')
    .header('content-disposition', 'attachment; filename="dhan-scan.csv"')
    .send(scanCsv(scanner.last));
});

/* ------------------------------------------------------ option candles (P9) */

/**
 * One option contract's own candles, coloured by option-candles-v1.md rows 5-8.
 *
 * There is no session gate here: candles are history, and a contract's last session is exactly
 * what a reader wants to see after the close. The rate gate lives in `dhanPost`, keyed per
 * (contract, interval) by `CandleService`.
 */
app.get('/api/candles', async (req, reply) => {
  const q = req.query as Record<string, string>;
  const inst = findInstrument(q.key ?? '');
  if (!inst) return reply.code(404).send({ error: `unknown instrument ${q.key}` });

  const expiry = q.expiry || inst.nearestExpiry;
  if (!expiry) return reply.code(400).send({ error: `${inst.id} has no expiry` });

  const strike = Number(q.strike);
  if (!Number.isFinite(strike) || strike <= 0) {
    return reply.code(400).send({ error: `bad strike ${q.strike}` });
  }
  if (q.side !== 'ce' && q.side !== 'pe') {
    return reply.code(400).send({ error: `side must be ce or pe, got ${q.side}` });
  }
  // Row 4. An unknown interval is a client bug, not something to silently coerce - the tooltip's
  // arithmetic depends on which interval the numbers came from.
  const interval = (q.interval ?? '5') as Interval;
  if (!(INTERVALS as readonly string[]).includes(interval)) {
    return reply.code(400).send({ error: `interval must be one of ${INTERVALS.join(' / ')}` });
  }

  return candles.get(inst, expiry, strike, q.side, interval);
});

/* ----------------------------------------------------------------- SSE */

app.get('/api/stream', (req, reply) => {
  const q = req.query as Record<string, string>;
  const inst = findInstrument(q.key ?? '');
  if (!inst) return reply.code(404).send({ error: `unknown instrument ${q.key}` });

  const expiry = q.expiry || inst.nearestExpiry;
  if (!expiry) return reply.code(400).send({ error: `${inst.id} has no expiry` });

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: string, data: unknown) => {
    // pushedAt lets the client measure transport across the two clocks, clearly labelled.
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify({ ...(data as object), pushedAt: Date.now() })}\n\n`);
  };

  const poller = hub.get(inst, expiry);
  const offPoller = poller.on(ev => {
    if (ev.type === 'snapshot') { syncContractSubs(ev.data as Snapshot); send('snapshot', ev.data as Snapshot); }
    else send('status', ev.data as PollerStatus);
  });
  const offBus = hub.bus.on(s => { if (s.key === poller.key) send('telemetry', s); });

  /* ---- live feed: the underlying for the chart, every contract for the grid ---- */

  const contracts = optionContracts(inst.id, expiry);
  const byStrike = new Map<string, typeof contracts[number]>();
  for (const c of contracts) byStrike.set(`${c.strike}|${c.optionType}`, c);

  const connId = ++feedConnSeq;
  const underlyingId = inst.underlyingScrip;
  const cellOf = new Map<number, { strike: number; side: 'ce' | 'pe' }>();

  const underlyingSub: Subscription[] = [];
  if (underlyingId !== null) {
    underlyingSub.push({
      seg: inst.underlyingSeg, securityId: underlyingId, mode: 'quote',
      base: isReplay() ? replayBasePrice(inst.id) : undefined,
    });
    underlyingOf.set(`${inst.underlyingSeg}:${underlyingId}`, inst.id);
  }
  feedWants.set(connId, underlyingSub);
  refreshFeedSubscriptions();

  /**
   * The master lists every strike the exchange has ever opened for this expiry - for NIFTY that
   * is several hundred - while the option chain returns only the band around spot that we
   * actually render. Subscribing to the master's list would burn bandwidth on rows nobody sees,
   * so the contract subscriptions are rebuilt from each snapshot's own strike list.
   */
  let subscribedStrikes = '';
  const syncContractSubs = (snap: Snapshot) => {
    const key = snap.rows.map(r => r.strike).join(',');
    if (key === subscribedStrikes) return;
    subscribedStrikes = key;

    const wants = [...underlyingSub];
    cellOf.clear();
    for (const row of snap.rows) {
      for (const side of ['CE', 'PE'] as const) {
        const c = byStrike.get(`${row.strike}|${side}`);
        if (!c) continue;
        wants.push({
          seg: c.seg, securityId: c.securityId, mode: 'full',
          // Replay seeds each contract from its real LTP and OI in the snapshot, so a synthetic
          // tick on a far OTM strike does not print the same price - or the same open interest -
          // as an ATM one. P7 compares OI against a per-contract peak, so an unanchored OI makes
          // that whole column meaningless.
          base: isReplay() ? ((side === 'CE' ? row.ce.ltp : row.pe.ltp) ?? undefined) : undefined,
          oiBase: isReplay() ? ((side === 'CE' ? row.ce.oi : row.pe.oi) ?? undefined) : undefined,
        });
        cellOf.set(c.securityId, { strike: c.strike, side: side === 'CE' ? 'ce' : 'pe' });
      }
    }
    feedWants.set(connId, wants);
    refreshFeedSubscriptions();
  };

  /**
   * Ticks are batched at 10 Hz. A busy expiry can print thousands of ticks a second, and one SSE
   * frame per tick would spend more time in the browser's event loop than in the paint.
   */
  let pending: unknown[] = [];
  const onTick = (t: Tick) => {
    if (t.securityId === underlyingId && t.seg === inst.underlyingSeg) {
      pending.push({ k: 'u', p: t.ltp, v: t.volume, t: t.at });
      return;
    }
    const cell = cellOf.get(t.securityId);
    if (!cell) return;
    pending.push({ k: cell.side, s: cell.strike, p: t.ltp, v: t.volume, o: t.oi, t: t.at });
  };
  feed.on('tick', onTick);

  const flush = setInterval(() => {
    if (!pending.length) return;
    send('ticks', { batch: pending });
    pending = [];
  }, 100);

  const onFeedStatus = (fs: FeedState) => send('feed', fs);
  feed.on('status', onFeedStatus);

  /* ---- opening frames ---- */

  send('hello', {
    key: poller.key, mode: isReplay() ? 'replay' : 'live', serverNow: Date.now(),
    contractsAvailable: contracts.length, underlyingSeg: inst.underlyingSeg, underlyingScrip: inst.underlyingScrip,
  });
  // Backfill: a client joining a warm poller must not stare at an empty panel until the
  // next tick, which for a closed market is 60 s away.
  for (const s of hub.bus.all().filter(s => s.key === poller.key).slice(-20)) send('telemetry', s);
  if (poller.last) { syncContractSubs(poller.last); send('snapshot', poller.last); }
  send('status', poller.status);
  send('feed', feed.status);
  send('chart-history', { points: history.get(inst.id, 30 * 60_000) });

  poller.subscribe();

  const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);
  const cleanup = () => {
    clearInterval(heartbeat);
    clearInterval(flush);
    offPoller();
    offBus();
    feed.off('tick', onTick);
    feed.off('status', onFeedStatus);
    feedWants.delete(connId);
    refreshFeedSubscriptions();
    poller.unsubscribe();
  };
  req.raw.on('close', cleanup);
  req.raw.on('error', cleanup);
});

/* ---------------------------------------------------------------- boot */

const start = async () => {
  registry = await resolveRegistry({ creds });

  const mode = isReplay() ? 'REPLAY (synthetic data)' : 'LIVE (Dhan API)';
  const lines = registry.instruments.map(i =>
    `  ${(i.resolved ? 'ok' : 'BLOCKED').padEnd(7)} ${i.id.padEnd(10)} ` +
    `scrip=${String(i.underlyingScrip ?? '?').padStart(7)} seg=${i.underlyingSeg.padEnd(8)} ` +
    `lot=${String(i.lot ?? '?').padStart(4)} expiry=${i.nearestExpiry ?? '?'} ` +
    `strikes~${i.optionContracts} ${i.session.openNow ? 'OPEN' : 'closed'}` +
    (i.problems.length ? `\n          ! ${i.problems.join('; ')}` : ''));

  await app.listen({ port: PORT, host: '127.0.0.1' });

  console.log(`\nDhan Option Chain Terminal - ${mode}`);
  console.log(`master ${(registry.meta.bytes / 1e6).toFixed(1)} MB, ${registry.meta.rowsKept} tracked rows\n`);
  console.log(lines.join('\n'));
  if (!creds && !isReplay()) console.log('\n  ! no credentials in .env - every poll will report NO_CREDS');
  console.log(`\n  open  http://127.0.0.1:${PORT}\n`);
};

start().catch(err => { console.error(err); process.exit(1); });
