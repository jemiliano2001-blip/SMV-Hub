# Plan — Memoria operativa v1 (frente C)

Spec: [../specs/2026-09-13-memoria-operativa-design.md](../specs/2026-09-13-memoria-operativa-design.md)
Estado: **C0 y C1 cerradas el 2026-09-15** (C0 calibración con checkpoint aprobado; C1 índice
con cotizaciones desplegado y verificado en producción: 993 entradas, 10/10 búsquedas). Sigue C2
(consulta unificada). Datos ya normalizados por el frente B
([2026-09-13-estructura-datos-normalizacion.md](2026-09-13-estructura-datos-normalizacion.md)).

**Alcance v1 fijado por datos (Fase 0 del spec):** órdenes + cotizaciones manuales. Fuera:
`compras_odoo_items` (2,360 ítems; el índice excedería 2× el corte de 1,500 → v2 con
`findNearest`) y requisiciones (1 documento en prod). Con requisiciones fuera, la señal
`proveedor_recomendado` y el arreglo del full scan de `NuevaRequisicionModal` **salen de v1**; en su
lugar entra `proveedor_sugerido`, que ya tiene su momento de captura en el chip de B1.

**Decisiones que este plan asume (preguntas 3–6 del spec; confirmar en el checkpoint de C0):**

| # | Pregunta | Default del plan |
|---|---|---|
| 3 | ¿Quién ve precios en el chip? | Módulo `ordenes` **o** `cotizaciones` (super-admin siempre). Almacén ve "comprado antes" sin montos, igual que en *Por recibir*. |
| 4 | ¿Registrar aciertos además de correcciones? | **Sí.** Sin positivos no hay tasa de precisión. |
| 5 | Umbral "caro" en nueva-compra | Mismo `UMBRAL_CARO = 0.35`; cambia el **mensaje**, no el umbral: en factura ya pagada dice "pagaste N % arriba del mínimo histórico" (aprendizaje), en cotización "está N % arriba" (freno). |
| 6 | Orden de superficies | `/nueva-compra` primero (precio real pagado), `/cotizaciones` después. |

Regla para todas las tareas: `npx tsc --noEmit`, `npm run lint`, `npm test` en verde antes de
cerrar cada una; `npm run test:rules` cuando se toquen rules; `cd functions && npm run build`
cuando se toque `functions/`. Deploy de Functions **solo** con targets del codebase `smv-hub`
(`scripts/firebase-deploy-targets.mjs`), nunca `--only functions --force`. Hosting siempre
`npm run deploy:hosting` (CI no lo despliega). Una rama + PR por fase, como B3.

**Lo que ya existe y este plan solo conecta** (no reconstruir): índice `busqueda_indice` con
sync cada 24 h y reindex manual (`functions/src/busqueda-indice-*.ts`, botón en Mantenimiento);
`generarEmbeddingsLote` / `similitudCoseno` / `buscarPorSimilitudSemantica` (`lib/embeddings-ia.ts`);
`generarLlavePieza` / `llavesCoinciden` (`lib/pieza-matching.ts`); `fusionarPuntosPrecio`,
`resumirPreciosPorPiezaProveedor`, `evaluarAlertaPrecio` (`lib/proveedores-inteligencia-cruzada.ts`);
loaders con caché de 5 min (`lib/sat/cargar-mapeos-firestore.ts`) y los mapeos aprobados de B2
(`lib/compras-odoo/mapeos-aprobados.ts`); `excedeLimite` (`lib/rate-limit-memoria.ts`);
`verificarUsuarioAutorizado` y el patrón de fuentes-por-módulo de `app/api/busqueda-semantica/route.ts`.

---

## C0 — Calibración read-only y checkpoint

Sin código de producción. Scripts en `scripts/` con la SA de lectura (`.env.admin.local`) y la
key de Gemini de `.env.local` (solo embeddings de consulta, ~40 llamadas).

### T0.1 · Muestra de calibración del umbral semántico — ✅ HECHO (2026-09-15)
- `scripts/calibracion-memoria-operativa.ts` (read-only): toma **(a)** las 20 llaves de pieza de
  órdenes que se repiten (empate exacto conocido — el diagnóstico cuenta 20 llaves compradas ≥ 2
  veces) y **(b)** 20 ítems de las órdenes más recientes sin empate exacto. Para cada uno embebe la
  descripción como query (`RETRIEVAL_QUERY`, 768d) y la compara contra **todo** el índice actual.
