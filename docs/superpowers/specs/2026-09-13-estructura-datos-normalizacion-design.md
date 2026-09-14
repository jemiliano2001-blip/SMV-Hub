# Spec — Estructura y normalización de datos (frente B)

Fecha: 2026-09-13 · Estado: **propuesto** — pendiente de aprobación de Emiliano · Autor: Claude Opus 5

Antecede a la [memoria operativa](2026-09-13-memoria-operativa-design.md): es el suelo sobre el
que va. Todo lo que dice este documento sale del diagnóstico read-only del 2026-09-13
(`scripts/diagnostico-datos.ts` contra `smv-brain`) y de leer el código que produce cada dato.

## Principio

**Cada corrección humana se persiste en la fuente y sobrevive a los syncs. Cada campo que hoy se
calcula al leer, se persiste al escribir.** Sin IA en runtime: los cuatro bloques de abajo son
determinísticos; la IA aparece solo como asistente puntual y opcional (agrupar variantes de
nombres, segunda pasada sobre "otros").

## Problema — cuatro hallazgos con causa verificada

### 1. `proveedorId` casi no existe (93 % órdenes, 97 % cotizaciones sin FK)

No es un problema, son tres:

- **La captura empata por igualdad cruda.** `app/nueva-compra/NuevaCompraForm.tsx:258` y
  `app/cotizaciones/CotizacionFormModal.tsx:57` derivan `proveedorId` con
  `catalogo.find(p => p.nombre === nombre)`: sin normalizar, sin alias. El nombre que extrae la IA
  de la factura ("MSC Industrial Supply", "McMaster Carr") casi nunca es idéntico al del catálogo,
  así que el FK nace `null`.
- **El catálogo USA está incompleto.** De 104 proveedores, **91 vienen de Odoo** (México) y 13 son
  semillas USA. DigiKey, eBay, Amazon, PTSolutions y Home Depot — que suman la mayoría de las
  compras americanas — **no existen** en `proveedores`. eBay + Amazon solos son 29 % de las órdenes.
- **No hay alias.** MSC sí está ("MSC Industrial Direct"), las facturas dicen "MSC Industrial
  Supply", y ni el matcher de captura ni el de vinculación histórica lo reconocen. Igual "digikey"
  vs "digikey electronics" (dos fantasmas distintos para un proveedor).

Lo que ya existe y nadie usa: `app/api/proveedores/vinculacion/route.ts` (super-admin, auditado,
con tests) implementa **analizar → aplicar automáticas → vincular manual**, y
`lib/proveedores-vinculacion.ts` lo envuelve para el cliente. **Ninguna pantalla lo llama.** Su
auto-match es por nombre normalizado exacto (correcto para aplicar sin revisar) y su
`sugerenciaCatalogo` para fantasmas siempre es `null` (`vinculacion-core.ts:98`).

### 2. Las clasificaciones aprobadas no sobreviven al sync de Odoo

`clasificacion_ia_mapeos` tiene **338** mapeos aprobados por el equipo — es la memoria de
corrección más usada del Hub. Pero:

- `functions/src/odoo-compras-sync.ts` → `escribirLotes()` hace `batch.set(doc, {...})` **sin
  merge** cada 2 h, reconstruyendo cada ítem con `construirItemDesdeLinea()` → heurística.
- Ninguna Function lee `clasificacion_ia_mapeos`.
- `lib/compras-odoo-store.ts` y `useComprasOdoo` tampoco aplican los mapeos; solo
  `PanelClasificacionIA.tsx` los aplica, en su propia vista.

Resultado: el comparador de precios, `rangos.ts`, el índice semántico y el diagnóstico ven la
categoría heurística. **978 de 2,325 ítems (42 %) siguen en `otros`** aunque una parte ya fue
clasificada a mano. El equipo corrige y el sistema lo olvida a las dos horas.

### 3. `diasHabiles` es texto libre y el único parser está mal

68 % null. De las 268 no nulas: 45 % un número ("3 dias"), 38 % rango ("20-30 dias"), 10 % en
semanas/meses ("2 - 3 semanas"), 7 % sin número ("stock", "local stock"). Nadie lo persiste como
número. El único consumidor, `ofertasDesdeHistorico()` en `lib/proveedores-inteligencia-cruzada.ts:746`,
usa `parseLeadTimeTexto()` = **primer número que encuentre**: "2 - 3 semanas" → 2 días,
"20-30 dias" → 20, "stock" → null → **default 5**. El recomendador de proveedores pondera lead time
al 20–25 % sobre ese dato.

