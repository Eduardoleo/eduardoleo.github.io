// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Primera publicación: sitio de usuario de GitHub Pages (repo Eduardoleo.github.io → base '/').
// Al conectar un dominio propio, cambiar `site` y el archivo public/CNAME.
const site = 'https://eduardoleo.github.io';

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
      filter: (page) => !page.includes('/404'),
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
