// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './site.config.mjs';

// Dominio propio (nov. 2026). El repo sigue siendo Eduardoleo/eduardoleo.github.io y se publica con
// GitHub Actions (deploy-pages): el dominio se configura en Settings > Pages y NO hace falta public/CNAME
// (con un workflow propio GitHub ignora ese archivo).
const site = SITE_URL;

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
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://api.web3forms.com",
        "form-action https://api.web3forms.com",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "manifest-src 'self'",
        'upgrade-insecure-requests',
      ],
    },
  },
});
