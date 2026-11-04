/* Storage smoke test. No dependencies: node tools/test-storage.mjs
   Uses a fake localStorage, then a blocking one, to prove the fallback path. */

import assert from 'node:assert/strict';

const fake = new Map();
globalThis.localStorage = {
  getItem: (k) => (fake.has(k) ? fake.get(k) : null),
  setItem: (k, v) => fake.set(k, String(v)),
  removeItem: (k) => fake.delete(k)
};

const s = await import('../js/storage.js');

/* defaults */
assert.equal(s.storageStatus().persistent, true);
const blank = s.blankState();
assert.equal(s.get('v'), 1);
assert.equal(blank.streak.count, 0);
assert.deepEqual(blank.mocks, []);

/* whole document round trip */
s.setAll({ ...blank, lang: 'ml', subj: { ren: { a: 2, c: 1 } } });
assert.equal(s.get('lang'), 'ml');
assert.equal(s.getAll().subj.ren.a, 2);

/* single key write keeps the rest */
s.set('theme', 'dark');
assert.equal(s.get('theme'), 'dark');
assert.equal(s.get('lang'), 'ml');

/* export produces a portable envelope */
const text = s.exportState(s.getAll());
assert.equal(JSON.parse(text).format, 'psc-kalari-backup');

/* import: current envelope */
assert.equal(s.importState(text).ok, true);

/* import: raw document written by the old single-file prototype */
const legacy = JSON.stringify({
  subj: { con: { a: 1, c: 1 } },
  daily: { '2026-01-01': { c: 3, n: 5 } },
  streak: { last: '2026-01-01', count: 3, best: 3 },
  mocks: [],
  syl: {},
  theme: 'light',
  lang: 'en'
});
const restored = s.importState(legacy);
assert.equal(restored.ok, true);
assert.equal(restored.state.streak.count, 3);
assert.equal(restored.state.lang, 'en');
assert.deepEqual(restored.state.daily['2026-01-01'], { c: 3, n: 5 });

/* import: rejects junk without throwing */
assert.equal(s.importState('not json').ok, false);
assert.equal(s.importState('{"a":1}').ok, false);
assert.equal(s.importState('null').ok, false);

/* blocked storage falls back to memory instead of crashing */
globalThis.localStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); }
};
s.useDriver(null);
assert.equal(s.storageStatus().persistent, false);
assert.equal(s.setAll(s.blankState()), true);
assert.equal(s.storageStatus().driver, 'memory');

console.log('storage tests passed');
