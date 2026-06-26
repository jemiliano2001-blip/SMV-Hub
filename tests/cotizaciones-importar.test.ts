import { describe, it, expect, vi } from "vitest"

// El módulo importa lib/cotizaciones, que importa lib/firebase. Lo stubbeamos
// para probar solo la lógica pura (igual que tests/ordenes.test.ts).
vi.mock("@/lib/firebase", () => ({ db: {}, storage: {} }))

import {
  parsearMonto,
  detectarColumnasCotizacion,
  mapearFilaCotizacion,
  procesarCSVCotizaciones,
  verificarDuplicadosCotizacion,
  type FilaCotizacion,
} from "@/lib/cotizaciones-importar"
import { claveDedupCotizacion } from "@/lib/cotizaciones"

const HEADERS = [
  "Columna 1", "Fecha", "Estatus", "Ubicación", "Proveedor", "Descripcion",
  "No. de parte", "Cantidad", "Precio en dolares", "Precio Unit mx", "Total",
  "Dias habiles", "Link", "Notas",
]
const COL = detectarColumnasCotizacion(HEADERS)

// fila en el mismo orden que HEADERS
function fila(over: Partial<Record<string, string>> = {}): string[] {
  const base: Record<string, string> = {
    "Columna 1": "Francisco", "Fecha": "3/06/2026", "Estatus": "Cotizado",
    "Ubicación": "USA", "Proveedor": "Linea", "Descripcion": "Conector DB25M-TERM",
    "No. de parte": "", "Cantidad": "3", "Precio en dolares": "$10,00",
    "Precio Unit mx": "$180,00", "Total": "$540,00", "Dias habiles": "5 dias",
    "Link": "https://x.com/p", "Notas": "nota",
  }
  return HEADERS.map((h) => over[h] ?? base[h])
}

// ── parsearMonto ──────────────────────────────────────────────────────────────

describe("parsearMonto", () => {
  it.each([
    ["$2.340,00", 2340],     // es-MX: punto miles, coma decimal
    ["$1.374,25", 1374.25],
    ["130,00", 130],         // coma decimal de 2 dígitos
    ["1,374.25", 1374.25],   // en-US: coma miles, punto decimal
    ["2340.5", 2340.5],      // crudo del export CSV
    ["10", 10],
    ["$25.740,00", 25740],
    ["1,300", 1300],         // coma de miles (3 dígitos)
  ])("parsea %s → %d", (raw, esperado) => {
    expect(parsearMonto(raw)).toBe(esperado)
  })

  it.each(["", "  ", "n/a", "—"])("devuelve null para %s", (raw) => {
    expect(parsearMonto(raw)).toBeNull()
  })
})

// ── mapearFilaCotizacion ──────────────────────────────────────────────────────

