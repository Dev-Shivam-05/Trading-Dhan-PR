/* Dhan Option Chain Terminal — chart price axis, crosshair and drawing tools.
   Every constant here is a row in docs/spec/chart-tools-v1.md. Do not change one without
   changing that row first.

   The whole point of this module is that a drawing is stored as (time, price) — never pixels.
   Pixels are re-derived every frame through X()/Y(), which is what makes a shape survive a
   scale drag, a range switch and a reload without moving. */

const PAD_R = 76;                 // row 1  — price axis gutter, matches drawChart()
const PAD_B = 16;                 // row 1  — time label strip
const ZOOM_MIN = 0.15;            // row 3
const ZOOM_MAX = 12;              // row 3
const ZOOM_EFOLD = 180;           // row 3  — px of drag per e-fold
const SNAP_PX = 24;               // row 7  — crosshair snaps to a tick within this
const MIN_DRAG_PX = 4;            // row 12 — below this a two-point shape is discarded
const HIT_PX = 6;                 // row 18 — selection tolerance
const HANDLE_R = 3.5;             // row 18
const SAVE_MS = 250;              // row 22
const CAP = 200;                  // row 24 — shapes per (instrument, expiry)
const CLEAR_CONFIRM_MS = 3000;    // row 21
const MONO = 'IBM Plex Mono, monospace';
const KEY_PREFIX = 'draw:v1:';    // row 22

const TOOLS = ['cursor', 'trend', 'hline', 'ray', 'rect'];

const st = {
  zoom: 1,
  tool: 'cursor',
  shapes: [],
  scopeKey: null,
  selected: null,
  draft: null,          // shape being drawn right now, rendered but not yet stored
  drag: null,           // {kind:'create'|'handle', ...}
  cross: null,          // {x, y} in svg coords
  frame: null,          // {W, H, t0, t1, lo, hi, pts}
  enabled: false,
};

let deps = { inr: (v) => String(v), repaint: () => {} };
let els = {};
let idSeq = 0;
const newId = () => `d${Date.now().toString(36)}${(idSeq++).toString(36)}`;

const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1));

/* ------------------------------------------------------------------ scale */

/** row 2 — zoom multiplies the half-span of the auto-fit range about its own midpoint, so the
 *  chart keeps tracking price and only the scale changes. */
export function applyZoom(loP, hiP) {
  const mid = (hiP + loP) / 2;
  const half = ((hiP - loP) / 2) * st.zoom;
  return [mid - half, mid + half];
}

export function setFrame(f) { st.frame = f; }

export const X = (t) => {
  const f = st.frame;
  return ((t - f.t0) / Math.max(1, f.t1 - f.t0)) * (f.W - PAD_R);
};
export const Y = (p) => {
  const f = st.frame;
  return (f.H - PAD_B) - ((p - f.lo) / Math.max(1e-9, f.hi - f.lo)) * (f.H - PAD_B);
};
const invX = (x) => {
  const f = st.frame;
  return f.t0 + (x / Math.max(1, f.W - PAD_R)) * (f.t1 - f.t0);
};
const invY = (y) => {
  const f = st.frame;
  const h = f.H - PAD_B;
  return f.lo + ((h - y) / Math.max(1, h)) * (f.hi - f.lo);
};

/* ------------------------------------------------------------ persistence */

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** row 23 — weekly expiries would otherwise leave a key behind forever. ISO dates compare
 *  correctly as strings, which also sidesteps the UTC-vs-IST midnight trap Date.parse has. */
function pruneKeys() {
  const today = todayIso();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    const exp = k.slice(k.lastIndexOf(':') + 1);
    if (isoDay.test(exp) && exp < today) localStorage.removeItem(k);
  }
}

let saveT = null;
function save() {                                   // row 22 — debounced 250 ms
  clearTimeout(saveT);
  saveT = setTimeout(flushSave, SAVE_MS);
}
function flushSave() {
  clearTimeout(saveT);
  saveT = null;
  if (!st.scopeKey) return;
  try { localStorage.setItem(st.scopeKey, JSON.stringify(st.shapes)); } catch { /* quota */ }
}

