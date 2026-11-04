/* Bilingual text rendering. UI chrome is English; questions, options and
   explanations follow the language chosen in the header (en | ml | both). */

import { S } from './state.js';
import { esc } from './util.js';
import { subjectInfo } from './data.js';

export const LANGS = ['en', 'ml', 'both'];

export function lang() {
  return S.lang === 'en' || S.lang === 'ml' ? S.lang : 'both';
}

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  S.lang = next;
}

/** Render an English/Malayalam pair as HTML for the current language. */
export function tx(en, ml) {
  const l = lang();
  const safeEn = esc(en || '');
  if (!ml || ml === en || l === 'en') return safeEn;
  const safeMl = `<span class="ml" lang="ml">${esc(ml)}</span>`;
  return l === 'ml' ? esc(ml) : safeEn + safeMl;
}

/** Short feedback line after answering. `item` is a built session item. */
export function verdict(ok, item) {
  const l = lang();
  const en = ok ? 'Right.' : `The answer is ${item.opts[item.ans]}.`;
  const ml = ok ? 'ശരി.' : `ശരിയുത്തരം: ${item.mopts[item.ans]}.`;
  if (l === 'en') return esc(en);
  if (l === 'ml') return esc(ml);
  return `${esc(en)} <span class="ml" lang="ml" style="font-weight:400;color:var(--muted)">${esc(ml)}</span>`;
}

/** Localised subject name; falls back to the key before the manifest arrives. */
export function subjectName(key, which = 'en') {
  const info = subjectInfo(key);
  if (!info) return key;
  return which === 'ml' ? info.ml : info.en;
}

export function dateLine(date = new Date()) {
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Reflect the stored language on the header buttons. */
export function syncLangBar(root = document) {
  root.querySelectorAll('.langbar button[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang()));
  });
}
