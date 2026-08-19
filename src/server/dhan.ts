/**
 * Timed HTTP client for the DhanHQ v2 REST API.
 *
 * Two jobs beyond "call the API":
 *  1. Stamp every stage of the call so the latency panel has real numbers, not a single total.
 *  2. Hold the 1-request-per-3-seconds option chain limit per (underlying, expiry) key.
 *
 * Native fetch resolves its promise when response HEADERS arrive and only fills the body
 * afterwards, which is exactly the ttfb / downloaded split we need. No extra dependency.
 */

const BASE_URL = 'https://api.dhan.co';

/** Locked in spec row 1: one unique option-chain request every 3 seconds per key. */
export const CADENCE_MS = 3000;

export type Credentials = { clientId: string; accessToken: string };

export type CallTiming = {
  /** Wall-clock ISO stamp of when the call was queued. Everything else is relative ms. */
  queuedAt: string;
  queued: number;
  dispatched: number;
  ttfb: number | null;
  downloaded: number | null;
  parsed: number | null;
  /** downloaded - dispatched. The headline number in the panel. */
  roundTrip: number | null;
  /** ttfb - dispatched */
  server: number | null;
  /** downloaded - ttfb */
  download: number | null;
  /** parsed - downloaded */
  compute: number | null;
  /** How long this call sat waiting for its rate-limit slot. */
  gateWait: number;
};

export type DhanError = {
  code: string;
  type: string;
  message: string;
  httpStatus: number | null;
  retryable: boolean;
};

export type DhanCall<T> = {
  ok: boolean;
  httpStatus: number | null;
  bytes: number;
  data: T | null;
  error: DhanError | null;
  timing: CallTiming;
};

export function readCredentials(): Credentials | null {
  const clientId = (process.env.DHAN_CLIENT_ID ?? '').trim();
  const accessToken = (process.env.DHAN_ACCESS_TOKEN ?? '').trim();
  if (!clientId || !accessToken) return null;
  return { clientId, accessToken };
}

/* ------------------------------------------------------------- rate gate */

const lastCompleted = new Map<string, number>();

/** Wait until this key's 3-second slot is free. Measured from completion, never from dispatch. */
async function waitForSlot(key: string, cadenceMs: number): Promise<number> {
  const prev = lastCompleted.get(key);
  if (prev === undefined) return 0;
  const wait = prev + cadenceMs - performance.now();
  if (wait <= 0) return 0;
  await new Promise(r => setTimeout(r, wait));
  return Math.round(wait);
}

/* --------------------------------------------------------------- errors */

function mapError(httpStatus: number | null, body: unknown, fallback: string): DhanError {
  const b = (body ?? {}) as Record<string, unknown>;
  const remarks = (b.remarks ?? {}) as Record<string, unknown>;

  // Dhan has a third error shape besides errorCode and remarks.error_code:
  //   { "data": { "808": "Authentication Failed - Client ID or Token invalid" }, "status": "failed" }
  // The numeric key IS the code, so it has to be read out of the object key, not a field.
  let numericCode: string | null = null;
  let numericMessage: string | null = null;
  const data = b.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const entry = Object.entries(data as Record<string, unknown>)
      .find(([k]) => /^\d{3}$/.test(k));
    if (entry) { numericCode = entry[0]; numericMessage = String(entry[1]); }
  }

  const code = String(b.errorCode ?? remarks.error_code ?? numericCode ?? (httpStatus === 429 ? 'DH-904' : 'HTTP'));
  const type = String(b.errorType ?? remarks.error_type ?? (numericCode ? 'Authentication' : 'Unknown'));
  const message = String(b.errorMessage ?? remarks.error_message ?? numericMessage ?? fallback);

  const RETRYABLE = new Set(['DH-904', 'DH-908', 'DH-909', 'HTTP', '805']);
  return {
    code,
    type,
    message,
    httpStatus,
    // DH-901 (bad auth) and DH-905 (bad input) will fail identically forever. Do not retry them.
    // 808/810 are credential problems: they will fail identically forever until .env changes.
    retryable: RETRYABLE.has(code) && !['DH-901', 'DH-905', '808', '810'].includes(code),
  };
}

/** Plain-language reading of a Dhan error code, for the UI's error ribbon. */
export function explain(code: string): string {
  switch (code) {
    case 'DH-901': return 'Access token invalid or expired. Generate a new one in Dhan Web and update .env.';
    case 'DH-902': return 'This token is not permitted for the requested data.';
    case 'DH-903': return 'Account-level problem on the Dhan side.';
    case 'DH-904': return 'Rate limited. The option chain allows one request every 3 seconds per key.';
    case 'DH-905': return 'Dhan rejected the request body, or this IP is not whitelisted.';
    case 'DH-906': return 'Dhan rejected the token. Generate a fresh access token in Dhan Web and update .env.';
    case 'DH-907': return 'Data API problem. A Data API subscription is required for the option chain.';
    case '808': return 'Dhan rejected the client id or access token. The token is invalid, revoked, or superseded by a newer one. Generate a fresh access token in Dhan Web, put it in .env, and restart.';
    case '810': return 'Client id is invalid. Check DHAN_CLIENT_ID in .env.';
    case '805': return 'Too many requests on the websocket feed. Backing off.';
    case 'NETWORK': return 'Could not reach api.dhan.co. Check the connection.';
    case 'TIMEOUT': return 'Dhan did not respond in time.';
    default: return 'Request to Dhan failed.';
  }
}

