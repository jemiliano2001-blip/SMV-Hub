# Handoff — Fase 4 de búsqueda semántica (queda por hacer)

Para quien retome esto (ChatGPT u otro agente). Fases 0-3 completas y ya en `main`:

- Spec: [../specs/2026-08-17-busqueda-semantica-datos-reales.md](../specs/2026-08-17-busqueda-semantica-datos-reales.md)
- Plan con checkpoints de cada fase: [2026-08-17-busqueda-semantica-datos-reales.md](2026-08-17-busqueda-semantica-datos-reales.md)
- Alineación modelos Gemini (2026-08-18): [../specs/2026-08-18-modelos-gemini-alineacion.md](../specs/2026-08-18-modelos-gemini-alineacion.md)
- Commits: `fca3b1e` (Fase 0+1), `ac46fdc` (Fase 2), `f49e2bf` (Fase 3) — todos en `origin/main`.

## Cambio de modelo (2026-08-18) — reindexar obligatorio

El indexador y la búsqueda en vivo usan **`gemini-embedding-2`** (GA) con prefijos query/documento
(no `task_type`). Código en `lib/embeddings-ia.ts`, `lib/embeddings-prefijos.ts` y
`functions/src/busqueda-indice-gemini.ts`. Si `busqueda_indice` se pobló con
`gemini-embedding-2-preview`, hay que **volver a correr** `syncBusquedaIndiceManual` tras deploy
de Functions — mezclar vectores preview + GA rompe el ranking.

## Qué falta: Fase 4 (validación y despliegue)

Ver la sección "Fase 4" del plan de arriba para el detalle de T4.1-T4.4. Resumen:

1. ~~**Crear el secreto `HUB_GEMINI_API_KEY`**~~ Hecho en `smv-brain-dev` y `smv-brain`.
2. ~~**Correr sync del índice**~~ Hecho 2026-08-18: prod 447 entradas (125 órdenes + 102 proveedores), dev 13 proveedores.
3. ~~**Validar las 10 búsquedas de prueba**~~ **10/10** en top 3 contra `smv-brain` tras reindex completo con `gemini-embedding-2`.
4. **Pase de navegador real** con login (Cmd+K) — pendiente manual; la validación CLI ya pasó.
5. ~~Indexación inicial en producción~~ Hecho.
6. ~~Actualizar `CLAUDE.md`/`AGENTS.md`~~ Hecho 2026-08-18.

### Scripts operativos (2026-08-18)

```bash
cd functions && npm run build && cd ..
node scripts/ejecutar-sync-busqueda-indice.mjs smv-brain      # reindex manual (requiere GOOGLE_APPLICATION_CREDENTIALS en .env.local)
npx tsx scripts/validar-busquedas-prueba.ts smv-brain         # 10 búsquedas de prueba
firebase deploy --only "functions:smv-hub:syncBusquedaIndiceScheduled,functions:smv-hub:syncBusquedaIndiceManual" --project smv-brain
```

**Nota:** el indexador ahora re-embebe también cuando cambia `modelo` o `dimensiones` en el doc del índice (no solo `textoHash`).

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
