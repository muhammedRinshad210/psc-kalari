/* SEO validator: node tools/check-seo.mjs
   Checks sitemap.xml, robots.txt, home page SEO tags and generated subject pages.
   Fails when a generated page has no h1, more than one h1, a duplicate title,
   a title over 60 chars, a description over 160 chars, a missing canonical,
   is missing from the sitemap, or contains forbidden schemas (FAQPage, Quiz). */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL } from '../js/config.js';

const root = path.resolve();
const siteBase = SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;
const MIN_QUESTIONS = 20;

const errors = [];
const fail = (msg) => errors.push(msg);

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

// 2. Check robots.txt
const robotsPath = path.join(root, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  fail('robots.txt does not exist at site root');
} else {
  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!robots.includes('Allow: /')) {
    fail('robots.txt does not allow crawling (missing "Allow: /")');
  }
  if (!robots.includes(`Sitemap: ${siteBase}sitemap.xml`)) {
    fail(`robots.txt does not point to ${siteBase}sitemap.xml`);
  }
}

// 3. Check home page (index.html)
const homeHtmlPath = path.join(root, 'index.html');
const homeHtml = fs.readFileSync(homeHtmlPath, 'utf8');

const homeTitleMatch = homeHtml.match(/<title>([^<]+)<\/title>/i);
if (!homeTitleMatch) fail('index.html is missing a <title>');

const homeCanonicalMatch = homeHtml.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
if (!homeCanonicalMatch) fail('index.html is missing canonical URL');
else if (homeCanonicalMatch[1] !== siteBase && homeCanonicalMatch[1] !== SITE_URL) {
  fail(`index.html canonical (${homeCanonicalMatch[1]}) does not match SITE_URL (${siteBase})`);
}

if (!homeHtml.includes('property="og:image"') || !homeHtml.includes('assets/og-image.png')) {
  fail('index.html missing og:image tag pointing to assets/og-image.png');
}
if (!fs.existsSync(path.join(root, 'assets/og-image.png'))) {
  fail('assets/og-image.png does not exist on disk');
}
if (!homeHtml.includes('"@type": "WebSite"') && !homeHtml.includes('"@type":"WebSite"')) {
  fail('index.html missing WebSite JSON-LD markup');
}
if (homeHtml.includes('FAQPage') || homeHtml.includes('Quiz')) {
  fail('index.html must not contain FAQPage or Quiz markup');
}

// 4. Identify subjects with at least MIN_QUESTIONS
const subjects = JSON.parse(fs.readFileSync(path.join(root, 'data/subjects.json'), 'utf8')).subjects;
const questions = JSON.parse(fs.readFileSync(path.join(root, 'data/questions.json'), 'utf8'));

const counts = new Map();
for (const s of subjects) counts.set(s.key, 0);
for (const q of questions) {
  counts.set(q.subject, (counts.get(q.subject) || 0) + 1);
}

const eligibleSubjects = subjects.filter(s => (counts.get(s.key) || 0) >= MIN_QUESTIONS);
if (eligibleSubjects.length === 0) {
  fail('No eligible subjects found with >= ' + MIN_QUESTIONS + ' questions');
}

const seenTitles = new Set([homeTitleMatch ? homeTitleMatch[1].trim() : '']);

for (const subject of eligibleSubjects) {
  const pagePath = path.join(root, subject.slug, 'index.html');
  if (!fs.existsSync(pagePath)) {
    fail(`Generated page missing for ${subject.key}: ${subject.slug}/index.html`);
    continue;
  }

  const html = fs.readFileSync(pagePath, 'utf8');

  // Exactly one <h1>
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  if (h1Matches.length === 0) {
    fail(`Page ${subject.slug}/index.html has no <h1> tag`);
  } else if (h1Matches.length > 1) {
    fail(`Page ${subject.slug}/index.html has ${h1Matches.length} <h1> tags (must have exactly one)`);
  }

  // Unique title under 60 chars
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) {
    fail(`Page ${subject.slug}/index.html missing <title> tag`);
  } else {
    const title = titleMatch[1].trim();
    if (title.length > 60) {
      fail(`Page ${subject.slug}/index.html title is ${title.length} characters (must be under 60): "${title}"`);
    }
    if (seenTitles.has(title)) {
      fail(`Page ${subject.slug}/index.html has duplicate title: "${title}"`);
    }
    seenTitles.add(title);
  }

  // Meta description under 160 chars
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!descMatch) {
    fail(`Page ${subject.slug}/index.html missing meta description`);
  } else {
    const desc = descMatch[1].trim();
    if (desc.length > 160) {
      fail(`Page ${subject.slug}/index.html description is ${desc.length} chars (must be under 160): "${desc}"`);
    }
  }

  // Absolute canonical URL from SITE_URL
  const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const expectedCanonical = `${siteBase}${subject.slug}/`;
  if (!canonicalMatch) {
    fail(`Page ${subject.slug}/index.html missing canonical link`);
  } else if (canonicalMatch[1] !== expectedCanonical) {
    fail(`Page ${subject.slug}/index.html canonical "${canonicalMatch[1]}" does not match expected "${expectedCanonical}"`);
  }

  // Present in sitemap
  if (!sitemapLocs.has(expectedCanonical)) {
    fail(`Page ${expectedCanonical} is missing from sitemap.xml`);
  }

  // Open Graph & Twitter tags
  if (!html.includes('property="og:title"')) fail(`Page ${subject.slug} missing og:title`);
  if (!html.includes('property="og:description"')) fail(`Page ${subject.slug} missing og:description`);
  if (!html.includes('property="og:url"')) fail(`Page ${subject.slug} missing og:url`);
  if (!html.includes('property="og:image"')) fail(`Page ${subject.slug} missing og:image`);
  if (!html.includes('name="twitter:card"')) fail(`Page ${subject.slug} missing twitter:card`);

  // JSON-LD: BreadcrumbList (no FAQPage or Quiz)
  if (!html.includes('"@type": "BreadcrumbList"') && !html.includes('"@type":"BreadcrumbList"')) {
    fail(`Page ${subject.slug}/index.html missing BreadcrumbList JSON-LD`);
  }
  if (html.includes('FAQPage') || html.includes('Quiz')) {
    fail(`Page ${subject.slug}/index.html must not contain FAQPage or Quiz schema markup`);
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
}

if (errors.length > 0) {
  console.error(`SEO check failed with ${errors.length} error(s):`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`SEO checks passed (${eligibleSubjects.length} subject pages, home page, sitemap.xml, robots.txt).`);
