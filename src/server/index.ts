/**
 * Backend: instrument registry, chain pollers, telemetry, SSE stream, and the static UI.
 *
 * The browser talks only to this process. The Dhan access token never leaves it.
 */

import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  resolveRegistry, optionContracts, sessionState, withLiveSession, fnoUniverse, stockOptions, todayIso,
  type Registry, type ResolvedInstrument,
} from './instruments.ts';
import { readCredentials, CADENCE_MS } from './dhan.ts';
import { Scanner, scanCsv } from './scanner.ts';
import { NseScanner, nseScanCsv, TOP_N_CHOICES, DEFAULT_TOP_N, type TopN } from './scanner-nse.ts';
import { CandleService, INTERVALS, type Interval } from './candles.ts';
import { UnderlyingCandleService, toUCandles } from './ucandles.ts';
import { PollerHub, type Snapshot, type PollerStatus } from './poller.ts';
import { isReplay, replayBasePrice, replayOrbCandles } from './replay.ts';
import { fetchIntraday } from './peakoi.ts';
import { readChain } from './ltp.ts';
import { PaperTrader, ledgerPath } from './paper.ts';
import { keepAwake } from './awake.ts';
import { FeedClient, TickHistory, type Subscription, type Tick, type FeedState } from './feed.ts';
import { keepAlive, tokenExpiryMs } from './token.ts';
import { execFileSync } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

/**
 * Which commit is running, so a second machine can tell at a glance whether its clone is current
 * (`/api/health` and the boot banner). Not a git checkout (e.g. a ZIP download) -> 'unknown'.
 */
