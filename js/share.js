/* Share to WhatsApp and clipboard helpers for questions and results. */

import { SITE_URL } from './config.js';
import { lang } from './i18n.js';
import { LET } from './util.js';

export const shareIconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

export const copyIconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

export const checkIconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>`;

/**
 * Format question share text:
 * PSC Kalari practice question
 * <question in current language; English then Malayalam in Both mode>
 * A) ... B) ... C) ... D) ... (use the order shown on screen)
 * Try more free questions: <SITE_URL>
 */
export function formatQuestionShare(qData) {
  if (!qData) return '';
  const l = lang();

  const qEn = (qData.q && typeof qData.q === 'object') ? (qData.q.en || '') : (qData.q || '');
  const qMl = (qData.q && typeof qData.q === 'object') ? (qData.q.ml || '') : (qData.mq || '');

  let qText = '';
  if (l === 'en') {
    qText = qEn;
  } else if (l === 'ml') {
    qText = qMl || qEn;
  } else {
    // 'both' mode: English then Malayalam
    qText = qEn && qMl && qMl !== qEn ? `${qEn}\n${qMl}` : (qEn || qMl);
  }

  const optsEn = qData.opts || (qData.options && qData.options.en) || [];
  const optsMl = qData.mopts || (qData.options && qData.options.ml) || [];

  const optLines = optsEn.map((optEn, i) => {
    const optMl = optsMl[i];
    let optText = '';
    if (l === 'en') {
      optText = optEn;
    } else if (l === 'ml') {
      optText = optMl || optEn;
    } else {
      optText = optMl && optMl !== optEn ? `${optEn} / ${optMl}` : (optEn || optMl || '');
    }
    return `${LET[i]}) ${optText}`;
  });

  return [
    'PSC Kalari practice question',
    qText,
    optLines.join('\n'),
    `Try more free questions: ${SITE_URL}`
  ].join('\n\n');
}

export function whatsAppQuestionUrl(qData) {
  return `https://wa.me/?text=${encodeURIComponent(formatQuestionShare(qData))}`;
}

/**
 * Format result share text:
 * "I scored 14.33 out of 20 on the PSC Kalari mini mock. Try it: <SITE_URL>"
 * Uses the exact score shown on screen.
 */
export function formatResultShare(z) {
  if (!z) return '';
  const isMock = z.mode === 'mock';
  const score = isMock ? z.res.sc : z.correct;
  const total = isMock ? z.res.n : z.items.length;
  let testName = z.title || (isMock ? 'mini mock' : 'practice');
  if (isMock) {
    const low = (z.title || '').toLowerCase();
    if (low.includes('mini')) testName = 'mini mock';
    else if (low.includes('full')) testName = 'full mock';
  }
  return `I scored ${score} out of ${total} on the PSC Kalari ${testName}. Try it: ${SITE_URL}`;
}

export function whatsAppResultUrl(z) {
  return `https://wa.me/?text=${encodeURIComponent(formatResultShare(z))}`;
}

/**
 * Copy text to clipboard with fallback to selecting text in a read-only textarea.
 */
export async function copyToClipboard(text) {
  let ok = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.readOnly = true;
      area.setAttribute('aria-hidden', 'true');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      area.style.top = '0';
      document.body.appendChild(area);
      area.focus();
      area.select();
      ok = document.execCommand('copy');
      document.body.removeChild(area);
    } catch {
      ok = false;
    }
  }
  return ok;
}

let toastTimer = null;

/**
 * Display a small "Copied" confirmation announced to screen readers.
 */
export function showCopiedConfirmation(button = null) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = 'Copied';
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.textContent = '';
    }, 2000);
  }
  if (button) {
    button.classList.add('copied');
    const labelEl = button.querySelector('.btn-label');
    const svgEl = button.querySelector('svg');
    if (labelEl) {
      if (!button.dataset.origLabel) button.dataset.origLabel = labelEl.textContent;
      labelEl.textContent = 'Copied!';
      setTimeout(() => {
        if (button.dataset.origLabel) {
          labelEl.textContent = button.dataset.origLabel;
          delete button.dataset.origLabel;
        }
        button.classList.remove('copied');
      }, 2000);
    } else if (svgEl) {
      if (!button.dataset.origSvg) button.dataset.origSvg = svgEl.outerHTML;
      svgEl.outerHTML = checkIconSvg;
      setTimeout(() => {
        if (button.dataset.origSvg) {
          const curSvg = button.querySelector('svg');
          if (curSvg) curSvg.outerHTML = button.dataset.origSvg;
          delete button.dataset.origSvg;
        }
        button.classList.remove('copied');
      }, 2000);
    }
  }
}
