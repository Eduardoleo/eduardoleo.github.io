// Enlaces de WhatsApp sin el número en el HTML (disuasión básica frente a recolectores).
// En profile.json el número se guarda como base64 del número invertido (contact.whatsapp.code).
// Uso desde otros componentes (p. ej. la calculadora):
//   import { buildWhatsAppUrl } from '../scripts/whatsapp';
//   const url = buildWhatsAppUrl(code, 'Hola, quiero cotizar…');  // null si el código no es válido

import { trackWhatsApp } from './analytics';

/** Decodifica el número guardado en profile.json. Devuelve null si no es un número válido. */
export function decodeWhatsAppNumber(code: string): string | null {
  try {
    const num = atob(code).split('').reverse().join('');
    return /^\d{8,15}$/.test(num) ? num : null;
  } catch {
    return null;
  }
}

/** Arma https://wa.me/<número>?text=<mensaje>. Devuelve null si el código no es válido. */
export function buildWhatsAppUrl(code: string, message = ''): string | null {
  const num = decodeWhatsAppNumber(code);
  if (!num) return null;
  return message ? `https://wa.me/${num}?text=${encodeURIComponent(message)}` : `https://wa.me/${num}`;
}

/**
 * Convierte un enlace con data-wa (código) y data-msg (mensaje) en un enlace a WhatsApp.
 * Sin JavaScript el enlace sigue apuntando a su href original (#contacto) en la misma pestaña;
 * con JavaScript abre wa.me en una pestaña nueva con rel="noopener noreferrer".
 */
export function activateWhatsAppLink(a: HTMLAnchorElement): void {
  if (a.dataset.built) return;
  const url = buildWhatsAppUrl(a.dataset.wa ?? '', a.dataset.msg ?? '');
  if (!url) return;
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.dataset.built = '1';
}

/** Prepara todos los enlaces .wa-link: se arman al primer contacto (ratón, teclado o toque). */
export function initWhatsAppLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>('.wa-link').forEach((a) => {
    if (!decodeWhatsAppNumber(a.dataset.wa ?? '')) return; // código inválido: queda el enlace a #contacto
    // El aviso "(abre en una pestaña nueva)" solo es cierto con JavaScript.
    a.querySelectorAll<HTMLElement>('[data-wa-newtab]').forEach((s) => s.removeAttribute('hidden'));
    const build = () => activateWhatsAppLink(a);
    ['pointerenter', 'pointerdown', 'focus', 'touchstart'].forEach((ev) => a.addEventListener(ev, build, { passive: true }));
    a.addEventListener('click', build);
    a.addEventListener('click', () => { if (a.dataset.built) trackWhatsApp('contacto'); });
  });
}
