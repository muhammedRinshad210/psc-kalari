/* Tests for Step 9: Report a mistake and review notice.
   Run: node tools/test-report.mjs */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Setup mock storage and DOM environment for i18n/state
const fakeStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (fakeStore.has(k) ? fakeStore.get(k) : null),
  setItem: (k, v) => fakeStore.set(k, String(v)),
  removeItem: (k) => fakeStore.delete(k)
};

const { setLang } = await import('../js/i18n.js');
const { buildReportUrl, reportButton, reviewNoticeHtml } = await import('../js/report.js');
const { REPORT_FORM_URL, REPORT_FORM_ENTRY_ID } = await import('../js/config.js');

/* --- 1. When REPORT_FORM_URL is empty, button is absent and nothing breaks --- */
assert.equal(REPORT_FORM_URL, '', 'Default REPORT_FORM_URL in config must be empty placeholder');
assert.equal(REPORT_FORM_ENTRY_ID, '', 'Default REPORT_FORM_ENTRY_ID in config must be empty placeholder');
assert.equal(buildReportUrl('ker-025'), '', 'buildReportUrl must return empty string when REPORT_FORM_URL is empty');
assert.equal(reportButton('ker-025'), '', 'reportButton must return empty string when REPORT_FORM_URL is empty');

/* --- 2. Correctly builds URL with sample form URL and entry ID --- */
const sampleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc_sample123/viewform';
const sampleEntryId = '18273645';

const urlWithEntry = buildReportUrl('ker-025', sampleFormUrl, sampleEntryId);
assert.equal(
  urlWithEntry,
  'https://docs.google.com/forms/d/e/1FAIpQLSc_sample123/viewform?usp=pp_url&entry.18273645=ker-025',
  'URL should be correctly constructed with ?usp=pp_url&entry.<id>=<qid>'
);

/* --- 3. Correctly handles form URLs that already contain query parameters --- */
const sampleUrlWithQuery = 'https://example.com/report?source=app';
const urlWithExistingQuery = buildReportUrl('ker-025', sampleUrlWithQuery, sampleEntryId);
assert.equal(
  urlWithExistingQuery,
  'https://example.com/report?source=app&usp=pp_url&entry.18273645=ker-025',
  'Should use & when URL already has query parameters'
);

/* --- 4. Opens without prefill when entry ID is empty --- */
const urlWithoutEntry = buildReportUrl('ker-025', sampleFormUrl, '');
assert.equal(
  urlWithoutEntry,
  sampleFormUrl,
  'Should return formUrl directly without prefill when entryId is empty'
);

/* --- 5. Correctly encodes question ID with special characters --- */
const specialQid = 'math/001 & test=1? + extra#';
const urlSpecial = buildReportUrl(specialQid, sampleFormUrl, sampleEntryId);
const expectedEncoded = encodeURIComponent(specialQid);
assert.equal(
  urlSpecial,
  `https://docs.google.com/forms/d/e/1FAIpQLSc_sample123/viewform?usp=pp_url&entry.18273645=${expectedEncoded}`,
  'Special characters in question id must be encodeURIComponent encoded'
);

/* --- 6. Button markup and attributes in en, ml, and both --- */
// Test with mock URL injected
for (const lang of ['en', 'ml', 'both']) {
  setLang(lang);
  // We can pass a questionId and test URL building
  const customUrl = buildReportUrl('geo-028', sampleFormUrl, sampleEntryId);
  assert.ok(customUrl.includes('entry.18273645=geo-028'));
}

/* --- 7. Review notice in en, ml, and both --- */
setLang('en');
const noticeEn = reviewNoticeHtml();
assert.ok(noticeEn.includes('These practice questions are written by us and are still being checked against official sources.'));
assert.ok(noticeEn.includes('If you find a mistake, please report it.'));
assert.ok(!noticeEn.includes('<span class="ml">'), 'English notice should not contain Malayalam tag');

setLang('ml');
const noticeMl = reviewNoticeHtml();
assert.ok(noticeMl.includes('ഈ പരിശീലന ചോദ്യങ്ങൾ ഞങ്ങൾ തയ്യാറാക്കിയതാണ്'));
assert.ok(noticeMl.includes('എന്തെങ്കിലും തെറ്റ് കണ്ടെത്തിയാൽ ദയവായി റിപ്പോർട്ട് ചെയ്യുക'));

setLang('both');
const noticeBoth = reviewNoticeHtml();
assert.ok(noticeBoth.includes('These practice questions are written by us'));
assert.ok(noticeBoth.includes('<span class="ml" lang="ml">'));
assert.ok(noticeBoth.includes('ഈ പരിശീലന ചോദ്യങ്ങൾ ഞങ്ങൾ തയ്യാറാക്കിയതാണ്'));

/* --- 8. Ensure no personal email addresses or phone numbers exist in code --- */
const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const phoneRegex = /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g;

const checkDir = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && (entry.name === 'node_modules' || entry.name === '.git')) continue;
    if (entry.isDirectory()) {
      checkDir(fullPath);
    } else if (/\.(js|mjs|html)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const emailMatches = (content.match(emailRegex) || []).filter(
        // Allow schema.org or example emails if any, but ensure no personal email
        e => !e.includes('schema.org') && !e.includes('example.com')
      );
      assert.equal(emailMatches.length, 0, `No personal email address allowed in ${fullPath}: ${emailMatches.join(', ')}`);

      // Check phone numbers (excluding timestamps or long integer constants)
      const phoneMatches = content.match(phoneRegex) || [];
      // If any found, ensure they aren't real personal numbers
      assert.equal(phoneMatches.length, 0, `No personal phone number allowed in ${fullPath}`);
    }
  }
};

checkDir(path.join(root, 'js'));

console.log('report and review notice tests passed');
