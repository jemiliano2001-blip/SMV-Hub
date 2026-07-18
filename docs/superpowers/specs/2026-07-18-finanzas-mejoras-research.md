# Research: Cómo mejorar el módulo de Finanzas

> Síntesis de investigación (autoresearch, 2026-07-18). 2 rondas, 6 búsquedas web,
> 5 ángulos. Cada hallazgo lleva etiqueta de confianza: **alta** (varias fuentes
> independientes coinciden), **media** (una buena fuente), **baja** (sin verificar).
> Esto es research, no un plan aprobado — los planes ejecutables van en
> `docs/superpowers/plans/` tras confirmación.

## Contexto del módulo hoy

`/finanzas` es un espejo de solo lectura de facturación/cobranza desde Odoo
(`functions/src/odooSync.ts` → `finanzas_facturas`). Tiene: Resumen (KPIs del mes,
top clientes), Facturación (por cliente), Cobranza (pendientes/vencidas con días de
atraso), Reportes (export Excel + print). Gaps ya conocidos: sin comparación contra
meses anteriores, sin envío por correo, `listarFacturasPorPeriodo` sin uso.

---

## Hallazgo 1 — KPIs de cobranza que faltan (confianza: alta)

El estándar 2026 para dashboards de cuentas por cobrar (AR) va más allá del "total
por cobrar" que hoy muestra `/finanzas/cobranza`:

| KPI | Qué mide | Benchmark sano |
|---|---|---|
| **DSO** (Days Sales Outstanding) | Días promedio en cobrar | 30–55 días (varía por industria) |
| **CEI** (Collection Effectiveness Index) | % de lo cobrable que sí se cobró | 85–95%; >90% excelente |
| **ADD** (Average Days Delinquent) | Atraso real vs. términos de pago | < 10 días |
| **Distribución de aging** | % del saldo por bucket de antigüedad | 80%+ en corriente; <5% en 90+ |

- CEI es el más recomendado como primera adición: no se distorsiona con
  fluctuaciones de ventas (a diferencia de DSO) y solo necesita datos que ya
  existen en el espejo (saldos inicial/final + facturación del periodo).
- Si el bucket 90+ supera el 5% del total, es señal de problema sistémico.
- Fuentes: clearreceivables.com, stuut.ai, intellichief.com, agentcollect.com,
  ardem.com (2026).

**Aplicación a SMV Hub:** `lib/finanzas.ts` ya tiene `diasAtraso` y
`clasificarCobranza`; agregar `calcularDso`, `calcularCei` y bucketización
0-30/31-60/61-90/90+ como funciones puras es extensión natural, testeable en
`tests/finanzas.test.ts`. Respetar siempre la separación por moneda.

## Hallazgo 2 — El aging como lista de acciones, no como foto (confianza: alta)

Las guías para PyMEs coinciden: el reporte de aging sirve para disparar acciones
por bucket, no para verse a fin de mes.

| Bucket | Acción estándar | Tasa de recuperación típica |
|---|---|---|
| 0–30 días vencida | Recordatorio (automático o rutina) | ~63–87% |
| 31–60 | Contacto personal + fecha de pago comprometida | ~41% |
| 61–90 | Llamada directa al decisor; triage (disputa / flujo / evasión) | ~22% |
| 90+ | Carta formal, hold de trabajo nuevo, decisión legal/write-off | baja |

- Revisión semanal mínimo; mensual es demasiado lento (las facturas cruzan de
  bucket dentro del mes).
- Marcar facturas **en disputa** por separado evita esfuerzo de cobranza mal
  dirigido (confianza: alta).
- Priorizar facturas grandes en el bucket 31–60: es donde el esfuerzo rinde más.

**Aplicación a SMV Hub:** la tabla de cobranza podría agrupar por bucket con la
acción sugerida visible, y destacar "top clientes vencidos". Un campo local de
seguimiento (nota/promesa de pago) requeriría una colección propia — el espejo
`finanzas_facturas` es de solo escritura por el sync.

## Hallazgo 3 — UX de dashboard financiero (confianza: alta)

Prácticas convergentes en las fuentes de diseño (eleken.co, usedatabrain.com,
ecosire.com, 2026):

- **Regla de los 5 segundos:** 5–8 KPIs arriba con indicador de estado; el resto
  es tendencia y detalle (arriba → abajo: KPIs → tendencias → tabla drill-down).
- **Un número sin comparación es decoración.** Cada KPI debe llevar vs. mes
  anterior o vs. mismo mes del año pasado. Este es exactamente el gap ya
  documentado del módulo ("comparación contra meses anteriores" estaba en el spec
  original y no se implementó).
- Line chart para tendencia de facturación (6–12 meses); stacked bar para aging
  por bucket; evitar pies de >5 rebanadas y dual-axis.
