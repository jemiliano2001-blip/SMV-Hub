import { describe, expect, it } from "vitest"
import {
  aUSD,
  aMXN,
  TIPO_CAMBIO_DEFAULT_USD_MXN,
  COLECCION_CONFIG,
  DOC_TIPO_CAMBIO,
} from "@/lib/tipo-cambio"

describe("tipo-cambio", () => {
  it("exporta constantes del sistema de configuración", () => {
    expect(TIPO_CAMBIO_DEFAULT_USD_MXN).toBe(20.0)
    expect(COLECCION_CONFIG).toBe("config_sistema")
    expect(DOC_TIPO_CAMBIO).toBe("tipo_cambio")
  })

  it("convierte a USD respetando la moneda de origen", () => {
    // Si ya es USD, no modifica el monto
    expect(aUSD(100, "USD", 20)).toBe(100)
    expect(aUSD(50.5, "USD", 18.5)).toBe(50.5)

    // Si es MXN, divide por el tipo de cambio
    expect(aUSD(200, "MXN", 20)).toBe(10)
    expect(aUSD(100, "MXN", 20)).toBe(5)
    expect(aUSD(180, "MXN", 18)).toBe(10)

    // Fallback cuando usdToMxn es 0 o negativo
    expect(aUSD(200, "MXN", 0)).toBe(10)
    expect(aUSD(200, "MXN", -5)).toBe(10)
  })

  it("convierte a MXN respetando la moneda de origen", () => {
    // Si ya es MXN, no modifica el monto
    expect(aMXN(250, "MXN", 20)).toBe(250)

    // Si es USD, multiplica por el tipo de cambio
    expect(aMXN(10, "USD", 20)).toBe(200)
    expect(aMXN(5, "USD", 18)).toBe(90)

    // Fallback cuando usdToMxn es 0 o negativo
    expect(aMXN(10, "USD", 0)).toBe(200)
    expect(aMXN(10, "USD", -10)).toBe(200)
  })
})
