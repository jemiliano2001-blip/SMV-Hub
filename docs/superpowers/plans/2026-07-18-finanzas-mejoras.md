# Plan: Mejoras al módulo de Finanzas

> Deriva del research en `docs/superpowers/specs/2026-07-18-finanzas-mejoras-research.md`.
> Tres fases independientes: cada una se puede entregar y desplegar por separado.
> Reglas transversales: nunca mezclar monedas en un agregado; toda lógica nueva es
> pura en `lib/finanzas.ts` con tests en `tests/finanzas.test.ts`; la UI no importa
> Firestore directamente.

---

## Fase 1 — KPIs con contexto y tendencia (solo cliente, sin tocar sync)

Todo se calcula con los datos que ya llegan vía `useFinanzasFacturas`.

### Task 1.1 — Deltas vs. periodo anterior (`lib/finanzas.ts`)

- `compararKpis(actual: KpisFinanzas, anterior: KpisFinanzas): DeltaKpis` — delta
  absoluto y porcentual por campo, con manejo de división entre cero (anterior = 0
  → delta porcentual `null`, la UI muestra "—").
- En `/finanzas` (Resumen): calcular KPIs del mes seleccionado y del mes anterior
  (`rangoDeMes` ya existe) y mostrar en cada tarjeta la flecha + % vs. mes anterior.
  Color semántico: verde arriba / rojo abajo para facturación; invertido no aplica
  (no hay métricas de gasto aquí).
- Tests: delta positivo, negativo, anterior en cero, meses sin facturas.

### Task 1.2 — Tendencia de facturación 12 meses (`lib/finanzas.ts` + Resumen)

- `serieMensual(facturas: FacturaCliente[], meses: number, hasta: Date): PuntoMensual[]`
  — facturación neta (facturas − notas de crédito) por mes, una serie por moneda.
- Gráfica de líneas en `/finanzas` (SVG propio o CSS, sin dependencia nueva de
  charting salvo que ya exista una en el repo — verificar antes; si se necesita
  librería, proponerla explícitamente en el PR).
- Tests: serie con huecos (meses sin facturas = 0), notas de crédito restando,
  separación por moneda.

### Task 1.3 — Buckets de aging + KPIs de cobranza (`lib/finanzas.ts` + Cobranza)

- `bucketAging(f: FacturaCliente, hoy: Date): "corriente" | "b1_30" | "b31_60" | "b61_90" | "b90"`
  (reutiliza `diasAtraso`).
- `distribucionAging(facturas, hoy)`: total y % por bucket, por moneda.
- `calcularDso(facturas, periodo)`: DSO estándar (saldo por cobrar / facturación
  del periodo × días del periodo).
- `calcularCei(facturas, periodo)`: CEI aproximado con los datos del espejo
  (saldo inicial + facturación del periodo − saldo final) / (saldo inicial +
  facturación − saldo corriente final) × 100. Documentar en el código que es
  aproximación (sin fechas de pago reales hasta Fase 3).
- UI Cobranza: fila de KPIs (total vencido, DSO, CEI, % en 90+) + stacked bar de
  distribución por bucket + tabla agrupada por bucket con la acción sugerida como
  subtítulo ("0–30: recordatorio", "31–60: contactar y comprometer fecha", "61–90:
  llamada directa", "90+: decisión formal"). Umbral visual: 90+ > 5% del total → rojo.
- Tests: buckets en los bordes (día 30/31, 60/61, 90/91), DSO y CEI con casos
  conocidos a mano, todo separado por moneda.

**Entrega Fase 1:** `npm test`, `npm run lint`, `npm run build` verdes. Sin deploy
de functions (no se toca el sync).

---

## Fase 2 — Cobranza accionable

### Task 2.1 — Top clientes vencidos y priorización

- En Cobranza: tarjeta "Top 5 clientes con saldo vencido" (monto y factura más
  antigua), ordenado por monto vencido desc, por moneda.
- Resaltar facturas grandes en bucket 31–60 (la zona de mayor retorno del esfuerzo
  de cobranza según el research).

### Task 2.2 — Seguimiento local de cobranza (colección nueva `finanzas_seguimiento`)

- El espejo `finanzas_facturas` solo lo escribe el sync; el seguimiento vive aparte,
  keyed por id de factura: `{ facturaId, nota, promesaPagoFecha, enDisputa,
  actualizadoEn, actualizadoPor }`.
- Schema Zod en `lib/schemas.ts` (`SeguimientoCobranzaSchema`), CRUD en
  `lib/finanzas-seguimiento.ts`, hook `useSeguimientoCobranza`.
- `firestore.rules`: read/write solo admin (mismo patrón que `finanzas_*` pero con
  write permitido para admin). **Requiere deploy de rules.**
- UI: expandir fila de factura vencida → nota + fecha promesa + toggle "en disputa".
  Facturas en disputa se excluyen del flujo de acciones y se listan aparte.
- Trazabilidad: `actualizadoEn` + `actualizadoPor` (email de sesión) obligatorios.

**Entrega Fase 2:** tests de schema y CRUD (mock Firestore como en
`lib-ordenes.test.ts`), deploy de `firestore:rules`.

---

## Fase 3 — Enriquecer el sync con Odoo (condicional a descubrimiento)

### Task 3.0 — Descubrimiento (bloqueante para el resto de la fase)

- Correr `scripts/odoo-discovery.mjs` contra la instancia real para verificar:
  ¿existe `l10n_mx_edi`? ¿`account.move` expone política de pago PUE/PPD, UUID,
  estatus de complementos? ¿`account.payment` está accesible?
- Si SMV solo emite PUE → descartar Task 3.2 (control REP) y documentarlo.

### Task 3.1 — Sync de pagos (`account.payment`)

- Nueva colección espejo `finanzas_pagos` (inbound + posted): fecha, monto, moneda,
  cliente, referencia. Mismo patrón que `finanzas_facturas` (mapeo puro testeable +
  batches + reconciliación de huérfanos + guard de respuesta vacía).
- Con fechas de pago reales: recalcular CEI exacto y mostrar "últimos cobros
  recibidos" en Resumen.

### Task 3.2 — Alerta de facturas PPD sin REP (solo si 3.0 lo confirma)

- Ampliar `CAMPOS_FACTURA` con los campos de la localización mexicana.
- Regla pura: factura PPD con `montoPagado > 0` y sin complemento timbrado, con
  fecha límite (5.º día natural del mes siguiente al pago) — banner de alerta en
  Cobranza con la lista y los días restantes.

**Entrega Fase 3:** tests de mapeo, build de functions, **deploy de functions**.

---

## Orden recomendado

1 → 2 → 3. La Fase 1 es la de mayor valor inmediato y cero riesgo (puro cliente).
La 2 introduce la primera escritura del módulo (colección nueva, rules). La 3
depende del descubrimiento contra Odoo real.
