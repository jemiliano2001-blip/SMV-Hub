import { describe, expect, it } from "vitest"
import {
  esClaveProdServ,
  normalizarClaveProdServ,
  normalizarTextoSat,
  tokenizarTextoSat,
  stemPalabraSat,
  stemTextoSat,
} from "@/lib/sat/normalizar"

describe("normalizarTextoSat", () => {
  it("convierte a mayúsculas y quita acentos", () => {
    expect(normalizarTextoSat("Resorte de compresión")).toBe("RESORTE DE COMPRESION")
  })

  it("deja solo caracteres relevantes para búsqueda", () => {
    expect(normalizarTextoSat("Tornillo M6 x 20, acero inoxidable")).toBe("TORNILLO M6 X 20 ACERO INOXIDABLE")
  })
})

describe("tokenizarTextoSat", () => {
  it("elimina palabras vacías comunes", () => {
    expect(tokenizarTextoSat("resorte de compresion para troquel")).toEqual(["RESORTE", "COMPRESION", "TROQUEL"])
  })
})

describe("stemPalabraSat", () => {
  it("quita una 's' final en palabras de más de 3 letras", () => {
    expect(stemPalabraSat("RESORTES")).toBe("RESORTE")
    expect(stemPalabraSat("TORNILLOS")).toBe("TORNILLO")
  })

  it("no toca palabras cortas para no destruir siglas/unidades", () => {
    expect(stemPalabraSat("GAS")).toBe("GAS")
    expect(stemPalabraSat("MES")).toBe("MES")
  })

  it("no toca palabras que ya están en singular", () => {
    expect(stemPalabraSat("RESORTE")).toBe("RESORTE")
  })
})

describe("stemTextoSat", () => {
  it("estematiza cada palabra de una frase normalizada", () => {
    expect(stemTextoSat("RESORTES DE COMPRESION")).toBe("RESORTE DE COMPRESION")
  })
})

describe("normalizarClaveProdServ", () => {
  it("acepta claves de 8 dígitos aunque vengan con separadores", () => {
    expect(normalizarClaveProdServ("31-1615-00")).toBe("31161500")
  })

  it("rechaza valores que no sean una clave SAT válida", () => {
    expect(normalizarClaveProdServ("ABC123")).toBeNull()
    expect(esClaveProdServ("1234")).toBe(false)
  })
})
