# Plan — Estructura y normalización de datos (frente B)

Spec: [../specs/2026-09-13-estructura-datos-normalizacion-design.md](../specs/2026-09-13-estructura-datos-normalizacion-design.md)
Estado: **B0 (calibración read-only) ejecutada el 2026-09-13** — resultados abajo. Decisiones de
Emiliano ya tomadas (2026-09-13): marketplaces como proveedores con `esMarketplace`; semanas ×5
días hábiles; quien tenga módulo `proveedores` da de alta desde captura; sin segunda pasada IA en v1.
Quedan 3 preguntas nuevas que salieron de B0 (al final). Nada de B1–B4 toca producción hasta
que se respondan.

Regla para todas las tareas: `npx tsc --noEmit`, `npm run lint`, `npm test` en verde antes de
cerrar cada una; `npm run test:rules` cuando se toquen rules; `cd functions && npm run build`
cuando se toque `functions/`. Deploy de Functions **solo** con targets del codebase `smv-hub`
(`scripts/firebase-deploy-targets.mjs`), nunca `--only functions --force`.

---

## B0 — Calibración read-only — ✅ HECHO (2026-09-13)

Script: `scripts/calibracion-frente-b.ts` (solo lectura, mismo patrón que `diagnostico-datos.ts`).
Corrido dos veces: la primera reveló casos que el spec no contemplaba; la segunda ya con las reglas
ajustadas. Lo que sigue son los números finales.

### B0.1 · Mapeos aprobados vs ítems Odoo → regla elegida: **D**

338 mapeos aprobados (35 de menos de 12 caracteres, casi todos SKUs) contra 2,325 ítems; 978 en
`otros` hoy (42 %).

| Regla | Empata | vía "incluye" | `otros` resueltos | `otros` después | Veredicto |
|---|---|---|---|---|---|
| A · solo exacta | 522 (22 %) | 0 | 372 | 606 (26 %) | Segura, pierde SKUs con texto extra |
| B · cliente actual (incluye > 5 chars) | 584 (25 %) | 62 | 392 | 586 (25 %) | Acepta palabras genéricas ("Extensión", "Balero", "Cadena") |
| C · propuesta del spec (≥ 12 chars, ≥ 60 % cobertura) | 530 (23 %) | 8 | 375 | 603 (26 %) | Rechaza SKUs correctos como `CDQ2B12-10DZ` |
| **D · ítem ⊇ mapeo con límite de palabra; mapeo ≥ 12 chars o con dígitos; nunca al revés; sin mapeos → `otros`** | **570 (25 %)** | **48** | **391** | **587 (25 %)** | Las 14 muestras que acepta son correctas (SKU/medida dentro de la descripción); las que rechaza son genéricas o inversas |

Conflictos B vs D (eligen mapeo distinto): 2. **Decisión: el sync aplica la regla D.** Solo con eso,
`otros` baja de 42 % a 25 % — cumple el criterio #4 del spec sin IA. Los 35 mapeos que apuntan a
`otros` no se autoaplican (no aportan; solo fijarían `otros`).

### B0.2 · Fantasmas de proveedor — la mitad se arregla corriendo lo que ya existe

**Órdenes: 132 sin `proveedorId`, 29 nombres distintos.** Por acción:

| Acción | Docs | Nombres |
|---|---|---|
| vincular exacto (ya está en catálogo con ese nombre) | 48 | McMaster-Carr 42, Mouser Electronics 6 |
| alta como marketplace | 43 | EBAY 31, Amazon 10, ALI EXPRESS 2 |
| alta nuevo | 40 | MSC Industrial Supply 6, DigiKey Electronics 5 + DigiKey 2, Home Depot 3 + The Home Depot 1, PTSOLUTIONS 3, AutomationDirect 2 + .com Inc 1, Tool Balancers USA 2, MRO Supply 2, y 15 de 1 orden |
| sugerir (revisar) | 1 | Mouser → MOUSER ELECTRONICS. |

**Hallazgo:** McMaster-Carr tiene **42 órdenes sin FK aunque el nombre empata exacto** con el
catálogo. Nadie corrió nunca `aplicarAutomaticas` de `/api/proveedores/vinculacion`. Solo eso
vincula 48 órdenes y 143 cotizaciones.