/* ----------------------------------------------------------------- call */

export async function dhanPost<T>(
  endpoint: string,
  body: unknown,
  opts: { creds: Credentials; key?: string; cadenceMs?: number; timeoutMs?: number },
): Promise<DhanCall<T>> {
  const key = opts.key ?? endpoint;
  const cadenceMs = opts.cadenceMs ?? CADENCE_MS;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  const queuedAt = new Date().toISOString();
  const queued = performance.now();
  const gateWait = await waitForSlot(key, cadenceMs);
  const dispatched = performance.now();

  const timing: CallTiming = {
    queuedAt, queued: 0, dispatched: round(dispatched - queued),
    ttfb: null, downloaded: null, parsed: null,
    roundTrip: null, server: null, download: null, compute: null,
    gateWait,
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(BASE_URL + endpoint, {
      method: 'POST',
      headers: {
        'access-token': opts.creds.accessToken,
        'client-id': opts.creds.clientId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });

    const tTtfb = performance.now();
    const text = await res.text();
    const tDownloaded = performance.now();

    let parsedBody: unknown = null;
    let parseFailed = false;
    try { parsedBody = text ? JSON.parse(text) : null; } catch { parseFailed = true; }
    const tParsed = performance.now();

    lastCompleted.set(key, tDownloaded);

    timing.ttfb = round(tTtfb - queued);
    timing.downloaded = round(tDownloaded - queued);
    timing.parsed = round(tParsed - queued);
    timing.server = round(tTtfb - dispatched);
    timing.download = round(tDownloaded - tTtfb);
    timing.compute = round(tParsed - tDownloaded);
    timing.roundTrip = round(tDownloaded - dispatched);

    const bytes = Buffer.byteLength(text);

    if (parseFailed) {
      return { ok: false, httpStatus: res.status, bytes, data: null, timing,
        error: mapError(res.status, null, `response was not JSON (${text.slice(0, 120)})`) };
    }
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, bytes, data: null, timing,
        error: mapError(res.status, parsedBody, `HTTP ${res.status}`) };
    }
    // Dhan can return HTTP 200 with status:"failure" in the body.
    const asObj = (parsedBody ?? {}) as Record<string, unknown>;
    if (asObj.status === 'failure' || asObj.errorCode) {
      return { ok: false, httpStatus: res.status, bytes, data: null, timing,
        error: mapError(res.status, parsedBody, 'Dhan returned status: failure') };
    }

    return { ok: true, httpStatus: res.status, bytes, data: parsedBody as T, error: null, timing };
  } catch (err) {
    lastCompleted.set(key, performance.now());
    const aborted = (err as Error)?.name === 'AbortError';
    return {
      ok: false, httpStatus: null, bytes: 0, data: null, timing,
      error: {
        code: aborted ? 'TIMEOUT' : 'NETWORK',
        type: 'Transport',
        message: aborted ? `no response within ${timeoutMs} ms` : String((err as Error)?.message ?? err),
        httpStatus: null,
        retryable: true,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function round(n: number): number { return Math.round(n * 10) / 10; }

/* ------------------------------------------------------- typed endpoints */

export type ExpiryListResponse = { data: string[]; status: string };

export function fetchExpiryList(creds: Credentials, underlyingScrip: number, underlyingSeg: string) {
  return dhanPost<ExpiryListResponse>('/v2/optionchain/expirylist',
    { UnderlyingScrip: underlyingScrip, UnderlyingSeg: underlyingSeg },
    { creds, key: `expirylist:${underlyingSeg}:${underlyingScrip}` });
}

export type OptionLeg = {
  average_price: number;
  greeks: { delta: number; theta: number; gamma: number; vega: number };
  implied_volatility: number;
  last_price: number;
  oi: number;
  previous_close_price: number;
  previous_oi: number;
  previous_volume: number;
  security_id?: number;
  top_ask_price: number;
  top_ask_quantity: number;
  top_bid_price: number;
  top_bid_quantity: number;
  volume: number;
};

export type OptionChainResponse = {
  data: { last_price: number; oc: Record<string, { ce?: OptionLeg; pe?: OptionLeg }> };
  status: string;
};

export function fetchOptionChain(creds: Credentials, underlyingScrip: number, underlyingSeg: string, expiry: string) {
  return dhanPost<OptionChainResponse>('/v2/optionchain',
    { UnderlyingScrip: underlyingScrip, UnderlyingSeg: underlyingSeg, Expiry: expiry },
    { creds, key: `chain:${underlyingSeg}:${underlyingScrip}:${expiry}` });
}
