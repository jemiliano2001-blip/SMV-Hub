import { describe, expect, it } from "vitest"
import seedJson from "@/endmills-seed.json"
import { EndmillsSeedSchema } from "@/lib/schemas"
import { redondearUSD } from "@/lib/endmills-calculos"

describe("seed real de Endmills China", () => {
  const seed = EndmillsSeedSchema.parse(seedJson)

  it("contiene las 47 medidas reales con IDs únicos", () => {
    expect(seed.medidas).toHaveLength(47)
    expect(new Set(seed.medidas.map((medida) => medida.id)).size).toBe(47)
  })

  it("conserva la distribución real por categoría", () => {
    const conteos = Object.fromEntries(
      [...new Set(seed.medidas.map((medida) => medida.categoria))]
        .map((categoria) => [
          categoria,
          seed.medidas.filter((medida) => medida.categoria === categoria).length,
        ])
    )
    expect(conteos).toEqual({
      FLAT: 19,
      BALL: 8,
      "LARGO FLAT": 4,
      "LARGO BOLA": 3,
      "EXTRA LARGO FLAT": 4,
      "EXTRA LARGO BOLA": 5,
      "RUPA CARBURO": 4,
    })
  })

  it("marca únicamente las dos specs inconsistentes", () => {
    expect(seed.medidas
      .filter((medida) => medida.cotizacionChinaAgo2026.requiereConfirmacion)
      .map((medida) => medida.id)).toEqual([2, 38])
  })

  it("cuadra el pedido histórico de marzo", () => {
    const historicas = seed.medidas.filter(
      (medida) => medida.ordenMarzo2026.piezasPedidas !== null
    )
    const piezasRastreadas = historicas.reduce(
      (total, medida) => total + (medida.ordenMarzo2026.piezasPedidas ?? 0),
      0
    )
    const costoRastreado = redondearUSD(historicas.reduce(
      (total, medida) => total + (medida.ordenMarzo2026.subtotalUSD ?? 0),
      0
    ))

    expect(historicas).toHaveLength(32)
    expect(piezasRastreadas).toBe(478)
    expect(costoRastreado).toBe(5_885.19)
    expect(seed.ordenMarzoTotales.piezasTotales - piezasRastreadas).toBe(5)
    expect(redondearUSD(seed.ordenMarzoTotales.costoItemsUSD - costoRastreado)).toBe(36.75)
    expect(redondearUSD(
      seed.ordenMarzoTotales.costoItemsUSD +
      seed.ordenMarzoTotales.aliCostUSD +
      seed.ordenMarzoTotales.shippingUSD
    )).toBe(seed.ordenMarzoTotales.totalUSD)
  })
})

