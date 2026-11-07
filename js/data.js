/* Question data access.
   data/index.json is a small manifest; question bodies are one file per
   subject under data/q/ so a phone only downloads what it practises first. */

const DATA_BASE = new URL('../data/', import.meta.url);

export const MIN_QUESTIONS = 20;

let indexPromise = null;
let index = null;
const chunks = new Map();      // subject key -> questions
const byId = new Map();        // question id -> question
let allPromise = null;
let papersPromise = null;

async function fetchJson(relative) {
  const url = new URL(relative, DATA_BASE);
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Could not load ${relative} (${res.status})`);
  return res.json();
}

/** Manifest: subject names, topics, counts. Call once during boot. */
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetchJson('index.json').then((data) => {
      index = data;
      return data;
    });
  }
  return indexPromise;
}

export function subjectList() {
  return index ? index.subjects : [];
}

/** Subjects that currently have questions, in manifest order. */
export function activeSubjects() {
  return subjectList().filter((s) => s.count > 0);
}

export function subjectInfo(key) {
  return subjectList().find((s) => s.key === key) || null;
}

export function subjectKeys() {
  return activeSubjects().map((s) => s.key);
}

export function totalQuestions() {
  return index ? index.total : 0;
}

/** Load one subject's questions (cached in memory). */
export async function loadQuestions(key) {
  if (chunks.has(key)) return chunks.get(key);
  const data = await fetchJson(`q/${key}.json`);
  const list = data.questions || data;
  list.forEach((q) => byId.set(q.id, q));
  chunks.set(key, list);
  return list;
}

/** Every question of every active subject. Used by the daily set and mocks. */
export function loadAllQuestions() {
  if (!allPromise) {
    allPromise = Promise.all(subjectKeys().map((k) => loadQuestions(k)))
      .then((lists) => lists.flat());
  }
  return allPromise;
}

export function questionById(id) {
  return byId.get(id) || null;
}

/** Previous-papers catalogue and syllabus analysis. Only the papers screen needs it. */
export function loadPapers() {
  if (!papersPromise) papersPromise = fetchJson('papers.json');
  return papersPromise;
}
