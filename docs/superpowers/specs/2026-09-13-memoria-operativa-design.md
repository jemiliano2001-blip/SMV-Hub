# Spec — Memoria operativa de SMV Hub

Fecha: 2026-09-13 · Estado: **propuesto, con Fase 0 (diagnóstico de datos) ejecutada** — pendiente
de aprobación de Emiliano · Autor: Claude Opus 5

> Alcance v1 ajustado por los datos (ver "Resultados de Fase 0"): **órdenes + cotizaciones**.
> Requisiciones y `compras_odoo_items` salen de v1. Las secciones de arriba conservan la propuesta
> original para dejar rastro de por qué se recortó.

## De dónde viene esto

El 2026-09-13 llegó un documento externo ("roadmap de memoria operativa") que proponía Vector
Store en Pinecone/Milvus, pipeline RAG, data lake S3+Athena, caché Redis y modelos entrenados de
recomendación y detección de anomalías. Ese documento describe un sistema que **no es SMV Hub**:
asume PostgreSQL, GraphQL y AWS, y da por no construido lo que ya está en producción.

Este spec rescata la **idea** — que el Hub use su propio historial y las correcciones del equipo
para ayudar en el momento de decidir — y la aterriza al stack real: Firestore (`compras-americanas`
en `smv-brain`), Cloud Functions y Gemini por REST.

## Problema

El Hub ya acumula historial operativo real (al 2026-08-18: 125 órdenes americanas y 102
proveedores indexados; además cotizaciones, requisiciones y el espejo de compras Odoo MX) y tres
colecciones donde el equipo corrige a la máquina. Y ya tiene bastante inteligencia construida
encima. El problema no es falta de datos ni de motores: **es que la inteligencia no aparece donde
se toman las decisiones, y no se entera cuando el equipo la corrige.**

Cinco síntomas verificados en el código al 2026-09-13:

1. **La inteligencia vive en un solo módulo.** `evaluarAlertaPrecio`, `fusionarPuntosPrecio`,
   `resumirPreciosPorPiezaProveedor`, `aprenderProveedorPreferidoPorPieza` y
   `sugerirPrecioYProveedor` (`lib/proveedores-inteligencia-cruzada.ts`) solo se usan en
   `app/requisiciones/NuevaRequisicionModal.tsx` y `DetalleRequisicionModal.tsx`. En
   `/nueva-compra` — donde se captura la factura y se ve el precio real pagado — no hay ningún
   "esto ya lo compraste a $X" ni alerta de precio. En `/cotizaciones` tampoco.

2. **El empate de piezas es léxico.** `lib/pieza-matching.ts` (`generarLlavePieza`,
   `llavesCoinciden`) normaliza texto y número de parte. Funciona cuando se repite el mismo SKU;
   falla cuando la factura dice "CARB EM 1/4 4FL" y la cotización dice "fresa carburo 1/4 4 filos".
   El índice semántico (`busqueda_indice`) resuelve exactamente ese problema — 10/10 en las
   búsquedas de prueba del 2026-08-18 — pero solo lo consume Cmd+K; ningún flujo de captura lo usa
   como matcher.

3. **El índice semántico cubre la mitad del historial.** `FuenteBusquedaIndice = "orden-item" |
   "proveedor"` (`lib/schemas.ts`). Cotizaciones y requisiciones quedaron "para después" en el spec
   del 2026-08-17. Hoy "¿ya cotizamos esto?" no se puede preguntar.

4. **Nadie registra cuando el equipo corrige a la máquina.** Hay tres memorias de corrección que sí
   funcionan — `sat_asignaciones` (clave SAT), `clasificacion_ia_mapeos` (familia de producto),
   `evaluaciones_proveedores` (scorecards manuales) — pero el recomendador de proveedores no tiene
   ninguna: la requisición guarda `proveedorGanadorId` + `motivoSeleccion` y **no** guarda qué había
   recomendado el motor. Sin el par (recomendado, elegido) no se puede medir si el recomendador
   acierta ni ajustar sus pesos con evidencia. Lo mismo con `lib/sugerencias-compra.ts`: rellena
   empresa / cuentaCargo / requisitor y nunca sabe si el usuario los cambió.

