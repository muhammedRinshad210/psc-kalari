/* Error reporting and review notice helper.
   Constructs report form URLs and renders the "Report a mistake" button. */

import { REPORT_FORM_URL, REPORT_FORM_ENTRY_ID } from './config.js';
import { tx, txPlain } from './i18n.js';
import { esc } from './util.js';

/**
 * Builds a prefilled error-reporting form URL for a specific question.
 *
 * Pattern:
 *   REPORT_FORM_URL + ('?' or '&') + 'usp=pp_url&entry.' + entryId + '=' + encodeURIComponent(questionId)
 *
 * If formUrl is empty, returns ''.
 * If entryId is empty, returns formUrl without prefill.
 */
export function buildReportUrl(questionId, formUrl = REPORT_FORM_URL, entryId = REPORT_FORM_ENTRY_ID) {
  if (!formUrl) return '';
  if (!entryId) return formUrl;
  const sep = formUrl.includes('?') ? '&' : '?';
  return `${formUrl}${sep}usp=pp_url&entry.${entryId}=${encodeURIComponent(questionId || '')}`;
}

/**
 * Renders the secondary "Report a mistake" button.
 * When REPORT_FORM_URL is empty, returns an empty string so nothing renders.
 */
export function reportButton(questionId, opts = {}) {
  const url = buildReportUrl(questionId);
  if (!url) return '';
  const label = tx('Report a mistake', 'തെറ്റ് റിപ്പോർട്ട് ചെയ്യുക');
  const ariaLabel = txPlain(
    'Report a mistake for question ' + (questionId || ''),
    'ചോദ്യത്തിലെ തെറ്റ് റിപ്പോർട്ട് ചെയ്യുക ' + (questionId || '')
  );
  const extraClass = opts.cls ? ` ${opts.cls}` : '';
  return `<a class="btn sec report-btn${extraClass}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}">${label}</a>`;
}

/**
 * Review notice shown on Home, Progress, and subject landing pages.
 */
export function reviewNoticeHtml() {
  return tx(
    'These practice questions are written by us and are still being checked against official sources. If you find a mistake, please report it.',
    'ഈ പരിശീലന ചോദ്യങ്ങൾ ഞങ്ങൾ തയ്യാറാക്കിയതാണ്, അവ ഔദ്യോഗിക ഉറവിടങ്ങളുമായി ഒത്തുനോക്കിക്കൊണ്ടിരിക്കുകയാണ്. എന്തെങ്കിലും തെറ്റ് കണ്ടെത്തിയാൽ ദയവായി റിപ്പോർട്ട് ചെയ്യുക.'
  );
}

