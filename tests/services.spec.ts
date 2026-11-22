import { test, expect, type Page } from '@playwright/test';
import services from '../src/data/services.json' with { type: 'json' };
import projects from '../src/data/projects.json' with { type: 'json' };
import { SITE_URL } from '../site.config.mjs';
import { validateServices, formatCRC, estimate, POR_DEFINIR } from '../src/scripts/pricing';

type Lang = 'es' | 'en';
const home = { es: '/', en: '/en/' } as const;
const quote = { es: '/cotizar/', en: '/en/quote/' } as const;
const caseSlugs = projects.projects.filter((p) => p.case).map((p) => p.slug);
const packages = services.lineas.flatMap((l) => l.paquetes.map((p) => ({ line: l, pkg: p })));
// Intl usa espacios de no separación (U+00A0 / U+202F): se normalizan para comparar.
const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Datos (sin navegador; una sola vez, en el proyecto de escritorio)
// ---------------------------------------------------------------------------
test.describe('datos de services.json', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'prueba de datos: una sola vez'));

  test('son válidos: precios enteros ≥ 0 o POR_DEFINIR, desde ≤ hasta, textos ES/EN y proyectos con caso', () => {
    expect(validateServices(services, caseSlugs)).toEqual([]);
    expect(services.lineas.map((l) => l.id)).toEqual(['a', 'b']);
    expect(packages).toHaveLength(6);
    expect(services.incluido).toHaveLength(4);
  });

  test('el validador rechaza precios negativos, vacíos, no enteros y desde > hasta', () => {
    const base = structuredClone(services) as any;
    const bad = (mutate: (d: any) => void) => {
      const d = structuredClone(base);
      mutate(d);
      return validateServices(d, caseSlugs);
    };
    const pkg = (d: any) => d.lineas[0].paquetes[0];
    expect(bad((d) => { pkg(d).precio_desde = -1; pkg(d).precio_hasta = 10; })).not.toEqual([]);
    expect(bad((d) => { pkg(d).precio_desde = ''; })).not.toEqual([]);
    expect(bad((d) => { pkg(d).precio_desde = null; })).not.toEqual([]);
    expect(bad((d) => { pkg(d).precio_desde = 1000.5; pkg(d).precio_hasta = 2000; })).not.toEqual([]);
    expect(bad((d) => { pkg(d).precio_desde = '1000'; pkg(d).precio_hasta = 2000; })).not.toEqual([]);
    expect(bad((d) => { pkg(d).precio_desde = 5000; pkg(d).precio_hasta = 4000; })).not.toEqual([]);
    expect(bad((d) => { pkg(d).extras[0].precio = -5; })).not.toEqual([]);
    expect(bad((d) => { pkg(d).extras[0].precio = ''; })).not.toEqual([]);
    expect(bad((d) => { d.config.recargo_urgente_pct = 12.5; })).not.toEqual([]);
    expect(bad((d) => { d.lineas[1].proyecto = 'no-existe'; })).not.toEqual([]);
    // Válidos: enteros con desde ≤ hasta, o POR_DEFINIR.
    expect(bad((d) => { pkg(d).precio_desde = 100000; pkg(d).precio_hasta = 100000; pkg(d).extras[0].precio = 0; d.config.recargo_urgente_pct = 20; })).toEqual([]);
  });

  test('formato en colones y cálculo del estimado', () => {
    expect(norm(formatCRC(150000, 'es'))).toBe('₡150 000');
    expect(formatCRC(150000, 'en')).toBe('₡150,000');
    expect(estimate({ desde: 100, hasta: 200, extras: [10, 20], urgent: false, pct: 50 })).toEqual({ kind: 'range', min: 130, max: 230, surchargePending: false });
    expect(estimate({ desde: 100, hasta: 200, extras: [10, 20], urgent: true, pct: 50 })).toEqual({ kind: 'range', min: 195, max: 345, surchargePending: false });
    expect(estimate({ desde: 100, hasta: 200, extras: [], urgent: true, pct: POR_DEFINIR })).toEqual({ kind: 'range', min: 100, max: 200, surchargePending: true });
    expect(estimate({ desde: 100, hasta: 200, extras: [POR_DEFINIR], urgent: false, pct: 0 })).toEqual({ kind: 'custom' });
    expect(estimate({ desde: POR_DEFINIR, hasta: POR_DEFINIR, extras: [], urgent: false, pct: 0 })).toEqual({ kind: 'custom' });
  });
});

