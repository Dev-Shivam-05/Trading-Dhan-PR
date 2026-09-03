/* ==========================================================================
   Status rail + telemetry drawer — docs/spec/terminal-redesign-v1.md rows 12-16 (P10b)

   The P3 data in its new form. The 380px right dock is gone: a right dock is the one shape that
   trades chain width for latency, which is exactly what the P10 done-when forbids. The rail costs
   zero width and is never closable; the drawer costs height and is closed by default.

   Every element id from the old dock is carried over UNCHANGED (row 16), so this is a move rather
   than a rewrite. app.js keeps the state and pushes it here through two CustomEvents; nothing here
   is imported by anything, and this module imports nothing. Same one-directional shape as
   panes.js, scan.js and candles.js.
   ========================================================================== */

const $ = (id) => document.getElementById(id);

/* app.js owns the poll; these are the two scalars the rail's own 250 ms loop needs. */
let lastReceivedAt = 0;
let cadenceMs = 3000;

/* The 60-call window the sparkline and the percentiles are computed over, and the 20-row call
   log. Both were app.js's `state.samples` / `state.log`; they belong to whoever draws them. */
const samples = [];
const log = [];
let clientStages = { transport: null, render: null };

/* ------------------------------------------------------------------- rail */

function setBig(id, html, kind = '') {
  const el = $(id);
  el.innerHTML = html;
  el.className = 'rv mono ' + kind;
}

document.addEventListener('chain-timing', (e) => {
  lastReceivedAt = e.detail.lastReceivedAt;
  cadenceMs = e.detail.cadenceMs;
  clientStages = e.detail.clientStages;
  reclamp();
});

document.addEventListener('telemetry', (e) => {
  const s = e.detail;
  samples.push(s);
  if (samples.length > 60) samples.shift();
  log.unshift(s);
  if (log.length > 20) log.pop();

  const rtt = s.timing.roundTrip;
  setBig('mRtt', rtt === null ? '—' : `${Math.round(rtt)}<small>ms</small>`, rtt > 800 ? 'warn' : '');

  drawWaterfall();
  drawSpark();
  drawLog();
});

/* AGE, NEXT and the countdown ring tick on their own clock, not on the poll — the whole point of
   the age readout is that it keeps climbing when the poll stops arriving. */
setInterval(() => {
  if (!lastReceivedAt) return;
  const age = (Date.now() - lastReceivedAt) / 1000;
  setBig('mAge', `${age.toFixed(1)}<small>s</small>`, age > 15 ? 'crit' : age > 6 ? 'warn' : '');

  const next = Math.max(0, cadenceMs - (Date.now() - lastReceivedAt)) / 1000;
  setBig('mNext', `${next.toFixed(1)}<small>s</small>`);
  const C = 56.5;                                    // 2*pi*r for the r=9 ring in index.html
  $('ringArc').setAttribute('stroke-dashoffset', (C * (1 - next / (cadenceMs / 1000))).toFixed(1));
}, 250);

/* ----------------------------------------------------------------- drawer */
/* Row 14. The same four blocks the 380px stack held, re-laid horizontally so the call log stops
   being the only thing below the fold. Drawing into a closed drawer is wasted work but it is
   ~1 ms on a 20-row table, and skipping it would leave the drawer blank for one poll on open. */

function drawWaterfall() {
  const s = samples[samples.length - 1];
  if (!s) return;
  const t = s.timing;
  const stages = {
    server: t.server ?? 0,
    download: t.download ?? 0,
    compute: t.compute ?? 0,
    transport: clientStages.transport ?? 0,
    render: clientStages.render ?? 0,
  };
  const total = Object.values(stages).reduce((a, b) => a + b, 0) || 1;
  for (const i of $('wf').children) {
    i.style.width = `${(100 * stages[i.dataset.stage] / total).toFixed(1)}%`;
  }
  $('wfTotal').textContent = `${Math.round(total)} ms`;
  $('wfKey').innerHTML = Object.entries(stages).map(([k, v]) =>
    `<span><b style="background:var(--${k === 'server' ? 'net' : k === 'download' ? 'net' : k === 'compute' ? 'compute' : 'render'});${k === 'download' || k === 'transport' ? 'opacity:.55' : ''}"></b>${k}${k === 'transport' ? '~' : ''} ${Math.round(v)}</span>`).join('');
}

