/* Dhan Option Chain Terminal — client.
   Talks only to the local backend. Never sees a Dhan credential. */

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------- formatting */
/* Locked in docs/spec/option-chain-v1.md row 13. */

const trimZeros = (s) => s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');

/** Indian abbreviation: <1e3 raw, <1e5 K, <1e7 L, >=1e7 Cr. */
function abbr(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e7) return sign + trimZeros((a / 1e7).toFixed(2)) + ' Cr';
  if (a >= 1e5) return sign + trimZeros((a / 1e5).toFixed(2)) + ' L';
  if (a >= 1e3) return sign + trimZeros((a / 1e3).toFixed(2)) + ' K';
  return sign + trimZeros(a.toFixed(2));
}

function fx(v, d) {
  return (v === null || v === undefined || !Number.isFinite(v)) ? '—' : v.toFixed(d);
}

/** Indian digit grouping: 24,078.30 / 1,63,940.00 */
function inr(v, d = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const parts = Math.abs(v).toFixed(d).split('.');
  let int = parts[0];
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  int = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return sign + int + (parts[1] !== undefined ? '.' + parts[1] : '');
}

function pctText(v) {
  return (v === null || v === undefined || !Number.isFinite(v)) ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}

const cls = (v) => (v === null || v === undefined || !Number.isFinite(v)) ? 'dim' : v > 0 ? 'up' : v < 0 ? 'down' : 'dim';

/** value with its percentage in a smaller tail: "-107.10 (-20.03%)" */
function signedPair(v, p, d) {
  if (v === null || !Number.isFinite(v)) return '<span class="dim">—</span>';
  const tail = (p === null || !Number.isFinite(p)) ? '—' : (p > 0 ? '+' : '') + p.toFixed(2) + '%';
  return `<span class="${cls(v)}">${v > 0 ? '+' : ''}${d === 'abbr' ? abbr(v) : v.toFixed(d)}<span class="sub">(${tail})</span></span>`;
}

/* ------------------------------------------------------------------ state */

const state = {
  instruments: [],
  current: null,
  expiry: null,
  snapshot: null,
  samples: [],
  log: [],
  es: null,
  lastReceivedAt: 0,
  cadenceMs: 3000,
  clientStages: { transport: null, render: null },
  prevLtp: new Map(),
  filter: '',
};

/* ------------------------------------------------------------------ chips */

async function loadInstruments() {
  const res = await fetch('/api/instruments');
  const body = await res.json();
  state.instruments = body.instruments;

  const replay = body.mode === 'replay';
  $('modeBadge').textContent = replay ? 'REPLAY' : 'LIVE';
  $('modeBadge').className = 'badge ' + (replay ? 'replay' : 'live');
  $('replayBar').hidden = !replay;

  const wrap = $('chips');
  wrap.textContent = '';
  state.instruments.forEach((inst, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', 'false');
    b.disabled = !inst.resolved;
    if (!inst.resolved) b.title = inst.problems.join('; ');
    else b.title = `${inst.displayName} · ${inst.underlyingSeg} ${inst.underlyingScrip} · ${inst.session.window}`;
    b.innerHTML =
      `<i class="${inst.session.openNow ? 'open' : ''}"></i>${inst.label}<span class="kbd">${i + 1}</span>`;
    b.addEventListener('click', () => select(inst.id));
    wrap.appendChild(b);
  });

  const first = state.instruments.find(i => i.resolved) ?? state.instruments[0];
  if (first) select(first.id);
}

function select(id, expiry) {
  const inst = state.instruments.find(i => i.id === id);
  if (!inst) return;
  state.current = inst;
  state.expiry = expiry ?? inst.nearestExpiry;
  state.snapshot = null;
  state.centred = false;
  state.prevLtp.clear();

  [...$('chips').children].forEach((b, i) =>
    b.setAttribute('aria-pressed', String(state.instruments[i].id === id)));

  const sel = $('expiry');
  sel.textContent = '';
  for (const e of inst.expiries) {
    const o = document.createElement('option');
    o.value = e;
    o.textContent = e;
    if (e === state.expiry) o.selected = true;
    sel.appendChild(o);
  }

  renderHeader(null);
  skeleton();
  connect();
}