function load(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(s =>
      s && TOOLS.includes(s.kind) && s.kind !== 'cursor'
      && s.a && Number.isFinite(s.a.p)
      && (s.kind === 'hline' || (s.b && Number.isFinite(s.b.p) && Number.isFinite(s.b.t))));
  } catch { return []; }
}

/** Drawings never cross an instrument or an expiry (row 22). */
export function setScope(instrumentId, expiry) {
  flushSave();
  st.scopeKey = `${KEY_PREFIX}${instrumentId}:${expiry}`;
  st.shapes = load(st.scopeKey);
  st.selected = null;
  st.draft = null;
  st.drag = null;
  deps.repaint();
}

/* -------------------------------------------------------------- geometry */

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** row 16 — a ray is the trendline extended past b only. Clipping to the plot (row 17) is what
 *  actually stops it at the edge, so extending far enough is all this has to do. */
function rayEnd(x1, y1, x2, y2, w, h) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [x2, y2];
  const k = ((w + h) * 4) / len;
  return [x1 + dx * k, y1 + dy * k];
}

function pixelsOf(s) {
  const f = st.frame;
  const w = f.W - PAD_R, h = f.H - PAD_B;
  if (s.kind === 'hline') return { y: Y(s.a.p), w, h };
  const x1 = X(s.a.t), y1 = Y(s.a.p), x2 = X(s.b.t), y2 = Y(s.b.p);
  return { x1, y1, x2, y2, w, h };
}

function distTo(s, px, py) {
  const g = pixelsOf(s);
  if (s.kind === 'hline') return (px >= 0 && px <= g.w) ? Math.abs(py - g.y) : Infinity;
  if (s.kind === 'trend') return distToSeg(px, py, g.x1, g.y1, g.x2, g.y2);
  if (s.kind === 'ray') {
    const [ex, ey] = rayEnd(g.x1, g.y1, g.x2, g.y2, g.w, g.h);
    return distToSeg(px, py, g.x1, g.y1, ex, ey);
  }
  // rect — edges only, so a click inside a big rectangle does not swallow everything under it
  const xa = Math.min(g.x1, g.x2), xb = Math.max(g.x1, g.x2);
  const ya = Math.min(g.y1, g.y2), yb = Math.max(g.y1, g.y2);
  return Math.min(
    distToSeg(px, py, xa, ya, xb, ya), distToSeg(px, py, xb, ya, xb, yb),
    distToSeg(px, py, xb, yb, xa, yb), distToSeg(px, py, xa, yb, xa, ya));
}

/** Newest shape wins, so a shape drawn on top of another is the one you grab. */
function hitTest(px, py) {
  for (let i = st.shapes.length - 1; i >= 0; i--) {
    if (distTo(st.shapes[i], px, py) <= HIT_PX) return st.shapes[i].id;
  }
  return null;
}

/** Handle positions in svg px, with the anchor field each one writes back to (row 18/19). */
function handlesOf(s) {
  const g = pixelsOf(s);
  if (s.kind === 'hline') return [{ x: g.w / 2, y: g.y, set: 'a', axis: 'p' }];
  if (s.kind === 'rect') {
    return [
      { x: g.x1, y: g.y1, set: 'a', axis: 'tp' },
      { x: g.x2, y: g.y2, set: 'b', axis: 'tp' },
      { x: g.x1, y: g.y2, set: 'a', axis: 't', also: { set: 'b', axis: 'p' } },
      { x: g.x2, y: g.y1, set: 'b', axis: 't', also: { set: 'a', axis: 'p' } },
    ];
  }
  return [
    { x: g.x1, y: g.y1, set: 'a', axis: 'tp' },
    { x: g.x2, y: g.y2, set: 'b', axis: 'tp' },
  ];
}

