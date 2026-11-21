// Verifica los enlaces internos del build (dist/): cada href/src local debe existir y cada #ancla
// debe tener un id en la página de destino. Los enlaces externos solo se listan (no se visitan).
// Uso: npm run build && npm run check:links
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(dist)) { console.error('No existe dist/. Ejecuta antes npm run build.'); process.exit(1); }

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk(dist).filter((f) => f.endsWith('.html'));
const urlOf = (file) => '/' + relative(dist, file).split(sep).join('/').replace(/index\.html$/, '');
const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) idsCache.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idsCache.get(file);
};
const resolveFile = (path) => {
  const p = join(dist, decodeURIComponent(path));
  if (path.endsWith('/')) return existsSync(join(p, 'index.html')) ? join(p, 'index.html') : null;
  if (existsSync(p) && statSync(p).isFile()) return p;
  return existsSync(join(p, 'index.html')) ? join(p, 'index.html') : null;
};

const errors = [];
const external = new Set();
let checked = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const from = urlOf(page);
  for (const [, attr, raw] of html.matchAll(/\s(href|src|content)="([^"]*)"/g)) {
    const value = raw.replace(/&amp;/g, '&');
    if (attr === 'content' && !/^\d+;\s*url=/.test(value)) continue; // solo meta refresh
    const link = attr === 'content' ? value.replace(/^\d+;\s*url=/, '') : value;
    if (!link || /^(mailto:|tel:|data:|javascript:)/.test(link)) continue;
    if (/^https?:\/\//.test(link)) {
      if (link.startsWith('https://eduardoleo.github.io/')) {
        // Canonical, hreflang y OG: deben existir en el propio build.
        const u = new URL(link);
        checked++;
        if (!resolveFile(u.pathname)) errors.push(`${from}: ${link} → no existe en dist/`);
      } else external.add(link);
      continue;
    }
    const u = new URL(link, `https://local${from}`);
    const target = resolveFile(u.pathname);
    checked++;
    if (!target) { errors.push(`${from}: ${link} → no existe`); continue; }
    const hash = decodeURIComponent(u.hash.slice(1));
    if (hash && target.endsWith('.html') && !idsOf(target).has(hash)) errors.push(`${from}: ${link} → falta el id "${hash}"`);
  }
}

console.log(`Páginas: ${pages.length} · enlaces internos revisados: ${checked} · externos (no visitados): ${external.size}`);
for (const e of [...external].sort()) console.log(`  externo: ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} enlace(s) roto(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('Sin enlaces internos rotos.');
