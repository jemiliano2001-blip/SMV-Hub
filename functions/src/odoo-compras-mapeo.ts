/**
 * Mapeo puro Odoo compras → espejo crudo + ítems intermedios.
 * Lógica de categoría/metal vive en ./compras-odoo (espejo de lib/compras-odoo).
 * Sin firebase-admin — testeable con Vitest.
 */

import { construirItemDesdeLinea, type CompraOdooItemNormalizado } from "./compras-odoo/construir-item"
import { idsHuerfanosCompras } from "./compras-odoo/huerfanos"

export { idsHuerfanosCompras }
export type { CompraOdooItemNormalizado }

export type OdooRelacion = [number, string] | false

export type OdooPoLineRaw = {
  id: number
  name: string
  product_id: OdooRelacion
  product_qty: number
  price_unit: number
  price_subtotal: number
  /** Clave SAT si el producto la trae vía read adicional. */
  clave_prod_serv?: string | false | null
}

export type OdooPoRaw = {
  id: number
  name: string
  partner_id: OdooRelacion
  date_order: string | false
  date_planned: string | false
  amount_total: number
  currency_id: OdooRelacion
  state: string
  user_id: OdooRelacion
  company_id: OdooRelacion
  order_line?: number[]
  /** Líneas hidratadas por el sync (no vienen en search_read del PO). */
  _lineas?: OdooPoLineRaw[]
}

export type OdooInvoiceLineRaw = {
  id: number
  name: string
  product_id: OdooRelacion
  quantity: number
  price_unit: number
  price_subtotal: number
  display_type?: string | false
  clave_prod_serv?: string | false | null
}

export type OdooVendorBillRaw = {
  id: number
  name: string
  move_type: string
  partner_id: OdooRelacion
  invoice_date: string | false
  invoice_date_due?: string | false
  amount_untaxed: number
  amount_tax: number
  amount_total: number
  amount_residual?: number
  payment_state?: string
  currency_id: OdooRelacion
  state: string
  invoice_origin: string | false
  company_id: OdooRelacion
  invoice_line_ids?: number[]
  _lineas?: OdooInvoiceLineRaw[]
}

export type PoCrudoNormalizado = {
  id: string
  odooId: number
  referencia: string
  proveedorNombre: string
  odooPartnerId: number
  fechaOrden: string | null
  fechaLimite: string | null
  moneda: string
  total: number
  estado: string
  esRfq: boolean
  representante: string | null
  odooCompanyId: number
  lineas: {
    odooLineId: number
    descripcion: string
    cantidad: number
    precioUnitario: number
    subtotal: number
    productOdooId: number | null
    claveProdServ: string | null
  }[]
  origen: "odoo"
  sincronizadoEn: Date
}

export type FacturaProveedorCrudoNormalizado = {
  id: string
  odooId: number
  numeroFactura: string
  proveedorNombre: string
  odooPartnerId: number
  fechaFactura: string | null
  fechaVencimiento: string | null
  moneda: string
  subtotal: number
  impuestos: number
  total: number
  saldoPendiente: number
  estadoPago: string
  estado: string
  tipo: "factura_proveedor" | "nota_credito_proveedor"
  origenPo: string | null
  odooCompanyId: number
  lineas: {
    odooLineId: number
    descripcion: string
    cantidad: number
    precioUnitario: number
    subtotal: number
    productOdooId: number | null
    claveProdServ: string | null
  }[]
  origen: "odoo"
  sincronizadoEn: Date
}

export type PartnerCompraNormalizado = {
  odooPartnerId: number
  nombre: string
  pais: string
  email: string
  telefono: string
  moneda: "MXN" | "USD"
}

function textoOrNull(v: string | false | null | undefined): string | null {
  if (v === false || v == null || v === "") return null
  return v
}

function claveOrNull(v: string | false | null | undefined): string | null {
  const t = textoOrNull(v === false ? null : v)
  if (!t) return null
  const digits = t.replace(/\D/g, "")
  return digits.length === 8 ? digits : null
}

const ESTADOS_RFQ = new Set(["draft", "sent", "to approve", "to_approve"])

export function mapearPoOdoo(raw: OdooPoRaw, ahora: Date = new Date()): PoCrudoNormalizado {
  const lineasRaw = raw._lineas ?? []
  return {
    id: `po_${raw.id}`,
    odooId: raw.id,
    referencia: raw.name,
    proveedorNombre: raw.partner_id ? raw.partner_id[1] : "",
    odooPartnerId: raw.partner_id ? raw.partner_id[0] : 0,
    fechaOrden: textoOrNull(raw.date_order)?.slice(0, 10) ?? null,
    fechaLimite: textoOrNull(raw.date_planned)?.slice(0, 10) ?? null,
    moneda: raw.currency_id ? raw.currency_id[1] : "",
    total: raw.amount_total,
    estado: raw.state,
    esRfq: ESTADOS_RFQ.has(raw.state),
    representante: raw.user_id ? raw.user_id[1] : null,
    odooCompanyId: raw.company_id ? raw.company_id[0] : 0,
    lineas: lineasRaw.map((l) => ({
      odooLineId: l.id,
      descripcion: l.name ?? "",
      cantidad: l.product_qty,
      precioUnitario: l.price_unit,
      subtotal: l.price_subtotal,
      productOdooId: l.product_id ? l.product_id[0] : null,
      claveProdServ: claveOrNull(l.clave_prod_serv),
    })),
    origen: "odoo",
    sincronizadoEn: ahora,
  }
}

