# PSC Kalari (പി.എസ്.സി കളരി)

> Free, mobile-first Kerala PSC practice web application. Built with vanilla JavaScript modules, modern CSS, and static HTML. Zero frameworks, zero backend, zero tracking, and zero runtime npm dependencies.

---

## Overview

PSC Kalari is an offline-ready, installable Progressive Web App (PWA) designed for Kerala Public Service Commission (PSC) exam aspirants. Everything runs client-side in the browser, storing user streaks, accuracy metrics, missed questions, and bookmarks in `localStorage`.

### Key Features
- **Daily Five:** 5 quick questions every day to build a consistent habit.
- **Subject Practice:** Topic-wise practice sets with bilingual explanations after every question.
- **Mini & Full Mock Tests:** Timed exam papers (20-question mini mock and 100-question full mock) with official Kerala PSC negative marking (+1 for correct, −1/3 for wrong, 0 for unattempted) and session resume support.
- **Mistakes Notebook & Starred Questions:** Dedicated review screen (`#review`) to retry missed questions and review starred bookmarks.
- **Bilingual Support:** Every question, option, explanation, and UI control works in English, Malayalam (`മലയാളം`), and Both modes.
- **Offline & Installable:** Service Worker precaches the app shell and prefetches question banks during idle time. Works completely offline and installs to home screens on Android, iOS, and desktop.
- **Search Engine Landing Pages:** Pre-rendered static landing pages (`/<slug>/index.html`) for subjects with 20+ questions, complete with syllabus breakdown, 10 sample questions with `<details>` explanations, and SEO metadata.

---

## Development Commands

All scripts require Node.js 18+ and have zero third-party npm dependencies:

```bash
# Validate question bank schema, taxonomy, sources, and bilingual completeness
npm run validate

# Full question bank check enforcing a minimum threshold (e.g. 300 questions)
npm run validate:full

# Compile questions into subject chunks, generate static SEO pages, sitemap, and sw.js
npm run build

# Run the full automated verification test suite
npm run check

# Start local static development server at http://localhost:4173
npm run serve
```

### What `npm run check` Runs:
1. `tools/validate.mjs` — validates schema, topics, sources, and bilingual integrity.
2. `tools/test-storage.mjs` — tests state schema migrations, export/import, and memory fallbacks.
3. `tools/test-share.mjs` — tests WhatsApp and clipboard sharing format strings.
4. `tools/test-mock.mjs` — tests mock exam scoring formula, balanced draws, and session persistence.
5. `tools/test-offline.mjs` — tests manifest, icon dimensions, self-hosted font files, and PWA logic.
6. `tools/check-seo.mjs` — verifies `<h1>` tags, unique titles (< 60 chars), descriptions (< 160 chars), canonical URLs, and sitemap inclusion.
7. `tools/check-attrs.mjs` — verifies no `tx()` calls are embedded inside HTML attribute values (which would leak HTML markup into attributes).
8. `tools/test-build-clean.mjs` — verifies `npm run build` is deterministic and leaves a clean git working tree when source data has not changed.

---

## Deployment Guide

Generated files (`data/q/*.json`, `data/index.json`, static subject pages, `sitemap.xml`, and `sw.js`) remain committed in the repository so the site can be deployed instantly to any static host without requiring a build step.

### 1. Cloudflare Pages
1. Connect your GitHub repository in the Cloudflare Pages dashboard.
2. Configure build settings:
   - **Framework preset:** `None`
   - **Build command:** `npm run build`
   - **Build output directory:** `/` (leave empty or set to repository root)
3. HTTP caching headers are automatically configured via the `_headers` file.

### 2. Netlify
1. Connect your repository in Netlify.
2. Settings are pre-configured via `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `.`
3. Custom caching headers and 404 handling are automatically applied via `netlify.toml` and `404.html`.

### 3. GitHub Pages
1. Go to repository **Settings** -> **Pages**.
2. Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
3. Choose branch `main` (or `master`) and folder `/(root)`. Click **Save**.
4. **Sub-path Hosting:** All stylesheet links, scripts, icons, manifest, router deep links, and service worker registrations use relative paths (`./` and `../`), allowing the application to live under a sub-path such as `https://<username>.github.io/<repository>/`.
5. **Jekyll Bypass:** A `.nojekyll` file is included in the root directory to prevent GitHub Pages from ignoring files beginning with underscores (such as `_headers`).
6. Because generated files are committed to version control, GitHub Pages serves the site directly without requiring a GitHub Actions build workflow.

---

## Post-Deployment: Final Site URL Update

Once deployed, update the placeholder canonical URL with your live domain:

1. Open `js/config.js` and update `SITE_URL`:
   ```javascript
   export const SITE_URL = 'https://your-custom-domain.com/';
   ```
2. Re-run the build to update canonical tags, sitemap, and robots.txt:
   ```bash
   npm run build
   ```
3. Commit and push:
   ```bash
   git commit -am "chore: update production site url"
   git push
   ```

---

## Manual QA Checklist

Before each release, verify the following checklist in mobile browsers (or Chrome DevTools device simulation):

- [ ] **Viewport & Layout (360px & 412px widths):**
  - Verify layout on narrow mobile screens (360px width, e.g. Samsung Galaxy S8 / Android Go).
  - Verify layout on standard mobile screens (412px width, e.g. Google Pixel / modern Samsung Galaxy).
  - Ensure zero horizontal scrolling across all views (`#home`, `#mock`, `#syllabus`, `#papers`, `#progress`, `#review`, `#search`, and subject pages).
  - Ensure all buttons, links, and touch targets meet the $\ge 44\text{px}$ minimum tap target size.
- [ ] **Themes (Light & Dark):**
  - Toggle between light and dark modes via the header theme button.
  - Verify card borders, kasavu gold accents, text contrast, options state, and palette colors.
  - Ensure no white-flash on reload before paint.
- [ ] **Bilingual Modes (English, Malayalam, Both):**
  - Switch between `English`, `മലയാളം`, and `Both` using the language bar.
  - Verify question text, options, explanations, and review cards display proper typography and Malayalam font rendering.
- [ ] **Offline Operation:**
  - In DevTools -> **Network**, select **Offline**.
  - Reload the page. Confirm app shell loads from Service Worker cache.
  - Verify the top offline indicator banner appears: *"You are offline. Saved questions still work."*
  - Practise cached subjects, review saved questions, and navigate tabs while offline.
- [ ] **PWA Installation:**
  - On Chromium/Android: Check that the *"Install PSC Kalari"* prompt appears on the 2nd visit (`visits >= 2`). Dismissing it hides the prompt permanently.
  - On iOS Safari: Verify the prompt displays *"Tap Share, then Add to Home Screen"*.
- [ ] **Mock Test Resume & Timer:**
  - Start a mock test (`#mock`).
  - Answer 3 questions, then switch tabs, navigate to another hash route, or reload the page.
  - Return to `#mock`: verify the test shows *"Resume your test (mm:ss left)"* and resume restores answers, current question, and remaining timer.
- [ ] **Keyboard & Accessibility:**
  - Press `Tab` on first load: verify the *"Skip to content"* link appears and jumps focus to main content.
  - Navigate questions, options, and tabs using only `Tab`, `Shift+Tab`, `Enter`, and `Space`. Focus rings must remain crisp and visible.
- [ ] **Screen Reader Labels:**
  - Inspect icon buttons (Search, Theme switch, Star bookmark, Share, Copy, Close): confirm all have descriptive `aria-label`s without embedded HTML tags.
  - Verify `<details>` elements on sample question cards announce expanded/collapsed states correctly.

