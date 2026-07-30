/**
 * Mapeo puro: sale.order (+ líneas + pickings) → forma de ventas_odoo_so.
 * Sin firebase-admin para poder probarse con Vitest desde la raíz del repo.
 */

export type OdooRelacion = [number, string] | false

export type OdooSaleOrderRaw = {
  id: number
  name: string
  client_order_ref: string | false
  partner_id: OdooRelacion
  date_order: string | false
  state: string
  invoice_status: string
  order_line: number[]
}

export type OdooSaleLineRaw = {
  id: number
  product_id: OdooRelacion
  name: string
  product_uom_qty: number
  qty_delivered: number
}

export type OdooPickingRaw = {
  id: number
  name: string
  state: string
  date_done: string | false
  origin: string | false
  picking_type_code?: string
}

export type VentaOdooLineaNormalizada = {
  odooLineId: number
  productName: string
  productDefaultCode: string | null
  qtyOrdered: number
  qtyDelivered: number
  qtyPending: number
}

export type VentaOdooRemisionNormalizada = {
  name: string
  state: string
  dateDone: string | null
}

export type VentaOdooSoNormalizada = {
  id: string
  odooId: number
  name: string
  clientOrderRef: string | null
  partnerId: number
  partnerName: string
  dateOrder: string | null
  state: string
  invoiceStatus: string
  lineas: VentaOdooLineaNormalizada[]
  remisiones: VentaOdooRemisionNormalizada[]
  sincronizadoEn: Date
}

function textoOrNull(v: string | false | undefined): string | null {
  if (v === false || v === undefined || v === "") return null
  return v
}

function partnerDe(rel: OdooRelacion): { id: number; name: string } {
  if (rel === false) return { id: 0, name: "" }
  return { id: rel[0], name: rel[1] }
}

export function qtyPendingLinea(ordered: number, delivered: number): number {
  const o = Number.isFinite(ordered) ? ordered : 0
  const d = Number.isFinite(delivered) ? delivered : 0
  return Math.max(0, o - d)
}

export function soDebeIncluirse(so: {
  state: string
  invoiceStatus: string
  lineas: readonly { qtyPending: number }[]
}): boolean {
  if (so.state !== "sale" && so.state !== "done") return false
  if (so.invoiceStatus !== "invoiced") return true
  return so.lineas.some((l) => l.qtyPending > 0)
}

export function mapearLineaOdoo(raw: OdooSaleLineRaw): VentaOdooLineaNormalizada {
  const productName =
    raw.product_id === false
      ? raw.name
      : raw.product_id[1] || raw.name
  const qtyOrdered = Number(raw.product_uom_qty) || 0
  const qtyDelivered = Number(raw.qty_delivered) || 0
  return {
    odooLineId: raw.id,
    productName,
    productDefaultCode: null,
    qtyOrdered,
    qtyDelivered,
    qtyPending: qtyPendingLinea(qtyOrdered, qtyDelivered),
  }
}

export function mapearRemisionOdoo(raw: OdooPickingRaw): VentaOdooRemisionNormalizada {
  return {
    name: raw.name,
    state: raw.state,
    dateDone: textoOrNull(raw.date_done),
  }
}

export function mapearVentaOdooSo(
  raw: OdooSaleOrderRaw,
  lineas: readonly OdooSaleLineRaw[],
  pickings: readonly OdooPickingRaw[],
  sincronizadoEn: Date
): VentaOdooSoNormalizada {
  const partner = partnerDe(raw.partner_id)
  const lineasMapped = lineas.map(mapearLineaOdoo)
  const remisiones = pickings
    .filter((p) => !p.picking_type_code || p.picking_type_code === "outgoing")
    .map(mapearRemisionOdoo)

  return {
    id: `odoo_${raw.id}`,
    odooId: raw.id,
    name: raw.name,
    clientOrderRef: textoOrNull(raw.client_order_ref),
    partnerId: partner.id,
    partnerName: partner.name,
    dateOrder: textoOrNull(raw.date_order),
    state: raw.state,
    invoiceStatus: raw.invoice_status,
    lineas: lineasMapped,
    remisiones,
    sincronizadoEn,
  }
}
