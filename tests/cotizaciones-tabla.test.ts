import { describe, it, expect } from "vitest"
import {
  filtrarCotizaciones,
  tokenizarBusqueda,
  hayTokens,
  puntuacionRelevancia,
  ordenarCotizaciones,
  paginarCotizaciones,
  TAMANO_PAGINA_COTIZACIONES,
} from "@/lib/cotizaciones-tabla"
import type { Cotizacion } from "@/lib/schemas"

const AHORA = new Date("2026-06-19")

function makeCotizacion(overrides: Partial<Cotizacion> = {}): Cotizacion {
  return {
    id: "c-1",
    solicitante: "Francisco",
    fecha: "2026-06-19",
    estatus: "cotizado",
    ubicacion: "USA",
    proveedor: "Tri-City Tool Parts",
    descripcion: "E110576 Seal Husky C304H",
    numeroParte: "E110576",
    cantidad: 1,
    precioUnitario: 14.24,
    moneda: "USD",
    total: 14.24,
    diasHabiles: "3 - 5 dias",
    link: "https://example.com",
    notas: null,
    creadoEn: AHORA,
    actualizadoEn: AHORA,
    ...overrides,
  }
}

describe("tokenizarBusqueda", () => {
  it("divide por espacios y normaliza", () => {
    expect(tokenizarBusqueda("  Seal  E110  ")).toEqual(["seal", "e110"])
  })

  it("devuelve array vacío sin texto", () => {
    expect(tokenizarBusqueda("   ")).toEqual([])
  })
})

describe("hayTokens", () => {
  it("true cuando hay palabras", () => {
    expect(hayTokens("motor")).toBe(true)
  })

  it("false cuando está vacío", () => {
    expect(hayTokens("")).toBe(false)
  })
})

describe("filtrarCotizaciones", () => {
  const base = [
    makeCotizacion(),
    makeCotizacion({
      id: "c-2",
      descripcion: "Motor eléctrico 1HP",
      numeroParte: "MOT-1HP",
      proveedor: "Levinson",
      ubicacion: "MX",
      moneda: "MXN",
      solicitante: "Edgar",
    }),
  ]

  it("encuentra por descripción con un token", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "motor",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe("c-2")
  })

  it("encuentra por número de parte", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "e110576",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe("c-1")
  })

  it("exige todos los tokens (AND)", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "seal e110",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe("c-1")
  })

  it("sin coincidencia devuelve vacío", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "imposible xyz",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(0)
  })

  it("filtra por ubicación y estatus antes del texto", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "",
      ubicacion: "MX",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].ubicacion).toBe("MX")
  })

  it("busca en solicitante", () => {
    const r = filtrarCotizaciones(base, {
      busqueda: "edgar",
      ubicacion: "todas",
      estatus: "todos",
    })
    expect(r).toHaveLength(1)
    expect(r[0].solicitante).toBe("Edgar")
  })

  it("busca por folio de factura en notas", () => {
    const r = filtrarCotizaciones(
      [
        ...base,
        makeCotizacion({
          id: "c-compra",
          descripcion: "End mill 1/4",
          notas: "Compra INV-8891",
          origen: "compra",
        }),
      ],
      { busqueda: "inv-8891", ubicacion: "todas", estatus: "todos" }
    )
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe("c-compra")
  })

  it("filtra origen compra vs cotización (legacy sin origen cuenta como cotización)", () => {
    const rows = [
      makeCotizacion({ id: "quote" }),
      makeCotizacion({ id: "bought", origen: "compra", descripcion: "End mill" }),
    ]
    const compradas = filtrarCotizaciones(rows, {
      busqueda: "",
      ubicacion: "todas",
      estatus: "todos",
      origen: "compra",
    })
    const cotizadas = filtrarCotizaciones(rows, {
      busqueda: "",
      ubicacion: "todas",
      estatus: "todos",
      origen: "cotizacion",
    })
    expect(compradas.map((c) => c.id)).toEqual(["bought"])
    expect(cotizadas.map((c) => c.id)).toEqual(["quote"])
  })
})

describe("puntuacionRelevancia", () => {
  it("prioriza coincidencia exacta de número de parte", () => {
    const exacta = makeCotizacion({ numeroParte: "E110576" })
    const parcial = makeCotizacion({
      id: "c-2",
      numeroParte: "E110576-X",
      descripcion: "Otro sello",
    })
    expect(puntuacionRelevancia(exacta, "E110576")).toBeLessThan(
      puntuacionRelevancia(parcial, "E110576")
    )
  })
})

