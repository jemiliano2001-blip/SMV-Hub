# Auditoría de completitud funcional — 2026-07-23

**Qué es esto:** auditoría de sentido común de los ~20 módulos de SMV Hub, disparada por un bug
real ya confirmado (el filtro "Familia/Tipo" del comparador de precios en `/proveedores` no
cerraba el circuito visualmente entre el `<select>` y la tabla). El objetivo no fue buscar bugs
de tipo/compilación (build/lint/tests ya pasan) sino huecos de "sentido común": controles de UI
no conectados a la lógica real, estados vacío/carga/error faltantes, y validaciones o reglas de
negocio inconsistentes entre módulos hermanos.

**Método:** swarm de 6 agentes en paralelo (uno por grupo de módulos), cada uno con lectura
directa de código fuente y verificación cruzada contra CLAUDE.md/AGENTS.md. Coordinado con
ruflo/claude-flow (swarm `swarm-1784829075334-fsdv5t`, namespace de memoria
`smv-hub-audit-2026-07-23`). Solo lectura — ningún código fue modificado en esta pasada.

**Estado:** reporte entregado, pendiente de que el dueño apruebe qué implementar y en qué orden.

---

## Cómo leer esto

Cada hallazgo trae: **[severidad] [confianza]** descripción — archivo:línea — impacto real — esfuerzo.

- **Severidad** alto/medio/bajo: qué tan grave es en la práctica si no se corrige.
- **Confianza** alta/media/baja: qué tan seguro está el agente de que es un hueco real y no una
  decisión deliberada (los de confianza baja valen la pena confirmar contigo antes de tocar nada).
- **Esfuerzo** trivial/pequeño/mediano: tamaño estimado del fix.

---

## 🔴 Prioridad 1 — hallazgos altos con confianza alta

Estos son los que más importan: violan reglas de negocio explícitas del proyecto (mezclar
monedas, perder trazabilidad) o generan datos reales/engañosos.

1. **Dashboard de reportes: selector de moneda no filtra nada** — `app/reportes/DashboardInteligenciaCompras.tsx:23,168`. `monedaFiltro` se pinta pero ningún `useMemo` lo usa. Cambiar el filtro no cambia ninguna cifra. Esfuerzo: pequeño.
2. **Ese mismo dashboard ya mezcla USD+MXN sumando `costoTotal` de todas las compras y etiquetando el resultado como USD** — `DashboardInteligenciaCompras.tsx:111-116,126-129,37`. Viola directamente la regla "nunca sumes total entre monedas distintas". Esfuerzo: pequeño (mismo fix que el punto 1).
3. **`aplanarLineas()` pierde el monto de envío en órdenes con ítems** — `lib/reportes.ts:99-121`. El envío se suma solo en la rama "orden sin ítems"; en la rama con ítems se pierde. Subestima el gasto real en Reporte Gerencial, KPIs y Reporte Contable. Esfuerzo: pequeño.
4. **Cierre contable archiva órdenes de todas las monedas aunque el Excel entregado solo muestre la moneda activa** — `app/reportes/contable/ReporteContableView.tsx` (`handleGuardarLote` vs `exportarExcel`). Órdenes en la moneda no visible se marcan como "reportadas" sin haber aparecido nunca en el Excel entregado a la contadora. Esfuerzo: mediano.
5. **Botón "1-Click Requisición" en `/almacen` escribe requisiciones REALES en Firestore con datos demo/inventados** — `app/almacen/TableroReabastecimientoHerramientas.tsx:56-75` → `lib/recompra-herramientas.ts:170-190` → `crearRequisicionFlujo()`. El tablero ROP corre sobre `DEMO_ITEMS_RECOMPRA` (proveedores ficticios), pero el botón sí escribe en Firestore de verdad. Además el guard de doble-clic está roto (`exitoItem` solo guarda un id a la vez) y permite duplicar la requisición. Esfuerzo: pequeño (deshabilitar el botón o conectar a datos reales).
6. **Conciliación Odoo formatea todos los montos como USD sin importar la moneda real** — `components/finanzas/TablaConciliacionOdoo.tsx:137,140,145`. Una orden/factura en MXN se lee como si fueran dólares. Esfuerzo: pequeño.
7. **`conciliarComprasConOdoo` nunca valida que orden y factura tengan la misma moneda antes de restar montos** — `lib/conciliaciones-odoo.ts:66-96`. Esfuerzo: pequeño.
8. **Scorecards de proveedores 360° siempre vacíos** — `app/proveedores/page.tsx:1213-1215` pasa `[]` hardcodeado como arreglo de órdenes a `generarScorecardsDesdeOrdenes`. El botón "Persistir Scorecards" nunca genera nada, sin importar cuántas órdenes reales existan. Esfuerzo: pequeño.
9. **Aprobador/estatus de aprobación fabricados en el detalle de requisición** — `app/requisiciones/DetalleRequisicionModal.tsx:337-341`. Si el campo real está vacío, muestra `'Ing. Francisco Pantoja'` / `'APROBADA'` como si fuera dato real. Cualquier requisición sin ese campo aparenta estar ya aprobada. Esfuerzo: trivial.
10. **Fallo real de Firestore al pedir cotizaciones se disfraza de "sin cotizaciones"** — `lib/requisiciones-flujo.ts:131-134`. El `catch` regresa datos demo filtrados (vacío para cualquier requisición real) en vez de propagar el error. Esfuerzo: pequeño.
11. **Checkbox "Super-admin" es inerte cuando la plantilla es `admin`** — `lib/roles.ts:267-276` + `firestore.rules:68-75`. No se puede quitarle super-admin a un empleado con plantilla admin manteniendo sus módulos; el fallback legado lo ignora en todas las verificaciones (API, AuthGuard, Firestore Rules), incluyendo acceso de facto a `/finanzas` y `/caja-chica`. Esfuerzo: mediano.