function handleAt(s, px, py) {
  const hs = handlesOf(s);
  for (let i = 0; i < hs.length; i++) {
    if (Math.hypot(px - hs[i].x, py - hs[i].y) <= HIT_PX) return i;
  }
  return -1;
}

/* -------------------------------------------------------------- rendering */

const n = (v) => v.toFixed(1);

function shapeSvg(s, sel) {
  const g = pixelsOf(s);
  const sw = sel ? 2 : 1.4;                                    // row 14 / 18
  const stroke = 'var(--accent)';
  if (s.kind === 'hline') {
    return `<line x1="0" y1="${n(g.y)}" x2="${n(g.w)}" y2="${n(g.y)}" stroke="${stroke}" `
      + `stroke-width="${sw}" stroke-dasharray="5 4"/>`;
  }
  if (s.kind === 'trend') {
    return `<line x1="${n(g.x1)}" y1="${n(g.y1)}" x2="${n(g.x2)}" y2="${n(g.y2)}" `
      + `stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (s.kind === 'ray') {
    const [ex, ey] = rayEnd(g.x1, g.y1, g.x2, g.y2, g.w, g.h);
    return `<line x1="${n(g.x1)}" y1="${n(g.y1)}" x2="${n(ex)}" y2="${n(ey)}" `
      + `stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  const x = Math.min(g.x1, g.x2), y = Math.min(g.y1, g.y2);
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.abs(g.x2 - g.x1))}" `
    + `height="${n(Math.abs(g.y2 - g.y1))}" fill="var(--accent-wash)" stroke="${stroke}" `
    + `stroke-width="${sw}"/>`;
}

/** row 14 — a level is only useful if you can read its price off the axis. */
function hlinePill(s) {
  const f = st.frame;
  const w = f.W - PAD_R, h = f.H - PAD_B;
  const y = Y(s.a.p);
  if (y < 9 || y > h - 9) return '';
  return `<rect x="${n(w + 2)}" y="${n(y - 9)}" width="${PAD_R - 6}" height="18" rx="3" `
    + `fill="var(--accent)"/>`
    + `<text x="${n(w + 7)}" y="${n(y + 3.5)}" fill="var(--accent-fg)" font-family="${MONO}" `
    + `font-size="10.5" font-weight="600">${deps.inr(s.a.p)}</text>`;
}

/** Cheap reject for a shape that cannot touch the plot — a shape drawn on `All` is usually
 *  off-screen on `1m`, and the clip alone would still pay to build and parse it. */
function offPlot(s, w, h) {
  const g = pixelsOf(s);
  if (s.kind === 'hline') return g.y < 0 || g.y > h;
  if (s.kind === 'ray') return false;                    // extends to the edge by definition
  return Math.max(g.x1, g.x2) < 0 || Math.min(g.x1, g.x2) > w
      || Math.max(g.y1, g.y2) < 0 || Math.min(g.y1, g.y2) > h;
}