5. **Full scans en captura.** `NuevaRequisicionModal.tsx:42-43` hace `listarCotizaciones()` +
   `listarTodasCotizacionesRequisicion()` — dos colecciones completas — **cada vez que se abre el
   modal**, para calcular preferencias en el cliente. Es justo el patrón que `AGENTS.md` pide evitar.

## Qué queremos

Que al capturar una compra, una cotización o una requisición, el Hub conteste solo, sin que nadie
lo busque:

- "**Ya compraste esto** 3 veces; la última a $12.40 USD en McMaster el 2026-07-02."
  (`/nueva-compra`, por ítem, después de la extracción IA)
- "**Ojo:** este precio está 42 % arriba del mínimo histórico." (misma superficie, reusando
  `evaluarAlertaPrecio`)
- "**Ya lo cotizaste** con Shars en junio a $9.80." (`/cotizaciones`, captura manual)
- "Para esta pieza el equipo ha elegido **RYASA** 4 de 5 veces." (`/requisiciones`, como hoy,
  pero sin full scan y dejando registro de lo que se eligió)

Y que Cmd+K también encuentre cotizaciones y requisiciones, no solo órdenes y proveedores.

**Definición operativa.** La memoria operativa es:

- (a) **una sola función de consulta** — "¿qué sé ya de esta pieza?" — que cruza empate exacto y
  semántico sobre todo el historial, respetando permisos;
- (b) **el índice semántico ampliado** a todo el historial operativo;
- (c) **un registro uniforme** de lo que el equipo acepta o corrige de cada sugerencia.

No es un chat, no es un modelo entrenado, no es una base de datos nueva.

## Inventario: lo que ya existe y se reusa tal cual

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Índice semántico | `busqueda_indice` · `functions/src/busqueda-indice-*.ts` · `lib/busqueda-semantica-catalogo.ts` | Recuperación por significado (inglés↔español). 447 entradas en prod. Sync cada 24 h. |
| Embeddings | `lib/embeddings-ia.ts` — `generarEmbeddingTexto`, `generarEmbeddingsLote`, `similitudCoseno`, `buscarPorSimilitudSemantica` | `gemini-embedding-2`, 768 dims, prefijos query/documento. |
| Llave de pieza | `lib/pieza-matching.ts` | Empate exacto por número de parte / descripción simplificada. `CotizacionSchema` ya tiene `llavePieza` opcional. |
| Precio histórico multi-fuente | `fusionarPuntosPrecio`, `resumirPreciosPorPiezaProveedor`, `evaluarAlertaPrecio` (`UMBRAL_CARO = 0.35`) | Cruza cotizaciones, compras, cotizaciones de requisición y facturas Odoo, normalizado a USD. |
| Proveedor preferido | `aprenderProveedorPreferidoPorPieza`, `sugerirPrecioYProveedor` | Conteo de "veces ganador" por llave. |
| Recomendador | `lib/motor-recomendador-proveedores.ts` | Scoring por pesos, alimentado por `evaluaciones_proveedores`. |
| Rangos por familia (MX) | `lib/compras-odoo/rangos.ts` | Min / max / promedio por categoría + tipo + medida sobre ítems Odoo. |
| Memorias de corrección | `sat_asignaciones`, `clasificacion_ia_mapeos`, `evaluaciones_proveedores` | Ya persisten lo validado, con rules y tests. **No se migran.** |
| Sugerencias de campos | `lib/sugerencias-compra.ts` | Rellena empresa / cuentaCargo / requisitor desde 200 órdenes recientes. |
| Permisos en servidor | `app/api/busqueda-semantica/route.ts` | Filtra fuentes por `modulos[]` antes de leer Firestore. |
| Rate limit | `lib/rate-limit-memoria.ts` (`excedeLimite`) | Por uid, en memoria. |

Para ponerlo en perspectiva: de las cinco "iniciativas" del documento externo, tres ya están
construidas en alguna forma. El trabajo es **conectar y completar**, no construir desde cero.

