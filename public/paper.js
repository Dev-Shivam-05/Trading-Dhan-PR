/**
 * The Paper workspace — `docs/spec/paper-trading-v1.md` rows 10, 11, 15, 16, 18, with P33's
 * opening-range breakout (`docs/spec/orb-strategy-v1.md` row 12): a Waiting-for-break table, and
 * an Open table that shows each future's range, SMA9 and closes-against count, its option leg under it.
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
  /** phone-sandbox-v1.md P41 row 7: the sandbox's own state, read from /api/sandbox. */
  sb: { dates: null, view: null, busy: false, notice: null },
  /** index-paper-v1.md (P53): the NIFTY index book, read from /api/index-paper. */
  ix: { view: null, error: null, busy: false },
  /** backtest-panel-v1.md (P38): the three nightly reports, read every 60 s. */
  bt: { view: null, error: null, at: 0 },
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

const REASON = {
  sma: '2 closes against SMA9', eod: '15:15 square-off', manual: 'Exited by hand',
  stale: 'Stale — closed at boot', target: 'Target', stop: 'Stop',
};

/** `FUT 2026-09-29` or `1560 CE 2026-09-29`. A P32 row has no `leg` and is a future. */
const contractLabel = (p) => (p.leg === 'option'
  ? `${num(p.strike, p.strike % 1 ? 2 : 0)} ${p.optionType} ${p.expiry}` : `FUT ${p.expiry}`);

/** Option legs sit directly under their future (row 12). */
function grouped(rows) {
  const futs = rows.filter((p) => p.leg !== 'option');
  const out = [];
  for (const f of futs) out.push(f, ...rows.filter((o) => o.parentId === f.id));
  // An option whose future is no longer live (it exited first) still has to be seen.
  for (const o of rows) if (o.leg === 'option' && !out.includes(o)) out.push(o);
  return out;
}

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
  // Announce FIRST, then save and mark the tabs: the scanner's close() writes `ws=chain` and sets
  // the Option chain tab selected. Doing either before the announcement let it overwrite ours —
  // the workspace never survived a reload, and two tabs read as selected (seen in the screenshot).
  document.dispatchEvent(new CustomEvent('ws', { detail: 'paper' }));
  saveWs('paper');
  setTabs();
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
  loadSandbox();
  loadIndex();
  if (Date.now() - state.bt.at > 60_000) loadBacktest();   // row 6
}

/* ---------------------------------------------------------------- the backtest panel (P38) */

async function loadBacktest() {
  state.bt.at = Date.now();
  try {
    const res = await fetch('/api/backtest');
    if (res.status === 404) throw new Error('this server predates the panel — restart it to see the reports');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.bt.view = await res.json();
    state.bt.error = null;
  } catch (e) {
    state.bt.error = e.message ?? String(e);
  }
  renderBacktest();
}

const inr0 = (v) => (typeof v === 'number' && Number.isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('en-IN') : '—');