- Sparklines/flechas de tendencia en las tarjetas KPI permiten escanear sin leer.
- Color con semántica fija: rojo = fuera de rango, verde = sano, neutro el resto.

**Aplicación a SMV Hub:** `/finanzas` (Resumen) ya tiene tarjetas KPI; falta el
delta vs. periodo anterior (los datos ya están en el cliente — es cálculo puro en
`lib/finanzas.ts`) y una gráfica de tendencia de 12 meses.

## Hallazgo 4 — Control fiscal mexicano: facturas PPD sin REP (confianza: alta)

Para SMV como emisor de facturas en México:

- Toda factura emitida como **PPD** (pago en parcialidades o diferido) exige un
  **complemento de recepción de pagos (REP, CFDI tipo P)** por cada cobro,
  a más tardar el **5.º día natural del mes siguiente** al pago (RMF 2.7.1.32,
  vigente 2026).
- Sin REP: el cliente no puede deducir (Art. 27-III LISR), hay multas por
  comprobante (~$400–600 MXN c/u) y se traban devoluciones de IVA.
- Mejor práctica de control: **lista mensual de facturas PPD sin REP** antes del
  cierre (los despachos la corren antes del día 10–17).
- Odoo con `l10n_mx_edi` ya genera los REP y expone por API los campos de la
  localización (payment policy PUE/PPD, folio fiscal/UUID, estatus SAT)
  (confianza: media — hay que verificar qué campos expone la instancia de SMV;
  el nombre exacto varía por versión de Odoo).

**Aplicación a SMV Hub:** si el sync trae la política de pago (PUE/PPD) y el
estatus de complementos, `/finanzas/cobranza` podría alertar "facturas PPD con
pago recibido sin REP emitido" — un control fiscal que hoy nadie vigila desde
la app. Requiere ampliar `CAMPOS_FACTURA` en `odooSync.ts` y verificar
disponibilidad de campos vía `scripts/odoo-discovery.mjs`.

## Hallazgo 5 — Qué más se puede traer de Odoo (confianza: media)

- **Pagos** (`account.payment`, `payment_type = inbound`, `state = posted`):
  daría historial de cobros reales (fecha, monto, referencia) para calcular CEI
  con precisión y mostrar "últimos pagos recibidos". Hoy solo se infiere
  `montoPagado = total - residual` por factura, sin fechas de pago.
- **Sync incremental por `write_date`**: patrón estándar para cuando crezca el
  histórico (ya anotado como "ponytail" en `odooSync.ts`); Odoo no expone
  borrados por API — la reconciliación full-set implementada el 2026-07-18 es
  la práctica correcta para detectar cancelaciones.
- Odoo 19+ ofrece API JSON-2 con bearer token; la instancia actual usa JSON-RPC
  clásico — sin urgencia de migrar mientras funcione (confianza: media).

## Contradicciones

- Cadencia de revisión del aging: una fuente (invoices.page) acepta revisión
  mensual como base para negocios chicos; el resto (currentcfo, syntharra,
  beancount) insiste en semanal. Para SMV, con el sync cada 2 h, el dato ya está
  fresco — la cadencia es cuestión de hábito del usuario, no de la app.

## Preguntas abiertas

1. ¿La instancia de Odoo de SMV tiene `l10n_mx_edi` instalado y qué campos CFDI
   expone `account.move` por JSON-RPC? (verificar con `scripts/odoo-discovery.mjs`)
2. ¿SMV emite facturas PPD, o todo es PUE? Si todo es PUE, el hallazgo 4 baja de
   prioridad.
3. ¿Los términos de pago por cliente (net 15/30/60) están en Odoo
   (`invoice_payment_term_id`)? Se necesitan para calcular ADD correctamente.
4. Benchmarks de DSO específicos de maquinados/manufactura en México — las
   fuentes dan rangos genéricos de EE. UU.

## Fuentes

- clearreceivables.com — AR Dashboard Metrics: 10 Essential Widgets (2026)
- stuut.ai — DSO metrics that matter: KPIs beyond DSO (2026)
- intellichief.com / agentcollect.com / ardem.com — AR KPIs for 2026
- currentcfo.com / syntharra.com / beancount.io / invoices.page — AR aging
  playbooks para PyMEs (2026)
- eleken.co / usedatabrain.com / ecosire.com / hanawaterbury.com — diseño de
  dashboards financieros (2026)
- satfacil.com.mx / xpd.mx / cubodeideas.com / SAT (guía de llenado REP) —
  complemento de recepción de pagos CFDI 4.0 (2026)
- odoo.com/documentation (17–19) — localización mexicana `l10n_mx_edi`, API
  externa; stackoverflow — `account.payment.register` por API