## 🟠 Prioridad 2 — medios/altos con confianza alta o media

Por módulo, resumido (detalle completo de cada agente más abajo):

**Reportes / Órdenes / Nueva compra**
- Moneda como texto libre en Nueva Compra vs `<select>` cerrado en `/ordenes` → buckets de moneda "fantasma" que se salen de los reportes filtrados.
- Botón "quitar archivo" en Nueva Compra resetea **todo el formulario**, no solo la imagen.

**Finanzas / Caja chica / Claves SAT**
- KPIs de Cuentas por Pagar (`lib/finanzas-ap.ts`) ya existen y tienen tests, pero no se usan en ninguna pantalla — el tab AP no muestra aging ni top proveedores, a diferencia de AR.
- Selector de moneda no filtra el tab de Cuentas por Pagar.
- Arqueo de caja chica no persiste nada (sin botón guardar, sin historial).
- Borrado duro de movimientos de caja chica (debería ser soft-delete como en otros módulos financieros).
- Falta botón de copiar clave SAT pese a que el texto de la UI lo sugiere.

**Cotizaciones / Proveedores**
- Comparador de precios: la etiqueta del filtro (español) no se relaciona visualmente con el badge de la tabla (inglés crudo); categoría catch-all "otros" pierde detalle; registro de categorías duplicado entre `lib/` y `functions/` sin test de paridad.
- Matriz "Proveedor Primario vs Backup" vive solo en `useState` — se pierde al recargar, inútil como plan de continuidad real.
- Vincular manualmente un proveedor fantasma está huérfano en la UI (la función existe, nada la llama).
- Formulario manual de cotizaciones no tiene selector de proveedor del catálogo (solo texto libre) ni valida duplicados, a diferencia de la importación CSV y de Nueva Compra.

**Requisiciones / Órdenes de servicio**
- Selector "Proveedor Sugerido" no filtra por categoría del ítem (mismo patrón que el bug original).
- Semáforo de atraso no aparece en la pestaña "Flujo end-to-end", que es la pestaña por defecto.
- Categoría hardcodeada (`"endmills"`) al emitir OC desde una requisición, contaminando la inteligencia de proveedores.
- `/ordenes-servicio` sin paginación (trae toda la colección siempre).

**Piso / Almacén**
- Campo "Recibió" en Entradas es texto libre; en Salidas usa catálogo real de operadores.
- `/banos` es el único módulo sin `registrarAuditoria` en sus operaciones (incluyendo borrado duro sin rastro de quién lo hizo).
- Área "Limpieza"/"Administración" en `/operadores` nunca puede aparecer en `/horas-extra` (Departamento no las incluye) sin ningún aviso.
- 6 listas del piso tapan todo el panel en error sin botón de reintento, pese a que el hook ya expone refetch.

**Admin / Acceso**
- Checkbox "Usuarios (ver)" en la matriz no tiene ningún efecto real (acceso es 100% por super-admin).
- Módulo "Auditoría" asignado a un no-super-admin da acceso real pero sin link visible en el nav.
- `/auditoria` no distingue un fallo real de Firestore de una bitácora vacía.
- Botón activo/inactivo de usuarios sin confirmación (a diferencia de eliminar).
- `/login` no redirige si ya hay sesión, pese a que CLAUDE.md documenta ese comportamiento.