export function renderDrawings() {
  if (!st.frame) return '';
  const f = st.frame;
  const w = f.W - PAD_R, h = f.H - PAD_B;
  const list = st.draft ? st.shapes.concat([st.draft]) : st.shapes;
  if (!list.length) return '';

  // One <path> per style instead of one node per shape. At the 200-shape cap (row 24) the
  // difference is 200 nodes to parse every frame versus 3, which is the whole paint budget.
  let solid = '', dashed = '', boxes = '', body = '', pills = '';
  for (const s of list) {
    if (offPlot(s, w, h)) continue;
    if (s.id === st.selected || s === st.draft) {
      body += shapeSvg(s, s.id === st.selected);
      if (s.kind === 'hline') pills += hlinePill(s);
      continue;
    }
    const g = pixelsOf(s);
    if (s.kind === 'hline') {
      dashed += `M0 ${n(g.y)}L${n(g.w)} ${n(g.y)}`;
      pills += hlinePill(s);
    } else if (s.kind === 'rect') {
      const x = Math.min(g.x1, g.x2), y = Math.min(g.y1, g.y2);
      boxes += `M${n(x)} ${n(y)}h${n(Math.abs(g.x2 - g.x1))}v${n(Math.abs(g.y2 - g.y1))}`
        + `h${n(-Math.abs(g.x2 - g.x1))}Z`;
    } else if (s.kind === 'ray') {
      const [ex, ey] = rayEnd(g.x1, g.y1, g.x2, g.y2, g.w, g.h);
      solid += `M${n(g.x1)} ${n(g.y1)}L${n(ex)} ${n(ey)}`;
    } else {
      solid += `M${n(g.x1)} ${n(g.y1)}L${n(g.x2)} ${n(g.y2)}`;
    }
  }
  if (solid) {
    body = `<path d="${solid}" fill="none" stroke="var(--accent)" stroke-width="1.4" `
      + `stroke-linecap="round"/>` + body;
  }
  if (dashed) {
    body = `<path d="${dashed}" fill="none" stroke="var(--accent)" stroke-width="1.4" `
      + `stroke-dasharray="5 4"/>` + body;
  }
  if (boxes) {
    body = `<path d="${boxes}" fill="var(--accent-wash)" stroke="var(--accent)" `
      + `stroke-width="1.4"/>` + body;
  }

  let handles = '';
  const sel = st.shapes.find(s => s.id === st.selected);
  if (sel) {
    for (const hd of handlesOf(sel)) {
      handles += `<circle cx="${n(hd.x)}" cy="${n(hd.y)}" r="${HANDLE_R}" fill="var(--accent)" `
        + `stroke="var(--bg-panel)" stroke-width="1"/>`;
    }
  }

  // row 17 — anchors outside the window must not paint over the axis gutter or the time labels
  return `<defs><clipPath id="plotClip"><rect x="0" y="0" width="${n(w)}" height="${n(h)}"/>`
    + `</clipPath></defs><g clip-path="url(#plotClip)">${body}${handles}</g>${pills}`;
}

export function renderCrosshair() {
  if (!st.cross || !st.frame) return '';
  const f = st.frame;
  const w = f.W - PAD_R, h = f.H - PAD_B;
  const { x, y } = st.cross;
  if (x < 0 || x > w || y < 0 || y > h) return '';

  // row 7 — snap the vertical line to a real print when one is close enough
  let vx = x, vt = invX(x);
  let best = SNAP_PX;
  for (const p of (f.pts ?? [])) {
    const px = X(p.t);
    const d = Math.abs(px - x);
    if (d < best) { best = d; vx = px; vt = p.t; }
  }

  const time = new Date(vt).toLocaleTimeString('en-IN', { hour12: false });
  const labX = Math.min(Math.max(vx, 26), w - 26);
  const dash = `stroke="var(--fg-faint)" stroke-width="1" stroke-dasharray="3 3" opacity=".8"`;

  return `<line x1="${n(vx)}" y1="0" x2="${n(vx)}" y2="${n(h)}" ${dash}/>`
    + `<line x1="0" y1="${n(y)}" x2="${n(w)}" y2="${n(y)}" ${dash}/>`
    // row 9 — muted, never the accent or the live-price colour, so it cannot read as the price
    + `<rect x="${n(w + 2)}" y="${n(y - 9)}" width="${PAD_R - 6}" height="18" rx="3" `
    + `fill="var(--fg-muted)"/>`
    + `<text x="${n(w + 7)}" y="${n(y + 3.5)}" fill="var(--bg-panel)" font-family="${MONO}" `
    + `font-size="10.5" font-weight="600">${deps.inr(invY(y))}</text>`
    + `<rect x="${n(labX - 25)}" y="${f.H - 12}" width="50" height="11" fill="var(--bg-panel)"/>`
    + `<text x="${n(labX)}" y="${f.H - 3}" fill="var(--fg-faint)" text-anchor="middle" `
    + `font-family="${MONO}" font-size="9">${time}</text>`;
}

/* ------------------------------------------------------------------ tools */