function drawSpark() {
  const svg = $('spark');
  const vals = samples.filter(s => s.ok && s.timing.roundTrip !== null).map(s => s.timing.roundTrip);
  if (vals.length < 2) {
    svg.innerHTML = `<text x="150" y="30" text-anchor="middle" fill="var(--fg-faint)"
      font-family="IBM Plex Mono, monospace" font-size="10">collecting — ${vals.length} of 2 calls</text>`;
    return;
  }
  const W = 300, H = 54;
  const mn = Math.min(...vals), mx = Math.max(...vals), range = Math.max(mx - mn, 1);
  const sorted = [...vals].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? mx;
  const X = (i) => (i / (vals.length - 1)) * W;
  const Y = (v) => H - 4 - ((v - mn) / range) * (H - 11);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  svg.innerHTML =
    `<path d="${line} L${W} ${H} L0 ${H} Z" fill="var(--accent)" fill-opacity=".10"/>` +
    `<line x1="0" y1="${Y(p50).toFixed(1)}" x2="${W}" y2="${Y(p50).toFixed(1)}" stroke="var(--fg-faint)" stroke-width="1" stroke-dasharray="2 3"/>` +
    `<line x1="0" y1="${Y(p95).toFixed(1)}" x2="${W}" y2="${Y(p95).toFixed(1)}" stroke="var(--warn)" stroke-width="1" stroke-dasharray="2 3"/>` +
    `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="${X(vals.length - 1).toFixed(1)}" cy="${Y(vals[vals.length - 1]).toFixed(1)}" r="2.6" fill="var(--accent)"/>`;

  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  $('p50').textContent = Math.round(q(0.5));
  $('p90').textContent = Math.round(q(0.9));
  $('p99').textContent = Math.round(q(0.99));
  $('pmx').textContent = Math.round(sorted[sorted.length - 1]);
  const ok = samples.filter(s => s.ok).length;
  $('okRate').textContent = `${Math.round(100 * ok / samples.length)}%`;
}

function drawLog() {
  $('logBody').innerHTML = log.map(s => {
    const t = new Date(s.at).toLocaleTimeString('en-IN', { hour12: false });
    return `<tr><td>${t}</td><td>${s.instrument}</td>`
      + `<td class="${s.ok ? 'ok' : 'bad'}">${s.ok ? (s.httpStatus ?? 200) : (s.errorCode ?? 'ERR')}</td>`
      + `<td>${s.timing.roundTrip === null ? '—' : Math.round(s.timing.roundTrip)}</td>`
      + `<td>${(s.bytes / 1024).toFixed(0)}</td><td>${s.strikes || '—'}</td></tr>`;
  }).join('');
}

/* ------------------------------------------------- open / close and resize */
/* Row 4's drawer half: default 240px, min 140, max 60% of the shell, key `pane:telemetry`,
   closed by default. Splitter #2 lives here rather than in panes.js so that P10b stays at the
   five files row 21 costed; the drawer's own size is the drawer's business. */

/* `hardMin` is not in the spec table. It exists because rows 4's three minimums are geometrically
   impossible together at 1024x800: the chrome wraps taller there, so even with the chart at its
   own 70px floor the shell has ~449px for a 140px chart pane, a 140px drawer and a 200px chain,
   which needs 480. One of them has to yield and on a trading screen it is not the chain — so the
   drawer compresses below its 140, down to 88, and each column scrolls. Amendment row 25. */
const DRAWER = { def: 240, min: 140, hardMin: 88, key: 'pane:telemetry' };
const CHAIN_MIN = 200;                             // row 4, the same floor panes.js enforces
const shellH = () => $('shell').getBoundingClientRect().height;

/**
 * Row 4's ceilings for the drawer: 60% of the shell, and whatever still leaves the chain 200px
 * AFTER the chart pane has taken its share. Measuring the shell alone is not enough — the chart
 * sits between them, and without subtracting it the drawer squeezed the chain to 114px at
 * 1440x900, which is what the first P10b run measured.
 */
function clampDrawer(h) {
  const grip = $('drawerGrip').getBoundingClientRect().height;   // 5px open, 0 while hidden
  const room = () => shellH() - $('chartWrap').getBoundingClientRect().height - grip - CHAIN_MIN;

  /* On a short viewport the three minimums cannot all be met at once — 1440x800 leaves about
     390px for a 190px chart, a 140px drawer and a 200px chain. Squeezing the chain is the wrong
     answer on a trading screen (the first run of this measured a 59px chain at 1024x800), so the
     chart yields first, down to its own 70px minimum. panes.js owns the chart height, so it is
     asked rather than reached into; the detail object carries the answer back. */
  let max = Math.min(shellH() * 0.6, room());
  if (max < DRAWER.min) {
    const req = { need: DRAWER.min - max, freed: 0 };
    document.dispatchEvent(new CustomEvent('pane-need-room', { detail: req }));
    max = Math.min(shellH() * 0.6, room());
  }
  // Even with the chart at its floor the drawer may not fit its 140. The chain's 200 is the hard
  // floor, so the drawer takes what is left, down to hardMin.
  const lo = max >= DRAWER.min ? DRAWER.min : Math.max(DRAWER.hardMin, Math.min(DRAWER.min, max));
  return Math.max(lo, Math.min(h, Math.max(lo, max)));
}

