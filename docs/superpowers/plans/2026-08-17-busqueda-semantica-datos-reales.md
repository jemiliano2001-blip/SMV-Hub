# Plan — Búsqueda semántica sobre datos reales de SMV

Spec: [../specs/2026-08-17-busqueda-semantica-datos-reales.md](../specs/2026-08-17-busqueda-semantica-datos-reales.md)
Estado: **Fase 2 completa (2026-08-18)** — índice implementado (texto+hash, cliente Gemini,
escritura/poda, job programado + callable manual, reglas). Ver checkpoint abajo. `busqueda_indice`
sigue vacío en ambos proyectos (nadie ha corrido el job todavía — HUB_GEMINI_API_KEY ni siquiera
existe en Secret Manager aún). Pendiente decisión de Emiliano para Fase 3 (query real + UI,
reemplaza `CATALOGO_BASE_SMV`) y Fase 4 (validación + deploy).

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

## Resultados de Fase 0 (2026-08-17) — checkpoint

Ejecutado contra producción (`smv-brain`), solo lectura salvo las llamadas a Gemini de T0.3. Los
scripts fueron desechables (vivieron en `scratch/`, gitignorado) y ya se borraron — los resultados
quedan aquí porque son lo único durable.

**T0.1 — universo exacto, no estimado.** La colección `ordenes` tiene 123 documentos en total, así
que la muestra (300 más recientes + 300 más antiguas) cubrió el 100% de la colección — no es una
proyección, es el conteo real:

| Fuente | Documentos | Vectores a indexar | Texto promedio |
|---|---|---|---|
| `ordenes` (items[]) | 123 órdenes | **341 ítems** (2.77/orden) | 95 caracteres/ítem |
| `proveedores` | — | **102 proveedores** | 42 caracteres/proveedor |
| **Total Fase 1 (órdenes + proveedores)** | | **443 vectores** | ~83 car. promedio ponderado |

**Decisión de arquitectura: Opción B (coseno en servidor) confirmada.** 443 está muy por debajo
del umbral de ~1,500 del spec — no hace falta índice vectorial `findNearest` de Firestore. Esto
simplifica bastante la Fase 2: sin índice compuesto que crear ni mantener.

**T0.2 — costo: ya gastado y medible, no solo proyectado.** T0.3 (abajo) ya generó 453 embeddings
reales (443 del corpus completo + 10 consultas) contra `gemini-embedding-2-preview`. Con el texto
promedio medido (~83 car. ≈ ~21 tokens/vector) el corpus completo son ~9,300 tokens ≈ 0.0093M
tokens. A $0.20/1M tokens (tarifa pagada; ambos modelos de embeddings de Gemini tienen tier
gratuito, cuyo límite exacto no verifiqué) la indexación **inicial completa cuesta ~$0.002 USD** —
un quinto de centavo. La reindexación incremental (solo lo que cambia, por `textoHash`) y las
consultas de usuarios corren en el mismo orden de magnitud por mes. **Conclusión: costo
irrelevante para la decisión**, casi seguro cubierto por el tier gratuito.

**T0.3 — calidad: 9/10 en el top 3, con hallazgos reales.** No usé una muestra de ~50: embebí el
corpus completo (443 vectores) contra las 10 búsquedas aprobadas, usando las funciones reales de
`lib/embeddings-ia.ts` (copiadas verbatim a un script suelto porque Node no resuelve imports `.ts`
sin extensión y no hay `tsx` instalado — **esto valida el algoritmo de retrieval, no el archivo
`lib/embeddings-ia.ts` importado tal cual**; en particular no ejercitó los caminos de error de
`generarEmbeddingsLote` que T1.2 va a corregir).

| # | Búsqueda | Resultado |
|---|---|---|
| 1 | fresa de carburo 4 filos para acero inoxidable | ✅ Acierto — el checador original exigía la palabra "flute" y el dato real dice "4FL"; con un criterio justo, sí trajo endmills de carburo 4 filos reales en el top 3 |
| 2 | quién me vende rodamientos | ✅ Acierto limpio (RYASA, BALEROS Y RET) |
| 3 | sensor de proximidad inductivo M12 | ❌ **Fallo real** — trajo ICs y LEDs de DigiKey; los sensores IFM Efector reales (PN4221, E18027) no entraron al top 3 |
| 4 | fuente de poder riel din 24V | ✅ Acierto limpio |
| 5 | quién vende acero inoxidable en Monterrey | ✅ Acierto limpio (ABINOX MONTERREY primero — el nombre no contiene "inoxidable", es sinónimo real) |
| 6 | pernos expulsores para moldes | ✅ Acierto limpio |
| 7 | resortes de compresión | ✅ Acierto limpio |
| 8 | insertos para torno | ✅ Acierto, pero mezclado — 2 de 3 resultados son filas de *proveedor* (etiquetadas con categoría "insertos"), no compras reales; la compra real de un inserto sí aparece en el puesto 3 |
| 9 | conectores circulares Mouser | ✅ Acierto limpio |
| 10 | cuándo compré un encoder Mitsubishi | ✅ Acierto limpio — y de hecho aparece 2 veces en el corpus, validando el caso de histórico |

