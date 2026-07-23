import { describe, expect, it } from "vitest"
import { prepararWebVital } from "@/lib/ux-telemetry"

describe("telemetría anónima de experiencia", () => {
  it("reduce CLS a un payload seguro y agregado", () => {
    expect(
      prepararWebVital({
        name: "CLS",
        value: 0.1234,
        delta: 0.0234,
        rating: "needs-improvement",
        navigationType: "navigate",
      })
    ).toEqual({
      metric_name: "CLS",
      metric_value: 123,
      metric_delta: 23,
      metric_rating: "needs-improvement",
      navigation_type: "navigate",
    })
  })

  it("rechaza métricas no permitidas y valores inválidos", () => {
    expect(
      prepararWebVital({ name: "email", value: 1, delta: 1 })
    ).toBeNull()
    expect(
      prepararWebVital({ name: "LCP", value: Number.NaN, delta: 1 })
    ).toBeNull()
  })

  it("no propaga tipos de navegación arbitrarios", () => {
    expect(
      prepararWebVital({
        name: "INP",
        value: 180.4,
        delta: 20.1,
        navigationType: "/proveedores/identificador-sensible",
      })
    ).toMatchObject({ navigation_type: "unknown" })
  })
})