/* -------------------------------------------------------------------- SSE */

function connect() {
  if (state.es) state.es.close();
  const url = `/api/stream?key=${encodeURIComponent(state.current.id)}&expiry=${encodeURIComponent(state.expiry)}`;
  const es = new EventSource(url);
  state.es = es;

  setConn('connecting');
  es.addEventListener('hello', () => setConn('on'));
  es.addEventListener('open', () => setConn('on'));
  es.onopen = () => setConn('on');
  es.onerror = () => setConn('off');

  es.addEventListener('snapshot', (ev) => {
    const data = JSON.parse(ev.data);
    state.clientStages.transport = Math.max(0, Date.now() - data.pushedAt);
    onSnapshot(data);
  });
  es.addEventListener('status', (ev) => onStatus(JSON.parse(ev.data)));
  es.addEventListener('telemetry', (ev) => onTelemetry(JSON.parse(ev.data)));
}

function setConn(kind) {
  const el = $('conn');
  el.className = 'conn ' + (kind === 'on' ? 'on' : kind === 'off' ? 'off' : '');
  el.lastElementChild.textContent = kind === 'on' ? 'streaming' : kind === 'off' ? 'disconnected' : 'connecting';
}

/* -------------------------------------------------------------- rendering */

const CE_COLS = [40, 46, 52, 38, 56, 106, 56, 56, 38, 100, 60];
const SPINE = 92;

function buildColgroup() {
  const cg = $('cg');
  if (cg.children.length) return;
  const widths = [...CE_COLS, SPINE, ...[...CE_COLS].reverse()];
  cg.innerHTML = widths.map(w => `<col style="width:${w}px">`).join('');
}

function skeleton() {
  buildColgroup();
  $('expState').hidden = true;
  $('gridScroll').style.display = '';
  $('spotPill').hidden = true;
  const cells = '<td><span></span></td>'.repeat(23);
  $('ocBody').innerHTML = `<tr class="skel">${cells}</tr>`.repeat(15);
}

function renderHeader(s) {
  if (!s) {
    $('uName').textContent = state.current ? state.current.displayName : '—';
    for (const id of ['uSpot', 'uChg', 'sAtm', 'sIv', 'sIvc', 'sPcr', 'sDte', 'sStrikes']) $(id).textContent = '—';
    $('sLot').textContent = state.current?.lot ?? '—';
    return;
  }
  $('uName').textContent = s.instrument.displayName;
  $('uSpot').textContent = inr(s.spot);
  const chg = $('uChg');
  chg.textContent = s.spotChange === null
    ? 'previous close unavailable'
    : `${s.spotChange > 0 ? '+' : ''}${inr(s.spotChange)} (${pctText(s.spotChangePct)})`;
  chg.className = 'chg mono ' + (s.spotChange === null ? 'dim' : cls(s.spotChange));

  $('sAtm').textContent = s.atmStrike === null ? '—' : inr(s.atmStrike, 0);
  $('sIv').textContent = fx(s.atmIV, 2);
  const ivc = $('sIvc');
  ivc.textContent = pctText(s.ivChangePct);
  ivc.className = 'v mono ' + cls(s.ivChangePct);
  $('ivcWrap').title = s.ivBaselineAt
    ? `Baseline: first snapshot of the session at ${new Date(s.ivBaselineAt).toLocaleTimeString('en-IN')}. Dhan returns no previous IV, so this is an approximation.`
    : 'Dhan returns no previous IV; baseline not set yet.';
  $('sPcr').textContent = fx(s.pcr, 2);
  $('sLot').textContent = s.instrument.lot ?? '—';
  $('sDte').textContent = s.daysToExpiry;
  $('sStrikes').textContent = s.strikes;
}

function cell(html, extra = '') {
  return `<td class="${extra}">${html}</td>`;
}