Proyección tras B1: 132 − 48 − 43 − 27 (altas de ≥ 2 órdenes) ≈ **14 sin FK (10 %)** → cumple
criterio #1 (≤ 15 %).

**Cotizaciones: 825 sin `proveedorId`, 143 nombres distintos.** Por acción: vincular exacto 143 ·
marketplace 98 (Ebay 56, Amazon 34 + Amazon USA 2, Mercado Libre 4) · sugerir 174 · alta nuevo 410.
Los "sugerir" grandes son proveedores de Odoo escritos corto: Higoh/HIGO 66 → HIGOH DISTRIBUCIONES,
MCMASTER 15 → McMaster-Carr, SISA 15 → SERVICIO INDUSTRIAL S.A DE C.V., Risoul 13, Acomee 8,
Levinson 8, Universal 8, ROSAAN 6, Fierros y T 4. Todos correctos a ojo — son alias.

Variantes del mismo proveedor (confirma la necesidad de alias): Mouser ×4 formas, Newark ×4,
Grainger ×3, DigiKey ×2, McMaster ×2, AutomationDirect ×2, Amazon ×2.

**Nombres que no son proveedores** (probable origen interno del Excel de automatización):
"Almacén Automatización" 26, "Linea" 17, "AUTOMATION" 12. → Pregunta nueva #1.

Proyección tras B1: 825 − 143 − 98 − 174 − ~230 (altas de ≥ 3 filas) ≈ **180 sin FK (22 %)** →
cumple criterio #1 (≤ 40 %).

### B0.3 · `diasHabiles` — 85 % parseable, y un error de datos que no sabíamos

268 valores no nulos, 110 distintos. Con el parser de B3 (semanas ×5, meses ×20, stock = 0):

| Resultado | n | % | Ejemplos |
|---|---|---|---|
| número | 85 | 32 % | "5 dias", "1 dia", "3 dis habiles", "mty 2 días" |
| rango | 100 | 37 % | "3 - 4", "20-30 dias", "7 a 8 dias", "5 - 7 dias h" |
| semanas (×5) | 26 | 10 % | "2 - 3 semanas" → 10–15, "17 semanas" → 85 |
| stock (0) | 16 | 6 % | "Stock local", "entrega inmediata", "In Stock: 24 Can Ship…" |
| **null: moneda** | **26** | **10 %** | "$1,00" ×12, "$5,00", "$88.978,54", "precios 2026" |
| null: fecha | 10 | 4 % | "18 diciembre - 5 enero", "Tue, Aug 25 - Fri, Aug 28", "mayo 2" |
| null: sin número | 5 | 2 % | "pte", "N/A", "No tienen" |

Guardas que el spec no tenía y el parser ya incluye: moneda → null; nombres de mes/día → null
(convertir fecha a días necesita la fecha de la cotización: v2); > 365 días → null; "10 piezas
disponibles" y "In Stock: 24" → stock (el número es cantidad, no días); "5 - 7 dias h" → rango (la
"h" es hábiles, no horas). Pendiente para B3: "Sin stock" / "Out of Stock" hoy caen en stock = 0 y
deben ser null.

**Error de datos:** 26 cotizaciones traen **dinero** en `diasHabiles` ("$1,00" ×12, "$5,00"…).
Huele a columnas corridas en un import CSV — y si la columna de días trae el precio, el precio
puede traer otra cosa. → Pregunta nueva #3 y tarea T3.0.

Criterio #5 del spec se ajusta con estos datos: **≥ 80 % parseadas y 100 % con razón explícita
cuando no** (era "≥ 90 %": el 15 % restante son datos malos, no fallas del parser).

### B0.4 · `mercado` — 4 filas a confirmar, el resto es mecánico

104 proveedores · 101 sin `mercado` · 91 con `odooPartnerId` · 13 sin.

- **13 sin Odoo → `usa`**: Travers, Shars, Garr, OnlineCarbide, YG-1, KBC, MSC Industrial Direct,
  Kennametal, CET, Harvey, McMaster (único con `mercado` ya), Discount Tooling, Iscar USA. Todos
  USA tooling. Correcto.
- **87 con Odoo y MXN → `mexico`**. Correcto.
- **4 con Odoo y USD** (la regla los marca `mexico`; país dice "Estados Unidos"): HIGOH
  DISTRIBUCIONES (66 cotizaciones lo nombran), SERVICIOS ESPECIALIZADOS DE MONTERREY, Vexin global
  supply S.A. de C.V., MC MACHINERY SYSTEMS DE MEXICO. → Pregunta nueva #2.