## Alcance propuesto (v1)

### Componente A — Consulta unificada: `consultarMemoriaOperativa()`

Una función servidor, expuesta en `POST /api/memoria-operativa/consultar`, que recibe una o
varias piezas (`descripcion`, `numeroParte?`, `proveedor?`, `precioUnitario?`, `moneda?`) y
devuelve por cada una un `ContextoOperativo`:

```
ContextoOperativo
  llavePieza: string
  comprasPrevias:        { fecha, proveedor, precioUnitario, moneda, refPath, empate: "exacto" | "semantico", score? }[]  // top 5
  cotizacionesPrevias:   { ...igual... }[]                                                                              // top 5
  requisicionesPrevias:  { fecha, estado, solicitante, refPath, empate }[]                                              // top 3
  alertaPrecio:          AlertaPrecio | null      // solo si vino precio y hay empate exacto (ver regla)
  proveedorPreferido:    PreferenciaPieza | null
  claveSatValidada:      string | null            // desde sat_asignaciones (mismo loader que /api/sugerir-clave-sat)
  familia:               { categoriaId, tipoInsumo, medida } | null   // desde clasificacion_ia_mapeos
  fuentesConsultadas:    FuenteBusquedaIndice[]   // las que el usuario tenía permiso de ver
  degradado:             boolean                  // true si índice/Gemini falló y solo hubo empate exacto
```

Vive en `lib/memoria-operativa/` como lógica pura testeable con Vitest sin Firestore: recibe las
entradas del índice y los resúmenes como parámetros, igual que hoy hace `evaluarAlertaPrecio`. La
ruta es la única que toca Admin SDK.

**Regla de empate — precisión antes que recall.** El semántico genera candidatos; la llave exacta
confirma:

- Un candidato es **exacto** si `llavesCoinciden()` o si ambos tienen número de parte y coinciden
  normalizados.
- Un candidato es **semántico** si coseno ≥ 0.80 (umbral a calibrar en Fase 0 con muestra real) y
  no es exacto.
- `alertaPrecio` **solo** se calcula sobre empates exactos. Una fresa de 1/4" y una de 3/8" son
  vecinas semánticas con precios distintos; alertar "caro" comparando contra la otra es peor que no
  alertar. Los semánticos se muestran como "parecidos", sin comparar precio.
- Si ambas partes tienen número de parte y **no** coinciden, el candidato se descarta aunque el
  coseno sea alto.

**Por qué en servidor y no en el cliente.** El embedding de la consulta necesita la API key de
Gemini (`obtenerGeminiApiKey()`), `busqueda_indice` está bloqueado al cliente por rules, y el
filtrado por módulos debe ocurrir antes de leer — los tres argumentos ya establecidos en el spec del
2026-08-17. Además elimina los full scans del cliente: la ruta lee con Admin SDK y devuelve solo lo
relevante. Nota: `cargarMapeosClasificacion` hoy usa el SDK cliente; se agrega un loader Admin
equivalente (con el mismo cache de 5 min que `cargarMapeosSatDesdeFirestore`) sin tocar el existente.

### Componente B — Índice semántico completo

Ampliar `FuenteBusquedaIndice` a `"orden-item" | "proveedor" | "cotizacion" | "requisicion"` y
agregar sus constructores de texto en `functions/src/busqueda-indice-texto.ts`, con el mismo
mecanismo (full scan + `textoHash`, batches de 100, poda de huérfanos). Sin rediseño del indexador.

- `cotizacion`: texto = `descripcion + numeroParte + proveedor`; metadata `precioUnitario, moneda,
  fecha, ubicacion, estatus`; `refPath: /cotizaciones?id=`. **Se excluyen las filas con
  `origen === "compra"`**: son el espejo de compras americanas que ya existe como `orden-item`
  (vía `ordenIdOrigen`) — indexarlas duplicaría cada compra en Cmd+K y en el contexto.
- `requisicion`: texto = `descripcion + parteNumero + tienda`; metadata `estado, solicitante,
  fechaPedido, proveedorGanadorNombre`; `refPath: /requisiciones?id=`.
