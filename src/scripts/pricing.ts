// Precios de los servicios (src/data/services.json): formato, estimado de la calculadora y validación.
// Lo usan Home.astro y Quote.astro (en el build), el script de la calculadora (en el navegador) y las pruebas.
// Un precio es un entero en colones o el texto "POR_DEFINIR".

export const POR_DEFINIR = 'POR_DEFINIR';
export type Price = number | typeof POR_DEFINIR;
type Lang = 'es' | 'en';

/** Devuelve el entero (≥ 0) o null si el valor es POR_DEFINIR o no es un precio válido. */
export function priceValue(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return null;
}

/** ₡ + monto entero con el formato del idioma (es-CR agrupa con espacio de no separación). */
export function formatCRC(n: number, lang: Lang): string {
  return `₡${new Intl.NumberFormat(lang === 'es' ? 'es-CR' : 'en-US', { maximumFractionDigits: 0 }).format(n)}`;
}

export type Estimate =
  | { kind: 'range'; min: number; max: number; surchargePending: boolean }
  | { kind: 'custom' };

/**
 * Suma paquete + extras y aplica el recargo urgente.
 * - Paquete o algún extra POR_DEFINIR → cotización personalizada.
 * - Urgente con recargo POR_DEFINIR → rango sin recargo y surchargePending = true ("a convenir").
 */
export function estimate(input: { desde: unknown; hasta: unknown; extras: unknown[]; urgent: boolean; pct: unknown }): Estimate {
  const desde = priceValue(input.desde);
  const hasta = priceValue(input.hasta);
  const extras = input.extras.map(priceValue);
  if (desde === null || hasta === null || extras.some((e) => e === null)) return { kind: 'custom' };
  const sumExtras = (extras as number[]).reduce((a, b) => a + b, 0);
  let min = desde + sumExtras;
  let max = hasta + sumExtras;
  let surchargePending = false;
  if (input.urgent) {
    const pct = priceValue(input.pct);
    if (pct === null) surchargePending = true;
    else {
      min = Math.round((min * (100 + pct)) / 100);
      max = Math.round((max * (100 + pct)) / 100);
    }
  }
  return { kind: 'range', min, max, surchargePending };
}

// ---------------------------------------------------------------------------
// Validación de services.json (la usa la prueba de datos; falla en CI).
// ---------------------------------------------------------------------------

const isPrice = (v: unknown) => v === POR_DEFINIR || (typeof v === 'number' && Number.isInteger(v) && v >= 0);
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Devuelve la lista de errores encontrados (vacía si los datos son válidos). */
export function validateServices(data: any, projectSlugs: string[] = []): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const unique = (id: unknown, where: string) => {
    if (!text(id)) errors.push(`${where}: id vacío`);
    else if (ids.has(id as string)) errors.push(`${where}: id repetido "${id}"`);
    else ids.add(id as string);
  };
  const texts = (obj: any, keys: string[], where: string) => {
    for (const lang of ['es', 'en'])
      for (const k of keys) if (!text(obj?.[lang]?.[k])) errors.push(`${where}: falta ${lang}.${k}`);
  };

  const pct = data?.config?.recargo_urgente_pct;
  if (!(pct === POR_DEFINIR || (typeof pct === 'number' && Number.isInteger(pct) && pct >= 0 && pct <= 100)))
    errors.push(`config.recargo_urgente_pct: debe ser un entero de 0 a 100 o "${POR_DEFINIR}" (vale ${JSON.stringify(pct)})`);

  if (!Array.isArray(data?.lineas) || data.lineas.length === 0) errors.push('lineas: vacío');
  for (const [i, line] of (data?.lineas ?? []).entries()) {
    const w = `lineas[${i}] (${line?.id})`;
    unique(line?.id, w);
    texts(line, ['nombre', 'problema'], w);
    if (projectSlugs.length && !projectSlugs.includes(line?.proyecto)) errors.push(`${w}: proyecto "${line?.proyecto}" no existe o no tiene caso`);
    if (!Array.isArray(line?.paquetes) || line.paquetes.length === 0) errors.push(`${w}: sin paquetes`);
    for (const pkg of line?.paquetes ?? []) {
      const wp = `paquete ${pkg?.id}`;
      unique(pkg?.id, wp);
      texts(pkg, ['nombre', 'incluye', 'plazo'], wp);
      for (const k of ['precio_desde', 'precio_hasta'])
        if (!isPrice(pkg?.[k])) errors.push(`${wp}: ${k} debe ser un entero ≥ 0 o "${POR_DEFINIR}" (vale ${JSON.stringify(pkg?.[k])})`);
      const d = pkg?.precio_desde;
      const h = pkg?.precio_hasta;
      if (isPrice(d) && isPrice(h)) {
        if ((d === POR_DEFINIR) !== (h === POR_DEFINIR)) errors.push(`${wp}: precio_desde y precio_hasta deben estar definidos los dos o ninguno`);
        else if (typeof d === 'number' && typeof h === 'number' && d > h) errors.push(`${wp}: precio_desde (${d}) es mayor que precio_hasta (${h})`);
      }
      if (!Array.isArray(pkg?.extras)) errors.push(`${wp}: extras debe ser una lista`);
      for (const ex of pkg?.extras ?? []) {
        const we = `extra ${ex?.id}`;
        unique(ex?.id, we);
        texts(ex, ['nombre'], we);
        if (!isPrice(ex?.precio)) errors.push(`${we}: precio debe ser un entero ≥ 0 o "${POR_DEFINIR}" (vale ${JSON.stringify(ex?.precio)})`);
      }
    }
  }
  for (const [i, inc] of (data?.incluido ?? []).entries()) texts(inc, ['titulo', 'texto'], `incluido[${i}]`);
  return errors;
}