function renderBacktest() {
  const body = $('btBody');
  if (!body) return;
  const v = state.bt.view;
  if (!v) { body.innerHTML = `<p class="scan-none">${esc(state.bt.error ?? 'Loading…')}</p>`; return; }
  const r = v.report, t = v.train, sh = v.shadow;
  const row = (name, x) => x ? `<tr><td class="l">${esc(name)}</td><td>${int(x.sessions)}</td><td>${int(x.trades)}</td><td>${num(x.winPct, 1)}%</td>
    <td class="${dirClass(x.gross)}">${inr0(x.gross)}</td><td>${inr0(x.maxDrawdown)}</td><td class="l">${x.worstDay ? `${esc(x.worstDay.date)} ${inr0(x.worstDay.pnl)}` : '—'}</td></tr>` : '';
  const p37 = !r ? '<p class="scan-none">The nightly backtest has not run yet (<code>npm run backtest</code>, or the server at 16:00).</p>' : `
    <p class="pp-hint">P37, run ${esc((r.ranAt ?? '').slice(0, 16).replace('T', ' '))} UTC, window ${int(r.window.sessions)} sessions (${int(r.window.real)} with a real 09:20 scan, ${int(r.window.proxy)} proxy) to ${esc(r.lastDay)}. Current settings: top ${esc(r.params?.topN)}, SMA${esc(r.params?.sma)}, ${esc(r.params?.closes)} closes against, ${esc(r.params?.rangeBars)} range bars. Gross, before charges.</p>
    <table class="scan-t pp-t"><thead><tr><th class="l">Current settings</th><th>Sessions</th><th>Trades</th><th>Win</th><th>Gross ₹</th><th>Max DD ₹</th><th class="l">Worst day</th></tr></thead>
      <tbody>${row('All days', r.all)}${row('Real 09:20 scan days', r.real)}${row('Proxy days', r.proxy)}</tbody></table>
    <p class="pp-hint">Walk-forward held-out ₹${inr0(r.walkForward?.heldOut)} against the current settings' ₹${inr0(r.walkForward?.current)}. Best cell now: ${esc(r.walkForward?.bestNow?.key ?? '—')} (₹${inr0(r.walkForward?.bestNow?.gross)}).</p>
    <details class="pp-nt"><summary>Per day (${r.perDay.length})</summary><table class="scan-t pp-t"><thead><tr><th class="l">Date</th><th class="l">Scan</th><th>Signals</th><th>Trades</th><th>Gross ₹</th></tr></thead><tbody>${
      r.perDay.map((d) => `<tr><td class="l">${esc(d.date)}</td><td class="l">${esc(d.kind)}</td><td>${int(d.signals)}</td><td>${int(d.trades)}</td><td class="${dirClass(d.gross)}">${inr0(d.gross)}</td></tr>`).join('')
    }</tbody></table></details>
    <details class="pp-nt"><summary>Calibration: live fill vs model fill (${r.calibration.length})</summary><table class="scan-t pp-t"><thead><tr><th class="l">Date</th><th class="l">Symbol</th><th class="l">Side</th><th>Live</th><th>Model</th><th>Diff</th></tr></thead><tbody>${
      r.calibration.map((c) => `<tr><td class="l">${esc(c.date)}</td><td class="l">${esc(c.symbol)}</td><td class="l">${esc(c.side)}</td><td>${num(c.live)}</td><td>${num(c.model)}</td><td>${num(c.diff)}</td></tr>`).join('')
    }</tbody></table></details>`;
  const pick = (name, x) => x ? `<tr><td class="l">${esc(name)} <span class="pp-sub">${esc(x.key)}</span></td><td>${int(x.trades)}</td><td>${num(x.winPct, 1)}%</td>
    <td class="${dirClass(x.net)}">${inr0(x.net)}</td><td>${inr0(x.netPerTrade)}</td><td>${inr0(x.firstHalf)} / ${inr0(x.secondHalf)}</td></tr>` : '';
  const p44 = !t ? '<p class="scan-none">P44 has not been run (<code>npm run train</code>).</p>' : `
    <p class="pp-hint">P44, ${esc(t.sessions)} sessions × ${esc(t.stocks)} stocks. <b>A recommendation, not a change:</b> ${esc(t.recommendation?.key ?? 'none')}${t.recommendation?.why ? ` — ${esc(t.recommendation.why)}` : ''}.</p>
    <table class="scan-t pp-t"><thead><tr><th class="l">Level fills, net of costs</th><th>Trades</th><th>Win</th><th>Net ₹</th><th>Per trade ₹</th><th>Halves ₹</th></tr></thead>
      <tbody>${pick('Baseline (live rules minus OI)', t.baseline)}${pick('Recommended', t.recommended)}</tbody></table>
    <p class="pp-hint">Walk-forward held-out: level ₹${inr0(t.walkForward?.heldOut)} vs baseline ₹${inr0(t.walkForward?.baseline)} · late fills ₹${inr0(t.late1m?.walkForward?.heldOut)} vs ₹${inr0(t.late1m?.walkForward?.baseline)}.</p>`;
  const p45 = !sh.sessions.length
    ? `<p class="pp-hint">Shadow (P45): the recommended setting on days it has never seen. First forward session: Mon 28 Sep, after 16:00.</p>`
    : `<table class="scan-t pp-t"><thead><tr><th class="l">Shadow since ${esc(sh.after)} (P45)</th><th class="l">Fill</th><th>Sessions</th><th>Trades</th><th>Net ₹</th></tr></thead><tbody>${
      sh.rows.map((x) => `<tr><td class="l">${esc(x.label)}</td><td class="l">${esc(x.fill)}</td><td>${int(x.days.length)}</td><td>${int(x.trades)}</td><td class="${dirClass(x.net)}">${inr0(x.net)}</td></tr>`).join('')
    }</tbody></table>`;
  body.innerHTML = p37 + p44 + p45;
}