## 🟡 Prioridad 3 — bajos / confianza baja

Ver detalle completo por agente abajo — son ajustes menores (debounce, tipo de cambio duplicado
en `CalculadoraLandedPrice`, checkbox "seleccionar todos" limitado a la página cargada, límite de
`mailto:` para reportes largos, etc.) o casos donde el propio agente marcó confianza baja porque
podría ser una decisión deliberada.

---

## Detalle completo por grupo

### Grupo 1 — Compras core (`/nueva-compra`, `/ordenes`, `/reportes`, `/reportes/contable`)

<details>
<summary>Ver hallazgos completos</summary>

**`/reportes`**
- **[alto][alta]** Selector "Moneda" del Dashboard de Inteligencia no filtra nada — `app/reportes/DashboardInteligenciaCompras.tsx:23,168`. Esfuerzo: pequeño.
- **[alto][alta]** `gastoPorCategoria` y `proveedoresRendimiento.gastoTotal` suman todas las monedas etiquetadas como USD — líneas 111-116, 126-129, 37. Esfuerzo: pequeño.
- **[alto][alta]** `aplanarLineas()` pierde el envío en órdenes con ítems — `lib/reportes.ts:99-121`. Esfuerzo: pequeño.
- **[bajo][baja]** `mailto:` con cuerpo largo puede truncarse en algunos clientes — `ModalEnviarReporte.tsx:83`. Ya documentado como decisión aceptada, solo nota.

**`/reportes/contable`**
- **[alto][alta]** "Cerrar Reporte" archiva órdenes de todas las monedas aunque el Excel solo muestre la activa — `ReporteContableView.tsx` (`handleGuardarLote` línea 227 vs `exportarExcel` línea 297). Esfuerzo: mediano.

**`/ordenes`**
- **[medio][alta]** Moneda texto libre en Nueva Compra vs `<select>` en OrdenFormModal — `NuevaCompraForm.tsx:531` vs `OrdenFormModal.tsx:241-244`. Esfuerzo: trivial.
- **[medio][alta]** Botón "quitar archivo" resetea todo el formulario — `NuevaCompraForm.tsx:357,441-448`. Esfuerzo: pequeño.
- **[bajo][baja]** `OrdenFormModal` soporta modo creación pero no hay botón en `/ordenes` que lo abra así — código alcanzable pero sin acceso desde la UI.
- **[bajo][baja]** "Seleccionar todos" del header solo afecta filas ya cargadas en memoria — `OrdenesTabla.tsx:61-68`. Patrón común en tablas paginadas, confianza baja de que sea hueco real.

**`/nueva-compra`**: sin huecos adicionales relevantes más allá de los ya listados.

**Nota al margen**: `app/api/extraer-lote/route.ts` quedó huérfano tras el retiro de `/importar` (decisión ya tomada, no es un hueco).

</details>

### Grupo 2 — Finanzas (`/finanzas`, `/caja-chica`, `/claves-sat`)

<details>
<summary>Ver hallazgos completos</summary>

**`/finanzas`**
- **[alto][alta]** Conciliación Odoo formatea todo como USD — `components/finanzas/TablaConciliacionOdoo.tsx:137,140,145`. Esfuerzo: pequeño.
- **[alto][media]** `conciliarComprasConOdoo` no valida que orden y factura compartan moneda antes de restar — `lib/conciliaciones-odoo.ts:66-96`. Esfuerzo: pequeño.
- **[medio][alta]** KPIs de AP (`lib/finanzas-ap.ts:67-146`) existen y tienen tests pero no se usan en la UI del tab AP. Esfuerzo: pequeño-mediano.
- **[medio][media]** Tab AP no filtra por la moneda seleccionada arriba, a diferencia de AR — `app/finanzas/page.tsx:370`. Esfuerzo: trivial.

**`/caja-chica`**
- **[alto][alta]** Fondo fijo solo en `localStorage`, no compartido entre dispositivos — `ResumenCaja.tsx:29-44`. Esfuerzo: pequeño.
- **[medio][alta]** Arqueo de caja no persiste (sin guardar/historial) — `ArqueoCaja.tsx`. Esfuerzo: mediano.
- **[medio][media]** Borrado duro de movimientos de caja — `lib/caja-chica.ts:61-65`, debería ser soft-delete. Esfuerzo: pequeño-mediano.
- **[bajo][media]** IVA fijo al 16% hardcodeado — `ModalMovimientoCaja.tsx:224`. Podría ser deliberado (Monterrey no es zona fronteriza).
- **[bajo][baja]** Sin alerta global de "vales pendientes" cruzando periodos.

