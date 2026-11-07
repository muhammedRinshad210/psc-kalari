/* Check that no file in js/ contains tx( inside an HTML attribute value.
   Run: node tools/check-attrs.mjs */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setLang, txPlain } from '../js/i18n.js';

// Setup fake storage for i18n/state
const fakeStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (fakeStore.has(k) ? fakeStore.get(k) : null),
  setItem: (k, v) => fakeStore.set(k, String(v)),
  removeItem: (k) => fakeStore.delete(k)
};

/* --- 1. Unit tests for txPlain --- */
setLang('en');
assert.equal(txPlain('Search', 'തിരയുക'), 'Search');
assert.equal(txPlain('Search "quote"', 'തിരയുക "ഉദ്ധരണി"'), 'Search &quot;quote&quot;');

setLang('ml');
assert.equal(txPlain('Search', 'തിരയുക'), 'തിരയുക');
assert.equal(txPlain('Search "quote"', 'തിരയുക "ഉദ്ധരണി"'), 'തിരയുക &quot;ഉദ്ധരണി&quot;');

setLang('both');
assert.equal(txPlain('Search', 'തിരയുക'), 'Search / തിരയുക');
assert.equal(txPlain('Search "quote"', 'തിരയുക "ഉദ്ധരണി"'), 'Search &quot;quote&quot; / തിരയുക &quot;ഉദ്ധരണി&quot;');
assert.equal(txPlain('Only English', ''), 'Only English');
assert.equal(txPlain('Same', 'Same'), 'Same');

console.log('txPlain unit tests passed');

// Matches attr="..." or attr='...' where tx( is inside the attribute value before the closing quote or tag boundary
const attrWithTxRegex = /\b([a-zA-Z0-9-:]+)\s*=\s*(["'])(?:(?!\2)[^\n>])*\btx\s*\(/g;

/* --- 2. Unit test the attribute detection regex --- */
const testBadSnippets = [
  '<input placeholder="${tx(\'a\', \'b\')}">',
  '<input aria-label="${tx(\'a\', \'b\')}">',
  '<button title="${tx(\'a\', \'b\')}"></button>',
  '<a aria-label=\'${tx("a", "b")}\'></a>',
  '<div data-tip="Prefix ${tx(\'a\', \'b\')}"></div>'
];

for (const snippet of testBadSnippets) {
  const re = new RegExp(attrWithTxRegex.source, 'g');
  assert.ok(re.test(snippet), `Regex must detect bad snippet: ${snippet}`);
}

const testGoodSnippets = [
  '<input placeholder="${txPlain(\'a\', \'b\')}">',
  '<input aria-label="${txPlain(\'a\', \'b\')}">',
  '<div class="scard" data-k="${subject.key}"><span>${tx(\'a\', \'b\')}</span></div>',
  '<p class="qtext">${tx(item.q, item.mq)}</p>',
  '<b>${tx(\'Explanation\', \'വിശദീകരണം\')}</b>'
];

for (const snippet of testGoodSnippets) {
  const re = new RegExp(attrWithTxRegex.source, 'g');
  assert.ok(!re.test(snippet), `Regex must not false-positive on good snippet: ${snippet}`);
}

/* --- 3. Scan js/ for tx( inside HTML attributes --- */
const jsDir = path.resolve('js');
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));

const errors = [];

for (const file of files) {
  const filePath = path.join(jsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  let match;
  while ((match = attrWithTxRegex.exec(content)) !== null) {
    const attrName = match[1] || 'attribute';
    const lineNum = content.slice(0, match.index).split('\n').length;
    errors.push(`${file}:${lineNum} - tx() found inside attribute "${attrName}". Use txPlain() for attributes.`);
  }
}

if (errors.length > 0) {
  console.error('\nErrors found in HTML attributes:');
  for (const err of errors) {
    console.error(`  ERROR: ${err}`);
  }
  process.exit(1);
}

console.log(`Attribute checks passed (scanned ${files.length} js files for tx() in attributes).`);
