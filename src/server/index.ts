/**
 * P0 backend skeleton.
 *
 * Boots Fastify, resolves the six-instrument registry from the Dhan instrument master,
 * and exposes /api/health so the resolution can be inspected before any polling exists.
 * No Dhan API call is made here — /api/health works with or without credentials.
 */

import Fastify from 'fastify';
import { resolveRegistry, type Registry } from './instruments.ts';
import { readCredentials } from './dhan.ts';

const PORT = Number(process.env.PORT ?? 8787);

const app = Fastify({ logger: { level: 'info' } });

let registry: Registry | null = null;

async function getRegistry(force = false): Promise<Registry> {
  if (!registry || force) registry = await resolveRegistry({ force });
  return registry;
}

app.get('/api/health', async (req) => {
  const force = (req.query as Record<string, string>)?.refresh === '1';
  const started = performance.now();
  const reg = await getRegistry(force);
  const creds = readCredentials();

  return {
    status: reg.allResolved && creds ? 'ok' : 'degraded',
    node: process.version,
    resolveMs: Math.round(performance.now() - started),
    credentials: {
      clientId: Boolean(creds?.clientId),
      accessToken: Boolean(creds?.accessToken),
      hint: creds ? undefined : 'copy .env.example to .env and fill both values',
    },
    master: reg.meta,
    allResolved: reg.allResolved,
    instruments: reg.instruments,
  };
});

const start = async () => {
  // Resolve once at boot so a broken master fails loudly here, not on the first request.
  const reg = await getRegistry();
  for (const i of reg.instruments) {
    const state = i.resolved ? 'ok' : 'BLOCKED';
    app.log.info(
      `${state.padEnd(7)} ${i.id.padEnd(10)} scrip=${String(i.underlyingScrip ?? '?').padStart(7)} ` +
      `seg=${i.underlyingSeg.padEnd(8)} lot=${String(i.lot ?? '?').padStart(4)} ` +
      `expiry=${i.nearestExpiry ?? '?'} contracts=${i.optionContracts} session=${i.session.reason}`,
    );
    for (const p of i.problems) app.log.warn(`        ${i.id}: ${p}`);
  }
  if (!readCredentials()) {
    app.log.warn('DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN not set - live calls will not work yet');
  }

  await app.listen({ port: PORT, host: '127.0.0.1' });
  app.log.info(`health: http://127.0.0.1:${PORT}/api/health`);
};

start().catch(err => {
  app.log.error(err);
  process.exit(1);
});