- Ambas descartan precio ≤ 0 como referencia de precio (mismo criterio que `esItemComprable`),
  pero sí se indexan para recuperación.

`compras_odoo_items` (compras MX espejo de Odoo) **queda como decisión de Fase 0**: es
probablemente la fuente más grande y la que más empuja el índice fuera del rango donde el coseno en
servidor sigue siendo razonable. Ver "Decisiones técnicas" §2.

Cmd+K y `/api/busqueda-semantica` extienden el filtro: `cotizacion` requiere módulo
`cotizaciones`, `requisicion` requiere `requisiciones`.

### Componente C — Registro uniforme de aceptación / corrección

Una colección nueva `memoria_correcciones` y un helper `registrarCorreccion()` en
`lib/memoria-operativa/correcciones.ts`, para las señales que **hoy no se guardan**:

```
memoria_correcciones/{id}
  tipo:      "proveedor_recomendado" | "campo_sugerido" | "alerta_precio"
  contexto:  { modulo, docId, llavePieza?, campo? }
  sugerido:  string | number | null    // lo que propuso el sistema
  elegido:   string | number | null    // lo que quedó al guardar
  aceptado:  boolean                   // sugerido === elegido
  usuario:   string                    // email
  creadoEn:  timestamp
```

Señales v1:

- `proveedor_recomendado` — `/requisiciones` al guardar: qué recomendó
  `SeccionRecomendacionInteligente` vs `proveedorGanadorId`.
- `campo_sugerido` — `/nueva-compra` al guardar: por cada campo que `completarCamposItem` rellenó,
  si el usuario lo dejó o lo cambió.
- `alerta_precio` — `/nueva-compra` y `/cotizaciones`: se mostró alerta "caro" y el usuario guardó
  igual (`aceptado=false`) o cambió precio / proveedor.

**Se registran aciertos y correcciones**, no solo correcciones: sin los positivos no se puede
calcular precisión. Escritura best-effort desde el cliente — nunca bloquea el guardado principal;
un fallo se loggea y se sigue. Rules validan forma en `create` y prohíben `update` / `delete` salvo
super-admin: es un log, no un estado.

`sat_asignaciones`, `clasificacion_ia_mapeos` y `evaluaciones_proveedores` **no se tocan**:
funcionan, tienen rules, tienen tests y tienen consumidores. Unificarlas sería una migración con
riesgo real y valor cero para el usuario. Lo que sí: `consultarMemoriaOperativa()` las lee para
incluir `claveSatValidada` y `familia` en el contexto.

**Qué se hace con el registro en v1: nada automático.** Solo se acumula y se puede consultar (script
`npm run memoria:precision` que imprime tasa de aceptación por tipo y por mes). Ajustar pesos del
recomendador con esa evidencia es v2, cuando haya volumen.

### Superficies (dónde se ve)

| Superficie | Qué cambia | Reusa |
|---|---|---|
| `/nueva-compra` | Por ítem, tras la extracción IA: chip "Comprado antes N veces · último $X moneda proveedor fecha" + alerta de precio si aplica. Carga async, no bloquea guardar. | `evaluarAlertaPrecio`, primitivas `components/ui` |
| `/cotizaciones` (captura manual) | Mismo chip al escribir descripción / número de parte (debounce). | Igual |
| `/requisiciones` NuevaRequisicionModal | Sustituye los dos full scans por una llamada a la ruta; guarda `proveedor_recomendado` al confirmar. | `sugerirPrecioYProveedor` con datos del servidor |
| Cmd+K | Resultados de cotizaciones y requisiciones con badge de fuente. | `BuscadorGlobalCommand.tsx` |

Diseño visual: mismo lenguaje que las alertas existentes en `DetalleRequisicionModal`, tokens
semánticos (`smv-ui-consistencia`), nada de marketing chrome.

## Fuera de alcance (v1)

- **Chat / respuesta generativa** ("pregúntale al Hub"). El `ContextoOperativo` es exactamente lo
  que un LLM necesitaría para responder; dejar la puerta abierta cuesta cero. Construirlo sin saber
  qué preguntas hace la gente, no.
