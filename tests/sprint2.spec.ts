// Sprint 2: dominio propio, analítica sin cookies (Simple Analytics) y medios de los casos.
import { test, expect, type Page } from '@playwright/test';
import projects from '../src/data/projects.json' with { type: 'json' };
import { SITE_URL } from '../site.config.mjs';

type Event = { name: string; meta: Record<string, unknown> };
const SA = { scripts: 'https://scripts.simpleanalyticscdn.com', queue: 'https://queue.simpleanalyticscdn.com' };
// Solo se permiten estas claves en los metadatos: nada que identifique a una persona.
const ALLOWED_META = new Set(['idioma', 'origen', 'paquete', 'urgente', 'proyecto']);

/** Espía window.sa_event antes de que cargue la página (el script real no se carga en las pruebas). */
async function spyEvents(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: unknown[]; sa_event: unknown };
    w.__events = [];
    w.sa_event = (name: string, meta: Record<string, unknown>) => w.__events.push({ name, meta });
  });
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: Event[] }).__events);
const expectClean = (list: Event[]) => {
  for (const e of list) {
    expect(e.name).toMatch(/^[a-z0-9_]+$/);
    for (const [k, v] of Object.entries(e.meta)) {
      expect(ALLOWED_META.has(k), `clave de metadatos no permitida: ${k}`).toBe(true);
      expect(['string', 'boolean', 'number']).toContain(typeof v);
      expect(String(v)).not.toMatch(/@|\d{8,}/); // ni correos ni números de teléfono
    }
  }
};

