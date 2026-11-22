// Eventos de analítica sin cookies (Simple Analytics, https://docs.simpleanalytics.com/events).
// Reglas:
// - Nunca se envían datos personales: solo idioma, identificadores de paquete/proyecto y valores sí/no.
// - El script de Simple Analytics solo se carga en producción (PUBLIC_ANALYTICS=true, ver Layout.astro).
//   Sin él, estas funciones no hacen nada, salvo que exista window.sa_event (lo usan las pruebas para espiar).
// - Simple Analytics respeta Do Not Track por defecto: no se agrega data-collect-dnt.
// - En lugar del snippet en línea de la documentación (la CSP no permite JS en línea), la cola
//   window.sa_event.q se crea aquí, con el mismo formato, si el script aún no terminó de cargar.

type Meta = Record<string, string | number | boolean>;
type SaEvent = ((name: string, meta?: Meta) => void) & { q?: unknown[][] };
declare global {
  interface Window { sa_event?: SaEvent }
}

export type Lang = 'es' | 'en';
const env = import.meta.env ?? {}; // fuera de Vite (pruebas en Node) no existe
const ENABLED = env.PROD === true && env.PUBLIC_ANALYTICS === 'true';

/** Idioma de la página según <html lang>. */
export const pageLang = (): Lang => (document.documentElement.lang.startsWith('en') ? 'en' : 'es');

/** Envía un evento. Nombres: minúsculas, números y guion bajo. Metadatos: solo texto corto, número o sí/no. */
export function track(name: string, meta: Meta = {}): void {
  try {
    if (typeof window.sa_event !== 'function') {
      if (!ENABLED) return;
      // Cola equivalente al snippet oficial: el script la procesa al cargar.
      const queue: SaEvent = (...args: unknown[]) => { (queue.q ??= []).push(args); };
      window.sa_event = queue;
    }
    window.sa_event(name, meta);
  } catch {
    // La analítica nunca debe romper la página.
  }
}

/** Clic en un enlace de WhatsApp. origen: 'contacto' (portada) o 'calculadora'. */
export const trackWhatsApp = (origen: 'contacto' | 'calculadora', extra: Meta = {}) =>
  track('whatsapp_click', { idioma: pageLang(), origen, ...extra });

/** La persona eligió un paquete en la calculadora (identificador del paquete, p. ej. "a-dashboard"). */
export const trackQuotePackage = (paquete: string) => track('cotizar_paquete', { idioma: pageLang(), paquete });

/** Envío correcto del formulario de contacto (sin ningún dato del formulario). */
export const trackContactSent = () => track('contacto_enviado', { idioma: pageLang() });

/** Botón "Probar demo" de un proyecto (Prompt 4). proyecto = slug, p. ej. "bellas-boutique". */
export const trackDemo = (proyecto: string) => track('demo_click', { idioma: pageLang(), proyecto });
