/* Small presentational helpers shared by screens. */

import { esc } from './util.js';

/** Ask the app shell to repaint. Screens stay decoupled from the router. */
export function requestRender(keepScroll = false) {
  document.dispatchEvent(new CustomEvent('kalari:render', { detail: { keepScroll } }));
}

export function ring(percent, label) {
  const c = 2 * Math.PI * 42;
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return `<svg viewBox="0 0 100 100" class="ring" role="img" aria-label="${esc(label || `${p} percent`)}">
    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" stroke-width="10"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--brand)" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="57" text-anchor="middle" class="ring-t">${p}%</text></svg>`;
}

/** Vertical bars for mock scores. `max` is the paper's full marks. */
export function bars(list, max) {
  if (!list.length) return '';
  const top = max || Math.max(...list.map((m) => m.n), 1);
  const body = list.map((m) => {
    const pct = Math.max(0, m.sc) / top;
    const label = `${m.d.slice(8)}/${m.d.slice(5, 7)}`;
    return `<div class="bar" title="${esc(`${label}: ${m.sc} of ${m.n}`)}">
      <span class="bv">${esc(m.sc)}</span>
      <i style="height:${Math.max(4, Math.round(pct * 0.85))}px"></i>
      <span class="bd">${esc(label)}</span></div>`;
  }).join('');
  return `<div class="bars" role="img" aria-label="Scores of your recent mock tests">${body}</div>`;
}

export function loadingCard(text = 'Loading questions…') {
  return `<section class="card stack" aria-live="polite">
    <span class="eyebrow">One moment</span>
    <p>${esc(text)}</p>
    <div class="skel-line"></div><div class="skel-line short"></div>
  </section>`;
}

export function errorCard(message, action = 'retry') {
  return `<section class="card stack" role="alert">
    <span class="eyebrow">Something went wrong</span>
    <p>${esc(message)}</p>
    <p class="sub">Check your connection and try again. Your saved progress is not affected.</p>
    <div class="row"><button type="button" class="btn sm" data-act="${esc(action)}">Try again</button></div>
  </section>`;
}

export function emptyCard(title, text, actionHtml = '') {
  return `<section class="card stack empty">
    <b style="font-family:var(--f-display);font-size:var(--t-lg)">${esc(title)}</b>
    <p class="sub">${esc(text)}</p>
    ${actionHtml ? `<div class="row">${actionHtml}</div>` : ''}
  </section>`;
}

export function scrollTop() {
  window.scrollTo(0, 0);
}
