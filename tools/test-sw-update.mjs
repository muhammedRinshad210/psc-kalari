/* Tests for Step 11: safe service worker updates and resilient state restoration.
   Run: node tools/test-sw-update.mjs */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve();

// Polyfill localStorage & document for node environment
const fakeStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (fakeStore.has(k) ? fakeStore.get(k) : null),
  setItem: (k, v) => fakeStore.set(k, String(v)),
  removeItem: (k) => fakeStore.delete(k)
};
globalThis.document = {
  getElementById: () => null,
  dispatchEvent: () => true
};
globalThis.CustomEvent = class { constructor(type, detail) { this.type = type; this.detail = detail; } };

const mockMod = await import('../js/mock.js');
const {
  MOCK_STORAGE_KEY,
  clearRunningMock,
  loadRunningMock,
  restoreMockSession,
  viewMock
} = mockMod;

/* --------------------------------------------------------------------------
   1. Corrupt saved mock: must never throw, clears corrupted mock, shows mock screen
-------------------------------------------------------------------------- */
// 1a. Corrupted non-JSON string
localStorage.setItem(MOCK_STORAGE_KEY, '{"unclosed-json-string');
assert.equal(loadRunningMock(), null);
assert.doesNotThrow(() => viewMock(), 'viewMock must not throw with corrupted JSON string');

// 1b. Non-object primitive values
localStorage.setItem(MOCK_STORAGE_KEY, '"just-a-string"');
assert.equal(restoreMockSession('just-a-string'), false);
assert.equal(loadRunningMock(), null);

localStorage.setItem(MOCK_STORAGE_KEY, '12345');
assert.equal(restoreMockSession(12345), false);
assert.equal(loadRunningMock(), null);

// 1c. Unknown/missing question ID
localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({
  kind: 'mini',
  endsAt: Date.now() + 600000,
  qids: ['totally-unknown-question-id-999'],
  optOrders: [[0, 1, 2, 3]]
}));
assert.doesNotThrow(() => {
  const restored = restoreMockSession(JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY)));
  assert.equal(restored, false, 'restoreMockSession must return false for unknown question id');
}, 'restoreMockSession must never throw on unknown question id');
assert.equal(loadRunningMock(), null, 'corrupt mock with unknown question must be cleared from storage');

const mockHtml1 = viewMock();
assert.ok(mockHtml1.includes('Start the test'), 'mock screen must render normally after corrupt mock is cleared');
assert.ok(!mockHtml1.includes('mockResumeBtn'), 'resume button must not render for cleared corrupt mock');

/* --------------------------------------------------------------------------
   2. Old-shape saved mock: must never throw, clears mock, shows mock screen
-------------------------------------------------------------------------- */
// 2a. Missing qids
localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({
  kind: 'mini',
  score: 15,
  endsAt: Date.now() + 50000
}));
assert.doesNotThrow(() => {
  assert.equal(restoreMockSession(JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY))), false);
});
assert.equal(loadRunningMock(), null);

// 2b. Mismatched qids and optOrders
localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({
  kind: 'mini',
  endsAt: Date.now() + 50000,
  qids: ['geo-001', 'geo-002'],
  optOrders: [[0, 1, 2, 3]] // only 1 order for 2 questions
}));
assert.doesNotThrow(() => {
  assert.equal(restoreMockSession(JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY))), false);
});
assert.equal(loadRunningMock(), null);

// 2c. Invalid endsAt (string, negative, NaN)
localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({
  kind: 'mini',
  endsAt: 'tomorrow',
  qids: ['geo-001'],
  optOrders: [[0, 1, 2, 3]]
}));
assert.doesNotThrow(() => {
  viewMock();
});
assert.equal(loadRunningMock(), null);

localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({
  kind: 'mini',
  endsAt: -100,
  qids: ['geo-001'],
  optOrders: [[0, 1, 2, 3]]
}));
assert.doesNotThrow(() => {
  viewMock();
});
assert.equal(loadRunningMock(), null);

const mockHtml2 = viewMock();
assert.ok(mockHtml2.includes('Start the test'), 'mock screen renders normally after old-shape mock cleared');

/* --------------------------------------------------------------------------
   3. Failed then retried load: do not cache rejected promise forever
-------------------------------------------------------------------------- */
const dataMod = await import('../js/data.js');
dataMod._resetDataCache();