test.describe('dominio propio', () => {
  test('canonical, OG, JSON-LD, sitemap, robots y security.txt usan el dominio nuevo', async ({ page, request }) => {
    expect(SITE_URL).toBe('https://eduardoleon.dev');
    await page.goto('/en/quote/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/en/quote/`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE_URL}/en/quote/`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${SITE_URL}/og-en.png`);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld.url).toBe(`${SITE_URL}/en/`);
    expect(await page.content()).not.toContain('eduardoleo.github.io');

    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap-index.xml`);
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    expect(sitemap).not.toContain('eduardoleo.github.io');
    const sec = await (await request.get('/.well-known/security.txt')).text();
    expect(sec).toMatch(new RegExp(`^Canonical: ${SITE_URL}/\\.well-known/security\\.txt$`, 'm'));
    expect(sec).not.toContain('eduardoleo.github.io');
    // Expires: al menos 6 meses de vigencia.
    const exp = new Date(sec.match(/^Expires: (.+)$/m)![1]).getTime();
    expect(exp - Date.now()).toBeGreaterThan(182 * 24 * 3600 * 1000);
  });
});

test.describe('analítica sin cookies', () => {
  test('en pruebas no se carga el script; la CSP permite solo los dominios documentados', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(`script[src^="${SA.scripts}"]`)).toHaveCount(0);
    const csp = (await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content'))!;
    const dir = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';
    expect(dir('script-src')).toContain(SA.scripts);
    expect(dir('connect-src')).toContain(SA.queue);
    expect(dir('img-src')).toContain(SA.queue);
    expect(dir('media-src')).toBe("media-src 'self'");
    expect(dir('script-src')).not.toContain("'unsafe-inline'");
    expect(csp.match(/simpleanalytics/g)).toHaveLength(3);
    expect(await page.evaluate(() => typeof (window as unknown as { sa_event?: unknown }).sa_event)).toBe('undefined');
  });

  test('sin el script, los clics no crean ninguna cola ni global', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'una vez basta');
    await context.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>wa</title>' }));
    await page.goto('/cotizar/?paquete=a-dashboard');
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('a.quote-wa').click()]);
    await popup.close();
    expect(await page.evaluate(() => typeof (window as unknown as { sa_event?: unknown }).sa_event)).toBe('undefined');
  });

  for (const [path, lang] of [['/', 'es'], ['/en/', 'en']] as const) {
    test(`clic en WhatsApp registra el idioma (${lang})`, async ({ page, context, isMobile }) => {
      test.skip(isMobile, 'el clic se prueba en escritorio');
      await spyEvents(page);
      await context.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>wa</title>' }));
      await page.goto(path);
      const wa = page.locator('.hero .wa-link');
      await wa.hover();
      const [popup] = await Promise.all([page.waitForEvent('popup'), wa.click()]);
      await popup.close();
      const list = await events(page);
      expect(list).toEqual([{ name: 'whatsapp_click', meta: { idioma: lang, origen: 'contacto' } }]);
      expectClean(list);
    });
  }

  test('calculadora: paquete elegido y envío por WhatsApp', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'una vez basta');
    await spyEvents(page);
    await context.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>wa</title>' }));
    await page.goto('/en/quote/');
    await page.locator('input[name="linea"][value="b"]').check();
    await page.locator('input[name="paquete"][value="b-tienda"]').check();
    await page.locator('input[name="plazo"][value="urgente"]').check();
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('a.quote-wa').click()]);
    await popup.close();
    const list = await events(page);
    expect(list).toEqual([
      { name: 'cotizar_paquete', meta: { idioma: 'en', paquete: 'b-tienda' } },
      { name: 'whatsapp_click', meta: { idioma: 'en', origen: 'calculadora', paquete: 'b-tienda', urgente: true } },
    ]);
    expectClean(list);
  });

  test('el paquete que llega por la URL no cuenta como elección', async ({ page }) => {
    await spyEvents(page);
    await page.goto('/cotizar/?linea=a&paquete=a-dashboard');
    await expect(page.locator('a.quote-wa')).toBeVisible();
    expect(await events(page)).toEqual([]);
  });

  test('formulario: solo el envío correcto, sin datos del formulario', async ({ page, isMobile }) => {
    test.skip(isMobile, 'una vez basta');
    await spyEvents(page);
    let ok = false;
    await page.route('https://api.web3forms.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: ok }) }));
    await page.goto('/#contacto');
    const form = page.locator('form.form');
    const fill = async () => {
      await form.getByLabel('Nombre').fill('Persona de prueba');
      await form.getByLabel('Correo electrónico').fill('persona@example.test');
      await form.getByLabel('¿Qué necesitas?').fill('Mensaje de prueba de analítica.');
    };
    await fill();
    await form.getByRole('button', { name: 'Enviar mensaje' }).click(); // el servicio responde success: false
    await expect(form.locator('.form-status')).toHaveAttribute('data-state', 'error');
    expect(await events(page)).toEqual([]);
    ok = true;
    await form.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(form.locator('.form-status')).toHaveAttribute('data-state', 'ok');
    const list = await events(page);
    expect(list).toEqual([{ name: 'contacto_enviado', meta: { idioma: 'es' } }]);
    expectClean(list);
  });

  test('trackDemo(proyecto) queda lista para el Prompt 4', async () => {
    const calls: Event[] = [];
    const g = globalThis as unknown as { window: unknown; document: unknown };
    g.window = { sa_event: (name: string, meta: Record<string, unknown>) => calls.push({ name, meta }) };
    g.document = { documentElement: { lang: 'en' } };
    try {
      const { trackDemo } = await import('../src/scripts/analytics');
      trackDemo('bellas-boutique');
    } finally {
      delete g.window;
      delete g.document;
    }
    expect(calls).toEqual([{ name: 'demo_click', meta: { idioma: 'en', proyecto: 'bellas-boutique' } }]);
    expectClean(calls);
  });

  test('la política de privacidad explica la analítica (ES y EN)', async ({ page }) => {
    for (const path of ['/privacidad/', '/en/privacy/']) {
      await page.goto(path);
      const body = await page.locator('main').innerText();
      expect(body).toContain('Simple Analytics');
      expect(body).toMatch(/no usa cookies|uses no cookies/);
      expect(body).toMatch(/Do Not Track/);
      expect(body).not.toMatch(/no usa cookies, analítica|uses no cookies, analytics/);
      await expect(page.locator('a[href="https://simpleanalytics.com/privacy-policy"]')).toHaveCount(1);
    }
  });
});

test.describe('medios de los casos', () => {
  const cases = projects.projects.filter((p) => p.case);

  for (const p of cases) {
    const media = ((p as { screenshots?: unknown[] }).screenshots ?? []).length > 0 || !!(p as { video?: unknown }).video;
    for (const path of [`/proyectos/${p.slug}/`, `/en/projects/${p.slug}/`]) {
      test(`${path}: ${media ? 'capturas en formatos modernos' : 'sin medios, sin sección vacía'}`, async ({ page }) => {
        await page.goto(path);
        if (!media) {
          await expect(page.locator('#capturas')).toHaveCount(0);
          await expect(page.locator('a[href="#capturas"]')).toHaveCount(0);
          await expect(page.locator('figure.shot, video')).toHaveCount(0);
          return;
        }
        const imgs = page.locator('#capturas picture img');
        expect(await imgs.count()).toBeGreaterThan(0);
        for (const img of await imgs.all()) {
          await expect(img).toHaveAttribute('loading', 'lazy');
          await expect(img).toHaveAttribute('width', /^\d+$/);
          await expect(img).toHaveAttribute('height', /^\d+$/);
          expect((await img.getAttribute('alt'))!.length).toBeGreaterThan(15);
        }
        await expect(page.locator('#capturas picture source[type="image/avif"]')).toHaveCount(await imgs.count());
        for (const v of await page.locator('#capturas video').all()) {
          await expect(v).toHaveAttribute('controls', '');
          await expect(v).toHaveJSProperty('muted', true);
          await expect(v).toHaveAttribute('poster', /\.webp$/);
        }
      });
    }
  }
});
