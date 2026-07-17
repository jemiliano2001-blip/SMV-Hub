import { describe, it, expect } from "vitest"
import {
  facturasValidas,
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  calcularKpisFinanzas,
  agruparPorCliente,
  clasificarCobranza,
  diasAtraso,
  periodoPreset,
  rangoDeMes,
  mesActualStr,
} from "@/lib/finanzas"
import type { FacturaCliente } from "@/lib/schemas"

// ── Helper ────────────────────────────────────────────────────────────────────

function makeFactura(overrides: Partial<FacturaCliente> = {}): FacturaCliente {
  return {
    id: "odoo_1",
    odooId: 1,
    odooCompanyId: 1,
    numeroFactura: "INV/2026/00001",
    cliente: "AFX Industries",
    odooPartnerId: 100,
    fechaFactura: "2026-06-10",
    fechaVencimiento: "2026-07-10",
    moneda: "MXN",
    subtotal: 1000,
    impuestos: 80,
    total: 1080,
    saldoPendiente: 1080,
    montoPagado: 0,
    estadoPago: "no_pagado",
    estado: "publicado",
    tipo: "factura",
    referencia: null,
    origenVenta: "2026/S00001",
    origen: "odoo",
    sincronizadoEn: new Date("2026-06-10"),
    creadoEn: new Date("2026-06-10"),
    actualizadoEn: new Date("2026-06-10"),
    ...overrides,
  }
}

// ── facturasValidas ───────────────────────────────────────────────────────────

describe("facturasValidas", () => {
  it("excluye borradores y canceladas", () => {
    const facturas = [
      makeFactura({ estado: "publicado" }),
      makeFactura({ estado: "borrador" }),
      makeFactura({ estado: "cancelado" }),
    ]
    expect(facturasValidas(facturas)).toHaveLength(1)
  })
})

// ── moneda ────────────────────────────────────────────────────────────────────

describe("monedasPresentes / filtrarPorMoneda", () => {
  it("nunca mezcla MXN y USD en un mismo cálculo", () => {
    const facturas = [
      makeFactura({ moneda: "MXN", total: 1000 }),
      makeFactura({ moneda: "USD", total: 500 }),
    ]
    expect(monedasPresentes(facturas).sort()).toEqual(["MXN", "USD"])

    const soloMxn = filtrarPorMoneda(facturas, "MXN")
    const kpis = calcularKpisFinanzas(soloMxn)
    expect(kpis.facturacionTotal).toBe(1000)
  })
})

// ── filtrarPorRango ───────────────────────────────────────────────────────────

