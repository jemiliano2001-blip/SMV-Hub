# Módulo Finanzas: facturación de clientes desde Odoo

Fecha: 2026-07-15

## Problema

La contadora mantiene a mano `EDOS FINANCIEROS 2026.xlsx`: facturación mensual
y acumulada por cliente, IVA, cobranza pendiente/vencida. Los montos de
facturación ya existen en **Odoo** (el ERP donde se emiten las facturas
reales), pero hoy se transcriben manualmente al Excel — el mismo problema que
ya resolvió el Hito 5 de `PROJECT.md` para los módulos operativos
(`/almacen`, `/banos`, `/horas-extra`, `/operadores`).

Esto es información de **clientes** (ventas), separada por completo de lo que
ya existe en SMV Hub (compras a proveedores en USD, `/reportes`,
`/reportes/contable`). No deben mezclarse: ningún KPI de Finanzas comparte
tabla ni suma con los de compras.

## Objetivo

Fase 1 (alcance de este documento, solo lectura):

1. **Resumen financiero** — facturación del mes, acumulada del año, subtotal/
   IVA/total, número de facturas, comparación contra meses anteriores,
   separado por moneda.
2. **Facturación por cliente** — total, % de participación, mensual y
   acumulado, filtros por fecha/cliente/estado.
3. **Cobranza** — pagadas, pendientes, vencidas, días de atraso, total por
   cobrar.
4. **Reportes** — mensual, acumulado anual, export a Excel, impresión/PDF vía
   navegador.

Fuera de alcance de Fase 1 (decisión explícita con Emiliano, 2026-07-15):
saldos bancarios/tesorería, importaciones en tránsito, pagos de equipo
financiado, y cualquier empresa del grupo distinta a la que emite las
facturas de cliente reales. Conciliaciones, estados financieros formales
(balance, income statement, cash flow) y multi-empresa quedan para fases
futuras — no se construyen aquí.

## Decisiones tomadas (con Emiliano, 2026-07-15)

- **Una sola empresa** en Fase 1. El Excel de referencia mezcla varias razones
  sociales/cuentas (VAZBROS REYNOSA, VAZBROS METALES Y PLASTICOS, SMV
  DÓLARES, VAHA, SERVICIOS IND. ORION, MULTISERVICIOS IND. LEO) pero Finanzas
  Fase 1 cubre solo la que emite las facturas de cliente reales. Cuál
  exactamente se confirma contra `res.company` en Fase 0 — no se asume del
  nombre visible en el Excel.
- **Sin acceso directo a Odoo** desde el entorno de desarrollo/planeación
  hasta que Emiliano agregue credenciales a `.env.local`. Ningún nombre de
  campo de Odoo en este documento es definitivo — todos están marcados
  "propuesto, pendiente de confirmar" y se congelan solo después de correr el
  script de descubrimiento (ver Fase 0 más abajo) contra la instancia real.
