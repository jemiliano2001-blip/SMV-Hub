# Auditoría de código SMV Hub — 2026-08-24

Barrido completo del repo (~20 módulos, 133 componentes, 159 archivos en `lib/`,
25 Route Handlers, Cloud Functions y reglas Firestore/Storage) con un swarm de
7 grupos en paralelo, más revisión directa del trabajo sin commitear.

## Línea base

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npm run lint` | limpio |
| `npm test` | 1048 pasan, 28 skip (emulator), 0 fallan |
| `any` / `@ts-ignore` en producción | 1 (con `eslint-disable` justificado) |
| `catch {}` vacíos | 0 |

Nada de lo que sigue lo detecta el compilador, el linter ni la suite. Son huecos
funcionales, de datos y de permisos.

---

## Prioridad 1 — severidad alta + confianza alta

### 1. El sync de compras Odoo puede borrar `compras_odoo_items` completa

`functions/src/odoo-compras-sync.ts:572-577`

El guard "Odoo devolvió 0, no podes" está **invertido** en la tercera poda:

```js
items.length === 0 && (posRaw.length > 0 || billsRaw.length > 0) ? false : items.length === 0
```

Tabla de verdad verificada:

| items | POs | facturas | `vacioDesdeOdoo` | efecto |
|---|---|---|---|---|
| 0 | 0 | 0 | `true` | omite prune (correcto, caso inofensivo) |
| 0 | 50 | 0 | `false` | **borra toda la colección** |
| 0 | 0 | 30 | `false` | **borra toda la colección** |
| 0 | 50 | 30 | `false` | **borra toda la colección** |

El guard solo protege en el caso que no importa y se desactiva justo en el
peligroso: Odoo devolvió POs/facturas pero la hidratación de líneas
(`lineasPorId` / `invLineasPorId`, líneas 439-477) produjo 0 ítems. Con
`idsActuales = []`, `podarHuerfanos` (línea 249) marca **todo** lo existente como
huérfano y lo borra en lotes. Las otras dos podas de la misma función (líneas
559-571) sí pasan la condición simple y correcta.

**Fix:** `items.length === 0 && posRaw.length === 0 && billsRaw.length === 0`.
Esfuerzo: trivial. Riesgo de no arreglarlo: pérdida de datos en producción.

### 2. Los reportes excluyen facturas del primer día de cada periodo

`lib/reportes.ts:61` (y el mismo parseo en `aplanarLineas`)

`fechaFactura` es un string `YYYY-MM-DD`, y `new Date("2026-08-01")` lo
interpreta como **medianoche UTC**. Los límites del rango (`startOfDay`/`endOfDay`)
se calculan en hora **local**. Reproducido con `TZ=America/Monterrey`:

```
fechaFactura parseada : Fri Jul 31 2026 18:00:00 GMT-0600
inicio de agosto local: Sat Aug 01 2026 00:00:00 GMT-0600
¿entra al reporte?    : false
columna dia mostraria : 31/7/2026
```

Doble efecto: la orden **desaparece** del reporte de agosto (sub-cuenta el total
comprado y los subtotales agrupados), y donde sí aparece, la columna "día" muestra
un día antes del real.

`lib/finanzas.ts:46-54` ya resuelve esto bien comparando strings vía `fechaHoyLocal`.
Mismo repo, dos implementaciones, una mal.

**Fix:** copiar el patrón de `lib/finanzas.ts`. Esfuerzo: pequeño.

### 3. `/ordenes` tiene un segundo camino de creación sin chequeo de duplicados

`app/ordenes/OrdenFormModal.tsx:17,225`

`NuevaCompraForm.tsx` implementa la regla completa: importa
`buscarPorFacturaYProveedor` + `esOrdenDuplicada`, verifica con debounce y bloquea
el submit (líneas 10-11, 195-204, 500, 610-627).

`OrdenFormModal.tsx` — el modal "Añadir nueva orden" de `/ordenes` — importa
únicamente `crearOrden, actualizarOrden` y llama `crearOrden(payload)` directo.
Cero deduplicación. Se puede capturar la misma `numeroFactura` + `proveedor` dos
veces sin ninguna advertencia.

### 4. El arqueo de caja chica muestra $0.00 cuando Firestore falla

`app/caja-chica/ResumenCaja.tsx:70`, `app/caja-chica/ArqueoCaja.tsx:11`

Ambos desestructuran `useCajaChica()` sin tomar `error`. Si la consulta falla,
`loading` pasa a `false` y `movimientos` queda `[]` — el dashboard renderiza
Total Gastos, Saldo del Ciclo y Saldo Teórico en `$0.00` sin banner ni reintento.
El usuario no distingue "caja vacía" de "no cargó".

El hook **sí expone** `error` y `recargar` (líneas 89, 94), y los hermanos
`ReportesCaja.tsx:49` y `MovimientosCaja.tsx:372` sí los usan. Es descuido, no diseño.

Bonus: `ArqueoCaja` llama `useCajaChica()` sin periodo — carga la colección completa.

### 5. Dos paneles completos construidos y nunca montados

`app/proveedores/PanelInteligencia360.tsx`, `app/proveedores/PanelVinculacionProveedores.tsx`

Cero referencias en todo el repo fuera de sus propios archivos.
`app/proveedores/page.tsx` solo monta `DirectorioProveedores` y `PanelComprasOdoo`.

- **Inteligencia 360**: matriz proveedor primario/backup + scorecards automáticas,
  con persistencia (`guardarMatrizBackupProveedores`, `persistirScorecardsAutomaticas`).
  El directorio **sí muestra** los badges primario/backup (`page.tsx:951-958`) —
  siempre vacíos, porque no hay UI para escribir el mapeo.
- **Vinculación**: UI del backfill de `proveedorId` histórico. La API
  (`/api/proveedores/vinculacion`) y la lógica pura están completas y protegidas por
  super-admin, pero no hay forma de invocarlas desde la app.

Además, `CLAUDE.md` documenta el panel de inteligencia 360 como si estuviera montado.
La doc y la realidad divergen.

### 6. El buscador global vuelve inalcanzables casi todos los módulos

`components/BuscadorGlobalCommand.tsx:146,184,270`

El placeholder promete buscar "proveedores, herramientas, refacciones o **módulos**".
Pero `consultaLarga = query.trim().length >= 3` y los dos bloques que contienen el
menú de atajos de módulos (14 items) están envueltos en `{!consultaLarga && (...)}`.

Al escribir el tercer carácter, los módulos **desaparecen** y solo quedan los
resultados de `/api/busqueda-semantica`, que indexa únicamente ítems de órdenes y
proveedores. Escribir "notificaciones", "banos", "horas extra", "endmills" o
"caja chica" devuelve "sin coincidencias". La única salida es borrar el texto.

### 7. Fallo silencioso al generar la Orden de Compra desde una requisición

`app/requisiciones/DetalleRequisicionModal.tsx:247-261, 263-280`

`handleGenerarOCClick` y `handleConfirmarGanador` envuelven `generarOC` /
`seleccionarGanador` en try/catch que solo hace `console.error`. Si falla (permiso,
validación, red), el spinner se apaga y ya. El usuario no sabe si se generó la OC —
en el flujo que convierte una requisición en dinero comprometido.

### 8. La cuadrícula de horas extra nunca muestra el error de guardado

`app/horas-extra/HorasExtraGrid.tsx:208-209, 521-526`

`guardarCelda` sí hace `setSaveStatus('error')`, pero el render solo consulta
`'saving'` y `'saved'` — el estado `'error'` no dispara ícono, toast ni mensaje.
Peor: `aplicarValorACelda` (líneas 109-113, todo el submenú de clic derecho
"Horas rápidas" y "Códigos especiales") llama `await editarDias(...)` sin try/catch,
y `lib/hooks/useHorasExtra.ts:111-130` tampoco atrapa. Si Firestore rechaza el
write, la celda queda igual y el usuario cree que guardó.

---

## Prioridad 2 — severidad media, o alta con confianza menor

### 9. Rutas de Gemini sin gate de módulo

7 Route Handlers (`/api/extraer`, `/api/extraer-lote`, `/api/cotizaciones/extraer`,
`/api/documentos-venta/extraer-po`, `/api/clasificar-items`,
`/api/proveedores/investigar`, `/api/sugerir-clave-sat`) validan solo
`verificarUsuarioAutorizado` antes de llamar a Gemini.

El patrón correcto **ya existe**: `/api/endmills/extraer-pedido:19-26`,
`/api/ordenes/[id]/recibir:19-30` y `/api/documentos-venta/solicitudes:47-53` sí
checan módulo. No se aplicó parejo.

No es fuga de datos de terceros: es exposición de costo/cuota de Gemini y uso de
funciones fuera del rol asignado.

### 10. `/api/documentos-venta/extraer-po` sin `maxDuration`

Es la **única** de las 5 rutas de extracción con IA que no lo exporta:

| Ruta | `maxDuration` |
|---|---|
| `/api/extraer` | 120 |
| `/api/extraer-lote` | 120 |
| `/api/cotizaciones/extraer` | 120 |
| `/api/endmills/extraer-pedido` | 120 |
| `/api/documentos-venta/extraer-po` | **ausente** |

`AGENTS.md` documenta que la extracción PDF/visión necesita ese export alineado con
`frameworksBackend` de Hosting "o prod regresa `Failed to fetch`". Riesgo real de
timeout con POs de cliente pesadas. Fix trivial.

### 11. El lector IA de POs sugiere partidas sin saldo

`lib/documentos-venta-lector-ia.ts:271`

```js
qtySolicitada: Math.min(partCliente.cantidad, lineaSo.qtyPending || partCliente.cantidad)
```

Cuando la línea de la SO ya está totalmente facturada (`qtyPending === 0`), el `||`
cae al fallback y usa la cantidad completa del cliente en vez de 0. La línea queda
pre-seleccionada con una cantidad que excede su `max`, y al enviar
`validarPartidasRemision` la rechaza con "Cantidad inválida para X" — error confuso
para el usuario de ventas, que no sabe por qué la IA le sugirió algo inválido.

**Fix:** `lineaSo.qtyPending > 0 ? Math.min(...) : 0`, o excluir la línea del match.

### 12. El módulo de endmills deja el skeleton de carga pegado

`lib/hooks/useEndmills.ts:70-81`

Copy-paste: `fetchPedidos` hace `setLoadingPedidos(true)` al entrar pero en el
`finally` llama `setLoadingMedidas(false)` (línea 79). `fetchPedidos` es justamente
lo que dispara el botón "Reintentar" del banner de error (`EndmillsView.tsx:146`).
Si falla el listener y el usuario reintenta, el historial se queda con el skeleton
fijo aunque los datos ya llegaron. Fix de una línea.

### 13. Antipatrón de zona horaria en 5 lugares más

Barrido de `new Date().toISOString().slice(...)` usado como "hoy local":

| Ubicación | Impacto |
|---|---|
| `app/cotizaciones/CotizacionIaModal.tsx:95,424` | **persiste** la fecha de la cotización; de noche en Monterrey guarda la de mañana |
| `app/horas-extra/ResumenMensual.tsx:34` | en las últimas ~6 h del mes abre el mes siguiente (vacío) |
| `lib/endmills-calculos.ts:239,272` | fecha equivocada en el mensaje al proveedor de China (solo texto) |

`/banos` lo hace bien (`CuentaDiaria.tsx:16`, `ResumenMensual.tsx:22` usan
`fechaHoyLocal()`). El helper existe justo para esto.

### 14. Colecciones operativas sin gate de módulo en las reglas

`firestore.rules:167` y equivalentes

`/ordenes`, `/cotizaciones`, `/requisiciones`, `/operadores`, `/registros-bano` y
`/horas-extra` solo exigen `esUsuarioAutorizado()` en lectura — sin `tieneModulo()`.
La UI **sí** gatea esas rutas por módulo. Un usuario plantilla `diseno` puede leer
la colección completa de órdenes (con montos y proveedores) desde la consola del
navegador.

Contraste: `caja_chica_movimientos:831`, `proveedores`, `finanzas_*`, `endmills-*` y
`almacen-entradas` sí exigen módulo.

**Puede ser deliberado** ("todo lo operativo es visible, solo lo financiero está
compartimentado") — pero no está documentado como tal. Requiere decisión del dueño.

### 15. Botones del buscador SAT que no hacen nada

`app/claves-sat/BuscadorClavesSat.tsx:230-237, 239-246`

- "Usar en Nueva Compra" navega a `/nueva-compra?claveSat=X`, pero
  `app/nueva-compra/page.tsx:9-22` no declara `claveSat` en `SearchParams` (lista 11
  params, ninguno es ese) — se descarta en silencio.
- "Buscar compras con esta clave" navega a `/ordenes?q=X`, pero `app/ordenes/page.tsx`
  nunca lee `searchParams` y `OrdenesList` arranca con `query` en `useState('')`. El
  usuario llega sin filtro. (El buscador *sí* matchea `claveProdServ` — es solo
  plomería faltante.)

### 16. Manejo de errores asimétrico entre módulos hermanos

25 `catch` realmente silenciosos en 13 archivos (`console.error` sin `toast`/`setError`
en las 6 líneas siguientes).

El caso más claro: `app/almacen/EntradasList.tsx:135,152,160` y `SalidasList.tsx:99,116`
solo hacen `console.error`, mientras el hermano
`app/pedidos-almacen/PedidosAlmacenView.tsx:133-141,155-158` sí hace `toast.error(...)`
con descripción legible. Mismo patrón de UI, tratamiento opuesto.

Otros: `RequisicionesList.tsx:428` (crear requisición) y `handleCambioEstado` /
`handleCampoInline` (líneas 466-477, **sin try/catch**, rejection no manejada) —
mientras `handleDeleteMultiple:520` en el mismo archivo sí avisa.

### 17. `/cotizaciones` compara precios sobre datos parciales

`app/cotizaciones/CotizacionesTabs.tsx:18`

Usa `useCotizaciones()` sin `cargarTodas()`; el hook trae una página de 50. El
dashboard rotula "Total Cotizaciones" con lo que hay en memoria, no el total real
(`lib/cotizaciones.ts` no tiene `contarCotizaciones()`, a diferencia de
`lib/ordenes.ts` que sí tiene `contarOrdenes()` y muestra "Mostrando X de Y").

Peor: el **Comparador**, cuyo propósito es hallar el mejor precio histórico, compara
solo esas 50 más recientes si entras directo a la pestaña. Puede decir "sin mejor
precio disponible" habiendo una cotización más barata fuera de la página.

### 18. Dedupe incompleto en el guardado por lote de cotizaciones IA

`app/cotizaciones/CotizacionIaModal.tsx:441-447`

```js
if (duplicados.length === payloads.length && payloads.length === 1) { ... return }
```

Solo bloquea el caso de un ítem. Si procesas un screenshot multi-partida dos veces
(fácil con Ctrl+V) y las N partidas son todas duplicadas, `payloads.length === 1` es
falso y se crean N duplicados sin aviso. El CSV (`ImportarCotizaciones.tsx`) y el
manual (`CotizacionFormModal.tsx`) sí deduplican bien.

### 19. `/finanzas` carga colecciones completas en cada montaje

`lib/hooks/useFinanzasFacturas.ts`, `app/finanzas/page.tsx:159`

`listarFacturas()` (`lib/finanzas-facturas.ts:16-19`) y `listarFacturasProveedor()`
(`lib/finanzas-ap.ts:36-39`) corren sin rango ni límite, en cada mount de `/finanzas`,
`/finanzas/facturacion`, `/finanzas/cobranza` y `/finanzas/reportes` — la misma carga
completa cuatro veces. Contradice el patrón que el propio proyecto exige para
pantallas pesadas (`listarOrdenesEnRango` + "cargar historial" explícito, como sí
hace `/reportes/contable`).

---

## Prioridad 3 — bajo / posiblemente deliberado

- **Toasts de éxito falsos al copiar** — `ColaVentasPanel.tsx:100-131` y
  `app/page.tsx:453,463` hacen `void navigator.clipboard.writeText(...)` sin `await`
  ni `.catch()`, y muestran `toast.success('copiado')` síncrono e incondicional. Si
  el portapapeles falla (permiso, contexto no seguro), el usuario ve éxito sin que se
  haya copiado nada. 6 sitios.
- **`/ordenes` filtros de columna vs. multi-ítem** — `OrdenesTabla.tsx` filtra
  "Empresa" y "Cuenta cargo" contra el campo legacy de nivel-orden, que
  `sincronizarCamposLegacyOrden()` (`lib/schemas.ts:75-89`) sincroniza **solo desde el
  primer ítem**. Una orden con ítems para empresas distintas (común en McMaster) no
  aparece al filtrar por la empresa del segundo ítem. El buscador de texto libre de la
  misma pantalla sí recorre `o.items` completos.
- **`modulesFromLegacy` divergente** — `functions/src/auth.ts:35-49` mapea
  plantilla→módulos distinto a `MODULOS_POR_PLANTILLA` de `lib/roles.ts`. Efecto:
  demasiado *restrictivo*, no fuga. Solo afecta cuentas legacy sin `modulos[]`
  materializado (hoy `crearUsuarioAdmin` siempre lo escribe).
- **Caja chica acepta $0.00** — `ModalMovimientoCaja.tsx:193` valida `montoNum < 0`
  pero el mensaje dice "mayor a 0". Fix: `<= 0`.
- **`/api/extraer-lote` sin consumidor** — su único llamador era
  `app/importar/ImportarCapturas.tsx`, retirado con la ruta `/importar`. Sigue
  autenticado y con tests; es superficie de IA facturable sin UI que la dispare.
- **Clasificación IA sin indicar el corte** — `PanelClasificacionIA.tsx:137-138`
  trocea `pendientes.slice(0, 50)` (correcto vs. el límite de la API) pero no dice
  "se procesaron 50 de N". Recuperable reintentando, pero silencioso.
- **`ordenCompraSolicitud()` es alias muerto** — `lib/documentos-venta-helpers.ts:34-39`
  delega 1:1 a `ordenCompraEfectiva()` (líneas 23-32) sin agregar nada.
- **SSO reparte custom tokens sin gate de módulo** — `/api/auth/sso-token` mintea un
  token de Firebase Auth para cualquier usuario activo de Hub, y los tiles de SMV
  Vision / Dashboard SMV en `app/page.tsx:143-211` se muestran a todos. **Es seguro
  solo si esas apps hacen su propia autorización post-login.** Están fuera de este
  repo — no se pudo verificar. Vale la pena confirmarlo.

---

## Trabajo sin commitear (notificaciones de escritorio)

Revisión directa de `lib/desktop-notificaciones.ts`,
`lib/hooks/useDesktopNotificaciones.ts` y los 6 componentes modificados.

### A. Doble (y triple) timbre por cada notificación — alto

`app/NavBar.tsx:219,227` monta `<NotificacionesBell />` **dos veces**: una en el
`<nav className="hidden ... md:flex">` de escritorio y otra en el `div md:hidden`
móvil. Es CSS, no condicional de React — **ambas instancias se montan siempre**.

Cada una llama `useDesktopNotificaciones({ items, noLeidas })`, y el efecto de
detección (`useDesktopNotificaciones.ts:39-78`) dispara
`reproducirTimbreNotificacion()` de forma independiente. Resultado: **doble timbre**
en cualquier pantalla. En `/notificaciones`, `NotificacionesView` monta una tercera
instancia → **triple**.

**Fix:** extraer el hook a un único punto de montaje (un provider en `layout.tsx`, o
condicionar por breakpoint en React en vez de CSS).

### B. El título de la pestaña pisa el de cada página — medio

`useDesktopNotificaciones.ts:81-91` hace `document.title = 'SMV Hub'` cuando
`noLeidas === 0`, sin cleanup en unmount y desde 2-3 instancias a la vez. Cualquier
título por página que venga de la metadata de Next queda sobrescrito.

### C. El `AudioContext` nunca se cierra — medio

`desktop-notificaciones.ts:75` hace `new AudioContextClass()` en cada timbre y nunca
llama `ctx.close()`. Chrome limita a ~6 `AudioContext` concurrentes por documento;
pasado ese punto el constructor lanza y el timbre **deja de sonar en silencio** (el
`catch` de la línea 107 solo hace `console.debug`). Con doble montaje se llega al
límite en ~3 notificaciones.

**Fix:** reutilizar un `AudioContext` module-level, o `ctx.close()` tras el último `stop`.

### D. Desajuste de hidratación — medio

`useDesktopNotificaciones.ts:144` devuelve `soportado: soportaNotificacionesEscritorio()`
**calculado en render**. En SSR devuelve `false`; en cliente, `true`. En
`NotificacionesView` ese valor gatea un `ModuleSurface` completo, así que el servidor
y el cliente renderizan árboles distintos. Debe ir en `useState` + `useEffect`, como
ya se hace con `permiso`.

### E. Notificaciones marcadas como vistas con `enabled: false` — bajo

`useDesktopNotificaciones.ts:54-58` agrega los ids a `idsVistosRef` **antes** del
`if (enabled)` de la línea 60. En `NotificacionesBell`,
`enabled = visible && !cargandoPermisos`: lo que llegue mientras cargan permisos
queda marcado como visto y nunca suena.

### F. El hook no tiene pruebas — bajo

`tests/desktop-notificaciones.test.ts` (160 líneas, 6 casos) cubre solo la capa `lib`.
El hook —donde viven A, B, D y E— no tiene ninguna.

---

## Lo que está bien (calibración)

Esto no es un repo en mal estado. Lo que el swarm verificó y encontró correcto:

- **Multi-moneda: limpio en todos los caminos financieros.** Se rastreó variable por
  variable: `ReporteView.tsx:76-78` filtra por `monedaActiva` antes de
  `agrupar`/`calcularKpis`; `ReporteContableView.tsx:198` igual antes de sumar y de
  `crearLoteContable`; `lib/finanzas.ts` siempre recibe `facturasMoneda` ya filtrada;
  `lib/flujo-caja.ts` filtra internamente. El comparador de cotizaciones solo calcula
  ahorro cuando las monedas coinciden. `lib/conciliaciones-odoo.ts` marca
  explícitamente "monedas distintas, no comparables". **Ningún camino suma MXN con
  USD.** Siendo la regla más cara del negocio, está bien cuidada.
- **`/api/scrape` es robusto contra SSRF**: whitelist por sufijo de host (inmune a
  `evilamazon.com` y a `amazon.com.evil.com`), fuerza `https:`, y re-valida cada
  redirect salto por salto (máx. 3).
- **`/api/usuarios/*` correctamente cerrado**: super-admin obligatorio, Zod en el body,
  el `uid` viene de la ruta y nunca del body, bloqueo de auto-eliminación
  (`route.ts:79-81`) y protección contra quitar al último super-admin
  (`lib/usuarios-admin.ts:207-212, 289-294`).
- **Los 25 Route Handlers autentican antes de trabajar** — ninguno gasta cuota de
  Gemini ni toca Firestore antes de verificar sesión.
- **`puedeEditarHorasExtra` sincronizado letra por letra** entre `lib/roles.ts:331-339`
  y `firestore.rules:757-765`. También `atiendeDocumentosVenta` y
  `puedeVerNotificaciones`. El correo break-glass es idéntico en las 4 fuentes.
- **Las reglas de `solicitudes_documento` y `notificaciones` no usan `keys().hasAll()`
  en `read`/`list`** (solo en `create`) — la trampa conocida de romper `onSnapshot` no
  se reprodujo.
- **`categorias-registro.ts` idéntico byte a byte** entre `lib/compras-odoo/` y
  `functions/src/compras-odoo/`, igual que el resto de archivos duplicados.
- **Batch del índice semántico sigue en 100** (`busqueda-indice-escritura.ts:20`), y
  `/api/busqueda-semantica` filtra por módulo **dentro de la query de Firestore**
  (`lib/busqueda-semantica-catalogo.ts:74-77`), no post-filtrado.
- **Anclas SAT cubiertas por tests reales** ("Compression Spring" → `31161904`), y
  `validarClaveEnCandidatos` (`lib/sat/gemini-sat.ts:172-179`) impide que Gemini
  invente claves fuera del catálogo. Los 4 puntos de entrada convergen en
  `lib/sat/sugerir-clave.ts` — sin rutas divergentes.
- **El resto del sync Odoo es notablemente sólido**: reintentos con backoff,
  transacciones optimistas con `revision`/`commandId` idempotente, checksums de conteo
  tras escribir en lotes, y manejo correcto del `false` de Odoo.
- **`/almacen` no filtra precios a almacén**: `OrdenesPorRecibir.tsx` gatea montos y
  comprobantes tras `puedeVerMontos`; `ModalRecibirOrdenAlmacen.tsx` no muestra precios.
- **`app/error.tsx`, `loading.tsx` y `not-found.tsx` son reales y útiles** (retry,
  spinner, CTA de regreso), no stubs. `ModalCamara.tsx` y `useNotificaciones.ts`
  limpian correctamente sus efectos.
- **El retiro del tab ROP quedó limpio** — sin referencias vivas, solo en docs históricas.

## Hipótesis descartadas al verificar

Se investigaron y resultaron falsas. Se documentan para que no se re-abran:

- **"El timbre suena para una notificación que no es la más reciente"** — falso.
  `suscribirNotificaciones` (`lib/notificaciones.ts:190-200`) fusiona las queries y
  ordena `creadoEn desc` antes de emitir, así que `nuevas[0]` sí es la más reciente.
- **"El diff mete 91 colores hardcodeados sin variante `dark:`"** — no es bug. La app
  **no tiene modo oscuro** (0 referencias en `globals.css`, solo 22 `dark:` en toda la
  app, heredados de shadcn). La paleta semántica sky/emerald/amber está en 89 archivos:
  es la convención establecida. `tests/ui-tokens-guardrail.test.ts` prohíbe solo chrome
  neutro (`white`/`slate`/`gray`) **a propósito**.
- **"El chat de documentos-venta no notifica en ambas direcciones"** — falso. El
  broadcast a los flagueados va por `audiencia`, no por `destinatarioUid`, y eso es
  consistente con `puedeCrearNotificacion()` en `firestore.rules`.
- **`lib/finanzas-ap.ts:calcularKpisAP`** usa `new Date()` sobre strings, pero resta dos
  fechas parseadas igual, así que el sesgo UTC se cancela. No es bug.

---

# Estado de implementación — 2026-08-24

Verificación entre lotes, no solo al final. Estado al cierre:

| Check | Antes | Después |
|---|---|---|
| `npx tsc --noEmit` | limpio | limpio |
| `npm run lint` | limpio | limpio |
| `npm test` | 1048 pasan | **1067 pasan** (+19) |
| `npm run build` | — | pasa, bundle SSR de Firebase validado |
| `cd functions && npm run build` | — | pasa |
| `any` en producción | 1 | **0** |

## Arreglado

**Pérdida de datos y dinero**
1. Guard invertido en `odoo-compras-sync.ts` → `items.length === 0` a secas. Ya no puede borrar `compras_odoo_items` cuando la hidratación de líneas falla.
2. Zona horaria en reportes → nuevo helper `parseFechaLocal` en `lib/format.ts` (inverso de `fechaHoyLocal`), usado por `filtrarPorRango` y `aplanarLineas`. Regresión cubierta con test.
3. `toInputDate` en `FiltrosReporte` usaba `toISOString()`: el `hasta` a las 23:59 se mostraba un día después.
4. Antipatrón `new Date().toISOString().slice()` **erradicado del repo** (0 ocurrencias): cotizaciones IA, horas-extra y endmills.

**Fallos silenciosos**
5. `ResumenCaja` muestra banner de error + reintento. `ArqueoCaja` **bloquea el arqueo** si los movimientos no cargaron, en vez de comparar el efectivo real contra un teórico de $0.00.
6. `HorasExtraGrid`: el estado `'error'` ahora sí se renderiza, y `aplicarValorACelda` atrapa el fallo.
7. `DetalleRequisicionModal`: toasts en generar OC, seleccionar ganador y agregar cotización.
8. `RequisicionesList`: toast al crear; `handleCambioEstado` y `handleCampoInline` ya tienen `try/catch`.
9. `EntradasList` / `SalidasList` de almacén alineados con el patrón de `pedidos-almacen`.
10. **95 llamadas a `navigator.clipboard`** migradas al nuevo `lib/portapapeles.ts`: ya no muestran "copiado" cuando la copia falló.

**Integridad de datos**
11. `OrdenFormModal` aplica la misma deduplicación que `/nueva-compra` (excluyéndose a sí misma al editar). `buscarPorFacturaYProveedor` ahora devuelve `id`.
12. `CotizacionIaModal`: guarda solo las partidas nuevas y reporta cuántas omitió, en vez de fallar solo cuando había exactamente una.
13. `documentos-venta-lector-ia`: `qtyPending === 0` ya no cae al fallback del `||`.

**Permisos**
14. Nuevo `verificarModulo()` en `lib/api-auth.ts`, aplicado a las 7 rutas de Gemini.
15. `firestore.rules`: `ordenes`, `cotizaciones`, `requisiciones`, `operadores` y `registros-bano` exigen módulo, vía el nuevo `tieneAlgunModulo()`. Los docs legacy sin `modulos[]` conservan acceso para no tumbar a nadie.

**UX**
16. `BuscadorGlobalCommand`: los 22 módulos siguen alcanzables al escribir (antes desaparecían al tercer carácter).
17. `?claveSat=` en `/nueva-compra` y `?q=` en `/ordenes` ya se leen — los botones de `/claves-sat` funcionan.
18. `maxDuration = 120` en `/api/documentos-venta/extraer-po`.
19. `useEndmills`: `setLoadingPedidos` en vez de `setLoadingMedidas`.
20. Caja chica ya no acepta movimientos de $0.00.

**Trabajo sin commitear (notificaciones de escritorio)**
21. Registro de alertas movido a nivel de módulo → **se acabó el timbre doble/triple**. Lógica extraída a `filtrarNotificacionesNuevas`, con tests.
22. `AudioContext` compartido y reutilizado (antes uno por timbre; Chrome corta a ~6 y el sonido moría en silencio).
23. `soportado` pasó a `useState` + `useEffect`: se acabó el desajuste de hidratación.
24. El título de la pestaña respeta el título de la página y se limpia al desmontar.
25. Último `as any` del repo eliminado (`webkitAudioContext` tipado).

## NO arreglado, y por qué

- **Lectura abierta de `horas-extra`**: se intentó cerrar y `tests/firestore-security.test.ts` lo rechazó. Es una **decisión deliberada** ("compras, contabilidad y automatización editan; diseño y todos los demás son solo lectura"). Revertido y documentado con un test que explica por qué no se debe volver a tocar.
- **Los dos paneles huérfanos** (`PanelInteligencia360`, `PanelVinculacionProveedores`): montarlos es una decisión de producto, no un bug. Requiere tu visto bueno.
- **Filtros de columna multi-ítem en `/ordenes`**: el fix correcto cambia semántica de filtrado; conviene decidirlo con datos reales a la vista.
- **`/finanzas` y `/cotizaciones` cargando colecciones completas**: es un refactor de paginación, no un parche.
- **`modulesFromLegacy` en Functions**: solo afecta cuentas legacy sin `modulos[]`; el arreglo real es correr el backfill.
- **SSO sin gate de módulo**: depende de cómo autoricen SMV Vision y Dashboard SMV, que están fuera de este repo.

## Pendiente antes de desplegar

1. **Las rules NO se pudieron probar**: `npm run test:rules` necesita el emulador de Firestore y **no hay Java instalado** en esta máquina. Los tests estáticos de `firestore.rules` pasan, pero eso valida el texto, no el comportamiento. Instala Java y corre:
   `npx firebase-tools emulators:exec --only firestore "npm run test:emulator"`
2. Corre `scripts/backfill-modulos-usuarios.mjs` **antes** de desplegar las rules, para que ningún usuario quede sin `modulos[]`.
3. Despliega rules aparte: `firebase deploy --only firestore:rules --project smv-brain`.
4. Las Functions requieren deploy propio con el codebase `smv-hub` (nunca `--force`).