- **Ajuste automático de pesos del recomendador** con `memoria_correcciones`. Primero acumular.
- **Pantalla "lo que el Hub aprendió"** (ver / editar las memorias). Útil, pero es UI de
  administración; `PanelClasificacionIA.tsx` ya cubre una parte.
- **Migrar a `findNearest`** — solo si Fase 0 lo justifica (§2 abajo).
- **Indexar finanzas, caja chica, auditoría.** Mismo criterio que el spec anterior.
- Data lake, Redis, GraphQL, modelos entrenados: nada de esto resuelve un problema que exista.

## Decisiones técnicas clave

### 1. Semántico como generador de candidatos, exacto como confirmación

Es la decisión que más importa para que la memoria no mienta. Un falso "caro" en una factura le
cuesta confianza al módulo entero; un "sin histórico" cuando sí había, solo cuesta una oportunidad.

### 2. Tamaño del índice → dónde se calcula la similitud

Con cotizaciones y requisiciones el índice crece, pero probablemente sigue en el rango de cientos
a bajo millar. Con `compras_odoo_items` puede saltar a varios miles. El spec del 2026-08-17 fijó
~1,500–2,000 vectores como frontera donde el coseno en servidor deja de ser razonable (cada consulta
fría lee todo el índice, ~3 KB por vector).

Fase 0 mide. Regla de corte:

- **≤ 1,500 entradas totales** → todo entra, se mantiene coseno en servidor. Cero infraestructura.
- **> 1,500** → `compras_odoo_items` se deja fuera de v1 y se documenta como v2 con `findNearest`.
  Ese camino tiene un prerequisito real: `functions/package.json` fija `firebase-admin@^12` y
  `FieldValue.vector()` llegó en v13. Subir admin en Functions es un cambio con su propio riesgo (es
  el mismo runtime de los syncs de Odoo) y merece su propio spec.

Además: nueva-compra puede pedir hasta 20 ítems de una factura. Se embeben con
`generarEmbeddingsLote` (una llamada, no veinte) y se comparan contra el índice leído **una vez**
por request, no una vez por ítem.

### 3. Ruta nueva, no reusar `/api/busqueda-semantica`

Cmd+K devuelve "resultados"; la memoria devuelve "contexto de una pieza" (estructura distinta,
múltiples piezas por request, cruza con llave exacta y memorias de corrección). Compartirán
`buscarPorSimilitudSemantica` y la tabla fuente→módulo, extraída a
`lib/memoria-operativa/permisos.ts` para que las dos rutas usen exactamente la misma.

### 4. Nada bloquea la captura

La memoria es un asistente. Si Gemini tarda, si el índice está caído, si el usuario no tiene
permiso a alguna fuente: el chip muestra "Sin historial disponible" (o `degradado: true` con solo
empate exacto) y guardar sigue funcionando. Timeout del lado del cliente de 8 s para el chip; la
ruta usa el mismo `maxDuration` y rate limit que la búsqueda semántica.

## Permisos

| Fuente / dato | Requiere | Nota |
|---|---|---|
| `orden-item` | módulo `ordenes` | Igual que hoy |
| `proveedor` | módulo `proveedores` | Igual que hoy |
| `cotizacion` | módulo `cotizaciones` | Nuevo |
| `requisicion` | módulo `requisiciones` | Nuevo |
| Precios en el chip | `ordenes` o `cotizaciones` | Almacén no ve precios (misma regla que "Por recibir") |
| `memoria_correcciones` create | usuario autorizado | Con validación de forma en rules |
| `memoria_correcciones` update / delete | super-admin | Es un log |
| `busqueda_indice` | cliente bloqueado | Igual que hoy |

Super-admin ve todo. Filtrado en servidor antes de leer, no en la UI — criterio heredado del spec
anterior. Reglas nuevas se cubren en `npm run test:rules`.

## Costo y rendimiento

