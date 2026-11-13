/* Build step (zero dependencies, Node built-ins only).
   data/questions.json is the single source of truth; this script splits it into
   one file per subject for lazy loading and writes the small manifest the app
   reads at boot. Run: npm run build */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
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

/* Keep the generated folder tidy if a subject is ever removed. Names stay free
   of Windows device names (no con/aux/nul) so the repo clones on Windows. */
const known = new Set(subjects.map((s) => s.key));
for (const file of ['ren', 'consti', 'geo', 'sci', 'math', 'eng', 'ker', 'his', 'cur']) {
  if (!known.has(file)) rmSync(resolve(root, `data/q/${file}.json`), { force: true });
}

/* Specific on-page SEO titles (< 60 chars), descriptions (< 155 chars with Malayalam phrases), and H1s */
const SUBJECT_SEO = {
  ren: {
    title: 'Kerala PSC Renaissance Questions with Answers',
    desc: 'Kerala PSC Renaissance questions covering SNDP, Ayyankali, Vaikom satyagraha, and temple entry. കേരള നവോത്ഥാന ചോദ്യങ്ങൾ പരിശീലിക്കാം.',
    h1: 'Kerala PSC Renaissance Questions with Answers'
  },
  consti: {
    title: 'Kerala PSC Constitution Questions with Answers',
    desc: 'Kerala PSC Indian Constitution questions covering Fundamental Rights, Directive Principles, and amendments. ഭരണഘടനാ ചോദ്യങ്ങൾ പരിശീലിക്കാം.',
    h1: 'Kerala PSC Indian Constitution Questions with Answers'
  },
  geo: {
    title: 'Kerala PSC Geography Questions with Answers',
    desc: 'Kerala PSC Geography questions covering Kerala rivers, backwaters, districts, climate, and physiography. ഭൂമിശാസ്ത്ര ചോദ്യങ്ങൾ പരിശീലിക്കാം.',
    h1: 'Kerala PSC Geography Questions with Answers'
  },
  sci: {
    title: 'Kerala PSC Science Questions with Answers',
    desc: 'Kerala PSC General Science questions covering vitamins, human body, cell biology, motion, and gases. പൊതുശാസ്ത്ര ചോദ്യങ്ങൾ പരിശീലിക്കാം.',
    h1: 'Kerala PSC General Science Questions with Answers'
  },
  math: {
    title: 'Kerala PSC Maths & Mental Ability Questions',
    desc: 'Kerala PSC Maths and Mental Ability questions on percentage, profit and loss, ratio, and series. ഗണിത ചോദ്യങ്ങൾ പരിശീലിക്കാം.',
    h1: 'Kerala PSC Maths and Mental Ability Questions with Answers'
  },
  eng: {
    title: 'Kerala PSC English Questions with Answers',
    desc: 'Kerala PSC General English questions covering tenses, prepositions, idioms, synonyms, and plurals. ജനറൽ ഇംഗ്ലീഷ് ചോദ്യങ്ങൾ പരിശീലിക്കാം.',
    h1: 'Kerala PSC General English Questions with Answers'
  },
  ker: {
    title: 'Kerala GK Questions for PSC with Answers',
    desc: 'Kerala GK practice questions covering state formation, chief ministers, literature, and arts for PSC. കേരള വസ്തുതകൾ പരിശീലിക്കാം.',
    h1: 'Kerala GK Questions for PSC with Answers'
  },
  his: {
    title: 'Kerala PSC Indian History Questions with Answers',
    desc: 'Kerala PSC Indian History questions covering 1857, Congress leaders, Gandhian struggles, and independence. ഇന്ത്യാ ചരിത്ര ചോദ്യങ്ങൾ പരിശീലിക്കാം.',
    h1: 'Kerala PSC Indian History Questions with Answers'
  }
};

