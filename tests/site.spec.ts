import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import projects from '../src/data/projects.json' with { type: 'json' };
import profile from '../src/data/profile.json' with { type: 'json' };

const cases = projects.projects.filter((p) => p.case).map((p) => p.slug);
const pages = [
  '/', '/en/', '/privacidad/', '/en/privacy/', '/404.html',
  ...cases.flatMap((s) => [`/proyectos/${s}/`, `/en/projects/${s}/`]),
];

async function visit(page: Page, path: string) {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4322') && !r.url().startsWith('data:')) foreign.push(r.url()); });
  const res = await page.goto(path, { waitUntil: 'networkidle' });
  return { res, errors, foreign };
}

for (const path of pages) {
  test.describe(path, () => {
    test('carga sin errores, sin cookies y sin peticiones a terceros', async ({ page, context }) => {
      const { res, errors, foreign } = await visit(page, path);
      expect(res?.status()).toBe(path === '/404.html' ? 200 : 200);
      expect(errors, 'errores de consola (incluye violaciones de CSP)').toEqual([]);
      expect(foreign, 'peticiones a otros dominios').toEqual([]);
      expect(await context.cookies()).toEqual([]);
      await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', /^(es-CR|en)$/);
      await expect(page.locator('h1')).toHaveCount(1);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`WCAG 2.2 AA con axe (${theme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await visit(page, path);
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} → ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(summary).toEqual([]);
      });
    }
  });
}

// El número se decodifica en tiempo de ejecución: no se escribe en claro en el código de las pruebas.
const waCode = profile.contact.whatsapp.code;
const waNumber = Buffer.from(waCode, 'base64').toString('utf8').split('').reverse().join('');
const waUrl = (lang: 'es' | 'en') => `https://wa.me/${waNumber}?text=${encodeURIComponent(profile.contact.whatsapp.message[lang])}`;
// Compara por partes: el navegador puede normalizar la codificación (p. ej. ' → %27).
const isWaUrl = (url: string, lang: 'es' | 'en') => {
  const u = new URL(url);
  return u.origin === 'https://wa.me' && u.pathname === `/${waNumber}` && u.searchParams.get('text') === profile.contact.whatsapp.message[lang];
};

test('el número de WhatsApp no aparece en el HTML', async ({ request }) => {
  expect(waNumber).toMatch(/^506\d{8}$/);
  const local = waNumber.slice(3);
  for (const p of ['/', '/en/']) {
    const html = await (await request.get(p)).text();
    expect(html.includes(waNumber), p).toBe(false);
    expect(html.includes(local), p).toBe(false);
    expect(html.includes(`${local.slice(0, 4)} ${local.slice(4)}`), p).toBe(false);
  }
});

test.describe('WhatsApp', () => {
  // wa.me no se visita de verdad: se responde con una página vacía.
  test.beforeEach(async ({ context }) => {
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>wa</title>' }));
  });

  for (const [path, lang] of [['/', 'es'], ['/en/', 'en']] as const) {
    test(`ratón: se arma al pasar el cursor y abre wa.me en pestaña nueva (${lang})`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'sin cursor en móvil');
      await page.goto(path);
      const wa = page.locator('.hero .wa-link');
      await expect(wa).toHaveAttribute('href', '#contacto');
      await wa.hover();
      const href = await wa.getAttribute('href');
      expect(href!.startsWith('https://wa.me/506')).toBe(true);
      expect(href).toBe(waUrl(lang));
      expect(new URL(href!).searchParams.get('text')).toBe(profile.contact.whatsapp.message[lang]);
      await expect(wa).toHaveAttribute('target', '_blank');
      await expect(wa).toHaveAttribute('rel', /\bnoopener\b/);
      const [popup] = await Promise.all([page.waitForEvent('popup'), wa.click()]);
      expect(isWaUrl(popup.url(), lang)).toBe(true);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });

    test(`teclado: foco y Enter abren wa.me (${lang})`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'teclado solo en escritorio');
      await page.goto(path);
      const wa = page.locator('.channels .wa-link');
      await wa.focus();
      await expect(wa).toBeFocused();
      await expect(wa).toHaveAttribute('href', waUrl(lang));
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')]);
      expect(isWaUrl(popup.url(), lang)).toBe(true);
    });
  }

  test('toque en móvil: abre wa.me con el mensaje en español', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil');
    await page.goto('/');
    const wa = page.locator('.hero .wa-link');
    const [popup] = await Promise.all([page.waitForEvent('popup'), wa.tap()]);
    expect(isWaUrl(popup.url(), 'es')).toBe(true);
    await expect(wa).toHaveAttribute('target', '_blank');
  });

  test('sin JavaScript lleva a #contacto en la misma pestaña', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4322' });
    const page = await context.newPage();
    await page.goto('/');
    const wa = page.locator('.hero .wa-link');
    await expect(wa).toHaveAttribute('href', '#contacto');
    await expect(wa).not.toHaveAttribute('target', /.+/);
    await expect(wa.locator('[data-wa-newtab]')).toBeHidden();
    await wa.click();
    await expect(page).toHaveURL(/\/#contacto$/);
    expect(context.pages()).toHaveLength(1);
    await context.close();
  });
});

