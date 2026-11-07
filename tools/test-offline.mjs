/* Tests for Step 6: offline support and installable app.
   Run: node tools/test-offline.mjs */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve();

// 1. Check manifest.webmanifest
const manifestPath = path.join(root, 'manifest.webmanifest');
assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.name, 'PSC Kalari');
assert.equal(manifest.short_name, 'PSC Kalari');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#0E4A3A');
assert.equal(manifest.background_color, '#F4F7F4');
assert.ok(Array.isArray(manifest.icons), 'manifest must have icons array');

const icon192 = manifest.icons.find(i => i.sizes === '192x192');
assert.ok(icon192, '192x192 icon must be declared');
assert.ok(fs.existsSync(path.join(root, icon192.src)), `192 icon file must exist: ${icon192.src}`);

const icon512 = manifest.icons.find(i => i.sizes === '512x512' && (!i.purpose || i.purpose === 'any'));
assert.ok(icon512, '512x512 icon must be declared');
assert.ok(fs.existsSync(path.join(root, icon512.src)), `512 icon file must exist: ${icon512.src}`);

const iconMaskable = manifest.icons.find(i => i.sizes === '512x512' && i.purpose === 'maskable');
assert.ok(iconMaskable, 'maskable 512x512 icon must be declared');
assert.ok(fs.existsSync(path.join(root, iconMaskable.src)), `maskable icon file must exist: ${iconMaskable.src}`);

// 2. Check icon-180 and index.html links
const icon180Path = path.join(root, 'assets/icons/icon-180.png');
assert.ok(fs.existsSync(icon180Path), 'assets/icons/icon-180.png must exist');

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(indexHtml.includes('<link rel="manifest" href="manifest.webmanifest">'), 'index.html must link manifest.webmanifest');
assert.ok(indexHtml.includes('<link rel="apple-touch-icon" href="assets/icons/icon-180.png">'), 'index.html must link apple-touch-icon');
assert.ok(!indexHtml.includes('fonts.googleapis.com'), 'index.html must not link to fonts.googleapis.com');
assert.ok(!indexHtml.includes('fonts.gstatic.com'), 'index.html must not link to fonts.gstatic.com');
assert.ok(indexHtml.includes('css/fonts.css'), 'index.html must link css/fonts.css');

// 3. Check self-hosted fonts and OFL licenses
const fontsCss = fs.readFileSync(path.join(root, 'css/fonts.css'), 'utf8');
assert.ok(fontsCss.includes('font-display: swap'), 'fonts.css must have font-display: swap');
assert.ok(!fontsCss.includes('https://fonts.gstatic.com'), 'fonts.css must not contain remote URLs');

const expectedFonts = [
  'assets/fonts/bricolage-grotesque/bricolage-grotesque-latin.woff2',
  'assets/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext.woff2',
  'assets/fonts/bricolage-grotesque/bricolage-grotesque-vietnamese.woff2',
  'assets/fonts/hanken-grotesk/hanken-grotesk-latin.woff2',
  'assets/fonts/hanken-grotesk/hanken-grotesk-latin-ext.woff2',
  'assets/fonts/hanken-grotesk/hanken-grotesk-vietnamese.woff2',
  'assets/fonts/hanken-grotesk/hanken-grotesk-cyrillic-ext.woff2',
  'assets/fonts/noto-sans-malayalam/noto-sans-malayalam-malayalam.woff2',
  'assets/fonts/noto-sans-malayalam/noto-sans-malayalam-latin-ext.woff2',
  'assets/fonts/noto-sans-malayalam/noto-sans-malayalam-latin.woff2'
];

for (const fontPath of expectedFonts) {
  assert.ok(fs.existsSync(path.join(root, fontPath)), `Font file must exist: ${fontPath}`);
}

const expectedLicenses = [
  'assets/fonts/bricolage-grotesque/OFL.txt',
  'assets/fonts/hanken-grotesk/OFL.txt',
  'assets/fonts/noto-sans-malayalam/OFL.txt'
];

for (const licPath of expectedLicenses) {
  assert.ok(fs.existsSync(path.join(root, licPath)), `License file must exist: ${licPath}`);
}

// 4. Check sw.js and precache URLs
const swPath = path.join(root, 'sw.js');
assert.ok(fs.existsSync(swPath), 'sw.js must exist at root');
const swContent = fs.readFileSync(swPath, 'utf8');

assert.ok(swContent.includes('const CACHE_NAME = \'psc-kalari-'), 'sw.js must include versioned CACHE_NAME');
assert.ok(swContent.includes('event.request.mode === \'navigate\''), 'sw.js must handle navigations');
assert.ok(swContent.includes('/data/'), 'sw.js must handle data requests with stale-while-revalidate');

// Extract all precache URLs and verify they exist on disk
const matchPrecache = swContent.match(/const PRECACHE_URLS = \[([^\]]+)\]/);
assert.ok(matchPrecache, 'sw.js must define PRECACHE_URLS');
const precacheUrls = matchPrecache[1]
  .split(',')
  .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

for (const item of precacheUrls) {
  const diskPath = item === './' ? path.join(root, 'index.html') : path.join(root, item.replace(/^\.\//, ''));
  assert.ok(fs.existsSync(diskPath), `Precache resource must exist on disk: ${item} -> ${diskPath}`);
}

// 5. Test PWA helper functions in isolation
const storage = await import('../js/storage.js');
const blank = storage.blankState();
assert.equal(blank.visits, 0);
assert.equal(blank.installDismissed, false);

const { S } = await import('../js/state.js');
const { setLang } = await import('../js/i18n.js');
const pwa = await import('../js/pwa.js');

// Mock browser environment for pwa tests
globalThis.window = { MSStream: undefined, matchMedia: () => ({ matches: false }) };
Object.defineProperty(globalThis.navigator, 'userAgent', { value: 'iPhone; CPU iPhone OS 16_0 like Mac OS X', configurable: true });
Object.defineProperty(globalThis.navigator, 'standalone', { value: false, configurable: true });

// Visit 1: must not show install card
S.visits = 1;
S.installDismissed = false;
assert.equal(pwa.renderInstallCard(), '', 'Install card must not show on first visit');

// Visit 2: must show install card on iOS Safari
S.visits = 2;
for (const l of ['en', 'ml', 'both']) {
  setLang(l);
  const card = pwa.renderInstallCard();
  assert.ok(card.includes('Install PSC Kalari') || card.includes('പി.എസ്.സി കളരി ഇൻസ്റ്റാൾ ചെയ്യുക'), `Install card in ${l} must have title`);
  assert.ok(card.includes('Tap Share, then Add to Home Screen') || card.includes('ഷെയർ'), `Install card in ${l} must have iOS instruction`);
  assert.ok(!card.includes('aria-label="Dismiss<span'), 'aria-label must not have HTML tags');
}

// Dismissed: must not show again
S.installDismissed = true;
assert.equal(pwa.renderInstallCard(), '', 'Install card must not show once dismissed');

// 6. Test build script updates sw.js
const { execFileSync } = await import('node:child_process');
execFileSync('node', ['tools/build.mjs'], { stdio: 'pipe' });
const swUpdated = fs.readFileSync(swPath, 'utf8');
assert.ok(/const CACHE_NAME = 'psc-kalari-202\d-/.test(swUpdated), 'build.mjs must stamp cache name in sw.js');

console.log('offline and installable app tests passed');