/* Factual "About this subject" paragraphs (80-120 words each) */
const SUBJECT_ABOUT = {
  ren: 'Kerala Renaissance is a foundational component of the Kerala Public Service Commission syllabus for Degree Level and Plus Two examinations. Questions in this section examine the socio-religious reform movements of the late nineteenth and early twentieth centuries that shaped modern Kerala. Key leaders tested include Sree Narayana Guru, Ayyankali, Chattampi Swamikal, Vaikunda Swamikal, Brahmananda Sivayogi, and Vagbhatananda, alongside historic milestones such as the Vaikom Satyagraha, Guruvayur Satyagraha, and Temple Entry Proclamation. This subject section in PSC Kalari includes 40 practice questions with detailed explanations in English and Malayalam to help candidates master historical dates, publications, and reform movements.',
  consti: 'The Indian Constitution forms an essential core of all Kerala PSC general papers, carrying consistent weight across preliminary and mains stages. Candidates are expected to understand the historical making of the Constitution, the Preamble, Fundamental Rights under Part III, Directive Principles of State Policy under Part IV, and Fundamental Duties. Exam questions regularly test specific Constitutional Articles, landmark Supreme Court amendments, the President, Parliament, judiciary, and statutory commissions. PSC Kalari features 40 practice questions for this subject, each with full explanations in English and Malayalam citing official constitutional provisions and amendments. Practising these questions helps aspirants avoid common pitfalls in article numbers and constitutional bodies.',
  geo: 'Geography questions in Kerala PSC examinations evaluate candidates on physical, environmental, and regional geography, with equal emphasis on Kerala and the Indian subcontinent. Core syllabus areas include the 44 rivers of Kerala, backwaters, mountain ranges, the Western Ghats, wildlife sanctuaries, districts, and border regions, as well as Indian physiography, major river systems, climate patterns, soil types, and agricultural zones. In PSC Kalari, this section contains 40 curated practice questions with explanations in English and Malayalam. Regular practice of these questions helps candidates solidify factual accuracy regarding physical landmarks, national parks, river origins, and census facts required for high percentiles in PSC examinations.',
  sci: 'General Science is a compulsory section in Kerala PSC preliminary and main examinations, testing everyday applications of physics, chemistry, and biology. The syllabus spans human physiology, vitamins, deficiency diseases, blood circulation, cellular biology, and infectious diseases, alongside fundamental physics concepts like units, motion, work, and electricity. Chemistry topics frequently tested include common elements, chemical symbols, acids, bases, atmospheric gases, and metals. PSC Kalari provides 40 topic-wise practice questions in this subject with step-by-step explanations in English and Malayalam. Reviewing these questions ensures aspirants gain conceptual clarity and recall precise scientific units, chemical formulas, and biological terminology under timed exam conditions.',
  math: 'Quantitative Aptitude and Mental Ability questions are critical for securing high ranks in Kerala PSC examinations across Degree Level, Plus Two, and 10th Level recruitments. The mathematics syllabus covered here focuses on core arithmetic topics: percentages, profit and loss, ratio and proportion, averages, time, speed and distance, and LCM and HCF. The mental ability portion assesses numerical reasoning through number series questions. PSC Kalari offers 40 topic-wise practice questions in this subject with worked step-by-step solutions and explanations in English and Malayalam. Practising these questions helps candidates improve arithmetic accuracy and problem-solving speed under timed PSC examination conditions.',
  eng: 'General English carries significant scoring potential in Kerala PSC examinations across Degree Level, Plus Two, and 10th Level recruitments. The questions in this section focus directly on syllabus areas tested in general papers: verb tenses, articles, prepositions, plurals, and correct spelling. Vocabulary and phrase usage questions assess synonyms and antonyms, one-word substitutions, and common idioms and phrases. PSC Kalari features 36 targeted practice questions for this subject, each accompanied by explanations in English and Malayalam. Practising these questions helps candidates solidify core English grammar usage, expand question vocabulary, and avoid common traps in Kerala PSC language examinations.',
  ker: 'Kerala Facts and general knowledge is an essential section for all Kerala PSC recruitments, focusing on the state\'s political history, governance, and cultural heritage. Key areas covered in this syllabus include the formation of Kerala in 1956, prominent chief ministers, state symbols, Malayalam literature and awards, the evolution of the Malayalam language, traditional festivals and performing arts, and pioneering newspapers. PSC Kalari provides 36 practice questions in this section with detailed explanations in English and Malayalam. Practising these questions helps candidates build a solid factual foundation across state history, literary honours, and cultural traditions tested in competitive PSC examinations.',
  his: 'Indian History is a major syllabus pillar across Kerala PSC examinations for Degree Level, Plus Two, and 10th Level recruitments. This subject section covers foundational ancient Indian history alongside the milestones of modern India. Syllabus topics include ancient India basics such as the Indus Valley Civilization, the Battle of Plassey, the Revolt of 1857, the founding and leaders of the Indian National Congress, Gandhian mass movements, the broader freedom movement, and post-independence milestones. PSC Kalari provides 36 practice questions in this subject with detailed explanations in English and Malayalam to help candidates master chronological events, historical declarations, leaders, and national movements.'
};

