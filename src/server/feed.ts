/**
 * Dhan Live Market Feed - WebSocket client, binary parser and tick fan-out.
 *
 * This is the tick-by-tick half of the app. The option chain REST endpoint is capped at one
 * request per 3 s and is the ONLY source of IV and greeks; the feed carries no IV and no greeks
 * at all. So the two run side by side:
 *
 *     feed  (tick by tick)  ->  LTP, volume, OI, OHLC
 *     REST  (every 3 s)     ->  IV, delta, gamma, theta, vega
 *
 * The UI labels which is which. Nothing is blended into a single misleading "live".
 *
 * Byte offsets below come from the DhanHQ v2 docs. They are asserted against the packet's own
 * length before any read, because a silently misaligned parser would invent prices.
 */

import { EventEmitter } from 'node:events';
import { isReplay } from './replay.ts';
import type { Credentials } from './dhan.ts';

const FEED_URL = 'wss://api-feed.dhan.co';

/** Annexure: feed request codes. */
const REQ = { SUB_TICKER: 15, SUB_QUOTE: 17, SUB_FULL: 21, DISCONNECT: 12 } as const;

/** Annexure: numeric exchange segment in the binary header, keyed by the string used in JSON. */
const SEGMENT_CODE: Record<string, number> = {
  IDX_I: 0, NSE_EQ: 1, NSE_FNO: 2, NSE_CURRENCY: 3, BSE_EQ: 4, MCX_COMM: 5, BSE_CURRENCY: 7, BSE_FNO: 8,
};
const SEGMENT_NAME: Record<number, string> =
  Object.fromEntries(Object.entries(SEGMENT_CODE).map(([k, v]) => [v, k]));

/** Feed response codes and their exact packet sizes, header included. */
const PACKET = {
  TICKER: { code: 2, size: 16 },
  QUOTE: { code: 4, size: 50 },
  OI: { code: 5, size: 12 },
  PREV_CLOSE: { code: 6, size: 16 },
  FULL: { code: 8, size: 162 },
  DISCONNECT: { code: 50, size: 10 },
} as const;

const SIZE_BY_CODE = new Map<number, number>(Object.values(PACKET).map(p => [p.code, p.size]));

export type Tick = {
  seg: string;
  securityId: number;
  at: number;
  ltp: number | null;
  ltt: number | null;
  volume: number | null;
  oi: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
};

export type FeedState =
  | { state: 'off' }
  | { state: 'connecting' }
  | { state: 'live'; since: number; instruments: number }
  | { state: 'error'; code: string; message: string; retryInMs: number | null };

export type Subscription = {
  seg: string;
  securityId: number;
  mode: 'ticker' | 'quote' | 'full';
  /** Replay only: where this instrument's price should sit. Ignored on the live feed. */
  base?: number;
  /** Replay only: this contract's open interest, seeded from the snapshot. */
  oiBase?: number;
};

const MAX_PER_MESSAGE = 100;      // Dhan: at most 100 instruments per subscribe message
const MAX_PER_CONNECTION = 5000;  // Dhan: at most 5000 instruments per socket
const BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000];
/**
 * Dhan accepts the socket and then closes it immediately when the Data API plan is inactive, so
 * "the socket opened" is NOT evidence of success. After this many opens that carried no data at
 * all, stop the fast cycle and fall back to a slow poll - otherwise the app reconnects once a
 * second, forever, against the broker.
 */
const MAX_EMPTY_ATTEMPTS = 6;
const GIVE_UP_RETRY_MS = 300_000;

/* --------------------------------------------------------------- parsing */