---

## B1 — Alias, captura y UI de vinculación

### T1.1 · Schema y rules — ✅ HECHO (2026-09-13)
- `lib/schemas.ts` → `ProveedorSchema`: `aliases: z.array(z.string().trim().min(1).max(80)).max(20).default([])`,
  `esMarketplace: z.boolean().default(false)`.
- `lib/proveedores.ts`: mapear ambos campos al leer (`aliases` default `[]`, `esMarketplace` default
  `false`) y aceptarlos en `crearProveedor` / `actualizarProveedor`.
- `firestore.rules` → `match /proveedores/{id}`: en create/update, si vienen, `aliases` es lista de
  ≤ 20 strings y `esMarketplace` es bool. Test en `tests/firestore-rules*.test.ts` (emulator).
- `app/proveedores/` formulario de proveedor: campo aliases (chips) y toggle marketplace.

### T1.2 · Matcher con alias — ✅ HECHO (2026-09-13)
- `lib/pieza-matching.ts` → `matchProveedorPorNombre`: el nivel exacto compara también contra cada
  alias normalizado. Nuevo `resolverProveedor(nombre, catalogo): { proveedor, nivel: "exacto" | "sugerido" } | null`
  que expone el nivel (exacto → aplica solo; sugerido → pregunta). Si hay > 1 exacto (alias
  duplicado entre proveedores) → `sugerido`, nunca `exacto`.
