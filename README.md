# Portafolio de Eduardo León Hernández

Sitio estático y bilingüe (español es-CR e inglés) hecho con Astro 7. Sin cookies, sin rastreadores y con fuentes autoalojadas.

## Requisitos y comandos

Node.js LTS. Desde esta carpeta, en PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev          # http://127.0.0.1:4321 (la CSP no se aplica en dev)
npm.cmd run build        # genera dist/ con la CSP en <meta>
npm.cmd run preview      # sirve dist/ en local
npx.cmd playwright install chromium   # solo la primera vez
npm.cmd test             # Playwright + axe (WCAG 2.2 AA) en escritorio y móvil
npm.cmd run assets       # regenera las imágenes OG, favicon.ico y apple-touch-icon
npm.cmd run assets:cv    # además genera el CV público: PDF en public/cv/ y vista previa en .local/cv/
```

## Estructura

| Ruta | Contenido |
|---|---|
| `src/data/profile.json` | Perfil, servicios, experiencia, formación, cursos, certificaciones (vacía) y contacto |
| `src/data/projects.json` | Proyectos y casos de estudio. Ver [docs/AGREGAR_PROYECTO.md](docs/AGREGAR_PROYECTO.md) |
| `src/i18n/ui.ts` | Textos de la interfaz en ES y EN, y rutas |
| `src/components/` | Portada, diagrama del hero y plantilla de caso de estudio |
| `src/pages/` | `/`, `/en/`, `/proyectos/<slug>/`, `/en/projects/<slug>/`, privacidad y 404 |
| `public/` | `security.txt`, `robots.txt`, iconos, imágenes OG y `theme-init.js` |
| `tests/` | Pruebas de extremo a extremo y de accesibilidad |

## Seguridad y privacidad

- **CSP en `<meta>`:** la genera Astro (`security.csp`) con hashes SHA-256 de los scripts. No se permite `unsafe-inline`. `connect-src` y `form-action` solo permiten Web3Forms.
- **Límite de GitHub Pages:** no admite cabeceras HTTP propias, así que `frame-ancestors`, HSTS, `X-Content-Type-Options` y `Permissions-Policy` no se pueden aplicar desde el sitio. La alternativa es un proxy como Cloudflare.
- **Sin estilos ni scripts inline:** los scripts `is:inline` no se hashean; por eso el tema se inicializa desde `public/theme-init.js`.
- **Formulario:** Web3Forms con honeypot (`botcheck`). La clave de acceso es pública por diseño y no expone el correo.
- **WhatsApp:** el número no aparece en el HTML; se arma al interactuar.
- **Privacidad:** no hay cookies. `localStorage` solo guarda la preferencia de tema.

## Publicación

GitHub Pages como sitio de usuario (`https://eduardoleo.github.io`, `site` en `astro.config.mjs`). No se publica sin aprobación del propietario.

Todos los derechos reservados.
