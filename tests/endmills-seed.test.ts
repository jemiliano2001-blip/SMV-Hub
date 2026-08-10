import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { EndmillsSeedSchema, type EndmillsSeed } from "@/lib/schemas"
import { redondearUSD } from "@/lib/endmills-calculos"

// `endmills-seed.json` trae precios reales del proveedor chino y vive en
// .gitignore, así que no existe en CI ni en un clon limpio. Se carga en tiempo
// de ejecución (no con `import`, que rompía `tsc --noEmit` en CI con TS2307) y
// la suite se salta cuando falta, igual que las pruebas de reglas sin emulador.
const RUTA_SEED = resolve(import.meta.dirname, "..", "endmills-seed.json")
const haySeed = existsSync(RUTA_SEED)
const describeConSeed = haySeed ? describe : describe.skip

let cache: EndmillsSeed | null = null

/** Perezoso a propósito: el cuerpo de un `describe.skip` sí se evalúa. */
function seed(): EndmillsSeed {
  cache ??= EndmillsSeedSchema.parse(JSON.parse(readFileSync(RUTA_SEED, "utf8")))
  return cache
}

describeConSeed("seed real de Endmills China", () => {
  it("contiene las 47 medidas reales con IDs únicos", () => {
    expect(seed().medidas).toHaveLength(47)
    expect(new Set(seed().medidas.map((medida) => medida.id)).size).toBe(47)
  })

  it("conserva la distribución real por categoría", () => {
    const medidas = seed().medidas
    const conteos = Object.fromEntries(
      [...new Set(medidas.map((medida) => medida.categoria))]
        .map((categoria) => [
          categoria,
          medidas.filter((medida) => medida.categoria === categoria).length,
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
    expect(seed().medidas
      .filter((medida) => medida.cotizacionChinaAgo2026.requiereConfirmacion)
      .map((medida) => medida.id)).toEqual([2, 38])
  })

  it("cuadra el pedido histórico de marzo", () => {
    const { medidas, ordenMarzoTotales } = seed()
    const historicas = medidas.filter(
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
    expect(ordenMarzoTotales.piezasTotales - piezasRastreadas).toBe(5)
    expect(redondearUSD(ordenMarzoTotales.costoItemsUSD - costoRastreado)).toBe(36.75)
    expect(redondearUSD(
      ordenMarzoTotales.costoItemsUSD +
      ordenMarzoTotales.aliCostUSD +
      ordenMarzoTotales.shippingUSD
    )).toBe(ordenMarzoTotales.totalUSD)
  })
})