**`/claves-sat`**
- **[medio][alta]** Falta botón de copiar clave SAT pese a que la UI lo sugiere — `BuscadorClavesSat.tsx:131-159`. Esfuerzo: trivial.
- **[bajo][baja]** Búsqueda sin debounce (no rompe nada, solo eficiencia).

**Nota positiva**: `/finanzas/cobranza` y el guard anti-borrado-masivo de la sync Odoo→Firestore están bien cerrados.

</details>

### Grupo 3 — Cotizaciones y Proveedores (`/cotizaciones`, `/proveedores`)

<details>
<summary>Ver hallazgos completos</summary>

**`/proveedores`**
- **[medio][alta]** Comparador de precios: el filtro de categoría **sí funciona** (se descartó la hipótesis inicial), pero: (a) etiqueta en español del filtro vs badge crudo en inglés en la tabla — `ComparadorPreciosInsumos.tsx:169-174` vs `271-283`; (b) categoría catch-all "otros" siempre pierde el detalle de tipo de insumo; (c) el registro de categorías está duplicado byte a byte entre `lib/compras-odoo/categorias-registro.ts` y `functions/src/compras-odoo/categorias-registro.ts` sin test de paridad — si se agrega una categoría en un solo lado, el filtro falla silenciosamente para esos ítems. Esfuerzo: trivial (a), pequeño (c).
- **[alto][alta]** Scorecards 360° siempre vacíos por arreglo de órdenes hardcodeado en `[]` — `app/proveedores/page.tsx:1213-1215`, `lib/proveedores-inteligencia-cruzada.ts:357-434`. Esfuerzo: pequeño.
- **[medio][alta]** Matriz "Primario vs Backup" solo en `useState`, sin persistencia — `PanelInteligencia360.tsx:31-64`. Esfuerzo: pequeño-mediano.
- **[medio][alta]** `vincularProveedorManual()` existe pero está huérfana, ningún componente la llama — `lib/proveedores-vinculacion.ts:248-264`. Esfuerzo: pequeño.
- **[bajo][media]** `handlePrintAndSave` sin try/catch, a diferencia de los demás handlers del mismo archivo — `app/proveedores/page.tsx:633-653`. Esfuerzo: trivial.

**`/cotizaciones`**
- **[medio][alta]** Formulario manual sin selector de proveedor del catálogo (solo texto libre) — `CotizacionFormModal.tsx:126`. Esfuerzo: pequeño.
- **[medio][alta]** `crearCotizacion()` no valida duplicados, a diferencia de la importación CSV y de Nueva Compra — `lib/cotizaciones.ts:28-43`. Esfuerzo: pequeño.
- **[bajo][media]** Tipo de cambio hardcodeado distinto (20.5) al de la constante compartida (20.0) usada en el comparador — `CalculadoraLandedPrice.tsx:35`. Esfuerzo: trivial.

**Nota**: loading/error/empty en `CotizacionesList`, `ImportarCotizaciones`, `SyncSheetSection` y `DirectorioProveedores` están completos, sin huecos ahí.

</details>

### Grupo 4 — Requisiciones y Órdenes de servicio

<details>
<summary>Ver hallazgos completos</summary>

**`/requisiciones`**
- **[alto][alta]** Aprobador/estatus fabricados con fallback fijo — `DetalleRequisicionModal.tsx:337-341`. Esfuerzo: trivial.
- **[alto][alta]** Fallo real de Firestore al pedir cotizaciones se disfraza de "sin cotizaciones" — `lib/requisiciones-flujo.ts:131-134`. Esfuerzo: pequeño.
- **[medio][alta]** Categoría hardcodeada (`"endmills"`) al emitir OC, contamina inteligencia de proveedores — `lib/requisiciones-flujo.ts:274`. Esfuerzo: mediano.
- **[medio][media]** Selector "Proveedor Sugerido" no filtra por categoría del ítem — `NuevaRequisicionModal.tsx:360-372`. Esfuerzo: pequeño.
- **[medio][alta]** Semáforo de atraso no aparece en la pestaña "Flujo end-to-end" (la que es default) — `RequisicionesList.tsx:541-691`. Esfuerzo: pequeño-mediano.
- **[bajo][baja]** Costo de envío fijo en $15 en captura de cotización — parece deliberado (hay comentario `ponytail:`), confirmar con el dueño.

