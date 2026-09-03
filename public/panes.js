/* ==========================================================================
   Pane shell + column set — docs/spec/terminal-redesign-v1.md rows 3, 4, 7 (P10a)

   Owns the horizontal splitter and the greeks column toggle, and nothing else.

   It imports nothing and nothing imports it: app.js is upstream and the two talk through
   CustomEvents only (`greeks` and `pane-resize` out of here, read by app.js), which is the same
   one-directional shape scan.js and candles.js already use. No ESM cycle by construction.
   ========================================================================== */

const $ = (id) => document.getElementById(id);

/* Row 4. 190 / 70 are the values .chart-body already carried in app.css before this phase — the
   chart strip does not get resized by a phase that is not about the chart. `legacy` is the P5-era
   key the height is migrated from, once, so a returning user keeps the size they dragged. */
const CHART = { def: 190, min: 70, key: 'pane:chart', legacy: 'chartH' };
const MAX_FRAC = 0.6;      // row 4 — no pane may take more than 60% of the shell
const CHAIN_MIN = 200;     // row 4 — the chain keeps at least this much of the remainder

const shellH = () => $('shell').getBoundingClientRect().height;

/**
 * Row 4 has two ceilings and the smaller one wins: 60% of the shell, and whatever still leaves
 * the chain 200px. `chrome` is measured rather than hardcoded because the chart header wraps at
 * narrow widths — a constant here would let the chain fall under its minimum at 1024px.
 */
function chartMax() {
  const wrap = $('chartWrap').getBoundingClientRect().height;
  const body = $('chartBody').getBoundingClientRect().height;
  const chrome = wrap - body;                       // header + splitter, whatever they measure now
  return Math.max(CHART.min, Math.min(shellH() * MAX_FRAC, shellH() - chrome - CHAIN_MIN));
}

const clampChart = (h) => Math.max(CHART.min, Math.min(chartMax(), h));

function setChartH(h) {
  $('chartBody').style.height = `${clampChart(h)}px`;
  // app.js owns the chart's repaint and the spot pill; it listens for this rather than being
  // called, so this module stays downstream of it.
  document.dispatchEvent(new CustomEvent('pane-resize'));
}

function persist() {
  localStorage.setItem(CHART.key, String(Math.round($('chartBody').getBoundingClientRect().height)));
}

/* Restore before the first paint. Only the *min* is applied here: the 60% ceiling needs a laid-out
   shell to measure against, and at this point in the document there isn't one yet. The first
   resize or drag re-clamps it. */
{
  const saved = localStorage.getItem(CHART.key) ?? localStorage.getItem(CHART.legacy);
  if (saved && Number.isFinite(Number(saved))) {
    $('chartBody').style.height = `${Math.max(CHART.min, Number(saved))}px`;
  }
}

/* ------------------------------------------------------------- splitter #1 */
/* Row 3. The P5 grip generalised, not a second resize idiom: same element, same cursor, same
   pointer-capture drag, plus the keyboard and double-click a `role="separator"` owes a user. */
{
  const split = $('chartGrip');
  let dragging = false, startY = 0, startH = 0;

  split.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    startH = $('chartBody').getBoundingClientRect().height;
    split.classList.add('dragging');
    split.setPointerCapture(e.pointerId);
  });

  split.addEventListener('pointermove', (e) => {
    if (dragging) setChartH(startH + (e.clientY - startY));
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

  split.addEventListener('dblclick', () => { setChartH(CHART.def); persist(); });

  split.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = (e.shiftKey ? 32 : 8) * (e.key === 'ArrowUp' ? -1 : 1);
    setChartH($('chartBody').getBoundingClientRect().height + step);
    persist();
  });

  // A window that shrinks must not leave the chart over its 60% ceiling. Skipped while the chart
  // is collapsed: .chart-body is display:none there, so its measured height is 0 and re-applying
  // it would silently rewrite the stored size to the 70px minimum.
  window.addEventListener('resize', () => {
    if (document.body.classList.contains('nochart')) return;
    setChartH($('chartBody').getBoundingClientRect().height);
  });
}

/* ---------------------------------------------------------- greeks columns */
/* Row 7. Off by default: 17 columns / 1132px, which is the first column set that fits the 1440px
   floor with zero horizontal scroll. On restores today's 25 / 1484px. app.js rebuilds the
   <colgroup> and the two header colspans off the `greeks` event — the <td> nodes themselves are
   never removed, so the CELL index constants there keep pointing at the same cells. */
function setGreeks(on) {
  document.body.classList.toggle('nogreeks', !on);
  localStorage.setItem('cols:greeks', on ? '1' : '0');
  $('greeksBtn').setAttribute('aria-pressed', String(on));
  document.dispatchEvent(new CustomEvent('greeks', { detail: { on } }));
}

$('greeksBtn').addEventListener('click', () => setGreeks(document.body.classList.contains('nogreeks')));
setGreeks(localStorage.getItem('cols:greeks') === '1');

/* Read-only seam for the replay verification scripts, same idea as window.__chart in
   chart-tools.js. Nothing in the app reads this. */
window.__panes = {
  chartDefault: () => CHART.def,
  chartMin: () => CHART.min,
  chartMax,
  shellH,
  greeks: () => !document.body.classList.contains('nogreeks'),
};
