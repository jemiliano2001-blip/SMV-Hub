import { describe, expect, it } from "vitest"
import {
  MAX_ITEMS_SUGERIR_CLAVE_SAT,
  itemPayloadSugerirClaveSat,
  normalizarHistorialEntradasSat,
  partirLoteSugerirClaveSat,
} from "@/lib/sat/payload-sugerir-clave"

describe("partirLoteSugerirClaveSat", () => {
  it("parte un lote más grande que el tope de la API", () => {
    const items = Array.from({ length: 51 }, (_, i) => i)
    const lotes = partirLoteSugerirClaveSat(items)

    expect(MAX_ITEMS_SUGERIR_CLAVE_SAT).toBe(50)
    expect(lotes).toHaveLength(2)
    expect(lotes[0]).toHaveLength(50)
    expect(lotes[1]).toEqual([50])
  })

  it("devuelve un solo lote si cabe en el tope", () => {
    expect(partirLoteSugerirClaveSat(["a", "b"], 50)).toEqual([["a", "b"]])
  })

  it("devuelve vacío si no hay ítems", () => {
    expect(partirLoteSugerirClaveSat([])).toEqual([])
  })
})

describe("itemPayloadSugerirClaveSat", () => {
  it("omite proveedor nulo para no romper el schema de la API", () => {
    expect(
      itemPayloadSugerirClaveSat({
        descripcion: "Compression spring",
        proveedor: null,
      })
    ).toEqual({ descripcion: "Compression spring" })
  })

  it("convierte descripción ausente en string vacío para conservar índices", () => {
    expect(itemPayloadSugerirClaveSat({ descripcion: undefined })).toEqual({
      descripcion: "",
    })
  })

  it("trunca terminosPrevios a 1000 caracteres", () => {
    const payload = itemPayloadSugerirClaveSat({
      descripcion: "Resorte",
      terminosPrevios: "x".repeat(1005),
    })
    expect(payload.terminosPrevios).toHaveLength(1000)
  })
})

describe("normalizarHistorialEntradasSat", () => {
  it("descarta entradas con clave inválida sin fallar el lote", () => {
    expect(
      normalizarHistorialEntradasSat([
        { descripcion: "Tornillo", claveProdServ: "31161500" },
        { descripcion: "Basura", claveProdServ: "ABC" },
        { descripcion: "  ", claveProdServ: "31161904" },
      ])
    ).toEqual([{ descripcion: "Tornillo", claveProdServ: "31161500" }])
  })

  it("acepta clave numérica de 8 dígitos", () => {
    expect(
      normalizarHistorialEntradasSat([{ descripcion: "Resorte", claveProdServ: 31161904 }])
    ).toEqual([{ descripcion: "Resorte", claveProdServ: "31161904" }])
  })
})
