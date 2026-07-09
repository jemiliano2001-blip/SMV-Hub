import { describe, it, expect } from "vitest"
import {
  calcularTotalEsperado,
  validarCuadreFactura,
  validarImpuestoTexas,
  TASA_IMPUESTO_TEXAS,
} from "@/lib/factura-montos"

describe("calcularTotalEsperado", () => {
  it("suma subtotal + envío + impuestos", () => {
    expect(
      calcularTotalEsperado({
        subtotal: 100,
        envio: 15,
        impuestos: 9.49,
        total: 124.49,
      })
    ).toBeCloseTo(124.49)
  })

  it("trata null como 0 en componentes parciales", () => {
    expect(
      calcularTotalEsperado({ subtotal: 100, envio: null, impuestos: 8.25, total: 108.25 })
    ).toBeCloseTo(108.25)
  })
})

describe("validarCuadreFactura", () => {
  it("cuadra cuando subtotal + envío + impuestos = total", () => {
    const r = validarCuadreFactura({
      subtotal: 100,
      envio: 15,
      impuestos: 9.49,
      total: 124.49,
    })
    expect(r.cuadra).toBe(true)
    expect(r.mensaje).toBeNull()
  })

  it("detecta desajuste cuando falta envío en la suma", () => {
    const r = validarCuadreFactura({
      subtotal: 100,
      envio: null,
      impuestos: 9.49,
      total: 124.49,
    })
    expect(r.cuadra).toBe(false)
    expect(r.mensaje).toContain("109.49")
  })

  it("permite tolerancia de centavos por redondeo", () => {
    const r = validarCuadreFactura({
      subtotal: 100,
      envio: 15,
      impuestos: 9.4875,
      total: 124.49,
    })
    expect(r.cuadra).toBe(true)
  })
})

describe("validarImpuestoTexas", () => {
  it("acepta 8.25% sobre subtotal + envío", () => {
    const base = 115
    const imp = Math.round(base * TASA_IMPUESTO_TEXAS * 100) / 100
    const r = validarImpuestoTexas({ subtotal: 100, envio: 15, impuestos: imp })
    expect(r.coherente).toBe(true)
  })

  it("sugiere envío cuando el tax cuadra solo sobre subtotal", () => {
    const impSoloSub = Math.round(100 * TASA_IMPUESTO_TEXAS * 100) / 100
    const r = validarImpuestoTexas({ subtotal: 100, envio: 15, impuestos: impSoloSub })
    expect(r.coherente).toBe(false)
    expect(r.mensaje).toContain("solo sobre subtotal")
  })
})