export function mapearFacturaProveedorOdoo(
  raw: OdooVendorBillRaw,
  ahora: Date = new Date()
): FacturaProveedorCrudoNormalizado {
  const lineasRaw = (raw._lineas ?? []).filter((l) => !l.display_type)
  const saldoPendiente = typeof raw.amount_residual === "number" ? raw.amount_residual : raw.amount_total
  const estadoPago = raw.payment_state || (raw.state === "posted" ? (saldoPendiente <= 0 ? "paid" : "not_paid") : "draft")

  return {
    id: `vi_${raw.id}`,
    odooId: raw.id,
    numeroFactura: raw.name,
    proveedorNombre: raw.partner_id ? raw.partner_id[1] : "",
    odooPartnerId: raw.partner_id ? raw.partner_id[0] : 0,
    fechaFactura: textoOrNull(raw.invoice_date),
    fechaVencimiento: textoOrNull(raw.invoice_date_due),
    moneda: raw.currency_id ? raw.currency_id[1] : "",
    subtotal: raw.amount_untaxed,
    impuestos: raw.amount_tax,
    total: raw.amount_total,
    saldoPendiente,
    estadoPago,
    estado: raw.state,
    tipo: raw.move_type === "in_refund" ? "nota_credito_proveedor" : "factura_proveedor",
    origenPo: textoOrNull(raw.invoice_origin),
    odooCompanyId: raw.company_id ? raw.company_id[0] : 0,
    lineas: lineasRaw.map((l) => ({
      odooLineId: l.id,
      descripcion: l.name ?? "",
      cantidad: l.quantity,
      precioUnitario: l.price_unit,
      subtotal: l.price_subtotal,
      productOdooId: l.product_id ? l.product_id[0] : null,
      claveProdServ: claveOrNull(l.clave_prod_serv),
    })),
    origen: "odoo",
    sincronizadoEn: ahora,
  }
}

/** Capa intermedia derivada — no se escribe en docs crudos. */
export function itemsDesdePoCrudo(po: PoCrudoNormalizado): CompraOdooItemNormalizado[] {
  return po.lineas.map((l) =>
    construirItemDesdeLinea({
      fuente: "po",
      odooDocId: po.odooId,
      odooLineId: l.odooLineId,
      referenciaDoc: po.referencia,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      subtotal: l.subtotal,
      moneda: po.moneda,
      fecha: po.fechaOrden,
      odooPartnerId: po.odooPartnerId,
      proveedorNombre: po.proveedorNombre,
      claveProdServ: l.claveProdServ,
      productOdooId: l.productOdooId,
      esRfq: po.esRfq,
    })
  )
}

export function itemsDesdeFacturaCrudo(
  factura: FacturaProveedorCrudoNormalizado
): CompraOdooItemNormalizado[] {
  return factura.lineas.map((l) =>
    construirItemDesdeLinea({
      fuente: "factura",
      odooDocId: factura.odooId,
      odooLineId: l.odooLineId,
      referenciaDoc: factura.numeroFactura,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      subtotal: l.subtotal,
      moneda: factura.moneda,
      fecha: factura.fechaFactura,
      odooPartnerId: factura.odooPartnerId,
      proveedorNombre: factura.proveedorNombre,
      claveProdServ: l.claveProdServ,
      origenPo: factura.origenPo,
      productOdooId: l.productOdooId,
      esRfq: false,
    })
  )
}

export function mapearPartnerCompra(raw: {
  id: number
  name: string
  country_id?: OdooRelacion
  email?: string | false
  phone?: string | false
}, opts?: { monedaPreferida?: "MXN" | "USD" }): PartnerCompraNormalizado {
  const countryName = raw.country_id ? raw.country_id[1] : ""
  const esUs = /estados unidos|united states|\busa\b|u\.s\.a|u\.s\./i.test(countryName)
  const esMx =
    /m[eé]xico|mexico|\bmx\b/i.test(countryName) ||
    countryName.toLowerCase() === "mexico"
  // Partners del módulo Purchase de SMV son MX por defecto si Odoo no trae país.
  const moneda: "MXN" | "USD" =
    opts?.monedaPreferida ??
    (esUs ? "USD" : esMx || !countryName ? "MXN" : "USD")
  const pais =
    countryName ||
    (moneda === "MXN" ? "México" : "Estados Unidos")
  return {
    odooPartnerId: raw.id,
    nombre: raw.name,
    pais,
    email: textoOrNull(raw.email) ?? "",
    telefono: textoOrNull(raw.phone) ?? "",
    moneda,
  }
}
