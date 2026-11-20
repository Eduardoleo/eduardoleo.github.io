# Verificación local del portafolio

Contraste: cálculo de luminancia sRGB para pares de texto definidos en CSS. Umbral AA para texto normal: 4,5:1. Esto no certifica la accesibilidad completa ni sustituye revisión visual/teclado.

## claro

- ink/bg: 13.08:1
- ink/surface: 14.53:1
- ink/soft: 12.28:1
- muted/bg: 6.44:1
- muted/surface: 7.15:1
- muted/soft: 6.04:1
- accent/bg: 6.09:1
- accent/surface: 6.77:1
- accent/soft: 5.72:1
- on-cover/cover: 10.86:1
## oscuro

- ink/bg: 15.45:1
- ink/surface: 13.20:1
- ink/soft: 10.14:1
- muted/bg: 10.80:1
- muted/surface: 9.23:1
- muted/soft: 7.08:1
- accent/bg: 11.17:1
- accent/surface: 9.55:1
- accent/soft: 7.33:1
- on-cover/cover: 9.02:1

HTML semántico: header/nav/main/section/article/footer; enlace para saltar al contenido, focos visibles, índices y etiquetas de tema. CSS adaptable a móvil, sin fuentes externas ni librerías de UI. Solo JavaScript para tema.

Pendiente: navegación visual, captura real de Soporte, prueba de móvil en navegador y auditoría automática de accesibilidad. No hay navegador conectado. No se presentan capturas fabricadas ni valores de Lighthouse no medidos.

Soporte: main sincronizado después de los merges; arranque y readiness contra la base demo aprobados. Sin captura por ausencia de navegador conectado.
