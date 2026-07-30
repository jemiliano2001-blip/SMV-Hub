# Sugerencias SAT híbridas: candidatos correctos + alternativas visibles

Fecha: 2026-07-30

## Problema

Las sugerencias de clave SAT en SMV Hub fallan en casos simples que Google resuelve bien
(ej. “resorte(s) de compresión” → clave correcta **31161904** “Resortes de compresión”).

Diagnóstico validado con el usuario:

- El dolor es en **todos** los puntos de entrada (`/ordenes`, `/reportes/contable`, `/claves-sat`).
- UX deseada: **híbrida** — una sugerencia principal + 2–3 alternativas visibles.
- Fallo real: la clave correcta **a menudo ni entra al set de candidatos** (no es solo ranking).
  Gemini no puede inventar claves; solo elige entre candidatos del catálogo local.

Causas típicas en el código actual:

- Colisiones de score con entradas que comparten “resorte” pero no son el producto
  (ej. máquinas de forjado `23251710`, testers `25191816`).
- Modificadores en español (“compresión”) que se pierden o no pesan lo suficiente.
- Mapeos SMV fuertes en inglés (`spring` + `compression`) pero débiles en español
  (`resorte` / `resortes` + `compresion`).
- Alternativas a veces vacías o colapsadas en UI, aunque el ranking local las tuviera.

## Objetivo

Para descripciones claras de productos SMV:

1. La clave correcta del catálogo **siempre entra** al top-N de candidatos.
2. Sale como **sugerencia principal** cuando el match es claro; si no, el usuario ve
   **hasta 3 alternativas** y elige.
3. El mismo comportamiento en `/ordenes`, `/reportes/contable` y `/claves-sat`
   (buscador = mismo motor de ranking).

Caso ancla de aceptación:  
`resorte de compresión` | `resortes de compresión` | `Compression Spring` → principal **31161904**.

## Enfoque elegido

**Buscador local endurecido (núcleo) + familias SMV curadas (refuerzo).**

No embeddings en esta iteración.

## Arquitectura

```text
descripcion
  ├─► mapeos SMV / glosario familias  ──┐
  └─► buscarClavesSat (score + tipo)  ──┼─► top-N candidatos
                                         ├─► sugerencia principal
                                         ├─► alternativas[0..2] (siempre)
                                         └─► Gemini solo si no hay match claro
                                             (elige dentro del mismo top-N)
```

### Reglas duras

1. El LLM **nunca inventa** claves; solo elige entre candidatos del `catalogo.json`.
2. Match casi exacto de frase/tipo de producto en el catálogo → esa clave **debe**
   estar en el top-N aunque el filtro de división o Gemini no corran.
3. Respuesta de sugerencia siempre incluye `clave?` + `alternativas` (hasta 3) del
   mismo ranking local.
4. Familias frecuentes del taller se refuerzan con mapeos/glosario; no inventar
   mapeos sin clave validada del catálogo.

## Cambios por capa

### 1. Motor de búsqueda — `lib/sat/buscar.ts`

- **Tipo de producto:** si la query trae un tipo (resorte, tornillo, inserto, broca…),
  penalizar entradas cuyo tipo de catálogo sea otro (máquina, tester, forjado, etc.).
- **Frase completa:** boost alto cuando la descripción del catálogo contiene la
  búsqueda completa (con stemming singular/plural ya existente).
- **Modificadores ES:** `compresion`, `extension`, `traccion` (y acentos normalizados)
  cuentan como tokens específicos, no se descartan.
- **Inyección de candidatos garantizados:** al armar top-N, incluir matches de frase
  casi exacta aunque el filtro de división (taller `23/27/31`) los hubiera dejado fuera.

### 2. Familias SMV — `data/sat/mapeos-smv.json` + `lib/sat/glosario-industrial.ts`

- Resortes: compresión → `31161904`; extensión y otras variantes solo con clave
  de catálogo confirmada.
- Ampliar tokens ES (`resorte`, `resortes`, `compresion`, …) además del mapeo EN
  ya existente (`spring` + `compression`).
- Otras familias del taller (insertos, brocas, etc.) solo si ya hay clave validada;
  no rellenar a ciegas.

### 3. Pipeline de sugerencia — `lib/sat/sugerir-clave.ts`

- Siempre poblar `alternativas[0..2]` desde el ranking local (aunque la fuente sea
  historial, mapeo, glosario o IA).
- Gemini (`traducirYElegirClaveSat`) solo si no hay `esResultadoClaro`.
- Si Gemini falla o no corre: devolver ranking local (posible `clave` vacía +
  alternativas) — nunca pantallazo vacío por fallo de IA.

### 4. UI híbrida

- **`/ordenes` (`ModalSugerirClavesSat`):** mostrar principal + hasta 3 alternativas
  visibles (sin depender de que el usuario “abra” el panel). Click en alternativa =
  adoptar esa clave (`fuente: manual`).
- **`/reportes/contable`:** misma semántica en re-sugerencia por línea / lote.
- **`/claves-sat`:** mismo motor; “resorte de compresión” debe listar `31161904`
  primero. (El falso “pending-import” por API 500 es un bug de deploy aparte.)

### 5. Aprendizaje

Sin cambio de modelo: al validar una clave, seguir persistiendo en `sat_asignaciones`
para que historial/mapeos mejoren en corridas siguientes.

## APIs

Sin contrato nuevo obligatorio. `POST /api/sugerir-clave-sat` ya devuelve
`alternativas`; se garantiza que vengan pobladas cuando el buscador tenga hits.
`GET /api/claves-sat` sigue siendo ranking puro del mismo `buscarClavesSat`.

## Pruebas

- `tests/sat-buscar.test.ts`: singular/plural/EN de resortes; ruido
  (`23251710`, `25191816`) no desplaza a `31161904` del top.
- `tests/sat-sugerir-clave.test.ts`: principal `31161904` + alternativas no vacías.
- Fixture SMV: exigir clave exacta `31161904` para compression spring (no solo
  patrón/fuente).
- Smoke manual: `/claves-sat` + sugerir en una orden de prueba.

## Fuera de alcance

- Embeddings / buscador semántico.
- Auto-sugerencia en `/nueva-compra` (sigue fuera, como en el spec 2026-07-06).
- Redeploy Hosting Turbopack / fix del 500 de `/api/claves-sat` (trabajo paralelo).
- Rediseño visual grande del modal (solo hacer visibles las alternativas).

## Criterios de éxito

1. Queries ancla de resortes → principal `31161904` en buscador y en sugerir.
2. En `/ordenes` y contable, el usuario siempre ve hasta 3 alternativas cuando hay hits.
3. Si Gemini cae, el ranking local sigue usable.
4. Tests de resortes verdes en CI.
