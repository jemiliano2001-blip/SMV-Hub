/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest"
import {
  filtrarPorRango,
  aplanarLineas,
  agrupar,
  calcularKpis,
  periodoPreset,
} from "@/lib/reportes"
import type { OrdenCompra } from "@/lib/schemas"

// ── Helper ────────────────────────────────────────────────────────────────────

function makeOrden(overrides: Partial<OrdenCompra> = {}): OrdenCompra {
  return {
    id: "ord-1",
    proveedor: "McMaster-Carr",
    numeroFactura: "INV-001",
    fechaFactura: "2026-06-10",
    moneda: "USD",
    subtotal: 100,
    impuestos: 16,
    total: 116,
    items: [
      {
        descripcion: "Tornillo M8",
        cantidad: 10,
        precioUnitario: 10,
        total: 100,
        empresa: "SMV",
        cuentaCargo: "SO19316",
        requisitor: "Juan",
        ordenTrabajo: "OT-100",
      } as any,
    ],
    requisitor: "Juan",
    ordenTrabajo: "OT-100",
    empresa: "SMV",
    cuentaCargo: "SO19316",
    destino: "SMV",
    estado: "pendiente",
    creadoEn: new Date("2026-06-10"),
    actualizadoEn: new Date("2026-06-10"),
    ...overrides,
  }
}

// ── filtrarPorRango ───────────────────────────────────────────────────────────

