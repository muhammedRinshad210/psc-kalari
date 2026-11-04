// One-off merge helper for staged question batches.
// Usage: node tools/merge-batch.mjs data/_batch-ren.json data/_batch-consti.json
import fs from 'node:fs';

const file = 'data/questions.json';
const batches = process.argv.slice(2);
if (!batches.length) {
  console.error('Give at least one staged batch file.');
  process.exit(1);
}

const base = JSON.parse(fs.readFileSync(file, 'utf8'));
const incoming = batches.flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const ids = new Set(base.map(q => q.id));

for (const q of incoming) {
  if (ids.has(q.id)) throw new Error(`Duplicate id: ${q.id}`);
  ids.add(q.id);
}

const all = [...base, ...incoming];
fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
console.log(`questions.json: ${base.length} + ${incoming.length} = ${all.length} questions`);
