// Renders the still images in public/promo/ that are not frames of the video:
//
//   og.jpg                 1200×630   link preview (og:image) for every page
//   idznamiasto-post.jpg   1080×1350  fallback for a feed post when the video can't be shared
//   idznamiasto-story.jpg  1080×1920  fallback for a story / short
//
// They copy the look of the promo video's last scene (pin, "Otwierasz i wiesz.",
// a coral pill with the address) but name the bare domain rather than the
// video's idznamiasto.pl/szczecin, so the same picture is right for any city.
//
//   node scripts/render-promo-images.mjs
//
// Needs network for Google Fonts and the Playwright Chromium the e2e suite uses.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'promo');

const PIN =
  'M24 3.5a15.5 15.5 0 0 1 15.5 15.5c0 10.9-15.5 25.5-15.5 25.5S8.5 29.9 8.5 19A15.5 15.5 0 0 1 24 3.5zM16.1 28.5v-5.5h3.1v5.5zM20.35 28.5v-8.5h3.1v8.5zM24.6 28.5v-11h3.1v11zM28.85 28.5v-6.5h3.1v6.5zM25.85 15.1h.6v2.4h-.6zM24.4 6.15c.31 1.94 1.63 3.26 3.57 3.57-1.94.31-3.26 1.63-3.57 3.57-.31-1.94-1.63-3.26-3.57-3.57 1.94-.31 3.26-1.63 3.57-3.57z';

const IMAGES = [
  { file: 'og.jpg', width: 1200, height: 630, unit: 6.3, hook: false },
  { file: 'idznamiasto-post.jpg', width: 1080, height: 1350, unit: 10.8, hook: true },
  { file: 'idznamiasto-story.jpg', width: 1080, height: 1920, unit: 12.6, hook: true },
];

function html({ width, height, unit, hook }) {
  // `u` is 1% of the short side, so the three sizes share one layout.
  const u = (n) => `${(n * unit).toFixed(1)}px`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@500;600&display=swap&subset=latin-ext" rel="stylesheet">
<style>
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
  body{background:#fbf8f3;font-family:Figtree,sans-serif;color:#221c26;position:relative;
    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .blob{position:absolute;border-radius:50%;filter:blur(${u(9)})}
  .b1{width:${u(70)};height:${u(70)};left:-${u(18)};top:-${u(16)};background:radial-gradient(circle,#f9a8d4 0%,rgba(249,168,212,0) 70%)}
  .b2{width:${u(80)};height:${u(80)};right:-${u(26)};top:${u(8)};background:radial-gradient(circle,#fdba74 0%,rgba(253,186,116,0) 70%)}
  .b3{width:${u(75)};height:${u(75)};left:-${u(20)};bottom:-${u(20)};background:radial-gradient(circle,#c4b5fd 0%,rgba(196,181,253,0) 70%)}
  .b4{width:${u(60)};height:${u(60)};right:-${u(14)};bottom:-${u(12)};background:radial-gradient(circle,#fed7aa 0%,rgba(254,215,170,0) 70%)}
  .col{position:relative;display:flex;flex-direction:column;align-items:center}
  .hook{font-family:'Bricolage Grotesque';font-weight:800;font-size:${u(7.4)};letter-spacing:-0.02em;line-height:1.05;margin:0 ${u(8)} ${u(9)}}
  .hook small{display:block;font-family:Figtree;font-weight:600;font-size:${u(3.6)};letter-spacing:0;color:#e8557d;margin-top:${u(2)}}
  svg{width:${u(17)};height:${u(17)};color:#f4553b;filter:drop-shadow(0 ${u(1)} ${u(2)} rgba(244,85,59,.35))}
  h1{margin:${u(3)} 0 ${u(5)};font-family:'Bricolage Grotesque';font-weight:800;font-size:${u(13)};line-height:.98;letter-spacing:-0.035em;
    background:linear-gradient(90deg,#ec4899 0%,#f97316 55%,#8b5cf6 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .pill{background:#f4553b;color:#fff;font-family:'Bricolage Grotesque';font-weight:700;font-size:${u(6)};padding:${u(2.2)} ${u(6)};
    border-radius:999px;box-shadow:0 ${u(1.4)} ${u(4)} rgba(244,85,59,.35)}
  .sub{margin-top:${u(4)};font-weight:500;font-size:${u(3.6)};color:#4a4250}
</style></head><body>
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="blob b4"></div>
  <div class="col">
    ${hook ? '<p class="hook">Coś się dzieje,<br>a&nbsp;Ty nie wiesz?<small>Wszystkie wydarzenia z miasta<br>w jednym miejscu</small></p>' : ''}
    <svg viewBox="0 0 48 48" fill="currentColor" fill-rule="evenodd"><path d="${PIN}"/></svg>
    <h1>Otwierasz<br>i wiesz.</h1>
    <div class="pill">idznamiasto.pl</div>
    <div class="sub">Bez konta. Bez instalacji.</div>
  </div>
</body></html>`;
}

const browser = await chromium.launch();
try {
  for (const image of IMAGES) {
    const page = await browser.newPage({ viewport: { width: image.width, height: image.height } });
    await page.setContent(html(image), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, image.file), type: 'jpeg', quality: 86 });
    await page.close();
    console.log(`wrote public/promo/${image.file}`);
  }
} finally {
  await browser.close();
}
