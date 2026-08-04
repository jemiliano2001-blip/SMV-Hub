import { describe, expect, it } from "vitest"
import { validarClaveProdServCatalogo } from "@/lib/sat/validar-clave"

describe("validarClaveProdServCatalogo", () => {
  it("acepta una clave existente y la normaliza", () => {
    expect(validarClaveProdServCatalogo("31161904")).toBe("31161904")
    expect(validarClaveProdServCatalogo("31-1619-04")).toBe("31161904")
  })

  it("rechaza una clave de ocho dígitos que no existe", () => {
    expect(validarClaveProdServCatalogo("99999999")).toBeNull()
    expect(validarClaveProdServCatalogo("1234")).toBeNull()
  })
})