- **Indexación:** pago único por entrada nueva (cotizaciones + requisiciones), luego solo lo que
  cambia de `textoHash`. El sync sigue cada 24 h; reindex manual solo super-admin.
- **Consulta:** 1 llamada de embeddings por request (lote), no por ítem. Cmd+K no cambia.
- **Lecturas Firestore:** la ruta lee el índice completo una vez por request (como hoy
  `/api/busqueda-semantica`) más las memorias de corrección con cache de 5 min.
  `NuevaRequisicionModal` **deja** de leer dos colecciones completas por apertura — neto, menos
  lecturas que hoy.
- Fase 0 documenta el costo mensual estimado con volúmenes reales, igual que el 2026-08-17.

## Riesgos

- **Falsos positivos de precio.** Mitigado por la regla de empate exacto. Se valida con muestra
  real antes de exponer la alerta en nueva-compra.
- **Ruido en el chip.** Si "parecidos" muestra 5 fresas distintas por cada fresa, estorba. Umbral
  calibrado en Fase 0 y máximo 3 parecidos visibles.
- **Latencia en captura.** Chip async con timeout; nunca en el camino crítico de guardar.
- **Índice crece y el coseno en servidor se vuelve lento.** Medido en Fase 0; regla de corte
  explícita (§2).
- **Cotizaciones importadas por CSV con descripciones pobres o precio 0.** Se indexan para
  recuperación pero no cuentan como referencia de precio.
- **Cuatro formatos de memoria (tres existentes + `memoria_correcciones`).** Aceptado a propósito
  en v1 para no migrar. Se documenta en `AGENTS.md` cuál guarda qué.

## Criterios de éxito

1. **Contexto correcto en captura:** sobre 20 ítems reales de facturas recientes de `smv-brain`
   que sí tienen historial, el chip de `/nueva-compra` muestra la compra previa correcta en ≥ 16.
2. **Cero alertas falsas:** en esa muestra, ninguna alerta "caro" comparando contra una pieza con
   número de parte distinto.
3. **Búsqueda ampliada:** 10 búsquedas de prueba nuevas sobre cotizaciones / requisiciones (a
   definir con Emiliano en Fase 0, como se hizo el 2026-08-17) → esperado en top 3 en ≥ 8.
4. **Sin full scans:** `NuevaRequisicionModal` ya no llama `listarCotizaciones()` ni
   `listarTodasCotizacionesRequisicion()`; verificado en test.
5. **Registro completo:** el 100 % de las requisiciones guardadas con una recomendación visible
   dejan un doc `proveedor_recomendado`.
6. **Degradación limpia:** con Gemini caído (stub que falla), guardar en `/nueva-compra` sigue
   funcionando y el chip dice "Sin historial disponible" — test E2E sobre `smv-brain-dev`.
7. **Permisos:** un usuario sin `cotizaciones` nunca recibe entradas `cotizacion` — test de ruta.
8. Costo mensual estimado documentado y aprobado antes de desplegar.

## Fases (resumen; el detalle va en el plan)

- **Fase 0 — Medir y decidir** (sin código de producción): contar cotizaciones (sin
  `origen=compra`), requisiciones y `compras_odoo_items` en `smv-brain`; estimar tamaño del índice y
  costo; calibrar umbral semántico con 20 ítems reales; definir las 10 búsquedas nuevas.
  **Checkpoint con Emiliano.**
- **Fase 1 — Índice ampliado** (Functions): fuentes `cotizacion` y `requisicion`, permisos en
  Cmd+K, reindex en dev y prod.
- **Fase 2 — Consulta unificada** (`lib/memoria-operativa/` + ruta): lógica pura con tests, empate
  exacto + semántico, `ContextoOperativo`.
- **Fase 3 — Superficies:** chip en nueva-compra y cotizaciones; requisiciones sin full scan.
- **Fase 4 — Registro de correcciones:** colección, rules, helper, tres señales, script de precisión.
- **Fase 5 — Validación y despliegue:** criterios 1–8, `AGENTS.md` / `CLAUDE.md`, deploy selectivo
  (Functions codebase `smv-hub`, `firestore:rules`, hosting).

