import { describe, it, expect } from "vitest"
import {
  qtyPendingLinea,
  soDebeIncluirse,
  mapearVentaOdooSo,
  mapearLineaOdoo,
  type OdooSaleOrderRaw,
  type OdooSaleLineRaw,
  type OdooPickingRaw,
} from "../functions/src/odoo-ventas-mapeo"

const ahora = new Date("2026-07-30T12:00:00Z")

const SO: OdooSaleOrderRaw = {
  id: 42,
  name: "S00042",
  client_order_ref: "PO-999",
  origin: "PO.20263330",
  partner_id: [10, "Cliente Demo"],
  date_order: "2026-07-01 10:00:00",
  state: "sale",
  invoice_status: "to invoice",
  order_line: [1, 2],
}

const LINEAS: OdooSaleLineRaw[] = [
  {
    id: 1,
    product_id: [100, "[A] Pieza A"],
    name: "Pieza A",
    product_uom_qty: 10,
    qty_delivered: 4,
  },
  {
    id: 2,
    product_id: false,
    name: "Pieza B",
    product_uom_qty: 2,
    qty_delivered: 2,
  },
]

const PICKINGS: OdooPickingRaw[] = [
  {
    id: 7,
    name: "WH/OUT/0001",
    state: "done",
    date_done: "2026-07-15 09:00:00",
    origin: "S00042",
    picking_type_code: "outgoing",
  },
]

describe("qtyPendingLinea", () => {
  it("resta entregado de pedido", () => {
    expect(qtyPendingLinea(10, 4)).toBe(6)
  })

  it("nunca baja de 0", () => {
    expect(qtyPendingLinea(2, 5)).toBe(0)
  })
})

describe("soDebeIncluirse", () => {
  it("incluye sale con to invoice", () => {
    expect(soDebeIncluirse({ state: "sale", invoiceStatus: "to invoice" })).toBe(true)
  })

  it("incluye upselling (como VISION)", () => {
    expect(soDebeIncluirse({ state: "done", invoiceStatus: "upselling" })).toBe(true)
  })

  it("excluye facturado completo aunque haya qty pendiente", () => {
    expect(soDebeIncluirse({ state: "sale", invoiceStatus: "invoiced" })).toBe(false)
  })

  it("excluye draft", () => {
    expect(soDebeIncluirse({ state: "draft", invoiceStatus: "to invoice" })).toBe(false)
  })
})

describe("mapearLineaOdoo / mapearVentaOdooSo", () => {
  it("usa Descripción de línea, no el producto genérico", () => {
    const l = mapearLineaOdoo(LINEAS[0])
    expect(l.odooLineId).toBe(1)
    expect(l.productName).toBe("Pieza A")
    expect(l.productDefaultCode).toBe("A")
    expect(l.qtyPending).toBe(6)
  })

  it("si la descripción está vacía, cae al display del producto", () => {
    const l = mapearLineaOdoo({
      id: 9,
      product_id: [1, "[73181000] Servicio de maquinados"],
      name: "   ",
      product_uom_qty: 1,
      qty_delivered: 0,
    })
    expect(l.productName).toBe("[73181000] Servicio de maquinados")
    expect(l.productDefaultCode).toBe("73181000")
  })

  it("mapea SO completa con PO, partner y remisiones", () => {
    const so = mapearVentaOdooSo(SO, LINEAS, PICKINGS, ahora)
    expect(so.id).toBe("odoo_42")
    expect(so.clientOrderRef).toBe("PO-999")
    expect(so.ordenCompra).toBe("PO.20263330")
    expect(so.partnerName).toBe("Cliente Demo")
    expect(so.lineas).toHaveLength(2)
    expect(so.lineas[0]?.productName).toBe("Pieza A")
    expect(so.remisiones[0]?.name).toBe("WH/OUT/0001")
    expect(so.remisiones[0]?.dateDone).toBe("2026-07-15 09:00:00")
  })

  it("client_order_ref false → null", () => {
    const so = mapearVentaOdooSo({ ...SO, client_order_ref: false }, LINEAS, [], ahora)
    expect(so.clientOrderRef).toBeNull()
  })

  it("origin false → ordenCompra null", () => {
    const so = mapearVentaOdooSo({ ...SO, origin: false }, LINEAS, [], ahora)
    expect(so.ordenCompra).toBeNull()
  })
})