describe("filtrarPorRango", () => {
  it("incluye facturas publicadas dentro del rango", () => {
    const factura = makeFactura({ fechaFactura: "2026-06-10" })
    const resultado = filtrarPorRango(
      [factura],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(1)
  })

  it("excluye borradores aunque su fecha caiga en rango", () => {
    const factura = makeFactura({ estado: "borrador", fechaFactura: "2026-06-10" })
    const resultado = filtrarPorRango(
      [factura],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(0)
  })

  it("excluye facturas sin fechaFactura (borrador sin postear)", () => {
    const factura = makeFactura({ fechaFactura: null })
    const resultado = filtrarPorRango(
      [factura],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(0)
  })
})

// ── calcularKpisFinanzas ──────────────────────────────────────────────────────

describe("calcularKpisFinanzas", () => {
  it("resta las notas de crédito de la facturación neta", () => {
    const facturas = [
      makeFactura({ tipo: "factura", total: 1000, subtotal: 925.93, impuestos: 74.07 }),
      makeFactura({ tipo: "nota_credito", total: 200, subtotal: 185.19, impuestos: 14.81 }),
    ]
    const kpis = calcularKpisFinanzas(facturas)
    expect(kpis.facturacionTotal).toBeCloseTo(800)
    expect(kpis.numFacturas).toBe(1)
    expect(kpis.numNotasCredito).toBe(1)
  })

  it("no cuenta facturas canceladas", () => {
    const facturas = [
      makeFactura({ estado: "publicado", total: 1000 }),
      makeFactura({ estado: "cancelado", total: 99999 }),
    ]
    expect(calcularKpisFinanzas(facturas).facturacionTotal).toBe(1000)
  })

  it("cuenta clientes únicos", () => {
    const facturas = [
      makeFactura({ cliente: "AFX" }),
      makeFactura({ cliente: "AFX" }),
      makeFactura({ cliente: "OHD" }),
    ]
    expect(calcularKpisFinanzas(facturas).numClientes).toBe(2)
  })
})

// ── agruparPorCliente ─────────────────────────────────────────────────────────

describe("agruparPorCliente", () => {
  it("agrupa y calcula % de participación sobre el total", () => {
    const facturas = [
      makeFactura({ cliente: "AFX", total: 750 }),
      makeFactura({ cliente: "OHD", total: 250 }),
    ]
    const grupos = agruparPorCliente(facturas)
    expect(grupos[0].cliente).toBe("AFX")
    expect(grupos[0].pctDelTotal).toBeCloseTo(75)
    expect(grupos[1].pctDelTotal).toBeCloseTo(25)
  })

  it("ordena de mayor a menor total", () => {
    const facturas = [
      makeFactura({ cliente: "Chico", total: 10 }),
      makeFactura({ cliente: "Grande", total: 1000 }),
    ]
    const grupos = agruparPorCliente(facturas)
    expect(grupos[0].cliente).toBe("Grande")
  })
})

// ── cobranza ──────────────────────────────────────────────────────────────────

describe("clasificarCobranza", () => {
  const hoy = new Date(2026, 6, 15) // constructor local, no parseo ISO (evita off-by-one por zona horaria)

  it("pagada cuando saldoPendiente es 0", () => {
    const factura = makeFactura({ saldoPendiente: 0 })
    expect(clasificarCobranza(factura, hoy)).toBe("pagada")
  })

  it("pendiente cuando debe y no ha vencido", () => {
    const factura = makeFactura({ saldoPendiente: 500, fechaVencimiento: "2026-08-01" })
    expect(clasificarCobranza(factura, hoy)).toBe("pendiente")
  })

  it("vencida cuando debe y ya pasó la fecha de vencimiento", () => {
    const factura = makeFactura({ saldoPendiente: 500, fechaVencimiento: "2026-06-01" })
    expect(clasificarCobranza(factura, hoy)).toBe("vencida")
  })

  it("pago parcial con saldo > 0 sigue pendiente/vencida, no pagada", () => {
    const factura = makeFactura({
      estadoPago: "pagado_parcial",
      saldoPendiente: 100,
      fechaVencimiento: "2026-08-01",
    })
    expect(clasificarCobranza(factura, hoy)).toBe("pendiente")
  })
})

describe("diasAtraso", () => {
  const hoy = new Date(2026, 6, 15) // constructor local, no parseo ISO (evita off-by-one por zona horaria)

  it("0 si ya está pagada", () => {
    const factura = makeFactura({ saldoPendiente: 0, fechaVencimiento: "2026-06-01" })
    expect(diasAtraso(factura, hoy)).toBe(0)
  })

  it("0 si aún no vence", () => {
    const factura = makeFactura({ saldoPendiente: 500, fechaVencimiento: "2026-08-01" })
    expect(diasAtraso(factura, hoy)).toBe(0)
  })

  it("cuenta los días desde el vencimiento", () => {
    const factura = makeFactura({ saldoPendiente: 500, fechaVencimiento: "2026-07-01" })
    expect(diasAtraso(factura, hoy)).toBe(14)
  })
})

// ── periodoPreset ─────────────────────────────────────────────────────────────

describe("periodoPreset", () => {
  it("mes devuelve el primer y último día del mes actual", () => {
    const { desde, hasta } = periodoPreset("mes")
    const hoy = new Date()
    expect(desde.getMonth()).toBe(hoy.getMonth())
    expect(desde.getDate()).toBe(1)
    expect(hasta.getMonth()).toBe(hoy.getMonth())
  })

  it("anio devuelve el 1 de enero al 31 de diciembre", () => {
    const { desde, hasta } = periodoPreset("anio")
    expect(desde.getMonth()).toBe(0)
    expect(desde.getDate()).toBe(1)
    expect(hasta.getMonth()).toBe(11)
    expect(hasta.getDate()).toBe(31)
  })
})

// ── selector de mes ───────────────────────────────────────────────────────────

describe("rangoDeMes", () => {
  it("devuelve el primer y último día del mes indicado", () => {
    const { desde, hasta } = rangoDeMes("2026-02")
    expect(desde.getFullYear()).toBe(2026)
    expect(desde.getMonth()).toBe(1)
    expect(desde.getDate()).toBe(1)
    expect(hasta.getMonth()).toBe(1)
    expect(hasta.getDate()).toBe(28) // febrero 2026 no es bisiesto
  })

  it("funciona en diciembre sin desbordar al año siguiente", () => {
    const { desde, hasta } = rangoDeMes("2026-12")
    expect(desde.getMonth()).toBe(11)
    expect(hasta.getMonth()).toBe(11)
    expect(hasta.getDate()).toBe(31)
  })
})

describe("mesActualStr", () => {
  it("formatea como YYYY-MM con ceros a la izquierda", () => {
    expect(mesActualStr(new Date(2026, 0, 15))).toBe("2026-01")
    expect(mesActualStr(new Date(2026, 10, 15))).toBe("2026-11")
  })
})
