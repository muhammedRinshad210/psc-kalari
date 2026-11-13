/* SEO validator: node tools/check-seo.mjs
   Checks sitemap.xml, robots.txt, llms.txt, home page SEO tags,
   generated subject pages, /kerala-psc-syllabus.html, and /about.html.
   Enforces:
   - Unique titles under 60 chars (< 60)
   - Unique descriptions under 155 chars (< 155) with Malayalam phrases
   - Exactly one <h1> per page
   - Canonical URLs matching SITE_URL
   - Sitemap inclusion
   - "About this subject" paragraph (80-120 words) and other subjects nav on subject pages
   - No forbidden schemas (FAQPage, Quiz, Review)
   - robots.txt allowing all crawlers
   - llms.txt optional hint file
*/

import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL } from '../js/config.js';

const root = path.resolve();
const siteBase = SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;
const MIN_QUESTIONS = 20;

const questions = JSON.parse(fs.readFileSync(path.join(root, 'data/questions.json'), 'utf8'));
const verifiedQuestionsCount = questions.filter(q => q.verified === true).length;

const errors = [];
const fail = (msg) => errors.push(msg);

const unescapeHtml = (str) => String(str || '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

// 1. Check sitemap.xml
const sitemapPath = path.join(root, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  fail('sitemap.xml does not exist at site root');
}

const sitemapContent = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
const sitemapLocs = new Set(
  [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
);

if (!sitemapLocs.has(siteBase)) {
  fail(`sitemap.xml missing home page URL: ${siteBase}`);
}
if (!sitemapLocs.has(`${siteBase}kerala-psc-syllabus.html`)) {
  fail(`sitemap.xml missing ${siteBase}kerala-psc-syllabus.html`);
}
if (!sitemapLocs.has(`${siteBase}about.html`)) {
  fail(`sitemap.xml missing ${siteBase}about.html`);
}

// 2. Check robots.txt
const robotsPath = path.join(root, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  fail('robots.txt does not exist at site root');
} else {
  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!robots.includes('Allow: /')) {
    fail('robots.txt does not allow crawling (missing "Allow: /")');
  }
  if (!robots.includes('User-agent: *')) {
    fail('robots.txt missing "User-agent: *" wildcard');
  }
  if (/Disallow:\s*\/\s*$/m.test(robots)) {
    fail('robots.txt must not disallow root (block nothing)');
  }
  if (!robots.includes(`Sitemap: ${siteBase}sitemap.xml`)) {
    fail(`robots.txt does not point to ${siteBase}sitemap.xml`);
  }
}

// 3. Check llms.txt
const llmsPath = path.join(root, 'llms.txt');
if (!fs.existsSync(llmsPath)) {
  fail('llms.txt does not exist at site root');
} else {
  const llms = fs.readFileSync(llmsPath, 'utf8');
  if (!llms.toLowerCase().includes('optional')) {
    fail('llms.txt must honestly describe itself as an optional resource/hint');
  }
  if (!llms.includes(`${siteBase}sitemap.xml`)) {
    fail('llms.txt missing sitemap link');
  }
  if (!llms.includes(`${siteBase}kerala-psc-syllabus.html`)) {
    fail('llms.txt missing syllabus link');
  }
  if (!llms.includes(`${siteBase}about.html`)) {
    fail('llms.txt missing about link');
  }
}

const seenTitles = new Set();
const seenDescriptions = new Set();

function checkPageBasics(filePath, pageLabel, expectedCanonical) {
  if (!fs.existsSync(filePath)) {
    fail(`${pageLabel} does not exist at ${filePath}`);
    return null;
  }
  const html = fs.readFileSync(filePath, 'utf8');

  // Exactly one <h1>
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  if (h1Matches.length === 0) {
    fail(`${pageLabel} has no <h1> tag`);
  } else if (h1Matches.length > 1) {
    fail(`${pageLabel} has ${h1Matches.length} <h1> tags (must have exactly one)`);
  }

  // <title> under 60 chars and unique
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) {
    fail(`${pageLabel} missing <title> tag`);
  } else {
    const rawTitle = titleMatch[1].trim();
    const title = unescapeHtml(rawTitle);
    if (title.length >= 60) {
      fail(`${pageLabel} title is ${title.length} characters (must be strictly under 60): "${title}"`);
    }
    if (seenTitles.has(title)) {
      fail(`${pageLabel} has duplicate title: "${title}"`);
    }
    seenTitles.add(title);
  }

  // Meta description under 155 chars, unique, and has Malayalam
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!descMatch) {
    fail(`${pageLabel} missing meta description`);
  } else {
    const rawDesc = descMatch[1].trim();
    const desc = unescapeHtml(rawDesc);
    if (desc.length >= 155) {
      fail(`${pageLabel} description is ${desc.length} chars (must be strictly under 155): "${desc}"`);
    }
    if (verifiedQuestionsCount === 0 && desc.includes('checked against') && !desc.includes('being')) {
      fail(`${pageLabel} description says "checked against" without "being" while 0 questions are verified: "${desc}"`);
    }
    if (!/[\u0D00-\u0D7F]/.test(desc)) {
      fail(`${pageLabel} description missing Malayalam text: "${desc}"`);
    }
    if (seenDescriptions.has(desc)) {
      fail(`${pageLabel} has duplicate meta description: "${desc}"`);
    }
    seenDescriptions.add(desc);
  }

  // Canonical URL
  const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  if (!canonicalMatch) {
    fail(`${pageLabel} missing canonical link`);
  } else if (canonicalMatch[1] !== expectedCanonical) {
    fail(`${pageLabel} canonical "${canonicalMatch[1]}" does not match expected "${expectedCanonical}"`);
  }

  // Sitemap presence
  if (!sitemapLocs.has(expectedCanonical)) {
    fail(`${expectedCanonical} (${pageLabel}) is missing from sitemap.xml`);
  }

  // Forbidden schema checks
  if (html.includes('FAQPage') || html.includes('Quiz') || html.includes('"@type": "Review"') || html.includes('"@type":"Review"')) {
    fail(`${pageLabel} must not contain FAQPage, Quiz, or Review schema markup`);
  }

  return html;
}