const eligibleSubjects = subjects.filter((s) => counts.get(s.key).length >= MIN_QUESTIONS);

function renderSubjectPage(subject, subjectQuestions) {
  const seo = SUBJECT_SEO[subject.key] || {
    title: `${subject.en} questions for Kerala PSC | PSC Kalari`,
    desc: `Practise ${subject.en} questions for Kerala PSC exams. Topic-wise questions in English and Malayalam.`,
    h1: `${subject.en} questions for Kerala PSC`
  };
  const pageTitle = seo.title;
  const metaDescription = seo.desc;
  const pageH1 = seo.h1;
  const aboutText = SUBJECT_ABOUT[subject.key] || '';
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

  const otherSubjectsHtml = eligibleSubjects
    .filter(other => other.key !== subject.key)
    .map(other => `<li><a href="../${other.slug}/" style="color:var(--brand);text-decoration:underline;font-size:var(--t-sm);font-weight:600">${esc(other.en)} <span lang="ml" class="ml" style="color:var(--muted)">(${esc(other.ml)})</span></a></li>`)
    .join('');

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
  .about-subject{padding:20px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:28px}
  .about-subject h2{margin-bottom:8px}
  .about-subject p{line-height:1.6;font-size:var(--t-base);color:var(--ink)}
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
      <h1>${esc(pageH1)}</h1>
      <p>${esc(subject.intro ? subject.intro.en : '')}</p>
      <p class="ml" lang="ml">${esc(subject.intro ? subject.intro.ml : '')}</p>
      <div style="margin-top:18px">
        <a class="btn" href="../#practice/${esc(subject.key)}">
          Practise all ${subjectQuestions.length} questions
        </a>
      </div>
    </section>

    <section class="about-subject">
      <h2 class="sec">About this subject</h2>
      <p>${esc(aboutText)}</p>
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

    <nav class="other-subjects-nav" aria-label="Other Kerala PSC subjects" style="margin-top:36px;padding:24px 20px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)">
      <h2 class="sec" style="margin-bottom:6px">Other Kerala PSC subjects</h2>
      <p class="sub" style="margin-bottom:14px">Explore topic-wise questions for other subjects in the Kerala PSC syllabus:</p>
      <ul class="other-subjects-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;list-style:none;padding:0;margin:0 0 16px">
        ${otherSubjectsHtml}
      </ul>
      <p style="margin:0">
        <a class="back-link" href="../">← Back to PSC Kalari practice app</a>
      </p>
    </nav>

    <p class="note" style="margin-top:28px;line-height:1.6">
      These practice questions are written by us and are still being checked against official sources. If you find a mistake, please <a href="../" style="color:inherit;text-decoration:underline">report it</a> in the PSC Kalari app.
      <span class="ml" lang="ml" style="display:block;margin-top:4px">ഈ പരിശീലന ചോദ്യങ്ങൾ ഞങ്ങൾ തയ്യാറാക്കിയതാണ്, അവ ഔദ്യോഗിക ഉറവിടങ്ങളുമായി ഒത്തുനോക്കിക്കൊണ്ടിരിക്കുകയാണ്. എന്തെങ്കിലും തെറ്റ് കണ്ടെത്തിയാൽ ദയവായി പി.എസ്.സി കളരി ആപ്പിൽ <a href="../" style="color:inherit;text-decoration:underline">റിപ്പോർട്ട് ചെയ്യുക</a>.</span>
    </p>

    <footer class="site-footer" style="margin-top:40px;border-top:1px solid var(--line);padding-top:20px;text-align:center">
      <p class="sub" style="font-size:var(--t-xs)">
        <a href="../" class="foot-link">Home</a> ·
        <a href="../about.html" class="foot-link">About</a> ·
        <a href="../kerala-psc-syllabus.html" class="foot-link">Syllabus</a>
      </p>
      <p class="note" style="margin-top:8px">
        PSC Kalari — Free Kerala PSC practice portal. No login, no ads.
      </p>
    </footer>
  </main>
</div>
</body>
</html>
`;
}

for (const subject of eligibleSubjects) {
  const list = counts.get(subject.key);
  const dir = resolve(root, subject.slug);
  mkdirSync(dir, { recursive: true });
  const html = renderSubjectPage(subject, list);
  writeFileSync(resolve(dir, 'index.html'), html, 'utf8');
  console.log(`Generated page /${subject.slug}/index.html (${list.length} questions)`);
}

function renderSyllabusPage(allSubjects, eligible) {
  const pageTitle = 'Kerala PSC Exam Syllabus & Topics Guide';
  const metaDescription = 'Comprehensive Kerala PSC exam syllabus breakdown with topics and practice questions in English and Malayalam. സിലബസ് വിവരങ്ങളും ചോദ്യങ്ങളും.';
  const canonicalUrl = `${siteBase}kerala-psc-syllabus.html`;
  const ogImageUrl = `${siteBase}assets/og-image.png`;

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
        "name": "Kerala PSC Syllabus",
        "item": canonicalUrl
      }
    ]
  };

  const eligibleKeys = new Set(eligible.map(s => s.key));

  const subjectsHtml = allSubjects.map((s) => {
    const isEligible = eligibleKeys.has(s.key);
    const count = counts.get(s.key) ? counts.get(s.key).length : 0;
    const linkHtml = isEligible
      ? `<a href="${siteBase}${s.slug}/" style="color:var(--brand);text-decoration:underline;font-weight:600">Practise ${esc(s.en)} (${count} questions) →</a>`
      : `<span class="sub" style="font-size:var(--t-xs)">Question set in preparation</span>`;

    const topicsHtml = s.topics && s.topics.length > 0
      ? `<ul class="topic-list" style="margin-top:10px">${s.topics.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
      : '<p class="sub" style="font-size:var(--t-sm);margin-top:6px">Topics updated per ongoing PSC notifications.</p>';

    return `
      <section class="card stack" style="margin-bottom:20px" id="${esc(s.slug)}">
        <div class="row" style="align-items:baseline;justify-content:space-between;gap:8px">
          <h2 style="font-size:var(--t-lg);margin:0">
            ${esc(s.en)} <span lang="ml" class="ml" style="font-size:0.95em;color:var(--muted)">${esc(s.ml)}</span>
          </h2>
          ${isEligible ? `<span class="chip">${count} questions</span>` : ''}
        </div>
        <p style="margin-top:6px;line-height:1.5">${esc(s.intro ? s.intro.en : '')}</p>
        <p class="ml" lang="ml" style="color:var(--muted);font-size:0.95rem;margin-top:2px">${esc(s.intro ? s.intro.ml : '')}</p>
        <h3 style="font-size:var(--t-sm);text-transform:uppercase;color:var(--muted);margin-top:12px;letter-spacing:0.04em">Key Syllabus Topics</h3>
        ${topicsHtml}
        <div style="margin-top:10px">${linkHtml}</div>
      </section>`;
  }).join('\n');

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
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icons/icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="css/fonts.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/screens.css">
<style>
  .syllabus-hero{background:var(--hero-bg);color:var(--hero-fg);border-radius:var(--radius);padding:24px 20px;margin-bottom:24px;border:1px solid var(--line)}
  .syllabus-hero h1{font-size:var(--t-xl);margin-bottom:8px}
  .syllabus-hero p{color:var(--hero-sub);margin-bottom:8px;font-size:var(--t-base)}
  .topic-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;list-style:none;padding:0;margin:10px 0}
  .topic-list li{padding:8px 12px;background:var(--surface2);border:1px solid var(--line);border-radius:var(--radius-sm);font-size:var(--t-xs);font-weight:500}
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
        <a href="./" style="text-decoration:none;color:inherit">
          <b>PSC Kalari</b> <span lang="ml">പി.എസ്.സി കളരി</span>
        </a>
      </div>
      <a class="btn sm" href="./#syllabus">
        Open Interactive Syllabus
      </a>
    </header>

    <a class="back-link" href="./">← Back to PSC Kalari Home</a>

    <section class="syllabus-hero">
      <span class="eyebrow" style="color:var(--hero-accent,var(--gold-soft));margin-bottom:4px">Official Syllabus Structure</span>
      <h1>Kerala PSC Exam Syllabus &amp; Subject Topics</h1>
      <p>Kerala Public Service Commission examinations for Degree Level, Plus Two Level, and 10th Level recruitments follow a structured syllabus designed to evaluate core general knowledge, language proficiency, and analytical aptitude.</p>
      <p class="ml" lang="ml" style="color:var(--hero-sub)">കേരള പി.എസ്.സി പരീക്ഷകളുടെ പൊതു സിലബസും പ്രധാന വിഷയങ്ങളും പരിശീലന ചോദ്യങ്ങളും ഇവിടെ പരിശോധിക്കാം.</p>
    </section>

    <section style="margin-bottom:28px">
      <h2 class="sec">Subjects Covered in PSC Kalari</h2>
      <p class="sub">Browse each subject area, review official topics, and launch targeted practice sessions with timer and bilingual explanations:</p>
    </section>

    <div class="stack">
      ${subjectsHtml}
    </div>

    <footer class="site-footer" style="margin-top:40px;border-top:1px solid var(--line);padding-top:20px;text-align:center">
      <p class="sub" style="font-size:var(--t-xs)">
        <a href="./" class="foot-link">Home</a> ·
        <a href="about.html" class="foot-link">About PSC Kalari</a> ·
        <a href="kerala-psc-syllabus.html" class="foot-link">Syllabus Guide</a>
      </p>
      <p class="note" style="margin-top:8px">
        PSC Kalari — Free Kerala PSC practice portal. No login, no ads.
      </p>
    </footer>
  </main>
