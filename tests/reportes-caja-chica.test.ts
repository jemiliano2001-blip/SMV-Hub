import { describe, it, expect } from "vitest"
import {
  filtrarMovimientosCajaChicaReporte,
  calcularTotalesReporteCaja,
} from "@/lib/reportes-caja-chica"
import type { MovimientoCajaChica } from "@/lib/schemas"

function movimientoBase(overrides: Partial<MovimientoCajaChica> = {}): MovimientoCajaChica {
  const ahora = new Date("2026-07-01T12:00:00Z")
  return {
    id: "mov-1",
    fecha: "2026-07-01",
    periodo: "2026-07",
    descripcion: "Gasolina",
    proveedor: "Gasolinera X",
    categoria: "Fletes",
    solicitante: "Juan",
    comprobante: "FACTURA",
    deducible: true,
    tipo: "SALIDA",
    monto: 500,
    costoReal: 500,
    ivaEstimado: 80,
    verificado: false,
    estadoCorte: "ACTIVO",
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  }
}

describe("filtrarMovimientosCajaChicaReporte", () => {
  it("incluye solo SALIDA con comprobante FACTURA cuando conFactura=true", () => {
    const movimientos = [
      movimientoBase({ id: "1", comprobante: "FACTURA" }),
      movimientoBase({ id: "2", comprobante: "TICKET" }),
      movimientoBase({ id: "3", comprobante: "VALE" }),
      movimientoBase({ id: "4", comprobante: "NINGUNO" }),
    ]
    const result = filtrarMovimientosCajaChicaReporte(movimientos, true)
    expect(result.map((m) => m.id)).toEqual(["1"])
  })

  it("incluye SALIDA con comprobante distinto de FACTURA cuando conFactura=false", () => {
    const movimientos = [
      movimientoBase({ id: "1", comprobante: "FACTURA" }),
      movimientoBase({ id: "2", comprobante: "TICKET" }),
      movimientoBase({ id: "3", comprobante: "VALE" }),
      movimientoBase({ id: "4", comprobante: "NINGUNO" }),
    ]
    const result = filtrarMovimientosCajaChicaReporte(movimientos, false)
    expect(result.map((m) => m.id)).toEqual(["2", "3", "4"])
  })

  it("excluye ENTRADA (recargas) de ambos reportes, incluso si trajeran comprobante FACTURA", () => {
    const movimientos = [
      movimientoBase({ id: "1", tipo: "ENTRADA", comprobante: "NINGUNO" }),
      movimientoBase({ id: "2", tipo: "ENTRADA", comprobante: "FACTURA" }),
      movimientoBase({ id: "3", tipo: "SALIDA", comprobante: "FACTURA" }),
    ]
    expect(filtrarMovimientosCajaChicaReporte(movimientos, true).map((m) => m.id)).toEqual(["3"])
    expect(filtrarMovimientosCajaChicaReporte(movimientos, false)).toEqual([])
  })

  it("incluye movimientos no verificados (el reporte es un registro, no una vista filtrada)", () => {
    const movimientos = [movimientoBase({ id: "1", verificado: false })]
    expect(filtrarMovimientosCajaChicaReporte(movimientos, true).map((m) => m.id)).toEqual(["1"])
  })
})

describe("calcularTotalesReporteCaja", () => {
  it("suma monto e ivaEstimado de la lista", () => {
    const movimientos = [
      movimientoBase({ id: "1", monto: 500, ivaEstimado: 80 }),
      movimientoBase({ id: "2", monto: 300, ivaEstimado: 48 }),
    ]
    expect(calcularTotalesReporteCaja(movimientos)).toEqual({ total: 800, ivaTotal: 128 })
  })

  it("devuelve ceros para una lista vacía", () => {
    expect(calcularTotalesReporteCaja([])).toEqual({ total: 0, ivaTotal: 0 })
  })
})
