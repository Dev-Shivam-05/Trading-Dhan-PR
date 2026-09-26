/* P19 — Chart Style. Spec: docs/spec/underlying-candles-v1.md rows 12-20, 22.

   The saved look of the UNDERLYING chart: mode (Candle / Line), background, up and down candle
   colours, three SMA slots, and P57's indicators (VWAP, two EMAs, Supertrend, Bollinger —
   docs/spec/indicators-v1.md). The dialog edits a DRAFT and paints it into its own preview;
   nothing reaches the strip until Save (row 19). Option candles never read any of this (row 22):
   blue and yellow mean something there.

   Imports only the ucandles leaf, and takes the number formatter from app.js through init() —
   importing app.js here would make a cycle, since app.js imports this. */

import * as uc from '/ucandles.js';

const KEY = 'chartStyle:v1';
const MIN_CONTRAST = 3;                        // row 18 — WCAG non-text minimum

/** Row 15. `null` is Theme: no override, the strip keeps the theme's own background. */
export const BG = [
  { v: 'theme', name: 'Theme' },
  { v: '#141414', name: 'Graphite' },
  { v: '#1B1A2E', name: 'Indigo' },
  { v: '#0F1E17', name: 'Forest' },
  { v: '#0F172A', name: 'Navy' },
  { v: '#231515', name: 'Maroon' },
  { v: '#24142A', name: 'Plum' },
];
/** Row 16. */
export const UP = [
  { v: 'theme', name: 'Theme green' },
  { v: '#2F7BFF', name: 'Blue' },
  { v: '#8B5CF6', name: 'Violet' },
  { v: '#22D3EE', name: 'Cyan' },
  { v: '#A3E635', name: 'Lime' },
  { v: '#F4F4F5', name: 'White' },
];
/** Row 17. */
export const DOWN = [
  { v: 'theme', name: 'Theme red' },
  { v: '#F472B6', name: 'Pink' },
  { v: '#F97316', name: 'Orange' },
  { v: '#FB6F4F', name: 'Coral' },
  { v: '#FACC15', name: 'Yellow' },
  { v: '#A1A1AA', name: 'Grey' },
];

/** Rows 1, 12, 15-17. */
export const DEFAULTS = Object.freeze({
  mode: 'candle',
  bg: 'theme',
  up: 'theme',
  down: 'theme',
  sma: [
    { on: false, period: 9, color: '#FACC15' },
    { on: true, period: 20, color: '#F5A524' },
    { on: false, period: 50, color: '#8B7CFF' },
  ],
  // P57 rows 9-10 (GUESS defaults and colours): VWAP, EMA 9 and Supertrend on; EMA 21 and BB off.
  ind: {
    vwap: { on: true, color: '#38BDF8' },
    ema: [
      { on: true, period: 9, color: '#F472B6' },
      { on: false, period: 21, color: '#C084FC' },
    ],
    st: { on: true, period: 10, mult: 3 },
    bb: { on: false, period: 20, mult: 2, color: '#A1A1AA' },
    // P58 row 7: the lower pane, off by default so no existing criterion's geometry moves.
    pane: { kind: 'none', rsi: 14 },
  },
});

/** P57 row 8: the ranges an indicator input snaps back into. */
export const LIMITS = {
  ema: { min: 2, max: 200, step: 1 },
  stPeriod: { min: 2, max: 100, step: 1 },
  stMult: { min: 0.5, max: 10, step: 0.5 },
  bbPeriod: { min: 2, max: 200, step: 1 },
  bbMult: { min: 0.5, max: 5, step: 0.5 },
  rsi: { min: 2, max: 100, step: 1 },
};
const PANES = ['none', 'rsi', 'macd', 'vol'];
/** A value inside `lim` on its step grid, or null. */
export function inLimit(v, lim) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const q = Math.round(n / lim.step) * lim.step;
  return q >= lim.min && q <= lim.max ? Math.round(q * 100) / 100 : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const clone = (s) => JSON.parse(JSON.stringify(s));