- Test `tests/pieza-matching.test.ts`: los 10 nombres literales de facturas de B0.2 (McMaster-Carr,
  EBAY, Amazon, Mouser Electronics, MSC Industrial Supply, DigiKey Electronics, Home Depot,
  PTSOLUTIONS, ALI EXPRESS, DigiKey) contra un catálogo fixture con alias → ≥ 9/10 exacto o
  sugerido correcto (criterio #2).

### T1.3 · Vinculación histórica: sugerencias y aprendizaje de alias — ✅ HECHO (2026-09-13)
- `lib/proveedores-vinculacion-core.ts`: `proveedorExacto()` también empata por alias;
  `agregarFantasma()` recibe `sugerenciaCatalogo` de `matchProveedorPorNombre` en vez de `null`.
- `app/api/proveedores/vinculacion/route.ts`: `vincularManual` acepta `guardarAlias: boolean` y, si
  va, hace `arrayUnion(nombreLibre)` en `proveedores/{id}.aliases` (Admin SDK). Nueva acción
  `altaYVincular` (crea proveedor con `{nombre, mercado, esMarketplace, aliases:[nombreLibre]}` y
  vincula los `idsDocs`), super-admin, auditada.
- Tests: `tests/usa-tooling-vinculacion.test.ts` (alias en core) y
  `tests/proveedores-vinculacion-route.test.ts` (dos acciones nuevas).

### T1.4 · Captura en `/nueva-compra` — ✅ HECHO (2026-09-13)
- `app/nueva-compra/NuevaCompraForm.tsx:258`: `proveedorId` sale de `resolverProveedor`, no de
  `find(p.nombre === nombre)`.
- Componente nuevo `components/proveedores/ChipProveedorVinculado.tsx` con tres estados:
  *Vinculado a X* (+ cambiar) · *¿Es X?* (sí / no, es otro) · *Proveedor nuevo* (+ dar de alta).
  "Sí" guarda alias vía `actualizarProveedor` solo si el usuario tiene módulo `proveedores`
  (`tieneModulo`); si no, vincula sin aprender. "Dar de alta" abre modal mínimo (nombre, `mercado`
  prellenado por moneda, `esMarketplace`) → `crearProveedor` → vincula. Sin módulo `proveedores`:
  el chip solo informa.
- Tokens semánticos y primitivas `components/ui` (`smv-ui-consistencia`).

### T1.5 · Captura en `/cotizaciones` — ✅ HECHO (2026-09-13)
- `CotizacionFormModal.tsx:57` y `CotizacionIaModal.tsx`: mismo `resolverProveedor` + mismo chip.

### T1.6 · Panel de vinculación histórica (super-admin) — ✅ HECHO (2026-09-13)
- `app/proveedores/PanelVinculacionHistorica.tsx`: *Analizar* → resumen (revisados / ya tenían /
  exactos / fantasmas) + tabla de fantasmas (nombre, # docs, sugerencia, acciones: *vincular a
  sugerido*, *elegir otro*, *alta nuevo*, *alta marketplace*). *Aplicar automáticas* → confirm.
  Usa `lib/proveedores-vinculacion.ts` (ya existe) + las acciones nuevas de T1.3. Solo visible con
  `esSuperAdmin`.

### T1.7 · Ejecutar en producción (Emiliano, desde el panel) — ✅ HECHO (2026-09-14)
1. Analizar → Aplicar automáticas (48 órdenes + 143 cotizaciones, McMaster y Mouser).
2. Altas marketplace: eBay, Amazon, AliExpress, Mercado Libre → vincula 43 órdenes + 98 cotizaciones.
3. Altas nuevas de ≥ 2 docs: MSC Industrial Supply → *vincular a MSC Industrial Direct* con alias
   (no alta); DigiKey, Home Depot, PTSolutions, AutomationDirect, Tool Balancers, MRO Supply,
   Novotechnik, Online Carbide, Keyence USA, SMC, Calvek, FYT, Kilowatito, Valley Supply…
4. Sugeridos: confirmar Higoh, SISA, Risoul, Acomee, Levinson, Universal, ROSAAN, Fierros y T.
5. `npx tsx scripts/diagnostico-datos.ts smv-brain` → criterio #1.

**Estado B1 al 2026-09-14:** código en rama `frente-b/b1-alias-captura` (3 commits). Gates
verdes: `tsc`, `lint`, `npm test` (1,280; `tests/sat-buscar.test.ts` es flaky por timeout bajo
carga — tarea aparte), `npm run build`, rules en emulator (24/24). **Pase de navegador real**
en local contra `smv-brain-dev` con la cuenta break-glass de Emiliano (hubo que habilitar Google
como proveedor de Auth en el proyecto dev):
- `/nueva-compra`: "mcmaster carr" → *Vinculado a McMaster-Carr* (exacto por normalización);
  "MSC Industrial Supply" → *¿Es MSC Industrial Direct?* → Sí → alias persistido → tras recargar
  vincula solo; "EBAY" → *No está en el catálogo* → Dar de alta (mercado USA y marketplace
  prellenados) → *Vinculado a eBay · marketplace*.
- `/cotizaciones` (Añadir manual): "Shars" → *¿Es Shars Tool Company?*.
- `/proveedores`: tab *Vinculación histórica* visible para super-admin; *Analizar* falla limpio en
  local (la ruta necesita Admin SDK, que no hay en dev) — se prueba en producción en T1.7.

Ajuste al matcher que salió del pase: `resolverProveedor` ganó un cuarto nivel, **tokens
distintivos compartidos** (solo sugerencia), porque "MSC Industrial Supply" vs "MSC Industrial
Direct" no lo detectan ni empieza-con ni incluye. Las palabras genéricas (industrial, supply,
tools, aceros, s.a. de c.v., usa, mexico…) no cuentan, para no sugerir "Aceros Fortuna" por
"Aceros Levinson". Con esto la cifra de "sugerir" de B0.2 sube (MSC, DigiKey Electronics, etc.).

Hallazgo colateral: con la cuenta break-glass sin doc en `usuarios` de dev, el listener de
notificaciones del NavBar reintenta con `permission-denied` en bucle (59 errores de consola en
minutos). No es de este frente; queda anotado.

---

## B2 — El sync de Odoo aplica las clasificaciones aprobadas

Va **primero** en ejecución: es un bug real, está aislado en `functions/` y no depende de B1.

### T2.1 · Helpers portados a Functions — ✅ HECHO (2026-09-13)
- `functions/src/compras-odoo/mapeos-aprobados.ts`: `normalizarDescripcionMapeo` (copia literal de
  `lib/compras-odoo/mapeos-clasificacion.ts`) y `buscarMapeoAprobadoSync(norm, mapeos)` con la
  **regla D** de B0.1: exacto; si no, ítem ⊇ mapeo con límite de palabra, mapeo ≥ 12 chars o con
  dígito, mapeo.length ≥ 5, y `categoriaId !== "otros"`.