// ---------------------------------------------------------------------------
// Sección Servicios de la portada
// ---------------------------------------------------------------------------
for (const lang of ['es', 'en'] as const) {
  test(`portada (${lang}): 2 líneas, 6 paquetes, "Incluido" y enlaces a caso y calculadora`, async ({ page }) => {
    await page.goto(home[lang]);
    const section = page.locator('#servicios');
    await expect(section.locator('.line')).toHaveCount(2);
    await expect(section.locator('.package')).toHaveCount(6);
    for (const { line, pkg } of packages) {
      const card = section.locator(`.package[data-package="${pkg.id}"]`);
      await expect(card.locator('h4')).toHaveText(pkg[lang].nombre);
      await expect(card).toContainText(pkg[lang].incluye);
      await expect(card).toContainText(pkg[lang].plazo);
      const price = pkg.precio_desde === POR_DEFINIR
        ? (lang === 'es' ? 'Precio a consultar' : 'Price on request')
        : `${lang === 'es' ? 'Desde' : 'From'} ${formatCRC(pkg.precio_desde as number, lang)}`;
      expect(norm(await card.locator('.package-price').textContent())).toBe(norm(price));
      await expect(card.locator('a.package-cta')).toHaveAttribute('href', `${quote[lang]}?linea=${line.id}&paquete=${pkg.id}`);
    }
    for (const line of services.lineas) {
      const block = section.locator(`#linea-${line.id}`);
      await expect(block.locator('h3')).toHaveText(line[lang].nombre);
      await expect(block).toContainText(line[lang].problema);
      await expect(block.getByRole('link', { name: lang === 'es' ? /^Ver proyecto de ejemplo/ : /^See an example project/ }))
        .toHaveAttribute('href', lang === 'es' ? `/proyectos/${line.proyecto}/` : `/en/projects/${line.proyecto}/`);
    }
    const included = section.locator('.included li');
    await expect(included).toHaveCount(4);
    for (const [i, inc] of services.incluido.entries()) {
      await expect(included.nth(i).locator('h4')).toHaveText(inc[lang].titulo);
      await expect(included.nth(i).locator('p')).toHaveText(inc[lang].texto);
    }
    // Hero con las dos líneas y menú con la calculadora.
    await expect(page.locator('h1')).toContainText(lang === 'es' ? 'reportes' : 'reports');
    await expect(page.locator('h1')).toContainText(lang === 'es' ? 'tiendas en línea' : 'online stores');
    await expect(page.locator(`nav a[href="${quote[lang]}"]`)).toHaveCount(1);
  });
}

test('POR_DEFINIR se muestra como "Precio a consultar" / "Price on request"', async ({ page }) => {
  const pending = packages.filter(({ pkg }) => pkg.precio_desde === POR_DEFINIR).length;
  test.skip(pending === 0, 'todos los paquetes tienen precio');
  await page.goto('/');
  await expect(page.locator('#servicios .package-price', { hasText: 'Precio a consultar' })).toHaveCount(pending);
  await page.goto('/en/');
  await expect(page.locator('#servicios .package-price', { hasText: 'Price on request' })).toHaveCount(pending);
});

