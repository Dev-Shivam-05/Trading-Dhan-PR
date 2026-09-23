/**
 * The Paper workspace — `docs/spec/paper-trading-v1.md` rows 10, 11, 15, 16, 18.
 *
 * PAPER MEANS PAPER. This screen arms, disarms and exits SIMULATED positions held by the server's
 * `PaperTrader`. Nothing here, and nothing behind `/api/paper*`, can reach a Dhan order endpoint.
 *
 * The trader runs on the server, not in this tab: the 09:20 scan, the fills and the exits happen
 * whether or not this page is open. This module only reads `/api/paper` once a second while the
 * workspace is on screen (row 16) and posts the four buttons.
 *
 * SHAPE: the same one-directional shape `scan.js` and `ltp.js` use. It owns `#paper` and
 * `#paperTab`, imports nothing, and switches workspace through the one `ws` CustomEvent on
 * `document`. `.paperw[hidden]` has its own CSS rule, because a layout rule outranks the `hidden`
 * attribute (the trap that once kept the scanner panel on screen from page load).
 */

const $ = (id) => document.getElementById(id);
const WS_KEY = 'ws';

const state = {
  open: false,
  view: null,
  error: null,
  /** The last refusal from a button (a 409), shown until the next successful action. */
  notice: null,
  busy: false,
  timer: null,
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const num = (v, dp = 2) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : '—';

const int = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-IN') : '—');

const signed = (v, dp = 2) =>
  typeof v === 'number' && Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), dp) : '—';

const dirClass = (v) => (typeof v !== 'number' || v === 0 ? 'flat' : v > 0 ? 'up' : 'down');

const hms = (ms) => (ms ? new Date(ms + 5.5 * 3600_000).toISOString().slice(11, 19) : '—');

const REASON = { target: 'Target', stop: 'Stop', eod: '15:15 square-off', manual: 'Exited by hand', stale: 'Stale — closed at boot' };

/* ------------------------------------------------------- workspace switch */

function setTabs() {
  $('paperTab')?.setAttribute('aria-selected', String(state.open));
  if (state.open) $('chainTab')?.setAttribute('aria-selected', 'false');
}

function saveWs(v) {
  try { localStorage.setItem(WS_KEY, v); } catch { /* private window — not fatal */ }
}

function open() {
  if (state.open) return;
  state.open = true;
  $('paper').hidden = false;
  setTabs();
  // Announce FIRST, then save: the scanner's close() writes `ws=chain`, and saving before the
  // announcement let it overwrite this value, so the workspace never survived a reload.
  document.dispatchEvent(new CustomEvent('ws', { detail: 'paper' }));
  saveWs('paper');
  load();
  state.timer = setInterval(load, 1000);   // row 16
  $('paperTab').focus({ preventScroll: true });
}

/**
 * `toChain` only when the user asked for the chain (its tab, Esc). A close caused by ANOTHER
 * workspace opening must not write `ws`, or it overwrites the value that workspace just saved.
 */
function close(toChain = false) {
  if (!state.open) return;
  state.open = false;
  $('paper').hidden = true;
  setTabs();
  clearInterval(state.timer);
  state.timer = null;
  if (toChain) {
    saveWs('chain');
    $('chainTab')?.setAttribute('aria-selected', 'true');
  }
}

/* ------------------------------------------------------------------ data */

async function load() {
  try {
    const res = await fetch('/api/paper');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.view = await res.json();
    state.error = null;
  } catch (e) {
    state.error = `could not reach the backend — ${e.message ?? e}`;
  }
  render();
}

async function post(path, body = {}) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const res = await fetch(path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) state.notice = out.error ?? `HTTP ${res.status}`;
    else { state.view = out; state.notice = null; }
  } catch (e) {
    state.notice = `could not reach the backend — ${e.message ?? e}`;
  }
  state.busy = false;
  render();
}

/* ---------------------------------------------------------------- render */

function sideCell(side) {
  return `<td class="l"><span class="pp-side ${side === 'BUY' ? 'buy' : 'sell'}">${side}</span></td>`;
}