- Salida: por ítem, top 5 con coseno, llave y si es exacto; histograma de coseno para "mismo ítem
  (misma llave)" vs "vecino (otra llave)". De ahí sale el umbral (el spec propone 0.80) y la
  separación entre las dos lecturas del spec: cuántas repeticiones reales estaba ocultando la
  redacción (a) vs. el taller compra piezas distintas casi siempre (b).
- Guarda la muestra como fixture golden `tests/fixtures/memoria-operativa-muestra-2026-09-XX.json`
  (descripción, llave, top 5 esperado, umbral) para los tests de C2 y el criterio #1.

### T0.2 · Tamaño del índice y costo — ✅ HECHO (2026-09-15)
- Índice hoy: 527 entradas (416 orden-item + 111 proveedor), ~10 KB c/u. Cotizaciones manuales
  candidatas: **462** (`origen ≠ compra`; las 392 `origen=compra` ya están como orden-item). Proyección
  ≈ 990 entradas ≈ 9.7 MB por lectura fría → **≤ 1,500: coseno en servidor se queda**, con caché en
  proceso (T2.1) obligatoria antes de sumar la fuente.
- Costo mensual estimado con volúmenes reales (criterio #8): indexación inicial 462 embeddings
  una vez + solo cambios de `textoHash` después; por consulta 1 llamada de embeddings en lote
  (≤ 20 ítems) + 1 lectura del índice cada 5 min por instancia. Se documenta en este plan y se
  aprueba en el checkpoint.

### T0.3 · Las 10 búsquedas de prueba sobre cotizaciones — ✅ propuestas (2026-09-15), a confirmar en T0.4
- El script de T0.1 imprime las 30 descripciones más frecuentes de cotizaciones manuales (MX y
  USA) para elegir con Emiliano 10 consultas en español + su regex esperado, mismo formato que
  `scripts/validar-busquedas-prueba.ts` (`{ q, debe }`). Se agregan a ese script como bloque
  `BUSQUEDAS_COTIZACIONES` y son el criterio #3.

### T0.4 · Checkpoint con Emiliano — ✅ HECHO (2026-09-15: umbral 0.76, regla de número de parte, 10 búsquedas y costo aprobados)
Umbral elegido, lectura (a)/(b), costo, las 10 búsquedas y las 4 decisiones de la tabla de arriba
(las 4 decisiones ya aprobadas el 2026-09-15). **Gate para C1.**

---

### Resultados de C0 (2026-09-15)

`npx tsx scripts/calibracion-memoria-operativa.ts smv-brain --fixture tests/fixtures/memoria-operativa-muestra-2026-09-15.json`
— 419 ítems de órdenes, 416 entradas orden-item en el índice, 397 llaves distintas, **20 repetidas**.
Muestra: 20 repetidas + 20 sin empate exacto = 40 consultas × 2 task types (80 embeddings).

**Distribución de coseno (RETRIEVAL_QUERY, la pareja correcta del índice RETRIEVAL_DOCUMENT):**

| Grupo | min | p10 | p50 | p90 | max |
|---|---|---|---|---|---|
| (a) mejor empate exacto (misma llave) | 0.859 | 0.871 | 0.885 | 0.898 | 0.924 |
| (a) mejor vecino (otra llave) en las mismas consultas | 0.652 | 0.691 | 0.842 | 0.867 | 0.879 |
| (b) mejor vecino en ítems sin empate exacto | 0.622 | 0.647 | 0.773 | 0.881 | 0.900 |

`SEMANTIC_SIMILARITY` comprime todo hacia arriba y separa peor (vecino max 0.901 > exacto min
0.870): se descarta. **Se usa `RETRIEVAL_QUERY`, igual que Cmd+K.**

**El hallazgo que cambia C2: el coseno solo no separa "misma pieza" de "misma familia".** Al
mirar los 34 pares no exactos con coseno ≥ 0.84 (diff de llaves), caen en tres clases:

1. *Misma pieza, mismo número de parte, redacción distinta* — inserto `90259A132` con y sin
   "easy-to-install"; caster `2512T66` con mayúsculas distintas. Hoy **no** empatan por llave
   (`includes` falla cuando la diferencia va en medio). Deberían ser **exactos**.
2. *Misma familia, otro número de parte* — resortes `9657K266` vs `9657K493`, pines `93772A118`
   vs `93772A528`, guardamotor `140M-C2E-C20` vs `-C16`, cable Murr `…S7V1500` (15 m) vs `…S7V0750`
   (7.5 m). Coseno 0.84–0.90, **indistinguible de un exacto**. Precio distinto: deben ser
   *parecidos*, nunca exactos (justo el riesgo que el spec anticipó con la fresa de 1/4" vs 3/8").
3. *Ruido pegado* — número de listado de eBay `(335821173102)` y colas "your reference …" de
   McMaster. Cambian la llave sin cambiar la pieza (el RFID Omron `V680S-D2KF68M` aparece 3 veces
   con 3 llaves).

La descripción de una orden **lleva el número de parte embebido** (McMaster `9657K266`, DigiKey
`1866-1030-ND`, Murr `7700-44711-S7V1500`, Omron `V680S-D2KF68M`, Allen-Bradley `140M-C2E-C20`),
aunque `ItemFactura` no tenga campo `numeroParte`. Regla probada en seco sobre las 40 muestras
(`extraerNumerosParte`: tokens alfanuméricos ≥ 6 con letra y dígito, sin unidades tipo `120VAC` /
`4-pole` / `22AWG`, sin dimensiones `30X47X6`, sin listados eBay ni tracking UPS `1Z…`; comparados
sin guiones y en mayúsculas):

| Regla | (a) 20 repetidas | (b) 20 sin empate |
|---|---|---|
| consultas con ≥ 1 **exacto** (número de parte igual **o** `llavesCoinciden`) | **20/20** | 1/20 (el Omron oculto) |
| candidatos **hermanos** (ambos con número de parte y distinto → parecido, nunca exacto) | 22 | 17 |
| candidatos parecidos sin número de parte, coseno ≥ 0.76 | 8 | 13 |
| promedio hermanos + parecidos por consulta a 0.76 | 1.5 | 1.5 |
| consultas con ≥ 1 parecido útil a 0.76 | — | 9/20 |

**Umbral elegido: 0.76** para *parecidos* (a 0.80 se pierden los anillos de retención `90119A…`,
el Novotechnik `F1-023272` y el sello Husky, que sí son la familia correcta; por debajo de 0.75
empiezan los no relacionados). Los exactos no dependen del umbral: los decide la llave o el número
de parte. El chip muestra máximo 3 parecidos.

**Lectura (a) vs (b):** de los 20 ítems "sin empate exacto", ~3 eran compras repetidas ocultas por
redacción (Omron, cable Murr de 15 m, pen drives); los otros 17 son piezas nuevas. Con 20 llaves
repetidas sobre 397, **el taller compra piezas distintas casi siempre (b domina)**: "comprado
antes" se disparará en ~5–10 % de los ítems; el valor cotidiano del chip está en *"parecidos:
compraste la familia en McMaster / Almacén Automatización a $X"*. C3 diseña el chip con eso al
frente cuando no hay exacto. Los 40 casos quedan como golden en
`tests/fixtures/memoria-operativa-muestra-2026-09-15.json` (`umbralSugerido: 0.76`).

**T0.2 — tamaño y costo:** 416 orden-item + 462 cotizaciones manuales = 878 entradas de pieza
(+ 111 proveedores ≈ 990) ≈ 8.6 MB por lectura fría → muy por debajo del corte de 1,500: coseno
en servidor, con la caché de T2.1. Costo (misma base que el plan del 2026-08-17, $0.20/1M tokens):
indexación inicial 462 × ~25 tokens ≈ 12k tokens ≈ **$0.002 una vez**; una consulta de 20 ítems ≈
500 tokens ≈ $0.0001; lecturas Firestore ≈ 880 docs por lectura fría, con caché de 5 min y ~300
lecturas frías/mes ≈ 265k lecturas ≈ **< $0.20/mes**. Irrelevante (criterio #8: aprobar en T0.4).

**T0.3 — 10 búsquedas propuestas** (de las 30 descripciones más frecuentes en cotizaciones
manuales; a confirmar o cambiar en T0.4):

| # | Consulta | Debe encontrar (regex) |
|---|---|---|
| 1 | pistón neumático SMC | `piston` / `smc` / `higoh` / `cdm2b` |
| 2 | coroplast antiestático 4 mm | `coroplast` / `esd` |
| 3 | sensor de visión compacto Keyence | `keyence` / `vision` |
| 4 | sensores de proximidad M5 Omron | `proximidad` / `omron` / `m5` |
| 5 | grasa Molykote BR-2 | `molykote` / `br-2` / `grasa` |
| 6 | sello para compresor Husky | `husky` / `seal` / `c603h` |
| 7 | aspiradora GunVac Guardair | `gunvac` / `guardair` / `aspiradora` |
| 8 | adaptador Ethernet/IP Allen-Bradley 1734 | `1734` / `allen` / `bradley` / `ethernet` |
| 9 | PTR de 4 pulgadas calibre 14 | `ptr` / `calibre` |
| 10 | impresora 3D QIDI | `qidi` / `impresora 3d` |

---

## C1 — Índice ampliado con cotizaciones (Functions)

Desplegable por sí solo: al terminar, Cmd+K ya encuentra cotizaciones aunque C2–C4 no existan.

### T1.1 · Constructor de texto para `cotizacion` (lógica pura) — ✅ HECHO (2026-09-15)
- `functions/src/busqueda-indice-texto.ts`: `FuenteBusquedaIndice` += `"cotizacion"`; tipo
  `CotizacionParaIndice { id, descripcion, numeroParte, proveedor, proveedorId, precioUnitario,
  moneda, fecha, ubicacion, estatus, origen, llavePieza }`; `construirEntradaCotizacion()` devuelve
  `null` si `origen === "compra"` (espejo de órdenes: duplicaría cada compra) o descripción vacía.
  Texto = `descripcion + (numeroParte ? "Parte: X." : "") + "Proveedor: Y."`; `titulo` = descripción;
  `refPath` = `/cotizaciones?id=`; metadata con claves ausentes (no `undefined`): `proveedorNombre`,
  `proveedorId`, `precio` **solo si > 0** (misma regla que `esItemComprable`), `moneda`, `fecha`,
  `ubicacion`, `estatus`, `numeroParte`, `llavePieza`.
- `construirEntradasOrden()`: agregar `proveedorId` (si la orden lo tiene) y `llavePieza` a la
  metadata de `orden-item` — C2 empata por llave leyendo solo el índice, sin volver a las
  colecciones. Como `functions/` no importa `lib/`, la llave de un orden-item se calcula en la
  **ruta** (lib) a partir de `titulo`, no en Functions: aquí solo se persiste `numeroParte` cuando
  exista. (ItemFactura no tiene número de parte; la llave de órdenes es `|descripciónSimplificada`.)
- `lib/schemas.ts`: `FuenteBusquedaIndiceSchema` += `"cotizacion"`; metadata del índice acepta los
  campos nuevos (opcionales).
- Tests en `tests/busqueda-indice-texto.test.ts`: excluye `origen=compra`, excluye precio 0 de la
  metadata pero sí indexa, hash estable, claves ausentes.

### T1.2 · Indexador lee cotizaciones — ✅ HECHO (2026-09-15)
- `functions/src/busqueda-indice-escritura.ts`: tercer `get()` en paralelo sobre `cotizaciones`;
  `construirEntradaCotizacion` por doc; guard de poda `fuente === "cotizacion" && cotizacionesSnap.empty`
  (nunca vaciar por un read fallido); `ResultadoIndexacion.cotizacionesLeidas`; `huellaVisible`
  ya cubre la metadata nueva (refresco sin re-embeber, T4.3 de B4). Batches de **100** intactos.
- `lib/services/busqueda-indice-sync.ts` y `PanelBackfillMercado.tsx`: mostrar `cotizacionesLeidas`
  en el resumen del botón "Refrescar índice de búsqueda".
- Test: caso nuevo en el emulator (`tests/busqueda-indice-escritura.emulator.test.ts`, registrado
  en `test:emulator`): 3 cotizaciones (1 `origen=compra`, 1 precio 0, 1 normal) → 2 entradas, la de
  precio 0 sin `metadata.precio`; segunda corrida sin cambios → 0 re-embebidas y 0 llamadas a
  Gemini; cambio de precio → metadata refrescada sin re-embeber; borrado → poda; lectura vacía →
  no poda. Para eso `sincronizarIndiceBusqueda(apiKey, { fetchFn })` acepta un fetch inyectable
  (4/4 en emulator el 2026-09-15). Ids de cotización con prefijo `cot#` (no chocan con ids de
  proveedor).

### T1.3 · Permisos por fuente en un solo lugar — ✅ HECHO (2026-09-15)
- `lib/memoria-operativa/permisos.ts`: `fuentesPermitidasPara(info): FuenteBusquedaIndice[]`
  (`orden-item` ⇐ `ordenes`, `proveedor` ⇐ `proveedores`, `cotizacion` ⇐ `cotizaciones`; super-admin
  todo) y `puedeVerPrecios(info)` (decisión #3). `app/api/busqueda-semantica/route.ts` pasa a usarla
  (hoy tiene la tabla inline). Test unitario + test de ruta: usuario sin `cotizaciones` nunca
  recibe `cotizacion` (criterio #7, se reutiliza en C2).

### T1.4 · Cmd+K muestra cotizaciones — ✅ HECHO (2026-09-15)
- `components/BuscadorGlobalCommand.tsx`: heading "Órdenes, cotizaciones & proveedores"; icono por
  fuente (`FileText` para cotización) y badge de fuente; subtítulo con proveedor · precio · fecha ·
  `ubicacion`. Tokens semánticos (`tests/ui-tokens-guardrail.test.ts`).

### T1.5 · Deploy y verificación — ✅ HECHO (2026-09-15)
- `cd functions && npm run build`; deploy **solo** `syncBusquedaIndiceScheduled` +
  `syncBusquedaIndiceManual` (targets de `scripts/firebase-deploy-targets.mjs`); hosting a mano.
- Reindex manual en dev y en prod desde Mantenimiento → resultado esperado ≈ 462 nuevas
  embebidas. Verificar con `npx tsx scripts/diagnostico-datos.ts smv-brain` (sección H: fuente
  `cotizacion` ≈ 462) y `npx tsx scripts/validar-busquedas-prueba.ts smv-brain` con el bloque de
  T0.3 → **≥ 8/10 en top 3** (criterio #3).

**Resultado (2026-09-15):** merge `e9fe4b86` (PR #14); Functions `syncBusquedaIndice*` y hosting
(`BUILD_ID NtXMNhenpaOVb3F_wVbb7`) desplegados a mano (CI sigue bloqueado por IAM en el paso de
Functions). Reindex manual por Emiliano: **993 entradas** = 462 `cotizacion` (exactamente las
manuales proyectadas) + 420 `orden-item` + 111 `proveedor`; 466 re-embebidas; 0 errores; ~10.1 KB
por entrada. Las 10 búsquedas de T0.3 contra la fuente `cotizacion`: **10/10 en top 3, las diez en
primer lugar** (criterio #3 ✅). C1 cerrada; Cmd+K ya encuentra cotizaciones en producción.

---

## C2 — Consulta unificada (`lib/memoria-operativa/` + ruta)

### T2.1 · Caché en proceso del índice
- `lib/busqueda-semantica-catalogo.ts`: extraer `leerIndiceVectorizado(fuentes)` con caché
  módulo-nivel por clave `fuentes.sort().join(",")`, TTL 5 min (mismo patrón que
  `cargarMapeosSatDesdeFirestore`), y `invalidarCacheIndice()` para tests. `buscarEnCatalogoSemantico`
  la usa; la ruta de C2 también. Hoy cada Cmd+K baja ~5 MB; con cotizaciones serían ~10 MB por
  consulta sin esto.
- Tests en `tests/busqueda-semantica-catalogo.test.ts`: dos llamadas seguidas → 1 `get()`; claves
  distintas de fuentes → lecturas distintas; TTL vencido → relee.

### T2.2 · Lógica pura: `construirContextoOperativo()`
- `lib/memoria-operativa/tipos.ts`: `PiezaConsulta { descripcion, numeroParte?, proveedor?,
  proveedorId?, precioUnitario?, moneda? }`, `ContextoOperativo` (forma del spec, sin
  `requisicionesPrevias` en v1), `EmpateMemoria = "exacto" | "semantico"`.
- `lib/memoria-operativa/consultar.ts`: `construirContextoOperativo(piezas, vectoresConsulta,
  entradasIndice, opciones: { umbralSemantico, verPrecios, mapeosSat, mapeosAprobados })`:
  1. Llave de la pieza con `generarLlavePieza(numeroParte, descripcion)`; llave de cada entrada
     del índice desde `metadata.llavePieza` (cotización) o `generarLlavePieza(metadata.numeroParte,
     titulo)` (orden-item).
  2. `lib/memoria-operativa/numero-parte.ts` → `extraerNumerosParte(descripcion)` (regla probada en
     C0: tokens alfanuméricos ≥ 6 con letra y dígito; excluye unidades `120VAC`/`4-pole`/`22AWG`,
     dimensiones `30X47X6`, listados eBay de 9+ dígitos entre paréntesis, tracking `1Z…`,
     referencias `S0` + dígitos y la cola "your reference …"; compara sin guiones, en mayúsculas).
     Test con los 40 casos del golden. Clasificación de cada candidato con `similitudCoseno` ≥ 0.76
     (`UMBRAL_PARECIDO`, del fixture): **exacto** si `llavesCoinciden()` **o** `numeroParte`
     explícito / embebido igual en ambos; **hermano** si ambos tienen número de parte y difieren (se
     muestra como parecido, nunca como exacto, aunque el coseno sea 0.90); **parecido** el resto.
     Un exacto no depende del umbral.
  3. `comprasPrevias` (orden-item) y `cotizacionesPrevias` (cotización): exactos primero por fecha
     desc, luego hermanos y parecidos por score; top 5 cada una, máximo **3 parecidos** visibles.
     Cuando no hay exacto, el contexto trae `familiaComprada: { proveedorNombre, veces, ultimoPrecio }`
     agregada sobre los parecidos — es lo que el chip muestra al frente en el ~90 % de los casos (C0).
  4. `alertaPrecio` **solo** si vino precio y hay ≥ 1 exacto con `metadata.precio`: construir
     `PuntoPrecioHistorico[]` desde esas entradas → `fusionarPuntosPrecio` →
     `resumirPreciosPorPiezaProveedor` → `evaluarAlertaPrecio` (mismo `UMBRAL_CARO`). Si
     `!verPrecios`: `alertaPrecio = null` y se borran `precioUnitario`/`moneda` de las filas.
  5. `proveedorPreferido`: conteo de proveedor por exactos (reutiliza la forma de `PreferenciaPieza`).
  6. `claveSatValidada` por descripción normalizada contra `mapeosSat`; `familia` con
     `buscarMapeoAprobadoSync(descripcion, indice)` de B2 (mismo regla D del sync).
  7. `fuentesConsultadas` y `degradado` los pone la ruta.
- Tests `tests/memoria-operativa-consultar.test.ts` con el golden de T0.1: llaves repetidas →
  exacto; vecino con número de parte distinto → descartado (criterio #2: cero alertas contra otra
  parte); precio 0 nunca alimenta la alerta; `verPrecios=false` no filtra filas pero sí montos;
  máximo 3 semánticos.

### T2.3 · Loader Admin de mapeos aprobados
- `lib/compras-odoo/mapeos-aprobados-admin.ts`: `cargarMapeosAprobadosAdmin()` con Admin SDK y
  caché 5 min, devolviendo el índice de `indexarMapeosAprobados` (el loader actual
  `cargarMapeosClasificacion` usa el SDK cliente y no sirve en Route Handlers). No toca el existente.

### T2.4 · Ruta `POST /api/memoria-operativa/consultar`
- `app/api/memoria-operativa/consultar/route.ts`: `verificarUsuarioAutorizado` → `excedeLimite(uid)`
  → body Zod `{ piezas: PiezaConsulta[] }` (1–20) → `fuentesPermitidasPara(info)` (sin
  `proveedor`: la memoria es de piezas) y `puedeVerPrecios(info)` → **una** llamada
  `generarEmbeddingsLote` (`RETRIEVAL_QUERY`, 768d) → `leerIndiceVectorizado` (cacheado) →
  `construirContextoOperativo` → `{ contextos, fuentesConsultadas, degradado, tiempoMs }`.
- Degradación (spec §4): si Gemini o la lectura del índice fallan, **no** 502: responde
  `degradado: true` con empate exacto contra `cotizaciones` por `where("llavePieza", "==", llave)`
  (persistida en el 100 % de las filas) y `comprasPrevias: []`. `maxDuration = 60`.
- Tests `tests/memoria-operativa-route.test.ts` (mock de auth/Gemini/Admin como
  `busqueda-semantica-route`): 401 sin token; sin módulos → 403; sin `cotizaciones` → cero entradas
  `cotizacion` (criterio #7); > 20 piezas → 400; Gemini falla → 200 `degradado: true`; una sola
  llamada a embeddings por request aunque vengan 20 piezas.

### T2.5 · Cliente
- `lib/services/memoria-operativa.ts`: `consultarMemoriaOperativa(piezas, { signal })` con ID
  token (mismo patrón que `lib/services/busqueda-indice-sync.ts`) y `AbortController` a **8 s**.
  Nunca lanza hacia la UI: devuelve `{ ok: false, motivo }`.

---

## C3 — Superficies

### T3.1 · `components/memoria/ChipMemoriaOperativa.tsx`
- Props: `estado: "cargando" | "listo" | "sin_historial" | "error"`, `contexto?`, `verPrecios`.
  Render: "**Comprado antes** 3 veces · último $12.40 USD · McMaster · 2026-07-02" /
  "**Cotizado antes** 2 veces · …"; alerta de precio con el tono de las alertas de
  `DetalleRequisicionModal` (mensaje según decisión #5); "Parecidos (3)" plegado; pills
  `claveSatValidada` y `familia` si existen; "Sin historial disponible" en `sin_historial`/`error`.
  Sin montos si `!verPrecios`. Primitivas `components/ui`, tokens semánticos.
- Test de render (`tests/chip-memoria-operativa.test.tsx`) + guardrail de tokens.

### T3.2 · Hook `useMemoriaOperativa`
- `lib/hooks/useMemoriaOperativa.ts`: recibe la lista de piezas y devuelve `Map<índice, estado>`;
  dispara **una** consulta por lote cuando cambia la huella (descripción + número de parte +
  precio) con debounce 600 ms; cancela la anterior con `AbortController`; nunca afecta el submit.
  Test con el servicio mockeado: 20 ítems → 1 llamada; cambio en un ítem → 1 llamada nueva;
  desmontaje → abort.

### T3.3 · `/nueva-compra`
- `NuevaCompraForm.tsx`: tras la extracción IA (`ext` handler) y al editar descripción/precio,
  el hook consulta con el proveedor de la orden (`proveedorId` del chip de B1 si existe); chip bajo
  la descripción de cada ítem. Guardar no espera al chip (spec §4).
- Guarda en un ref por ítem lo que la memoria mostró (`alertaPrecio?.tipo`) para C4.

### T3.4 · `/cotizaciones`
- `CotizacionFormModal.tsx`: chip al escribir descripción / número de parte (mismo hook con una
  pieza); `CotizacionIaModal.tsx`: chip por partida tras la extracción. Mismo ref para C4.

### T3.5 · E2E de degradación (criterio #6)
- `e2e/memoria-operativa.spec.ts` (proyecto money-path, escribe solo en `smv-brain-dev`): stub de
  `/api/memoria-operativa/consultar` que responde 500 → capturar y guardar una compra funciona y
  el chip dice "Sin historial disponible". Segundo caso: stub con contexto fijo → el chip muestra
  "Comprado antes" con el monto.

---

## C4 — Registro uniforme de aceptación / corrección

### T4.1 · Schema y rules
- `lib/schemas.ts`: `MemoriaCorreccionSchema { tipo: "campo_sugerido" | "alerta_precio" |
  "proveedor_sugerido", contexto: { modulo, docId, llavePieza?, campo? }, sugerido, elegido,
  aceptado, usuario, creadoEn }`.
- `firestore.rules` → `match /memoria_correcciones/{id}`: `create` si usuario activo, forma válida
  y `usuario == request.auth.token.email`; `read` para módulos `ordenes`/`cotizaciones`/super-admin;
  `update`/`delete` solo super-admin (es un log). Casos en `tests/firestore-rules-emulator.test.ts`.

### T4.2 · Helper
- `lib/memoria-operativa/correcciones.ts`: `registrarCorrecciones(entradas[])` con `writeBatch`,
  **best-effort**: `try/catch` → `console.warn`, nunca rechaza. Test con Firestore mockeado
  (fallo → no lanza; éxito → un batch).

### T4.3 · Las tres señales
- `campo_sugerido` (`/nueva-compra`): `NuevaCompraForm` ya llama `completarCamposItem`; guardar en
  un ref qué campos rellenó por ítem y, al guardar la orden, comparar con el valor final →
  `aceptado = sugerido === elegido`.
- `alerta_precio` (`/nueva-compra`, `/cotizaciones`): si el chip mostró `caro`, al guardar:
  `sugerido = "revisar"`, `elegido = precio final`, `aceptado = cambió precio o proveedor`.
- `proveedor_sugerido` (chip de B1 en los tres formularios): cuando `resolverProveedor` devolvió
  `sugerido`, `sugerido = proveedorId propuesto`, `elegido = proveedorId final`,
  `aceptado = iguales`. Se emite desde `ChipProveedorVinculado.onElegir`, sin tocar su UI.
- Tests unitarios de la función pura que arma las entradas desde (sugerencias, valores finales).

### T4.4 · Script de precisión
- `scripts/memoria-precision.ts` (read-only, SA) + `npm run memoria:precision`: tasa de
  aceptación por `tipo` y por mes, y top 10 campos/llaves más corregidos. Sin acción automática
  en v1 (spec: primero acumular).

---

## C5 — Validación, docs y despliegue

### T5.1 · Criterios de éxito (re-basados a v1 = órdenes + cotizaciones)

| # | Criterio | Cómo se mide |
|---|---|---|
| 1 | Contexto correcto: las 20 llaves repetidas de T0.1 → el chip muestra la compra previa correcta en ≥ 16; y para los 20 sin empate exacto se reporta cuántas repeticiones reales encontró el semántico | test con el golden + revisión manual en dev |
| 2 | Cero alertas "caro" contra una pieza con número de parte distinto | test de C2 sobre el golden |
| 3 | 10 búsquedas de cotizaciones → esperado en top 3 en ≥ 8 | `validar-busquedas-prueba.ts` en prod tras C1 |
| 4 | ~~Sin full scans en requisiciones~~ — **N/A v1** (requisiciones fuera); sustituto: Cmd+K y la memoria comparten la caché (T2.1) → ≤ 1 lectura del índice por 5 min por instancia | test de T2.1 |
| 5 | ~~`proveedor_recomendado` al 100 %~~ — sustituto: toda alerta `caro` mostrada y todo campo sugerido dejan doc en `memoria_correcciones` al guardar | test de T4.3 + `memoria:precision` en dev |
| 6 | Degradación limpia: con la ruta caída, guardar en `/nueva-compra` funciona y el chip dice "Sin historial disponible" | E2E T3.5 |
| 7 | Usuario sin `cotizaciones` nunca recibe entradas `cotizacion` | tests de ruta (T1.3, T2.4) |
| 8 | Costo mensual estimado, documentado y aprobado en el checkpoint de C0 | T0.2 |

### T5.2 · Gates completos
`npx tsc --noEmit` · `npm run lint` · `npm test` · `cd functions && npm run build` ·
`npm run build` · emulator `npm run test:emulator` · `npm run test:e2e` (money-path).

### T5.3 · Documentación viva
`AGENTS.md`: bullet *Memoria operativa* — qué guarda cada una de las **cuatro** memorias
(`sat_asignaciones` = clave SAT validada, `clasificacion_ia_mapeos` = familia, `evaluaciones_proveedores`
= scorecard manual, `memoria_correcciones` = log de aceptación/corrección de sugerencias), la
regla "semántico propone, llave exacta confirma, alerta solo sobre exactos", caché del índice y
umbral calibrado. `CLAUDE.md`: ruta nueva en la lista de API, `/nueva-compra` y `/cotizaciones`
mencionan el chip, colección nueva en rules.

### T5.4 · Deploy
C1: Functions `syncBusquedaIndice*` + hosting + reindex prod (ya en T1.5). C2–C4: `firestore:rules`
+ hosting (sin Functions). Después del deploy final: diagnóstico (sección H con `cotizacion`),
`memoria:precision` vacío pero funcional, y una captura real en prod con chip visible.

---

## Orden de ejecución

**C0 → C1 → C2 → C3 → C4 → C5.** C0 es una tarde de scripts y una conversación; C1 se despliega
solo y ya da valor (Cmd+K con cotizaciones); C2 es el corazón y va con sus tests puros antes de
la ruta; C3 es donde se ve; C4 es barato una vez que C3 sabe qué mostró. Cada fase con rama, PR y
gates, como B3.

## Riesgos específicos de este plan

- **El umbral de T0.1 sale mal calibrado** por muestra chica (40 ítems). Mitigación: el chip
  limita a 3 semánticos y nunca alerta sobre ellos; ajustar el umbral es cambiar una constante.
- **El índice crece con cotizaciones nuevas** más rápido de lo previsto. Mitigación: la caché de
  T2.1 amortiza lecturas; el corte de 1,500 se vigila con el diagnóstico (sección H).
- **`descripcion` de cotizaciones CSV pobre** ("tornillo", "placa"). Se indexa pero empata mal:
  aceptado; el 69 % sin número de parte es un límite de los datos, no del sistema.
- **Latencia del lote en nueva-compra** (20 ítems → 1 embedding + índice cacheado ≈ 1–2 s).
  Timeout 8 s y el chip nunca bloquea guardar.