- `tests/mapeos-aprobados-sync.test.ts` (Vitest de la raíz importa `functions/src/` directo — ya
  hay precedente): paridad de `normalizarDescripcionMapeo` entre `lib/` y `functions/`, y las 14
  muestras aceptadas + 14 rechazadas de B0.1 como fixture.

### T2.2 · Aplicar en el sync — ✅ HECHO (2026-09-13)
- `functions/src/odoo-compras-sync.ts`: al inicio de la corrida, leer `clasificacion_ia_mapeos`
  una vez (338 docs) → `Mapeo[]` en memoria. `construirItemDesdeLinea(linea, { mapeosAprobados })`:
  si hay match → `categoriaId`, `tipoInsumo`, `medida` del mapeo y `clasificadoPorMapeo: true`;
  si no → heurística como hoy y `clasificadoPorMapeo: false`.
- `functions/src/compras-odoo/construir-item.ts`: parámetro opcional; sin mapeos se comporta igual
  (compatibilidad con tests existentes).

### T2.3 · Test de integración con emulator — ✅ HECHO (2026-09-13)
- `tests/odoo-compras-sync-mapeos.emulator.test.ts` (corre bajo `npm run test:emulator`): 5 mapeos
  + 20 líneas → tras `escribirLotes`, los 5 ítems con mapeo llevan la categoría aprobada y los 15
  restantes la heurística. Criterio #3.

### T2.4 · Cliente — ✅ HECHO (2026-09-13)
- `lib/compras-odoo-store.ts`: nada que cambiar (lee el doc). `PanelClasificacionIA.tsx`: badge
  "por mapeo" cuando `clasificadoPorMapeo`; `aplicarMapeosAprobados` queda como vista previa.

### T2.5 · Deploy y verificación — ✅ HECHO (deploy 2026-09-13, verificado 2026-09-14)
```bash
cd functions && npm run build && cd ..
firebase deploy --only "functions:smv-hub:syncOdooComprasScheduled,functions:smv-hub:syncOdooComprasManual" --project smv-brain
```
Disparar `syncOdooComprasManual` (super-admin) → `npx tsx scripts/diagnostico-datos.ts smv-brain`
→ `otros` ≤ 25 % (proyección B0.1: 587 / 2,325 = 25 %). Criterio #4.

**Estado B2 al 2026-09-13:** código en rama `frente-b/b2-sync-mapeos` (commit abajo). Gates verdes:
`tsc`, `lint`, `npm test` (1,246), `functions build`, `npm run build`, y el test de emulator
(3/3, corrido localmente con el JDK de Android Studio: `JAVA_HOME` no está configurado en la
máquina, hay que exportar `PATH="/c/Program Files/Android/Android Studio/jbr/bin:$PATH"` antes
de `emulators:exec`). Detalles de implementación que difieren del plan original:
- El loader `cargarMapeosAprobados(firestore)` vive en `compras-odoo/mapeos-aprobados.ts` (no
  en el sync) para que el test de emulator no importe el módulo del sync (inicializa Admin al
  cargar) y para que la futura ruta de memoria operativa lo reutilice desde `lib/`.
- `construir-item.ts` y `mapeos-aprobados.ts` son copias byte a byte entre `lib/` y
  `functions/src/`; `tests/mapeos-aprobados-sync.test.ts` lo verifica.
- Un ítem con mapeo queda `clasificadoPorIa: true` además de `clasificadoPorMapeo: true` —
  mismo estado que deja `aprobarYGuardarClasificacion` en el cliente, para que el panel no lo
  trate como "sin clasificar".
- `llaveItem` se calcula sobre la clasificación final (tipo/medida del mapeo), no sobre la
  heurística, para que el comparador agrupe igual que lo que el equipo aprobó.

---

## Resultados B1 + B2 en producción — antes / después (2026-09-14)

`npx tsx scripts/diagnostico-datos.ts smv-brain` el 2026-09-13 (antes) y el 2026-09-14 tras el
deploy de B1/B2 y la corrida de T1.7 por Emiliano desde `/proveedores`:

| Métrica | Antes | Después | Criterio | |
|---|---|---|---|---|
| Órdenes sin `proveedorId` | 132 (93 %) | **20 (14 %)** | ≤ 15 % | ✅ |
| Cotizaciones sin `proveedorId` | 825 (97 %) | **233 (27 %)** — 54 son internos que se dejan así → 21 % efectivo | ≤ 40 % | ✅ |
| Proveedores en catálogo | 104 | 110 (altas desde el panel: marketplaces y USA faltantes) | — | |
| Ítems Odoo en `otros` | 978 (42 %) | **614 (26 %)** | ≤ 25 % | ≈ (1 pt arriba; proyección B0 era 25 %) |
| Ítems Odoo sin tipo de insumo | 978 (42 %) | 469 (20 %) | — | |
| Fantasmas restantes en órdenes | 26 nombres | 15 nombres, todos de 1–2 órdenes | — | |

Lo que queda sin FK en órdenes son proveedores de una sola compra (Tool Balancers, MRO Supply,
PCS Company, Changzhou…): se vinculan solos la próxima vez que se capture algo de ellos y alguien
los dé de alta desde el chip. En cotizaciones, los 90 fantasmas restantes son en su mayoría de
1–3 filas; los internos (Almacén Automatización 25, Linea 17, AUTOMATION 12) quedan sin
vincular por decisión.

`otros` quedó en 26 % con la regla D tal cual; el punto que falta al criterio no justifica
relajar la regla (los falsos positivos costarían más). Si se quiere bajar más, es la segunda
pasada IA (fuera de v1 por decisión) o seguir aprobando mapeos en el panel — cada aprobación
ahora sí sobrevive al sync.

Deploy: B2 Functions a mano (2026-09-13); B1 rules + storage y hosting a mano (2026-09-14). CI
validó todo pero su paso de deploy falló por falta de `secretmanager.versions.get` en la cuenta
de servicio de CI (brecha preexistente; pendiente de Emiliano dar rol *Secret Manager Secret
Accessor* en `smv-brain`). CI nunca despliega hosting: siempre `npm run deploy:hosting`.

## B3 — Lead time numérico

### T3.0 · Revisar las 26 cotizaciones con dinero en `diasHabiles` (read-only)
Script desechable: para esas 26, imprimir `precioUnitario`, `total`, `cantidad` y `diasHabiles`
lado a lado, y detectar si el precio también está corrido (ej. `precioUnitario` = cantidad, o
`total` = precio). Resultado a Emiliano antes de cualquier backfill. Si están corridas, la
corrección es manual en `/cotizaciones` (son 26) — no un script.

### T3.1 · Parser puro
- `lib/lead-time.ts` → `parsearDiasHabiles(texto): { min, max, tipo } | { descarte }` portado del
  script de B0 más: "sin stock" / "out of stock" / "no hay" → `descarte: "sin_stock"` (hoy caen en 0).
- `tests/lead-time.test.ts`: los **110 valores distintos** de B0.3 como fixture con su resultado
  esperado (es la tabla completa de la calibración; el test fija el comportamiento real, no casos
  inventados).

### T3.2 · Schema y puntos de escritura
- `CotizacionSchema`: `leadTimeMinDias`, `leadTimeMaxDias` (`z.number().int().min(0).nullable().default(null)`).
- `lib/cotizaciones.ts` (crear / actualizar): calcular desde `diasHabiles` al guardar.
- `lib/cotizaciones-importar.ts` (CSV) y `lib/cotizaciones-extraer-ia.ts` (IA): idem.
  `lib/cotizaciones-desde-ordenes.ts`: quedan null.
- Rules: enteros ≥ 0 o null; `min ≤ max`. Test de rules.

### T3.3 · UI
- `CotizacionFormModal.tsx:191`: junto al input, interpretación en vivo ("→ 10–15 días hábiles" /
  "no se entiende, escribe un número"). No bloquea guardar.

### T3.4 · Consumidores
- `lib/proveedores-inteligencia-cruzada.ts` → `ofertasDesdeHistorico`: `leadTimeDias =
  c.leadTimeMaxDias ?? match?.leadTimeDias ?? null`; eliminar `parseLeadTimeTexto`. El recomendador
  ya excluye `leadTimeDias <= 0`; ajustar para excluir `null` explícitamente y test en
  `tests/motor-recomendador-proveedores.test.ts`.