**`/ordenes-servicio`**
- **[medio][alta]** Sin paginación, trae toda la colección siempre — `lib/ordenes-servicio.ts:30-33`. Esfuerzo: mediano.
- **[bajo][media]** `cantidadPendiente` editable a mano sin advertencia de desincronía con el cálculo automático.

Migración legacy `recibido→entregada` bien manejada, sin huecos ahí.

</details>

### Grupo 5 — Piso y Almacén (`/almacen`, `/pedidos-almacen`, `/banos`, `/horas-extra`, `/operadores`)

<details>
<summary>Ver hallazgos completos</summary>

**`/almacen`**
- **[alto][alta]** "1-Click Requisición" escribe requisiciones reales en Firestore con datos demo — `TableroReabastecimientoHerramientas.tsx:56-75`. Esfuerzo: pequeño.
- **[medio][alta]** Guard de doble-clic roto, permite duplicar esa requisición real — mismo archivo, línea 61-63 vs 29. Esfuerzo: trivial.
- **[bajo][media]** Campo "Recibió" en Entradas es texto libre; en Salidas usa catálogo de operadores — `EntradasList.tsx:210-218` vs `SalidasList.tsx:157-169`. Esfuerzo: pequeño.

**`/pedidos-almacen`**: sin hallazgos relevantes, ciclo completo y bien cerrado.

**`/banos`**
- **[medio][alta]** Único módulo sin `registrarAuditoria` en sus operaciones — `lib/banos.ts:72-91`, incluyendo borrado duro sin rastro. Esfuerzo: pequeño.

**`/horas-extra` + `/operadores`**
- **[medio-alto][alta]** Áreas "Limpieza"/"Administración" nunca pueden aparecer en `/horas-extra` porque `Departamento` no las incluye — `lib/schemas.ts:334` vs `:475`, `lib/operadores-departamento.ts:3-15`. Sin aviso al usuario. Esfuerzo: pequeño (o solo aviso visual si es deliberado).

**Transversal**
- **[bajo][alta]** 6 listas del piso tapan todo el panel en error sin botón de reintento pese a que el hook ya expone refetch — `EntradasList`, `SalidasList`, `RegistroBanoList`, `CuentaDiaria`, `OperadoresList`, `HorasExtraGrid`. `PedidosAlmacenView` sí sigue el patrón correcto y sirve de modelo. Esfuerzo: pequeño.

</details>

### Grupo 6 — Admin y Acceso (`/usuarios`, `/auditoria`, `/login`)

<details>
<summary>Ver hallazgos completos</summary>

**`/usuarios`**
- **[alto][alta]** Checkbox "Super-admin" inerte cuando plantilla=admin — `lib/roles.ts:267-276`, `firestore.rules:68-75`. Esfuerzo: mediano.
- **[medio][alta]** Checkbox "Usuarios (ver)" de la matriz no tiene efecto real. Esfuerzo: trivial.
- **[medio][alta]** Módulo "Auditoría" asignado a no-super-admin da acceso real pero sin link visible en nav — `app/NavBar.tsx:90-97`. Esfuerzo: pequeño.
- **[bajo][media]** Botón activo/inactivo sin confirmación, a diferencia de eliminar. Esfuerzo: trivial.
- Verificado correcto: `pedidos-almacen` en la matriz de módulos; protección del último super-admin activo.

**`/auditoria`**
- **[medio][alta]** No distingue error real de Firestore de bitácora vacía — `app/auditoria/page.tsx:22-33`. Esfuerzo: pequeño.
- **[bajo][media]** Badge "Super-Admin Access" engañoso — el acceso real no exige super-admin. 
- **[bajo][media]** Filtros de Usuario/Sección se derivan solo de los logs ya cargados (tope 500), sin indicar que están acotados.

**`/login`**
- **[bajo][alta]** No redirige si ya hay sesión, pese a que CLAUDE.md lo documenta así. Esfuerzo: trivial.
- Verificado correcto: manejo de cuenta no autorizada y errores de Firebase Auth.

</details>

---

## Siguiente paso

Este documento es solo diagnóstico. Dime qué quieres implementar y en qué orden — por ejemplo,
podríamos arrancar por Prioridad 1 (11 items, la mayoría "esfuerzo pequeño") en un solo batch, o
ir módulo por módulo. Los de confianza baja/media que dependen de si algo fue deliberado (tasa de
IVA, costo de envío fijo, límite de "seleccionar todos") vale la pena confirmarlos contigo antes
de tocarlos.
