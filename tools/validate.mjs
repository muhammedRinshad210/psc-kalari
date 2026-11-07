/* Question bank validator. No dependencies: node tools/validate.mjs [--min 300]
   Exits 1 when a question is structurally wrong, so it can gate a deploy. */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const argMin = process.argv.indexOf('--min');
const minTotal = argMin > -1 ? Number(process.argv[argMin + 1]) || 0 : 0;

const subjects = readJson('data/subjects.json').subjects;
const byKey = new Map(subjects.map((s) => [s.key, s]));
const questions = readJson('data/questions.json');

const errors = [];
const warnings = [];
const seenIds = new Set();
const seenText = new Map();
const malayalam = /[\u0D00-\u0D7F]/;
const idPattern = /^[a-z]{2,6}-\d{3}$/;

const fail = (q, message) => errors.push(`${q.id || '(no id)'}: ${message}`);
const warn = (q, message) => warnings.push(`${q.id || '(no id)'}: ${message}`);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

if (!Array.isArray(questions)) {
  console.error('ERROR data/questions.json must be a JSON array.');
  process.exit(1);
}

questions.forEach((q, index) => {
  const where = q && q.id ? q : { id: `#${index}` };

  /* --- identity and taxonomy --- */
  if (!isText(q.id)) fail(where, 'missing id');
  else {
    if (seenIds.has(q.id)) fail(where, 'duplicate id');
    seenIds.add(q.id);
    if (!idPattern.test(q.id)) warn(where, 'id should look like ren-001');
  }

  const subject = byKey.get(q.subject);
  if (!subject) fail(where, `unknown subject "${q.subject}"`);
  else {
    if (!q.id?.startsWith(`${q.subject}-`)) warn(where, `id prefix should be "${q.subject}-"`);
    if (!Array.isArray(subject.topics) || !subject.topics.includes(q.topic)) {
      fail(where, `topic "${q.topic}" is not in data/subjects.json for ${q.subject}`);
    }
  }

  if (![1, 2, 3].includes(q.difficulty)) fail(where, `difficulty must be 1, 2 or 3 (got ${q.difficulty})`);

  /* --- question text, both languages --- */
  if (!q.q || !isText(q.q.en) || !isText(q.q.ml)) fail(where, 'q.en and q.ml must both be filled');
  else {
    if (!malayalam.test(q.q.ml)) fail(where, 'q.ml has no Malayalam characters');
    const key = q.q.en.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenText.has(key)) fail(where, `same English question as ${seenText.get(key)}`);
    else seenText.set(key, q.id);
  }

  /* --- options --- */
  const en = q.options && q.options.en;
  const ml = q.options && q.options.ml;
  if (!Array.isArray(en) || !Array.isArray(ml)) {
    fail(where, 'options.en and options.ml must be arrays');
  } else {
    if (en.length !== 4) fail(where, `needs exactly 4 English options (got ${en.length})`);
    if (ml.length !== 4) fail(where, `needs exactly 4 Malayalam options (got ${ml.length})`);
    [['en', en], ['ml', ml]].forEach(([lang, list]) => {
      if (list.some((o) => !isText(o))) fail(where, `options.${lang} contains an empty option`);
      const norm = list.map((o) => String(o).trim().toLowerCase());
      if (new Set(norm).size !== norm.length) fail(where, `options.${lang} are not unique`);
    });
    /* A missing translation shows up as Malayalam options that are identical
       to the English ones. Years, numbers and chemical symbols are exempt. */
    const sameAsEnglish = en.length === ml.length && en.every((o, i) => o === ml[i]);
    const wordy = en.some((o) => /^[A-Za-z][A-Za-z .'-]{3,}$/.test(String(o)));
    if (q.subject !== 'eng' && sameAsEnglish && wordy) {
      warn(where, 'options.ml is identical to options.en, probably untranslated');
    }
  }

  /* --- answer and explanation --- */
  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
    fail(where, `answerIndex must be 0-3 (got ${q.answerIndex})`);
  } else if (Array.isArray(en) && !isText(en[q.answerIndex])) {
    fail(where, 'answerIndex points at an empty option');
  }

  if (!q.explanation || !isText(q.explanation.en) || !isText(q.explanation.ml)) {
    fail(where, 'explanation.en and explanation.ml must both be filled');
  } else if (/[A-Za-z]{3,}/.test(q.explanation.ml) && !malayalam.test(q.explanation.ml)) {
    /* Pure arithmetic explanations have no prose to translate. */
    fail(where, 'explanation.ml has no Malayalam characters');
  }

  /* --- provenance --- */
  if (!isText(q.source) || q.source.length < 6) fail(where, 'source must name a reference');
  if (typeof q.verified !== 'boolean') fail(where, 'verified must be true or false');
  else if (q.verified) {
    if (!isText(q.reviewedBy) || !/^\d{4}-\d{2}-\d{2}$/.test(q.reviewedOn || '')) {
      fail(where, 'verified is true but reviewedBy (string) and reviewedOn (YYYY-MM-DD) are required');
    }
  } else {
    warn(where, 'shipped while verified is false');
  }
  if (q.reviewedBy !== undefined && !isText(q.reviewedBy)) {
    fail(where, 'reviewedBy must be a non-empty string');
  }
  if (q.reviewedOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(q.reviewedOn)) {
    fail(where, 'reviewedOn must match YYYY-MM-DD');
  }
  if (typeof q.needsReview !== 'boolean') fail(where, 'needsReview must be true or false');
  else if (q.needsReview) warn(where, 'Malayalam flagged needsReview');
});

