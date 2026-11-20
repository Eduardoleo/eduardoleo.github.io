// Genera imágenes estáticas del sitio con Playwright (Chromium):
//   public/og-es.png, public/og-en.png (1200×630), public/apple-touch-icon.png (180×180),
//   public/favicon.ico (32×32) y, con --cv, el CV público: PDF en public/cv/ (se publica)
//   y PDF + PNG de revisión en .local/cv/ (ignorado por git).
// Uso: node scripts/generate-assets.mjs [--cv]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const profile = JSON.parse(readFileSync(join(root, 'src/data/profile.json'), 'utf8'));
const ui = { es: 'Convierto procesos manuales y datos dispersos en sistemas que trabajan solos.', en: 'I turn manual processes and scattered data into systems that run on their own.' };
// Las fuentes se incrustan como data URI: una página creada con setContent no puede leer file://.
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(join(root, 'node_modules', pkg, 'files', file)).toString('base64')}`;
const fonts = `
@font-face{font-family:D;font-weight:100 900;src:url(${font('@fontsource-variable/schibsted-grotesk', 'schibsted-grotesk-latin-wght-normal.woff2')}) format('woff2')}
@font-face{font-family:B;font-weight:200 800;src:url(${font('@fontsource-variable/atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2')}) format('woff2')}
@font-face{font-family:M;src:url(${font('@fontsource/atkinson-hyperlegible-mono', 'atkinson-hyperlegible-mono-latin-400-normal.woff2')}) format('woff2')}`;
const C = { bg: '#f4f6f9', ink: '#12203a', muted: '#4a5872', line: '#c9d2e0', accent: '#1d4ed8', soft: '#dfe7fb', night: '#0d1626', sky: '#8fb0ff' };

const og = (lang) => `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:${C.bg};font-family:B;color:${C.ink};padding:64px 72px;display:grid;grid-template-rows:auto 1fr auto;
background-image:linear-gradient(#e3e9f2 1px,transparent 1px),linear-gradient(90deg,#e3e9f2 1px,transparent 1px);background-size:32px 32px}
.top{display:flex;align-items:center;gap:18px;font:650 30px D}.mark{width:64px;height:64px;border-radius:6px;background:${C.ink};color:${C.bg};display:grid;place-items:center;font:700 22px D;letter-spacing:1px}
h1{font:700 64px/1.08 D;letter-spacing:-1.5px;max-width:960px;align-self:center}
.foot{display:flex;justify-content:space-between;align-items:center;gap:24px;font-size:24px;color:${C.muted};white-space:nowrap}
.flow{display:flex;gap:10px;align-items:center;font:400 20px M;color:${C.ink}}.flow span{padding:8px 14px;border:1.5px solid ${C.line};border-radius:4px;background:#fff}
.flow b{color:${C.accent}}.flow .core{border-color:${C.accent};background:${C.soft}}</style></head><body>
<div class="top"><div class="mark">${profile.initials}</div>${profile.name}</div>
<h1>${ui[lang]}</h1>
<div class="foot"><span>${profile.title[lang]}</span><div class="flow"><span>${lang === 'es' ? 'datos' : 'data'}</span><b>›</b><span class="core">${lang === 'es' ? 'automatización' : 'automation'}</span><b>›</b><span>${lang === 'es' ? 'reportes' : 'reports'}</span></div></div>
</body></html>`;

const icon = (size) => `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
*{margin:0}body{width:${size}px;height:${size}px;background:${C.ink};display:grid;place-items:center;position:relative;border-radius:${size > 64 ? 0 : size * 0.16}px}
b{font:700 ${Math.round(size * 0.36)}px D;color:${C.bg};letter-spacing:${size * 0.01}px;margin-top:-${size * 0.06}px}
i{position:absolute;left:22%;right:22%;bottom:18%;height:${Math.max(2, size * 0.045)}px;background:${C.sky}}</style></head><body><b>${profile.initials}</b><i></i></body></html>`;

// ICO con una imagen PNG embebida (formato admitido por todos los navegadores actuales).
function pngToIco(png, size) {
  const h = Buffer.alloc(22);
  h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  h.writeUInt8(size, 6); h.writeUInt8(size, 7); h.writeUInt8(0, 8); h.writeUInt8(0, 9);
  h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
  return Buffer.concat([h, png]);
}

const browser = await chromium.launch();
const shot = async (html, w, h) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: 'png', omitBackground: false });
  await page.close();
  return buf;
};

for (const lang of ['es', 'en']) writeFileSync(join(root, `public/og-${lang}.png`), await shot(og(lang), 1200, 630));
writeFileSync(join(root, 'public/apple-touch-icon.png'), await shot(icon(180), 180, 180));
writeFileSync(join(root, 'public/favicon.ico'), pngToIco(await shot(icon(32), 32, 32), 32));
console.log('OG, apple-touch-icon y favicon.ico generados en public/');

if (process.argv.includes('--cv')) {
  const { cvHtml } = await import('./cv-template.mjs');
  mkdirSync(join(root, '.local/cv'), { recursive: true });
  mkdirSync(join(root, 'public/cv'), { recursive: true });
  for (const lang of ['es', 'en']) {
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await page.setContent(cvHtml(profile, lang, fonts), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // El CV debe caber en una página carta (11 in = 1056 px) y cada descripción de proyecto en una línea.
    const fit = await page.evaluate(() => ({
      height: document.body.scrollHeight,
      multiline: [...document.querySelectorAll('.one')].filter((el) => el.getClientRects().length !== 1 || el.offsetHeight > parseFloat(getComputedStyle(el).lineHeight) * 1.3).map((el) => el.textContent),
    }));
    if (fit.height > 1056) throw new Error(`CV ${lang}: ${fit.height}px, no cabe en una página (máx. 1056px)`);
    if (fit.multiline.length) throw new Error(`CV ${lang}: descripciones en más de una línea: ${fit.multiline.join(' | ')}`);
    console.log(`CV ${lang}: ${fit.height}px de 1056px`);
    const out = join(root, `.local/cv/eduardo-leon-hernandez-cv-${lang}.pdf`);
    await page.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' }, tagged: true });
    await page.screenshot({ path: out.replace('.pdf', '.png'), fullPage: true });
    await page.close();
    copyFileSync(out, join(root, `public/cv/eduardo-leon-hernandez-cv-${lang}.pdf`));
    console.log('CV:', out, '→ public/cv/');
  }
}
await browser.close();
