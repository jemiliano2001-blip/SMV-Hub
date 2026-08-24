import { describe, it, expect } from "vitest"
import {
  debeActualizarCompraExistente,
  esCotizacionComprada,
  esLineaCompraParaCotizacion,
  fechaCotizacionDesdeOrden,
  generarClaveUpsertCompra,
  monedaDeOrden,
  payloadsCotizacionDesdeOrden,
  type OrdenParaCotizacion,
} from "@/lib/cotizaciones-desde-ordenes"

function makeOrden(overrides: Partial<OrdenParaCotizacion> = {}): OrdenParaCotizacion {
  return {
    id: "ord-1",
    proveedor: "McMaster-Carr",
    numeroFactura: "INV-001",
    fechaFactura: "2026-06-10",
    moneda: "USD",
    items: [
      {
        descripcion: "Reamer 1/4 carbide",
        cantidad: 2,
        precioUnitario: 18.5,
        total: 37,
        requisitor: "Daniel",
      },
    ],
    requisitor: "",
    creadoEn: new Date("2026-06-11T15:00:00.000Z"),
    ...overrides,
  }
}

describe("monedaDeOrden", () => {
  it("trata MXN sin importar mayúsculas", () => {
    expect(monedaDeOrden("mxn")).toBe("MXN")
  })

  it("cualquier otra moneda cae a USD", () => {
    expect(monedaDeOrden("USD")).toBe("USD")
    expect(monedaDeOrden("eur")).toBe("USD")
    expect(monedaDeOrden("")).toBe("USD")
  })
})

describe("esLineaCompraParaCotizacion", () => {
  it("acepta una pieza con precio", () => {
    expect(
      esLineaCompraParaCotizacion({
        descripcion: "Reamer 1/4 carbide",
        cantidad: 1,
        precioUnitario: 18.5,
        total: 18.5,
      })
    ).toBe(true)
  })

  it("rechaza precio cero o nulo", () => {
    expect(
      esLineaCompraParaCotizacion({
        descripcion: "Reamer 1/4",
        cantidad: 1,
        precioUnitario: 0,
        total: 0,
      })
    ).toBe(false)
    expect(
      esLineaCompraParaCotizacion({
        descripcion: "Reamer 1/4",
        cantidad: 1,
        precioUnitario: null,
        total: null,
      })
    ).toBe(false)
  })

  it("rechaza flete y tax cortos", () => {
    expect(
      esLineaCompraParaCotizacion({
        descripcion: "Freight",
        cantidad: 1,
        precioUnitario: 12.4,
        total: 12.4,
      })
    ).toBe(false)
    expect(
      esLineaCompraParaCotizacion({
        descripcion: "Sales tax",
        cantidad: 1,
        precioUnitario: 8.25,
        total: 8.25,
      })
    ).toBe(false)
  })

  it("rechaza un cargo de flete aunque la descripción sea larga", () => {
    expect(
      esLineaCompraParaCotizacion({
        descripcion: "Freight charges for domestic shipment",
        cantidad: 1,
        precioUnitario: 22,
        total: 22,
      })
    ).toBe(false)
  })

  it("no descarta una pieza que menciona shipping si trae medida", () => {
    expect(
      esLineaCompraParaCotizacion({
        descripcion: "Shipping container bolt 1/2-13",
        cantidad: 4,
        precioUnitario: 3.2,
        total: 12.8,
      })
    ).toBe(true)
  })
})

describe("generarClaveUpsertCompra", () => {
  it("es estable ante mayúsculas y puntuación del proveedor", () => {
    const a = generarClaveUpsertCompra({
      proveedor: "McMaster-Carr",
      numeroParte: null,
      descripcion: "Reamer 1/4 carbide",
    })
    const b = generarClaveUpsertCompra({
      proveedor: "mcmaster carr",
      numeroParte: null,
      descripcion: "Reamer 1/4 carbide",
    })
    expect(a).toBe(b)
  })
})

describe("fechaCotizacionDesdeOrden", () => {
  it("usa fechaFactura si es YYYY-MM-DD", () => {
    expect(fechaCotizacionDesdeOrden(makeOrden())).toBe("2026-06-10")
  })

  it("cae a creadoEn en UTC si no hay factura", () => {
    expect(
      fechaCotizacionDesdeOrden(
        makeOrden({ fechaFactura: null, creadoEn: new Date("2026-01-02T00:00:00.000Z") })
      )
    ).toBe("2026-01-02")
  })
})

describe("debeActualizarCompraExistente", () => {
  it("no pisa una compra más nueva con una vieja", () => {
    expect(debeActualizarCompraExistente("2026-08-01", "2026-01-01")).toBe(false)
  })

  it("no pisa una fila con fecha si la nueva no trae fecha", () => {
    expect(debeActualizarCompraExistente("2026-08-01", null)).toBe(false)
  })

  it("sí actualiza si ninguna tiene fecha", () => {
    expect(debeActualizarCompraExistente(null, null)).toBe(true)
  })

  it("actualiza si la nueva es igual o posterior", () => {
    expect(debeActualizarCompraExistente("2026-08-01", "2026-08-01")).toBe(true)
    expect(debeActualizarCompraExistente("2026-08-01", "2026-08-02")).toBe(true)
  })
})

describe("payloadsCotizacionDesdeOrden", () => {
  it("arma una fila buscable por ítem", () => {
    const [p] = payloadsCotizacionDesdeOrden(makeOrden())
    expect(p).toMatchObject({
      solicitante: "Daniel",
      fecha: "2026-06-10",
      ubicacion: "USA",
      proveedor: "McMaster-Carr",
      descripcion: "Reamer 1/4 carbide",
      numeroParte: null,
      cantidad: 2,
      precioUnitario: 18.5,
      moneda: "USD",
      origen: "compra",
      ordenIdOrigen: "ord-1",
      notas: "Compra INV-001",
    })
    expect(p.claveUpsertCompra.length).toBeGreaterThan(5)
  })

  it("marca MX si la orden viene en MXN", () => {
    const [p] = payloadsCotizacionDesdeOrden(makeOrden({ moneda: "MXN" }))
    expect(p.ubicacion).toBe("MX")
    expect(p.moneda).toBe("MXN")
  })

  it("omite flete y no duplica la misma pieza en la misma orden", () => {
    const payloads = payloadsCotizacionDesdeOrden(
      makeOrden({
        items: [
          {
            descripcion: "Reamer 1/4 carbide",
            cantidad: 1,
            precioUnitario: 18.5,
            total: 18.5,
          },
          {
            descripcion: "Freight",
            cantidad: 1,
            precioUnitario: 9,
            total: 9,
          },
          {
            descripcion: "Reamer 1/4 carbide",
            cantidad: 3,
            precioUnitario: 18.5,
            total: 55.5,
          },
        ],
      })
    )
    expect(payloads).toHaveLength(1)
    expect(payloads[0].descripcion).toBe("Reamer 1/4 carbide")
  })

  it("devuelve vacío si no hay proveedor", () => {
    expect(payloadsCotizacionDesdeOrden(makeOrden({ proveedor: "  " }))).toEqual([])
  })
})

describe("esCotizacionComprada", () => {
  it("solo marca origen compra", () => {
    expect(esCotizacionComprada("compra")).toBe(true)
    expect(esCotizacionComprada("cotizacion")).toBe(false)
    expect(esCotizacionComprada(undefined)).toBe(false)
  })
})
