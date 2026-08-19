/**
 * Backend: instrument registry, chain pollers, telemetry, SSE stream, and the static UI.
 *
 * The browser talks only to this process. The Dhan access token never leaves it.
 */

import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveRegistry, type Registry, type ResolvedInstrument } from './instruments.ts';
import { readCredentials } from './dhan.ts';
import { PollerHub, type Snapshot, type PollerStatus } from './poller.ts';
import { isReplay } from './replay.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' } });
const creds = readCredentials();
const hub = new PollerHub(creds);

let registry: Registry;

function findInstrument(id: string): ResolvedInstrument | undefined {
  return registry.instruments.find(i => i.id === id);
}

/* ------------------------------------------------------------ static UI */

const STATIC: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.css': { file: 'app.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
};

for (const [route, { file, type }] of Object.entries(STATIC)) {
  app.get(route, async (_req, reply) => {
    // Explicit allow-list of three files: no path joining from user input, no traversal surface.
    const body = await readFile(path.join(PUBLIC_DIR, file), 'utf8');
    return reply.type(type).send(body);
  });
}

/* ---------------------------------------------------------------- REST */

app.get('/api/health', async (req) => {
  const force = (req.query as Record<string, string>)?.refresh === '1';
  if (force) registry = await resolveRegistry({ force: true });
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
    if (ev.type === 'snapshot') send('snapshot', ev.data as Snapshot);
    else send('status', ev.data as PollerStatus);
  });
  const offBus = hub.bus.on(s => { if (s.key === poller.key) send('telemetry', s); });

  send('hello', { key: poller.key, mode: isReplay() ? 'replay' : 'live', serverNow: Date.now() });
  // Backfill: a client joining a warm poller must not stare at an empty panel until the
  // next tick, which for a closed market is 60 s away.
  for (const s of hub.bus.all().filter(s => s.key === poller.key).slice(-20)) send('telemetry', s);
  if (poller.last) send('snapshot', poller.last);
  send('status', poller.status);

  poller.subscribe();

  const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);
  const cleanup = () => { clearInterval(heartbeat); offPoller(); offBus(); poller.unsubscribe(); };
  req.raw.on('close', cleanup);
  req.raw.on('error', cleanup);
});

/* ---------------------------------------------------------------- boot */

const start = async () => {
  registry = await resolveRegistry();

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