test('URLs retiradas: redirigen sin JavaScript, noindex y fuera del sitemap', async ({ page, request }) => {
  const retired = [
    { path: '/proyectos/desercion-estudiantil/', to: '/#proyectos', canonical: 'https://eduardoleo.github.io/', lang: 'es-CR' },
    { path: '/en/projects/desercion-estudiantil/', to: '/en/#proyectos', canonical: 'https://eduardoleo.github.io/en/', lang: 'en' },
  ];
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  for (const r of retired) {
    const html = await (await request.get(r.path)).text();
    expect(html).toContain(`<meta http-equiv="refresh" content="0; url=${r.to}">`);
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain(`<link rel="canonical" href="${r.canonical}">`);
    expect(html).toContain(`<html lang="${r.lang}">`);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(sitemap).not.toContain(r.path);
    await page.goto(r.path);
    await expect.poll(() => page.url()).toBe(new URL(r.to, page.url()).href);
  }
});

test('SEO: canonical, hreflang, OG, sitemap, robots y security.txt', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://eduardoleo.github.io/');
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://eduardoleo.github.io/en/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-es\.png$/);
  for (const f of ['/sitemap-index.xml', '/robots.txt', '/.well-known/security.txt', '/og-es.png', '/og-en.png', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']) {
    expect((await request.get(f)).status(), f).toBe(200);
  }
  const sec = await (await request.get('/.well-known/security.txt')).text();
  expect(sec).toMatch(/^Contact: /m);
  const exp = new Date(sec.match(/^Expires: (.+)$/m)![1]);
  expect(exp.getTime()).toBeGreaterThan(Date.now());
});

test('selector de idioma lleva a la página equivalente', async ({ page, isMobile }) => {
  await page.goto('/proyectos/aves-costa-rica/');
  if (isMobile) await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Ver este sitio en inglés' }).click();
  await expect(page).toHaveURL(/\/en\/projects\/aves-costa-rica\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('tema claro/oscuro se recuerda', async ({ page, isMobile }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: 'Menú' }).click();
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('sin desbordamiento horizontal', async ({ page }) => {
  for (const p of pages) {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});

test('menú móvil accesible', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'solo móvil');
  await page.goto('/');
  const btn = page.getByRole('button', { name: 'Menú' });
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Contacto' }).click();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});

test.describe('formulario de contacto (envío simulado, sin red)', () => {
  test('valida, ignora el honeypot y muestra el resultado', async ({ page }) => {
    const sent: string[] = [];
    await page.route('https://api.web3forms.com/**', async (route) => {
      sent.push(route.request().postData() ?? '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.goto('/#contacto');
    const form = page.locator('form.form');
    await expect(form.locator('input[name="access_key"]')).toHaveValue(/^[0-9a-f-]{36}$/);
    await expect(form.locator('.hp')).toHaveAttribute('aria-hidden', 'true');
    await expect(form.locator('input[name="botcheck"]')).toHaveAttribute('tabindex', '-1');
    const box = await form.locator('.hp').boundingBox();
    expect(box!.x + box!.width).toBeLessThan(0);
    await expect(page.getByText('El formulario aún no está activo')).toHaveCount(0);

    await form.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(form.locator('.form-status')).toHaveText('Completa los campos marcados.');
    await expect(form.locator('#f-name')).toHaveAttribute('aria-invalid', 'true');
    expect(sent).toHaveLength(0);

    await form.getByLabel('Nombre').fill('Prueba automatizada');
    await form.getByLabel('Correo electrónico').fill('prueba@example.test');
    await form.getByLabel('¿Qué necesitas?').fill('Mensaje de prueba del formulario.');
    await form.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(form.locator('.form-status')).toHaveText(/Mensaje enviado/);
    expect(sent).toHaveLength(1);

    // Un bot que marca el honeypot no envía nada.
    await form.getByLabel('Nombre').fill('Bot');
    await form.getByLabel('Correo electrónico').fill('bot@example.test');
    await form.getByLabel('¿Qué necesitas?').fill('spam spam spam spam');
    await form.locator('input[name="botcheck"]').evaluate((el: HTMLInputElement) => (el.checked = true));
    await form.getByRole('button', { name: 'Enviar mensaje' }).click();
    expect(sent).toHaveLength(1);
  });

  test('muestra un error claro si el servicio falla', async ({ page }) => {
    await page.route('https://api.web3forms.com/**', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/en/#contacto');
    const form = page.locator('form.form');
    await form.getByLabel('Name').fill('Test');
    await form.getByLabel('Email').fill('test@example.test');
    await form.getByLabel('What do you need?').fill('Testing the error path.');
    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(form.locator('.form-status')).toHaveText(/couldn't be sent/);
  });
});

test('CV: el botón de cada idioma enlaza a su PDF y responde 200', async ({ page, request }) => {
  for (const [path, lang] of [['/', 'es'], ['/en/', 'en']] as const) {
    await page.goto(path);
    const cv = page.locator('.channels a[download]');
    await expect(cv).toHaveCount(1);
    const href = await cv.getAttribute('href');
    expect(href).toBe(`/cv/eduardo-leon-hernandez-cv-${lang}.pdf`);
    const res = await request.get(href!);
    expect(res.status(), href!).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
});

test('casos: enlace "Ver código en GitHub" al repo público de cada proyecto', async ({ page }) => {
  const repos = {
    'soporte-patitos': 'soporte-patitos-rrhh',
    'bellas-boutique': 'bellas-boutique-tienda',
    'aves-costa-rica': 'aves-costa-rica-prolog',
  };
  for (const [slug, repo] of Object.entries(repos)) {
    for (const [path, label] of [[`/proyectos/${slug}/`, 'Ver código en GitHub'], [`/en/projects/${slug}/`, 'View code on GitHub']]) {
      await page.goto(path);
      const links = page.getByRole('link', { name: label });
      await expect(links, path).toHaveCount(2);
      for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href'))))
        expect(href, path).toBe(`https://github.com/Eduardoleo/${repo}`);
    }
  }
});