function openTable(rows) {
  if (!rows.length) return '<p class="scan-none">No open positions.</p>';
  const body = rows.map((p) => {
    const pending = p.status === 'pending';
    return `<tr data-id="${esc(p.id)}" class="${pending ? 'pending' : ''}">
      <td class="l"><b>${esc(p.symbol)}</b><span class="nm">FUT ${esc(p.expiry)}</span></td>
      ${sideCell(p.side)}
      <td>${int(p.qty)}</td>
      <td>${pending ? '<span class="pp-wait">first tick…</span>' : num(p.entryPx)}</td>
      <td>${num(p.ltp)}</td>
      <td class="dim">${num(p.stopPx)}</td>
      <td class="dim">${num(p.targetPx)}</td>
      <td class="${dirClass(p.pnl)}">${signed(p.pnl)}</td>
      <td class="${dirClass(p.pnlPct)}">${p.pnlPct === null ? '—' : signed(p.pnlPct) + '%'}</td>
      <td><button class="tog pp-exit" type="button" data-exit="${esc(p.id)}"
        ${state.busy ? 'disabled' : ''}>${pending ? 'Cancel' : 'Exit'}</button></td>
    </tr>`;
  }).join('');
  return `<table class="scan-t pp-t">
    <colgroup><col style="width:15%"><col style="width:8%"><col style="width:8%"><col><col><col><col>
      <col style="width:11%"><col style="width:9%"><col style="width:10%"></colgroup>
    <thead><tr><th class="l">Symbol</th><th class="l">Side</th><th>Qty</th><th>Entry</th><th>LTP</th>
      <th>Stop</th><th>Target</th><th>P&amp;L ₹</th><th>P&amp;L %</th><th></th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

function closedTable(rows) {
  if (!rows.length) return '<p class="scan-none">Nothing closed today.</p>';
  const body = rows.map((p) => `<tr data-id="${esc(p.id)}">
      <td class="l"><b>${esc(p.symbol)}</b><span class="nm">${hms(p.exitAt ?? p.createdAt)}</span></td>
      ${sideCell(p.side)}
      <td>${num(p.entryPx)}</td>
      <td>${num(p.exitPx)}</td>
      <td class="l dim">${p.status === 'unfilled' ? `Not filled — ${esc(p.note)}` : esc(REASON[p.reason] ?? p.reason)}</td>
      <td class="${dirClass(p.pnl)}">${p.status === 'unfilled' ? '—' : signed(p.pnl)}</td>
    </tr>`).join('');
  return `<table class="scan-t pp-t">
    <colgroup><col style="width:18%"><col style="width:10%"><col><col><col style="width:30%"><col style="width:15%"></colgroup>
    <thead><tr><th class="l">Symbol</th><th class="l">Side</th><th>Entry</th><th>Exit</th>
      <th class="l">Reason</th><th>P&amp;L ₹</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

function historyTable(rows) {
  if (!rows.length) return '<p class="scan-none">No closed trades yet.</p>';
  const body = rows.map((d) => `<tr>
      <td class="l">${esc(d.date)}</td><td>${int(d.trades)}</td><td>${int(d.wins)}</td>
      <td class="${dirClass(d.pnl)}">${signed(d.pnl)}</td></tr>`).join('');
  return `<table class="scan-t pp-t pp-hist">
    <thead><tr><th class="l">Date</th><th>Trades</th><th>Wins</th><th>P&amp;L ₹</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

function notTaken(day) {
  const list = day?.notTaken ?? [];
  if (!list.length) return '';
  const items = list.map((n) => `<li><b>${esc(n.symbol)}</b> ${esc(n.side)} — ${esc(n.reason)}</li>`).join('');
  return `<details class="pp-nt"><summary>Not taken (${list.length})</summary><ul>${items}</ul></details>`;
}

function render() {
  const body = $('ppBody');
  if (!body) return;
  const v = state.view;

  if (!v) {
    body.innerHTML = `<div class="ltp-msg">${state.error
      ? `<b>The paper trader is not reachable.</b><p>${esc(state.error)}</p>`
      : 'Loading…'}</div>`;
    return;
  }

  // Header: status line, P&L, the buttons.
  const clock = v.replayClock ? ` · replay clock ${esc(v.clock)}` : '';
  $('ppStatus').innerHTML = `${esc(v.status)}${clock}`;
  $('ppStatus').classList.toggle('bad', /failed|no trades|missed|refus/i.test(v.status));
  const pnl = $('ppPnl');
  pnl.textContent = signed(v.dayPnl.total);
  pnl.className = `pp-num ${dirClass(v.dayPnl.total)}`;
  $('ppPnlSub').textContent = `realised ${signed(v.dayPnl.realised)} · open ${signed(v.dayPnl.unrealised)}`;

  const armBtn = $('ppArm');
  armBtn.setAttribute('aria-pressed', String(v.armed));
  armBtn.textContent = v.armed ? 'Armed · auto 09:20' : 'Arm auto-trading';
  armBtn.title = v.armed
    ? 'Disarm: no new trades. Positions already open stay open until their stop, target or 15:15.'
    : 'Arm: the server scans NSE at 09:20 IST and paper-trades the Long / Short lists until 09:30.';
  armBtn.disabled = state.busy;
  $('ppExitAll').disabled = state.busy || v.open.length === 0;
  const run = $('ppRun');
  run.hidden = !v.canRunNow;
  run.disabled = state.busy || v.open.length > 0;
  run.title = v.open.length > 0 ? 'Square off first — positions are still pending or open' : 'Replay only: run the scan now, with the engine clock set to 09:20:00';
  $('ppMode').textContent = v.mode === 'replay' ? 'REPLAY' : 'LIVE';
  $('ppMode').className = `statechip ${v.mode === 'replay' ? 'warn' : 'flat'}`;

  const r = v.rules;
  $('ppRules').textContent = `Scan ${r.scanAt} · entries until ${r.entryUntil} · stop ${r.stopPct}% · target ${r.targetPct}% · ${r.size} · max ${r.maxPositions} a day · square-off ${r.squareOffAt} · P&L is gross, before charges`;

  const notice = state.notice ? `<div class="pp-notice" role="alert">${esc(state.notice)}</div>` : '';
  const disarmedOpen = !v.armed && v.open.length
    ? `<p class="pp-hint">Disarmed. The ${v.open.length} position${v.open.length === 1 ? '' : 's'} below stay open until stop, target, 15:15 or Exit.</p>` : '';

  body.innerHTML = `${notice}${disarmedOpen}
    <section class="card scan-sec pp-sec"><h3>Open <span>${v.open.length}</span></h3>${openTable(v.open)}${notTaken(v.day)}</section>
    <div class="pp-two">
      <section class="card scan-sec pp-sec"><h3>Closed today <span>${v.closed.length}</span></h3>${closedTable(v.closed)}</section>
      <section class="card scan-sec pp-sec"><h3>Last 5 days</h3>${historyTable(v.history)}</section>
    </div>`;
}

/* ------------------------------------------------------------------ wire */

$('paperTab')?.addEventListener('click', () => (state.open ? close(true) : open()));
$('chainTab')?.addEventListener('click', () => close(true));
document.addEventListener('ws', (e) => { if (e.detail !== 'paper') close(false); });

$('ppArm')?.addEventListener('click', () => post('/api/paper/arm', { armed: !(state.view?.armed) }));
$('ppExitAll')?.addEventListener('click', () => post('/api/paper/exit-all'));
$('ppRun')?.addEventListener('click', () => post('/api/paper/run'));
$('ppBody')?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-exit]');
  if (b && !b.disabled) post('/api/paper/exit', { id: b.dataset.exit });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.open) close(true);
});

/** Read-only test seam (row 18), beside window.__chart / __grid / __ltp. Nothing in the app reads it. */
window.__paper = {
  open: () => state.open,
  state: () => state.view,
  positions: () => state.view?.open ?? [],
  closed: () => state.view?.closed ?? [],
  notice: () => state.notice,
  reload: load,
};

// The page opens on whichever workspace it was last on.
try {
  if (localStorage.getItem(WS_KEY) === 'paper') queueMicrotask(open);
} catch { /* private window — open on the default workspace */ }
