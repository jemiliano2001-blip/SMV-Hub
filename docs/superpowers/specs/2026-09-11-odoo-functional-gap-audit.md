# Auditoría de Brechas Funcionales (Functional Gap Audit): Integraciones Odoo ERP en SMV Hub

**Fecha**: 11 de Septiembre de 2026  
**Alcance**: Módulos y servicios conectados a Odoo ERP (`/finanzas`, `/compras-odoo`, `/proveedores`, `/documentos-venta`, Cloud Functions de sincronización y APIs RPC).  
**Metodología**: Auditoría de brechas funcionales paralela sobre 5 grupos de integración: Finanzas AR, Conciliaciones, Compras ETL, Ventas SO y Cotizador interactivo RPC.  
**Estado**: Reporte exhaustivo previo a implementación (Report-First).

---

## 1. Resumen Ejecutivo de Hallazgos

| Prioridad | Cantidad | Descripción General |
|-----------|----------|---------------------|
| **Prioridad 1 (Alta Severidad + Alta Confianza)** | 4 | Desconexión en botón de sync de finanzas (solo AR, ignora AP), riesgo de conflicto multi-compañía en impuestos de Odoo, visualización ambigua de `$0.00` en conciliaciones multi-moneda, y descarga masiva sin límites de `compras_odoo_items`. |
| **Prioridad 2 (Media Severidad / Resiliencia)** | 6 | Fallos silenciosos en carga de AP, falsos positivos potenciales en emparejamiento por folio simple, riesgo de doble PO por timeout sin idempotencia, historial parcial (solo creadas en Hub vs POs globales de Odoo), omisión de advertencias en sync de remisiones de ventas, y posibles duplicados de proveedores sin RFC. |
| **Prioridad 3 (Baja Severidad / UX)** | 4 | Falta de debounce en autocompletado de proveedores, ausencia de botón de refresco local para usuarios de taller en ventas, falta de reseteo de filtros al cambiar moneda en comparador de insumos, y paginación en tablas extensas de cuentas por pagar. |

---

## 2. Prioridad 1: Brechas Críticas