/* ---------------------------------------------------------------- the index book (P53) */

async function loadIndex() {
  try {
    const res = await fetch('/api/index-paper');
    // A server started before P53 has no such route; public/ is read per request, so this file can reach it first.
    if (res.status === 404) throw new Error('this server predates the index book — restart it to start the book');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.ix.view = await res.json();
    state.ix.error = null;
  } catch (e) {
    state.ix.error = e.message ?? String(e);
  }
  renderIndex();
}

async function ixPost(path, body = {}) {
  if (state.ix.busy) return;
  state.ix.busy = true;
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) state.ix.view = await res.json();
  } finally {
    state.ix.busy = false;
    renderIndex();
  }
}

const IX_REASON = { target: 'Target', stop: 'Stop', time: '14:30 time exit', state: 'Scenario turned against', manual: 'Squared off by hand' };
const IX_OUTCOME = {
  accepted: 'traded', used: 'second touch', window: 'outside the window', side: 'scenario forbids this side',
  'no-stop': 'no stop line', 'stop-on-entry': 'stop on the entry', target: 'no target', ratio: 'stop wider than target',
  iv: 'IV gate', busy: 'book already open', 'no-price': 'no option price', disarmed: 'disarmed',
};

function renderIndex() {
  const body = $('ixBody');
  if (!body) return;
  const v = state.ix.view;
  if (!v) {
    $('ixStatus').textContent = state.ix.error ? `Not reachable: ${state.ix.error}` : 'Loading…';
    body.innerHTML = '';
    return;
  }
  const armBtn = $('ixArm');
  armBtn.setAttribute('aria-pressed', String(v.armed));
  armBtn.textContent = v.armed ? 'Armed' : 'Disarmed';
  armBtn.title = v.armed ? 'Disarm: no new index trades; open ones run to their exit.' : 'Arm: trade the next first touch of a drawn line.';
  armBtn.disabled = state.ix.busy;
  const open = v.positions.filter((p) => p.status === 'open');
  $('ixExitAll').disabled = state.ix.busy || !open.length;
  $('ixStatus').textContent = v.holding
    ? `Watching the NIFTY chain · ${v.minutes} minute${v.minutes === 1 ? '' : 's'} built today${v.verdict ? ` · ${v.verdict}` : ''}`
    : `Idle until 09:14 on the next trading day · ${v.mode === 'replay' ? 'REPLAY' : 'LIVE'}`;

  const lines = v.lines920
    ? `<table class="scan-t pp-t"><thead><tr><th class="l">920 line</th><th>Level</th><th class="l">Buy</th><th class="l">Note</th></tr></thead><tbody>${
      v.lines920.map((l) => `<tr><td class="l">${esc(l.name)}</td><td>${num(l.value)}</td><td class="l">${l.name.startsWith('EOR') ? 'PE' : 'CE'}</td><td class="l">${l.missing ? `missing (${esc(l.missing)})` : ''}</td></tr>`).join('')
    }</tbody></table><p class="pp-hint">Gap width ${num(v.gapWidth)} points (V117 found gaps over 100 lose on NIFTY).</p>`
    : '<p class="scan-none">The 920 lines are drawn at 09:21 from the 09:20 chain.</p>';
  const drawn = v.drawn.length
    ? `<p class="pp-hint">Drawn now: ${v.drawn.map((d) => `${esc(d.book === '920' ? '920' : 'AI')} ${esc(d.line)} ${num(d.level)}${d.permitted ? '' : ' (side not permitted)'}`).join(' · ')}</p>` : '';
  const pos = v.positions.length
    ? `<table class="scan-t pp-t"><thead><tr><th class="l">Book</th><th class="l">Line</th><th class="l">Option</th><th>Lots</th><th>Entry</th><th>Now / exit</th><th class="l">Status</th><th>Net ₹</th></tr></thead><tbody>${
      v.positions.map((p) => `<tr><td class="l">${esc(p.book === '920' ? '920' : 'AI')}</td><td class="l">${esc(p.line)} <span class="pp-sub">${hms(p.entryAt)}</span></td>
        <td class="l">${num(p.strike, 0)} ${esc(p.buy)}${p.fill === 'chain' ? ' <span class="pp-sub">chain fill</span>' : ''}</td><td>${int(p.lots)}${p.overBudget ? ' ⚠' : ''}</td>
        <td>${num(p.entryPx)}</td><td>${num(p.status === 'open' ? p.ltp : p.exitPx)}</td>
        <td class="l">${p.status === 'open' ? `open · stop ${num(p.stop)} · target ${num(p.target)}` : esc(IX_REASON[p.reason] ?? p.reason)}${p.blind ? ' · <b>blind</b>' : ''}</td>
        <td class="${dirClass(p.net)}">${p.net === null ? '—' : signed(p.net)}</td></tr>`).join('')
    }</tbody></table><p class="pp-hint">Today: ${int(v.totals.trades)} trade(s), gross ${signed(v.totals.gross)}, costs ${num(v.totals.cost)}, net ${signed(v.totals.net)}.</p>`
    : '<p class="scan-none">No index trade today.</p>';
  // Most touches land after the entry window; listing them one by one buries the ones that decided something.
  const late = v.touches.filter((t) => t.outcome === 'window');
  const told = v.touches.filter((t) => t.outcome !== 'window');
  const touches = v.touches.length
    ? `<details class="pp-nt"><summary>Touches today (${v.touches.length})</summary><ul>${
      told.map((t) => `<li>${esc(t.hm)} <b>${esc(t.book === '920' ? '920' : 'AI')} ${esc(t.line)}</b> at ${num(t.level)} — ${esc(IX_OUTCOME[t.outcome] ?? t.outcome)}</li>`).join('')
    }${late.length ? `<li>${late.length} more after the entry window (920 until 11:29, AI until 14:29), not traded</li>` : ''}</ul></details>` : '';
  const hist = v.history.length
    ? `<p class="pp-hint">Earlier: ${v.history.map((h) => `${esc(h.date)} ${int(h.trades)} trade(s) ${signed(h.net)}`).join(' · ')}</p>` : '';
  body.innerHTML = lines + drawn + pos + touches + hist;
}