function setTool(t) {
  if (!TOOLS.includes(t)) return;
  st.tool = t;
  for (const b of els.tools.querySelectorAll('button[data-tool]')) {
    b.setAttribute('aria-pressed', String(b.dataset.tool === t));
  }
  els.surface.style.cursor = t === 'cursor' ? 'crosshair' : 'copy';
}

/** row 25 — with no scale on screen there is no honest price to anchor to. */
export function setEnabled(on) {
  if (st.enabled === on) return;
  st.enabled = on;
  for (const b of els.tools.querySelectorAll('button[data-tool]')) b.disabled = !on;
  els.surface.style.pointerEvents = on ? '' : 'none';
  if (!on) {
    st.cross = null;
    st.draft = null;
    st.drag = null;
    setTool('cursor');
  }
}

function commit(shape) {
  if (st.shapes.length >= CAP) {                    // row 24
    console.warn(`[chart-tools] ${CAP} drawing cap reached for ${st.scopeKey}; shape ignored`);
    return;
  }
  st.shapes.push(shape);
  st.selected = shape.id;
  save();
}

function deleteSelected() {
  if (!st.selected) return false;
  const i = st.shapes.findIndex(s => s.id === st.selected);
  if (i === -1) return false;
  st.shapes.splice(i, 1);
  st.selected = null;
  save();
  deps.repaint();
  return true;
}

/** Esc — row 11. Drops an in-progress shape without storing it, then clears the selection. */
function cancel() {
  if (st.draft || st.drag) { st.draft = null; st.drag = null; deps.repaint(); return true; }
  if (st.selected) { st.selected = null; deps.repaint(); return true; }
  return false;
}

/* --------------------------------------------------------------- pointers */

function svgXY(e) {
  const r = els.svg.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onSurfaceDown(e) {
  if (!st.frame || e.button !== 0) return;
  const { x, y } = svgXY(e);
  els.surface.setPointerCapture(e.pointerId);

  if (st.tool === 'cursor') {
    const sel = st.shapes.find(s => s.id === st.selected);
    const hi = sel ? handleAt(sel, x, y) : -1;
    if (hi !== -1) {
      st.drag = { kind: 'handle', id: sel.id, handle: hi };
    } else {
      st.selected = hitTest(x, y);
      st.drag = null;
    }
    deps.repaint();
    return;
  }

  const at = { t: invX(x), p: invY(y) };
  st.draft = { id: newId(), kind: st.tool, a: at, b: { ...at } };
  st.drag = { kind: 'create', x0: e.clientX, y0: e.clientY };
  deps.repaint();
}

function onSurfaceMove(e) {
  if (!st.frame) return;
  const { x, y } = svgXY(e);
  st.cross = { x, y };

  if (st.drag?.kind === 'create' && st.draft) {
    st.draft.b = { t: invX(x), p: invY(y) };
  } else if (st.drag?.kind === 'handle') {
    const s = st.shapes.find(v => v.id === st.drag.id);
    if (s) {
      const hd = handlesOf(s)[st.drag.handle];
      const t = invX(x), p = invY(y);
      if (hd.axis.includes('t')) s[hd.set].t = t;
      if (hd.axis.includes('p')) s[hd.set].p = p;
      if (hd.also) {
        if (hd.also.axis.includes('t')) s[hd.also.set].t = t;
        if (hd.also.axis.includes('p')) s[hd.also.set].p = p;
      }
    }
  }
  deps.repaint();
}

function onSurfaceUp(e) {
  if (els.surface.hasPointerCapture(e.pointerId)) els.surface.releasePointerCapture(e.pointerId);

  if (st.drag?.kind === 'handle') {
    st.drag = null;
    save();
    deps.repaint();
    return;
  }
  if (st.drag?.kind !== 'create' || !st.draft) { st.drag = null; return; }

  const travel = Math.hypot(e.clientX - st.drag.x0, e.clientY - st.drag.y0);
  const d = st.draft;
  st.draft = null;
  st.drag = null;

  // row 12 — a horizontal line is a click, everything else needs 4 px of intent
  if (d.kind === 'hline') commit({ id: d.id, kind: 'hline', a: { t: d.a.t, p: d.a.p }, b: null });
  else if (travel >= MIN_DRAG_PX) commit(d);

  setTool('cursor');                                // row 13 — one-shot
  deps.repaint();
}

function onSurfaceLeave() {
  st.cross = null;
  deps.repaint();
}

/* row 1/3/4 — the price axis gutter */
function wireAxis() {
  let dragging = false, startY = 0, startZoom = 1;
  els.axis.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    startY = e.clientY;
    startZoom = st.zoom;
    els.axis.setPointerCapture(e.pointerId);
  });
  els.axis.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    st.zoom = clampZoom(startZoom * Math.exp((e.clientY - startY) / ZOOM_EFOLD));
    deps.repaint();
  });
  els.axis.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    els.axis.releasePointerCapture(e.pointerId);
    localStorage.setItem('chartZoom', String(st.zoom));   // row 5
  });
  els.axis.addEventListener('dblclick', () => {           // row 4
    st.zoom = 1;
    localStorage.setItem('chartZoom', '1');
    deps.repaint();
  });
}