### 4. `mercado` se infiere al leer y no se persiste (97 % vacío)

`lib/proveedores.ts:76-81` lo deduce en el cliente: `odooPartnerId` numérico → `mexico`, si no →
`usa`. Por eso la UI de `/proveedores` funciona. Pero todo lo que lee el documento crudo no lo
sabe: el indexador semántico (`functions/src/busqueda-indice-escritura.ts:51`) → **101 de 104
proveedores en `busqueda_indice` sin `mercado` en metadata**; el sync Odoo, al actualizar un
proveedor existente (`odoo-compras-sync.ts:353`), no le pone `mercado` ni `origenProveedor`.
`AGENTS.md` pide "store `mercado` explicitly; do not infer from currency" y los datos hacen justo
lo contrario.

### Lo que no se arregla con estructura

`numeroParte` vacío en 69 % de cotizaciones. No se puede inventar; la memoria operativa lo
compensa con empate semántico. Aquí solo se pide en captura cuando el proveedor lo maneja.

## Qué queremos

Después de este frente, corriendo otra vez `scripts/diagnostico-datos.ts`:

- Una factura de "MSC Industrial Supply" queda vinculada sola a MSC. Una de "eBay" queda vinculada
  a eBay (proveedor tipo marketplace). Una de un proveedor nuevo ofrece darlo de alta en dos clics.
- Un ítem Odoo que el equipo clasificó como `tornilleria` sigue siendo `tornilleria` después del
  sync de las 2 h, y el comparador lo ve así.
- "2 - 3 semanas" se guarda como `leadTimeMinDias: 10, leadTimeMaxDias: 15` y el recomendador usa
  15, no 2.
- Todo proveedor tiene `mercado` persistido y Cmd+K puede decir "México" o "USA" al lado.

## Alcance propuesto (v1)

### B1 — Proveedores vinculados: alias, captura y catálogo

**Modelo** (`lib/schemas.ts`, `ProveedorSchema`):

```
aliases: z.array(z.string().trim().min(1).max(80)).max(20).default([])
esMarketplace: z.boolean().default(false)   // eBay, Amazon, AliExpress: canal, no vendedor
```

**Matcher** (`lib/pieza-matching.ts`, `matchProveedorPorNombre`): antes de "empieza-con" e
"incluye", buscar igualdad normalizada contra `nombre` **y** contra cada alias. Los niveles quedan:

| Nivel | Cómo | Se aplica solo | Se sugiere |
|---|---|---|---|
| exacto | nombre o alias normalizado igual | sí | — |
| empieza-con / incluye | como hoy | **no** | sí |

**Captura** (`/nueva-compra`, `/cotizaciones` manual y por IA): derivar `proveedorId` con el
matcher normalizado (no con `===`). Mostrar debajo del campo proveedor:

- match exacto → "Vinculado a **MSC Industrial Direct**" con acción *cambiar*.
- match por sugerencia → "¿Es **MSC Industrial Direct**?" con *sí* / *no, es otro*. Al decir sí,
  el nombre crudo se guarda como alias del proveedor (aprendizaje sin IA).
- sin match → "Proveedor nuevo" con *dar de alta*: modal mínimo (nombre, mercado prellenado por
  moneda, `esMarketplace`) que crea en catálogo y vincula. Quién puede: quien tenga módulo
  `proveedores` (`esProveedoresEditor()` en rules); si no lo tiene, el chip solo avisa.

**Vinculación histórica**: dar UI al backend existente en `/proveedores` (panel super-admin):
*Analizar* → tabla de fantasmas con conteo, sugerencia (`matchProveedorPorNombre`, que hoy va
`null`) y acciones *vincular a…* / *dar de alta como nuevo*. *Aplicar automáticas* aplica solo
exactos+alias. Cada vinculación manual guarda el nombre libre como alias, así la segunda vez es
automática. Todo ya queda auditado por la ruta.

**Alta de faltantes**: son 26 fantasmas en órdenes y 117 en cotizaciones (con muchas variantes
del mismo). Flujo: la tabla de fantasmas + un botón opcional *agrupar variantes con IA* que propone
clusters ("digikey" + "digikey electronics" → DigiKey) y el humano aprueba. Sin IA también se puede
hacer a mano: es una tarde de trabajo, no un proyecto.