/* ---------------------------------------------------------------- sandbox (P41) */

async function loadSandbox() {
  try {
    if (!state.sb.dates) {
      const d = await fetch('/api/sandbox/dates').then((r) => r.json());
      state.sb.dates = d.dates ?? [];
      const sel = $('sbDate');
      if (sel) {
        sel.innerHTML = state.sb.dates.length
          ? state.sb.dates.map((x) => `<option value="${esc(x.date)}">${esc(x.date)} · ${x.source === 'recorded' ? 'recorded ticks' : 'from 1-min candles'}</option>`).join('')
          : '<option value="">no day available yet</option>';
      }
    }
    state.sb.view = await fetch('/api/sandbox').then((r) => r.json());
  } catch (e) {
    state.sb.notice = `sandbox: could not reach the backend — ${e.message ?? e}`;
  }
  renderSandbox();
}

async function sbPost(path, body) {
  if (state.sb.busy) return;
  state.sb.busy = true;
  renderSandbox();
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) state.sb.notice = out.error ?? `HTTP ${res.status}`;
    else { state.sb.view = out; state.sb.notice = null; }
  } catch (e) {
    state.sb.notice = `sandbox: could not reach the backend — ${e.message ?? e}`;
  }
  state.sb.busy = false;
  renderSandbox();
}

const sbRules = () => Object.fromEntries([...document.querySelectorAll('#ppSandbox [data-rule]')].map((i) => [i.dataset.rule, i.checked]));

