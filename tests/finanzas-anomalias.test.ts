import { describe, expect, it } from "vitest"
import type { FacturaCliente } from "@/lib/schemas"
import {
  detectarAnomaliasFacturacion,
  detectarAnomaliasIntegridad,
  detectarAnomaliasFinancieras,
} from "@/lib/finanzas-anomalias"

function makeFactura(overrides: Partial<FacturaCliente> = {}): FacturaCliente {
  return {
    id: "odoo_1",
    odooId: 1,
    odooCompanyId: 1,
    numeroFactura: "INV/2026/00001",
    cliente: "Cliente A",
    odooPartnerId: 100,
    fechaFactura: "2026-01-10",
    fechaVencimiento: "2026-02-10",
    moneda: "MXN",
    subtotal: 1000,
    impuestos: 160,
    total: 1160,
    saldoPendiente: 1160,
    montoPagado: 0,
    estadoPago: "no_pagado",
    estado: "publicado",
    tipo: "factura",
    referencia: null,
    origenVenta: null,
    origen: "odoo",
    sincronizadoEn: new Date("2026-01-10"),
    creadoEn: new Date("2026-01-10"),
    actualizadoEn: new Date("2026-01-10"),
    ...overrides,
  }
}

describe("detectarAnomaliasIntegridad", () => {
  it("detecta importes que no cuadran", () => {
    const alertas = detectarAnomaliasIntegridad([
      makeFactura({ total: 1200 }),
    ])

    expect(alertas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "total_no_cuadra", severidad: "alta" }),
      ])
    )
  })

  it("detecta vencimiento anterior a la fecha de factura", () => {
    const alertas = detectarAnomaliasIntegridad([
      makeFactura({ fechaVencimiento: "2026-01-01" }),
    ])

    expect(alertas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "fecha_inconsistente" }),
      ])
    )
  })

  it("detecta facturas duplicadas por empresa y folio", () => {
    const alertas = detectarAnomaliasIntegridad([
      makeFactura({ id: "odoo_1" }),
      makeFactura({ id: "odoo_2" }),
    ])

    expect(alertas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "factura_duplicada", referencias: expect.arrayContaining(["odoo_1", "odoo_2"]) }),
      ])
    )
  })
})

describe("detectarAnomaliasFacturacion", () => {
  it("detecta una caída fuerte contra la mediana histórica", () => {
    const historico = [
      ["2025-07", 1000], ["2025-08", 1100], ["2025-09", 900],
      ["2025-10", 1000], ["2025-11", 1050], ["2025-12", 950],
      ["2026-01", 1000], ["2026-02", 1000], ["2026-03", 1000],
      ["2026-04", 1000], ["2026-05", 1000], ["2026-06", 200],
    ] as const
    const facturas = historico.map(([mes, total], index) =>
      makeFactura({
        id: `odoo_${index + 1}`,
        fechaFactura: `${mes}-15`,
        total,
        subtotal: total - 160,
        impuestos: 160,
        saldoPendiente: 0,
      })
    )

    const alertas = detectarAnomaliasFacturacion(facturas, new Date(2026, 6, 20))

    expect(alertas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "facturacion_fuera_rango", periodo: "2026-06" }),
      ])
    )
  })

  it("separa las monedas y no genera una alerta con cuatro observaciones insuficientes", () => {
    const facturas = [
      makeFactura({ moneda: "MXN", fechaFactura: "2026-05-15", total: 1000 }),
      makeFactura({ moneda: "MXN", fechaFactura: "2026-06-15", total: 200 }),
      makeFactura({ moneda: "USD", fechaFactura: "2026-05-15", total: 1000 }),
      makeFactura({ moneda: "USD", fechaFactura: "2026-06-15", total: 200 }),
    ]

    const alertas = detectarAnomaliasFacturacion(facturas, new Date(2026, 6, 20))

    expect(alertas).toEqual([])
  })
})

describe("detectarAnomaliasFinancieras", () => {
  it("combina integridad y facturación en una sola salida", () => {
    const alertas = detectarAnomaliasFinancieras([
      makeFactura({ total: 1200 }),
    ], new Date(2026, 6, 20))

    expect(alertas.some((alerta) => alerta.tipo === "total_no_cuadra")).toBe(true)
  })
})
