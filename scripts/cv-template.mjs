// Plantilla del CV público. Sin teléfono, correo, sistemas internos ni montos.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SITE_URL } from '../site.config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projects = JSON.parse(readFileSync(join(root, 'src/data/projects.json'), 'utf8')).projects.sort((a, b) => a.order - b.order);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const M = { es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const fm = (ym, l) => { const [y, m] = ym.split('-').map(Number); return `${M[l][m - 1]} ${y}`; };

const T = {
  es: {
    title: 'Currículum', summaryT: 'Perfil', expT: 'Experiencia', projT: 'Proyectos seleccionados', eduT: 'Formación', courseT: 'Cursos', skillT: 'Herramientas', present: 'actualidad',
    summary: 'Desarrollador web full stack y analista de datos. Automatizo procesos, construyo reportes y desarrollo aplicaciones web con la seguridad incluida desde el diseño. En Claro Costa Rica pasé de servicio al cliente a análisis de datos y hoy trabajo en sistemas.',
    contact: 'Contacto: formulario en el portafolio o LinkedIn',
  },
  en: {
    title: 'Résumé', summaryT: 'Profile', expT: 'Experience', projT: 'Selected projects', eduT: 'Education', courseT: 'Courses', skillT: 'Tools', present: 'present',
    summary: 'Full-stack web developer and data analyst. I automate processes, build reports and develop web applications with security built in from the start. At Claro Costa Rica I moved from customer service to data analysis and now work in systems.',
    contact: 'Contact: form on the portfolio or LinkedIn',
  },
};

export function cvHtml(p, lang, fonts) {
  const t = T[lang];
  const site = lang === 'es' ? `${SITE_URL}/` : `${SITE_URL}/en/`;
  const siteText = site.replace('https://', '').replace(/\/$/, '');
  const exp = p.experience.map((j) => `
    <div class="item"><div class="row"><h3>${esc(j[lang].role)} · ${esc(j.company)}</h3><span>${fm(j.start, lang)} – ${j.end ? fm(j.end, lang) : t.present}</span></div>
    <ul>${j[lang].points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
  // Proyecto en dos líneas: título + stack + año; descripción corta (campo "cv") en una sola línea.
  const proj = projects.map((x) => `<div class="item"><div class="row"><h3>${esc(x[lang].title)} <span class="stack">· ${esc(x.stack.join(', '))}</span></h3><span>${x.year}</span></div><p class="one">${esc(x[lang].cv ?? x[lang].summary)}</p></div>`).join('');
  const edu = p.education.map((e) => `<div class="item"><div class="row"><h3>${esc(e[lang].title)}</h3><span>${fm(e.start, lang)} – ${e.end ? fm(e.end, lang) : t.present}</span></div><p>${esc(e[lang].org)}</p><p class="nw">${esc(e[lang].note)}</p></div>`).join('');
  const courses = p.courses.map((c) => `<li>${esc(c[lang].title)} · ${esc(c[lang].org)} (${c.year})</li>`).join('');
  const skills = p.skills.map((g) => `<p><b>${esc(g[lang])}:</b> ${esc(g.items.join(', '))}</p>`).join('');
  return `<!doctype html><html lang="${lang === 'es' ? 'es-CR' : 'en'}"><head><meta charset="utf-8"><title>${esc(p.name)} · ${t.title}</title><style>${fonts}
  @page{size:Letter;margin:0}*{box-sizing:border-box;margin:0;padding:0}
  body{font:400 10pt/1.42 B;color:#12203a;padding:.55in .6in;width:8.5in}
  header{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;padding-bottom:12px;border-bottom:2px solid #1d4ed8;margin-bottom:12px}
  .mark{width:52px;height:52px;border-radius:4px;background:#12203a;color:#f4f6f9;display:grid;place-items:center;font:700 16px D;letter-spacing:.5px}
  h1{font:700 22pt/1.1 D;letter-spacing:-.4px}.sub{font:600 11pt D;color:#1d4ed8;margin-top:2px}
  .links{font-size:9pt;color:#4a5872;margin-top:4px}.links a{color:#4a5872;text-decoration:none}
  h2{font:700 11.5pt D;margin:12px 0 6px;color:#12203a}
  .item{margin-bottom:8px;break-inside:avoid}.row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
  h3{font:650 10.3pt D}.row span{font-size:9pt;color:#4a5872;white-space:nowrap}
  ul{padding-left:14px}li{margin:1px 0}p{margin:1px 0}.muted{color:#4a5872;font-size:9pt}
  .stack{font:400 9pt B;color:#4a5872}.nw{white-space:nowrap}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}</style></head><body>
  <header><div class="mark">${esc(p.initials)}</div><div><h1>${esc(p.name)}</h1><p class="sub">${esc(p.title[lang])}</p>
  <p class="links">${esc(p.location[lang])} · <a href="${site}">${siteText}</a> · <a href="${p.links.linkedin}">linkedin.com/in/eduardolh</a> · <a href="${p.links.github}">github.com/Eduardoleo</a></p>
  <p class="links">${t.contact}</p></div></header>
  <h2>${t.summaryT}</h2><p>${esc(t.summary)}</p>
  <h2>${t.expT}</h2>${exp}
  <h2>${t.projT}</h2>${proj}
  <div class="cols"><div><h2>${t.eduT}</h2>${edu}<h2>${t.courseT}</h2><ul>${courses}</ul></div><div><h2>${t.skillT}</h2>${skills}</div></div>
  </body></html>`;
}