Gates en cada fase: `npx tsc --noEmit` · `npm run lint` · `npm test` ·
`cd functions && npm run build` · `npm run build`.

## Resultados de Fase 0 — diagnóstico de datos reales (2026-09-13)

Corrido con `npx tsx scripts/diagnostico-datos.ts smv-brain` (solo lectura, service account
`roles/datastore.viewer`). Números de `smv-brain` / `compras-americanas` al 2026-09-13.

### Volúmenes

| Colección | Docs | Nota |
|---|---|---|
| `compras_odoo_items` | **2,325** | La fuente más grande, por mucho. 99 % MXN. |
| `cotizaciones` | 849 | 387 `origen=compra` (espejo de órdenes) + **462 manuales**. |
| `ordenes` | 142 (414 ítems) | 100 % USD. |
| `proveedores` | 104 | **97 % sin `mercado`**. |
| `clasificacion_ia_mapeos` | 338 | La memoria de corrección más usada. |
| `sat_asignaciones` | 76 | |
| `busqueda_indice` | 518 | 414 orden-item + 104 proveedor. **~10 KB por entrada**, no 3 KB. |
| `requisiciones` | **1** | `cotizaciones_requisicion`: 0. `evaluaciones_proveedores`: 4. |

### Lo que cambia en este spec

1. **`compras_odoo_items` queda fuera de v1.** Índice proyectado: sin Odoo 981 entradas (~9.5 MB
   por lectura fría); con Odoo 2,980 (~29 MB). Excede el corte. Entra en v2 con `findNearest`
   (requiere subir `firebase-admin` en Functions).
2. **Requisiciones sale de v1.** Con 1 documento en producción, la fuente `requisicion`, la señal
   `proveedor_recomendado` y el arreglo del full scan no tienen datos que justificarlos. El módulo
   se retoma cuando el taller lo use de verdad. El spec queda en **órdenes + cotizaciones**.
3. **El índice necesita caché en proceso.** `lib/busqueda-semantica-catalogo.ts` no cachea: cada
   Cmd+K baja ~5 MB hoy y bajaría ~9.5 MB con cotizaciones. Se agrega caché en memoria del índice
   (TTL 5–10 min) en Fase 2, antes de sumar fuentes.
4. **El empate exacto casi no encuentra historial — el semántico es el juego entero.** Por llave
   de pieza: en órdenes solo 20 de 392 llaves se repiten (42 ítems, 10 %); en cotizaciones 21 de
   821 (3 %), y 13 comparables entre ≥2 proveedores. Ningún ítem de órdenes se compró a 2
   proveedores distintos por llave exacta. Dos lecturas posibles y hay que distinguirlas en la
   calibración: (a) el matcher léxico oculta repeticiones por redacción distinta, o (b) el taller
   realmente compra piezas distintas casi siempre. Si domina (b), el valor del chip está en
   "parecidos + proveedor + rango por familia", no en "comprado antes". **Criterio de éxito #1 se
   re-basa:** la muestra son las 20 llaves repetidas (el semántico debe encontrarlas) + 20 ítems sin
   empate exacto (para medir cuántas repeticiones reales estaba ocultando la redacción).

### Huecos de estructura (alimentan el spec del frente B)