### GAP-01: El botón "Sincronizar ahora" en Finanzas solo actualiza AR e ignora AP
- **Ubicación**: [BannerSync.tsx:26-38](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/finanzas/BannerSync.tsx#L26-L38) y [app/finanzas/page.tsx:156-173](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/finanzas/page.tsx#L156-L173)
- **Severidad**: Alto | **Confianza**: Alta
- **Diagnóstico**: La función `BannerSync` invoca `sincronizarFinanzasOdoo()`, la cual llama a la Cloud Function `syncOdooFacturasManual`. Esta función únicamente sincroniza las facturas de clientes (Cuentas por Cobrar, colección `finanzas_facturas`). No ejecuta la sincronización de facturas de proveedores (Cuentas por Pagar, colección `compras_odoo_facturas`). Además, el callback `onSincronizado` ejecuta `recargar()`, el cual solo refresca el hook `useFinanzasFacturas`. Las facturas de proveedor en el estado local `facturasAP` permanecen inmutables.
- **Impacto en producción**: Si el usuario está revisando la pestaña "Cuentas por Pagar (AP)" o "Conciliación Compras" y presiona "Sincronizar ahora", la interfaz dice "Sincronizado con éxito", pero los datos de proveedores nunca se actualizan a menos que se recargue por completo la ventana del navegador.
- **Esfuerzo**: Pequeño (invocar también `syncOdooComprasManual` si el usuario tiene permisos de compras, o disparar la recarga de `listarFacturasProveedor()` en `onSincronizado`).

---

### GAP-02: Columna Diferencia muestra `$0.00` en Desviaciones Multi-Moneda de Conciliación
- **Ubicación**: [TablaConciliacionOdoo.tsx:157-164](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/components/finanzas/TablaConciliacionOdoo.tsx#L157-L164) y [lib/conciliaciones-odoo.ts:72-82](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/lib/conciliaciones-odoo.ts#L72-L82)
- **Severidad**: Alto | **Confianza**: Alta
- **Diagnóstico**: En `lib/conciliaciones-odoo.ts`, cuando la orden de compra local está en `USD` y la factura de Odoo en `MXN` (o viceversa), la variable `monedasCoinciden` es `false`. Por protección contra cálculos erróneos, la lógica establece `diferenciaMonto = 0` y asigna el estatus `desviacion_precio`. Sin embargo, `TablaConciliacionOdoo.tsx` evalúa `it.diferenciaMonto > 0`. Al ser `0`, salta al fallback `<span className="text-muted-foreground">$0.00</span>`.
- **Impacto en producción**: La fila aparece marcada con el badge ámbar de **"Desviación"**, pero la columna de Diferencia muestra **`$0.00`** (con signo de dólar hardcodeado). Esto genera profunda confusión en los usuarios contables, haciéndoles creer que el sistema tiene un error lógico interno.
- **Esfuerzo**: Trivial (mostrar texto descriptivo `"Moneda distinta"` o `"—"` con badge informativo cuando `!monedasCoinciden`).

---

### GAP-03: Consulta de Impuestos Odoo sin filtro de Compañía (`company_id`)
- **Ubicación**: [lib/odoo-crear-cotizacion.ts:398](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/lib/odoo-crear-cotizacion.ts#L398)
- **Severidad**: Alto | **Confianza**: Alta
- **Diagnóstico**: Al crear una cotización directa en Odoo, la función `resolverImpuestoCompraPorTasa` ejecuta `search_read` en `account.tax` buscando:
  `[[["type_tax_use", "=", "purchase"], ["amount", "=", porcentaje]]]` con `limit: 1`.
  No se incluye `company_id` en el dominio. En una base de datos Odoo multi-compañía (común en grupos industriales como SMV con filiales de manufactura y servicios), Odoo crea impuestos independientes por compañía.
- **Impacto en producción**: Si `limit: 1` retorna el impuesto de la compañía A pero el usuario técnico o el partner pertenecen a la compañía B, Odoo rechaza la creación de la orden con una excepción RPC: `El impuesto seleccionado no pertenece a la misma compañía que la orden de compra`.
- **Esfuerzo**: Pequeño (filtrar por `company_id` resuelto en la sesión o en la cabecera de la orden).

---

### GAP-04: Carga masiva sin paginación de `compras_odoo_items` en `/proveedores`
- **Ubicación**: [lib/compras-odoo-store.ts:31-35](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/lib/compras-odoo-store.ts#L31-L35)
- **Severidad**: Alto | **Confianza**: Alta
- **Diagnóstico**: La función `listarItemsComprasOdoo()` realiza un `getDocs` directo de toda la colección `compras_odoo_items` sin límite (`limit`) ni filtro de rango de fechas. El hook `useComprasOdoo` la ejecuta en cada montaje de `/proveedores`.
- **Impacto en producción**: A medida que el ETL de compras sincroniza cientos de órdenes y miles de partidas acumuladas, cada visita a `/proveedores` descargará megabytes de datos innecesarios, saturando la memoria del navegador y consumiendo la cuota diaria de lectura de Firestore. Incumple la directriz explícita de `AGENTS.md`: *Avoid auto-cargarTodas / full-collection mounts on heavy screens*.
- **Esfuerzo**: Pequeño (añadir límite por defecto de 200–500 ítems recientes con opción de "Cargar historial completo").

---

## 3. Prioridad 2: Brechas de Resiliencia y Datos

### GAP-05: Fallo silencioso en carga inicial de facturas de proveedor (AP) en Finanzas
- **Ubicación**: [app/finanzas/page.tsx:166-170](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/finanzas/page.tsx#L166-L170)
- **Severidad**: Medio | **Confianza**: Alta
- **Diagnóstico**: En el `useEffect` de carga de AP y órdenes locales, el bloque `catch` solo imprime `console.error` y finaliza con `setCargandoAP(false)`. No existe un estado de `errorAP` que se comunique a la interfaz.
- **Impacto**: Si la conexión falla, el usuario ve los KPIs de "Total por Pagar" en `$0.00` y tablas vacías sin saber que hubo un error de red o de autenticación.
- **Esfuerzo**: Pequeño.

---

### GAP-06: Riesgo de duplicación de órdenes de compra por timeout sin idempotencia
- **Ubicación**: [app/api/odoo/crear-cotizacion/route.ts:84-95](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/api/odoo/crear-cotizacion/route.ts#L84-L95) y [lib/odoo-crear-cotizacion.ts:89-94](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/lib/odoo-crear-cotizacion.ts#L89-L94)
- **Severidad**: Medio | **Confianza**: Alta
- **Diagnóstico**: La llamada JSON-RPC tiene un timeout de 20 segundos. Si Odoo tarda más en responder (por procesamiento de inventario o bases de datos lentas), el fetch aborta y la API devuelve HTTP 500. Sin embargo, Odoo puede haber terminado de crear la orden en su base de datos. Si el usuario reintenta enviar el formulario, se creará una segunda orden idéntica en Odoo.
- **Impacto**: Órdenes de compra duplicadas generadas en Odoo para el mismo proveedor y partidas.
- **Esfuerzo**: Pequeño (verificar antes de crear si ya existe una PO reciente con el mismo `partner_id` y `partner_ref`, o implementar clave de idempotencia).

---

### GAP-07: Desconexión de alcance: "Historial de compras Odoo" no incluye POs globales de Odoo
- **Ubicación**: [app/compras-odoo/HistorialOdooList.tsx:90](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/compras-odoo/HistorialOdooList.tsx#L90) y [lib/compras-odoo-cotizaciones.ts:9-19](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/lib/compras-odoo-cotizaciones.ts#L9-L19)
- **Severidad**: Medio | **Confianza**: Alta
- **Diagnóstico**: En `/compras-odoo`, la pestaña "Historial" consulta únicamente la colección `compras_odoo` (espejo de las cotizaciones creadas desde esta vista web). No incluye las órdenes de compra del ERP que están sincronizadas en `compras_odoo_po`.
- **Impacto**: Un comprador que busca una PO creada en Odoo para recotizarla no la encuentra aquí si no fue generada a través del formulario de SMV Hub.
- **Esfuerzo**: Mediano (agregar selector de fuente: "Generadas en Hub" vs "Todas en Odoo").

---

### GAP-08: Omisión de reporte de errores en sincronización de remisiones de venta
- **Ubicación**: [functions/src/odoo-ventas-sync.ts:156-160](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/functions/src/odoo-ventas-sync.ts#L156-L160)
- **Severidad**: Medio | **Confianza**: Alta
- **Diagnóstico**: El sync de ventas captura cualquier error al leer `stock.picking` para no detener la sincronización de las órdenes de venta (`sale.order`). Sin embargo, el documento de estado `ventas_odoo_sync_state` registra `error: null`.
- **Impacto**: Si la API key pierde permisos sobre inventario/remisiones, el sistema reporta sync exitoso en verde, pero en la interfaz de `/documentos-venta` las remisiones dejan de aparecer silenciosamente.
- **Esfuerzo**: Trivial (almacenar `advertenciaRemisiones` en el sync state).

---

### GAP-09: Posibles duplicados de proveedores sin RFC en el ETL de Compras
- **Ubicación**: [functions/src/odoo-compras-mapeo.ts:100](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/functions/src/odoo-compras-mapeo.ts#L100)
- **Severidad**: Medio | **Confianza**: Media
- **Diagnóstico**: Si un proveedor en Odoo no tiene RFC registrado (`vat`), el matching en Firestore se realiza por similitud fonética/texto de nombre. Variaciones leves en la razón social generan múltiples registros de un mismo proveedor en el catálogo local.
- **Esfuerzo**: Pequeño (priorizar vinculación por `odooPartnerId`).

---

### GAP-10: Riesgo de emparejamiento falso en conciliación por número de factura simple
- **Ubicación**: [lib/conciliaciones-odoo.ts:50-54](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/lib/conciliaciones-odoo.ts#L50-L54)
- **Severidad**: Medio | **Confianza**: Media
- **Diagnóstico**: Si una orden local no coincide con la llave compuesta `folio_proveedor`, el motor hace un fallback buscando únicamente por `normalizarTexto(f.numeroFactura)`. Si existen facturas con folios simples (ej. `1`, `101`), puede cruzarse la compra de un proveedor con la de otro.
- **Esfuerzo**: Pequeño (exigir que el fallback por folio solo aplique si el proveedor no está definido o coincide parcialmente).

---

## 4. Prioridad 3: Mejoras Visuales, UX y Rendimiento

### GAP-11: Falta de debounce en búsqueda interactiva de proveedores Odoo
- **Ubicación**: [app/compras-odoo/CapturaOdooForm.tsx:259](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/compras-odoo/CapturaOdooForm.tsx#L259)
- **Severidad**: Bajo | **Confianza**: Alta
- **Diagnóstico**: Al escribir en el campo de proveedor, cada pulsación de tecla dispara una llamada HTTP inmediata a `/api/odoo/proveedores`.
- **Esfuerzo**: Trivial (agregar debounce de 300ms).

---

### GAP-12: Falta de botón de recarga local para usuarios operativos en `/documentos-venta`
- **Ubicación**: [app/documentos-venta/DocumentosVentaView.tsx:111-121](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/documentos-venta/DocumentosVentaView.tsx#L111-L121)
- **Severidad**: Bajo | **Confianza**: Alta
- **Diagnóstico**: Solo administradores pueden ver el botón "Actualizar desde Odoo". Los operadores de taller no tienen ningún botón para refrescar la lista de Firestore sin recargar la página entera en el navegador.
- **Esfuerzo**: Trivial.

---

### GAP-13: Filtros de tipo y medida no se resetean al alternar moneda en insumos
- **Ubicación**: [app/proveedores/PanelComprasOdoo.tsx:31-49](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/app/proveedores/PanelComprasOdoo.tsx#L31-L49)
- **Severidad**: Bajo | **Confianza**: Alta
- **Diagnóstico**: Al cambiar entre MXN y USD en el comparador de insumos, los filtros seleccionados previamente se mantienen, lo que frecuentemente deja el panel sin resultados sin feedback visual explicativo.
- **Esfuerzo**: Trivial.

---

### GAP-14: Ausencia de paginación en `TablaCuentasPorPagar.tsx`
- **Ubicación**: [components/finanzas/TablaCuentasPorPagar.tsx](file:///d:/proyectos_code/IA%20Personal/apps/SMV-Hub/components/finanzas/TablaCuentasPorPagar.tsx)
- **Severidad**: Bajo | **Confianza**: Media
- **Diagnóstico**: Renderizado plano de todas las facturas de proveedor en un único listado.
- **Esfuerzo**: Mediano.

---

## 5. Matriz de Cobertura por Módulo

```
Módulo / Ruta          | Integración Odoo                          | Estado General | Brechas Abiertas
------------------------------------------------------------------------------------------------------
/finanzas (AR)         | odooSync.ts (account.move out)            | Operativo      | GAP-01, GAP-05
/finanzas (AP)         | compras_odoo_facturas (account.move in)   | Operativo      | GAP-01, GAP-05, GAP-14
/finanzas (Concilia)   | lib/conciliaciones-odoo.ts                | Operativo      | GAP-02, GAP-10
/proveedores           | odoo-compras-sync.ts & compras_odoo_items | Operativo      | GAP-04, GAP-09, GAP-13
/documentos-venta      | odoo-ventas-sync.ts (sale.order & pick)   | Operativo      | GAP-08, GAP-12
/compras-odoo          | /api/odoo/* (purchase.order RPC)          | Operativo      | GAP-03, GAP-06, GAP-07, GAP-11
```

---

## 6. Próximos Pasos Recomendados (Fase de Implementación)

1. **Sprint 1 (Seguridad y Correcciones Críticas - P1)**:
   - Corregir `TablaConciliacionOdoo.tsx` para eliminar la ambigüedad de `$0.00` en discrepancias multi-moneda (**GAP-02**).
   - Añadir filtro `company_id` en `resolverImpuestoCompraPorTasa` (**GAP-03**).
   - Ajustar `BannerSync.tsx` y `page.tsx` para recargar también AP tras sincronizar (**GAP-01**).
   - Aplicar paginación o límite inicial a `listarItemsComprasOdoo` (**GAP-04**).
2. **Sprint 2 (Resiliencia y UX - P2 & P3)**:
   - Agregar banner de error en carga de AP (**GAP-05**).
   - Añadir advertencia de remisiones en sync de ventas (**GAP-08**).
   - Incorporar debounce en autocompletado de proveedores (**GAP-11**).
