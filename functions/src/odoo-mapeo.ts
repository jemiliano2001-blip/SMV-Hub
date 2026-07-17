/**
 * Mapeo puro: registro crudo de `account.move` (JSON-RPC de Odoo) → forma
 * normalizada que espera `finanzas_facturas`. Sin dependencias de
 * firebase-admin/firebase-functions para poder probarse con Vitest desde la
 * raíz del repo.
 *
 * El shape de salida debe mantenerse igual a `FacturaClienteSchema` en
 * `lib/schemas.ts` (la app Next.js) — no se importa desde ahí porque
 * `functions/` compila como paquete independiente.
 */

export type OdooRelacion = [number, string] | false

export type OdooFacturaRaw = {
  id: number
  name: string
  move_type: string // "out_invoice" | "out_refund" (el domain de búsqueda ya filtra a estos dos)
  partner_id: OdooRelacion
  invoice_date: string | false
  invoice_date_due: string | false
  amount_untaxed: number
  amount_tax: number
  amount_total: number
  amount_residual: number
  currency_id: OdooRelacion
  payment_state: string
  state: string
  ref: string | false
  invoice_origin: string | false
  company_id: OdooRelacion
}

export type FacturaClienteNormalizada = {
  id: string
  odooId: number
  odooCompanyId: number
  numeroFactura: string
  cliente: string
  odooPartnerId: number
  fechaFactura: string | null
  fechaVencimiento: string | null
  moneda: string
  subtotal: number
  impuestos: number
  total: number
  saldoPendiente: number
  montoPagado: number
  estadoPago: "no_pagado" | "pagado_parcial" | "pagado" | "revertido"
  estado: "borrador" | "publicado" | "cancelado"
  tipo: "factura" | "nota_credito"
  referencia: string | null
  origenVenta: string | null
  origen: "odoo"
  sincronizadoEn: Date
}

const ESTADO_POR_STATE: Record<string, FacturaClienteNormalizada["estado"]> = {
  draft: "borrador",
  posted: "publicado",
  cancel: "cancelado",
}

// paid e in_payment ambos significan "el taller ya recibió el dinero" — solo
// difieren en si Odoo ya concilió el pago contra el banco. invoicing_legacy
// es un caso raro de datos migrados antes de activar el seguimiento de pagos.
const ESTADO_PAGO_POR_PAYMENT_STATE: Record<string, FacturaClienteNormalizada["estadoPago"]> = {
  not_paid: "no_pagado",
  partial: "pagado_parcial",
  paid: "pagado",
  in_payment: "pagado",
  reversed: "revertido",
  invoicing_legacy: "no_pagado",
}

function textoOrNull(v: string | false): string | null {
  return v === false || v === "" ? null : v
}

export function mapearFacturaOdoo(
  raw: OdooFacturaRaw,
  ahora: Date = new Date()
): FacturaClienteNormalizada {
  return {
    id: `odoo_${raw.id}`,
    odooId: raw.id,
    odooCompanyId: raw.company_id ? raw.company_id[0] : 0,
    numeroFactura: raw.name,
    cliente: raw.partner_id ? raw.partner_id[1] : "",
    odooPartnerId: raw.partner_id ? raw.partner_id[0] : 0,
    fechaFactura: textoOrNull(raw.invoice_date),
    fechaVencimiento: textoOrNull(raw.invoice_date_due),
    moneda: raw.currency_id ? raw.currency_id[1] : "",
    subtotal: raw.amount_untaxed,
    impuestos: raw.amount_tax,
    total: raw.amount_total,
    saldoPendiente: raw.amount_residual,
    montoPagado: raw.amount_total - raw.amount_residual,
    estadoPago: ESTADO_PAGO_POR_PAYMENT_STATE[raw.payment_state] ?? "no_pagado",
    estado: ESTADO_POR_STATE[raw.state] ?? "borrador",
    tipo: raw.move_type === "out_refund" ? "nota_credito" : "factura",
    referencia: textoOrNull(raw.ref),
    origenVenta: textoOrNull(raw.invoice_origin),
    origen: "odoo",
    sincronizadoEn: ahora,
  }
}