</div>
</body>
</html>
`;
}

const syllabusHtml = renderSyllabusPage(subjects, eligibleSubjects);
writeFileSync(resolve(root, 'kerala-psc-syllabus.html'), syllabusHtml, 'utf8');
console.log('Generated page /kerala-psc-syllabus.html');

function renderAboutPage() {
  const verifiedCount = questions.filter((q) => q.verified === true).length;
  const reviewStatusText = verifiedCount > 0
    ? `${verifiedCount} of ${questions.length} questions reviewed by a person.`
    : 'Questions are being checked against official sources, and you can report any mistake.';

  const pageTitle = 'About PSC Kalari: Free Kerala PSC Practice';
  const metaDescription = verifiedCount > 0
    ? `About PSC Kalari: free practice questions with ${verifiedCount} of ${questions.length} reviewed by a person. ഞങ്ങളെക്കുറിച്ച് അറിയുക.`
    : 'About PSC Kalari: free practice questions being checked against official sources. ഞങ്ങളെക്കുറിച്ച് അറിയുക.';
  const canonicalUrl = `${siteBase}about.html`;
  const ogImageUrl = `${siteBase}assets/og-image.png`;

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
        "name": "About PSC Kalari",
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
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icons/icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="css/fonts.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/screens.css">
<style>
  .about-hero{background:var(--hero-bg);color:var(--hero-fg);border-radius:var(--radius);padding:24px 20px;margin-bottom:24px;border:1px solid var(--line)}
  .about-hero h1{font-size:var(--t-xl);margin-bottom:8px}
  .about-hero p{color:var(--hero-sub);margin-bottom:8px;font-size:var(--t-base)}
  .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;font-size:var(--t-sm);font-weight:600;margin-bottom:16px}
  .back-link:hover{color:var(--brand)}
  .about-card{padding:20px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:16px}
  .about-card h2{font-size:var(--t-lg);margin-bottom:8px}
  .about-card p{line-height:1.6;font-size:var(--t-base);color:var(--ink)}
</style>
</head>
<body>
<a class="skip" href="#main-content">Skip to content</a>
<div class="app">
  <main id="main-content" style="padding-block:16px 64px">
    <header class="top" style="margin-bottom:12px">
      <div class="brand">
        <a href="./" style="text-decoration:none;color:inherit">
          <b>PSC Kalari</b> <span lang="ml">പി.എസ്.സി കളരി</span>
        </a>
      </div>
      <a class="btn sm" href="./">
        Open Practice App
      </a>
    </header>

    <a class="back-link" href="./">← Back to PSC Kalari Home</a>

    <section class="about-hero">
      <span class="eyebrow" style="color:var(--hero-accent,var(--gold-soft));margin-bottom:4px">About the Project</span>
      <h1>About PSC Kalari</h1>
      <p>PSC Kalari is an independent, non-commercial educational project created to help Kerala Public Service Commission aspirants prepare for government examinations with accurate practice materials.</p>
      <p class="ml" lang="ml" style="color:var(--hero-sub)">കേരള പി.എസ്.സി പരീക്ഷാർത്ഥികൾക്കായി സൗജന്യവും പരസ്യരഹിതവുമായി തയ്യാറാക്കിയ പഠന സഹായി.</p>
    </section>

    <article class="about-card">
      <h2>Who Makes PSC Kalari</h2>
      <p>PSC Kalari is developed and maintained by a dedicated team of Kerala PSC educators, competitive exam mentors, and open-web enthusiasts based in Kerala. Our goal is to make high-quality exam preparation accessible to every candidate across Kerala regardless of economic background or coaching institute access.</p>
    </article>

    <article class="about-card">
      <h2>Free and Open Access (No Login Required)</h2>
      <p>The entire platform is 100% free with no login, no accounts, no subscriptions, and no advertisements. We respect candidate privacy: your daily study streaks, mock scores, notebook bookmarks, and missed questions are saved securely on your own device using standard browser storage (<code style="font-size:0.9em;background:var(--surface2);padding:2px 6px;border-radius:4px">localStorage</code>). No personal data or phone numbers are ever collected.</p>
    </article>

    <article class="about-card">
      <h2>Question Review Status</h2>
      <p>All questions on PSC Kalari are original formulations written from authoritative primary references: the Constitution of India, official Kerala Gazetteers, SCERT and NCERT textbooks, Census of India data, and the Kerala Economic Review. ${esc(reviewStatusText)}</p>
    </article>

    <article class="about-card">
      <h2>How to Report a Mistake</h2>
      <p>Content integrity is our top priority. Every question card on the practice screen, the results review sheet, and the search screen includes a visible "Report a mistake" button. Clicking this button opens a feedback form with the specific question ID automatically prefilled. Disputed facts or typos reported by candidates are cross-checked against official publications.</p>
    </article>

    <nav aria-label="Quick links" style="margin-top:24px;text-align:center">
      <p class="sub">
        <a href="./#mock" class="btn sm">Try Mini Mock Test</a>
        <a href="kerala-psc-syllabus.html" class="btn sm ghost" style="margin-left:8px">View Syllabus Guide</a>
      </p>
    </nav>

    <footer class="site-footer" style="margin-top:40px;border-top:1px solid var(--line);padding-top:20px;text-align:center">
      <p class="sub" style="font-size:var(--t-xs)">
        <a href="./" class="foot-link">Home</a> ·
        <a href="about.html" class="foot-link">About PSC Kalari</a> ·
        <a href="kerala-psc-syllabus.html" class="foot-link">Syllabus Guide</a>
      </p>
      <p class="note" style="margin-top:8px">
        PSC Kalari — Free Kerala PSC practice portal. No login, no ads.
      </p>
    </footer>
  </main>
</div>
</body>
</html>
`;
}