### B2 — Clasificación que sobrevive al sync

- **El sync aplica los mapeos aprobados.** `functions/src/odoo-compras-sync.ts` lee
  `clasificacion_ia_mapeos` una vez por corrida (338 docs, cache en memoria de la corrida) y
  `construirItemDesdeLinea()` consulta primero el mapeo aprobado; solo si no hay, heurística.
  Portar `normalizarDescripcionMapeo` + `buscarMapeoAprobado` a `functions/src/compras-odoo/`
  (mismo criterio que la copia de `categorias-registro.ts`: se mantienen en sync, con test que
  compara ambas).
- **Empate conservador en el sync.** El cliente hoy acepta "incluye" con ≥ 6 caracteres; para
  aplicar automáticamente en cada sync eso es demasiado laxo ("tornillo" pisaría "tornillo de
  banco"). En el sync: igualdad normalizada, o "incluye" solo si el mapeo tiene ≥ 12 caracteres y
  cubre ≥ 60 % de la descripción. Umbral a calibrar con los 338 existentes contra los 2,325 ítems
  (script read-only, antes de deployar).
- **Persistir `clasificadoPorMapeo: true`** en el ítem para poder medir cobertura.
- **Segunda pasada sobre `otros`**: el panel ya existe; hoy manda 50 por clic. Agregar *clasificar
  todo lo pendiente* con progreso y rate limit, y meter al prompt 10–15 mapeos aprobados de la misma
  familia candidata como ejemplos (few-shot). Opcional en v1: el valor grande es que lo aprobado se
  quede, no clasificar más.

### B3 — Lead time numérico

**Modelo** (`CotizacionSchema`):

```
leadTimeMinDias: z.number().int().min(0).nullable().default(null)
leadTimeMaxDias: z.number().int().min(0).nullable().default(null)
```

`diasHabiles` se conserva como texto (el usuario lo escribe así; es lo que dice el proveedor).

**Parser** puro en `lib/lead-time.ts` → `parsearDiasHabiles(texto): { min, max } | null`:

| Entrada | Resultado |
|---|---|
| "3", "3 dias", "3 días hábiles" | 3–3 |
| "20-30 dias", "20 a 30", "20–30" | 20–30 |
| "2 semanas", "2 - 3 semanas" | ×5 (días hábiles): 10–10, 10–15 |
| "1 mes", "1-2 meses" | ×20: 20–20, 20–40 |
| "stock", "en stock", "local stock", "inmediato", "disponible" | 0–0 |
| "consultar", "", cualquier cosa sin número ni palabra clave | null |

Se calcula **al guardar** en los cuatro puntos de escritura: `CotizacionFormModal`,
`cotizaciones-importar.ts` (CSV), `cotizaciones-extraer-ia.ts` (IA) y
`cotizaciones-desde-ordenes.ts` (queda null: las facturas no traen lead time). Backfill sobre las
268 no nulas.

**UI**: el input sigue siendo texto libre; al lado, la interpretación en vivo ("→ 10–15 días
hábiles") o "no se entiende, escribe un número". No se bloquea el guardado.

**Consumidores**: `ofertasDesdeHistorico()` usa `leadTimeMaxDias` (conservador) con fallback a
`Proveedor.leadTimeDias` (13 lo tienen) y, si nada, **null** — el recomendador ya excluye ofertas
con `leadTimeDias <= 0`, y es mejor excluir que inventar 5. `parseLeadTimeTexto` se elimina.

### B4 — `mercado` persistido

- **Backfill** de los 101 sin campo con la misma regla que hoy aplica el cliente
  (`odooPartnerId` → `mexico`, si no `usa`), y `origenProveedor: "odoo"` a los 89 que vienen de
  Odoo sin origen. Es persistir lo que ya se muestra; no cambia ningún resultado visible en
  `/proveedores`.
- **Sync Odoo**: al actualizar un proveedor existente, setear `mercado` y `origenProveedor` si
  faltan.
- **Indexador**: `proveedorDesdeDoc()` aplica el mismo default como defensa; reindex después del
  backfill para que Cmd+K traiga `mercado` en el 100 %.
- **Captura** (B1, alta de proveedor nuevo): `mercado` prellenado por moneda de la compra, editable.

## Fuera de alcance

- Inventar `numeroParte` o `llavePieza` mejores: no hay de dónde.
- Unificar `cotizaciones` / `cotizaciones_requisicion` / `evaluaciones_proveedores`.
- Requisiciones (1 documento en producción).
- Migrar `sat_asignaciones` o `clasificacion_ia_mapeos` a otro formato.
- Cualquier cosa de la memoria operativa (índice, chip, RAG): va en su spec, después de esto.

## Decisiones técnicas clave

### 1. Backfills como acciones de super-admin en la app, no como scripts sueltos

La cuenta de servicio configurada es de **solo lectura** a propósito. Los tres backfills
(vinculación, lead time, mercado) se exponen como acciones en rutas super-admin con
*previsualizar* → *aplicar*, auditadas — exactamente el patrón que ya tiene
`/api/proveedores/vinculacion`. Ventajas: no hay que crear una llave con escritura, queda en
`auditoria`, y se puede repetir cuando lleguen datos nuevos. El script de diagnóstico se queda como
está: es la **prueba de aceptación** (antes/después).

### 2. Los alias se aprenden del uso, no se cargan a mano

Cada vez que alguien confirma "sí, es MSC" o vincula un fantasma, el nombre crudo se vuelve alias.
En dos semanas de captura normal el catálogo aprende las variantes reales sin que nadie mantenga
una lista.

### 3. El sync aplica correcciones; el cliente deja de compensar

Hoy el cliente aplica mapeos en una sola pantalla para tapar que el sync los ignora. Con B2, el
documento persistido ya trae la categoría correcta y `aplicarMapeosAprobados` en cliente queda
solo como "vista previa antes de aprobar". Una sola fuente de verdad.

### 4. Determinista antes que IA

El parser de lead time cubre el 93 % con regex y el 7 % restante es "stock". Los alias cubren los
fantasmas repetidos. La IA queda para agrupar variantes (opcional) y para la segunda pasada de
"otros" (opcional). Nada de este frente depende de Gemini para funcionar.

## Permisos y rules

| Qué | Quién | Rules |
|---|---|---|
| Editar `aliases` / `esMarketplace` | `esProveedoresEditor()` | `aliases` es lista ≤ 20 strings ≤ 80; `esMarketplace` bool |
| Alta de proveedor desde captura | `esProveedoresEditor()` | Mismo `create` de hoy (`creadoEn` timestamp) |
| Asignar `proveedorId` en captura (create) | usuario autorizado | Ya permitido en `create` |
| Cambiar `proveedorId` en histórico | super-admin / break-glass | Ya reservado; sin cambio |
| Backfills (vinculación, lead time, mercado) | super-admin | Rutas con `verificarSuperAdmin` |
| `leadTimeMinDias/MaxDias` | quien edita cotizaciones | enteros ≥ 0 o null; `min ≤ max` |
| Sync Odoo escribe mapeos aplicados | Admin SDK (Functions) | Ignora rules; sin cambio |

`npm run test:rules` cubre los campos nuevos.

## Costo y rendimiento

- Cero llamadas nuevas a Gemini en runtime. Las dos funciones IA (agrupar variantes, segunda pasada
  de `otros`) son manuales y opcionales.
- Sync Odoo: +1 lectura de 338 docs por corrida (12/día). Despreciable.
- Backfills: ~1,000 escrituras una vez. Despreciable.
- Reindex semántico tras B4: solo cambia metadata de proveedores → 104 entradas; el indexador
  re-embebe únicamente si cambia `textoHash`, y `mercado` no va en el texto, así que **no se
  re-embebe nada**. Costo cero.

## Riesgos

- **Colisión de alias** (dos proveedores con el mismo alias). El matcher exacto no aplica si hay
  más de un candidato — devuelve sugerencia, no vínculo. Igual que `proveedorExacto()` hoy.
- **"Incluye" demasiado laxo en el sync.** Mitigado con el umbral conservador y la calibración
  read-only antes de deployar. Si un mapeo pisa mal, se corrige el mapeo (no el ítem) y el
  siguiente sync lo arregla.
- **Semanas × 5 vs × 7.** Se llama `diasHabiles`, así que hábiles. Pregunta abierta #2.
- **Deploy de Functions en proyecto compartido.** Solo codebase `smv-hub`; nunca
  `--only functions --force` (`AGENTS.md`).
- **Backfill de mercado equivocado** para un proveedor USA que también tiene `odooPartnerId`
  (compra en USD desde Odoo). Odoo MX reporta 20 ítems en USD; la regla del cliente ya lo marca
  `mexico` hoy. Se revisa esa lista corta a mano en la previsualización.

## Criterios de éxito

Medidos con `npx tsx scripts/diagnostico-datos.ts smv-brain` antes y después, salvo donde se indica.

1. **Órdenes sin `proveedorId`: 93 % → ≤ 15 %.** Cotizaciones: 97 % → ≤ 40 % (117 fantasmas;
   muchos son variantes o proveedores de una sola vez que no vale la pena dar de alta).
2. **Captura**: los 10 nombres de proveedor más frecuentes en facturas reales (top fantasmas del
   diagnóstico) vinculan solos o con una sugerencia correcta en ≥ 9 de 10 — test unitario del
   matcher con esos nombres literales.
3. **Sync**: tras una corrida de `syncComprasOdoo`, cero ítems con mapeo aprobado en categoría
   distinta a la aprobada — test contra emulator con 5 mapeos y 20 líneas.
4. **`otros`: 42 % → ≤ 25 %** solo con aplicar los 338 mapeos en el sync (sin segunda pasada IA);
   ≤ 15 % si se corre la segunda pasada.
5. **Lead time**: 100 % de las 268 cotizaciones con `diasHabiles` tienen `leadTimeMin/Max` o quedan
   explícitamente null; ≥ 90 % parseadas. Ninguna en semanas queda en días (test con los formatos
   raros del diagnóstico).
6. **`mercado`**: 100 % persistido; `busqueda_indice` con `mercado` en 104/104 tras reindex.
7. Gates verdes: `npx tsc --noEmit` · `npm run lint` · `npm test` · `cd functions && npm run build`
   · `npm run build` · `npm run test:rules`.

## Fases (detalle en el plan)

- **B0 — Calibración read-only**: umbral de "incluye" de mapeos contra los 2,325 ítems; lista de
  fantasmas con sugerencia; lista de los 268 `diasHabiles` con su parseo propuesto; lista de
  proveedores con `odooPartnerId` + USD. Todo con la SA de lectura. **Checkpoint con Emiliano**:
  ver las listas antes de tocar nada.
- **B1 — Alias + captura + UI de vinculación** (schema, matcher, dos formularios, panel).
- **B2 — Sync aplica mapeos** (Functions + copia de helpers + test emulator + deploy `smv-hub`).
- **B3 — Lead time** (parser + 4 puntos de escritura + UI + backfill + consumidor).
- **B4 — Mercado** (backfill + sync + indexador + reindex).
- **B5 — Validación**: rerun diagnóstico, criterios 1–7, `AGENTS.md`/`CLAUDE.md`.

## Preguntas abiertas para Emiliano

1. **¿eBay, Amazon y AliExpress como proveedores del catálogo** (con `esMarketplace: true`)? Es lo
   más simple y honesto con cómo compras. La alternativa — guardar el vendedor real detrás del
   marketplace — no está en las facturas y no la recomiendo.
2. **Semanas → días hábiles (×5) o días corridos (×7)?** El campo se llama `diasHabiles`, propongo ×5.
3. **¿Quién puede dar de alta un proveedor desde `/nueva-compra`?** Propongo: quien tenga el módulo
   `proveedores` (hoy plantillas admin y compras lo incluyen). Los demás ven el aviso y siguen.
4. **Segunda pasada IA sobre `otros` en v1, o solo que lo aprobado se quede?** Recomiendo solo lo
   segundo en v1 y medir cuánto baja `otros`; la IA después si hace falta.

## Relación con otros documentos

- Antecede a [2026-09-13-memoria-operativa-design.md](2026-09-13-memoria-operativa-design.md) —
  sus "Resultados de Fase 0" son el diagnóstico que origina este spec.
- Completa [2026-08-14-proveedores-rango-odoo-design.md](2026-08-14-proveedores-rango-odoo-design.md)
  (de ahí vienen `mercado`, `origenProveedor` y el upsert desde Odoo) y la vinculación USA Tooling
  (`tests/usa-tooling-vinculacion.test.ts`, `tests/proveedores-vinculacion-route.test.ts`).
- Respeta [2026-07-24-lazo-retroalimentacion-produccion-design.md](2026-07-24-lazo-retroalimentacion-produccion-design.md):
  Odoo sigue mandando en compras MX; el Hub solo persiste encima lo que el equipo corrige.