function setDrawerH(h) {
  $('drawer').style.height = `${clampDrawer(h)}px`;
  document.dispatchEvent(new CustomEvent('pane-resize'));
}

{
  const saved = Number(localStorage.getItem(DRAWER.key));
  $('drawer').style.height = `${Number.isFinite(saved) && saved ? Math.max(DRAWER.min, saved) : DRAWER.def}px`;
}

function setDrawer(open) {
  $('drawer').hidden = !open;
  $('drawerGrip').hidden = !open;
  $('panelBtn').setAttribute('aria-pressed', String(open));
  localStorage.setItem('panel', open ? '1' : '0');
  if (open) {
    setDrawerH($('drawer').getBoundingClientRect().height || DRAWER.def);
  } else {
    document.dispatchEvent(new CustomEvent('pane-release-room'));
    document.dispatchEvent(new CustomEvent('pane-resize'));
  }
}

/**
 * The chrome above the shell is not at its final height when this module first runs — the chips
 * and the header strip fill in after `/api/instruments` resolves, and the replay banner wraps.
 * Sizing the drawer once at load therefore measures a layout that does not exist yet: at
 * 1440x800 that produced a 145px drawer and a 110px chain, where the settled numbers are 140
 * and exactly 200. So re-clamp whenever the layout can have changed.
 */
let inReclamp = false;
function reclamp() {
  if (inReclamp || $('drawer').hidden) return;
  inReclamp = true;
  try {
    const cur = $('drawer').getBoundingClientRect().height;
    const want = clampDrawer(cur);
    if (Math.abs(want - cur) < 0.5) return;        // already right — do not churn the layout
    $('drawer').style.height = `${want}px`;
    document.dispatchEvent(new CustomEvent('pane-resize'));
  } finally {
    inReclamp = false;
  }
}
window.addEventListener('resize', reclamp);

/* `chain-timing` is not enough on its own: the market is shut for almost every session on this
   project, so the poller emits ONE snapshot and the layout finishes settling after it — webfonts
   land, the chips fill in, and the chart header wraps from one line to two. That left a 140px
   drawer and a 166px chain at 1024x800, on about half of runs.
 *
 * Both elements have to be watched, and #shell alone is the trap: it is flex:1 of the body, so
 * when the chart header wraps the chart pane grows and the shell's own height does not change at
 * all. Watching the chart pane is what actually catches it. The loop this could form converges
 * and then stops firing — the chart bottoms out at its 70px floor and reclamp early-returns once
 * the drawer is already the right size — and `inReclamp` is the belt to that braces. */
if (window.ResizeObserver) {
  const ro = new ResizeObserver(reclamp);
  ro.observe($('shell'));
  ro.observe($('chartWrap'));
}

$('panelBtn').addEventListener('click', () => setDrawer($('drawer').hidden));
setDrawer(localStorage.getItem('panel') === '1');      // row 14 — closed by default

{
  const split = $('drawerGrip');
  let dragging = false, startY = 0, startH = 0;
  const persist = () =>
    localStorage.setItem(DRAWER.key, String(Math.round($('drawer').getBoundingClientRect().height)));

  split.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    startH = $('drawer').getBoundingClientRect().height;
    split.classList.add('dragging');
    split.setPointerCapture(e.pointerId);
  });
  // dragging the drawer's top edge upward makes it TALLER, so the sign is inverted here
  split.addEventListener('pointermove', (e) => {
    if (dragging) setDrawerH(startH - (e.clientY - startY));
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    split.classList.remove('dragging');
    if (split.hasPointerCapture(e.pointerId)) split.releasePointerCapture(e.pointerId);
    persist();
  };
  split.addEventListener('pointerup', endDrag);
  split.addEventListener('pointercancel', endDrag);
  split.addEventListener('dblclick', () => { setDrawerH(DRAWER.def); persist(); });
  split.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = (e.shiftKey ? 32 : 8) * (e.key === 'ArrowUp' ? 1 : -1);
    setDrawerH($('drawer').getBoundingClientRect().height + step);
    persist();
  });
}

/* Read-only seam for the replay verification scripts. Nothing in the app reads it. */
window.__telemetry = {
  open: () => !$('drawer').hidden,
  samples: () => samples.length,
  /** The exact round-trip values the panel's percentiles are computed over, so a verification
   *  script can recompute them independently instead of racing the server's growing ring. */
  rtts: () => samples.filter(s => s.ok && s.timing.roundTrip !== null).map(s => s.timing.roundTrip),
  logRows: () => log.length,
};
