/* P8 + P14 + P16 — the Scanner workspace.

   Specs: docs/spec/scanner-v1.md (source Dhan), docs/spec/scanner-nse-v1.md (source NSE, the
   default) and docs/spec/redesign-v2.md rows 3 and 16 (the scanner is a workspace, not a modal).
   Manual only — P8 row 9, P14 row 8: this file has no timer, and nothing else in the app calls
   /api/scan. The daily 09:20 run lives in GitHub Actions, not here.

   The workspace is still a position:fixed layer over the chain rather than a route, because a
   route change would tear down the chain poll and the tick feed.

   The number formatters are imported from app.js rather than redefined, so one screen never ends
   up printing 12.4 L in the grid and 1,240,000 in the scanner. */

import { abbr, inr } from '/app.js';

const $ = (id) => document.getElementById(id);

const SOURCES = ['nse', 'dhan'];
const TOP_N = [20, 25, 30];
const PREF_KEY = 'scan:v1';
/** P16 row 3: which workspace the page opens on. A per-viewer convenience; Scanner by default. */
const WS_KEY = 'ws';
const LOGS_URL = 'https://github.com/Dev-Shivam-05/Trading-Dhan-PR/tree/scan-logs';

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

/* Storage can be blocked or empty; every read and write is guarded and the defaults stand. */
try {
  const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null');
  if (saved && SOURCES.includes(saved.source)) state.source = saved.source;
  if (saved && TOP_N.includes(saved.n)) state.n = saved.n;
} catch { /* defaults stand */ }

function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ source: state.source, n: state.n })); } catch { /* ignore */ }
}
function saveWs(ws) {
  try { localStorage.setItem(WS_KEY, ws); } catch { /* ignore */ }
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

/* ------------------------------------------------------- workspace switch */

function setTabs() {
  $('scanBtn').setAttribute('aria-selected', String(state.open));
  $('chainTab').setAttribute('aria-selected', String(!state.open));
}

function open({ focus = true } = {}) {
  if (state.open) return;
  state.open = true;
  $('scan').hidden = false;
  setTabs();
  saveWs('scanner');
  document.dispatchEvent(new CustomEvent('ws', { detail: 'scanner' }));
  if (focus) $('scanRerun').focus({ preventScroll: true });
}

function close() {
  if (!state.open) return;
  state.open = false;
  $('scan').hidden = true;
  setTabs();
  saveWs('chain');
  $('chainTab').focus({ preventScroll: true });
}

/* ----------------------------------------------------------------- render */

/**
 * P8 row 13 / P16 row 16. The funnel is printed on every outcome — a legitimate zero has to read
 * as a zero rather than as a broken scan. Each tile's bar is its count divided by the first count.
 */
function renderFunnel(r) {
  const el = $('scanFunnel');
  el.hidden = false;
  const nse = r.source === 'nse';
  const steps = nse
    ? [
        ['F&O list', r.funnel.list, `${r.funnel.list} stocks in your list`],
        [`top ${r.n} + ${r.n}`, r.funnel.ranked, `top ${r.n} gainers and ${r.n} losers`],
        ['|chg| ≥ 2%', r.funnel.chg, 'moved 2% or more, either way'],
        ['OI chg ≥ 7%', r.funnel.oi, 'open interest rose 7% or more'],
      ]
    : [
        ['universe', r.funnel.universe, 'NSE F&O stocks'],
        ['top 50 + 50', r.funnel.ranked, 'top 50 gainers and 50 losers'],
        ['|chg| ≥ 2%', r.funnel.chg, 'moved 2% or more, either way'],
        ['|OI chg| ≥ 7%', r.funnel.oi, 'futures OI moved 7% or more'],
      ];
  const base = steps[0][1] || 1;
  const rejected = nse ? r.rejected.rank + r.rejected.chg + r.rejected.oi : r.rejected;
  el.innerHTML =
    steps.map(([k, v, cap], i) =>
      `<div class="fstep${i === steps.length - 1 ? ' last' : ''}">` +
      `<span class="fk">Step ${i + 1}</span><b>${v}</b>` +
      `<span class="fbar"><i data-w="${Math.max(v ? 2 : 0, (v / base) * 100).toFixed(1)}"></i></span>` +
      `<em>${esc(k)} · ${esc(cap)}</em></div>`).join('<i class="farrow">›</i>') +
    `<span class="fnote">scored ${r.funnel.scored} · skipped ${r.skipped.length} · ` +
    `rejected ${rejected}${r.reconciles ? '' : ' · COUNTS DO NOT RECONCILE'}</span>`;
  el.classList.toggle('bad', !r.reconciles);
  // Row 11: the bars grow in over 480ms on a new result — set the width a frame after insertion.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const i of el.querySelectorAll('.fbar i')) i.style.width = `${i.dataset.w}%`;
  }));
}