function parsePackets(buf: Buffer, onTick: (t: Tick) => void, onDisconnect: (reason: number) => void): number {
  let offset = 0;
  let parsed = 0;

  while (offset + 8 <= buf.length) {
    const code = buf.readUInt8(offset);
    const size = SIZE_BY_CODE.get(code);

    if (size === undefined) {
      // Unknown code: trust the header's own length field rather than guessing forward.
      const declared = buf.readInt16LE(offset + 1);
      if (declared <= 0 || offset + declared > buf.length) return parsed;
      offset += declared;
      continue;
    }
    if (offset + size > buf.length) return parsed;   // partial packet, wait for more bytes

    const seg = SEGMENT_NAME[buf.readUInt8(offset + 3)] ?? String(buf.readUInt8(offset + 3));
    const securityId = buf.readInt32LE(offset + 4);
    const p = offset;

    if (code === PACKET.DISCONNECT.code) {
      onDisconnect(buf.readInt16LE(p + 8));
      offset += size;
      continue;
    }

    const tick: Tick = {
      seg, securityId, at: Date.now(),
      ltp: null, ltt: null, volume: null, oi: null, open: null, high: null, low: null, close: null,
    };

    if (code === PACKET.TICKER.code) {
      tick.ltp = buf.readFloatLE(p + 8);
      tick.ltt = buf.readInt32LE(p + 12);
    } else if (code === PACKET.QUOTE.code) {
      tick.ltp = buf.readFloatLE(p + 8);
      tick.ltt = buf.readInt32LE(p + 14);
      tick.volume = buf.readInt32LE(p + 22);
      tick.open = buf.readFloatLE(p + 34);
      tick.close = buf.readFloatLE(p + 38);
      tick.high = buf.readFloatLE(p + 42);
      tick.low = buf.readFloatLE(p + 46);
    } else if (code === PACKET.OI.code) {
      tick.oi = buf.readInt32LE(p + 8);
    } else if (code === PACKET.PREV_CLOSE.code) {
      tick.close = buf.readFloatLE(p + 8);
    } else if (code === PACKET.FULL.code) {
      tick.ltp = buf.readFloatLE(p + 8);
      tick.ltt = buf.readInt32LE(p + 14);
      tick.volume = buf.readInt32LE(p + 22);
      tick.oi = buf.readInt32LE(p + 34);
      tick.open = buf.readFloatLE(p + 46);
      tick.close = buf.readFloatLE(p + 50);
      tick.high = buf.readFloatLE(p + 54);
      tick.low = buf.readFloatLE(p + 58);
    }

    // A float32 that decodes to nonsense means the offsets drifted. Drop it rather than show it.
    if (tick.ltp !== null && (!Number.isFinite(tick.ltp) || tick.ltp < 0 || tick.ltp > 1e9)) {
      offset += size;
      continue;
    }

    onTick(tick);
    parsed++;
    offset += size;
  }
  return parsed;
}

/** Exposed so scripts/feed-probe.ts can check the parser against real bytes. */
export const _internals = { parsePackets, PACKET, SEGMENT_CODE, REQ };

/* ------------------------------------------------------------------ client */

