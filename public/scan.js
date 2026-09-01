/* P8 — the 9:20 F&O scanner panel.

   Spec: docs/spec/scanner-v1.md. Manual only (row 9): this file has no timer, and nothing else
   in the app calls /api/scan. The panel is an overlay (row 12) rather than a route, because a
   route change would tear down the chain poll and the tick feed.

   The number formatters are imported from app.js rather than redefined, so one screen never ends
   up printing 12.4 L in the grid and 1,240,000 in the scanner. */

import { abbr, inr } from '/app.js';

const $ = (id) => document.getElementById(id);

const state = {
  open: false,
  running: false,
  result: null,
  /** Progress poll while a scan is in flight. The fan-out is up to ~100 serial calls live. */
  poll: null,
  enabled: false,
  reason: '',
};

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
 * Row 13. The funnel is printed on every outcome, not just the empty one — a legitimate zero has
 * to read as a zero rather than as a broken scan, and it can only do that if the reader can see
 * where the 210 went.
 */
function renderFunnel(r) {
  const el = $('scanFunnel');
  el.hidden = false;
  const steps = [
    ['universe', r.funnel.universe],
    ['top 50 + 50', r.funnel.ranked],
    ['|chg| ≥ 2%', r.funnel.chg],
    ['|OI chg| ≥ 7%', r.funnel.oi],
  ];
  el.innerHTML =
    steps.map(([k, v], i) =>
      `<span class="fstep${i === steps.length - 1 ? ' last' : ''}">` +
      `<b>${v}</b><em>${esc(k)}</em></span>`).join('<i class="farrow">→</i>') +
    `<span class="grow"></span>` +
    `<span class="fnote">scored ${r.funnel.scored} · skipped ${r.skipped.length} · ` +
    `rejected ${r.rejected}${r.reconciles ? '' : ' · COUNTS DO NOT RECONCILE'}</span>`;
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

/** Row 14. A stock that could not be scored is named with its reason — never quietly dropped. */
function skippedBlock(skipped) {
  if (!skipped.length) {
    return `<p class="scan-none">Every one of the universe's stocks was scored — nothing skipped.</p>`;
  }
  const byReason = new Map();
  for (const s of skipped) {
    if (!byReason.has(s.reason)) byReason.set(s.reason, []);
    byReason.get(s.reason).push(s);
  }
  const groups = [...byReason.entries()].map(([reason, list]) =>
    `<div class="skgroup"><span class="skreason">${esc(reason)} (${list.length})</span>` +
    `<span class="mono skl">${list.map(s => esc(s.symbol)).join(', ')}</span></div>`).join('');
  return `<details class="scan-skip" id="scanSkip">
    <summary>skipped (${skipped.length})</summary>${groups}</details>`;
}

function render(r) {
  state.result = r;
  const body = $('scanBody');

  $('scanMode').hidden = false;
  $('scanMode').textContent = r.mode === 'replay' ? 'REPLAY' : 'LIVE';
  $('scanMode').className = 'statechip ' + (r.mode === 'replay' ? 'warn' : 'flat');
  $('scanMeta').textContent =
    `${secs(r.elapsedMs)} · ${r.calls.oi} OI calls, ${r.calls.cached} cached` +
    (r.baselineDate ? ` · OI baseline ${r.baselineDate}` : '');
  $('scanCsv').classList.toggle('off', !(r.long.length + r.short.length));

  if (r.error) {
    $('scanFunnel').hidden = true;
    body.innerHTML = `<div class="scan-err">
      <b>The scan could not run.</b>
      <span class="mono">${esc(r.error)}</span>
    </div>` + skippedBlock(r.skipped);
    return;
  }

  renderFunnel(r);

  const total = r.long.length + r.short.length;
  if (!total) {
    // Row 13: an expressive zero. It says which step emptied the funnel, so a quiet market and a
    // broken scan cannot look the same.
    const emptiedAt = r.funnel.chg === 0
      ? 'no stock in the top 50 of either side moved 2% or more'
      : `${r.funnel.chg} stocks moved 2% or more, but none of them shifted 7% of open interest`;
    body.innerHTML = `<div class="scan-zero">
      <div class="zface">◠‿◠</div>
      <b>Aaj koi stock filter paar nahi kiya</b>
      <span>The scan ran end to end and found nothing — ${esc(emptiedAt)}.</span>
      <span class="mono zf">${r.funnel.universe} → ${r.funnel.ranked} → ${r.funnel.chg} → 0</span>
    </div>` + skippedBlock(r.skipped);
    return;
  }

  const section = (title, rows, cls) => `
    <section class="scan-sec ${cls}">
      <h3>${title} <span>(${rows.length})</span></h3>
      ${rows.length ? rowsTable(rows) : '<p class="scan-none">None.</p>'}
    </section>`;

  body.innerHTML =
    section('Long candidates', r.long, 'long') +
    section('Short candidates', r.short, 'short') +
    skippedBlock(r.skipped);
}

function renderRunning(p) {
  const body = $('scanBody');
  const stage = {
    universe: 'reading the F&O universe from the instrument master',
    quote: 'quoting 210 stocks and their near-month futures in one request',
    baseline: 'fetching each survivor’s previous-session futures OI',
  }[p.stage] ?? 'starting';
  const bar = p.total
    ? `<div class="pbar"><i style="width:${Math.round((p.done / p.total) * 100)}%"></i></div>
       <span class="mono">${p.done} / ${p.total}</span>`
    : '';
  body.innerHTML = `<div class="scan-run">
    <div class="spin" aria-hidden="true"></div>
    <b>Scanning…</b>
    <span>${esc(stage)}</span>
    ${bar}
    <span class="mono dim">${secs(p.elapsedMs)} elapsed</span>
  </div>`;
}

/* -------------------------------------------------------------- the scan */

async function refreshStatus() {
  try {
    const s = await (await fetch('/api/scan/status')).json();
    state.enabled = s.enabled;
    state.reason = s.reason;
    const btn = $('scanBtn');
    btn.disabled = !s.enabled;
    btn.title = s.enabled
      ? 'Scan the 210-stock NSE F&O universe (S)'
      : `Scanner needs an open NSE equity session — ${s.reason}`;
  } catch { /* the button simply stays as it is */ }
}

async function runScan() {
  if (state.running) { open(); return; }
  open();
  state.running = true;
  $('scanRerun').disabled = true;
  $('scanFunnel').hidden = true;
  renderRunning({ stage: 'universe', done: 0, total: 0, elapsedMs: 0 });

  state.poll = setInterval(async () => {
    try {
      const s = await (await fetch('/api/scan/status')).json();
      if (state.running) renderRunning(s.progress);
    } catch { /* a dropped progress poll must not abort the scan itself */ }
  }, 400);

  try {
    const res = await fetch('/api/scan');
    const r = await res.json();
    if (!res.ok) {
      render({
        error: r.error ?? `HTTP ${res.status}`, mode: 'live', skipped: [], long: [], short: [],
        funnel: { universe: 0, scored: 0, ranked: 0, chg: 0, oi: 0 }, rejected: 0,
        reconciles: false, elapsedMs: 0, calls: { quote: 0, oi: 0, cached: 0 }, baselineDate: null,
      });
    } else {
      render(r);
    }
  } catch (err) {
    render({
      error: String(err?.message ?? err), mode: 'live', skipped: [], long: [], short: [],
      funnel: { universe: 0, scored: 0, ranked: 0, chg: 0, oi: 0 }, rejected: 0,
      reconciles: false, elapsedMs: 0, calls: { quote: 0, oi: 0, cached: 0 }, baselineDate: null,
    });
  } finally {
    state.running = false;
    clearInterval(state.poll);
    state.poll = null;
    $('scanRerun').disabled = false;
  }
}

/* ------------------------------------------------------------------ wiring */

$('scanBtn').addEventListener('click', runScan);
$('scanRerun').addEventListener('click', runScan);
$('scanClose').addEventListener('click', close);
$('scan').addEventListener('mousedown', (e) => { if (e.target === $('scan')) close(); });

document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  // Esc closes the scanner only while it is open, so the drawing tools keep their Esc otherwise.
  if (e.key === 'Escape' && state.open) { close(); return; }
  if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (state.open) close();
    else if (state.enabled) runScan();
  }
});

refreshStatus();
// The session can open or close while the page is left running overnight, which is the normal
// case on this project rather than the edge case.
setInterval(refreshStatus, 60_000);

/** Read-only seam for the replay verification scripts. Nothing in the app reads it. */
window.__scan = {
  result: () => state.result,
  open: () => state.open,
  running: () => state.running,
  run: runScan,
  show: open,
  hide: close,
};