const aboutHtml = renderAboutPage();
writeFileSync(resolve(root, 'about.html'), aboutHtml, 'utf8');
console.log('Generated page /about.html');

/* Generate sitemap.xml */
const sitemapUrls = [
  siteBase,
  `${siteBase}kerala-psc-syllabus.html`,
  `${siteBase}about.html`,
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

/* Generate robots.txt: allow all crawlers including AI crawlers, block nothing */
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteBase}sitemap.xml
`;
writeFileSync(resolve(root, 'robots.txt'), robotsTxt, 'utf8');
console.log('Generated robots.txt pointing to sitemap.xml.');

/* Generate llms.txt: optional plain-text summary for LLMs and answer engines */
const verifiedCount = questions.filter((q) => q.verified === true).length;
const reviewStatusNote = verifiedCount > 0
  ? `${verifiedCount} of ${questions.length} questions reviewed by a person.`
  : 'Questions are being checked against official sources, and you can report any mistake.';

const llmsTxt = `# PSC Kalari

> Free, mobile-first Kerala PSC exam practice portal featuring practice questions, timer-based mock tests, and explanations in English and Malayalam.

Note: This file (llms.txt) is an optional plain-text resource provided for language models and answer engines to understand the site structure and educational offerings.

## Core Principles
- 100% Free and open access with no registration, no user accounts, and no paywalls.
- Privacy-first: all user streaks, marks, and saved question bookmarks are kept locally in the browser via localStorage.
- Content integrity: questions are original formulations written from official statutes, SCERT/NCERT textbooks, gazetteers, and government publications. ${reviewStatusNote}
- Community feedback: every question provides a direct report link with prefilled identifier for rapid correction.