export class FeedClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly creds: Credentials | null;
  private readonly subs = new Map<string, Subscription>();
  private failures = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private replayTimer: NodeJS.Timeout | null = null;
  private wanted = false;
  private packetsThisConnection = 0;

  status: FeedState = { state: 'off' };
  packetsSeen = 0;
  ticksEmitted = 0;

  constructor(creds: Credentials | null) {
    super();
    this.creds = creds;
    this.setMaxListeners(50);
  }

  private setStatus(s: FeedState) { this.status = s; this.emit('status', s); }

  private key(s: Subscription) { return `${s.seg}:${s.securityId}`; }

  /** Replace the whole subscription set. Called when the user switches instrument or expiry. */
  setSubscriptions(next: Subscription[]) {
    const before = new Set(this.subs.keys());
    this.subs.clear();
    for (const s of next.slice(0, MAX_PER_CONNECTION)) this.subs.set(this.key(s), s);
    const dropped = [...before].filter(k => !this.subs.has(k));

    if (isReplay()) { this.startReplay(); return; }
    if (!this.creds) { this.setStatus({ state: 'error', code: 'NO_CREDS', message: 'no credentials', retryInMs: null }); return; }

    this.wanted = true;

    /*
     * `this.subs.clear()` only clears OUR map. Dhan's side keeps every instrument ever
     * subscribed on this socket, and REQ has no unsubscribe code - the request codes for one are
     * not in docs/spec/dhan-api-contract.md, and inventing them is exactly the kind of guess this
     * project does not make. So when the wanted set SHRINKS, drop the socket instead: a fresh
     * connection starts empty and is re-populated from `this.subs` on open.
     *
     * Without this, every chip or expiry switch adds ~83 instruments to Dhan's tally and removes
     * none. At 83 per switch the documented 5,000-per-connection cap is reached after 61
     * switches, and the failure is silent and backwards: the OLD contracts keep streaming while
     * the NEW ones are refused, so the grid the user is looking at goes quiet while /api/feed
     * still reports a healthy live socket.
     */
    if (dropped.length && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.close(); } catch { /* already gone */ }
      this.ws = null;
      this.connect();
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.sendSubscriptions();
    else this.connect();
  }

  stop() {
    this.wanted = false;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.replayTimer) { clearInterval(this.replayTimer); this.replayTimer = null; }
    try { this.ws?.close(); } catch { /* already gone */ }
    this.ws = null;
    this.setStatus({ state: 'off' });
  }

  /* ---------------------------------------------------------- live socket */

  private connect() {
    if (!this.creds || !this.wanted) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;

    this.setStatus({ state: 'connecting' });
    const url = `${FEED_URL}?version=2&token=${encodeURIComponent(this.creds.accessToken)}` +
      `&clientId=${encodeURIComponent(this.creds.clientId)}&authType=2`;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      // Deliberately does NOT reset `failures`: an open socket that never delivers a packet is
      // exactly the no-data-plan case, and resetting here would pin the backoff at 1 s forever.
      this.packetsThisConnection = 0;
      this.sendSubscriptions();
    };

    ws.onmessage = (ev: MessageEvent) => {
      const buf = Buffer.from(ev.data as ArrayBuffer);
      this.packetsSeen++;
      // Real data arrived, so this connection is genuinely healthy - now the backoff may reset.
      if (this.packetsThisConnection++ === 0) this.failures = 0;
      parsePackets(buf,
        t => { this.ticksEmitted++; this.emit('tick', t); },
        reason => this.emit('feed-disconnect', reason));
    };

    ws.onerror = () => { /* onclose always follows and carries the retry logic */ };

    ws.onclose = (ev: CloseEvent) => {
      this.ws = null;
      if (!this.wanted) return;
      this.failures++;
      const givenUp = this.failures >= MAX_EMPTY_ATTEMPTS;
      const wait = givenUp
        ? GIVE_UP_RETRY_MS
        : BACKOFF_MS[Math.min(this.failures - 1, BACKOFF_MS.length - 1)]!;

      this.setStatus({
        state: 'error',
        code: `WS_${ev.code}`,
        // 1006 with no reason is what Dhan sends when the Data API plan is not active.
        message: ev.reason || (ev.code === 1006
          ? givenUp
            ? `the feed accepted and dropped ${this.failures} sockets with no data - the Data API plan is almost certainly not active. Retrying every 5 min.`
            : 'socket closed without a reason - usually the Data API plan is not active'
          : 'socket closed'),
        retryInMs: wait,
      });
      this.retryTimer = setTimeout(() => this.connect(), wait);
    };
  }

  private sendSubscriptions() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Indices only need a price for the chart; option contracts need volume and OI too.
    const byMode = { ticker: [] as Subscription[], quote: [] as Subscription[], full: [] as Subscription[] };
    for (const s of this.subs.values()) byMode[s.mode].push(s);

    const send = (list: Subscription[], requestCode: number) => {
      for (let i = 0; i < list.length; i += MAX_PER_MESSAGE) {
        const batch = list.slice(i, i + MAX_PER_MESSAGE);
        ws.send(JSON.stringify({
          RequestCode: requestCode,
          InstrumentCount: batch.length,
          InstrumentList: batch.map(b => ({ ExchangeSegment: b.seg, SecurityId: String(b.securityId) })),
        }));
      }
    };
    send(byMode.ticker, REQ.SUB_TICKER);
    send(byMode.quote, REQ.SUB_QUOTE);
    send(byMode.full, REQ.SUB_FULL);

    if (this.status.state !== 'live' || this.status.instruments !== this.subs.size) {
      this.setStatus({ state: 'live', since: Date.now(), instruments: this.subs.size });
    }
  }

  /* -------------------------------------------------------------- replay */

  /**
   * Synthetic ticks so the chart and the grid's tick path can be built and verified without a
   * Data API subscription. Same event shape as the real feed, so nothing downstream knows.
   */
  private startReplay() {
    if (this.replayTimer) clearInterval(this.replayTimer);
    const last = new Map<string, number>();
    /**
     * OI used to be a fresh uniform random number on every tick, so a contract's open interest
     * teleported between 1 L and 41 L ten times a second and had nothing to do with the OI the
     * chain reported for that same strike. Seeded from the snapshot and walked slowly instead -
     * open interest is a position count, it does not jump 30x between prints.
     */
    const lastOi = new Map<string, number>();
    this.setStatus({ state: 'live', since: Date.now(), instruments: this.subs.size });

    this.replayTimer = setInterval(() => {
      const all = [...this.subs.values()];
      if (!all.length) return;
      // The underlying is the busiest instrument on a real feed and the chart depends on it,
      // so it prints on every slice; the contracts print in a random burst around it.
      const underlyings = all.filter(s => s.mode !== 'full');
      const contracts = all.filter(s => s.mode === 'full');
      const picks = [
        ...underlyings,
        ...Array.from({ length: Math.min(6, contracts.length) },
          () => contracts[Math.floor(Math.random() * contracts.length)]!),
      ];
      for (const s of picks) {
        const k = this.key(s);
        const base = last.get(k) ?? s.base ?? (s.mode === 'full' ? 120 : 24000);
        const drift = base * (Math.random() - 0.5) * (s.mode === 'full' ? 0.01 : 0.0008);
        const ltp = Math.max(0.05, Math.round((base + drift) * 100) / 100);
        last.set(k, ltp);

        let oi: number | null = null;
        if (s.mode === 'full') {
          const prev = lastOi.get(k) ?? s.oiBase ?? 1e5;
          oi = Math.max(1, Math.round(prev * (1 + (Math.random() - 0.48) * 0.002)));
          lastOi.set(k, oi);
        }

        this.ticksEmitted++;
        this.emit('tick', {
          seg: s.seg, securityId: s.securityId, at: Date.now(),
          ltp, ltt: Math.floor(Date.now() / 1000),
          volume: s.mode === 'ticker' ? null : Math.floor(1e6 + Math.random() * 9e6),
          oi,
          open: null, high: null, low: null, close: null,
        } satisfies Tick);
      }
    }, 120);
  }
}

/* ------------------------------------------------------- chart tick history */

/** Ring buffer of underlying ticks, so a page that just loaded has a chart with a shape. */
export class TickHistory {
  private readonly buf = new Map<string, { t: number; p: number }[]>();
  private readonly cap: number;

  constructor(cap = 4000) { this.cap = cap; }

  push(key: string, at: number, price: number) {
    let arr = this.buf.get(key);
    if (!arr) { arr = []; this.buf.set(key, arr); }
    arr.push({ t: at, p: price });
    if (arr.length > this.cap) arr.shift();
  }

  get(key: string, sinceMs?: number): { t: number; p: number }[] {
    const arr = this.buf.get(key) ?? [];
    if (!sinceMs) return arr;
    const cutoff = Date.now() - sinceMs;
    return arr.filter(x => x.t >= cutoff);
  }

  clear(key: string) { this.buf.delete(key); }
}
