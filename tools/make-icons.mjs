import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const iconsDir = path.resolve('assets/icons');
fs.mkdirSync(iconsDir, { recursive: true });

// Read the original favicon
const originalSvg = fs.readFileSync('assets/favicon.svg', 'utf8');

// 1. icon-180: Apple touch icon - full bleed background (no rounded rect rx so iOS squircle mask works perfectly)
const svg180 = originalSvg.replace('<rect width="64" height="64" rx="13" fill="#0E4A3A"/>', '<rect width="64" height="64" fill="#0E4A3A"/>');

// 2. icon-192: standard icon
const svg192 = originalSvg;

// 3. icon-512: standard icon
const svg512 = originalSvg;

// 4. icon-maskable-512: full bleed background, scaled inner content within 80% safe zone circle
// Safe circle radius is 25.6 (diameter 51.2). The border is 55x55 (corner distance ~38.89 from center).
// Scaling by 0.62 brings corner distance to ~24.1, safely inside 25.6!
const innerContent = `
  <g transform="translate(32, 32) scale(0.62) translate(-32, -32)">
    <rect x="4.5" y="4.5" width="55" height="55" rx="10" fill="none" stroke="#B58420" stroke-width="1.2" opacity=".85"/>
    <path d="M8 12h48M8 52h48" stroke="#B58420" stroke-width="1.1" opacity=".55"/>
    <ellipse cx="32" cy="17" rx="3.1" ry="5" fill="#F6E7B8"/>
    <path d="M23 26h18l-3.4 6H26.4z" fill="#E9C46A"/>
    <rect x="30.4" y="32" width="3.2" height="10" rx="1.2" fill="#E9C46A"/>
    <path d="M24 42h16l2 5H22z" fill="#E9C46A"/>
  </g>
`;
const svgMaskable512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="PSC Kalari">
  <rect width="64" height="64" fill="#0E4A3A"/>
${innerContent}
</svg>`;

const jobs = [
  { name: 'icon-180.png', size: 180, svg: svg180 },
  { name: 'icon-192.png', size: 192, svg: svg192 },
  { name: 'icon-512.png', size: 512, svg: svg512 },
  { name: 'icon-maskable-512.png', size: 512, svg: svgMaskable512 }
];

for (const job of jobs) {
  const tempSvgPath = path.resolve(`assets/icons/temp-${job.size}-${job.name}.svg`);
  const outPngPath = path.resolve(`assets/icons/${job.name}`);
  fs.writeFileSync(tempSvgPath, job.svg, 'utf8');

  // Generate HTML wrapper to guarantee transparent/correct rendering and precise viewport sizing
  const tempHtmlPath = path.resolve(`assets/icons/temp-${job.name}.html`);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${job.size}px; height:${job.size}px; overflow:hidden; background:transparent; }
  svg { width:100%; height:100%; display:block; }
</style>
</head>
<body>
${job.svg}
</body>
</html>`;
  fs.writeFileSync(tempHtmlPath, html, 'utf8');

  console.log(`Rendering ${job.name} (${job.size}x${job.size})...`);
  const fileUrl = 'file:///' + tempHtmlPath.replace(/\\/g, '/');

  execFileSync(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--screenshot=${outPngPath}`,
    `--window-size=${job.size},${job.size}`,
    '--default-background-color=00000000',
    fileUrl
  ]);

  if (fs.existsSync(outPngPath)) {
    const stats = fs.statSync(outPngPath);
    console.log(`  -> created ${job.name} (${stats.size} bytes)`);
  } else {
    throw new Error(`Failed to create ${job.name}`);
  }

  fs.unlinkSync(tempSvgPath);
  fs.unlinkSync(tempHtmlPath);
}

console.log('All icons generated successfully.');