const $ = (id) => document.getElementById(id);

/** Anything malformed in storage falls back field by field, never wholesale. */
function sanitize(raw) {
  const d = clone(DEFAULTS);
  if (!raw || typeof raw !== 'object') return d;
  if (raw.mode === 'candle' || raw.mode === 'line') d.mode = raw.mode;
  for (const k of ['bg', 'up', 'down']) {
    if (raw[k] === 'theme' || HEX.test(raw[k] ?? '')) d[k] = raw[k];
  }
  // P57 row 14: an older saved style has no `ind`; it gets the defaults, field by field.
  const ri = raw.ind && typeof raw.ind === 'object' ? raw.ind : {};
  if (ri.vwap && typeof ri.vwap === 'object') d.ind.vwap.on = !!ri.vwap.on;
  if (Array.isArray(ri.ema)) {
    ri.ema.slice(0, 2).forEach((x, i) => {
      if (!x) return;
      d.ind.ema[i].on = !!x.on;
      const p = inLimit(x.period, LIMITS.ema);
      if (p !== null) d.ind.ema[i].period = p;
    });
  }
  if (ri.st && typeof ri.st === 'object') {
    d.ind.st.on = !!ri.st.on;
    d.ind.st.period = inLimit(ri.st.period, LIMITS.stPeriod) ?? d.ind.st.period;
    d.ind.st.mult = inLimit(ri.st.mult, LIMITS.stMult) ?? d.ind.st.mult;
  }
  if (ri.bb && typeof ri.bb === 'object') {
    d.ind.bb.on = !!ri.bb.on;
    d.ind.bb.period = inLimit(ri.bb.period, LIMITS.bbPeriod) ?? d.ind.bb.period;
    d.ind.bb.mult = inLimit(ri.bb.mult, LIMITS.bbMult) ?? d.ind.bb.mult;
  }
  if (ri.pane && typeof ri.pane === 'object') {
    if (PANES.includes(ri.pane.kind)) d.ind.pane.kind = ri.pane.kind;
    d.ind.pane.rsi = inLimit(ri.pane.rsi, LIMITS.rsi) ?? d.ind.pane.rsi;
  }
  if (Array.isArray(raw.sma)) {
    raw.sma.slice(0, 3).forEach((x, i) => {
      if (!x) return;
      d.sma[i].on = !!x.on;
      const p = Math.round(Number(x.period));
      if (p >= 2 && p <= 200) d.sma[i].period = p;
    });
  }
  return d;
}

function loadSaved() {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return clone(DEFAULTS); }
}

let saved = loadSaved();
let draft = null;
let deps = { inr: (v) => String(v), onSave: () => {} };

export function get() { return saved; }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* quota / private mode */ }
}

/** The header's Candle | Line switch saves at once (row 19). */
export function setMode(mode) {
  if (mode !== 'candle' && mode !== 'line') return;
  saved = { ...saved, mode };
  persist();
  deps.onSave(saved);
}

/* ----------------------------------------------------------------- colour */

