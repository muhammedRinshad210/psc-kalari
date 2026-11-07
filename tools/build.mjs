/* Build step (zero dependencies, Node built-ins only).
   data/questions.json is the single source of truth; this script splits it into
   one file per subject for lazy loading and writes the small manifest the app
   reads at boot. Run: npm run build */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const writeJson = (p, value) => writeFileSync(resolve(root, p), `${JSON.stringify(value)}\n`);

const subjects = readJson('data/subjects.json').subjects;
const questions = readJson('data/questions.json');

if (!Array.isArray(questions)) {
  console.error('data/questions.json must be a JSON array of questions.');
  process.exit(1);
}

mkdirSync(resolve(root, 'data/q'), { recursive: true });

const counts = new Map();
for (const subject of subjects) counts.set(subject.key, []);
for (const q of questions) {
  const bucket = counts.get(q.subject);
  if (!bucket) {
    console.error(`Unknown subject "${q.subject}" on question ${q.id}`);
    process.exit(1);
  }
  bucket.push(q);
}

for (const subject of subjects) {
  const list = counts.get(subject.key);
  writeJson(`data/q/${subject.key}.json`, { subject: subject.key, count: list.length, questions: list });
}

const manifest = {
  schema: 1,
  generated: new Date().toISOString(),
  total: questions.length,
  subjects: subjects.map((subject) => {
    const list = counts.get(subject.key);
    const byDifficulty = { 1: 0, 2: 0, 3: 0 };
    list.forEach((q) => { byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1; });
    return {
      key: subject.key,
      slug: subject.slug,
      en: subject.en,
      ml: subject.ml,
      topics: subject.topics,
      count: list.length,
      difficulty: byDifficulty
    };
  })
};

writeJson('data/index.json', manifest);

/* Update sw.js cache name with a version stamped on every build so each deploy replaces the old cache */
const swPath = resolve(root, 'sw.js');
try {
  let sw = readFileSync(swPath, 'utf8');
  const cacheVersion = `psc-kalari-${manifest.generated.replace(/[:.]/g, '-')}`;
  sw = sw.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = '${cacheVersion}';`);
  writeFileSync(swPath, sw, 'utf8');
  console.log(`Updated sw.js cache name: ${cacheVersion}`);
} catch (err) {
  console.warn('Could not update sw.js cache name:', err.message);
}

/* Keep the generated folder tidy if a subject is ever removed. Names stay free
   of Windows device names (no con/aux/nul) so the repo clones on Windows. */
const known = new Set(subjects.map((s) => s.key));
for (const file of ['ren', 'consti', 'geo', 'sci', 'math', 'eng', 'ker', 'his', 'cur']) {
  if (!known.has(file)) rmSync(resolve(root, `data/q/${file}.json`), { force: true });
}

console.log(`Built ${questions.length} questions across ${subjects.filter((s) => counts.get(s.key).length).length} subjects.`);
subjects.forEach((s) => {
  const n = counts.get(s.key).length;
  if (n) console.log(`  ${s.key.padEnd(5)} ${String(n).padStart(3)} questions`);
});
