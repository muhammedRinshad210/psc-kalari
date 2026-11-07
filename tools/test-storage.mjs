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
assert.equal(s.SCHEMA_VERSION, 3);
assert.equal(s.get('v'), 3);
assert.equal(blank.streak.count, 0);
assert.deepEqual(blank.mocks, []);
assert.deepEqual(blank.wrong, {});
assert.deepEqual(blank.marks, []);
assert.equal(blank.visits, 0);
assert.equal(blank.installDismissed, false);

/* whole document round trip */
s.setAll({ ...blank, lang: 'ml', subj: { ren: { a: 2, c: 1 } }, marks: ['ren-001'], wrong: { 'ren-002': { n: 1, last: '2026-11-07' } }, visits: 5, installDismissed: true });
assert.equal(s.get('lang'), 'ml');
assert.equal(s.getAll().subj.ren.a, 2);
assert.deepEqual(s.getAll().marks, ['ren-001']);
assert.deepEqual(s.getAll().wrong['ren-002'], { n: 1, last: '2026-11-07' });
assert.equal(s.get('visits'), 5);
assert.equal(s.get('installDismissed'), true);

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
assert.equal(restored.state.v, 3);
assert.equal(restored.state.streak.count, 3);
assert.equal(restored.state.lang, 'en');
assert.deepEqual(restored.state.daily['2026-01-01'], { c: 3, n: 5 });
assert.deepEqual(restored.state.wrong, {});
assert.deepEqual(restored.state.marks, []);
assert.equal(restored.state.visits, 0);
assert.equal(restored.state.installDismissed, false);

/* wrong cap at 300: drops oldest first */
const over = {};
for (let i = 1; i <= 305; i++) {
  const pad = String(i).padStart(3, '0');
  over[`q-${pad}`] = { n: 1, last: `2026-01-${pad}` };
}
s.setAll({ ...blank, wrong: over });
const capped = s.getAll().wrong;
assert.equal(Object.keys(capped).length, 300);
assert.equal(capped['q-001'], undefined);
assert.equal(capped['q-005'], undefined);
assert.notEqual(capped['q-006'], undefined);
assert.notEqual(capped['q-305'], undefined);

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
