/* Build step (zero dependencies, Node built-ins only).
   data/questions.json is the single source of truth; this script splits it into
   one file per subject for lazy loading and writes the small manifest the app
   reads at boot. Run: npm run build */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SITE_URL } from '../js/config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const writeJson = (p, value) => writeFileSync(resolve(root, p), `${JSON.stringify(value)}\n`);

const MIN_QUESTIONS = 20;
const siteBase = SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;

const esc = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

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

const questionsRaw = readFileSync(resolve(root, 'data/questions.json'), 'utf8');
const subjectsRaw = readFileSync(resolve(root, 'data/subjects.json'), 'utf8');
const contentHash = createHash('sha256')
  .update(questionsRaw)
  .update(subjectsRaw)
  .digest('hex')
  .slice(0, 10);

let prevIndex = null;
try {
  prevIndex = readJson('data/index.json');
} catch (e) {}

const generatedTime = (prevIndex && prevIndex.contentHash === contentHash && prevIndex.generated)
  ? prevIndex.generated
  : new Date().toISOString();

const manifest = {
  schema: 1,
  generated: generatedTime,
  contentHash,
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

/* Update sw.js cache name with a version stamped on every build so each deploy replaces the old cache.
   Deterministic timestamp ensures running build twice without data changes leaves a clean git working tree. */
const swPath = resolve(root, 'sw.js');
try {
  let sw = readFileSync(swPath, 'utf8');
  const cacheVersion = `psc-kalari-${manifest.generated.replace(/[:.]/g, '-')}`;
  if (!sw.includes(`const CACHE_NAME = '${cacheVersion}';`)) {
    sw = sw.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = '${cacheVersion}';`);
    writeFileSync(swPath, sw, 'utf8');
    console.log(`Updated sw.js cache name: ${cacheVersion}`);
  }
} catch (err) {
  console.warn('Could not update sw.js cache name:', err.message);
}

/* Keep the generated folder tidy if a subject is ever removed. Names stay free
   of Windows device names (no con/aux/nul) so the repo clones on Windows. */
const known = new Set(subjects.map((s) => s.key));
for (const file of ['ren', 'consti', 'geo', 'sci', 'math', 'eng', 'ker', 'his', 'cur']) {
  if (!known.has(file)) rmSync(resolve(root, `data/q/${file}.json`), { force: true });
}

function renderSubjectPage(subject, subjectQuestions) {
  const defaultTitle = `${subject.en} questions for Kerala PSC | PSC Kalari`;
  const pageTitle = esc(defaultTitle).length <= 60
    ? defaultTitle
    : `${subject.en} for Kerala PSC | PSC Kalari`;
  const metaDescription = `Practise ${subject.en} questions for Kerala PSC exams. Topic-wise questions with answers and explanations in English and Malayalam.`;
  const canonicalUrl = `${siteBase}${subject.slug}/`;
  const ogImageUrl = `${siteBase}assets/og-image.png`;
  const sampleQuestions = subjectQuestions.slice(0, 10);

  const sampleQuestionsHtml = sampleQuestions.map((q, idx) => {
    const verifiedChip = q.verified ? ' <span class="chip" style="font-size:0.75rem;padding:2px 8px">Reviewed</span>' : '';
    const optionsHtml = q.options.en.map((optEn, optIdx) => `
        <li style="margin-bottom:8px">
          <div>${esc(optEn)}</div>
          <div lang="ml" class="ml" style="color:var(--muted);font-size:0.92em">${esc(q.options.ml[optIdx])}</div>
        </li>`).join('');

    return `
      <article class="card sample-q" style="margin-bottom:16px">
        <div style="font-size:var(--t-xs);font-weight:700;color:var(--gold-ink);text-transform:uppercase;margin-bottom:6px">Question ${idx + 1} · ${esc(q.topic)}${verifiedChip}</div>
        <div class="qtext" style="font-weight:600;font-size:1.1rem;line-height:1.4">
          <p style="margin-bottom:4px">${esc(q.q.en)}</p>
          <p lang="ml" class="ml" style="color:var(--muted);font-size:0.95rem">${esc(q.q.ml)}</p>
        </div>
        <ol class="sample-options" type="A" style="margin:14px 0 14px 20px;padding:0">
          ${optionsHtml}
        </ol>
        <details style="margin-top:12px;padding:12px 14px;background:var(--surface2);border-radius:var(--radius-sm);border-left:4px solid var(--gold)">
          <summary style="cursor:pointer;font-weight:700;font-size:var(--t-sm);color:var(--ink)">Show answer and explanation</summary>
          <div class="sample-answer" style="margin-top:10px;font-size:var(--t-sm);line-height:1.5">
            <p style="margin-bottom:6px"><strong>Correct Answer:</strong> Option ${String.fromCharCode(65 + q.answerIndex)} — ${esc(q.options.en[q.answerIndex])} (<span lang="ml">${esc(q.options.ml[q.answerIndex])}</span>)</p>
            <p style="margin-bottom:4px">${esc(q.explanation.en)}</p>
            <p lang="ml" class="ml" style="color:var(--muted)">${esc(q.explanation.ml)}</p>
          </div>
        </details>
      </article>`;
  }).join('\n');

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "PSC Kalari",
        "item": siteBase
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": subject.en,
        "item": canonicalUrl
      }
    ]
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0E4A3A">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(metaDescription)}">
<link rel="canonical" href="${esc(canonicalUrl)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(metaDescription)}">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:image" content="${esc(ogImageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(metaDescription)}">
<meta name="twitter:image" content="${esc(ogImageUrl)}">
<script type="application/ld+json">
${JSON.stringify(breadcrumbLd, null, 2)}
</script>
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/icons/icon-180.png">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="stylesheet" href="../css/fonts.css">
<link rel="stylesheet" href="../css/base.css">
<link rel="stylesheet" href="../css/screens.css">
<style>
  .landing-hero{background:var(--hero-bg);color:var(--hero-fg);border-radius:var(--radius);padding:24px 20px;margin-bottom:24px;border:1px solid var(--line)}
  .landing-hero h1{font-size:var(--t-xl);margin-bottom:8px}
  .landing-hero p{color:var(--hero-sub);margin-bottom:8px;font-size:var(--t-base)}
  .landing-hero .ml{color:var(--hero-sub)}
  .topic-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;list-style:none;padding:0;margin:12px 0 24px}
  .topic-list li{padding:10px 14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);font-size:var(--t-sm);font-weight:500}
  .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;font-size:var(--t-sm);font-weight:600;margin-bottom:16px}
  .back-link:hover{color:var(--brand)}
</style>
</head>
<body>
<a class="skip" href="#main-content">Skip to content</a>
<div class="app">
  <main id="main-content" style="padding-block:16px 64px">
    <header class="top" style="margin-bottom:12px">
      <div class="brand">
        <a href="../" style="text-decoration:none;color:inherit">
          <b>PSC Kalari</b> <span lang="ml">പി.എസ്.സി കളരി</span>
        </a>
      </div>
      <a class="btn sm" href="../#practice/${esc(subject.key)}">
        Practise ${esc(subject.en)}
      </a>
    </header>

    <a class="back-link" href="../">← Back to PSC Kalari Home</a>

    <section class="landing-hero">
      <div class="eyebrow" style="color:var(--hero-accent,var(--gold-soft));margin-bottom:4px">${esc(subject.en)} · ${esc(subject.ml)}</div>
      <h1>${esc(subject.en)} questions for Kerala PSC</h1>
      <p>${esc(subject.intro ? subject.intro.en : '')}</p>
      <p class="ml" lang="ml">${esc(subject.intro ? subject.intro.ml : '')}</p>
      <div style="margin-top:18px">
        <a class="btn" href="../#practice/${esc(subject.key)}">
          Practise all ${subjectQuestions.length} questions
        </a>
      </div>
    </section>

    <section style="margin-bottom:32px">
      <h2 class="sec">Syllabus topics covered</h2>
      <p class="sub">These topics match the official Kerala PSC syllabus for ${esc(subject.en)}:</p>
      <ul class="topic-list">
        ${subject.topics.map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </section>

    <section>
      <h2 class="sec">Sample questions with explanations</h2>
      <p class="sub">Review 10 sample questions in English and Malayalam before starting full practice:</p>
      <div class="stack" style="margin-top:16px">
        ${sampleQuestionsHtml}
      </div>
    </section>

    <div style="text-align:center;margin-top:36px;padding:24px 16px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--line)">
      <h3 style="font-size:var(--t-lg);margin-bottom:8px">Ready for full practice?</h3>
      <p class="sub" style="margin-bottom:16px">Practise all ${subjectQuestions.length} questions with timer, negative marking, and bilingual explanations.</p>
      <a class="btn" href="../#practice/${esc(subject.key)}">
        Practise all ${subjectQuestions.length} questions
      </a>
    </div>

    <p class="note" style="margin-top:28px;line-height:1.6">
      These practice questions are written by us and are still being checked against official sources. If you find a mistake, please <a href="../" style="color:inherit;text-decoration:underline">report it</a> in the PSC Kalari app.
      <span class="ml" lang="ml" style="display:block;margin-top:4px">ഈ പരിശീലന ചോദ്യങ്ങൾ ഞങ്ങൾ തയ്യാറാക്കിയതാണ്, അവ ഔദ്യോഗിക ഉറവിടങ്ങളുമായി ഒത്തുനോക്കിക്കൊണ്ടിരിക്കുകയാണ്. എന്തെങ്കിലും തെറ്റ് കണ്ടെത്തിയാൽ ദയവായി പി.എസ്.സി കളരി ആപ്പിൽ <a href="../" style="color:inherit;text-decoration:underline">റിപ്പോർട്ട് ചെയ്യുക</a>.</span>
    </p>

    <p class="note" style="margin-top:40px">
      <a href="../" style="color:inherit">PSC Kalari</a> — Free Kerala PSC practice portal. No login, no ads.
    </p>
  </main>
</div>
</body>
</html>
`;
}

/* Generate static subject pages for subjects with at least MIN_QUESTIONS questions */
const eligibleSubjects = subjects.filter((s) => counts.get(s.key).length >= MIN_QUESTIONS);

for (const subject of eligibleSubjects) {
  const list = counts.get(subject.key);
  const dir = resolve(root, subject.slug);
  mkdirSync(dir, { recursive: true });
  const html = renderSubjectPage(subject, list);
  writeFileSync(resolve(dir, 'index.html'), html, 'utf8');
  console.log(`Generated page /${subject.slug}/index.html (${list.length} questions)`);
}

/* Generate sitemap.xml */
const sitemapUrls = [
  siteBase,
  ...eligibleSubjects.map((s) => `${siteBase}${s.slug}/`)
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => `  <url>
    <loc>${url}</loc>
    <changefreq>${url === siteBase ? 'daily' : 'weekly'}</changefreq>
    <priority>${url === siteBase ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(resolve(root, 'sitemap.xml'), sitemapXml, 'utf8');
console.log(`Generated sitemap.xml with ${sitemapUrls.length} URLs.`);

/* Generate robots.txt */
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteBase}sitemap.xml
`;
writeFileSync(resolve(root, 'robots.txt'), robotsTxt, 'utf8');
console.log('Generated robots.txt pointing to sitemap.xml.');

console.log(`Built ${questions.length} questions across ${subjects.filter((s) => counts.get(s.key).length).length} subjects.`);
subjects.forEach((s) => {
  const n = counts.get(s.key).length;
  if (n) console.log(`  ${s.key.padEnd(5)} ${String(n).padStart(3)} questions`);
});