const BUILD = (() => {
  try {
    return execFileSync('git', ['log', '-1', '--format=%h %cs %s'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return 'unknown (not a git checkout)'; }
})();

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' } });
const creds = readCredentials();
const hub = new PollerHub(creds);
const feed = new FeedClient(creds);
const history = new TickHistory();
const scanner = new Scanner(creds);
const nseScanner = new NseScanner();
const candles = new CandleService(creds);
const ucandles = new UnderlyingCandleService(creds);
// P17: this process is the one token owner - it renews before the 24 h expiry and rewrites .env.
if (!isReplay()) keepAlive(creds);

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

/**
 * P32 (paper-trading-v1.md row 12): the paper trader's futures ride the SAME feed union under one
 * reserved key, so they stream whether or not a browser tab is open, and no second socket or REST
 * poll exists. Paper means paper: this object never reaches an order endpoint - it has none.
 */
const PAPER_CONN = -1;
const paper = new PaperTrader({
  file: ledgerPath(),
  mode: isReplay() ? 'replay' : 'live',
  lookup: (symbol) => fnoUniverse(todayIso()).find(s => s.symbol === symbol),
  scan: () => nseScanner.run(DEFAULT_TOP_N),
  // orb-strategy-v1.md rows 3, 7: the future's own 5-minute candles, with a week behind them so
  // SMA9 exists at 09:25. Every paper fetch shares ONE gate key - dhan.ts gates per key.
  candles: async (ask, nowMs) => {
    if (isReplay()) return { bars: toUCandles(replayOrbCandles(ask.symbol, ask.side, ask.base, nowMs)), why: null };
    const res = await fetchIntraday(creds, {
      securityId: String(ask.securityId), seg: 'NSE_FNO', instrument: 'FUTSTK', interval: '5', oi: false,
      fromDate: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10), toDate: todayIso(),
      key: 'paper:candles', cadenceMs: CADENCE_MS,
    });
    return res.why ? { bars: [], why: res.why } : { bars: toUCandles(res.candles), why: null };
  },
  // sleep-proof-v1.md row 1: a leg's 1-minute candles, read only to price an exit that came due
  // while the process was blind. Same gate key as the 5-minute reads. Replay has no such series,
  // so a replay gap waits and is named (row 2) rather than priced from an invented candle.
  minuteBars: async (ask) => {
    if (isReplay()) return { bars: [], why: 'replay has no 1-minute candles' };
    const res = await fetchIntraday(creds, {
      securityId: String(ask.securityId), seg: 'NSE_FNO', instrument: ask.leg === 'option' ? 'OPTSTK' : 'FUTSTK',
      interval: '1', oi: false, fromDate: todayIso(), toDate: todayIso(),
      key: 'paper:candles', cadenceMs: CADENCE_MS,
    });
    return res.why ? { bars: [], why: res.why } : { bars: toUCandles(res.candles), why: null };
  },
  // Row 3: live only. Replay trades nothing real and has no reason to hold a laptop awake.
  onAwake: (hold) => { if (!isReplay()) keepAwake(hold); },
  options: (symbol) => stockOptions(symbol, todayIso()),
  onWants: (subs) => {
    if (subs.length) feedWants.set(PAPER_CONN, subs);
    else feedWants.delete(PAPER_CONN);
    refreshFeedSubscriptions();
  },
});

/** Underlying ticks feed the chart, so they are kept in a ring buffer per instrument. */
const underlyingOf = new Map<string, string>();   // "SEG:securityId" -> instrument id
feed.on('tick', (t: Tick) => {
  const id = underlyingOf.get(`${t.seg}:${t.securityId}`);
  if (id && t.ltp !== null) history.push(id, t.at, t.ltp);
  paper.onFeedTick(t);
});

let registry: Registry;

function findInstrument(id: string): ResolvedInstrument | undefined {
  return registry.instruments.find(i => i.id === id);
}

/* ------------------------------------------------------------ access (P17) */

/**
 * Anything that reaches this server through a tunnel or a host's proxy must log in: behind it is
 * the user's Dhan token and rate limit. A request is "local" only when it comes from loopback AND
 * carries no X-Forwarded-For - tunnels (ngrok, cloudflared) connect from loopback but always add
 * that header, and a client cannot strip a header the proxy adds. Local use stays password-free.
 *
 * With APP_PASSWORD unset nothing changes, and the server still listens on 127.0.0.1 only.
 */
const APP_USER = (process.env.APP_USER ?? 'dhan').trim();
const APP_PASSWORD = (process.env.APP_PASSWORD ?? '').trim();

function isDirectLocal(req: { ip: string; headers: Record<string, unknown> }): boolean {
  const loop = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  return loop && req.headers['x-forwarded-for'] === undefined;
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

if (APP_PASSWORD) {
  app.addHook('onRequest', async (req, reply) => {
    if (isDirectLocal(req)) return;
    const h = req.headers.authorization ?? '';
    if (h.startsWith('Basic ')) {
      const [user, ...rest] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
      if (sameSecret(user ?? '', APP_USER) && sameSecret(rest.join(':'), APP_PASSWORD)) return;
    }
    return reply.code(401).header('WWW-Authenticate', 'Basic realm="Dhan terminal", charset="UTF-8"').send('login required');
  });
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
  '/telemetry.js': { file: 'telemetry.js', type: 'text/javascript; charset=utf-8' },
  '/ucandles.js': { file: 'ucandles.js', type: 'text/javascript; charset=utf-8' },
  '/chart-style.js': { file: 'chart-style.js', type: 'text/javascript; charset=utf-8' },
  '/ltp.js': { file: 'ltp.js', type: 'text/javascript; charset=utf-8' },
  '/paper.js': { file: 'paper.js', type: 'text/javascript; charset=utf-8' },
};

for (const [route, { file, type }] of Object.entries(STATIC)) {
  app.get(route, async (_req, reply) => {
    // Explicit allow-list: no path joining from user input, no traversal surface.
    const body = await readFile(path.join(PUBLIC_DIR, file), 'utf8');
    // no-cache = revalidate every load. Without it a browser that once opened 127.0.0.1:8787 can
    // keep painting an older app.css / app.js after a `git pull`, which reads as "the update did
    // nothing" (the P17 audit of a second machine).
    return reply.type(type).header('Cache-Control', 'no-cache').send(body);
  });
}

/* ---------------------------------------------------------------- REST */

app.get('/api/health', async (req) => {
  const force = (req.query as Record<string, string>)?.refresh === '1';
  if (force) registry = await resolveRegistry({ force: true, creds });
  return {
    status: registry.allResolved && (creds || isReplay()) ? 'ok' : 'degraded',
    node: process.version,
    build: BUILD,
    mode: isReplay() ? 'replay' : 'live',
    credentials: {
      clientId: Boolean(creds?.clientId), accessToken: Boolean(creds?.accessToken),
      tokenExpires: creds ? new Date(tokenExpiryMs(creds.accessToken) ?? 0).toISOString() : null,
    },
    master: registry.meta,
    allResolved: registry.allResolved,
    instruments: withLiveSession(registry.instruments),
  };
});

app.get('/api/instruments', async () => ({
  mode: isReplay() ? 'replay' : 'live',
  instruments: withLiveSession(registry.instruments).map(i => ({
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
  // The DEDUPED union, which is what the socket is actually subscribed to. Summing the
  // per-connection lists counted the same contract once per open tab: two tabs on one NIFTY
  // chain reported 166 and three reported 249, while the real set never left 83. P5's "zero
  // orphans" criterion is measured through this field, so it has to be the true number.
  subscriptions: new Set(
    [...feedWants.values()].flatMap(l => l.map(s => `${s.seg}:${s.securityId}`)),
  ).size,
  connections: feedWants.size,
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

/**
 * P14 adds a second source. `source=nse` (the default) reads nseindia.com and has no session
 * gate - the button is manual and the result carries NSE's own timestamp and market status
 * (scanner-nse-v1.md rows 8, 9). `source=dhan` is P8, unchanged, gate included.
 *
 * Query parameters are the only user input here, so both are whitelisted rather than parsed.
 */
type ScanSource = 'nse' | 'dhan';

function scanQuery(q: unknown): { source: ScanSource; n: TopN; reuse: boolean } | { error: string } {
  const query = (q ?? {}) as Record<string, string | undefined>;
  const source = query.source ?? 'nse';
  if (source !== 'nse' && source !== 'dhan') return { error: 'source must be nse or dhan' };
  const n = query.n === undefined ? DEFAULT_TOP_N : Number(query.n);
  if (!(TOP_N_CHOICES as readonly number[]).includes(n)) return { error: `n must be one of ${TOP_N_CHOICES.join(', ')}` };
  return { source, n: n as TopN, reuse: query.reuse === '1' };
}

app.get('/api/scan/status', async (req, reply) => {
  const q = scanQuery(req.query);
  if ('error' in q) return reply.code(400).send({ error: q.error });
  if (q.source === 'nse') {
    return {
      source: 'nse', enabled: true, sessionOpen: sessionState('NSE_BSE_FNO').openNow,
      reason: 'manual - NSE data carries its own timestamp',
      mode: process.env.NSE_FIXTURE ? 'fixture' : 'live',
      progress: nseScanner.progress,
      hasResult: nseScanner.last !== null,
    };
  }
  return {
    source: 'dhan',
    ...scanEnabled(),
    mode: isReplay() ? 'replay' : 'live',
    progress: scanner.progress,
    hasResult: scanner.last !== null,
  };
});

app.get('/api/scan', async (req, reply) => {
  const q = scanQuery(req.query);
  if ('error' in q) return reply.code(400).send({ error: q.error });
  if (q.source === 'nse') return nseScanner.run(q.n, q.reuse);

  const gate = scanEnabled();
  if (!gate.enabled) {
    return reply.code(409).send({ error: `the NSE equity session is closed - ${gate.reason}` });
  }
  // A scan already running is joined rather than duplicated: the fan-out spends a shared rate
  // limit, so two of them would be twice as slow and no more informative.
  return scanner.run();
});

app.get('/api/scan.csv', async (req, reply) => {
  const q = scanQuery(req.query);
  if ('error' in q) return reply.code(400).send({ error: q.error });
  const csv = q.source === 'nse'
    ? (nseScanner.last ? nseScanCsv(nseScanner.last) : null)
    : (scanner.last ? scanCsv(scanner.last) : null);
  if (csv === null) return reply.code(404).send({ error: 'no scan has been run yet' });
  return reply.type('text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${q.source}-scan.csv"`)
    .send(csv);
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
  // Validate at the boundary. Unvalidated, every distinct value creates a ChainPoller in
  // PollerHub that is never removed, plus a permanent PeakOiStore.onProgress listener - measured
  // at ~0.26 MB retained per request, linear, and still held after every connection closed
  // (144 -> 161 MB over 60 requests, -> 191 MB over 180). It is reachable with one query
  // parameter and no credentials. Live it would also send a junk `Expiry` straight to Dhan.
  if (!inst.expiries.includes(expiry)) {
    return reply.code(400).send({
      error: `unknown expiry ${expiry} for ${inst.id}`,
      expiries: inst.expiries,
    });
  }

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

/* ------------------------------------------------- underlying candles (P19) */

/**
 * The chip's own underlying as OHLC candles - underlying-candles-v1.md rows 2-4. Like P9 there is
 * no session gate: a shut market still charts its last session. `openNow` tells the client
 * whether re-fetching every 60 s can change anything.
 */
app.get('/api/ucandles', async (req, reply) => {
  const q = req.query as Record<string, string>;
  const inst = findInstrument(q.key ?? '');
  if (!inst) return reply.code(400).send({ error: `unknown instrument ${q.key}` });
  const interval = (q.interval ?? '5') as Interval;
  if (!(INTERVALS as readonly string[]).includes(interval)) {
    return reply.code(400).send({ error: `interval must be one of ${INTERVALS.join(' / ')}` });
  }
  const res = await ucandles.get(inst, interval);
  return { ...res, openNow: sessionState(inst.session.id).openNow };
});

/* --------------------------------------------- LTP Calculator (P29, L0-L3 + L6) */

/**
 * One reading of the chain by `ltp-calculator-v1.md`'s rules: the imaginary line, the ATM by
 * highest TIME VALUE (not nearest spot — spec row 2), support and resistance by the outward scan,
 * their grades, and the reversal-price ladder.
 *
 * It reads the poller's LAST snapshot and computes nothing from the network — spec row 8. A second
 * Dhan call inside the poll loop is a cadence bug waiting to happen, and this is a second READING
 * of a payload the option chain already subscribes to, not a second subscription.
 *
 * Expiry is validated against the instrument's own list for the same reason `/api/candles` does:
 * unvalidated, every distinct value creates a ChainPoller that is never removed (~0.26 MB each,
 * reachable with one query parameter and no credentials).
 */
app.get('/api/ltp', async (req, reply) => {
  const q = req.query as Record<string, string>;
  const inst = findInstrument(q.key ?? '');
  if (!inst) return reply.code(404).send({ error: `unknown instrument ${q.key}` });
  const expiry = q.expiry || inst.nearestExpiry;
  if (!expiry) return reply.code(400).send({ error: `${inst.id} has no expiry` });
  if (!inst.expiries.includes(expiry)) {
    return reply.code(400).send({ error: `unknown expiry ${expiry} for ${inst.id}`, expiries: inst.expiries });
  }

  const poller = hub.get(inst, expiry);
  const snap = poller.last;
  if (!snap) {
    return reply.code(503).send({
      error: 'no snapshot yet',
      note: 'the chain has not delivered its first poll for this expiry — retry in a few seconds',
    });
  }
  return {
    mode: isReplay() ? 'replay' : 'live',
    instrument: inst.id, label: inst.label, expiry,
    sessionOpen: sessionState(inst.session.id).openNow,
    receivedAt: snap.receivedAt,
    spotSource: snap.spotSource,
    reading: readChain({ spot: snap.spot, rows: snap.rows }),
  };
});

/* ------------------------------------------------ paper trading (P32) */

/**
 * paper-trading-v1.md row 17. The body is the only user input, so each route accepts exactly the
 * fields it names and nothing else - an unknown field is a 400, not something quietly ignored.
 */
function bodyWith(b: unknown, keys: string[]): Record<string, unknown> | null {
  if (b === undefined || b === null) return keys.length === 0 ? {} : null;
  if (typeof b !== 'object' || Array.isArray(b)) return null;
  const got = Object.keys(b as object);
  if (got.length !== keys.length || !got.every(k => keys.includes(k))) return null;
  return b as Record<string, unknown>;
}

app.get('/api/paper', async () => paper.view());

app.post('/api/paper/arm', async (req, reply) => {
  const b = bodyWith(req.body, ['armed']);
  if (!b || typeof b.armed !== 'boolean') return reply.code(400).send({ error: 'body must be {"armed": true|false}' });
  await paper.setArmed(b.armed);
  return paper.view();
});

app.post('/api/paper/exit', async (req, reply) => {
  const b = bodyWith(req.body, ['id']);
  if (!b || typeof b.id !== 'string' || b.id.length > 64) return reply.code(400).send({ error: 'body must be {"id": "<position id>"}' });
  const p = await paper.exit(b.id);
  if (!p) return reply.code(404).send({ error: `no position ${b.id}` });
  return paper.view();
});

app.post('/api/paper/exit-all', async (req, reply) => {
  if (!bodyWith(req.body, [])) return reply.code(400).send({ error: 'this route takes no fields' });
  await paper.exitAll();
  return paper.view();
});

/** Row 11: replay only. Live trades only on the 09:20 timer - the strategy's own window. */
app.post('/api/paper/run', async (req, reply) => {
  if (!bodyWith(req.body, [])) return reply.code(400).send({ error: 'this route takes no fields' });
  if (!isReplay()) return reply.code(409).send({ error: 'Run now exists in replay only - live trades on the 09:20 timer' });
  const r = await paper.runNow();
  if (!r.ok) return reply.code(409).send({ error: r.error });
  return paper.view();
});

/* ----------------------------------------------------------------- SSE */

app.get('/api/stream', (req, reply) => {
  const q = req.query as Record<string, string>;
  const inst = findInstrument(q.key ?? '');
  if (!inst) return reply.code(404).send({ error: `unknown instrument ${q.key}` });

  const expiry = q.expiry || inst.nearestExpiry;
  if (!expiry) return reply.code(400).send({ error: `${inst.id} has no expiry` });
  // Validate at the boundary. Unvalidated, every distinct value creates a ChainPoller in
  // PollerHub that is never removed, plus a permanent PeakOiStore.onProgress listener - measured
  // at ~0.26 MB retained per request, linear, and still held after every connection closed
  // (144 -> 161 MB over 60 requests, -> 191 MB over 180). It is reachable with one query
  // parameter and no credentials. Live it would also send a junk `Expiry` straight to Dhan.
  if (!inst.expiries.includes(expiry)) {
    return reply.code(400).send({
      error: `unknown expiry ${expiry} for ${inst.id}`,
      expiries: inst.expiries,
    });
  }

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
  // After the registry: the paper trader's lookup reads the master that resolveRegistry loads.
  await paper.load();
  paper.start();

  const mode = isReplay() ? 'REPLAY (synthetic data)' : 'LIVE (Dhan API)';
  const lines = registry.instruments.map(i =>
    `  ${(i.resolved ? 'ok' : 'BLOCKED').padEnd(7)} ${i.id.padEnd(10)} ` +
    `scrip=${String(i.underlyingScrip ?? '?').padStart(7)} seg=${i.underlyingSeg.padEnd(8)} ` +
    `lot=${String(i.lot ?? '?').padStart(4)} expiry=${i.nearestExpiry ?? '?'} ` +
    `strikes~${i.optionContracts} ${i.session.openNow ? 'OPEN' : 'closed'}` +
    (i.problems.length ? `\n          ! ${i.problems.join('; ')}` : ''));

  await app.listen({ port: PORT, host: '127.0.0.1' });

  console.log(`\nDhan Option Chain Terminal - ${mode}`);
  console.log(`build ${BUILD}`);
  console.log(`master ${(registry.meta.bytes / 1e6).toFixed(1)} MB, ${registry.meta.rowsKept} tracked rows\n`);
  console.log(lines.join('\n'));
  if (!creds && !isReplay()) console.log('\n  ! no credentials in .env - every poll will report NO_CREDS');
  console.log(`\n  open  http://127.0.0.1:${PORT}\n`);
};

start().catch(err => { console.error(err); process.exit(1); });
