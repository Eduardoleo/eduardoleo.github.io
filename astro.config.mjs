// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './site.config.mjs';

// Dominio propio (nov. 2026). El repo sigue siendo Eduardoleo/eduardoleo.github.io y se publica con
// GitHub Actions (deploy-pages): el dominio se configura en Settings > Pages y NO hace falta public/CNAME
// (con un workflow propio GitHub ignora ese archivo).
const site = SITE_URL;

// Analítica sin cookies (Simple Analytics). Dominios según https://docs.simpleanalytics.com/csp
// El script solo se incluye si PUBLIC_ANALYTICS=true (lo define el paso de publicación del workflow);
// nunca en desarrollo ni en las pruebas. La CSP permite los dominios siempre, para que sea la misma en todos los builds.
const SA_SCRIPTS = 'https://scripts.simpleanalyticscdn.com';
const SA_QUEUE = 'https://queue.simpleanalyticscdn.com';

// URLs retiradas: páginas mínimas con meta refresh y noindex; no van al sitemap.
const retired = ['/proyectos/desercion-estudiantil/', '/en/projects/desercion-estudiantil/'];

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'es', locales: { es: 'es-CR', en: 'en' } },
      filter: (page) => !page.includes('/404') && !retired.some((r) => page.endsWith(r)),
    }),
  ],
  build: { inlineStylesheets: 'never' },
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        `img-src 'self' data: ${SA_QUEUE}`,
        "font-src 'self'",
        `connect-src 'self' https://api.web3forms.com ${SA_QUEUE}`,
        "form-action https://api.web3forms.com",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "manifest-src 'self'",
        'upgrade-insecure-requests',
      ],
      // Astro agrega a script-src los hashes de sus scripts; aquí solo se suma el CDN del script de analítica.
      scriptDirective: { resources: ["'self'", SA_SCRIPTS] },
    },
  },
});