/* row 21 — clear-all is irreversible, so it costs two clicks */
function wireClear(btn) {
  let armed = 0;
  let timer = null;
  const disarm = () => {
    armed = 0;
    clearTimeout(timer);
    btn.textContent = '✕';
    btn.classList.remove('confirm');
  };
  btn.addEventListener('click', () => {
    if (armed && Date.now() - armed < CLEAR_CONFIRM_MS) {
      st.shapes = [];
      st.selected = null;
      st.draft = null;
      flushSave();
      disarm();
      deps.repaint();
      return;
    }
    armed = Date.now();
    btn.textContent = 'sure?';
    btn.classList.add('confirm');
    clearTimeout(timer);
    timer = setTimeout(disarm, CLEAR_CONFIRM_MS);
  });
}

/* ------------------------------------------------------------------- init */

export function init(options) {
  deps = { inr: options.inr, repaint: options.repaint };
  els = {
    svg: options.svg,
    surface: options.surface,
    axis: options.axis,
    tools: options.tools,
  };

  pruneKeys();
  st.zoom = clampZoom(Number(localStorage.getItem('chartZoom') ?? 1));

  els.tools.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tool]');
    if (b) setTool(b.dataset.tool);
  });
  wireClear(els.tools.querySelector('#chartClear'));
  wireAxis();

  els.surface.addEventListener('pointerdown', onSurfaceDown);
  els.surface.addEventListener('pointermove', onSurfaceMove);
  els.surface.addEventListener('pointerup', onSurfaceUp);
  els.surface.addEventListener('pointercancel', onSurfaceUp);
  els.surface.addEventListener('pointerleave', onSurfaceLeave);

  // a reload inside the 250 ms debounce must not lose the shape that was just drawn
  window.addEventListener('pagehide', flushSave);

  setTool('cursor');
  setEnabled(false);

  // read-only seam for the replay verification scripts; nothing in the app reads it
  window.__chart = {
    frame: () => st.frame,
    shapes: () => st.shapes,
    zoom: () => st.zoom,
    tool: () => st.tool,
    selected: () => st.selected,
    key: () => st.scopeKey,
    repaint: () => deps.repaint(),
    X, Y, invY,
  };
}

/** Keys are owned by app.js's single keydown handler; it forwards the ones we claim (row 11). */
export function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;   // Ctrl+R must still reload the page
  const k = e.key.toLowerCase();
  if (k === 'escape') return cancel();
  if (e.key === 'Delete' || e.key === 'Backspace') return deleteSelected();
  const map = { v: 'cursor', d: 'trend', h: 'hline', r: 'ray', b: 'rect' };
  if (map[k] && st.enabled) { setTool(map[k]); return true; }
  return false;
}