function renderGrid(s) {
  buildColgroup();
  const rows = s.rows;
  let maxCe = 0, maxPe = 0;
  for (const r of rows) {
    if ((r.ce.oi ?? 0) > maxCe) maxCe = r.ce.oi ?? 0;
    if ((r.pe.oi ?? 0) > maxPe) maxPe = r.pe.oi ?? 0;
  }

  const q = state.filter.trim();
  const html = rows.map((r, i) => {
    const itmCe = r.strike < s.spot ? 'itm' : '';
    const itmPe = r.strike > s.spot ? 'itm' : '';
    const isAtm = r.strike === s.atmStrike;
    const spotline = i < rows.length - 1 && r.strike < s.spot && rows[i + 1].strike > s.spot;
    const hidden = q && !String(r.strike).includes(q);

    const c = r.ce, p = r.pe;
    const barCe = maxCe ? `<i class="bar" style="width:${(100 * (c.oi ?? 0) / maxCe).toFixed(1)}%"></i>` : '';
    const barPe = maxPe ? `<i class="bar" style="width:${(100 * (p.oi ?? 0) / maxPe).toFixed(1)}%"></i>` : '';

    return `<tr class="${isAtm ? 'atm ' : ''}${spotline ? 'spotline ' : ''}${hidden ? 'hidden' : ''}" data-strike="${r.strike}">`
      + cell(fx(c.vega, 2), itmCe)
      + cell(fx(c.theta, 2), itmCe)
      + cell(fx(c.gamma, 5), itmCe)
      + cell(fx(c.delta, 2), itmCe)
      + cell(barCe + abbr(c.oi), `oi r ${itmCe}`)
      + cell(signedPair(c.oiChg, c.oiChgPct, 'abbr'), itmCe)
      + cell(abbr(c.volume), itmCe)
      + cell(`<span class="${cls(c.volChgPct)}">${pctText(c.volChgPct)}</span>`, itmCe)
      + cell(fx(c.iv, 2), itmCe)
      + cell(signedPair(c.ltpChg, c.ltpChgPct, 2), itmCe)
      + cell(inr(c.ltp), `ltp ${itmCe}`)
      + cell(inr(r.strike, 0), 'spine')
      + cell(inr(p.ltp), `ltp ${itmPe}`)
      + cell(signedPair(p.ltpChg, p.ltpChgPct, 2), itmPe)
      + cell(fx(p.iv, 2), itmPe)
      + cell(`<span class="${cls(p.volChgPct)}">${pctText(p.volChgPct)}</span>`, itmPe)
      + cell(abbr(p.volume), itmPe)
      + cell(signedPair(p.oiChg, p.oiChgPct, 'abbr'), itmPe)
      + cell(barPe + abbr(p.oi), `oi ${itmPe}`)
      + cell(fx(p.delta, 2), itmPe)
      + cell(fx(p.gamma, 5), itmPe)
      + cell(fx(p.theta, 2), itmPe)
      + cell(fx(p.vega, 2), itmPe)
      + '</tr>';
  }).join('');

  $('ocBody').innerHTML = html;

  // Flash only the cells whose LTP actually moved.
  const body = $('ocBody');
  for (const tr of body.children) {
    const strike = Number(tr.dataset.strike);
    const row = rows.find(r => r.strike === strike);
    if (!row) continue;
    for (const [side, idx] of [['ce', 10], ['pe', 12]]) {
      const key = `${strike}|${side}`;
      const now = row[side].ltp;
      if (state.prevLtp.has(key) && state.prevLtp.get(key) !== now) tr.children[idx].classList.add('flash');
      state.prevLtp.set(key, now);
    }
  }

  placeSpotPill(s);
}

function placeSpotPill(s) {
  const pill = $('spotPill');
  const line = $('ocBody').querySelector('tr.spotline');
  if (!line || line.classList.contains('hidden')) { pill.hidden = true; return; }
  const spine = line.querySelector('td.spine');
  pill.hidden = false;
  pill.textContent = inr(s.spot);
  pill.style.top = `${line.offsetTop + line.offsetHeight}px`;
  pill.style.left = `${spine.offsetLeft + spine.offsetWidth / 2}px`;
}