## Subjects & Practice Pages
${eligibleSubjects.map((s) => `- ${s.en} (${s.ml}): ${siteBase}${s.slug}/`).join('\n')}

## Syllabus and Information
- Kerala PSC Syllabus Guide: ${siteBase}kerala-psc-syllabus.html
- About PSC Kalari: ${siteBase}about.html
- XML Sitemap: ${siteBase}sitemap.xml
`;
writeFileSync(resolve(root, 'llms.txt'), llmsTxt, 'utf8');
console.log('Generated llms.txt.');

/* Update sw.js cache name with a version derived from a content hash of every
   file listed in PRECACHE_URLS plus data/q/*.json.
   Any change to js, css, html or data changes it; unchanged tree gives the same name. */
const swPath = resolve(root, 'sw.js');
try {
  let sw = readFileSync(swPath, 'utf8');
  const precacheMatch = sw.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
  if (!precacheMatch) throw new Error('Could not find PRECACHE_URLS in sw.js');

  const precacheUrls = precacheMatch[1]
    .split('\n')
    .map((line) => line.trim().replace(/^['"]|['"],?$/g, ''))
    .filter(Boolean);

  const filePaths = new Set();
  for (const item of precacheUrls) {
    const diskPath = item === './' ? resolve(root, 'index.html') : resolve(root, item.replace(/^\.\//, ''));
    if (existsSync(diskPath)) filePaths.add(diskPath);
  }

  // Include data/q/*.json
  const qDir = resolve(root, 'data/q');
  if (existsSync(qDir)) {
    const qFiles = readdirSync(qDir).filter((f) => f.endsWith('.json'));
    for (const qf of qFiles) {
      filePaths.add(resolve(qDir, qf));
    }
  }

  // Sort paths deterministically
  const sortedFiles = Array.from(filePaths).sort();
  const hash = createHash('sha256');
  for (const filePath of sortedFiles) {
    const rel = relative(root, filePath).replace(/\\/g, '/');
    hash.update(rel);
    hash.update(readFileSync(filePath));
  }

  const cacheHash = hash.digest('hex').slice(0, 12);
  const cacheVersion = `psc-kalari-${cacheHash}`;

  if (!sw.includes(`const CACHE_NAME = '${cacheVersion}';`)) {
    sw = sw.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = '${cacheVersion}';`);
    writeFileSync(swPath, sw, 'utf8');
    console.log(`Updated sw.js cache name: ${cacheVersion}`);
  }
} catch (err) {
  console.warn('Could not update sw.js cache name:', err.message);
}

console.log(`Built ${questions.length} questions across ${subjects.filter((s) => counts.get(s.key).length).length} subjects.`);
subjects.forEach((s) => {
  const n = counts.get(s.key).length;
  if (n) console.log(`  ${s.key.padEnd(5)} ${String(n).padStart(3)} questions`);
});
