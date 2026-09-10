import { describe, expect, it } from "vitest"
import {
  filtrarGastosSinComprobante,
  agruparEnHojasDeSeis,
  calcularHojasRequeridas,
  obtenerFolioCortoVale,
  calcularTotalMontoVales,
  VALES_POR_HOJA,
} from "@/lib/caja-chica-vales"
import type { MovimientoCajaChica } from "@/lib/schemas"

const dummyFecha = new Date("2026-09-01T10:00:00Z")

function crearMovimiento(
  id: string,
  tipo: "ENTRADA" | "SALIDA",
  comprobante: "FACTURA" | "VALE" | "TICKET" | "NINGUNO",
  monto: number,
  anulado = false
): MovimientoCajaChica {
  return {
    id,
    fecha: "2026-09-01",
    periodo: "2026-09",
    descripcion: `Gasto de prueba ${id}`,
    proveedor: "Taller Local",
    categoria: "Refacciones",
    solicitante: "Operador",
    comprobante,
    deducible: false,
    tipo,
    monto,
    costoReal: monto,
    ivaEstimado: 0,
    verificado: false,
    anulado,
    estadoCorte: "ACTIVO",
    creadoEn: dummyFecha,
    actualizadoEn: dummyFecha,
  }
}

describe("caja-chica-vales", () => {
  describe("filtrarGastosSinComprobante", () => {
    it("filtra únicamente gastos (SALIDA) con comprobante NINGUNO por defecto", () => {
      const lista: MovimientoCajaChica[] = [
        crearMovimiento("1", "SALIDA", "NINGUNO", 250),
        crearMovimiento("2", "SALIDA", "FACTURA", 500),
        crearMovimiento("3", "SALIDA", "TICKET", 120),
        crearMovimiento("4", "ENTRADA", "NINGUNO", 1000), // Entrada, omitir
        crearMovimiento("5", "SALIDA", "VALE", 300),
        crearMovimiento("6", "SALIDA", "NINGUNO", 450, true), // Anulado, omitir
      ]

      const resultado = filtrarGastosSinComprobante(lista)
      expect(resultado).toHaveLength(1)
      expect(resultado[0].id).toBe("1")
    })

    it("incluye comprobante VALE cuando la opción incluirVales es verdadera", () => {
      const lista: MovimientoCajaChica[] = [
        crearMovimiento("1", "SALIDA", "NINGUNO", 250),
        crearMovimiento("2", "SALIDA", "VALE", 300),
        crearMovimiento("3", "SALIDA", "TICKET", 120),
      ]

      const resultado = filtrarGastosSinComprobante(lista, { incluirVales: true })
      expect(resultado).toHaveLength(2)
      expect(resultado.map((m) => m.id)).toEqual(["1", "2"])
    })
  })

  describe("agruparEnHojasDeSeis", () => {
    it("retorna arreglo vacío si no hay items", () => {
      expect(agruparEnHojasDeSeis([])).toEqual([])
    })

    it("agrupa 1 a 6 elementos en una sola hoja", () => {
      const items = [1, 2, 3, 4, 5, 6]
      const hojas = agruparEnHojasDeSeis(items)
      expect(hojas).toHaveLength(1)
      expect(hojas[0]).toEqual([1, 2, 3, 4, 5, 6])
    })

    it("agrupa 7 elementos en 2 hojas (6 en la primera, 1 en la segunda)", () => {
      const items = [1, 2, 3, 4, 5, 6, 7]
      const hojas = agruparEnHojasDeSeis(items)
      expect(hojas).toHaveLength(2)
      expect(hojas[0]).toEqual([1, 2, 3, 4, 5, 6])
      expect(hojas[1]).toEqual([7])
    })

    it("agrupa 13 elementos en 3 hojas (6, 6, 1)", () => {
      const items = Array.from({ length: 13 }, (_, i) => i + 1)
      const hojas = agruparEnHojasDeSeis(items)
      expect(hojas).toHaveLength(3)
      expect(hojas[0]).toHaveLength(VALES_POR_HOJA)
      expect(hojas[1]).toHaveLength(VALES_POR_HOJA)
      expect(hojas[2]).toHaveLength(1)
    })
  })

  describe("calcularHojasRequeridas", () => {
    it("calcula 0 hojas para 0 items", () => {
      expect(calcularHojasRequeridas(0)).toBe(0)
    })

    it("calcula 1 hoja para 1 a 6 items", () => {
      expect(calcularHojasRequeridas(1)).toBe(1)
      expect(calcularHojasRequeridas(6)).toBe(1)
    })

    it("calcula 2 hojas para 7 a 12 items", () => {
      expect(calcularHojasRequeridas(7)).toBe(2)
      expect(calcularHojasRequeridas(12)).toBe(2)
    })

    it("calcula 3 hojas para 13 items", () => {
      expect(calcularHojasRequeridas(13)).toBe(3)
    })
  })

  describe("obtenerFolioCortoVale", () => {
    it("genera un folio corto y limpio a partir del id", () => {
      expect(obtenerFolioCortoVale("abc123xyz")).toBe("V-123XYZ")
      expect(obtenerFolioCortoVale("doc-456")).toBe("V-DOC456")
      expect(obtenerFolioCortoVale("")).toBe("VALE-0000")
    })
  })

  describe("calcularTotalMontoVales", () => {
    it("suma correctamente los montos", () => {
      const lista: MovimientoCajaChica[] = [
        crearMovimiento("1", "SALIDA", "NINGUNO", 100.5),
        crearMovimiento("2", "SALIDA", "NINGUNO", 250),
      ]
      expect(calcularTotalMontoVales(lista)).toBe(350.5)
    })
  })
})