test('el botón "Cotizar" abre la calculadora con la línea y el paquete elegidos', async ({ page }) => {
  await page.goto('/');
  await page.locator('.package[data-package="b-catalogo"] a.package-cta').click();
  await expect(page).toHaveURL(/\/cotizar\/\?linea=b&paquete=b-catalogo$/);
  await expect(page.locator('input[name="linea"][value="b"]')).toBeChecked();
  await expect(page.locator('input[name="paquete"][value="b-catalogo"]')).toBeChecked();
  await expect(page.locator('[data-extras-for="b-catalogo"]')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Calculadora
// ---------------------------------------------------------------------------

/** Montos de prueba: se inyectan en el DOM de esta prueba; services.json no cambia. */
async function injectPrices(page: Page, pct: number | string) {
  await page.evaluate((pct) => {
    const form = document.querySelector<HTMLFormElement>('form.quote-calc')!;
    form.dataset.pct = String(pct);
    const pkg = form.querySelector<HTMLInputElement>('input[name="paquete"][value="a-dashboard"]')!;
    pkg.dataset.desde = '300000';
    pkg.dataset.hasta = '450000';
    form.querySelector<HTMLInputElement>('input[value="a-dashboard-fuente"]')!.dataset.precio = '50000';
    form.querySelector<HTMLInputElement>('input[value="a-dashboard-acceso"]')!.dataset.precio = '80000';
  }, pct);
}

const waText = async (page: Page) => {
  const href = await page.locator('a.quote-wa').getAttribute('href');
  const url = new URL(href!);
  expect(url.origin).toBe('https://wa.me');
  expect(url.pathname).toMatch(/^\/506\d{8}$/);
  return norm(url.searchParams.get('text'));
};

test('calcula el rango y el recargo con montos de prueba (ES)', async ({ page }) => {
  await page.goto('/cotizar/?linea=a&paquete=a-dashboard');
  await injectPrices(page, 25);
  const result = page.locator('.quote-result');
  await expect(result).toHaveAttribute('aria-live', 'polite');
  await page.getByLabel('Fuente de datos adicional').filter({ visible: true }).check();
  await page.getByLabel('Acceso con usuario y contraseña').filter({ visible: true }).check();
  // (300 000 + 130 000) y (450 000 + 130 000)
  await expect.poll(async () => norm(await result.locator('.quote-amount').textContent())).toBe('Estimado: entre ₡430 000 y ₡580 000');
  await expect(result.locator('.quote-note')).toHaveText('Es un estimado; el precio final se confirma después de una llamada sin costo.');
  await page.getByLabel(/^Urgente/).filter({ visible: true }).check();
  // × 1,25
  await expect.poll(async () => norm(await result.locator('.quote-amount').textContent())).toBe('Estimado: entre ₡537 500 y ₡725 000');
  expect(await waText(page)).toBe(norm(
    'Hola Eduardo, quiero cotizar: Automatización y reportes para pymes - Dashboard. Extras: Fuente de datos adicional, Acceso con usuario y contraseña. Plazo: urgente. Estimado de la calculadora: entre ₡537 500 y ₡725 000.',
  ));
});

test('recargo POR_DEFINIR: "recargo a convenir"; extra sin precio: cotización personalizada', async ({ page }) => {
  await page.goto('/cotizar/?linea=a&paquete=a-dashboard');
  await expect(page.locator('label', { has: page.locator('input[value="urgente"]') })).toContainText('recargo a convenir');
  await injectPrices(page, 'POR_DEFINIR');
  const amount = page.locator('.quote-amount');
  await page.getByLabel(/^Urgente/).filter({ visible: true }).check();
  await expect.poll(async () => norm(await amount.textContent())).toBe('Estimado: entre ₡300 000 y ₡450 000, más el recargo por urgencia a convenir');
  await page.evaluate(() => (document.querySelector<HTMLInputElement>('input[value="a-dashboard-acceso"]')!.dataset.precio = 'POR_DEFINIR'));
  await page.getByLabel('Acceso con usuario y contraseña').filter({ visible: true }).check();
  await expect(amount).toHaveText('Cotización personalizada');
  expect(await waText(page)).toBe('Hola Eduardo, quiero cotizar: Automatización y reportes para pymes - Dashboard. Extras: Acceso con usuario y contraseña. Plazo: urgente. Estimado de la calculadora: cotización personalizada.');
});

test('con los datos publicados (POR_DEFINIR) muestra "Cotización personalizada" sin montos', async ({ page }) => {
  await page.goto('/cotizar/?linea=b&paquete=b-sitio');
  await expect(page.locator('.quote-amount')).toHaveText('Cotización personalizada');
  await expect(page.locator('.quote-result')).not.toContainText('₡');
});

test.describe('WhatsApp desde la calculadora', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>wa</title>' }));
  });

  test('mensaje en inglés con montos de prueba y apertura en pestaña nueva', async ({ page }) => {
    await page.goto('/en/quote/?linea=a&paquete=a-dashboard');
    await injectPrices(page, 25);
    await page.getByLabel('Additional data source').filter({ visible: true }).check();
    await page.getByLabel(/^Standard/).filter({ visible: true }).check();
    expect(await waText(page)).toBe(norm(
      "Hi Eduardo, I'd like a quote for: Automation and reporting for small businesses - Dashboard. Extras: Additional data source. Timeline: standard. Calculator estimate: between ₡350,000 and ₡500,000.",
    ));
    const wa = page.locator('a.quote-wa');
    await expect(wa).toHaveAttribute('target', '_blank');
    await expect(wa).toHaveAttribute('rel', /\bnoopener\b/);
    const [popup] = await Promise.all([page.waitForEvent('popup'), wa.click()]);
    expect(new URL(popup.url()).origin).toBe('https://wa.me');
  });

  test('mensaje en inglés con los datos publicados y sin extras', async ({ page }) => {
    await page.goto('/en/quote/?linea=b&paquete=b-tienda');
    expect(await waText(page)).toBe("Hi Eduardo, I'd like a quote for: Websites and online stores for small businesses - Full online store. Extras: none. Timeline: standard. Calculator estimate: custom quote.");
  });

  test('mensaje en español sin extras', async ({ page }) => {
    await page.goto('/cotizar/?paquete=a-reporte');
    await expect(page.locator('input[name="linea"][value="a"]')).toBeChecked();
    expect(await waText(page)).toBe('Hola Eduardo, quiero cotizar: Automatización y reportes para pymes - Reporte automático. Extras: ninguno. Plazo: normal. Estimado de la calculadora: cotización personalizada.');
  });
});

