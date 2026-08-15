import { describe, expect, it } from "vitest"
import {
  buscarCoincidenciaCatalogo,
  parsearTextoExcelEndmills,
} from "@/lib/endmills-extraer-ia"
import type { EndmillMedida } from "@/lib/schemas"

const CATALOGO_MOCK = [
  {
    id: "m-1",
    medidaPulgadas: "1/4",
    categoria: "FLAT",
    descripcion: "FLAT 4 FILOS 1/4 x 2-1/2\"",
    specPropuesta: "D1/4*FL3/4*D1/4*2-1/2\"L*4F",
    stockActual: 10,
    objetivoPar: 15,
    precioActualUSD: 7.92,
    requiereConfirmacion: false,
    orden: 1,
    actualizadoEn: new Date(),
  },
  {
    id: "m-2",
    medidaPulgadas: "1/8",
    categoria: "BALL",
    descripcion: "BALL 2 FILOS 1/8 x 1-1/2\"",
    specPropuesta: "D1/8*FL1/2*D1/8*1-1/2\"L*2F",
    stockActual: 5,
    objetivoPar: 10,
    precioActualUSD: 5.5,
    requiereConfirmacion: false,
    orden: 2,
    actualizadoEn: new Date(),
  },
] as unknown as EndmillMedida[]

describe("endmills-extraer-ia (Parser & Matching)", () => {
  it("encuentra coincidencia exacta por medida de pulgadas y descripción", () => {
    const match = buscarCoincidenciaCatalogo("1/4", CATALOGO_MOCK)
    expect(match.medidaId).toBe("m-1")
    expect(match.nivel).toBe("exacto")
  })

  it("encuentra coincidencia exacta ignorando acentos y comillas", () => {
    const match = buscarCoincidenciaCatalogo('FLAT 4 FILOS 1/4 x 2-1/2"', CATALOGO_MOCK)
    expect(match.medidaId).toBe("m-1")
    expect(match.nivel).toBe("exacto")
  })

  it("encuentra coincidencia aproximada por palabras clave", () => {
    const match = buscarCoincidenciaCatalogo("fresa ball 1/8", CATALOGO_MOCK)
    expect(match.medidaId).toBe("m-2")
    expect(match.nivel).toBe("aproximado")
  })

  it("devuelve nuevo cuando no existe en catálogo", () => {
    const match = buscarCoincidenciaCatalogo("3/4 extra larga", CATALOGO_MOCK)
    expect(match.medidaId).toBeNull()
    expect(match.nivel).toBe("nuevo")
  })

  it("maneja texto vacío o solo espacios sin errores", () => {
    const match = buscarCoincidenciaCatalogo("   ", CATALOGO_MOCK)
    expect(match.medidaId).toBeNull()
    expect(match.nivel).toBe("nuevo")
  })

  it("maneja catálogo vacío retornando nuevo", () => {
    const match = buscarCoincidenciaCatalogo("1/4 FLAT", [])
    expect(match.medidaId).toBeNull()
    expect(match.nivel).toBe("nuevo")
  })

  it("parsea celdas copiadas directamente de Excel (TSV)", () => {
    const textoExcel = "1/4 FLAT 4 FILOS\t10\t7.92\n1/8 BALL 2 FILOS\t20\t5.50"
    const items = parsearTextoExcelEndmills(textoExcel, CATALOGO_MOCK)

    expect(items).toHaveLength(2)
    expect(items[0].medidaIdCoincidencia).toBe("m-1")
    expect(items[0].cantidadPedida).toBe(10)
    expect(items[0].precioUnitarioUSD).toBe(7.92)

    expect(items[1].medidaIdCoincidencia).toBe("m-2")
    expect(items[1].cantidadPedida).toBe(20)
    expect(items[1].precioUnitarioUSD).toBe(5.5)
  })

  it("parsea líneas con comas y punto y coma como separadores", () => {
    const textoCSV = "1/4 FLAT 4 FILOS, 15, 7.92\n1/8 BALL 2 FILOS; 8; 5.50"
    const items = parsearTextoExcelEndmills(textoCSV, CATALOGO_MOCK)

    expect(items).toHaveLength(2)
    expect(items[0].cantidadPedida).toBe(15)
    expect(items[1].cantidadPedida).toBe(8)
  })

  it("ignora líneas vacías o de solo espacios en Excel", () => {
    const textoConEspacios = "\n\n   \n1/4 FLAT 4 FILOS\t5\t7.92\n\n"
    const items = parsearTextoExcelEndmills(textoConEspacios, CATALOGO_MOCK)

    expect(items).toHaveLength(1)
    expect(items[0].cantidadPedida).toBe(5)
  })

  it("adopta el precio del catálogo si el texto no especifica precio", () => {
    const textoSinPrecio = "1/4 FLAT 4 FILOS\t12"
    const items = parsearTextoExcelEndmills(textoSinPrecio, CATALOGO_MOCK)

    expect(items).toHaveLength(1)
    expect(items[0].cantidadPedida).toBe(12)
    expect(items[0].precioUnitarioUSD).toBe(7.92)
  })
})