describe("ordenarCotizaciones", () => {
  it("ordena por fecha desc con null al final", () => {
    const rows = [
      makeCotizacion({ id: "a", fecha: "2026-01-01" }),
      makeCotizacion({ id: "b", fecha: "2026-06-01" }),
      makeCotizacion({ id: "c", fecha: null }),
    ]
    const r = ordenarCotizaciones(rows, "fecha", "desc")
    expect(r.map((x) => x.id)).toEqual(["b", "a", "c"])
  })

  it("ordena por total sin mezclar USD y MXN", () => {
    const rows = [
      makeCotizacion({ id: "mx-alto", moneda: "MXN", total: 5000, ubicacion: "MX" }),
      makeCotizacion({ id: "usd-bajo", moneda: "USD", total: 10, ubicacion: "USA" }),
      makeCotizacion({ id: "usd-alto", moneda: "USD", total: 100, ubicacion: "USA" }),
    ]
    const r = ordenarCotizaciones(rows, "total", "desc")
    expect(r.map((x) => x.id)).toEqual(["usd-alto", "usd-bajo", "mx-alto"])
  })

  it("ordena estatus en orden fijo cotizado → revisar → cancelado", () => {
    const rows = [
      makeCotizacion({ id: "x", estatus: "cancelado" }),
      makeCotizacion({ id: "y", estatus: "cotizado" }),
      makeCotizacion({ id: "z", estatus: "revisar" }),
    ]
    const r = ordenarCotizaciones(rows, "estatus", "asc")
    expect(r.map((x) => x.id)).toEqual(["y", "z", "x"])
  })

  it("aplica relevancia cuando usarRelevancia es true", () => {
    const rows = [
      makeCotizacion({
        id: "parcial",
        numeroParte: "E110576-X",
        descripcion: "Sello genérico E110576",
        fecha: "2026-06-01",
      }),
      makeCotizacion({
        id: "exacta",
        numeroParte: "E110576",
        descripcion: "Seal Husky",
        fecha: "2026-01-01",
      }),
    ]
    const r = ordenarCotizaciones(rows, "fecha", "desc", {
      busqueda: "E110576",
      usarRelevancia: true,
    })
    expect(r[0].id).toBe("exacta")
  })

  it("no aplica relevancia cuando usarRelevancia es false", () => {
    const rows = [
      makeCotizacion({
        id: "parcial",
        numeroParte: "E110576-X",
        fecha: "2026-06-01",
      }),
      makeCotizacion({
        id: "exacta",
        numeroParte: "E110576",
        fecha: "2026-01-01",
      }),
    ]
    const r = ordenarCotizaciones(rows, "fecha", "desc", {
      busqueda: "E110576",
      usarRelevancia: false,
    })
    expect(r[0].id).toBe("parcial")
  })
})

describe("paginarCotizaciones", () => {
  const items = Array.from({ length: 127 }, (_, i) => `item-${i + 1}`)

  it("exporta tamaño de página 50", () => {
    expect(TAMANO_PAGINA_COTIZACIONES).toBe(50)
  })

  it("página 1 devuelve primeros 50", () => {
    const r = paginarCotizaciones(items, 1, 50)
    expect(r.filas).toHaveLength(50)
    expect(r.filas[0]).toBe("item-1")
    expect(r.indiceInicio).toBe(1)
    expect(r.indiceFin).toBe(50)
    expect(r.totalFilas).toBe(127)
    expect(r.totalPaginas).toBe(3)
    expect(r.paginaActual).toBe(1)
  })

  it("última página devuelve resto", () => {
    const r = paginarCotizaciones(items, 3, 50)
    expect(r.filas).toHaveLength(27)
    expect(r.filas[0]).toBe("item-101")
    expect(r.indiceInicio).toBe(101)
    expect(r.indiceFin).toBe(127)
  })

  it("página fuera de rango ajusta a la última válida", () => {
    const r = paginarCotizaciones(items, 99, 50)
    expect(r.paginaActual).toBe(3)
    expect(r.filas).toHaveLength(27)
  })

  it("sin resultados devuelve metadatos vacíos", () => {
    const r = paginarCotizaciones([], 1, 50)
    expect(r.filas).toHaveLength(0)
    expect(r.totalFilas).toBe(0)
    expect(r.totalPaginas).toBe(0)
    expect(r.indiceInicio).toBe(0)
    expect(r.indiceFin).toBe(0)
  })
})