/** P8's columns (source Dhan). The expiry moved under the name to fit a half-width card. */
function rowsTable(rows) {
  const head = '<colgroup><col style="width:30%"><col><col><col><col><col></colgroup><thead><tr>' +
    '<th class="l">Symbol</th><th>LTP</th><th>Chg %</th><th>OI</th><th>OI Chg %</th>' +
    '<th>Volume</th></tr></thead>';
  const body = rows.map(r => `<tr>
    <td class="l"><b>${esc(r.symbol)}</b><span class="nm">${esc(r.name)} · fut ${esc(r.futureExpiry ?? '—')}</span></td>
    <td class="mono">${inr(r.ltp)}</td>
    <td class="mono ${dirClass(r.chgPct)}">${pct(r.chgPct)}</td>
    <td class="mono" title="${r.oi.toLocaleString('en-IN')} vs baseline ${r.baselineOi.toLocaleString('en-IN')}">${abbr(r.oi)}</td>
    <td class="mono oich"><span>${pct(r.oiPct)}</span></td>
    <td class="mono">${abbr(r.volume)}</td>
  </tr>`).join('');
  return `<table class="scan-t">${head}<tbody>${body}</tbody></table>`;
}

/** P14 row 12: NSE's columns — OI figures are NSE OI Spurts', not a futures contract's. Prev OI is
    in the OI chip's title and in the CSV; a half-width card has room for six columns, not seven. */
function nseRowsTable(rows) {
  const head = '<colgroup><col style="width:30%"><col><col><col><col><col></colgroup><thead><tr>' +
    '<th class="l">Symbol</th><th>LTP</th><th>Chg %</th><th>OI Chg %</th><th>Latest OI</th>' +
    '<th>Volume</th></tr></thead>';
  const body = rows.map(r => `<tr>
    <td class="l"><b>${esc(r.symbol)}</b><span class="nm">${esc(r.name)}</span></td>
    <td class="mono" title="previous close ${inr(r.prevClose)}">${inr(r.ltp)}</td>
    <td class="mono ${dirClass(r.chgPct)}">${pct(r.chgPct)}</td>
    <td class="mono oich" title="${r.prevOi.toLocaleString('en-IN')} → ${r.latestOi.toLocaleString('en-IN')}"><span>${pct(r.oiPct)}</span></td>
    <td class="mono">${abbr(r.latestOi)}</td>
    <td class="mono">${abbr(r.volume)}</td>
  </tr>`).join('');
  return `<table class="scan-t nse">${head}<tbody>${body}</tbody></table>`;
}

/** P8 row 14 / P14 rows 3, 7. A stock that could not be carried through is named with its reason. */
function namedBlock(list, { id, title }) {
  if (!list.length) return '';
  const byReason = new Map();
  for (const s of list) {
    if (!byReason.has(s.reason)) byReason.set(s.reason, []);
    byReason.get(s.reason).push(s);
  }
  const groups = [...byReason.entries()].map(([reason, items]) =>
    `<div class="skgroup"><span class="skreason">${esc(reason)} (${items.length})</span>` +
    `<span class="mono skl">${items.map(s => esc(s.symbol)).join(', ')}</span></div>`).join('');
  return `<details class="scan-skip card" id="${id}">
    <summary>${esc(title)} (${list.length})</summary>${groups}</details>`;
}

function skippedBlock(r) {
  let html = namedBlock(r.skipped, { id: 'scanSkip', title: 'skipped' });
  if (r.source === 'nse') html += namedBlock(r.excluded ?? [], { id: 'scanExcluded', title: 'not in your F&O list' });
  return html;
}