describe("mapearFilaCotizacion", () => {
  it("fila USA: moneda USD, precio en dólares y total recalculado (ignora Total del Sheet)", () => {
    const f = mapearFilaCotizacion(fila(), COL, 0)
    expect(f.errores).toEqual([])
    expect(f.datos.ubicacion).toBe("USA")
    expect(f.datos.moneda).toBe("USD")
    expect(f.datos.precioUnitario).toBe(10)
    expect(f.datos.cantidad).toBe(3)
    expect(f.datos.total).toBe(30) // 3 × $10 USD, NO los $540 MXN del Sheet
    expect(f.datos.fecha).toBe("2026-06-03") // normaliza día de 1 dígito
  })

  it("fila MX: moneda MXN y precio en pesos", () => {
    const f = mapearFilaCotizacion(
      fila({ "Ubicación": "MX", "Precio en dolares": "", "Precio Unit mx": "$7.535,51", "Cantidad": "1" }),
      COL, 0
    )
    expect(f.datos.ubicacion).toBe("MX")
    expect(f.datos.moneda).toBe("MXN")
    expect(f.datos.precioUnitario).toBe(7535.51)
    expect(f.datos.total).toBe(7535.51)
  })

  it("infiere USA cuando la ubicación viene vacía pero hay precio en dólares", () => {
    const f = mapearFilaCotizacion(fila({ "Ubicación": "" }), COL, 0)
    expect(f.datos.ubicacion).toBe("USA")
  })

  it("infiere MX cuando no hay ubicación ni precio en dólares", () => {
    const f = mapearFilaCotizacion(
      fila({ "Ubicación": "", "Precio en dolares": "", "Precio Unit mx": "$1.950,00" }),
      COL, 0
    )
    expect(f.datos.ubicacion).toBe("MX")
    expect(f.datos.moneda).toBe("MXN")
    expect(f.datos.precioUnitario).toBe(1950)
  })

  it("mapea estatus Cancelado y Revisar", () => {
    expect(mapearFilaCotizacion(fila({ "Estatus": "Cancelado" }), COL, 0).datos.estatus).toBe("cancelado")
    expect(mapearFilaCotizacion(fila({ "Estatus": "Revisar" }), COL, 0).datos.estatus).toBe("revisar")
  })

  it("estatus desconocido → cotizado con advertencia", () => {
    const f = mapearFilaCotizacion(fila({ "Estatus": "Foo" }), COL, 0)
    expect(f.datos.estatus).toBe("cotizado")
    expect(f.advertencias.some((a) => a.includes("Foo"))).toBe(true)
  })

  it("extrae cantidad aunque venga '1 pz.'", () => {
    expect(mapearFilaCotizacion(fila({ "Cantidad": "1 pz." }), COL, 0).datos.cantidad).toBe(1)
  })

  it("marca error si falta proveedor o descripción", () => {
    const f = mapearFilaCotizacion(fila({ "Proveedor": "", "Descripcion": "" }), COL, 0)
    expect(f.errores).toContain("Proveedor vacío")
    expect(f.errores).toContain("Descripción vacía")
    expect(f.seleccionada).toBe(false)
  })

  it("sanitiza URLs peligrosas a null", () => {
    expect(mapearFilaCotizacion(fila({ "Link": "javascript:alert(1)" }), COL, 0).datos.link).toBeNull()
  })

  it("total null cuando falta precio o cantidad", () => {
    expect(mapearFilaCotizacion(fila({ "Precio en dolares": "" }), COL, 0).datos.total).toBeNull()
  })
})

// ── procesarCSVCotizaciones ───────────────────────────────────────────────────

describe("procesarCSVCotizaciones", () => {
  it("rechaza CSV sin columnas requeridas", () => {
    const r = procesarCSVCotizaciones("Fecha,Notas\n2026-01-01,hola")
    expect(r.error).toMatch(/Columnas requeridas/)
    expect(r.filas).toEqual([])
  })

  it("rechaza CSV sin filas de datos", () => {
    const r = procesarCSVCotizaciones("Proveedor,Descripcion")
    expect(r.error).toMatch(/no tiene datos/)
  })

  it("procesa un CSV válido", () => {
    const csv = [
      "Proveedor,Descripcion,Ubicación,Cantidad,Precio en dolares",
      // monto con coma decimal va entrecomillado, como lo exporta Google Sheets
      'Teknik,Servomotor sin escobillas,USA,1,"$299,24"',
    ].join("\n")
    const r = procesarCSVCotizaciones(csv)
    expect(r.error).toBeNull()
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0].datos.proveedor).toBe("Teknik")
    expect(r.filas[0].datos.moneda).toBe("USD")
    expect(r.filas[0].datos.precioUnitario).toBe(299.24)
  })
})

// ── verificarDuplicadosCotizacion ─────────────────────────────────────────────

describe("verificarDuplicadosCotizacion", () => {
  it("marca filas cuya clave ya existe en Firestore", () => {
    const f = mapearFilaCotizacion(fila(), COL, 0)
    const filas: FilaCotizacion[] = [f]
    const claves = new Set([claveDedupCotizacion(f.datos)])

    const dups = verificarDuplicadosCotizacion(filas, claves)
    expect(dups).toHaveLength(1)
    expect(dups[0].indice).toBe(0)
  })

  it("no marca nada si la clave no existe", () => {
    const f = mapearFilaCotizacion(fila(), COL, 0)
    const dups = verificarDuplicadosCotizacion([f], new Set(["otra|clave|distinta|"]))
    expect(dups).toEqual([])
  })
})