/* English options stay English on purpose for the English subject. */

/* ---------- balance report ---------- */

const counts = new Map(subjects.map((s) => [s.key, 0]));
const difficulty = { 1: 0, 2: 0, 3: 0 };
const answerSpread = [0, 0, 0, 0];
questions.forEach((q) => {
  counts.set(q.subject, (counts.get(q.subject) || 0) + 1);
  if (difficulty[q.difficulty] !== undefined) difficulty[q.difficulty] += 1;
  if (Number.isInteger(q.answerIndex) && answerSpread[q.answerIndex] !== undefined) answerSpread[q.answerIndex] += 1;
});

if (minTotal && questions.length < minTotal) {
  errors.push(`bank has ${questions.length} questions, minimum is ${minTotal}`);
}

const perSubject = subjects.map((s) => `${s.key} ${counts.get(s.key)}`).join(' · ');
const spread = answerSpread.map((n) => (questions.length ? Math.round((n / questions.length) * 100) : 0));
const flagged = questions.filter((q) => q.needsReview).length;

/* ---------- previous papers hub ---------- */

let paperCount = 0;
let paperTodo = 0;
const papers = readJson('data/papers.json');

if (!/do not host/i.test(papers.notice || '')) {
  errors.push('papers.json: notice must say plainly that papers are not hosted here');
}
if (!/^https:\/\//.test(papers.officialHome || '')) {
  errors.push('papers.json: officialHome must be an https URL');
}

(papers.papers || []).forEach((p, i) => {
  const at = `papers[${i}] (${p.post || 'no post'})`;
  paperCount += 1;
  ['exam', 'post', 'language', 'note'].forEach((field) => {
    if (!String(p[field] || '').trim()) errors.push(`${at}: ${field} is empty`);
  });
  if (!Array.isArray(p.topicsCovered) || !p.topicsCovered.length) {
    errors.push(`${at}: topicsCovered is empty`);
  }
  if (p.officialUrl && !/^https:\/\//.test(p.officialUrl)) {
    errors.push(`${at}: officialUrl must be https or empty`);
  }
  if (!p.officialUrl) paperTodo += 1;
});

if (!papers.analysis || !Array.isArray(papers.analysis.bySubject)) {
  warnings.push('papers.json: no per-subject analysis');
}
if (paperTodo) {
  warnings.push(`papers.json: ${paperTodo} of ${paperCount} papers have no officialUrl yet (TODO, not guessed)`);
}

/* ---------- output ---------- */

console.log(`\nQuestions: ${questions.length}`);
console.log(`Subjects:  ${perSubject}`);
console.log(`Difficulty: easy ${difficulty[1]} · medium ${difficulty[2]} · hard ${difficulty[3]}`);
console.log(`Stored answer position: A ${spread[0]}% · B ${spread[1]}% · C ${spread[2]}% · D ${spread[3]}%  (options are shuffled at runtime)`);
console.log(`Malayalam flagged needsReview: ${flagged}`);
console.log(`Previous papers listed: ${paperCount} (${paperTodo} awaiting a verified official link)`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  WARN  ${w}`));
}

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  errors.forEach((e) => console.log(`  ERROR ${e}`));
  console.log('\nQuestion bank invalid.\n');
  process.exit(1);
}

console.log('\nQuestion bank valid.\n');