test('sin selección: pide elegir y oculta WhatsApp; cambiar de línea limpia el paquete', async ({ page }) => {
  await page.goto('/cotizar/');
  await expect(page.locator('.quote-amount')).toHaveText('Elige una línea y un paquete para ver el estimado.');
  await expect(page.locator('a.quote-wa')).toBeHidden();
  await page.getByLabel(/^Automatización y reportes/).filter({ visible: true }).check();
  await page.getByLabel(/^Sistema interno/).filter({ visible: true }).check();
  await page.getByLabel('Módulo adicional').filter({ visible: true }).check();
  await expect(page.locator('a.quote-wa')).toBeVisible();
  await page.getByLabel(/^Sitios y tiendas/).filter({ visible: true }).check();
  await expect(page.locator('input[name="paquete"]:checked')).toHaveCount(0);
  await expect(page.locator('input[name="extra"]:checked')).toHaveCount(0);
  await expect(page.locator('a.quote-wa')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Prefiero escribir por el formulario' })).toHaveAttribute('href', '/#contacto');
});

test('teclado: se completa con Tab, Espacio y flechas', async ({ page, isMobile }) => {
  test.skip(isMobile, 'teclado solo en escritorio');
  await page.goto('/cotizar/');
  await page.locator('input[name="linea"][value="a"]').focus();
  await page.keyboard.press('ArrowDown'); // radio siguiente: línea B
  await expect(page.locator('input[name="linea"][value="b"]')).toBeChecked();
  await page.keyboard.press('Tab'); // primer paquete visible de la línea B
  await expect(page.locator('input[name="paquete"][value="b-sitio"]')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('input[name="paquete"][value="b-sitio"]')).toBeChecked();
  await page.keyboard.press('Tab'); // primer extra del paquete
  await expect(page.locator('input[value="b-sitio-seccion"]')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('input[value="b-sitio-seccion"]')).toBeChecked();
  await expect(page.locator('.quote-amount')).toHaveText('Cotización personalizada');
});

test('no guarda nada: sin cookies, localStorage ni sessionStorage', async ({ page, context }) => {
  await page.goto('/cotizar/?linea=a&paquete=a-sistema');
  await page.getByLabel('Módulo adicional').filter({ visible: true }).check();
  await page.getByLabel(/^Urgente/).filter({ visible: true }).check();
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('sin JavaScript: lista de paquetes y botón al formulario', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:4322' });
  const page = await context.newPage();
  for (const [lang, form] of [['es', '/#contacto'], ['en', '/en/#contacto']] as const) {
    await page.goto(quote[lang]);
    await expect(page.locator('form.quote-calc')).toBeHidden();
    const fallback = page.locator('.quote-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback.locator('.package')).toHaveCount(6);
    for (const { pkg } of packages) await expect(fallback).toContainText(pkg[lang].nombre);
    const link = fallback.getByRole('link', { name: lang === 'es' ? 'Prefiero escribir por el formulario' : "I'd rather use the contact form" });
    await expect(link).toHaveAttribute('href', form);
  }
  await context.close();
});

test('sin desbordes a 360 px', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, baseURL: 'http://127.0.0.1:4322' });
  const page = await context.newPage();
  for (const p of ['/', '/en/', '/cotizar/', '/en/quote/', '/cotizar/?linea=b&paquete=b-tienda', '/en/quote/?linea=a&paquete=a-sistema']) {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
  await context.close();
});

test('la calculadora está en el sitemap y enlazada entre idiomas', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain(`${SITE_URL}/cotizar/`);
  expect(sitemap).toContain(`${SITE_URL}/en/quote/`);
  await page.goto('/cotizar/');
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', `${SITE_URL}/en/quote/`);
});