| Hueco | Dato | Causa verificada | Arreglo |
|---|---|---|---|
| `proveedorId` casi inexistente | 93 % órdenes, 97 % cotizaciones sin FK | Dos causas: catálogo incompleto (DigiKey, eBay, Amazon, PTSolutions, Home Depot **no existen** en `proveedores`) y matcher sin alias (MSC está como "MSC Industrial Direct"; las facturas dicen "MSC Industrial Supply" → no empata). 26 fantasmas en órdenes, 117 en cotizaciones (con variantes tipo "digikey" / "digikey electronics"). | Alta al catálogo asistida por IA (agrupar variantes) + campo `aliases[]` en `Proveedor` + matcher que los consulte + FK obligatoria en capturas nuevas. |
| Marketplaces como proveedor | eBay 31 + Amazon 10 = 29 % de las órdenes | El campo guarda el canal, no el vendedor. | Aceptarlo: alta de eBay/Amazon como `tipoProveedor` marketplace. No vale la pena modelar vendedor real. |
| `diasHabiles` | 68 % null; del resto: 45 % número, 38 % rango, 10 % semanas/meses, 7 % "stock" | Texto libre. 93 % de los no nulos son parseables con regex; "stock" = 0 días. | Campos derivados `leadTimeMin/Max` al guardar + backfill. |
| `numeroParte` en cotizaciones | 69 % vacío | Llave de pieza cae a descripción → 821 llaves para 849 filas. | No se puede inventar; el semántico lo compensa. Sí: pedirlo en captura cuando el proveedor lo maneja. |
| `mercado` en catálogo | 97 % vacío (2 mexico, 1 usa) | La separación USA/MX que exige `AGENTS.md` no está en los datos. | Backfill por moneda + país + confirmación manual. |
| Odoo `otros` | 978 / 2,325 (42 %) sin familia útil; 42 % sin tipo | Clasificador cubre el 58 %. | Segunda pasada IA sobre `otros` usando los 338 mapeos aprobados como few-shot. |
| `fechaFactura` | 20 % de órdenes null | Reportes ya caen a `creadoEn`. | Sin acción en este spec. |

Lo que **sí** está bien y no hay que tocar: cobertura SAT en órdenes (96 % con clave), campos
manuales (empresa/requisitor 100 %, cuentaCargo 98 %), `llavePieza` persistida en 100 % de
cotizaciones, monedas limpias (nunca mezcladas), índice 100 % en `gemini-embedding-2` · 768d y
sincronizado ese mismo día sin errores.

## Preguntas abiertas para Emiliano

1. ~~¿`compras_odoo_items` en v1?~~ **Resuelto por datos:** fuera de v1 (excede el corte 2×).
2. ~~¿Requisiciones en v1?~~ **Resuelto por datos:** fuera de v1 (1 documento en producción).
3. **¿Quién ve precios en el chip?** Propuesta: `ordenes` o `cotizaciones`. ¿Algún perfil más que
   deba verlos, o alguno que no?
4. **¿Registrar aciertos además de correcciones?** Recomiendo sí (sin positivos no hay precisión).
   Es un doc chico por guardado.
5. **Umbral "caro".** Hoy `UMBRAL_CARO = 0.35` (+35 % sobre el mínimo histórico). ¿Lo dejamos igual
   para nueva-compra, o uno distinto para facturas ya pagadas — donde la alerta llega tarde y sirve
   más como aprendizaje que como freno?
6. **Orden de superficies.** Propongo nueva-compra primero (ahí está el precio real pagado). ¿O
   prefieres cotizaciones, que es donde se decide antes de comprar?
7. **Orden de frentes.** Con estos números, el frente B (estructura: proveedores + aliases +
   `diasHabiles`) da valor inmediato y sin IA en runtime. ¿Lo hacemos antes de la memoria
   operativa, como se propuso, o en paralelo?

## Relación con otros documentos

- Extiende [2026-08-17-busqueda-semantica-datos-reales.md](2026-08-17-busqueda-semantica-datos-reales.md)
  (fuentes 3–4 que quedaron pendientes) y su
  [handoff de Fase 4](../plans/2026-08-18-handoff-fase-4-busqueda-semantica.md).
- Reusa el patrón de [2026-07-30-sat-sugerencias-hibridas-design.md](2026-07-30-sat-sugerencias-hibridas-design.md)
  (memoria validada por el equipo) y [2026-08-14-proveedores-rango-odoo-design.md](2026-08-14-proveedores-rango-odoo-design.md)
  (rangos por familia).
- Respeta [2026-07-24-lazo-retroalimentacion-produccion-design.md](2026-07-24-lazo-retroalimentacion-produccion-design.md):
  el Hub es la capa de operación diaria alrededor de Odoo, no un ERP; nada aquí duplica a Odoo.
- Sustituye el documento externo del 2026-09-13 (no está en el repo; sus supuestos no aplican a
  este stack).