function scrollToAtm(behavior = 'smooth') {
  const atm = document.querySelector('#ocBody tr.atm');
  if (atm) atm.scrollIntoView({ block: 'center', behavior });
}

function onSnapshot(s) {
  state.snapshot = s;
  state.lastReceivedAt = Date.now();

  const t0 = performance.now();
  renderHeader(s);
  renderGrid(s);
  requestAnimationFrame(() => {
    state.clientStages.render = Math.round((performance.now() - t0) * 10) / 10;
    drawWaterfall();
    if (!state.centred) { state.centred = true; scrollToAtm('auto'); }
  });

  $('expState').hidden = true;
  $('gridScroll').style.display = '';
  $('pulse').className = 'pulse' + (s.session.openNow ? ' on' : '');
}

/* ----------------------------------------------------------------- states */

const NEEDLE = {
  closed: 'idle',
  error: 'concerned',
};

function onStatus(st) {
  const chip = $('stateChip');
  const exp = $('expState');

  if (st.state === 'polling' || st.state === 'idle') {
    chip.hidden = true;
    if (state.snapshot) { exp.hidden = true; $('gridScroll').style.display = ''; }
    return;
  }

  if (st.state === 'closed') {
    chip.hidden = false;
    chip.className = 'statechip flat';
    chip.textContent = `MARKET CLOSED · ${st.since}`;
    if (!state.snapshot) showExpressive('idle', 'Market abhi band hai',
      `${state.current.displayName} ka session ${state.current.session.window} hai. Abhi ${st.since}.`,
      'Try another instrument', JSON.stringify(st, null, 2));
    return;
  }

  // error
  chip.hidden = false;
  chip.className = 'statechip ' + (st.code === 'DH-904' ? 'warn' : 'crit');
  chip.textContent = st.code === 'DH-904'
    ? `THROTTLED · retry in ${Math.round((st.retryInMs ?? 0) / 1000)}s`
    : `DISCONNECTED · ${st.code}`;

  if (!state.snapshot) {
    const title = st.code === 'DH-901' || st.code === 'DH-906' || st.code === 'NO_CREDS'
      ? 'Dhan ne token accept nahi kiya'
      : st.code === 'DH-904' ? 'Dhan ne rate limit laga diya'
      : 'Dhan tak request nahi pahunch payi';
    showExpressive(NEEDLE.error, title, st.explain,
      st.retryInMs ? `Retrying in ${Math.round(st.retryInMs / 1000)}s` : 'Retry now',
      `${st.code}  ${st.message}\nkey       ${state.current.id}|${state.expiry}\nendpoint  POST /v2/optionchain`);
  }
}

function showExpressive(pose, title, body, action, tech) {
  const exp = $('expState');
  exp.hidden = false;
  exp.className = 'exp ' + pose;
  $('gridScroll').style.display = 'none';
  $('expTitle').textContent = title;
  $('expBody').textContent = body;
  $('expA').textContent = action;
  $('expTech').textContent = tech;
}
$('expA').addEventListener('click', () => { skeleton(); connect(); });

/* ------------------------------------------------------------- telemetry */

function onTelemetry(s) {
  state.samples.push(s);
  if (state.samples.length > 60) state.samples.shift();
  state.log.unshift(s);
  if (state.log.length > 20) state.log.pop();

  const rtt = s.timing.roundTrip;
  setBig('mRtt', rtt === null ? '—' : `${Math.round(rtt)}<small>ms</small>`, rtt > 800 ? 'warn' : '');
  $('miniRtt').innerHTML = rtt === null ? '—<em>rtt</em>' : `${Math.round(rtt)}<em>ms rtt</em>`;

  drawWaterfall();
  drawSpark();
  drawLog();
}

function setBig(id, html, kind = '') {
  const el = $(id);
  el.innerHTML = html;
  el.className = 'v mono ' + kind;
}

