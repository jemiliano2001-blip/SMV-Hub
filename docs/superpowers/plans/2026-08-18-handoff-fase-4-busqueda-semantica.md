# Handoff — Fase 4 de búsqueda semántica (queda por hacer)

Para quien retome esto (ChatGPT u otro agente). Fases 0-3 completas y ya en `main`:

- Spec: [../specs/2026-08-17-busqueda-semantica-datos-reales.md](../specs/2026-08-17-busqueda-semantica-datos-reales.md)
- Plan con checkpoints de cada fase: [2026-08-17-busqueda-semantica-datos-reales.md](2026-08-17-busqueda-semantica-datos-reales.md)
- Commits: `fca3b1e` (Fase 0+1), `ac46fdc` (Fase 2), `f49e2bf` (Fase 3) — todos en `origin/main`.

## Qué falta: Fase 4 (validación y despliegue)

Ver la sección "Fase 4" del plan de arriba para el detalle de T4.1-T4.4. Resumen:

1. **Crear el secreto `HUB_GEMINI_API_KEY`** en Secret Manager — todavía no existe, ni en
   `smv-brain-dev` ni en `smv-brain`. Sin esto el job de indexación truena de inmediato.
   `firebase functions:secrets:set HUB_GEMINI_API_KEY`.
2. **Correr `syncBusquedaIndiceManual`** (callable, gateado a super-admin) contra `smv-brain-dev`
   primero. `busqueda_indice` está vacío en ambos proyectos — nadie lo ha corrido nunca.
3. **Validar las 10 búsquedas de prueba** (tabla en el spec) contra el índice real ya poblado.
4. **Pase de navegador real** con login (no bypass) haciendo una búsqueda que sí devuelva
   resultados — no se pudo hacer en esta sesión (ver bloqueo abajo).
5. Indexación inicial en producción (`smv-brain`) — costo ya aprobado en Fase 0 (~$0.002 USD).
6. Actualizar `CLAUDE.md`/`AGENTS.md` con el módulo nuevo.

## Bloqueo activo

El usuario E2E local (`admin@smv-hub-e2e.local`, `smv-brain-dev`) no tiene un doc usable en
`usuarios/{uid}` — `obtenerUsuarioAdmin()` devuelve `null`, así que cualquier ruta API protegida le
da 403. Esto impidió terminar la verificación de navegador de Fase 3. Hay una tarea aparte corriendo
para arreglarlo (`task_58004f6e`, lanzada en otra sesión el 2026-08-18) — revisar si ya terminó
antes de repetir el diagnóstico.

## Gotchas ya descubiertos (no los redescubras)

- `functions/` usa `firebase-admin@12.7.0` fijo, sin `FieldValue.vector()` (llegó en v13) — por eso
  `embedding` se guarda como `number[]` plano, no vector nativo de Firestore.
- Sin import cruzado entre `functions/src/` y `lib/` (boundary de deploy), pero el Vitest de la
  raíz SÍ puede importar `functions/src/` directo para tests — no hace falta duplicar tests.
- `outputDimensionality: 768` (no el default 3072 de Gemini) verificado empíricamente en ambos
  shapes de la API (plano en `embedContent`, anidado en `batchEmbedContents`) — sigue funcionando,
  con guard de longitud en ambos lados por si algún día deja de serlo.
- Un `export` extra en un `route.ts` de Next.js revienta el build (`.next/types`) — cualquier
  helper que no sea un método HTTP va en `lib/`.
- Deploy de Functions: codebase `"smv-hub"` únicamente. Nunca `firebase deploy --only functions
  --force` — `smv-brain` es compartido con SMV-VISION y Visual Factory.

## Gates a correr antes de dar cualquier cosa por terminada

```bash
npx tsc --noEmit
npm run lint
npm test
cd functions && npm run build
npm run build   # raíz, verifica bundle SSR de Firebase Hosting
```
