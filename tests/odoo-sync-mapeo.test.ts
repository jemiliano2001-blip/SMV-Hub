import { describe, it, expect } from "vitest"
import { mapearFacturaOdoo, type OdooFacturaRaw } from "../functions/src/odoo-mapeo"

// Fixtures sintéticos (nombres/montos inventados) que reproducen la MISMA
// forma real observada en Odoo durante el descubrimiento de Fase 0
// (2026-07-15): name "/" en borradores, RINV vía move_type=out_refund (no
// por el prefijo del nombre), invoice_date false en no-posteadas, ref con
// nota de reversión en notas de crédito.

const FACTURA_POSTEADA: OdooFacturaRaw = {
  id: 1478,
  name: "INV/2026/00639",
  move_type: "out_invoice",
  partner_id: [19208, "Cliente Uno"],
  invoice_date: "2026-07-15",
  invoice_date_due: "2026-08-14",
  amount_untaxed: 1000,
  amount_tax: 80,
  amount_total: 1080,
  amount_residual: 1080,
  currency_id: [33, "MXN"],
  payment_state: "not_paid",
  state: "posted",
  ref: "",
  invoice_origin: "2026/S01413",
  company_id: [1, "Compañía de Prueba"],
}

const NOTA_CREDITO: OdooFacturaRaw = {
  id: 1471,
  name: "RINV/2026/00002",
  move_type: "out_refund",
  partner_id: [19165, "Cliente Dos"],
  invoice_date: "2026-07-13",
  invoice_date_due: "2026-07-13",
  amount_untaxed: 500,
  amount_tax: 40,
  amount_total: 540,
  amount_residual: 540,
  currency_id: [33, "MXN"],
  payment_state: "not_paid",
  state: "posted",
  ref: "Reversión de: INV/2026/00635",
  invoice_origin: "2026/S00910",
  company_id: [1, "Compañía de Prueba"],
}

const BORRADOR_SIN_POSTEAR: OdooFacturaRaw = {
  id: 3,
  name: "/",
  move_type: "out_invoice",
  partner_id: [16, "Cliente Tres"],
  invoice_date: false,
  invoice_date_due: "2026-01-15",
  amount_untaxed: 200,
  amount_tax: 16,
  amount_total: 216,
  amount_residual: 216,
  currency_id: [33, "MXN"],
  payment_state: "not_paid",
  state: "cancel",
  ref: false,
  invoice_origin: "S00007",
  company_id: [1, "Compañía de Prueba"],
}

describe("mapearFacturaOdoo", () => {
  const ahora = new Date("2026-07-15T12:00:00Z")

  it("mapea una factura posteada", () => {
    const f = mapearFacturaOdoo(FACTURA_POSTEADA, ahora)
    expect(f.id).toBe("odoo_1478")
    expect(f.numeroFactura).toBe("INV/2026/00639")
    expect(f.cliente).toBe("Cliente Uno")
    expect(f.moneda).toBe("MXN")
    expect(f.subtotal).toBe(1000)
    expect(f.impuestos).toBe(80)
    expect(f.total).toBe(1080)
    expect(f.saldoPendiente).toBe(1080)
    expect(f.montoPagado).toBe(0)
    expect(f.estado).toBe("publicado")
    expect(f.tipo).toBe("factura")
    expect(f.estadoPago).toBe("no_pagado")
    expect(f.origenVenta).toBe("2026/S01413")
    expect(f.origen).toBe("odoo")
    expect(f.sincronizadoEn).toBe(ahora)
  })

  it("identifica una nota de crédito por move_type, no por el prefijo del nombre", () => {
    const f = mapearFacturaOdoo(NOTA_CREDITO, ahora)
    expect(f.tipo).toBe("nota_credito")
    expect(f.numeroFactura).toBe("RINV/2026/00002")
    expect(f.referencia).toBe("Reversión de: INV/2026/00635")
  })

  it("borrador/cancelada: name '/' y invoice_date false se mapean a null, no se inventan", () => {
    const f = mapearFacturaOdoo(BORRADOR_SIN_POSTEAR, ahora)
    expect(f.numeroFactura).toBe("/")
    expect(f.fechaFactura).toBeNull()
    expect(f.estado).toBe("cancelado")
  })

  it("ref vacío o false se normaliza a null", () => {
    expect(mapearFacturaOdoo(FACTURA_POSTEADA, ahora).referencia).toBeNull() // ref: ""
    expect(mapearFacturaOdoo(BORRADOR_SIN_POSTEAR, ahora).referencia).toBeNull() // ref: false
  })

  it("calcula montoPagado como total - saldoPendiente", () => {
    const f = mapearFacturaOdoo({ ...FACTURA_POSTEADA, amount_residual: 400 }, ahora)
    expect(f.montoPagado).toBe(1080 - 400)
  })

  describe("mapeo de payment_state (6 valores reales, no 4)", () => {
    const casos: Array<[string, string]> = [
      ["not_paid", "no_pagado"],
      ["partial", "pagado_parcial"],
      ["paid", "pagado"],
      ["in_payment", "pagado"],
      ["reversed", "revertido"],
      ["invoicing_legacy", "no_pagado"],
    ]
    for (const [payment_state, esperado] of casos) {
      it(`${payment_state} → ${esperado}`, () => {
        const f = mapearFacturaOdoo({ ...FACTURA_POSTEADA, payment_state }, ahora)
        expect(f.estadoPago).toBe(esperado)
      })
    }
  })

  it("compañía y partner faltantes (false) no truenan, quedan en 0/''", () => {
    const f = mapearFacturaOdoo({ ...FACTURA_POSTEADA, partner_id: false, company_id: false }, ahora)
    expect(f.odooPartnerId).toBe(0)
    expect(f.cliente).toBe("")
    expect(f.odooCompanyId).toBe(0)
  })
})
