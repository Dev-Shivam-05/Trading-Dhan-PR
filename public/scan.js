/* P8 + P14 — the 9:20 F&O scanner panel.

   Specs: docs/spec/scanner-v1.md (source Dhan) and docs/spec/scanner-nse-v1.md (source NSE, the
   default). Manual only — P8 row 9, P14 row 8: this file has no timer, and nothing else in the
   app calls /api/scan. The panel is an overlay (P8 row 12) rather than a route, because a route
   change would tear down the chain poll and the tick feed.

   The number formatters are imported from app.js rather than redefined, so one screen never ends
   up printing 12.4 L in the grid and 1,240,000 in the scanner. */

import { abbr, inr } from '/app.js';

const $ = (id) => document.getElementById(id);

const SOURCES = ['nse', 'dhan'];
const TOP_N = [20, 25, 30];
const PREF_KEY = 'scan:v1';

const state = {
  open: false,
  running: false,
  result: null,
  /** Progress poll while a scan is in flight. */
  poll: null,
  enabled: false,
  reason: '',
  source: 'nse',
  n: 20,
};

/* A per-viewer convenience only (which source, which N). Storage can be blocked or empty. */
try {
  const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null');
  if (saved && SOURCES.includes(saved.source)) state.source = saved.source;
  if (saved && TOP_N.includes(saved.n)) state.n = saved.n;
} catch { /* defaults stand */ }

function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ source: state.source, n: state.n })); } catch { /* ignore */ }
}

/* --------------------------------------------------------------- formatting */

function pct(v, d = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(d) + '%';
}

function dirClass(v) {
  if (!Number.isFinite(v) || v === 0) return 'flat';
  return v > 0 ? 'up' : 'down';
}

