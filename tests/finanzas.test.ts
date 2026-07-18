import { describe, it, expect } from "vitest"
import {
  facturasValidas,
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  calcularKpisFinanzas,
  compararKpis,
  serieMensual,
  agruparPorCliente,
  clasificarCobranza,
  diasAtraso,
  bucketAging,
  distribucionAging,
  calcularDso,
  calcularCei,
  periodoPreset,
  rangoDeMes,
  mesActualStr,
  mesAnteriorStr,
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

describe("mesAnteriorStr", () => {
  it("resta un mes dentro del mismo año", () => {
    expect(mesAnteriorStr("2026-07")).toBe("2026-06")
  })

  it("cruza al año anterior desde enero", () => {
    expect(mesAnteriorStr("2026-01")).toBe("2025-12")
  })
})

// ── compararKpis ──────────────────────────────────────────────────────────────

describe("compararKpis", () => {
  const kpis = (facturacionTotal: number): ReturnType<typeof calcularKpisFinanzas> => ({
    facturacionTotal,
    subtotal: facturacionTotal,
    impuestos: 0,
    numFacturas: 1,
    numNotasCredito: 0,
    numClientes: 1,
  })

  it("delta positivo cuando el actual supera al anterior", () => {
    const d = compararKpis(kpis(1200), kpis(1000))
    expect(d.facturacionTotal.absoluto).toBe(200)
    expect(d.facturacionTotal.porcentaje).toBeCloseTo(20)
  })

  it("delta negativo cuando cae la facturación", () => {
    const d = compararKpis(kpis(800), kpis(1000))
    expect(d.facturacionTotal.absoluto).toBe(-200)
    expect(d.facturacionTotal.porcentaje).toBeCloseTo(-20)
  })

  it("porcentaje null cuando el periodo anterior es 0 (sin base de comparación)", () => {
    const d = compararKpis(kpis(500), kpis(0))
    expect(d.facturacionTotal.absoluto).toBe(500)
    expect(d.facturacionTotal.porcentaje).toBeNull()
  })

  it("meses sin facturas en ambos lados: delta 0 y porcentaje null", () => {
    const d = compararKpis(kpis(0), kpis(0))
    expect(d.facturacionTotal.absoluto).toBe(0)
    expect(d.facturacionTotal.porcentaje).toBeNull()
  })
})

// ── serieMensual ──────────────────────────────────────────────────────────────

describe("serieMensual", () => {
  const hasta = new Date(2026, 6, 15) // julio 2026

  it("rellena meses sin facturas con 0 (sin huecos)", () => {
    const facturas = [
      makeFactura({ fechaFactura: "2026-05-10", total: 1000 }),
      makeFactura({ fechaFactura: "2026-07-01", total: 500 }),
    ]
    const serie = serieMensual(facturas, 3, hasta)
    expect(serie.map((p) => p.mes)).toEqual(["2026-05", "2026-06", "2026-07"])
    expect(serie.map((p) => p.total)).toEqual([1000, 0, 500])
  })

  it("resta notas de crédito del mes", () => {
    const facturas = [
      makeFactura({ fechaFactura: "2026-07-01", tipo: "factura", total: 1000 }),
      makeFactura({ fechaFactura: "2026-07-05", tipo: "nota_credito", total: 200 }),
    ]
    const serie = serieMensual(facturas, 1, hasta)
    expect(serie[0].total).toBeCloseTo(800)
  })

  it("excluye canceladas y facturas sin fecha", () => {
    const facturas = [
      makeFactura({ fechaFactura: "2026-07-01", estado: "cancelado", total: 9999 }),
      makeFactura({ fechaFactura: null, total: 5555 }),
      makeFactura({ fechaFactura: "2026-07-02", total: 100 }),
    ]
    const serie = serieMensual(facturas, 1, hasta)
    expect(serie[0].total).toBe(100)
  })

  it("cruza años sin desbordar (ventana de 12 meses)", () => {
    const serie = serieMensual([], 12, new Date(2026, 2, 15)) // marzo 2026
    expect(serie[0].mes).toBe("2025-04")
    expect(serie[11].mes).toBe("2026-03")
  })
})

// ── bucketAging ───────────────────────────────────────────────────────────────

describe("bucketAging", () => {
  const hoy = new Date(2026, 6, 15) // 2026-07-15, constructor local

  const conAtraso = (dias: number) => {
    // vencimiento = hoy - dias
    const venc = new Date(2026, 6, 15 - dias)
    return makeFactura({
      saldoPendiente: 100,
      fechaVencimiento: `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}-${String(venc.getDate()).padStart(2, "0")}`,
    })
  }

  it("sin atraso → corriente", () => {
    expect(bucketAging(conAtraso(0), hoy)).toBe("corriente")
  })

  it("bordes exactos de cada bucket (30/31, 60/61, 90/91)", () => {
    expect(bucketAging(conAtraso(1), hoy)).toBe("b1_30")
    expect(bucketAging(conAtraso(30), hoy)).toBe("b1_30")
    expect(bucketAging(conAtraso(31), hoy)).toBe("b31_60")
    expect(bucketAging(conAtraso(60), hoy)).toBe("b31_60")
    expect(bucketAging(conAtraso(61), hoy)).toBe("b61_90")
    expect(bucketAging(conAtraso(90), hoy)).toBe("b61_90")
    expect(bucketAging(conAtraso(91), hoy)).toBe("b90")
  })

  it("factura pagada siempre es corriente aunque el vencimiento haya pasado", () => {
    const f = makeFactura({ saldoPendiente: 0, fechaVencimiento: "2026-01-01" })
    expect(bucketAging(f, hoy)).toBe("corriente")
  })
})

// ── distribucionAging ─────────────────────────────────────────────────────────

describe("distribucionAging", () => {
  const hoy = new Date(2026, 6, 15)

  it("distribuye el saldo abierto por bucket con porcentajes", () => {
    const facturas = [
      makeFactura({ saldoPendiente: 750, fechaVencimiento: "2026-08-01" }), // corriente
      makeFactura({ saldoPendiente: 250, fechaVencimiento: "2026-07-01" }), // 14 días → b1_30
    ]
    const d = distribucionAging(facturas, hoy)
    expect(d.totalPorCobrar).toBe(1000)
    expect(d.buckets.corriente.total).toBe(750)
    expect(d.buckets.corriente.pct).toBeCloseTo(75)
    expect(d.buckets.b1_30.total).toBe(250)
    expect(d.buckets.b1_30.pct).toBeCloseTo(25)
    expect(d.buckets.b1_30.cantidad).toBe(1)
  })

  it("excluye pagadas, notas de crédito y canceladas", () => {
    const facturas = [
      makeFactura({ saldoPendiente: 0 }),
      makeFactura({ tipo: "nota_credito", saldoPendiente: 100 }),
      makeFactura({ estado: "cancelado", saldoPendiente: 100 }),
    ]
    const d = distribucionAging(facturas, hoy)
    expect(d.totalPorCobrar).toBe(0)
  })

  it("sin saldo abierto: porcentajes en 0, sin división entre cero", () => {
    const d = distribucionAging([], hoy)
    expect(d.totalPorCobrar).toBe(0)
    expect(d.buckets.b90.pct).toBe(0)
  })
})

// ── calcularDso ───────────────────────────────────────────────────────────────

describe("calcularDso", () => {
  const desde = new Date(2026, 5, 1) // junio (30 días)
  const hasta = new Date(2026, 5, 30)

  it("caso conocido a mano: saldo 500, facturado 1000 en 30 días → 15 días", () => {
    const facturas = [
      makeFactura({ fechaFactura: "2026-06-10", total: 1000, saldoPendiente: 500 }),
    ]
    expect(calcularDso(facturas, desde, hasta)).toBeCloseTo(15)
  })

  it("null cuando no hubo facturación en el periodo", () => {
    const facturas = [makeFactura({ fechaFactura: "2026-01-10", saldoPendiente: 100 })]
    expect(calcularDso(facturas, desde, hasta)).toBeNull()
  })

  it("las notas de crédito no cuentan como facturación ni como saldo", () => {
    const facturas = [
      makeFactura({ fechaFactura: "2026-06-10", total: 1000, saldoPendiente: 0 }),
      makeFactura({ tipo: "nota_credito", fechaFactura: "2026-06-12", total: 500, saldoPendiente: 500 }),
    ]
    // saldo vigente de facturas = 0 → DSO 0
    expect(calcularDso(facturas, desde, hasta)).toBe(0)
  })
})

// ── calcularCei ───────────────────────────────────────────────────────────────

describe("calcularCei", () => {
  const desde = new Date(2026, 5, 1)
  const hasta = new Date(2026, 5, 30)
  const hoy = new Date(2026, 6, 15)

  it("100% cuando todo lo vencido/cobrable se cobró", () => {
    const facturas = [
      makeFactura({ fechaFactura: "2026-06-10", total: 1000, saldoPendiente: 0 }),
    ]
    expect(calcularCei(facturas, desde, hasta, hoy)).toBeCloseTo(100)
  })

  it("50% cuando se cobró la mitad de lo cobrable", () => {
    const facturas = [
      // vencida con saldo: cobrable pero no cobrada
      makeFactura({ id: "odoo_1", fechaFactura: "2026-06-05", fechaVencimiento: "2026-06-20", total: 1000, saldoPendiente: 500 }),
      // pagada por completo
      makeFactura({ id: "odoo_2", fechaFactura: "2026-06-10", total: 0, saldoPendiente: 0 }),
    ]
    // facturado 1000, saldo abierto 500 (vencido) → cobrado 500 / cobrable 1000
    expect(calcularCei(facturas, desde, hasta, hoy)).toBeCloseTo(50)
  })

  it("excluye del cobrable lo que aún no vence", () => {
    const facturas = [
      // sin vencer: no cuenta contra el CEI
      makeFactura({ id: "odoo_1", fechaFactura: "2026-06-05", fechaVencimiento: "2026-09-01", total: 1000, saldoPendiente: 1000 }),
      // cobrada
      makeFactura({ id: "odoo_2", fechaFactura: "2026-06-10", total: 500, saldoPendiente: 0 }),
    ]
    // cobrable = 1500 - 1000 (no vencido) = 500; cobrado = 1500 - 1000 = 500 → 100%
    expect(calcularCei(facturas, desde, hasta, hoy)).toBeCloseTo(100)
  })

  it("null cuando no hay nada cobrable todavía", () => {
    const facturas = [
      makeFactura({ fechaFactura: "2026-06-05", fechaVencimiento: "2026-09-01", total: 1000, saldoPendiente: 1000 }),
    ]
    expect(calcularCei(facturas, desde, hasta, hoy)).toBeNull()
  })
})
