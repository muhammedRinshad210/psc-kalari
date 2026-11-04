/* Light/dark theme. `auto` follows the OS; an explicit choice sets data-theme
   on <html>, which the CSS variables in base.css respond to. */

import { S } from './state.js';

export function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'dark' || S.theme === 'light') root.setAttribute('data-theme', S.theme);
  else root.removeAttribute('data-theme');
  syncThemeColor();
}

export function isDark() {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced) return forced === 'dark';
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function toggleTheme() {
  S.theme = isDark() ? 'light' : 'dark';
  applyTheme();
  return S.theme;
}

/** Keep the browser/OS chrome in step with the page background. */
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute('content', isDark() ? '#0A1511' : '#0E4A3A');
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (S.theme === 'auto') syncThemeColor();
  });
}