/** P16 row 16: why each ranked stock passed or failed — P15's trace, which the log already had. */
function traceBlock(r) {
  if (r.source !== 'nse' || !r.trace?.length) return '';
  const rows = [...r.trace].sort((a, b) =>
    (a.outcome === 'pass' ? 0 : 1) - (b.outcome === 'pass' ? 0 : 1) || Math.abs(b.chgPct) - Math.abs(a.chgPct));
  // After a failed scan nothing was carried through, so this line is only printed on a real result.
  const hint = r.skipped.length ? `${r.skipped.length} skipped` : 'nothing skipped · every stock in your F&O list was carried through';
  return `<details class="scan-trace card" id="scanTrace">
    <summary>Why each of the ${r.trace.length} ranked stocks passed or failed<span class="hint">${esc(hint)}</span></summary>
    <table class="trace"><thead><tr><th class="l">Symbol</th><th class="l">Side</th><th>Chg %</th><th>OI chg %</th><th class="l">Outcome</th></tr></thead><tbody>
    ${rows.map(t => `<tr><td class="l mono">${esc(t.symbol)}</td><td class="l dim">${esc(t.side)}</td>` +
      `<td class="mono ${dirClass(t.chgPct)}">${pct(t.chgPct)}</td><td class="mono dim">${pct(t.oiPct)}</td>` +
      `<td class="l ${t.outcome === 'pass' ? 'pass' : 'dim'}">${esc(t.outcome)}</td></tr>`).join('')}
    </tbody></table></details>`;
}

/** P16 row 16: the footer card — the scan also runs without this page being open. */
function autoCard() {
  return `<div class="card scan-auto">
    <span class="beat" aria-hidden="true"></span>
    <div><div class="t1">Runs automatically at 09:20 and 09:25 IST, Monday to Friday</div>
    <div class="t2">GitHub Actions on Ubuntu and Windows · every run is logged with NSE's own timestamps</div></div>
    <a href="${LOGS_URL}" target="_blank" rel="noopener">View every run →</a>
  </div>`;
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
    body.innerHTML = `<div class="card scan-err">
      <b>The scan could not run.</b>
      <span class="mono">${esc(r.error)}</span>
    </div>` + skippedBlock(r) + autoCard();
    return;
  }

  renderFunnel(r);

  const total = r.long.length + r.short.length;
  if (!total) {
    // P8 row 13: an expressive zero that says which step emptied the funnel.
    const top = nse ? `the top ${r.n}` : 'the top 50';
    const emptiedAt = r.funnel.chg === 0
      ? `no stock in ${top} of either side moved 2% or more`
      : `${r.funnel.chg} stocks moved 2% or more, but none of them ${nse ? 'added' : 'shifted'} 7% of open interest`;
    const first = nse ? r.funnel.list : r.funnel.universe;
    body.innerHTML = `<div class="card scan-zero">
      <div class="zface">◠‿◠</div>
      <b>Aaj koi stock filter paar nahi kiya</b>
      <span>The scan ran end to end and found nothing — ${esc(emptiedAt)}.</span>
      <span class="mono zf">${first} → ${r.funnel.ranked} → ${r.funnel.chg} → 0</span>
    </div>` + traceBlock(r) + skippedBlock(r) + autoCard();
    return;
  }

  const table = nse ? nseRowsTable : rowsTable;
  const section = (title, rows, cls) => `
    <section class="scan-sec card ${cls}">
      <h3>${title} <span>(${rows.length})</span></h3>
      ${rows.length ? table(rows) : '<p class="scan-none">None this time.</p>'}
    </section>`;

  body.innerHTML =
    `<div class="scan-results">${section('Long candidates', r.long, 'long')}${section('Short candidates', r.short, 'short')}</div>` +
    traceBlock(r) + skippedBlock(r) + autoCard();
}

/** Before the first scan of the session: say what the screen does and how to start it. */
function renderIdle() {
  $('scanFunnel').hidden = true;
  $('scanBody').innerHTML = `<div class="card scan-idle">
    <b>No scan yet in this session</b>
    <span>Press <b>Run scan</b> or <span class="mono">S</span>. NSE is read through a Chrome window
    that opens off-screen for a few seconds.</span>
  </div>` + autoCard();
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
  body.innerHTML = `<div class="card scan-run">
    <div class="spin" aria-hidden="true"></div>
    <b>Scanning…</b>
    <span>${esc(stage ?? 'starting')}</span>
    ${bar}
    <span class="mono dim">${secs(p.elapsedMs ?? 0)} elapsed</span>
  </div>`;
}

