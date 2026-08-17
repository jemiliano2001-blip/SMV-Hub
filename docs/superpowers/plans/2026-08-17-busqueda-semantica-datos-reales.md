# Plan — Búsqueda semántica sobre datos reales de SMV

Spec: [../specs/2026-08-17-busqueda-semantica-datos-reales.md](../specs/2026-08-17-busqueda-semantica-datos-reales.md)
Estado: **pendiente de aprobación** — no tocar código de producción hasta que Emiliano confirme
el alcance y responda las 3 preguntas abiertas del spec.

Regla para todas las tareas: `npx tsc --noEmit`, `npm run lint` y `npm test` en verde antes de
cerrar cada una. Nada se despliega hasta la Fase 4.

---

## Fase 0 — Medir antes de construir (sin código de producción)

Esta fase existe para no elegir arquitectura a ciegas. Si sale que hay poco dato, la Fase 2 se
simplifica muchísimo.

### T0.1 · Contar el universo a indexar
Script de lectura en `scripts/` (solo lectura, contra **`smv-brain-dev` primero**) que reporte:
- número de órdenes y **total de ítems** dentro de ellas (es lo que se indexa, no las órdenes);
- número de proveedores;
- longitud promedio del texto que se vectorizaría.

**Salida:** una tabla en el plan. **Criterio de decisión:** < ~1,500 entradas → Opción B (coseno en
servidor). Por arriba → Opción A (`findNearest` + índice KNN).

### T0.2 · Estimar el costo
Con el conteo de T0.1, calcular costo de la indexación inicial y de las consultas mensuales según
la tarifa vigente de embeddings de Gemini (consultar `ai.google.dev`, no de memoria).
**Salida:** cifra concreta para que Emiliano la apruebe. Bloquea la Fase 2.

### T0.3 · Prueba de fuego de calidad
Tomar las 10 búsquedas reales que defina Emiliano (pregunta 3 del spec), vectorizar a mano una
muestra de ~50 ítems reales de órdenes y medir cuántas veces el documento correcto sale en el top 3.
**Criterio:** ≥ 8/10. Si no llega, para y reevalúa — no seguir construyendo sobre algo que no
encuentra lo que se busca.

---

## Fase 1 — Cimientos (aplica aunque cambie la arquitectura)

### T1.1 · Cerrar C1: el modelo deja de ser código muerto
En `lib/embeddings-ia.ts`, hacer que `resolverModeloEmbedding()` use realmente
`MODELO_EMBEDDING_FALLBACK` cuando el preview falle, siguiendo el patrón que ya existe en
`lib/sat/gemini-sat.ts` (`resolverModeloLite` migra el modelo obsoleto y avisa por consola).
Tests: override por env, fallback al estable, aviso emitido.

### T1.2 · Cerrar C2: batch de verdad
Arreglar `generarEmbeddingsLote`: que el fallback a peticiones individuales ocurra **solo** cuando
tenga sentido (respuesta 4xx de "batch no soportado"), y **no** en 429 ni en timeout, donde hoy
amplifica el error y el costo. Agregar chunking por tamaño de lote y respeto de rate limit.
Tests: 429 no dispara N peticiones; timeout no dispara N peticiones; batch grande se parte bien.

### T1.3 · Cerrar B3: race condition del buscador
En `components/BuscadorGlobalCommand.tsx`, agregar `AbortController` por consulta, descartar
respuestas que no correspondan a la consulta vigente, y limpiar el timeout al desmontar.

### T1.4 · Schema del índice
Agregar a `lib/schemas.ts` el schema Zod de la entrada de índice descrita en el spec
(`fuente`, `refId`, `refPath`, `texto`, `textoHash`, `modelo`, `titulo`, `metadata`).
Validación en frontera, como todo lo que toca Firestore.

---

## Fase 2 — Indexación (arquitectura según Fase 0)

### T2.1 · Construcción del texto por fuente
Función pura por fuente (`orden-item`, `proveedor`) que arma el texto a vectorizar y su hash.
Es lógica pura → tests directos, sin Firebase. Aquí se decide qué tan buena es la búsqueda, así
que va con casos reales de facturas abreviadas en inglés.

### T2.2 · Escritura del índice
Módulo en `lib/` que escribe `busqueda_indice` respetando `textoHash` (no re-embebe lo que no
cambió) y registra `modelo`. Escribe con Admin SDK desde Functions.

### T2.3 · Job incremental en Functions
En `functions/src/`, job programado que recorre lo modificado desde la última corrida.
Guardar el cursor en un doc de estado, igual que hace `odooSync`.
**Ojo con el caveat del proyecto compartido:** desplegar solo con `codebase: "smv-hub"`, nunca
`firebase deploy --only functions --force`.

### T2.4 · Reglas de Firestore
`busqueda_indice`: lectura solo para usuarios autorizados, escritura **solo** desde Admin SDK
(ningún cliente escribe). Agregar test en `tests/firestore-security.test.ts`.

---

## Fase 3 — Consulta y UI

### T3.1 · Búsqueda del lado del servidor con filtro de permisos
Reescribir `buscarEnCatalogoSemantico` para consultar el índice real. **El filtro por módulos del
usuario ocurre en el servidor**, antes de devolver nada: quien no tiene `ordenes` no recibe ítems de
órdenes. Test explícito de esto (criterio de éxito #2 del spec).

### T3.2 · Cerrar B2: distinguir "sin resultados" de "falló"
La ruta `/api/busqueda-semantica` debe devolver un error real cuando el índice o Gemini fallen, y la
UI mostrar un mensaje claro con reintento — no una lista vacía. Test de ambos caminos.

### T3.3 · Resultados con datos reales en la UI
El bloque del buscador pasa a mostrar proveedor, precio con `formatPrecio` (respetando moneda: nunca
mezclar MXN y USD) y fecha, con enlace al documento real. Retirar `CATALOGO_BASE_SMV`.

### T3.4 · Límite de uso
Rate limit por usuario en `/api/busqueda-semantica`. El buscador vive en el NavBar de todas las
páginas y hoy no tiene tope.

---

## Fase 4 — Validación y despliegue

### T4.1 · Correr las 10 búsquedas de T0.3 contra el índice real en `smv-brain-dev`.
### T4.2 · Verificación end-to-end: lint, `tsc`, tests, `npm run build`, y pasada de navegador real con login.
### T4.3 · Indexación inicial en producción, con el costo ya aprobado en T0.2.
### T4.4 · Actualizar `CLAUDE.md` y `AGENTS.md` con el módulo nuevo y el caveat del modelo de embeddings.

---

## Orden sugerido

Fase 0 completa → **checkpoint con Emiliano** (costo + calidad) → Fase 1 (vale la pena aunque el
proyecto se pause: son bugs reales del código de hoy) → Fases 2-4.

La Fase 1 es la que yo haría primero incluso si decides no seguir con lo demás: arregla deuda que
ya está en producción.
