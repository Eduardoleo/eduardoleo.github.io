# Cómo agregar un proyecto nuevo

Todo el contenido de los proyectos vive en `src/data/projects.json`. No hace falta tocar componentes ni páginas.

1. **Copia** un objeto existente dentro de `"projects"` y cambia:
   - `slug`: identificador para la URL, en minúsculas y con guiones (`mi-proyecto` → `/proyectos/mi-proyecto/` y `/en/projects/mi-proyecto/`).
   - `order`: posición en la portada (1 = primero).
   - `featured`: `true` para destacar la tarjeta.
   - `case`: `true` genera la página del caso de estudio; `false` muestra solo la tarjeta.
   - `year`, `stack` (lista de tecnologías) y `repo` (URL pública o `null`).
2. **Textos en `es` y `en`.** Campos obligatorios si `case` es `true`:
   - `title`, `kind`, `summary`, `problem`, `role`, `solution`
   - `decisions` (lista de `{ "title", "body" }`), `results` y `limits` (listas de frases)

   Campos opcionales:
   - `architecture`: lista de pasos.
   - `finding`: hallazgo, con `{ "title", "items": [{ "label", "body" }] }`.
   - `security`: caso de seguridad, con la misma forma.
   Medios (opcionales; si faltan, la sección "Capturas" no aparece):
   - Archivos en `src/assets/proyectos/<slug>/` (PNG, JPG, WebP o AVIF; el build genera AVIF + WebP con `width`, `height` y `loading="lazy"`).
   - `screenshots`: 2 o 3 objetos `{ "file", "es": { "alt", "caption" }, "en": { "alt", "caption" } }`. El `alt` describe lo que se ve, no solo el título.
   - `video`: animación corta **en mp4 (y opcionalmente webm), sin audio**, en lugar de un GIF. Forma: `{ "mp4", "webm", "poster", "es": { "caption", "description" }, "en": { … } }`. `poster` es una imagen de la misma carpeta y define el ancho y alto. Se muestra silenciado, con controles y sin reproducción automática; `description` es el texto alternativo de lo que pasa en el video.
   - `media_note`: `{ "es", "en" }` opcional, p. ej. para aclarar que los datos son ficticios.
   - Solo datos ficticios en las capturas. Para comprimir, se puede pasar el video por `ffmpeg -i in.mov -an -vf scale=1280:-2 -c:v libx264 -crf 28 -movflags +faststart out.mp4`.
3. **Reglas de contenido** (ver `../CLAUDE.md`):
   - No inventes métricas ni clientes.
   - En trabajos grupales, no nombres a los compañeros.
   - Las limitaciones van al final, en `limits`.
   - Los write-ups de seguridad no deben incluir payloads, IPs ni credenciales.
4. **Verifica:**
   ```powershell
   npm.cmd run build
   npm.cmd test          # Playwright + axe: comprueba automáticamente cada caso nuevo
   ```
5. **Actualiza el CV público** si el proyecto debe aparecer en él (`npm.cmd run assets:cv`; los PDF se copian a `public/cv/` y la vista previa PNG queda en `.local/cv/`; revisa el PNG antes de hacer commit).