function renderSandbox() {
  const out = $('sbBody');
  if (!out) return;
  const run = state.sb.view?.run ?? null;
  const v = state.sb.view?.view ?? null;
  const live = run && (run.status === 'running' || run.status === 'paused');
  $('sbStart').disabled = state.sb.busy || !$('sbDate')?.value;
  $('sbStart').textContent = state.sb.busy ? 'Loading day…' : live ? 'Restart' : 'Start';
  $('sbPause').disabled = !live || state.sb.busy;
  $('sbPause').textContent = run?.status === 'paused' ? 'Resume' : 'Pause';
  $('sbStop').disabled = !live || state.sb.busy;
  const st = $('sbStatus');
  if (!run) st.textContent = state.sb.notice ?? 'No sandbox run yet. Pick a day and press Start.';
  else {
    const rules = Object.entries(run.rules).filter(([, on]) => on).map(([k]) => k).join(', ') || 'none (as live)';
    const pct = run.total ? Math.round((run.delivered / run.total) * 100) : 0;
    st.textContent = `${run.date} · ${run.source === 'recorded' ? 'recorded ticks' : 'synthetic ticks from 1-min candles'} · ${run.scanKind} 09:20 scan · sandbox clock ${hms(run.simNow)} · ${int(run.delivered)} of ${int(run.total)} ticks (${pct}%) · ${run.status}${run.speed ? ` at ${run.speed}×` : ' at max speed'} · rules: ${rules}${run.error ? ` · ${run.error}` : ''}${state.sb.notice ? ` · ${state.sb.notice}` : ''}`;
  }
  st.classList.toggle('bad', !!(run?.error || state.sb.notice));
  if (!v) { out.innerHTML = ''; return; }
  const pnl = v.dayPnl.total;
  out.innerHTML = `<div class="sb-sub">Sandbox P&amp;L <b class="${dirClass(pnl)}">${signed(pnl)}</b> · realised ${signed(v.dayPnl.realised)} · open ${signed(v.dayPnl.unrealised)} · ${esc(v.status)}</div>
    ${waitingTable(v.waiting ?? [], true)}${v.open.length ? openTable(v.open, true) : ''}${closedTable(v.closed)}`;
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

/** `readOnly` for the sandbox: a Cancel there would post a sandbox id to the LIVE trader's exit route. */
function waitingTable(rows, readOnly = false) {
  if (!rows.length) return '';
  const body = rows.map((p) => `<tr data-id="${esc(p.id)}" class="pending">
      <td class="l"><b>${esc(p.symbol)}</b><span class="nm">${esc(contractLabel(p))}</span></td>
      ${sideCell(p.side)}
      <td>${num(p.range?.high)}</td>
      <td>${num(p.range?.low)}</td>
      <td>${num(p.ltp)}</td>
      <td class="l dim">${p.range
        ? `waiting for a ${p.side === 'BUY' ? 'break above' : 'break below'} ${num(p.side === 'BUY' ? p.range.high : p.range.low)}`
        : esc(p.rangeNote ?? 'range forms from the 09:15 and 09:20 candles')}</td>
      <td>${readOnly ? '' : `<button class="tog pp-exit" type="button" data-exit="${esc(p.id)}" ${state.busy ? 'disabled' : ''}>Cancel</button>`}</td>
    </tr>`).join('');
  return `<section class="card scan-sec pp-sec"><h3>Waiting for break <span>${rows.length}</span></h3>
    <table class="scan-t pp-t">
    <colgroup><col style="width:17%"><col style="width:8%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col><col style="width:9%"></colgroup>
    <thead><tr><th class="l">Symbol</th><th class="l">Side</th><th>Range high</th><th>Range low</th><th>LTP</th>
      <th class="l">Waiting for</th><th></th></tr></thead>
    <tbody>${body}</tbody></table></section>`;
}

/** `readOnly` for the sandbox: its positions are not the live trader's, so no Exit button. */
function openTable(rows, readOnly = false) {
  if (!rows.length) return '<p class="scan-none">No open positions.</p>';
  const body = grouped(rows).map((p) => {
    const pending = p.status === 'pending';
    const opt = p.leg === 'option';
    // An option leg is always a BOUGHT option, whichever way its signal points.
    const side = opt ? '<td class="l"><span class="pp-side buy">BUY</span></td>' : sideCell(p.side);
    const rng = !opt && p.range ? `${num(p.range.high)} – ${num(p.range.low)}` : '';
    // phone-sandbox-v1.md P42: the stop and target when a rule set them, and any flag on the signal.
    const risk = !opt && (p.stopPx != null || p.targetPx != null)
      ? `<br><span class="pp-wait">${p.stopPx != null ? `SL ${num(p.stopPx)}` : ''}${p.stopPx != null && p.targetPx != null ? ' · ' : ''}${p.targetPx != null ? `T ${num(p.targetPx)}` : ''}</span>` : '';
    const flag = p.flags?.length ? `<span class="pp-flag" title="${esc(p.flags.join(' · '))}">⚑</span>` : '';
    const against = !opt && typeof p.against === 'number'
      ? `<span class="pp-ag${p.against ? ' warn' : ''}">${p.against} / 2</span>` : '';
    return `<tr data-id="${esc(p.id)}" class="${pending ? 'pending' : ''}${opt ? ' pp-leg' : ''}">
      <td class="l">${opt ? '' : `<b>${esc(p.symbol)}</b>${flag}`}<span class="nm">${esc(contractLabel(p))}</span></td>
      ${side}
      <td>${int(p.qty)}</td>
      <td>${pending ? '<span class="pp-wait">first tick…</span>' : num(p.entryPx)}</td>
      <td>${num(p.ltp)}</td>
      <td class="dim">${rng}${risk}</td>
      <td class="dim">${opt ? '' : num(p.sma9)}</td>
      <td>${against}${p.awaiting
        // sleep-proof-v1.md rows 1-2: blind through a gap, so no tick may close it until candles price it.
        // On its own line and short: inline, the sentence was clipped and squeezed Entry/LTP at 1024.
        ? `<br><span class="pp-wait" title="${esc(`asleep ${hms(p.awaiting.from).slice(0, 5)}–${hms(p.awaiting.to).slice(0, 5)} · ${p.awaiting.dueAt ? `due ${hms(p.awaiting.dueAt)} (${p.awaiting.reason})` : 'working out what came due'}`)}">awaiting price</span>`
        : p.exitDue ? '<span class="pp-wait"> exit at next tick</span>' : ''}</td>
      <td class="${dirClass(p.pnl)}">${signed(p.pnl)}</td>
      <td class="${dirClass(p.pnlPct)}">${p.pnlPct === null ? '—' : signed(p.pnlPct) + '%'}</td>
      <td>${readOnly ? '' : `<button class="tog pp-exit" type="button" data-exit="${esc(p.id)}"
        ${state.busy ? 'disabled' : ''}>${pending ? 'Cancel' : 'Exit'}</button>`}</td>
    </tr>`;
  }).join('');
  return `<table class="scan-t pp-t">
    <colgroup><col style="width:15%"><col style="width:7%"><col style="width:6%"><col><col><col style="width:15%"><col>
      <col style="width:12%"><col style="width:9%"><col style="width:7%"><col style="width:8%"></colgroup>
    <thead><tr><th class="l">Symbol</th><th class="l">Side</th><th>Qty</th><th>Entry</th><th>LTP</th>
      <th>Range H – L</th><th>SMA9</th><th>Closes against</th><th>P&amp;L ₹</th><th>P&amp;L %</th><th></th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

function closedTable(rows) {
  if (!rows.length) return '<p class="scan-none">Nothing closed today.</p>';
  const body = rows.map((p) => `<tr data-id="${esc(p.id)}">
      <td class="l"><b>${esc(p.symbol)}</b><span class="nm">${p.leg === 'option' ? esc(`${p.strike} ${p.optionType}`) + ' · ' : ''}${hms(p.exitAt ?? p.createdAt)}</span></td>
      ${p.leg === 'option' ? '<td class="l"><span class="pp-side buy">BUY</span></td>' : sideCell(p.side)}
      <td>${num(p.entryPx)}</td>
      <td>${num(p.exitPx)}</td>
      <td class="l dim" title="${esc(p.note ?? '')}">${p.status === 'unfilled' ? `Not filled — ${esc(p.note)}` : esc(REASON[p.reason] ?? p.reason)}${p.repriced ? ' · repriced' : ''}</td>
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
    <colgroup><col style="width:36%"><col style="width:18%"><col style="width:16%"><col style="width:30%"></colgroup>
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
    ? 'Disarm: no new trades. Positions already open stay open until their exit rule, 15:15 or Exit.'
    : 'Arm: the server scans NSE at 09:20 IST, reads the 09:15-09:25 range, and paper-trades each break until 15:00.';
  armBtn.disabled = state.busy;
  const live = v.open.length + (v.waiting?.length ?? 0);
  $('ppExitAll').disabled = state.busy || live === 0;
  const run = $('ppRun');
  run.hidden = !v.canRunNow;
  run.disabled = state.busy || live > 0;
  run.title = live > 0 ? 'Square off first — positions are still pending or open'
    : `Replay only: run the scan now, with the engine clock set to ${v.rules.strategy === 'orb-sma9' ? '09:25:00' : '09:20:00'}`;
  $('ppMode').textContent = v.mode === 'replay' ? 'REPLAY' : 'LIVE';
  $('ppMode').className = `statechip ${v.mode === 'replay' ? 'warn' : 'flat'}`;

  const r = v.rules;
  $('ppRules').textContent = r.strategy === 'orb-sma9'
    ? `Scan ${r.scanAt} · range = high / low of the ${r.rangeFrom} and 09:20 candles · enter on a break ${r.rangeReady}–${r.entryUntil} · exit on ${r.exitCloses} closes against SMA${r.smaPeriod} (5 min) or ${r.squareOffAt} · ${r.legs}, ${r.size} each · max ${r.maxPositions} signals · P&L is gross, before charges`
    // A server started before P33 still runs P32's rules; public/ is read per request, so this
    // file reaches it first.
    : `Scan ${r.scanAt} · entries until ${r.entryUntil} · stop ${r.stopPct}% · target ${r.targetPct}% · ${r.size} · max ${r.maxPositions} a day · square-off ${r.squareOffAt} · P&L is gross, before charges`;

  const notice = state.notice ? `<div class="pp-notice" role="alert">${esc(state.notice)}</div>` : '';
  const disarmedOpen = !v.armed && v.open.length
    ? `<p class="pp-hint">Disarmed. The ${v.open.length} position${v.open.length === 1 ? '' : 's'} below stay open until their exit rule, 15:15 or Exit.</p>` : '';

  body.innerHTML = `${notice}${disarmedOpen}${waitingTable(v.waiting ?? [])}
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
$('ixArm')?.addEventListener('click', () => ixPost('/api/index-paper/arm', { armed: !(state.ix.view?.armed) }));
$('ixExitAll')?.addEventListener('click', () => ixPost('/api/index-paper/exit-all'));
$('ppBody')?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-exit]');
  if (b && !b.disabled) post('/api/paper/exit', { id: b.dataset.exit });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.open) close(true);
});

$('sbStart')?.addEventListener('click', () => sbPost('/api/sandbox/start', { date: $('sbDate').value, speed: Number($('sbSpeed').value), rules: sbRules() }));
$('sbPause')?.addEventListener('click', () => sbPost('/api/sandbox/control', { action: state.sb.view?.run?.status === 'paused' ? 'resume' : 'pause', speed: null }));
$('sbStop')?.addEventListener('click', () => sbPost('/api/sandbox/control', { action: 'stop', speed: null }));
$('sbSpeed')?.addEventListener('change', () => {
  const r = state.sb.view?.run;
  if (r && (r.status === 'running' || r.status === 'paused')) sbPost('/api/sandbox/control', { action: 'speed', speed: Number($('sbSpeed').value) });
});

/** Read-only test seam (row 18), beside window.__chart / __grid / __ltp. Nothing in the app reads it. */
window.__paper = {
  open: () => state.open,
  state: () => state.view,
  positions: () => state.view?.open ?? [],
  waiting: () => state.view?.waiting ?? [],
  closed: () => state.view?.closed ?? [],
  notice: () => state.notice,
  sandbox: () => state.sb.view,
  index: () => state.ix.view,
  backtest: () => state.bt.view,
  reload: load,
};

// The page opens on whichever workspace it was last on.
try {
  if (localStorage.getItem(WS_KEY) === 'paper') queueMicrotask(open);
} catch { /* private window — open on the default workspace */ }