- **Arquitectura: sync programado a Firestore**, no consulta en vivo a Odoo.
  Justificación: si Odoo cae o está lento, `/finanzas` debe seguir sirviendo
  el último dato sincronizado (regla CLAUDE.md #14 — "un fallo de Odoo no
  debe romper toda la app"), y el patrón `hook → lib → Firestore` es el que
  usa el resto del repo. Consultar Odoo en vivo se descarta como arquitectura
  principal.
- **IVA nunca hardcodeado.** El Excel de referencia usa 8% (estímulo fiscal de
  región fronteriza norte, aplica a Reynosa), no el 16% general — confirma
  que el monto de impuestos debe venir siempre de Odoo (`amount_tax`),
  factura por factura, nunca calculado por la app.
- **Admin-only en Fase 1.** `firestore.rules` hoy no restringe por rol (solo
  por `esUsuarioAutorizado()`, con la única excepción de `auditoria` vía
  correo hardcodeado). Facturación de clientes es más sensible que compras,
  así que se introduce la primera regla gateada por rol de este repo,
  restringida a `admin`. Un rol dedicado (`finanzas`) queda como iteración
  futura si más personas (ej. la contadora) necesitan verlo.

## Arquitectura

### Fase 0 — Descubrimiento en Odoo (COMPLETADA, 2026-07-15)

`scripts/odoo-discovery.mjs` corrió contra el Odoo real. Hallazgos:

- **Una sola compañía**: `id=1, "SERVICIOS Y MAQUINADOS VAZQUEZ"` — coincide
  con el nombre oficial del taller. No hay ambigüedad que resolver.
- **Moneda**: todas las facturas reales muestreadas están en `MXN`
  (`currency_id: [33, "MXN"]`). Aun así el schema no la hardcodea.
- **`name`** (número de factura) es `"/"` en borradores/canceladas — Odoo
  asigna el folio real (`"INV/2026/00639"`, `"RINV/2026/00002"` para notas de
  crédito) solo al pasar a `state: "posted"`. La primera corrida del
  descubrimiento trajo puros borradores/cancelados de prueba (incluye un
  cliente literal "CLIENTE PRUEBA" y un registro con `currency_id: "XXX"`)
  porque el query ordenaba por `invoice_date desc` y ese campo viene `false`
  en no-posteadas. Se corrigió el script: filtra `state = 'posted'` y ordena
  por `id desc`.
- **`invoice_date`** viene `false` en no-posteadas, poblado correctamente en
  posteadas — confirma que solo debe usarse para calcular periodos en
  facturas `posted`.
- **`state`**: selection real = `draft` / `posted` / `cancel` — coincide con
  lo propuesto.
- **`payment_state`**: selection real = `not_paid` / `in_payment` / `paid` /
  `partial` / `reversed` / `invoicing_legacy` (más valores que lo propuesto
  originalmente). Mapeo adoptado: `not_paid→no_pagado`,
  `partial→pagado_parcial`, `paid` e `in_payment→pagado` (ambos significan
  que el taller ya recibió el dinero, solo difieren en si Odoo ya concilió
  el pago contra el banco), `reversed→revertido`,
  `invoicing_legacy→no_pagado` (caso legado raro, casi no debería aparecer).
- **`ref`**: de doble uso — vacío en la mayoría, trae el número de PO/orden
  del cliente en algunas (ej. `"3100047295"`), y en notas de crédito trae una
  nota de reversión (`"Reversión de: INV/2026/00635"`).
- **`invoice_origin`**: formato `"2026/S01413"` — referencia a la orden de
  venta origen, útil como trazabilidad adicional.

Todos los demás campos (`amount_untaxed`, `amount_tax`, `amount_total`,
`amount_residual`, `partner_id`, `company_id`) confirmados tal cual se
propusieron.

### Fase 1 — Espejo de solo lectura (tras confirmar Fase 0)

- **`lib/schemas.ts`**: `FacturaClienteSchema` (propuesto, ver plan) +
  `EstadoPagoFacturaSchema`/`EstadoFacturaSchema`/`TipoFacturaSchema`.
- **`lib/finanzas.ts`** (nuevo, lógica pura): mismo patrón que
  `lib/reportes.ts` — aplanar → derivar monedas presentes → filtrar a una →
  agregar. Nunca reusa ni modifica `lib/reportes.ts` (es de compras).
- **`lib/finanzas-facturas.ts`** (nuevo): lectura de Firestore
  (`listarFacturas`, `listarFacturasPorPeriodo`), estilo `lib/caja-chica.ts`
  pero sin mutaciones (el espejo solo lo escribe el Cloud Function).
- **`lib/hooks/useFinanzasFacturas.ts`**: `{data, loading, error, recargar}`,
  mismo shape que `useCajaChica`.
- **`functions/src/odooSync.ts`** (nuevo): `syncOdooFacturasScheduled`
  (`onSchedule`, cada 1-2h) + `syncOdooFacturasManual` (`onCall`, botón
  "Sincronizar ahora"), ambas protegidas con `assertAuthorizedCallable` +
  chequeo de rol admin. Llamada a Odoo vía `fetch` manual con backoff
  exponencial (mismo idioma que `llamarGemini` en `lib/extraer-ia.ts`, sin
  SDK de Odoo). Credenciales vía Firebase Secret Manager (`defineSecret`),
  no `process.env` plano — primera vez que este repo usa Secret Manager,
  justificado por tratarse de credenciales de un sistema financiero externo.
- **Firestore**: colecciones `finanzas_facturas` (espejo, `allow write: if
  false` — solo Admin SDK escribe), `finanzas_sync_state` (cursor/estado del
  último sync). Regla nueva `esAdminRol()` en `firestore.rules` para
  restringir lectura a admin.
- **Rutas**: `app/finanzas/page.tsx` (resumen), `app/finanzas/facturacion/`,
  `app/finanzas/cobranza/`, `app/finanzas/reportes/` — todas con
  `<AuthGuard>`. Nuevo grupo `Finanzas` en `app/NavBar.tsx`.
- **Export/impresión/correo**: adaptar (no reusar tal cual, están tipados
  para vocabulario de compras) `FranjaKpis`, `TablaReporte`, `window.print()`
  + `@media print`, `ModalEnviarReporte` (`mailto:`), y el paquete `xlsx` ya
  instalado.

## Manejo de errores

- Cualquier falla de Odoo durante el sync se captura en try/catch, se loguea
  en `finanzas_sync_logs`, y no propaga excepción — la UI sigue leyendo el
  último espejo válido en Firestore con un banner "Sincronizado hace X".
- Un usuario no-admin nunca ve el grupo Finanzas en el nav ni puede leer
  `finanzas_facturas` (bloqueado también a nivel de regla, no solo UI).

## Pruebas

- `tests/finanzas.test.ts`: KPIs/agrupación nunca mezclan moneda (fixture
  MXN+USD), facturas canceladas no suman a facturación, aging de cobranza
  correcto (pagado/parcial/vencido).
- `tests/finanzas-schema.test.ts`: `FacturaClienteSchema` con fixtures que
  imitan la forma real de Odoo (una vez confirmada en Fase 0), incluyendo
  IVA no-16%.
- `tests/odoo-sync-mapeo.test.ts`: función pura `mapearFacturaOdoo(raw) =>
  FacturaCliente` con los 5 registros de muestra reales capturados en Fase 0
  como fixtures. El Cloud Function completo no se prueba contra Odoo real
  (igual que no hay test que llame a Gemini real).

## Fuera de alcance

- Saldos bancarios, tesorería, importaciones en tránsito, pagos de equipo
  financiado.
- Multi-empresa (solo una razón social en Fase 1).
- Conciliaciones banco/Odoo/Excel, estados financieros formales (balance,
  income statement, cash flow), presupuesto vs. real, análisis de margen.
- Escritura hacia Odoo (el espejo es de solo lectura; nunca se sobrescriben
  datos originales de Odoo — regla CLAUDE.md #10).
- Rol `finanzas` dedicado (Fase 1 es admin-only; iteración futura si hace falta).
