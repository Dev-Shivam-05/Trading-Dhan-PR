/**
 * `npm run open:checks` — every measurement on this project that can only be taken while the NSE
 * session is on, in one run. Written 2026-09-22 because the board has carried these five as open
 * since P8 (2026-09-01) and each one needs 09:15–15:30 IST on a trading day.
 *
 * It measures the RUNNING local server (default 127.0.0.1:8787) and compares it against Dhan
 * directly, with a second implementation of every derived number. It changes nothing.
 *
 *   1. P12b / P8    — `/api/scan?source=dhan` driven live, its funnel recomputed from the payload
 *   2. P8 AC5       — the chain cadence while that scan runs (no repeat under 3000 ms)
 *   3. P12b         — the clock time `NSE_EQ` `net_change` first goes non-zero
 *   4. P21          — the header's previous close against Dhan, with the session ON
 *   5. P25          — whether NSE's option-chain `last_price` lags its own quote, as MCX's does
 *
 * The chart criteria (added 2026-09-23) have only ever been taken on an OPEN MCX session, which
 * is the one session usually on outside NSE hours. They are the same rules, on NSE:
 *
 *   6. P19          — the live underlying candles against the feed's own ticks: one interval
 *                     apart to the millisecond, and the forming candle CONTAINS every tick
 *   7. P9           — the opening-candle question, measured rather than argued: how many blues
 *                     the shipped cross-day `median20` fires in 09:15-09:35 against a
 *                     session-only `median20`. Reported as a decision, never scored as a pass
 *
 * Exit code 0 only if every criterion that could be measured passed. A criterion that could not
 * be measured is printed as SKIP and named in the summary — never scored as a pass.
 */

import { readFile } from 'node:fs/promises';
// The chart criteria's arithmetic lives in its own module so it can be driven against real
// captured payloads before the session opens — `node scripts/chart-checks-test.ts`, 25 checks,
// each of which is also shown to fail on bad input. On a shut market this script runs only its
// SKIP branch, and there is one session a day in which to discover a bug in the other one.
import { containment, openingCounts, spacingErrors, toMs } from './lib/chart-checks.ts';

const BASE = process.env.SERVER ?? 'http://127.0.0.1:8787';
const KEY = process.env.KEY ?? 'NIFTY';
/** How long to watch for `net_change` to leave zero (check 3). */
const NET_CHANGE_WATCH_MS = Number(process.env.NET_CHANGE_MS ?? 15 * 60_000);

type Verdict = 'PASS' | 'FAIL' | 'SKIP';
const results: { name: string; verdict: Verdict; detail: string }[] = [];
function say(name: string, verdict: Verdict, detail = '') {
  results.push({ name, verdict, detail });
  console.log(`${verdict.padEnd(4)}  ${name}${detail ? '  — ' + detail : ''}`);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const istNow = () => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });

async function creds() {
  const raw = await readFile('.env', 'utf8').catch(() => '');
  const env = Object.fromEntries(raw.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
  return { token: env.DHAN_ACCESS_TOKEN ?? '', client: env.DHAN_CLIENT_ID ?? '' };
}

async function dhan(path: string, body: unknown, c: { token: string; client: string }) {
  const res = await fetch('https://api.dhan.co/v2' + path, {
    method: 'POST',
    headers: { 'access-token': c.token, 'client-id': c.client, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) as any };
}

/** One SSE snapshot for a key, or null. */
async function snapshot(key: string, expiry: string, nth = 1): Promise<any> {
  const res = await fetch(`${BASE}/api/stream?key=${key}&expiry=${expiry}`);
  if (!res.body) return null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', seen = 0, out: any = null;
  const t0 = Date.now();
  while (!out && Date.now() - t0 < 45_000) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
    for (const p of parts) {
      if (!/event: snapshot/.test(p)) continue;
      const data = /data: (.*)/s.exec(p)?.[1];
      if (data && ++seen >= nth) { out = JSON.parse(data); break; }
    }
  }
  await reader.cancel().catch(() => {});
  return out;
}

/** Every snapshot a key emits inside `ms`. */
async function snapshots(key: string, expiry: string, ms: number): Promise<any[]> {
  const res = await fetch(`${BASE}/api/stream?key=${key}&expiry=${expiry}`);
  if (!res.body) return [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const out: any[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
    for (const p of parts) {
      if (!/event: snapshot/.test(p)) continue;
      const data = /data: (.*)/s.exec(p)?.[1];
      if (data) out.push(JSON.parse(data));
    }
  }
  await reader.cancel().catch(() => {});
  return out;
}

/**
 * Every UNDERLYING tick the stream carries inside `ms`. The stream batches at 10 Hz and tags the
 * underlying with `k: 'u'` (index.ts); `t` is the packet's own LTT, which contract §2.4 records as
 * IST wall-clock encoded as an epoch, so it is the tick's time and not the time it arrived here.
 */
async function underlyingTicks(key: string, expiry: string, ms: number): Promise<{ p: number; t: number }[]> {
  const res = await fetch(`${BASE}/api/stream?key=${key}&expiry=${expiry}`);
  if (!res.body) return [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const out: { p: number; t: number }[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
    for (const p of parts) {
      if (!/event: ticks/.test(p)) continue;
      const data = /data: (.*)/s.exec(p)?.[1];
      if (!data) continue;
      for (const b of (JSON.parse(data).batch ?? [])) {
        if (b.k === 'u' && Number.isFinite(b.p)) out.push({ p: b.p, t: toMs(b.t) });
      }
    }
  }
  await reader.cancel().catch(() => {});
  return out;
}

async function main() {
  const c = await creds();
  const health = await fetch(`${BASE}/api/health`).then(r => r.json()).catch(() => null) as any;
  if (!health) { console.log(`no server on ${BASE} — start it with \`npm run dev\``); return 2; }
  if (health.mode === 'replay') { console.log('the server is in REPLAY mode; these checks need live data'); return 2; }
  console.log(`server ${BASE} · build ${health.build}`);

  const insts = await fetch(`${BASE}/api/instruments`).then(r => r.json()) as any;
  const inst = insts.instruments.find((i: any) => i.id === KEY);
  const eq = insts.instruments.find((i: any) => i.underlyingSeg === 'NSE_EQ' && i.resolved);
  const open = !!inst?.session?.openNow;
  // Checks 1-3 are about the NSE cash session (the scanner's universe, NSE_EQ quotes), which is
  // NOT the same session as KEY's when KEY is an MCX chip. Reading KEY's session there would
  // score an NSE 409 as a failure at 22:00 with MCX open.
  const nseOpen = !!eq?.session?.openNow;
  console.log(`${KEY} session: ${inst?.session?.reason} · NSE cash: ${eq?.session?.reason ?? 'unknown'}`
    + ` · now ${istNow()} IST\n`);

  /* ---------------------------------------------------------------- 4 + 5 */
  // Both read one live snapshot, so they are taken first and together.
  // Check 7 needs the ATM strike off that same snapshot rather than a second subscribe.
  let atmStrike: number | null = null;
  if (!open) {
    say('P21: previous close against Dhan with the session ON', 'SKIP', 'the session is shut');
    say('P25: the option-chain last_price against its own quote', 'SKIP', 'the session is shut');
  } else {
    // The quote goes FIRST: once a poller is running it holds the 1 req/s marketfeed slot and a
    // second caller gets 805 (CLAUDE.md). Then several snapshots are collected and the check
    // looks for the one taken at the same instant as the quote, rather than comparing two reads
    // of a moving tape and calling the difference a bug.
    const q = await dhan('/marketfeed/quote', { [inst.underlyingSeg]: [inst.underlyingScrip] }, c);
    const row = (q.body?.data ?? q.body)?.[inst.underlyingSeg]?.[String(inst.underlyingScrip)];
    const snaps = await snapshots(KEY, inst.nearestExpiry, 12_000);
    const s = snaps.find(v => row && Math.abs(v.spot - row.last_price) < 0.005) ?? snaps[snaps.length - 1];
    const sameInstant = !!row && !!s && Math.abs(s.spot - row.last_price) < 0.005;
    if (!row || !s) {
      say('P21: previous close against Dhan with the session ON', 'SKIP', 'no quote or no snapshot');
      say('P25: the option-chain last_price against its own quote', 'SKIP', 'no quote or no snapshot');
    } else {
      atmStrike = s.atmStrike ?? null;
      // P21: with the session ON, Dhan's ohlc.close IS the previous close. After the close it is
      // that day's own close, which is the whole reason the header reads daily candles instead.
      say('P21: the previous close equals Dhan ohlc.close while the session is on',
        Math.abs(s.spotPrevClose - row.ohlc.close) < 0.005 ? 'PASS' : 'FAIL',
        `${s.spotPrevClose} vs ${row.ohlc?.close}`);
      say('P21: the change is exactly spot minus that previous close',
        Math.abs(s.spotChange - (s.spot - s.spotPrevClose)) < 0.005 ? 'PASS' : 'FAIL',
        `${s.spot} - ${s.spotPrevClose} = ${s.spotChange?.toFixed(2)}`);
      if (sameInstant) {
        say('P21: the change equals Dhan own net_change at the same instant',
          Math.abs(s.spotChange - row.net_change) < 0.005 ? 'PASS' : 'FAIL',
          `${s.spotChange?.toFixed(2)} vs ${row.net_change}`);
      } else {
        say('P21: the change equals Dhan own net_change at the same instant', 'SKIP',
          `the tape moved between the two reads (quote ${row.last_price}, snapshots `
          + `${[...new Set(snaps.map(v => v.spot))].join('/')}) — re-run`);
      }
      // P25: MCX's chain last_price is hours stale (CLAUDE.md). NSE's is expected NOT to be, and
      // that is the open question this run exists to answer. The expectation is per segment.
      const lag = s.spotChainLast === null ? null : Math.abs(row.last_price - s.spotChainLast);
      const mcx = inst.underlyingSeg === 'MCX_COMM';
      const detail = `chain ${s.spotChainLast} vs quote ${row.last_price}`
        + `${lag === null ? '' : ` — Δ ${lag.toFixed(2)}`}`;
      if (mcx) {
        say('P25: MCX option-chain last_price lags its own quote, as recorded',
          lag !== null && lag > 1 ? 'PASS' : 'FAIL', detail + ' (a lag is the expected finding here)');
      } else {
        say('P25: NSE option-chain last_price agrees with its own quote',
          lag !== null && lag < 1 ? 'PASS' : 'FAIL', detail);
      }
      console.log(`      spot on screen ${s.spot} (source ${s.spotSource})
`);
    }
  }

  /* ---------------------------------------------------------------- 1 + 2 */
  if (!nseOpen) {
    say('P8 live: /api/scan?source=dhan returns a funnel', 'SKIP', 'the session is shut (it answers 409)');
    say('P8 AC5: the chain cadence holds while a scan runs', 'SKIP', 'needs the scan, which needs the session');
  } else {
    // AC5 is about the chain poll's spacing UNDER LOAD, so a subscriber has to be on the chain
    // while the scan runs. The telemetry ring is the server's own record of every call.
    const before = await fetch(`${BASE}/api/telemetry`).then(r => r.json()).catch(() => null) as any;
    const t0 = Date.now();
    const sub = fetch(`${BASE}/api/stream?key=${KEY}&expiry=${inst.nearestExpiry}`);
    const scan = await fetch(`${BASE}/api/scan?source=dhan`).then(async r => ({ status: r.status, body: await r.json() }))
      .catch(e => ({ status: 0, body: { error: String(e) } })) as any;
    const took = Date.now() - t0;
    await sleep(4000);
    const after = await fetch(`${BASE}/api/telemetry`).then(r => r.json()).catch(() => null) as any;
    void sub.then(r => r.body?.cancel().catch(() => {})).catch(() => {});

    if (scan.status !== 200) {
      say('P8 live: /api/scan?source=dhan returns a funnel', 'FAIL', `HTTP ${scan.status} ${JSON.stringify(scan.body).slice(0, 160)}`);
    } else {
      const r = scan.body;
      const f = r.funnel ?? r.result?.funnel ?? null;
      console.log(`      scan took ${(took / 1000).toFixed(1)} s · funnel ${JSON.stringify(f)}`);
      // 24 Sep's run failed with "0 ranked" in 0.2 s and never said why; the scanner's own
      // `error` field carries the reason (e.g. the quote call's Dhan code), so print it.
      const err = r.error ?? r.result?.error ?? null;
      if (err) console.log(`      scan error: ${err}`);
      // Recompute the funnel from the scan's own per-stock trace, independently of its counters.
      const trace: any[] = r.trace ?? r.result?.trace ?? [];
      const ranked = trace.length;
      const pctOk = trace.filter(t => Math.abs(t.chgPct ?? t.ltpChangePct ?? 0) >= 2).length;
      const both = trace.filter(t => Math.abs(t.chgPct ?? t.ltpChangePct ?? 0) >= 2
        && Math.abs(t.oiChangePct ?? t.oiChgPct ?? 0) >= 7).length;
      const picks = (r.long?.length ?? 0) + (r.short?.length ?? 0);
      say('P8 live: the funnel recomputed from the scan\'s own trace matches its counters',
        ranked > 0 && both === picks ? 'PASS' : 'FAIL',
        `trace ${ranked} ranked, ${pctOk} past |chg|>=2%, ${both} past both — picks ${picks}`);
    }

    // AC5 — every consecutive pair of chain calls for this key, during the scan window
    const rows: any[] = (after?.samples ?? after?.recent ?? []).filter((s: any) =>
      s.instrument === KEY && new Date(s.at).getTime() >= t0);
    const times = rows.map((s: any) => new Date(s.at).getTime()).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) gaps.push(times[i]! - times[i - 1]!);
    if (gaps.length < 2) {
      say('P8 AC5: the chain cadence holds while a scan runs', 'SKIP',
        `only ${gaps.length} chain call(s) landed in the scan window (${before ? 'ring read ok' : 'no ring'})`);
    } else {
      const min = Math.min(...gaps);
      say('P8 AC5: no two chain calls closer than 3000 ms while the scan runs',
        min >= 3000 ? 'PASS' : 'FAIL',
        `${gaps.length} gaps, min ${min} ms, max ${Math.max(...gaps)} ms`);
    }
  }

  /* -------------------------------------------------------------------- 3 */
  if (!nseOpen || !eq) {
    say('P12b: the clock time NSE_EQ net_change first goes non-zero', 'SKIP',
      nseOpen ? 'no resolved NSE_EQ instrument' : 'the NSE cash session is shut');
  } else {
    const t0 = Date.now();
    let when: string | null = null, last = 0;
    while (Date.now() - t0 < NET_CHANGE_WATCH_MS && when === null) {
      const q = await dhan('/marketfeed/quote', { NSE_EQ: [eq.underlyingScrip] }, c);
      const row = (q.body?.data ?? q.body)?.NSE_EQ?.[String(eq.underlyingScrip)];
      last = row?.net_change ?? 0;
      if (typeof last === 'number' && last !== 0) when = istNow();
      else await sleep(10_000);
    }
    say(`P12b: ${eq.id} NSE_EQ net_change goes non-zero`,
      when ? 'PASS' : 'SKIP',
      when ? `first non-zero at ${when} IST (${last})`
           : `still 0 after ${Math.round(NET_CHANGE_WATCH_MS / 60000)} min — re-run later in the session`);
  }

  /* -------------------------------------------------------------------- 6 */
  // P19 on an NSE session. The same three facts were taken on MCX on 2026-09-22 (395 ticks in
  // 60 s, 12 of 12 closes, each candle 60,000 ms after the last) and never on NSE.
  //
  // Both reads are of a MOVING tape, so the only thing asserted across them is an INVARIANT -
  // a candle's high/low must contain every tick that fell inside its own minute. A pixel- or
  // price-level equality between two reads taken seconds apart is the measurement bug this
  // project keeps producing, not a product fact.
  if (!open) {
    say('P19: the live candles are one interval apart on NSE', 'SKIP', `the ${KEY} session is shut`);
    say('P19: the forming candle contains every tick in its minute', 'SKIP', `the ${KEY} session is shut`);
  } else {
    const uc = await fetch(`${BASE}/api/ucandles?key=${KEY}&interval=1`).then(r => r.json()).catch(() => null) as any;
    const all: any[] = uc?.candles ?? [];
    const day = all.length ? all[all.length - 1].d : null;
    const today = all.filter(x => x.d === day);
    if (today.length < 3) {
      say('P19: the live candles are one interval apart on NSE', 'SKIP',
        `only ${today.length} candle(s) in ${day ?? 'no session'} yet`);
    } else {
      const bad = spacingErrors(today, 60_000);
      say('P19: every 1-minute candle opens exactly 60,000 ms after the last',
        bad.length === 0 ? 'PASS' : 'FAIL',
        `${today.length} candles on ${day}${bad.length ? ` — ${bad.slice(0, 3).join(', ')}` : ''}`);
    }

    const ticks = await underlyingTicks(KEY, inst.nearestExpiry, 60_000);
    const after = await fetch(`${BASE}/api/ucandles?key=${KEY}&interval=1`).then(r => r.json()).catch(() => null) as any;
    const rows: any[] = (after?.candles ?? []).filter((x: any) => x.d === day);
    if (!ticks.length || !rows.length) {
      say('P19: the forming candle contains every tick in its minute', 'SKIP',
        `${ticks.length} underlying ticks in 60 s, ${rows.length} candles — nothing to compare`);
    } else {
      const r = containment(rows, ticks, 60_000);
      say('P19: every judged candle contains every tick that fell inside its minute',
        r.judged > 0 && r.misses.length === 0 ? 'PASS' : r.judged === 0 ? 'SKIP' : 'FAIL',
        r.judged === 0
          ? `${ticks.length} ticks but no candle's whole minute fell inside the 60 s window — re-run`
          : `${r.contained}/${r.judged} candles contain their ticks${r.misses.length ? ` — ${r.misses[0]}` : ''}`
          + ` · ${ticks.length} ticks · close equals the last tick in ${r.closeAgrees}/${r.judged}`);
    }
  }

  /* -------------------------------------------------------------------- 7 */
  // P9's opening-candle question, carried on the board since 2026-09-19 as a DECISION, with no
  // number attached to it. This does not decide it and never scores a pass: it prints the two
  // counts the user needs to answer it in one word.
  const afterOpening = () => {
    const hhmm = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    return hhmm >= '09:36:00';
  };
  if (!open || !atmStrike) {
    say('P9: median20 across the session boundary — the user\'s decision', 'SKIP',
      !open ? `the ${KEY} session is shut` : 'no ATM strike on the snapshot');
  } else if (!afterOpening()) {
    say('P9: median20 across the session boundary — the user\'s decision', 'SKIP',
      `it is ${istNow()} IST — the 09:15-09:35 window is not over yet`);
  } else {
    const lines: string[] = [];
    let fired1 = 0, fired2 = 0, all1 = 0;
    for (const side of ['ce', 'pe'] as const) {
      const r = await fetch(`${BASE}/api/candles?key=${KEY}&expiry=${inst.nearestExpiry}`
        + `&strike=${atmStrike}&side=${side}&interval=1`).then(x => x.json()).catch(() => null) as any;
      const cs: any[] = r?.candles ?? [];
      if (!cs.length) { lines.push(`  ${atmStrike} ${side.toUpperCase()}: no candles (${r?.note ?? r?.error ?? '—'})`); continue; }
      const k = openingCounts(cs, 20);
      fired1 += k.shipped; fired2 += k.sessionOnly; all1 += k.whole;
      lines.push(`  ${atmStrike} ${side.toUpperCase()}: ${k.shipped} fired in 09:15-09:34 of ${k.whole} all day`
        + ` · median20 at 09:15 = ${k.firstMedian} (yesterday's tail, ${r.context} context candles)`
        + ` vs ${k.ownMedian} for today's own first 20`);
    }
    console.log(`\n      P9 — what the cross-day median20 costs, measured on ${istNow()} IST:`);
    for (const l of lines) console.log(`    ${l}`);
    console.log(`      shipped rule: ${fired1} of ${all1} of the day's signals land in the first 20 min.`
      + `\n      session-only rule: ${fired2} (the test is unavailable before 20 in-session candles).`
      + `\n      This is the user's call — neither is scored.\n`);
    say('P9: median20 across the session boundary — the user\'s decision', 'SKIP',
      `measured: ${fired1} of ${all1} signals fire in 09:15-09:34 under the shipped rule, `
      + `${fired2} under a session-only rule`);
  }

  const pass = results.filter(r => r.verdict === 'PASS').length;
  const fail = results.filter(r => r.verdict === 'FAIL').length;
  const skip = results.filter(r => r.verdict === 'SKIP').length;
  console.log(`\n${pass} pass · ${fail} fail · ${skip} not measurable`);
  for (const r of results.filter(r => r.verdict === 'SKIP')) console.log(`  still open: ${r.name} (${r.detail})`);
  return fail === 0 ? 0 : 1;
}

// Never process.exit() straight after a fetch on this machine (CLAUDE.md): it crashes in
// winsync.c and the exit code lies. Set process.exitCode and let the loop drain.
main().then(code => { process.exitCode = code; }).catch(err => {
  console.error(String(err));
  process.exitCode = 2;
});