// 4. Check Home Page (index.html)
const homeHtmlPath = path.join(root, 'index.html');
const homeHtml = checkPageBasics(homeHtmlPath, 'index.html (Home)', siteBase);
if (homeHtml) {
  if (!homeHtml.includes('property="og:image"') || !homeHtml.includes('assets/og-image.png')) {
    fail('index.html missing og:image tag pointing to assets/og-image.png');
  }
  if (!fs.existsSync(path.join(root, 'assets/og-image.png'))) {
    fail('assets/og-image.png does not exist on disk');
  }
  if (!homeHtml.includes('"@type": "WebSite"') && !homeHtml.includes('"@type":"WebSite"')) {
    fail('index.html missing WebSite JSON-LD markup');
  }
  if (!homeHtml.includes('href="about.html"') && !homeHtml.includes("href='about.html'")) {
    fail('index.html footer missing link to about.html');
  }
  if (!homeHtml.includes('href="kerala-psc-syllabus.html"') && !homeHtml.includes("href='kerala-psc-syllabus.html'")) {
    fail('index.html footer missing link to kerala-psc-syllabus.html');
  }
}

// 5. Check /kerala-psc-syllabus.html
const syllabusPath = path.join(root, 'kerala-psc-syllabus.html');
const syllabusHtml = checkPageBasics(syllabusPath, 'kerala-psc-syllabus.html', `${siteBase}kerala-psc-syllabus.html`);
if (syllabusHtml) {
  if (!syllabusHtml.includes('"@type": "BreadcrumbList"') && !syllabusHtml.includes('"@type":"BreadcrumbList"')) {
    fail('kerala-psc-syllabus.html missing BreadcrumbList JSON-LD');
  }
}

// 6. Check /about.html
const aboutPath = path.join(root, 'about.html');
const aboutHtml = checkPageBasics(aboutPath, 'about.html', `${siteBase}about.html`);
if (aboutHtml) {
  if (!aboutHtml.includes('"@type": "BreadcrumbList"') && !aboutHtml.includes('"@type":"BreadcrumbList"')) {
    fail('about.html missing BreadcrumbList JSON-LD');
  }
  const aboutLower = aboutHtml.toLowerCase();
  if (!aboutLower.includes('who makes') && !aboutLower.includes('developed and maintained')) {
    fail('about.html must explain who makes the site');
  }
  if (!aboutLower.includes('no login') && !aboutLower.includes('free')) {
    fail('about.html must state it is free with no login required');
  }
  if (!aboutLower.includes('official sources') && !aboutLower.includes('reviewed by a person')) {
    fail('about.html must explain questions are being checked against official sources or reviewed by a person');
  }
  if (!aboutLower.includes('report a mistake')) {
    fail('about.html must explain how to report a mistake');
  }
}

// 7. Check Subject Pages
const subjects = JSON.parse(fs.readFileSync(path.join(root, 'data/subjects.json'), 'utf8')).subjects;

const counts = new Map();
for (const s of subjects) counts.set(s.key, 0);
for (const q of questions) {
  counts.set(q.subject, (counts.get(q.subject) || 0) + 1);
}

const eligibleSubjects = subjects.filter(s => (counts.get(s.key) || 0) >= MIN_QUESTIONS);
if (eligibleSubjects.length === 0) {
  fail('No eligible subjects found with >= ' + MIN_QUESTIONS + ' questions');
}