### T3.5 · Backfill (acción super-admin)
- `app/api/cotizaciones/backfill-lead-time/route.ts`: `{ accion: "previsualizar" | "aplicar" }`.
  Previsualizar devuelve la tabla (valor → parseo) sin escribir; aplicar escribe `leadTimeMin/Max`
  en las 268 con `diasHabiles`, batch de 100, auditado. Botón en `/cotizaciones` visible solo
  super-admin.

### T3.6 · Verificación
`diagnostico-datos.ts` (agregar conteo de `leadTimeMinDias` no nulos) → ≥ 80 % de las 268.
Criterio #5.

---

## B4 — `mercado` persistido

### T4.1 · Backfill (acción super-admin)
- `app/api/proveedores/backfill-mercado/route.ts`: previsualizar → lista (nombre, regla aplicada,
  valor propuesto); aplicar → `mercado` según regla (`odooPartnerId` → mexico, si no usa) y
  `origenProveedor: "odoo"` a los 89 con Odoo sin origen. Las 4 filas Odoo+USD toman el valor que
  Emiliano decida en la pregunta #2 (override explícito en la previsualización).

### T4.2 · Sync Odoo
- `odoo-compras-sync.ts:353` (upsert de existentes): `...(existente.data().mercado ? {} : { mercado: "mexico" })`,
  `...(existente.data().origenProveedor ? {} : { origenProveedor: "odoo" })`. Test unitario del mapeo.

### T4.3 · Indexador
- `functions/src/busqueda-indice-escritura.ts:51` → `proveedorDesdeDoc`: mismo default que
  `lib/proveedores.ts` como defensa. Tras el backfill, `syncBusquedaIndiceManual` (super-admin):
  cambia metadata, no `textoHash` → **no re-embebe** nada.

### T4.4 · Verificación
`diagnostico-datos.ts` → `sin campo mercado` = 0; `busqueda_indice` con `mercado` en 104/104.
Criterio #6.

---

## B5 — Validación y cierre

### T5.1 · Antes / después
Correr `diagnostico-datos.ts` y pegar en este plan la tabla con los 7 criterios del spec.

### T5.2 · Gates completos
`npx tsc --noEmit` · `npm run lint` · `npm test` · `cd functions && npm run build` ·
`npm run build` · `npx firebase-tools emulators:exec --only firestore "npm run test:emulator"`.

### T5.3 · Documentación viva
`AGENTS.md` (Learned Workspace Facts): alias se aprenden del uso; el sync aplica
`clasificacion_ia_mapeos` con regla D; `leadTimeMin/MaxDias` derivados; `mercado` persistido;
backfills son acciones super-admin; `scripts/diagnostico-datos.ts` y `calibracion-frente-b.ts`
son read-only y requieren `.env.admin.local`. `CLAUDE.md`: una línea en `/proveedores` y
`/cotizaciones`.

### T5.4 · Commits
Uno por fase (B0 ya: specs + scripts; luego B2, B1, B4, B3, B5). Nada se despliega antes de su
verificación.

---

## Orden de ejecución sugerido

**B2 → B1 → B4 → B3 → B5.** B2 primero porque es un bug aislado en Functions con el mayor impacto
por hora invertida (42 % → 25 % de `otros` sin tocar UI). B1 es el más visible y el más grande. B4
es mecánico. B3 al final porque T3.0 puede abrir una corrección manual de datos que no conviene
mezclar con el resto.

Estimación honesta: B2 ~1 día · B1 ~2–3 días · B4 ~½ día · B3 ~1–2 días · B5 ~½ día. Una semana
de trabajo acotado, como decía el spec.

## Preguntas nuevas de B0 — todas resueltas (Emiliano, 2026-09-13)

1. ~~"Almacén Automatización" (26), "Linea" (17), "AUTOMATION" (12)~~ **Resuelto:** no son
   proveedores; quedan sin vincular y se excluyen de la lista de fantasmas con una lista corta
   `NOMBRES_INTERNOS_IGNORADOS` en `lib/proveedores-vinculacion-core.ts` (T1.3).
2. ~~Los 4 proveedores de Odoo que facturan en USD~~ **Resuelto:** `mexico` los cuatro (T4.1 sin
   override).
3. ~~Las 26 cotizaciones con dinero en `diasHabiles`~~ **Resuelto:** sí, T3.0 se corre antes del
   backfill de lead time.

Con esto, B1–B4 quedan sin bloqueos. Orden de ejecución confirmado: **B2 → B1 → B4 → B3 → B5**.