/* -------------------------------------------------------------- the scan */

/** The selects are the source of truth; the segmented buttons mirror them. */
function syncControls() {
  $('scanSource').value = state.source;
  $('scanTopN').value = String(state.n);
  // P8 ranks a fixed 50 a side; Top N belongs to the NSE source only.
  $('scanTopN').disabled = state.source !== 'nse' || state.running;
  $('scanSource').disabled = state.running;
  for (const seg of document.querySelectorAll('.scan .seg[data-for]')) {
    const sel = $(seg.dataset.for);
    for (const b of seg.querySelectorAll('button')) {
      b.setAttribute('aria-pressed', String(b.dataset.v === sel.value));
      b.disabled = sel.disabled;
    }
  }
}

async function refreshStatus() {
  try {
    const s = await (await fetch(`/api/scan/status?source=${state.source}`)).json();
    state.enabled = s.enabled;
    state.reason = s.reason;
    // The nav tab always switches workspace; only the Run button depends on the source's gate.
    const run = $('scanRerun');
    if (!state.running) run.disabled = !s.enabled;
    run.title = !s.enabled
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
      rejected: { rank: 0, chg: 0, oi: 0 }, trace: [], reconciles: false, elapsedMs: 0,
    }
  : {
      source: 'dhan', error, mode: 'live', skipped: [], long: [], short: [],
      funnel: { universe: 0, scored: 0, ranked: 0, chg: 0, oi: 0 }, rejected: 0,
      reconciles: false, elapsedMs: 0, calls: { quote: 0, oi: 0, cached: 0 }, baselineDate: null,
    };

/**
 * `reuse` re-ranks the previous NSE fetch for a new N (P14 row 15), so 20 / 25 / 30 compare the
 * same numbers. Run always fetches again.
 */
async function runScan({ reuse = false } = {}) {
  if (state.running) { open(); return; }
  open({ focus: false });
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
    $('scanRerun').disabled = !state.enabled;
    syncControls();
  }
}

/* ------------------------------------------------------------------ wiring */

// P16 row 3: the nav tabs switch workspace; they never start a scan on their own.
// P29: another workspace opened - stand down. Mirrors ltp.js; neither imports the other.
document.addEventListener('ws', (e) => { if (e.detail !== 'scanner') close(); });

$('scanBtn').addEventListener('click', () => open());
$('chainTab').addEventListener('click', close);
$('scanRerun').addEventListener('click', () => runScan());
$('scanClose').addEventListener('click', close);

for (const seg of document.querySelectorAll('.scan .seg[data-for]')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    const sel = $(seg.dataset.for);
    if (!b || b.disabled || sel.value === b.dataset.v) return;
    sel.value = b.dataset.v;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

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
  // panel-windows-v1.md amendment 17: while a panel is fullscreen, Esc is the browser's way out.
  if (document.fullscreenElement) return;
  // Esc leaves the scanner only while it is open, so the drawing tools keep their Esc otherwise.
  if (e.key === 'Escape' && state.open) {
    // Stop here. candles.js has its own Escape handler that leaves option-candle mode, and it is
    // registered after this one on the same target, so a plain `return` let ONE Esc close the
    // scanner AND tear down the option chart behind it.
    e.stopImmediatePropagation();
    close();
    return;
  }
  // P16 amendment 24: `S` always means "scan". In the chain it opens the scanner and runs; in the
  // scanner it runs again. (Before, a second `S` closed the modal — a workspace has Esc for that.)
  if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (state.enabled && !state.running) runScan();
    else open();
  }
});

syncControls();
refreshStatus();
renderIdle();
// Row 3: open on the workspace the viewer last used, Scanner the first time.
// P32: only a first visit (no value) or the scanner's own value opens it. `ltp` and `paper` open
// themselves from this same key a moment later — mapping every non-'chain' value to 'scanner'
// overwrote theirs before they could read it, so neither workspace ever survived a reload.
let startWs = 'scanner';
try { startWs = localStorage.getItem(WS_KEY) ?? 'scanner'; } catch { /* default */ }
if (startWs === 'scanner') open({ focus: false });
setTabs();
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
