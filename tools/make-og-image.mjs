import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve();
const outPath = path.join(root, 'assets/og-image.png');
const tempHtmlPath = path.join(root, 'assets/temp-og.html');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="../css/fonts.css">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: 1200px;
    height: 630px;
    background: #0E4A3A;
    color: #FFFFFF;
    font-family: 'Hanken Grotesk', system-ui, sans-serif;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    padding: 60px 80px;
  }
  .border-box {
    position: absolute;
    inset: 30px;
    border: 3px solid #B58420;
    border-radius: 24px;
    pointer-events: none;
    opacity: 0.85;
  }
  .border-line-top {
    position: absolute;
    top: 50px;
    left: 60px;
    right: 60px;
    height: 1.5px;
    background: #B58420;
    opacity: 0.5;
  }
  .border-line-bottom {
    position: absolute;
    bottom: 50px;
    left: 60px;
    right: 60px;
    height: 1.5px;
    background: #B58420;
    opacity: 0.5;
  }
  .content {
    display: flex;
    align-items: center;
    gap: 60px;
    z-index: 1;
    width: 100%;
  }
  .lamp-box {
    width: 200px;
    height: 200px;
    flex: none;
    background: #123A2D;
    border: 3px solid #B58420;
    border-radius: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 16px 36px rgba(0,0,0,0.3);
  }
  .lamp-box svg {
    width: 150px;
    height: 150px;
  }
  .text-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .eyebrow {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #E9C46A;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: 24px;
  }
  .brand-title {
    font-family: 'Bricolage Grotesque', system-ui, sans-serif;
    font-size: 72px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    color: #FFFFFF;
  }
  .brand-ml {
    font-family: 'Noto Sans Malayalam', system-ui, sans-serif;
    font-size: 40px;
    font-weight: 600;
    color: #E9C46A;
  }
  .desc {
    font-size: 26px;
    line-height: 1.45;
    color: #BCD6CA;
    max-width: 780px;
    margin-top: 4px;
  }
  .pills {
    display: flex;
    gap: 14px;
    margin-top: 16px;
  }
  .pill {
    padding: 8px 18px;
    border-radius: 999px;
    background: #174235;
    border: 1.5px solid #285949;
    font-size: 18px;
    font-weight: 600;
    color: #E6EFEA;
  }
  .pill.gold {
    background: #2A2410;
    border-color: #B58420;
    color: #F6E7B8;
  }
</style>
</head>
<body>
  <div class="border-box"></div>
  <div class="border-line-top"></div>
  <div class="border-line-bottom"></div>

  <div class="content">
    <div class="lamp-box">
      <svg viewBox="0 0 64 64" fill="none">
        <rect x="4.5" y="4.5" width="55" height="55" rx="10" stroke="#B58420" stroke-width="1.2" opacity=".85"/>
        <path d="M8 12h48M8 52h48" stroke="#B58420" stroke-width="1.1" opacity=".55"/>
        <ellipse cx="32" cy="17" rx="3.1" ry="5" fill="#F6E7B8"/>
        <path d="M23 26h18l-3.4 6H26.4z" fill="#E9C46A"/>
        <rect x="30.4" y="32" width="3.2" height="10" rx="1.2" fill="#E9C46A"/>
        <path d="M24 42h16l2 5H22z" fill="#E9C46A"/>
      </svg>
    </div>
    <div class="text-box">
      <div class="eyebrow">Kerala PSC Practice Portal</div>
      <div class="title-row">
        <span class="brand-title">PSC Kalari</span>
        <span class="brand-ml">പി.എസ്.സി കളരി</span>
      </div>
      <p class="desc">
        Free daily practice, subject-wise sets with explanations &amp; mock tests with negative marking. English &amp; Malayalam.
      </p>
      <div class="pills">
        <span class="pill gold">English &amp; മലയാളം</span>
        <span class="pill">Topic-Wise Questions</span>
        <span class="pill">Timed Mock Tests</span>
        <span class="pill">Offline Ready</span>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(tempHtmlPath, html, 'utf8');

console.log('Rendering assets/og-image.png (1200x630)...');
const fileUrl = 'file:///' + tempHtmlPath.replace(/\\/g, '/');

execFileSync(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--screenshot=${outPath}`,
  '--window-size=1200,630',
  fileUrl
]);

fs.unlinkSync(tempHtmlPath);

if (fs.existsSync(outPath)) {
  const stats = fs.statSync(outPath);
  console.log(`Successfully generated assets/og-image.png (${stats.size} bytes).`);
} else {
  throw new Error('Failed to create assets/og-image.png');
}