function secs(ms) {
  return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + 's';
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* -------------------------------------------------------------- open/close */

function open() {
  if (state.open) return;
  state.open = true;
  $('scan').hidden = false;
  $('scanClose').focus();
}

function close() {
  if (!state.open) return;
  state.open = false;
  $('scan').hidden = true;
  $('scanBtn').focus();
}

/* ----------------------------------------------------------------- render */

/**
 * P8 row 13. The funnel is printed on every outcome, not just the empty one — a legitimate zero
 * has to read as a zero rather than as a broken scan, and it can only do that if the reader can
 * see where the stocks went.
 */
function renderFunnel(r) {
  const el = $('scanFunnel');
  el.hidden = false;
  const nse = r.source === 'nse';
  const steps = nse
    ? [
        ['F&O list', r.funnel.list],
        [`top ${r.n} + ${r.n}`, r.funnel.ranked],
        ['|chg| ≥ 2%', r.funnel.chg],
        ['OI chg ≥ 7%', r.funnel.oi],
      ]
    : [
        ['universe', r.funnel.universe],
        ['top 50 + 50', r.funnel.ranked],
        ['|chg| ≥ 2%', r.funnel.chg],
        ['|OI chg| ≥ 7%', r.funnel.oi],
      ];
  const rejected = nse ? r.rejected.rank + r.rejected.chg + r.rejected.oi : r.rejected;
  el.innerHTML =
    steps.map(([k, v], i) =>
      `<span class="fstep${i === steps.length - 1 ? ' last' : ''}">` +
      `<b>${v}</b><em>${esc(k)}</em></span>`).join('<i class="farrow">→</i>') +
    `<span class="grow"></span>` +
    `<span class="fnote">scored ${r.funnel.scored} · skipped ${r.skipped.length} · ` +
    `rejected ${rejected}${r.reconciles ? '' : ' · COUNTS DO NOT RECONCILE'}</span>`;
  el.classList.toggle('bad', !r.reconciles);
}

function rowsTable(rows) {
  const head = '<thead><tr>' +
    '<th class="l">Symbol</th><th>LTP</th><th>Chg %</th><th>OI</th><th>OI Chg %</th>' +
    '<th>Volume</th><th class="l">Expiry</th></tr></thead>';
  const body = rows.map(r => `<tr>
    <td class="l"><b>${esc(r.symbol)}</b><span class="nm">${esc(r.name)}</span></td>
    <td>${inr(r.ltp)}</td>
    <td class="${dirClass(r.chgPct)}">${pct(r.chgPct)}</td>
    <td title="${r.oi.toLocaleString('en-IN')} vs baseline ${r.baselineOi.toLocaleString('en-IN')}">${abbr(r.oi)}</td>
    <td class="${dirClass(r.oiPct)}">${pct(r.oiPct)}</td>
    <td>${abbr(r.volume)}</td>
    <td class="l dim">${esc(r.futureExpiry ?? '—')}</td>
  </tr>`).join('');
  return `<table class="scan-t mono">${head}<tbody>${body}</tbody></table>`;
}

/** P14 row 12: NSE's columns — OI numbers are NSE's OI Spurts figures, not a futures contract's. */
function nseRowsTable(rows) {
  const head = '<thead><tr>' +
    '<th class="l">Symbol</th><th>LTP</th><th>Chg %</th><th>OI Chg %</th><th>Latest OI</th>' +
    '<th>Prev OI</th><th>Volume</th></tr></thead>';
  // Fixed column widths, so the Long and Short tables line up column for column.
  const cols = '<colgroup><col style="width:28%"><col><col><col><col><col><col></colgroup>';
  const body = rows.map(r => `<tr>
    <td class="l"><b>${esc(r.symbol)}</b><span class="nm">${esc(r.name)}</span></td>
    <td title="previous close ${inr(r.prevClose)}">${inr(r.ltp)}</td>
    <td class="${dirClass(r.chgPct)}">${pct(r.chgPct)}</td>
    <td class="${dirClass(r.oiPct)}">${pct(r.oiPct)}</td>
    <td title="${r.latestOi.toLocaleString('en-IN')}">${abbr(r.latestOi)}</td>
    <td class="dim" title="${r.prevOi.toLocaleString('en-IN')}">${abbr(r.prevOi)}</td>
    <td>${abbr(r.volume)}</td>
  </tr>`).join('');
  return `<table class="scan-t nse mono">${cols}${head}<tbody>${body}</tbody></table>`;
}

/** P8 row 14 / P14 rows 3, 7. A stock that could not be carried through is named with its reason. */
function namedBlock(list, { id, title, none }) {
  if (!list.length) return none ? `<p class="scan-none">${none}</p>` : '';
  const byReason = new Map();
  for (const s of list) {
    if (!byReason.has(s.reason)) byReason.set(s.reason, []);
    byReason.get(s.reason).push(s);
  }
  const groups = [...byReason.entries()].map(([reason, items]) =>
    `<div class="skgroup"><span class="skreason">${esc(reason)} (${items.length})</span>` +
    `<span class="mono skl">${items.map(s => esc(s.symbol)).join(', ')}</span></div>`).join('');
  return `<details class="scan-skip" id="${id}">
    <summary>${esc(title)} (${list.length})</summary>${groups}</details>`;
}

function skippedBlock(r) {
  // After a failed scan nothing was carried through, so "nothing skipped" would be a false claim
  // printed under the error. Only name what was actually skipped.
  const none = r.error ? '' : r.source === 'nse'
    ? 'Every stock in your F&amp;O list was carried through — nothing skipped.'
    : 'Every one of the universe’s stocks was scored — nothing skipped.';
  let html = namedBlock(r.skipped, { id: 'scanSkip', title: 'skipped', none });
  if (r.source === 'nse') {
    html += namedBlock(r.excluded ?? [], { id: 'scanExcluded', title: 'not in your F&O list' });
  }
  return html;
}

function renderMeta(r) {
  const chip = $('scanMode');
  chip.hidden = false;
  if (r.source === 'nse') {
    chip.textContent = r.mode === 'fixture' ? 'NSE FIXTURE' : 'NSE LIVE';
    chip.className = 'statechip ' + (r.mode === 'fixture' ? 'warn' : 'flat');
    const m = r.market ?? {};
    // P14 row 9: NSE's own clock, never ours — a stale feed has to be visible as stale.
    $('scanMeta').textContent = r.error && !m.priceAsOf
      ? secs(r.elapsedMs)
      : `market ${m.status} · prices ${m.priceAsOf || '—'} · OI ${m.oiAsOf || '—'} · ` +
        `${r.reused ? 'same fetch, re-ranked' : secs(r.elapsedMs)}`;
  } else {
    chip.textContent = r.mode === 'replay' ? 'REPLAY' : 'LIVE';
    chip.className = 'statechip ' + (r.mode === 'replay' ? 'warn' : 'flat');
    $('scanMeta').textContent =
      `${secs(r.elapsedMs)} · ${r.calls.oi} OI calls, ${r.calls.cached} cached` +
      (r.baselineDate ? ` · OI baseline ${r.baselineDate}` : '');
  }
}

function render(r) {
  state.result = r;
  const body = $('scanBody');
  const nse = r.source === 'nse';

  renderMeta(r);
  $('scanCsv').href = `/api/scan.csv?source=${r.source}`;
  $('scanCsv').classList.toggle('off', !(r.long.length + r.short.length));

  if (r.error) {
    $('scanFunnel').hidden = true;
    body.innerHTML = `<div class="scan-err">
      <b>The scan could not run.</b>
      <span class="mono">${esc(r.error)}</span>
    </div>` + skippedBlock(r);
    return;
  }

  renderFunnel(r);

  const total = r.long.length + r.short.length;
  if (!total) {
    // P8 row 13: an expressive zero. It says which step emptied the funnel, so a quiet market and
    // a broken scan cannot look the same.
    const top = nse ? `the top ${r.n}` : 'the top 50';
    const emptiedAt = r.funnel.chg === 0
      ? `no stock in ${top} of either side moved 2% or more`
      : `${r.funnel.chg} stocks moved 2% or more, but none of them ${nse ? 'added' : 'shifted'} 7% of open interest`;
    const first = nse ? r.funnel.list : r.funnel.universe;
    body.innerHTML = `<div class="scan-zero">
      <div class="zface">◠‿◠</div>
      <b>Aaj koi stock filter paar nahi kiya</b>
      <span>The scan ran end to end and found nothing — ${esc(emptiedAt)}.</span>
      <span class="mono zf">${first} → ${r.funnel.ranked} → ${r.funnel.chg} → 0</span>
    </div>` + skippedBlock(r);
    return;
  }

  const table = nse ? nseRowsTable : rowsTable;
  const section = (title, rows, cls) => `
    <section class="scan-sec ${cls}">
      <h3>${title} <span>(${rows.length})</span></h3>
      ${rows.length ? table(rows) : '<p class="scan-none">None.</p>'}
    </section>`;

  body.innerHTML =
    section('Long candidates', r.long, 'long') +
    section('Short candidates', r.short, 'short') +
    skippedBlock(r);
}

function renderRunning(p) {
  const body = $('scanBody');
  const stage = state.source === 'nse'
    ? {
        browser: 'opening Chrome and loading nseindia.com',
        price: 'reading NSE’s Securities in F&O prices',
        oi: 'reading NSE’s OI Spurts',
        funnel: 'ranking against your F&O list',
      }[p.stage]
    : {
        universe: 'reading the F&O universe from the instrument master',
        quote: 'quoting 210 stocks and their near-month futures in one request',
        baseline: 'fetching each survivor’s previous-session futures OI',
      }[p.stage];
  const bar = p.total
    ? `<div class="pbar"><i style="width:${Math.round((p.done / p.total) * 100)}%"></i></div>
       <span class="mono">${p.done} / ${p.total}</span>`
    : '';
  body.innerHTML = `<div class="scan-run">
    <div class="spin" aria-hidden="true"></div>
    <b>Scanning…</b>
    <span>${esc(stage ?? 'starting')}</span>
    ${bar}
    <span class="mono dim">${secs(p.elapsedMs ?? 0)} elapsed</span>
  </div>`;
}

/* -------------------------------------------------------------- the scan */

function syncControls() {
  $('scanSource').value = state.source;
  $('scanTopN').value = String(state.n);
  // P8 ranks a fixed 50 a side; Top N belongs to the NSE source only.
  $('scanTopN').disabled = state.source !== 'nse' || state.running;
  $('scanSource').disabled = state.running;
}

async function refreshStatus() {
  try {
    const s = await (await fetch(`/api/scan/status?source=${state.source}`)).json();
    state.enabled = s.enabled;
    state.reason = s.reason;
    const btn = $('scanBtn');
    btn.disabled = !s.enabled;
    btn.title = !s.enabled
      ? `Scanner needs an open NSE equity session — ${s.reason}`
      : state.source === 'nse'
        ? 'Scan your F&O list on NSE data (S)'
        : 'Scan the 210-stock NSE F&O universe on Dhan data (S)';
  } catch { /* the button simply stays as it is */ }
}

const blank = (error) => state.source === 'nse'
  ? {
      source: 'nse', error, mode: 'live', n: state.n, reused: false, skipped: [], excluded: [], long: [], short: [],
      market: { status: 'unknown', priceAsOf: '', oiAsOf: '' },
      funnel: { list: 0, scored: 0, ranked: 0, chg: 0, oi: 0 },
      rejected: { rank: 0, chg: 0, oi: 0 }, reconciles: false, elapsedMs: 0,
    }
  : {
      source: 'dhan', error, mode: 'live', skipped: [], long: [], short: [],
      funnel: { universe: 0, scored: 0, ranked: 0, chg: 0, oi: 0 }, rejected: 0,
      reconciles: false, elapsedMs: 0, calls: { quote: 0, oi: 0, cached: 0 }, baselineDate: null,
    };

/**
 * `reuse` re-ranks the previous NSE fetch for a new N (P14 row 15), so 20 / 25 / 30 compare the
 * same numbers. Run and Rescan always fetch again.
 */
async function runScan({ reuse = false } = {}) {
  if (state.running) { open(); return; }
  open();
  state.running = true;
  syncControls();
  $('scanRerun').disabled = true;
  $('scanFunnel').hidden = true;
  renderRunning({ stage: state.source === 'nse' ? 'browser' : 'universe', done: 0, total: 0, elapsedMs: 0 });

  const source = state.source;
  state.poll = setInterval(async () => {
    try {
      const s = await (await fetch(`/api/scan/status?source=${source}`)).json();
      if (state.running) renderRunning(s.progress);
    } catch { /* a dropped progress poll must not abort the scan itself */ }
  }, 400);

  try {
    const q = source === 'nse' ? `source=nse&n=${state.n}${reuse ? '&reuse=1' : ''}` : 'source=dhan';
    const res = await fetch(`/api/scan?${q}`);
    const r = await res.json();
    if (!res.ok) render({ ...blank(r.error ?? `HTTP ${res.status}`) });
    else render({ source, ...r });
  } catch (err) {
    render(blank(String(err?.message ?? err)));
  } finally {
    state.running = false;
    clearInterval(state.poll);
    state.poll = null;
    $('scanRerun').disabled = false;
    syncControls();
  }
}

/* ------------------------------------------------------------------ wiring */

$('scanBtn').addEventListener('click', () => runScan());
$('scanRerun').addEventListener('click', () => runScan());
$('scanClose').addEventListener('click', close);
$('scan').addEventListener('mousedown', (e) => { if (e.target === $('scan')) close(); });

$('scanSource').addEventListener('change', async (e) => {
  if (!SOURCES.includes(e.target.value)) return;
  state.source = e.target.value;
  savePrefs();
  syncControls();
  await refreshStatus();
  if (state.enabled) runScan();
  else render(blank(`Dhan scanner needs an open NSE equity session — ${state.reason}`));
});

$('scanTopN').addEventListener('change', (e) => {
  const n = Number(e.target.value);
  if (!TOP_N.includes(n)) return;
  state.n = n;
  savePrefs();
  // Same fetch, re-ranked — only when the result on screen is an NSE one to re-rank.
  runScan({ reuse: state.result?.source === 'nse' && !state.result.error });
});

document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  // Esc closes the scanner only while it is open, so the drawing tools keep their Esc otherwise.
  if (e.key === 'Escape' && state.open) {
    // Stop here. candles.js has its own Escape handler that leaves option-candle mode, and it is
    // registered after this one on the same target, so a plain `return` let ONE Esc close the
    // scanner AND tear down the option chart behind it.
    e.stopImmediatePropagation();
    close();
    return;
  }
  if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (state.open) close();
    else if (state.enabled) runScan();
  }
});

syncControls();
refreshStatus();
// The session can open or close while the page is left running overnight, which is the normal
// case on this project rather than the edge case.
setInterval(refreshStatus, 60_000);

/** Read-only seam for the verification scripts. Nothing in the app reads it. */
window.__scan = {
  result: () => state.result,
  open: () => state.open,
  running: () => state.running,
  source: () => state.source,
  n: () => state.n,
  run: runScan,
  show: open,
  hide: close,
};
