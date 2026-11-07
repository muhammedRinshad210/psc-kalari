/* Unit tests for WhatsApp share and copy functionality.
   Run: node tools/test-share.mjs */

import assert from 'node:assert/strict';
import { SITE_URL } from '../js/config.js';
import { setLang } from '../js/i18n.js';
import {
  formatQuestionShare,
  formatResultShare,
  whatsAppQuestionUrl,
  whatsAppResultUrl,
  copyToClipboard
} from '../js/share.js';

// Setup fake storage for i18n/state
const fakeStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (fakeStore.has(k) ? fakeStore.get(k) : null),
  setItem: (k, v) => fakeStore.set(k, String(v)),
  removeItem: (k) => fakeStore.delete(k)
};

assert.equal(SITE_URL, 'https://psckalari.pages.dev/');

const sampleQuestion = {
  id: 'ren-001',
  subject: 'ren',
  q: {
    en: 'The Vaikom Satyagraha began in which year?',
    ml: 'വൈക്കം സത്യാഗ്രഹം ഏത് വർഷമാണ് ആരംഭിച്ചത്?'
  },
  options: {
    en: ['1924', '1921', '1930', '1936'],
    ml: ['1924', '1921', '1930', '1936']
  },
  answerIndex: 0
};

const sampleSessionItem = {
  id: 'ren-003',
  s: 'ren',
  q: 'Who was the first general secretary of the SNDP Yogam?',
  mq: 'എസ്.എൻ.ഡി.പി. യോഗത്തിന്റെ ആദ്യ ജനറൽ സെക്രട്ടറി ആരായിരുന്നു?',
  opts: ['Kumaran Asan', 'Dr. Palpu', 'Ayyankali', 'Chattampi Swamikal'],
  mopts: ['കുമാരനാശാൻ', 'ഡോ. പല്പു', 'അയ്യങ്കാളി', 'ചട്ടമ്പിസ്വാമികൾ'],
  ans: 0
};

/* --- 1. formatQuestionShare in 'en' mode --- */
setLang('en');
let shareEn = formatQuestionShare(sampleQuestion);
assert.match(shareEn, /^PSC Kalari practice question\n\nThe Vaikom Satyagraha began in which year\?\n\nA\) 1924\nB\) 1921\nC\) 1930\nD\) 1936\n\nTry more free questions: https:\/\/psckalari\.pages\.dev\/$/);
assert.equal(shareEn.includes('Answer'), false);
assert.equal(shareEn.includes('Correct'), false);

/* --- 2. formatQuestionShare in 'ml' mode --- */
setLang('ml');
let shareMl = formatQuestionShare(sampleQuestion);
assert.match(shareMl, /^PSC Kalari practice question\n\nവൈക്കം സത്യാഗ്രഹം ഏത് വർഷമാണ് ആരംഭിച്ചത്\?\n\nA\) 1924\nB\) 1921\nC\) 1930\nD\) 1936\n\nTry more free questions: https:\/\/psckalari\.pages\.dev\/$/);

/* --- 3. formatQuestionShare in 'both' mode --- */
setLang('both');
let shareBoth = formatQuestionShare(sampleSessionItem);
assert.ok(shareBoth.startsWith('PSC Kalari practice question\n\nWho was the first general secretary of the SNDP Yogam?\nഎസ്.എൻ.ഡി.പി. യോഗത്തിന്റെ ആദ്യ ജനറൽ സെക്രട്ടറി ആരായിരുന്നു?'));
assert.ok(shareBoth.includes('A) Kumaran Asan / കുമാരനാശാൻ\nB) Dr. Palpu / ഡോ. പല്പു\nC) Ayyankali / അയ്യങ്കാളി\nD) Chattampi Swamikal / ചട്ടമ്പിസ്വാമികൾ'));
assert.ok(shareBoth.endsWith('Try more free questions: https://psckalari.pages.dev/'));

/* --- 4. whatsAppQuestionUrl --- */
let waUrl = whatsAppQuestionUrl(sampleSessionItem);
assert.ok(waUrl.startsWith('https://wa.me/?text='));
let decodedText = decodeURIComponent(waUrl.replace('https://wa.me/?text=', ''));
assert.equal(decodedText, shareBoth);

/* --- 5. formatResultShare --- */
const mockSession = {
  mode: 'mock',
  title: 'Mini mock test',
  res: { sc: 14.33, n: 20 },
  items: new Array(20)
};
let mockResult = formatResultShare(mockSession);
assert.equal(mockResult, 'I scored 14.33 out of 20 on the PSC Kalari mini mock. Try it: https://psckalari.pages.dev/');

let waMockUrl = whatsAppResultUrl(mockSession);
assert.equal(waMockUrl, `https://wa.me/?text=${encodeURIComponent(mockResult)}`);

const practiceSession = {
  mode: 'daily',
  title: 'Today’s five',
  correct: 5,
  items: new Array(5)
};
let practiceResult = formatResultShare(practiceSession);
assert.equal(practiceResult, 'I scored 5 out of 5 on the PSC Kalari Today’s five. Try it: https://psckalari.pages.dev/');

/* --- 6. copyToClipboard with navigator.clipboard --- */
let clipboardWritten = '';
Object.defineProperty(globalThis, 'navigator', {
  value: {
    clipboard: {
      writeText: async (t) => { clipboardWritten = t; }
    }
  },
  configurable: true,
  writable: true
});
let copied = await copyToClipboard('Test copy text');
assert.equal(copied, true);
assert.equal(clipboardWritten, 'Test copy text');

/* --- 7. copyToClipboard fallback to textarea --- */
Object.defineProperty(globalThis, 'navigator', {
  value: {},
  configurable: true,
  writable: true
});
let appendedText = '';
let executedCmd = '';
let selected = false;

globalThis.document = {
  createElement: (tag) => {
    return {
      tagName: tag,
      style: {},
      setAttribute: () => {},
      focus: () => {},
      select: () => { selected = true; }
    };
  },
  body: {
    appendChild: (el) => { appendedText = el.value; },
    removeChild: () => {}
  },
  execCommand: (cmd) => {
    executedCmd = cmd;
    return true;
  }
};

let fallbackCopied = await copyToClipboard('Fallback test text');
assert.equal(fallbackCopied, true);
assert.equal(appendedText, 'Fallback test text');
assert.equal(selected, true);
assert.equal(executedCmd, 'copy');

console.log('share and copy tests passed');
