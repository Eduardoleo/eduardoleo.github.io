// Calculadora de cotización (/cotizar/ y /en/quote/). Todo ocurre en el navegador:
// no hay backend, cookies ni almacenamiento. Solo se comparte algo si la persona abre WhatsApp.
// Analítica (src/scripts/analytics.ts): solo el identificador del paquete elegido y el clic en WhatsApp.
// Los precios se leen de los atributos data-* que Quote.astro genera desde services.json.
import { buildWhatsAppUrl } from './whatsapp';
import { estimate, formatCRC } from './pricing';
import { trackQuotePackage, trackWhatsApp } from './analytics';

type Lang = 'es' | 'en';
const fill = (tpl: string, vals: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? '');

export function initQuote(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>('form.quote-calc');
  if (!form) return;
  const T: Record<string, string> = JSON.parse(form.dataset.i18n ?? '{}');
  const lang = (form.dataset.lang === 'en' ? 'en' : 'es') as Lang;
  const q = <E extends Element>(sel: string) => [...form.querySelectorAll<E>(sel)];
  const lines = q<HTMLInputElement>('input[name="linea"]');
  const pkgs = q<HTMLInputElement>('input[name="paquete"]');
  const extras = q<HTMLInputElement>('input[name="extra"]');
  const urgentInput = form.querySelector<HTMLInputElement>('input[name="plazo"][value="urgente"]');
  const pkgEmpty = form.querySelector<HTMLElement>('[data-empty="paquete"]');
  const extrasEmpty = form.querySelector<HTMLElement>('[data-empty="extras"]');
  const amount = form.querySelector<HTMLElement>('.quote-amount')!;
  const note = form.querySelector<HTMLElement>('.quote-note')!;
  const wa = form.querySelector<HTMLAnchorElement>('.quote-wa')!;

  // Preselección desde la URL: ?linea=a&paquete=a-dashboard (el paquete manda sobre la línea).
  const params = new URLSearchParams(location.search);
  const wantPkg = pkgs.find((p) => p.value === params.get('paquete'));
  const wantLine = lines.find((l) => l.value === (wantPkg?.dataset.line ?? params.get('linea')));
  if (wantLine) wantLine.checked = true;
  if (wantPkg) wantPkg.checked = true;

  function sync() {
    const line = lines.find((l) => l.checked);
    let pkg = pkgs.find((p) => p.checked);
    if (pkg && pkg.dataset.line !== line?.value) {
      pkg.checked = false;
      pkg = undefined;
    }
    q<HTMLElement>('[data-pkg-group]').forEach((g) => (g.hidden = g.dataset.line !== line?.value));
    q<HTMLElement>('[data-extras-for]').forEach((g) => (g.hidden = g.dataset.extrasFor !== pkg?.value));
    if (pkgEmpty) pkgEmpty.hidden = !!line;
    if (extrasEmpty) extrasEmpty.hidden = !!pkg;
    extras.forEach((x) => { if (x.dataset.pkg !== pkg?.value) x.checked = false; });
    render(line, pkg);
  }

  function render(line?: HTMLInputElement, pkg?: HTMLInputElement) {
    if (!line || !pkg) {
      amount.textContent = T.pending;
      note.textContent = '';
      wa.hidden = true;
      wa.href = wa.dataset.fallback ?? '#';
      return;
    }
    const chosen = extras.filter((x) => x.checked && x.dataset.pkg === pkg.value);
    const urgent = !!urgentInput?.checked;
    const est = estimate({
      desde: pkg.dataset.desde,
      hasta: pkg.dataset.hasta,
      extras: chosen.map((x) => x.dataset.precio),
      urgent,
      pct: form!.dataset.pct,
    });
    let shown: string;
    let inMsg: string;
    if (est.kind === 'custom') {
      shown = T.custom;
      inMsg = T.msgCustom;
      note.textContent = T.customNote;
    } else {
      const v = { min: formatCRC(est.min, lang), max: formatCRC(est.max, lang) };
      shown = fill(est.surchargePending ? T.rangePending : T.range, v);
      inMsg = fill(est.surchargePending ? T.msgRangePending : T.msgRange, v);
      note.textContent = T.note;
    }
    amount.textContent = shown;
    const message = fill(T.msg, {
      line: line.dataset.name ?? '',
      package: pkg.dataset.name ?? '',
      extras: chosen.length ? chosen.map((x) => x.dataset.name).join(', ') : T.msgNone,
      term: urgent ? T.msgUrgent : T.msgNormal,
      estimate: inMsg,
    });
    const url = buildWhatsAppUrl(wa.dataset.wa ?? '', message);
    if (url) {
      wa.href = url;
      wa.hidden = false;
    } else {
      wa.hidden = true;
      wa.href = wa.dataset.fallback ?? '#';
    }
  }

  form.addEventListener('change', (e) => {
    sync();
    const el = e.target as HTMLInputElement;
    if (el.name === 'paquete' && el.checked) trackQuotePackage(el.value);
  });
  wa.addEventListener('click', () => {
    const pkg = pkgs.find((p) => p.checked);
    if (!wa.hidden && pkg) trackWhatsApp('calculadora', { paquete: pkg.value, urgente: !!urgentInput?.checked });
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  sync();
}