**9/10 real** (por encima del umbral de 8/10). El único fallo genuino (#3) y el hallazgo de #8
(proveedores con categoría compitiendo con ítems reales en el ranking) son señal útil para el
diseño de Fase 2 — no bloquean, pero conviene tenerlos presentes al construir el índice real.

---

## Fase 1 — Cimientos (aplica aunque cambie la arquitectura)

### T1.1 · Cerrar C1: el modelo deja de ser código muerto — ✅ HECHO (2026-08-18)
El patrón literal de `gemini-sat.ts` (`resolverModeloLite`) corrige una *variable de entorno vieja*
apuntando a un modelo retirado — hoy no hay ningún modelo de embeddings retirado que migrar, así
que copiarlo tal cual habría sido código muerto sin blanco real. En su lugar: `generarEmbeddingTexto`
reintenta una vez contra `MODELO_EMBEDDING_FALLBACK` cuando el modelo por default (el preview) responde
404, con `console.warn`. No reintenta si el caller pidió un modelo explícito, ni si el que falló ya
era el propio fallback (evita loop). 4 tests nuevos en `tests/embeddings-ia.test.ts`.

### T1.2 · Cerrar C2: batch de verdad — ✅ HECHO (2026-08-18)
`generarEmbeddingsLote` ahora solo degrada a N peticiones individuales en 400 ("batch no
soportado"); 429 y timeout lanzan `ErrorIA` directo, sin cascada. Chunking fijo de 100 textos por
request (límite propio, Gemini no documenta uno) con pausa de 200ms entre chunks. Respuesta 200 con
cantidad de embeddings que no cuadra ahora lanza error en vez de degradar en silencio. 5 tests
nuevos, incluido uno que verifica que un lote de 250 se parte en 3 llamadas de ≤100.

### T1.3 · Cerrar B3: race condition del buscador — ✅ HECHO (2026-08-18)
En `components/BuscadorGlobalCommand.tsx`: `AbortController` por consulta (aborta la anterior antes
de lanzar la nueva), `AbortError` se ignora en el catch (no pisa el estado de una consulta más
nueva), `buscandoSemantico` solo se apaga si el controller que termina sigue siendo el vigente, y
limpieza de timeout + abort al desmontar. Sin test de componente (no hay infraestructura de testing
de componentes React en el repo); cubierto por lectura de código y el flujo de verificación manual
más abajo.

### T1.4 · Schema del índice — DIFERIDO
No se hizo en esta tanda: sería un schema Zod sin ningún consumidor (nadie lee ni escribe
`busqueda_indice` todavía), que es exactamente el "código a medio terminar" que `CLAUDE.md` pide
evitar. Se agrega al arrancar la Fase 2, junto con el primer código que sí lo use.

**Gates tras Fase 1:** `tsc` limpio · lint 0 errores (17 warnings preexistentes) · 922 tests
(911 previos + 2 de A1 + 9 nuevos) · `npm run build` ✅ bundle SSR compatible con Firebase Hosting.
T1.3 no tiene verificación de navegador — es una condición de carrera de red que necesita
respuestas fuera de orden para observarse, y el repo no tiene infraestructura de test de
componentes React; queda cubierto por lectura de código + los 3 gates automáticos, no por un
flujo E2E.

---

## Fase 2 — Indexación (arquitectura según Fase 0)

### T1.4 · Schema del índice — ✅ HECHO (2026-08-18)
`BusquedaIndiceSchema` en `lib/schemas.ts` (diferido desde Fase 1, ahora sí tiene consumidor).
Un cambio real sobre el modelo de datos del spec: `embedding` es `z.array(z.number())`, no
`FieldValue.vector()`. Razón — el único escritor es Functions, que tiene `firebase-admin@12.7.0`
fijado (`functions/package.json`), y `FieldValue.vector()` llegó hasta v13 (el `13.10.0` que el
spec verificó es el de la raíz del repo, no el de `functions/`). La arquitectura de Fase 0
(Opción B, coseno en servidor) tampoco lo necesita — solo `findNearest()` (Opción A) lo exigiría.
Migrar a Opción A después sigue sin requerir tocar el modelo de datos de negocio: solo el tipo del
campo `embedding` y cómo se consulta, tal como decía el spec. También se agregó `dimensiones`
(ver T2.2) al schema, que el spec original no tenía.

### T2.1 · Construcción del texto por fuente — ✅ HECHO (2026-08-18)
`functions/src/busqueda-indice-texto.ts`: `construirEntradasOrden()` y `construirEntradaProveedor()`,
lógica pura, con tipos locales (no importa `lib/schemas.ts` — ver nota de imports abajo). Ítems sin
descripción se omiten (mismo guard que A1 en `documentos-venta-lector-ia.ts`: `"".includes(x)` es
vacuamente cierto). Texto de proveedor deliberadamente compacto (nombre + categorías + marcas, sin
relleno): la búsqueda #8 de Fase 0 mostró filas de proveedor ganándole el ranking a compras reales
del mismo rubro por tener más texto. 11 tests en `tests/busqueda-indice-texto.test.ts`, con casos
de facturas abreviadas reales ("4FL", "IFM EFECTOR PN4221").

**Bug real atrapado durante la escritura (no por el usuario):** la primera versión de `metadata`
usaba `campo: valor || undefined` — deja la clave *presente con valor `undefined`*, no *ausente*.
El Admin SDK de Firestore truena al escribir un campo `undefined` (`getDb()` no activa
`ignoreUndefinedProperties`), así que cualquier ítem sin precio o cualquier orden sin proveedor
habría tronado el batch write completo en producción. Corregido a spread condicional (`...(x ? {
campo: x } : {})`, clave ausente de verdad) antes de que esto se probara contra Firestore real.
Los tests originales no lo habrían atrapado (`toEqual` no distingue "ausente" de
"presente-con-undefined"); se agregaron 2 tests que si revisan `Object.keys`/`Object.values`.

**Nota de imports:** el archivo vive en `functions/src/`, no en `lib/` como decía el plan original.
`functions/` se despliega como paquete aislado (`firebase deploy` empaqueta solo ese directorio) y
no hay ningún import cruzado a `lib/` en todo el repo — mismo patrón que `odoo-compras-mapeo.ts`,
que define sus propios tipos en vez de importar `CompraOdooItemSchema`. Pero el *test* sí importa
`functions/src/` por ruta relativa desde `tests/`, sin problema — ese es un boundary de deploy, no
de test-time (confirmado: `tests/odoo-ventas-mapeo.test.ts` y `tests/odoo-sync-mapeo.test.ts` ya
hacían exactamente esto; CLAUDE.md lo documenta para `/finanzas`: "pure mapping logic is
Vitest-testable from repo root").

### T2.2 · Cliente Gemini + escritura del índice — ✅ HECHO (2026-08-18)
`functions/src/busqueda-indice-gemini.ts`: cliente HTTP propio y mínimo (no
`lib/embeddings-ia.ts` — mismo boundary de deploy que arriba, y además tiene una semántica de
fallas distinta: un job programado puede tronar el run completo y reintentar en la siguiente
corrida, no necesita degradar con gracia como una búsqueda en vivo). Pide
`outputDimensionality: 768` en vez del default de la API (3072): el propio benchmark MTEB de
Gemini muestra calidad casi idéntica (67.99 vs 68.17) y el vector pesa ~4x menos — importa porque
Opción B lee el índice completo a memoria en cada consulta fría. Usa el shape moderno
`embedContentConfig` (los campos planos `taskType`/`outputDimensionality` que ya usa
`lib/embeddings-ia.ts` están marcados *deprecated* en `ai.google.dev/api/embeddings`, aunque
siguen funcionando — código nuevo usa el shape recomendado).

**Verificación empírica del shape `embedContentConfig`:** antes de confiar en la lectura de docs
sobre el shape "moderno", se hizo una llamada real a `batchEmbedContents` con
`embedContentConfig: { outputDimensionality: 768 }` contra `gemini-embedding-2-preview` — devolvió
un vector de exactamente 768 valores, no 3072. El wrapper sí se respeta, no se ignora en silencio.
Aun así se agregó un guard permanente en `embedContentsChunk()`: si algún vector devuelto no mide
`opciones.dimensiones`, truena ahí mismo con un mensaje explícito, en vez de dejar que la
inconsistencia se descubra hasta que `similitudCoseno()` reviente en Fase 3 contra un índice ya
escrito con la dimensión equivocada.

`firestore.indexes.json` ganó una entrada en `fieldOverrides` para `busqueda_indice.embedding`
(`"indexes": []`): sin ella, Firestore indexa cada uno de los 768 elementos del array por
default — puro desperdicio de storage y latencia de escritura en cada reindexación, sin que
ninguna query lo use (Opción B no consulta el índice compuesto de Firestore, calcula coseno en
memoria). Se agregó ahora, con la colección todavía vacía — hacerlo después de que haya datos
obliga a un rebuild de índice.

`functions/src/busqueda-indice-escritura.ts`: `sincronizarIndiceBusqueda()` — desviación real del
plan original, que pedía un cursor incremental (T2.3 abajo). En su lugar hace full-scan de
`ordenes` + `proveedores` en cada corrida y diffea por `textoHash`. Razón: al tamaño medido en
Fase 0 (123 + 102 documentos), leer todo es más barato que mantener un cursor, y **un cursor por
`actualizadoEn` no puede detectar borrados** — `/ordenes` tiene bulk delete, así que una orden
eliminada nunca aparecería en una query "modificado desde X" y su entrada en el índice quedaría
huérfana para siempre. El full-scan + diff sí lo detecta de forma natural: cualquier entrada
existente cuyo id ya no está en el set esperado se poda, con el mismo guard que
`podarHuerfanos()` en `odoo-compras-sync.ts` (nunca podar una fuente cuya lectura vino vacía). Si
el universo crece a miles de documentos, esto hay que revisarlo.

### T2.3 · Job programado + callable manual — ✅ HECHO (2026-08-18)
`functions/src/busqueda-indice-sync.ts`: `syncBusquedaIndiceScheduled` (cada 24h — no cada 2h como
los syncs de Odoo, porque el propio spec dice que esto no necesita frescura de minutos) y
`syncBusquedaIndiceManual` (callable, gateado a super-admin/break-glass; sin botón en la UI
todavía — se invoca a mano para validar Fase 4). Secreto **`HUB_GEMINI_API_KEY`**, prefijado a
propósito (no `GEMINI_API_KEY` a secas): `smv-brain` es compartido con SMV-VISION y Visual
Factory, mismo riesgo que ya documenta el comentario de `FINANZAS_ODOO_*` en `odooSync.ts`.
**Aún no se ha creado este secreto en Secret Manager** (ni en `smv-brain-dev` ni en `smv-brain`)
— hace falta `firebase functions:secrets:set HUB_GEMINI_API_KEY` antes de poder correr el job,
aunque sea manualmente. Doc de estado en `busqueda_indice_sync_state/estado`. Exportado desde
`functions/src/index.ts`; cae automáticamente bajo `codebase: "smv-hub"` (no hay un allowlist
separado que editar — los targets de deploy salen de `scripts/firebase-deploy-targets.mjs` según
qué archivos cambiaron, confirmado leyendo `.github/workflows/ci.yml`).

### T2.4 · Reglas de Firestore — ✅ HECHO (2026-08-18)
`busqueda_indice` y `busqueda_indice_sync_state`: **`allow read, write: if false`** — no "lectura
autorizada" como decía el plan original. Razón: T3.1 (Fase 3) ya decidió que el filtro de permisos
por módulo ocurre en el servidor, dentro de la ruta `/api/busqueda-semantica` vía Admin SDK, no en
una query directa del cliente — y no hay forma de expresar ese filtro por-`fuente` en una regla de
`list` sin que Firestore rechace la consulta completa si no está acotada por `where`. Mismo patrón
que `reportes_integridad_state`: el Admin SDK (tanto el job de Functions como el Route Handler)
ignora las reglas en ambos extremos, así que no hay ningún cliente que de verdad necesite leer esta
colección directo.

Dos tests, no uno:
- `tests/firestore-security.test.ts` (estático, regex sobre el texto de las reglas) — **corrido y
  en verde localmente**, no depende del emulator.
- `tests/firestore-rules-emulator.test.ts` (comportamiento real contra el emulator, extendiendo el
  `it.each` que ya existía para `reportes_integridad_*`) — escrito, pero **no se pudo correr en
  este entorno** (no hay Java instalado ni en bash ni en PowerShell locales). Confirmé que el
  archivo sigue skippeando limpio sin `FIRESTORE_EMULATOR_HOST` (21 tests skipped, antes 19 — los
  2 nuevos se registraron bien), pero la aserción real de `assertFails` en sí queda pendiente de
  CI (que sí tiene Java 21 vía `actions/setup-java`) o de correrla a mano con
  `npx firebase-tools@15.24.0 emulators:exec --only firestore "npm run test:emulator"` en una
  máquina con Java.

**Gates tras Fase 2:** `tsc` limpio (raíz y `functions/`) · lint 0 errores (17 warnings
preexistentes, sin cambio) · 935 tests (922 previos + 12 de `busqueda-indice-texto.test.ts` + 1 de
`firestore-security.test.ts`) + 27 skipped (25 previos + 2 del `it.each` del emulator) ·
`cd functions && npm run build` limpio. Sin verificación de navegador — Fase 2 no toca UI ni
Route Handlers (eso es Fase 3).

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