function drawWaterfall() {
  const s = state.samples[state.samples.length - 1];
  if (!s) return;
  const t = s.timing;
  const stages = {
    server: t.server ?? 0,
    download: t.download ?? 0,
    compute: t.compute ?? 0,
    transport: state.clientStages.transport ?? 0,
    render: state.clientStages.render ?? 0,
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
  const vals = state.samples.filter(s => s.ok && s.timing.roundTrip !== null).map(s => s.timing.roundTrip);
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
  const ok = state.samples.filter(s => s.ok).length;
  $('okRate').textContent = `${Math.round(100 * ok / state.samples.length)}% ok`;
}

function drawLog() {
  $('logBody').innerHTML = state.log.map(s => {
    const t = new Date(s.at).toLocaleTimeString('en-IN', { hour12: false });
    return `<tr><td>${t}</td><td>${s.instrument}</td>`
      + `<td class="${s.ok ? 'ok' : 'bad'}">${s.ok ? (s.httpStatus ?? 200) : (s.errorCode ?? 'ERR')}</td>`
      + `<td>${s.timing.roundTrip === null ? '—' : Math.round(s.timing.roundTrip)}</td>`
      + `<td>${(s.bytes / 1024).toFixed(0)}</td><td>${s.strikes || '—'}</td></tr>`;
  }).join('');
}

/* ------------------------------------------------------------- live ticks */

setInterval(() => {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';

  if (!state.lastReceivedAt) return;
  const age = (Date.now() - state.lastReceivedAt) / 1000;
  const kind = age > 15 ? 'crit' : age > 6 ? 'warn' : '';
  setBig('mAge', `${age.toFixed(1)}<small>s</small>`, kind);
  $('miniAge').innerHTML = `${age.toFixed(1)}<em>s age</em>`;
  $('miniAge').className = kind;
  $('gridScroll').style.opacity = age > 6 ? '.85' : '1';

  const next = Math.max(0, state.cadenceMs - (Date.now() - state.lastReceivedAt)) / 1000;
  setBig('mNext', `${next.toFixed(1)}<small>s</small>`);
  const C = 56.5;
  $('ringArc').setAttribute('stroke-dashoffset', (C * (1 - next / (state.cadenceMs / 1000))).toFixed(1));
}, 250);

/* --------------------------------------------------------------- controls */

$('expiry').addEventListener('change', (e) => select(state.current.id, e.target.value));

$('search').addEventListener('input', (e) => {
  state.filter = e.target.value;
  if (state.snapshot) renderGrid(state.snapshot);
});

const applyTheme = (t) => {
  if (t) document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
};
applyTheme(localStorage.getItem('theme'));
$('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
  if (state.snapshot) placeSpotPill(state.snapshot);
});

const setPanel = (open) => {
  document.body.classList.toggle('nopanel', !open);
  localStorage.setItem('panel', open ? '1' : '0');
  if (state.snapshot) requestAnimationFrame(() => placeSpotPill(state.snapshot));
};
setPanel(localStorage.getItem('panel') !== null
  ? localStorage.getItem('panel') === '1'
  : window.innerWidth >= 1780);
$('panelBtn').addEventListener('click', () => setPanel(document.body.classList.contains('nopanel')));

document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= state.instruments.length) { select(state.instruments[n - 1].id); return; }
  if (e.key === '/') { e.preventDefault(); $('search').focus(); }
  if (e.key.toLowerCase() === 'l') setPanel(document.body.classList.contains('nopanel'));
  if (e.key.toLowerCase() === 't') $('themeBtn').click();
  if (e.key.toLowerCase() === 'e') $('expiry').focus();
  if (e.key === 'Home' && state.snapshot) scrollToAtm();
});

window.addEventListener('resize', () => { if (state.snapshot) placeSpotPill(state.snapshot); });

loadInstruments().catch(err => {
  $('chips').hidden = true;
  document.querySelector('.hstrip').hidden = true;
  showExpressive('concerned', 'Backend se baat nahi ho payi',
    'Local server chal raha hai? Terminal mein `npm run dev` chala kar dobara try karo.',
    'Retry', String(err));
});