// Simulate fetch failure
let shouldFail = true;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (shouldFail) {
    throw new Error('Network error: simulated offline failure');
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      schema: 1,
      total: 10,
      subjects: [{ key: 'geo', slug: 'geography', en: 'Geography', ml: 'ഭൂമിശാസ്ത്രം', count: 10 }]
    })
  };
};

// First attempt: must fail with network error
let failedFirst = false;
try {
  await dataMod.loadIndex();
} catch (err) {
  failedFirst = true;
  assert.ok(err.message.includes('Network error'));
}
assert.ok(failedFirst, 'First loadIndex() must reject on fetch failure');

// Second attempt (retry): shouldFail is now false; loadIndex must try again and succeed!
shouldFail = false;
const indexData = await dataMod.loadIndex();
assert.ok(indexData, 'loadIndex() must succeed on retry and not be stuck on rejected promise');
assert.equal(indexData.total, 10);
assert.equal(dataMod.subjectKeys()[0], 'geo');

// Restore original fetch
globalThis.fetch = originalFetch;

/* --------------------------------------------------------------------------
   4. Build that changes the cache name: sw.js CACHE_NAME updates deterministically
-------------------------------------------------------------------------- */
const swPath = path.join(root, 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');

// Ensure sw.js contains current CACHE_NAME and deletes older caches on activate
const matchCache = swContent.match(/const CACHE_NAME = '([^']+)';/);
assert.ok(matchCache, 'sw.js must define CACHE_NAME');
const currentCache = matchCache[1];
assert.ok(currentCache.startsWith('psc-kalari-'), 'CACHE_NAME must start with psc-kalari-');

assert.ok(swContent.includes('keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))'),
  'sw.js activate must delete all non-current caches');
assert.ok(swContent.includes('self.clients.claim()'),
  'sw.js activate must claim clients');
assert.ok(swContent.includes('cache.addAll(PRECACHE_URLS)'),
  'sw.js must atomically precache all shell URLs');
assert.ok(swContent.includes('fetchWithTimeout(request, 4000)'),
  'sw.js must use 4-second timeout for network-first');

/* --------------------------------------------------------------------------
   5. Editing a JS file changes CACHE_NAME in sw.js
-------------------------------------------------------------------------- */
const { execFileSync } = await import('node:child_process');

// Run build to get baseline cache name
execFileSync('node', ['tools/build.mjs'], { stdio: 'pipe' });
const baselineSw = fs.readFileSync(swPath, 'utf8');
const baselineCacheMatch = baselineSw.match(/const CACHE_NAME = '([^']+)';/);
assert.ok(baselineCacheMatch, 'Must find CACHE_NAME in sw.js');
const baselineCache = baselineCacheMatch[1];

// Edit a JS file (e.g. js/config.js)
const targetJsPath = path.join(root, 'js/config.js');
const originalJsContent = fs.readFileSync(targetJsPath, 'utf8');

try {
  // Append a harmless comment to js/config.js
  fs.writeFileSync(targetJsPath, originalJsContent + '\n// test-cache-hash-invalidation\n', 'utf8');

  // Re-run build
  execFileSync('node', ['tools/build.mjs'], { stdio: 'pipe' });
  const modifiedSw = fs.readFileSync(swPath, 'utf8');
  const modifiedCacheMatch = modifiedSw.match(/const CACHE_NAME = '([^']+)';/);
  assert.ok(modifiedCacheMatch, 'Must find CACHE_NAME after build');
  const modifiedCache = modifiedCacheMatch[1];

  assert.notEqual(
    modifiedCache,
    baselineCache,
    `Editing a JS file must change CACHE_NAME! (was ${baselineCache}, still ${modifiedCache})`
  );
} finally {
  // Restore original JS file content and re-build
  fs.writeFileSync(targetJsPath, originalJsContent, 'utf8');
  execFileSync('node', ['tools/build.mjs'], { stdio: 'pipe' });

  const restoredSw = fs.readFileSync(swPath, 'utf8');
  const restoredCacheMatch = restoredSw.match(/const CACHE_NAME = '([^']+)';/);
  assert.equal(
    restoredCacheMatch[1],
    baselineCache,
    'Restoring JS file must restore baseline CACHE_NAME'
  );
}

console.log('service worker update and resilience tests passed');