describe("filtrarPorRango", () => {
  it("incluye órdenes cuya fechaFactura está dentro del rango", () => {
    const orden = makeOrden({ fechaFactura: "2026-06-10" })
    const resultado = filtrarPorRango(
      [orden],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(1)
  })

  it("excluye órdenes fuera del rango", () => {
    const orden = makeOrden({ fechaFactura: "2026-05-15" })
    const resultado = filtrarPorRango(
      [orden],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(0)
  })

  it("sin fechaFactura usa creadoEn como fallback (dentro del rango → incluye)", () => {
    // makeOrden tiene creadoEn = 2026-06-10, dentro de junio
    const orden = makeOrden({ fechaFactura: null })
    const resultado = filtrarPorRango(
      [orden],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(1)
  })

  it("sin fechaFactura usa creadoEn como fallback (fuera del rango → excluye)", () => {
    const orden = makeOrden({
      fechaFactura: null,
      creadoEn: new Date("2026-05-15"),
    })
    const resultado = filtrarPorRango(
      [orden],
      new Date("2026-06-01"),
      new Date("2026-06-30")
    )
    expect(resultado).toHaveLength(0)
  })

  it("incluye órdenes exactamente en los límites del rango (inclusive)", () => {
    const desde = new Date("2026-06-01")
    const hasta = new Date("2026-06-30")
    const ordenInicio = makeOrden({ id: "a", fechaFactura: "2026-06-01" })
    const ordenFin = makeOrden({ id: "b", fechaFactura: "2026-06-30" })
    const resultado = filtrarPorRango([ordenInicio, ordenFin], desde, hasta)
    expect(resultado).toHaveLength(2)
  })
})

// ── aplanarLineas ─────────────────────────────────────────────────────────────

describe("aplanarLineas", () => {
  it("crea una Linea por ítem con impuestos proporcionales", () => {
    const orden = makeOrden({
      subtotal: 100,
      impuestos: 16,
      items: [
        { descripcion: "A", cantidad: 1, precioUnitario: 60, total: 60 } as any,
        { descripcion: "B", cantidad: 2, precioUnitario: 20, total: 40 } as any,
      ],
    })
    const lineas = aplanarLineas([orden])
    expect(lineas).toHaveLength(2)
    // Línea A: subtotal 60, impuesto proporcional = 16 * 60/100 = 9.6 → total = 69.6
    expect(lineas[0].subtotal).toBeCloseTo(60)
    expect(lineas[0].total).toBeCloseTo(69.6)
    // Línea B: subtotal 40, impuesto = 16 * 40/100 = 6.4 → total = 46.4
    expect(lineas[1].subtotal).toBeCloseTo(40)
    expect(lineas[1].total).toBeCloseTo(46.4)
  })

  it("cuando no hay impuestos, total == subtotal de línea", () => {
    const orden = makeOrden({
      impuestos: null,
      items: [{ descripcion: "X", cantidad: 1, precioUnitario: 50, total: 50 } as any],
    })
    const [linea] = aplanarLineas([orden])
    expect(linea.subtotal).toBe(50)
    expect(linea.total).toBe(50)
  })

  it("cuando la orden no tiene ítems, crea una línea sintética con orden.total", () => {
    const orden = makeOrden({ items: [], subtotal: 200, impuestos: 32, total: 232 })
    const lineas = aplanarLineas([orden])
    expect(lineas).toHaveLength(1)
    expect(lineas[0].total).toBe(232)
    expect(lineas[0].descripcion).toBe("(orden sin ítems)")
  })

  it("mapea correctamente los campos de referencia y moneda", () => {
    const orden = makeOrden({ id: "ord-99", numeroFactura: "INV-X", moneda: "MXN" })
    const [linea] = aplanarLineas([orden])
    expect(linea.ordenId).toBe("ord-99")
    expect(linea.referencia).toBe("INV-X")
    expect(linea.moneda).toBe("MXN")
  })

  it("cuando no hay numeroFactura usa el id como referencia", () => {
    const orden = makeOrden({ id: "ord-42", numeroFactura: null })
    const [linea] = aplanarLineas([orden])
    expect(linea.referencia).toBe("ord-42")
  })

  it("mapea cuentaCargo y destino por ítem con fallback a la orden", () => {
    const orden = makeOrden({
      cuentaCargo: "LEGACY-CC",
      destino: "LEGACY-D",
      items: [
        {
          descripcion: "A",
          cantidad: 1,
          precioUnitario: 10,
          total: 10,
          empresa: "APX",
          cuentaCargo: "SO1157",
          requisitor: "Ana",
          ordenTrabajo: "",
        } as any,
        {
          descripcion: "B",
          cantidad: 1,
          precioUnitario: 5,
          total: 5,
          empresa: "",
          cuentaCargo: "",
          requisitor: "",
          ordenTrabajo: "",
        } as any,
      ],
    })
    const lineas = aplanarLineas([orden])
    expect(lineas[0].cuentaCargo).toBe("SO1157")
    expect(lineas[0].destino).toBe("APX")
    expect(lineas[1].cuentaCargo).toBe("LEGACY-CC")
    expect(lineas[1].destino).toBe("SMV")
  })
})

// ── agrupar ───────────────────────────────────────────────────────────────────

describe("agrupar", () => {
  function makeLinea(overrides: {
    proveedor?: string; destino?: string; requisitor?: string; total?: number; subtotal?: number
  } = {}): import("@/lib/reportes").Linea {
    return {
      ordenId: "ord-1",
      referencia: "INV-1",
      dia: new Date("2026-06-10"),
      proveedor: overrides.proveedor ?? "Prov A",
      descripcion: "Desc",
      cantidad: 1,
      precioUnitario: 10,
      subtotal: overrides.subtotal ?? 10,
      total: overrides.total ?? 10,
      requisitor: overrides.requisitor ?? "Juan",
      cuentaCargo: "",
      destino: overrides.destino ?? "SMV",
      moneda: "USD",
    }
  }

  it("agrupa líneas por proveedor", () => {
    const lineas = [
      makeLinea({ proveedor: "A", total: 100 }),
      makeLinea({ proveedor: "B", total: 50 }),
      makeLinea({ proveedor: "A", total: 200 }),
    ]
    const grupos = agrupar(lineas, "proveedor")
    expect(grupos).toHaveLength(2)
    const grupoA = grupos.find((g) => g.clave === "A")!
    expect(grupoA.lineas).toHaveLength(2)
    expect(grupoA.total).toBe(300)
  })

  it("ordena grupos por total descendente", () => {
    const lineas = [
      makeLinea({ proveedor: "Barato", total: 10 }),
      makeLinea({ proveedor: "Caro", total: 500 }),
    ]
    const grupos = agrupar(lineas, "proveedor")
    expect(grupos[0].clave).toBe("Caro")
    expect(grupos[1].clave).toBe("Barato")
  })

  it("agrupa líneas sin destino bajo '(sin destino)'", () => {
    const lineas = [makeLinea({ destino: "" })]
    const grupos = agrupar(lineas, "destino")
    expect(grupos[0].clave).toBe("(sin destino)")
  })

  it("calcula subtotal y total por grupo", () => {
    const lineas = [
      { ...makeLinea(), subtotal: 80, total: 100 },
      { ...makeLinea(), subtotal: 120, total: 150 },
    ]
    const [grupo] = agrupar(lineas, "proveedor")
    expect(grupo.subtotal).toBe(200)
    expect(grupo.total).toBe(250)
  })
})

// ── calcularKpis ──────────────────────────────────────────────────────────────

describe("calcularKpis", () => {
  function mkl(overrides: {
    referencia?: string; proveedor?: string; destino?: string; total?: number; cantidad?: number
  } = {}): import("@/lib/reportes").Linea {
    return {
      ordenId: "ord-1",
      referencia: overrides.referencia ?? "INV-1",
      dia: new Date(),
      proveedor: overrides.proveedor ?? "Prov",
      descripcion: "Desc",
      cantidad: overrides.cantidad ?? 1,
      precioUnitario: 10,
      subtotal: overrides.total ?? 100,
      total: overrides.total ?? 100,
      requisitor: "Juan",
      cuentaCargo: "",
      destino: overrides.destino ?? "SMV",
      moneda: "USD",
    }
  }

  it("suma el total comprado", () => {
    const kpis = calcularKpis([mkl({ total: 100 }), mkl({ total: 200 })])
    expect(kpis.totalComprado).toBe(300)
  })

  it("cuenta órdenes distintas por referencia", () => {
    const kpis = calcularKpis([
      mkl({ referencia: "INV-1" }),
      mkl({ referencia: "INV-1" }),  // misma referencia → 1 orden
      mkl({ referencia: "INV-2" }),
    ])
    expect(kpis.numOrdenes).toBe(2)
  })

  it("cuenta proveedores distintos", () => {
    const kpis = calcularKpis([
      mkl({ proveedor: "A" }),
      mkl({ proveedor: "A" }),
      mkl({ proveedor: "B" }),
    ])
    expect(kpis.numProveedores).toBe(2)
  })

  it("suma artículos correctamente", () => {
    const kpis = calcularKpis([mkl({ cantidad: 3 }), mkl({ cantidad: 5 })])
    expect(kpis.numArticulos).toBe(8)
  })

  it("identifica el destino con mayor gasto y calcula su porcentaje", () => {
    const kpis = calcularKpis([
      mkl({ destino: "SMV", total: 600 }),
      mkl({ destino: "Fisher", total: 400 }),
    ])
    expect(kpis.destinoTop).toBe("SMV")
    expect(kpis.destinoTopPct).toBeCloseTo(60)
  })

  it("devuelve porcentaje 0 cuando no hay gasto", () => {
    const kpis = calcularKpis([])
    expect(kpis.destinoTopPct).toBe(0)
    expect(kpis.totalComprado).toBe(0)
  })
})

// ── periodoPreset ─────────────────────────────────────────────────────────────

describe("periodoPreset", () => {
  it("'mes' retorna el primer y último día del mes actual", () => {
    const hoy = new Date()
    const { desde, hasta } = periodoPreset("mes")
    expect(desde.getMonth()).toBe(hoy.getMonth())
    expect(desde.getDate()).toBe(1)
    expect(hasta.getMonth()).toBe(hoy.getMonth())
    // Último día del mes
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    expect(hasta.getDate()).toBe(ultimoDia)
  })

  it("'semana' retorna lunes y domingo de la semana actual", () => {
    const { desde, hasta } = periodoPreset("semana")
    // Lunes = 1, Domingo = 0
    expect(desde.getDay()).toBe(1)
    expect(hasta.getDay()).toBe(0)
    // Diferencia de 6 días
    const diff = (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)
    expect(diff).toBe(6)
  })
})