function parseColor(s) {
  s = String(s ?? '').trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const ca = parseColor(a), cb = parseColor(b);
  if (!ca || !cb) return 21;
  const la = luminance(ca), lb = luminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

/**
 * Row 15 + amendment 27. A custom background carries its own text tokens inside the chart:
 * `data-chartbg="dark"` or `"light"` by the background's luminance, so axis labels stay
 * readable on a dark swatch under the light theme (and on a light custom colour under dark).
 */
export function applyBg(el, style) {
  if (style.bg === 'theme') {
    el.removeAttribute('data-chartbg');
    el.style.removeProperty('--chart-bg');
    el.style.removeProperty('--bg-panel');
    return;
  }
  const rgb = parseColor(style.bg);
  el.setAttribute('data-chartbg', rgb && luminance(rgb) > 0.4 ? 'light' : 'dark');
  el.style.setProperty('--chart-bg', style.bg);
  // The pills print their text in --bg-panel; inside a custom background that IS the background.
  el.style.setProperty('--bg-panel', style.bg);
}

/** The colour a side will actually be painted, in the context of `el` (whose data-chartbg
 *  decides what "theme" resolves to). */
function resolveSide(el, style, side) {
  const v = style[side];
  return v === 'theme' ? cssVar(el, side === 'up' ? '--up' : '--down') : v;
}

/**
 * Row 18, at paint time. A saved colour that no longer clears 3:1 — White saved on a dark
 * background, then the theme switched to light — falls back to the theme's own colour rather
 * than painting candles nobody can see.
 */
export function colours(el, style) {
  const bg = cssVar(el, '--chart-bg');
  const out = {};
  for (const side of ['up', 'down']) {
    const want = resolveSide(el, style, side);
    out[side] = style[side] !== 'theme' && contrast(want, bg) < MIN_CONTRAST
      ? `var(--${side})` : (style[side] === 'theme' ? `var(--${side})` : want);
  }
  return out;
}

/* ----------------------------------------------------------------- dialog */

const els = {};
let lastFocus = null;
let hover = -1;
let dirty = false;

export function isOpen() { return !!draft; }

export function init(options) {
  deps = { ...deps, ...options };
  els.root = $('chartStyle');
  els.dialog = els.root.querySelector('.cs');
  els.preview = $('csPreview');
  els.svg = $('csSvg');
  els.msg = $('csMsg');
  els.warn = $('csWarn');

  els.root.addEventListener('pointerdown', (e) => { if (e.target === els.root) close(); });
  $('csClose').addEventListener('click', close);
  $('csSave').addEventListener('click', save);
  $('csReset').addEventListener('click', () => {
    draft = clone(DEFAULTS);
    note('');
    renderControls();
  });
  for (const b of $('csMode').querySelectorAll('button')) {
    b.addEventListener('click', () => { draft.mode = b.dataset.mode; renderControls(); });
  }
  els.root.addEventListener('keydown', onKey);
  // While the dialog is open it owns the keyboard even when focus has fallen out of it (a
  // clicked element that re-rendered takes focus to <body> with it). Without this, Esc after a
  // swatch click reached nothing and the dialog could not be closed from the keyboard.
  document.addEventListener('keydown', (e) => {
    if (draft && !els.root.contains(e.target)) onKey(e);
  }, true);

  els.svg.addEventListener('pointermove', (e) => {
    const f = els.frame;
    if (!f) return;
    const r = els.svg.getBoundingClientRect();
    const x = e.clientX - r.left;
    const t = f.view.t0 + (x / f.plotW) * (f.view.t1 - f.view.t0);
    const i = x <= f.plotW ? uc.indexAt(f.view, t) : -1;
    if (i !== hover) { hover = i; dirty = true; }
  });
  els.svg.addEventListener('pointerleave', () => { hover = -1; dirty = true; });

  new ResizeObserver(() => { dirty = true; }).observe(els.svg);
  requestAnimationFrame(loop);
}

export function open() {
  if (draft) return;
  lastFocus = document.activeElement;
  draft = clone(saved);
  hover = -1;
  note('');
  els.root.hidden = false;
  renderControls();
  const d = uc.current();
  $('csSym').textContent = d.data?.label ?? d.label ?? '';
  $('csName').textContent = d.data?.displayName ?? '';
  // Row 20: focus lands on the chosen chart type, the first control.
  requestAnimationFrame(() => $('csMode').querySelector('[aria-checked="true"]')?.focus());
}

export function close() {
  if (!draft) return;
  draft = null;
  els.root.hidden = true;
  els.frame = null;
  // Row 20: focus goes back to whatever opened the dialog.
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function save() {
  saved = sanitize(draft);
  persist();
  close();
  deps.onSave(saved);
}

function note(text) { els.warn.textContent = text; els.warn.hidden = !text; }

/** Repaint the preview whenever the data (a tick, a refresh) or the draft changes. */
export function repaint() { dirty = true; }

function loop() {
  if (dirty && draft) { dirty = false; paintPreview(); }
  requestAnimationFrame(loop);
}

function paintPreview() {
  applyBg(els.preview, draft);
  const svg = els.svg;
  const box = svg.getBoundingClientRect();
  const W = Math.max(1, Math.round(box.width));
  const H = Math.max(1, Math.round(box.height));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const st = uc.current();
  const view = uc.buildView(st.data, draft);
  if (!view) {
    svg.innerHTML = '';
    els.frame = null;
    els.msg.hidden = false;
    els.msg.textContent = st.message ?? (st.loading ? 'loading candles…' : 'no candles');
    return;
  }
  els.msg.hidden = true;

  // P58 row 2: the preview shows the draft's lower pane the same way the strip does.
  const paneH = draft.mode === 'line' ? 0 : uc.paneHeight(draft, H);
  const Hp = H - paneH;
  const plotW = Math.max(1, W - uc.PAD_R);
  const plotH = Math.max(1, Hp - uc.PAD_B);
  const X = (t) => ((t - view.t0) / Math.max(1, view.t1 - view.t0)) * plotW;
  const Y = (p) => plotH - ((p - view.lo) / Math.max(1e-9, view.hi - view.lo)) * plotH;
  els.frame = { view, plotW, X, Y };

  const col = colours(els.preview, draft);
  // Line is P5's tick line in the strip. The preview has no tick history to show, so in Line it
  // draws the same candles' closes as a line — the closest honest picture of "line".
  svg.innerHTML = uc.renderSvg(view, {
    W, H: Hp, X, Y, up: col.up, down: col.down, inr: deps.inr, hover, hoverGuide: true, clipId: 'csClip',
    line: draft.mode === 'line',
  }) + (paneH ? uc.renderPane(view, {
    W, H, top: Hp, X, up: col.up, down: col.down, inr: deps.inr, hover, clipId: 'csClip', pane: draft.ind.pane,
  }) : '');
}

/* --------------------------------------------------------------- controls */

const candleGlyph = (c) =>
  `<svg viewBox="0 0 12 20" width="10" height="17" aria-hidden="true">`
  + `<path d="M6 1V19" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`
  + `<rect x="2.5" y="5" width="7" height="10" rx="1.5" fill="${c}"/></svg>`;

/** Row 18 in the dialog: the colour a swatch would paint against the draft's background. */
function swatchContrast(side, v) {
  const col = v === 'theme' ? cssVar(els.preview, side === 'up' ? '--up' : '--down') : v;
  return contrast(col, cssVar(els.preview, '--chart-bg'));
}

function renderControls() {
  applyBg(els.preview, draft);
  // The swatch rows are rebuilt below; remember which control had focus so it can be handed to
  // its replacement instead of falling to <body>.
  const a = document.activeElement;
  const refocus = a && els.root.contains(a)
    ? { group: a.closest('[role="radiogroup"]')?.id, v: a.dataset?.v, add: a.classList?.contains('add') }
    : null;

  for (const b of $('csMode').querySelectorAll('button')) {
    const on = b.dataset.mode === draft.mode;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }

  // Row 18: a background change can strand a chosen colour under 3:1. Put it back to Theme and
  // say so, rather than leave a disabled swatch selected.
  for (const side of ['up', 'down']) {
    if (draft[side] !== 'theme' && swatchContrast(side, draft[side]) < MIN_CONTRAST) {
      note(`${side === 'up' ? 'Up' : 'Down'} colour reset to Theme — too close to the new background`);
      draft[side] = 'theme';
    }
  }

  swatchRow($('csBg'), BG, 'bg', (o) => {
    const fill = o.v === 'theme' ? 'var(--bg-base)' : o.v;
    return `<i style="background:${fill}"></i>`;
  });
  swatchRow($('csUp'), UP, 'up', (o) => candleGlyph(o.v === 'theme' ? 'var(--up)' : o.v));
  swatchRow($('csDown'), DOWN, 'down', (o) => candleGlyph(o.v === 'theme' ? 'var(--down)' : o.v));
  renderSma();
  renderInd();
  dirty = true;
  if (refocus?.group && refocus.group !== 'csMode') {
    const g = $(refocus.group);
    const el = refocus.add ? g.querySelector('.add') : g.querySelector(`[data-v="${refocus.v}"]`);
    (el && !el.disabled ? el : g.querySelector('[tabindex="0"]'))?.focus();
  }
}

function swatchRow(wrap, list, field, inner) {
  wrap.textContent = '';
  const current = draft[field];
  const known = list.some(o => o.v === current);
  const buttons = [];

  for (const o of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw' + (o.v === 'theme' ? ' theme' : '');
    b.setAttribute('role', 'radio');
    b.dataset.v = o.v;
    b.setAttribute('aria-label', o.name);
    b.title = o.name;
    b.innerHTML = inner(o);
    b.setAttribute('aria-checked', String(o.v === current));
    if (field !== 'bg' && swatchContrast(field, o.v) < MIN_CONTRAST) {
      b.disabled = true;
      b.title = `${o.name} — too close to the background`;
    }
    b.addEventListener('click', () => { draft[field] = o.v; note(''); renderControls(); });
    wrap.appendChild(b);
    buttons.push(b);
  }

  // `+`: the native colour picker. A custom colour that is chosen shows as the + swatch itself.
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'sw add' + (known ? '' : ' custom');
  add.setAttribute('role', 'radio');
  add.setAttribute('aria-checked', String(!known));
  add.setAttribute('aria-label', known ? 'Custom colour' : `Custom colour ${current}`);
  add.title = known ? 'Custom colour' : `Custom ${current}`;
  add.innerHTML = known ? '<span aria-hidden="true">+</span>'
    : (field === 'bg' ? `<i style="background:${current}"></i>` : candleGlyph(current));
  const input = document.createElement('input');
  input.type = 'color';
  input.tabIndex = -1;
  input.className = 'sr-only';
  input.value = HEX.test(current) ? current : '#888888';
  input.addEventListener('change', () => {
    const v = input.value.toUpperCase();
    if (field !== 'bg' && swatchContrast(field, v) < MIN_CONTRAST) {
      note(`${v} is too close to the background (${swatchContrast(field, v).toFixed(1)}:1, needs 3:1)`);
      return;
    }
    draft[field] = v;
    note('');
    renderControls();
  });
  add.addEventListener('click', () => input.click());
  wrap.appendChild(add);
  wrap.appendChild(input);
  buttons.push(add);

  // Roving tabindex (row 20): one stop per group, arrows move within it.
  const sel = buttons.find(b => b.getAttribute('aria-checked') === 'true') ?? buttons[0];
  for (const b of buttons) b.tabIndex = b === sel ? 0 : -1;
}

function renderSma() {
  const wrap = $('csSma');
  wrap.textContent = '';
  draft.sma.forEach((m, i) => {
    const b = document.createElement('div');
    b.className = 'sma';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(m.on));
    b.setAttribute('aria-label', `SMA ${m.period}`);
    b.tabIndex = 0;
    b.innerHTML = `<i style="background:${m.color}"></i><span>SMA</span>`;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '2';
    inp.max = '200';
    inp.step = '1';
    inp.value = String(m.period);
    inp.className = 'mono';
    inp.setAttribute('aria-label', `SMA slot ${i + 1} period`);
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    inp.addEventListener('change', () => {
      const p = Math.round(Number(inp.value));
      if (p >= 2 && p <= 200) { m.period = p; b.setAttribute('aria-label', `SMA ${p}`); }
      inp.value = String(m.period);
      dirty = true;
    });
    b.appendChild(inp);
    const toggle = () => { m.on = !m.on; b.setAttribute('aria-checked', String(m.on)); dirty = true; };
    b.addEventListener('click', toggle);
    b.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
    wrap.appendChild(b);
  });
  // The reference's fourth cell is a `+`; a fourth slot is out of scope, so the cell says how
  // the three that exist are used instead of leaving a hole.
  const hint = document.createElement('div');
  hint.className = 'sma-hint';
  hint.textContent = 'Click to show or hide · type a period, 2–200';
  wrap.appendChild(hint);
}

/**
 * P57 row 15: the Indicators section, the same switch-cell pattern as the SMA slots. A cell with
 * two parameters spans both columns. Inputs never toggle their cell; an out-of-range value snaps
 * back to the last good one (row 8).
 */
function renderInd() {
  const wrap = $('csInd');
  const a = document.activeElement;
  const keep = a && wrap.contains(a) ? (a.dataset.k ?? a.closest('[data-k]')?.dataset.k) + '|' + (a.dataset.f ?? '') : null;
  wrap.textContent = '';
  const I = draft.ind;
  const cell = (k, obj, label, color, inputs, wide) => {
    const b = document.createElement('div');
    b.className = 'sma ind';
    b.dataset.k = k;
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(obj.on));
    b.setAttribute('aria-label', { ST: 'Supertrend', BB: 'Bollinger Bands' }[label] ?? label);
    b.title = { ST: 'Supertrend (ATR period, multiplier)', BB: 'Bollinger Bands (period, deviations)', VWAP: 'VWAP (session)', EMA: 'EMA (period)' }[label];
    b.tabIndex = 0;
    b.innerHTML = `<i style="background:${color}"></i><span>${label}</span>`;
    for (const f of inputs) {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = String(f.lim.min); inp.max = String(f.lim.max); inp.step = String(f.lim.step);
      inp.value = String(obj[f.field]);
      inp.className = 'mono';
      inp.dataset.k = k; inp.dataset.f = f.field;
      inp.setAttribute('aria-label', `${label} ${f.name}`);
      inp.title = f.name;
      inp.addEventListener('click', (e) => e.stopPropagation());
      // Space/Enter must not toggle the cell, but Tab and Esc have to reach the dialog's focus trap: the
      // last of these inputs is the dialog's last focusable, and a swallowed Tab walked out of it.
      inp.addEventListener('keydown', (e) => { if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation(); });
      inp.addEventListener('change', () => {
        const v = inLimit(inp.value, f.lim);
        if (v !== null) obj[f.field] = v;
        inp.value = String(obj[f.field]);
        dirty = true;
      });
      b.appendChild(inp);
    }
    const toggle = () => { obj.on = !obj.on; b.setAttribute('aria-checked', String(obj.on)); dirty = true; };
    b.addEventListener('click', toggle);
    b.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
    wrap.appendChild(b);
  };
  cell('vwap', I.vwap, 'VWAP', I.vwap.color, [], false);
  I.ema.forEach((e, n) => cell(`ema${n}`, e, 'EMA', e.color, [{ field: 'period', name: 'period', lim: LIMITS.ema }], false));
  const trend = `linear-gradient(90deg, ${cssVar(els.preview, '--up')} 50%, ${cssVar(els.preview, '--down')} 50%)`;
  cell('st', I.st, 'ST', trend, [
    { field: 'period', name: 'ATR period', lim: LIMITS.stPeriod },
    { field: 'mult', name: 'multiplier', lim: LIMITS.stMult },
  ], true);
  cell('bb', I.bb, 'BB', I.bb.color, [
    { field: 'period', name: 'period', lim: LIMITS.bbPeriod },
    { field: 'mult', name: 'deviations', lim: LIMITS.bbMult },
  ], true);
  // P58 row 7: the lower pane, a radio group of four chips; the RSI chip carries its period.
  // Label and chips wrap as one unit, so "Pane" never ends a line on its own.
  const unit = document.createElement('div');
  unit.className = 'cs-paneunit';
  const sep = document.createElement('span');
  sep.className = 'cs-indt';
  sep.id = 'csPaneLabel';
  sep.textContent = 'Pane';
  unit.appendChild(sep);
  const group = document.createElement('div');
  group.className = 'cs-pane';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', 'csPaneLabel');
  group.id = 'csPane';
  for (const [kind, label, title] of [['none', '—', 'No lower pane'], ['rsi', 'RSI', 'RSI (period)'], ['macd', 'MACD', 'MACD 12, 26, 9'], ['vol', 'Vol', 'Volume']]) {
    const b = document.createElement('div');
    b.className = 'sma ind pane';
    b.dataset.k = `pane-${kind}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(I.pane.kind === kind));
    b.setAttribute('aria-label', title);
    b.title = title;
    b.tabIndex = I.pane.kind === kind ? 0 : -1;
    b.innerHTML = `<span>${label}</span>`;
    if (kind === 'rsi') {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '2'; inp.max = '100'; inp.step = '1';
      inp.value = String(I.pane.rsi); inp.className = 'mono';
      inp.dataset.k = 'pane-rsi'; inp.dataset.f = 'rsi';
      inp.setAttribute('aria-label', 'RSI period');
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('keydown', (e) => { if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation(); });
      inp.addEventListener('change', () => {
        const v = inLimit(inp.value, LIMITS.rsi);
        if (v !== null) I.pane.rsi = v;
        inp.value = String(I.pane.rsi);
        dirty = true;
      });
      b.appendChild(inp);
    }
    const pick = () => {
      I.pane.kind = kind;
      for (const x of group.children) {
        const on = x.dataset.k === `pane-${kind}`;
        x.setAttribute('aria-checked', String(on));
        x.tabIndex = on ? 0 : -1;
      }
      dirty = true;
    };
    b.addEventListener('click', pick);
    b.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(); }
    });
    group.appendChild(b);
  }
  unit.appendChild(group);
  wrap.appendChild(unit);
  // Hand focus back to the rebuilt control (CLAUDE.md: a re-render takes focus to <body> with it).
  if (keep) {
    const [k, f] = keep.split('|');
    const el = f ? wrap.querySelector(`input[data-k="${k}"][data-f="${f}"]`) : wrap.querySelector(`[data-k="${k}"][role="switch"]`);
    el?.focus();
  }
}

/* ---------------------------------------------------------------- keyboard */

function focusables() {
  return [...els.dialog.querySelectorAll('button, input:not([tabindex="-1"]), [tabindex="0"]')]
    .filter(el => !el.disabled && el.tabIndex >= 0 && el.offsetParent !== null);
}

function onKey(e) {
  // Nothing behind a modal may react: no chip switch on `1`, no chart collapse on `C`.
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }

  if (e.key === 'Tab') {                               // row 20 — focus is trapped
    const list = focusables();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const next = i < 0 ? 0
      : e.shiftKey ? (i === 0 ? list.length - 1 : i - 1) : (i === list.length - 1 ? 0 : i + 1);
    e.preventDefault();
    list[next].focus();
    return;
  }

  const group = e.target.closest?.('[role="radiogroup"]');
  if (group && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const radios = [...group.querySelectorAll('[role="radio"]')].filter(b => !b.disabled);
    const i = radios.indexOf(e.target);
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = radios[(i + dir + radios.length) % radios.length];
    // The + swatch opens a picker on click; arrowing onto it only focuses it.
    if (next.classList.contains('add')) { next.focus(); return; }
    next.click();
    const again = group.querySelector(`[role="radio"][data-v="${next.dataset.v}"]`)
      ?? group.querySelector(`[data-mode="${next.dataset.mode}"]`);
    (again ?? next).focus();
  }
}