for (const subject of eligibleSubjects) {
  const pagePath = path.join(root, subject.slug, 'index.html');
  const expectedCanonical = `${siteBase}${subject.slug}/`;
  const html = checkPageBasics(pagePath, `${subject.slug}/index.html`, expectedCanonical);
  if (!html) continue;

  // Open Graph & Twitter tags
  if (!html.includes('property="og:title"')) fail(`Page ${subject.slug} missing og:title`);
  if (!html.includes('property="og:description"')) fail(`Page ${subject.slug} missing og:description`);
  if (!html.includes('property="og:url"')) fail(`Page ${subject.slug} missing og:url`);
  if (!html.includes('property="og:image"')) fail(`Page ${subject.slug} missing og:image`);
  if (!html.includes('name="twitter:card"')) fail(`Page ${subject.slug} missing twitter:card`);

  // JSON-LD: BreadcrumbList
  if (!html.includes('"@type": "BreadcrumbList"') && !html.includes('"@type":"BreadcrumbList"')) {
    fail(`Page ${subject.slug}/index.html missing BreadcrumbList JSON-LD`);
  }

  // Short original intro in English and Malayalam
  if (!html.includes(subject.intro.en)) {
    fail(`Page ${subject.slug}/index.html missing English intro`);
  }
  if (!html.includes(subject.intro.ml)) {
    fail(`Page ${subject.slug}/index.html missing Malayalam intro`);
  }

  // Topic list
  for (const topic of subject.topics) {
    if (!html.includes(topic)) {
      fail(`Page ${subject.slug}/index.html missing syllabus topic: "${topic}"`);
    }
  }

  // About this subject section (80-120 words)
  const aboutMatch = html.match(/<section class="about-subject">[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/section>/i);
  if (!aboutMatch) {
    fail(`Page ${subject.slug}/index.html missing <section class="about-subject"> paragraph`);
  } else {
    const text = aboutMatch[1].replace(/<[^>]+>/g, '').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 80 || wordCount > 120) {
      fail(`Page ${subject.slug}/index.html "About this subject" has ${wordCount} words (must be 80-120 words)`);
    }
  }

  // Other subjects nav with links and back link
  if (!html.includes('class="other-subjects-nav"')) {
    fail(`Page ${subject.slug}/index.html missing <nav class="other-subjects-nav">`);
  }
  for (const other of eligibleSubjects) {
    if (other.key === subject.key) continue;
    if (!html.includes(`../${other.slug}/`)) {
      fail(`Page ${subject.slug}/index.html missing link to other subject ../${other.slug}/`);
    }
  }
  if (!html.includes('href="../"')) {
    fail(`Page ${subject.slug}/index.html missing link back to app ("../")`);
  }

  // Footer links to about and syllabus
  if (!html.includes('href="../about.html"') || !html.includes('href="../kerala-psc-syllabus.html"')) {
    fail(`Page ${subject.slug}/index.html footer missing links to about.html and kerala-psc-syllabus.html`);
  }

  // 10 sample questions with answers & explanations in <details>
  const detailsCount = (html.match(/<details[\s>]/gi) || []).length;
  if (detailsCount < 10) {
    fail(`Page ${subject.slug}/index.html has only ${detailsCount} <details> elements (expected 10 sample questions)`);
  }

  // Practice button opening the app at that subject with deep link
  const practiceLink = `../#practice/${subject.key}`;
  if (!html.includes(`href="${practiceLink}"`)) {
    fail(`Page ${subject.slug}/index.html missing practice deep link "${practiceLink}"`);
  }

  // Language tags
  if (!html.includes('lang="ml"')) {
    fail(`Page ${subject.slug}/index.html missing lang="ml" tags`);
  }
}

// 8. Ensure no unverified question bank dumps exist as indexable pages
const dumpedPages = ['questions.html', 'all-questions.html', 'bank.html', 'dump.html'];
for (const p of dumpedPages) {
  if (fs.existsSync(path.join(root, p))) {
    fail(`Forbidden question dump page detected: ${p}`);
  }
}

// 9. Fail if public HTML or llms.txt contains the word "verified" while no question has verified:true
if (verifiedQuestionsCount === 0) {
  const publicFiles = [
    homeHtmlPath,
    aboutPath,
    syllabusPath,
    llmsPath,
    ...eligibleSubjects.map(s => path.join(root, s.slug, 'index.html'))
  ];

  for (const pf of publicFiles) {
    if (fs.existsSync(pf)) {
      const content = fs.readFileSync(pf, 'utf8');
      if (/\bverified\b/i.test(content)) {
        fail(`Public file ${path.relative(root, pf)} contains "verified" while no question has verified:true`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`SEO check failed with ${errors.length} error(s):`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`SEO checks passed (${eligibleSubjects.length} subject pages, home, syllabus, about, sitemap.xml, robots.txt, llms.txt).`);
