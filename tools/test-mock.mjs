/* Unit tests for mock papers, scoring, balanced draw, and resume persistence.
   Run: node tools/test-mock.mjs */

import assert from 'node:assert/strict';

// Polyfill localStorage for node environment
const fakeStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (fakeStore.has(k) ? fakeStore.get(k) : null),
  setItem: (k, v) => fakeStore.set(k, String(v)),
  removeItem: (k) => fakeStore.delete(k)
};

const {
  score,
  drawBalanced,
  PAPERS,
  FULL_QUESTIONS,
  FULL_MINUTES,
  MOCK_STORAGE_KEY,
  saveRunningMock,
  loadRunningMock,
  clearRunningMock,
  viewMock
} = await import('../js/mock.js');

/* --- 1. Scoring formula pure function --- */
// 60 correct and 30 wrong gives 50 (specifically requested in user prompt)
assert.equal(score(60, 30), 50);
assert.equal(score(20, 0), 20);
assert.equal(score(0, 3), -1);
assert.equal(score(14, 2), 13.33);
assert.equal(score(0, 0), 0);

/* --- 2. PAPERS constants --- */
assert.equal(FULL_QUESTIONS, 100);
assert.equal(FULL_MINUTES, 75);
assert.equal(PAPERS.mini.n, 20);
assert.equal(PAPERS.mini.minutes, 20);
assert.equal(PAPERS.full.n, 100);
assert.equal(PAPERS.full.minutes, 75);

/* --- 3. Balanced draw: round-robin across subjects --- */
const questions = [];
// 8 subjects with varying question pool sizes: ren (40), con (40), others (6 each)
for (let i = 1; i <= 40; i++) questions.push({ id: `ren-${i}`, subject: 'ren' });
for (let i = 1; i <= 40; i++) questions.push({ id: `con-${i}`, subject: 'con' });
for (let i = 1; i <= 6; i++) questions.push({ id: `geo-${i}`, subject: 'geo' });
for (let i = 1; i <= 6; i++) questions.push({ id: `sci-${i}`, subject: 'sci' });
for (let i = 1; i <= 6; i++) questions.push({ id: `math-${i}`, subject: 'math' });
for (let i = 1; i <= 6; i++) questions.push({ id: `eng-${i}`, subject: 'eng' });
for (let i = 1; i <= 6; i++) questions.push({ id: `ker-${i}`, subject: 'ker' });
for (let i = 1; i <= 6; i++) questions.push({ id: `his-${i}`, subject: 'his' });

// Test mini mock draw (20 questions)
const miniDrawn = drawBalanced(questions, 20, () => 0.5);
assert.equal(miniDrawn.length, 20);

// Check that no subject dominates: with 8 subjects and 20 questions,
// each subject should have between 2 and 3 questions
const miniCounts = {};
for (const q of miniDrawn) {
  miniCounts[q.subject] = (miniCounts[q.subject] || 0) + 1;
}
assert.equal(Object.keys(miniCounts).length, 8);
for (const [subj, count] of Object.entries(miniCounts)) {
  assert.ok(count >= 2 && count <= 3, `Subject ${subj} got ${count} questions (expected 2-3)`);
}

// Test full mock draw (100 questions from 116 available)
const fullDrawn = drawBalanced(questions, 100, () => 0.5);
assert.equal(fullDrawn.length, 100);
const fullCounts = {};
for (const q of fullDrawn) {
  fullCounts[q.subject] = (fullCounts[q.subject] || 0) + 1;
}
// Thin subjects had 6 questions; all 6 should have been included
assert.equal(fullCounts.geo, 6);
assert.equal(fullCounts.sci, 6);
assert.equal(fullCounts.math, 6);
assert.equal(fullCounts.eng, 6);
assert.equal(fullCounts.ker, 6);
assert.equal(fullCounts.his, 6);
// Remaining 64 questions distributed evenly between ren and con (32 each)
assert.equal(fullCounts.ren, 32);
assert.equal(fullCounts.con, 32);

/* --- 4. Resume storage persistence --- */
clearRunningMock();
assert.equal(loadRunningMock(), null);

const mockSessionData = {
  kind: 'mini',
  title: 'Mini mock test',
  limit: 1200,
  endsAt: Date.now() + 600000,
  i: 3,
  answers: { 0: 1, 1: 3, 2: 0 },
  qids: ['ren-001', 'con-002', 'geo-003', 'sci-004'],
  optOrders: [[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2], [2, 3, 0, 1]]
};

saveRunningMock(mockSessionData);
const loaded = loadRunningMock();
assert.ok(loaded);
assert.equal(loaded.kind, 'mini');
assert.equal(loaded.i, 3);
assert.deepEqual(loaded.answers, { 0: 1, 1: 3, 2: 0 });
assert.deepEqual(loaded.qids, ['ren-001', 'con-002', 'geo-003', 'sci-004']);
assert.deepEqual(loaded.optOrders[1], [3, 2, 1, 0]);

clearRunningMock();
assert.equal(loadRunningMock(), null);

/* --- 5. Mock screen view rendering and locked paper --- */
const html = viewMock();
// Since questions bank currently has 116 questions, full paper is locked below 300
assert.ok(html.includes('Full paper unlocks at 300 questions (now 0)') || html.includes('Full paper unlocks at 300 questions'));
// Mini mock test is available
assert.ok(html.includes('Mini mock test'));

console.log('mock and resume tests passed');
