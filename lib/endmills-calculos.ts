import type { EndmillMedida, EstadoStockEndmill } from "@/lib/schemas"

export const UMBRAL_CRITICO_ENDMILLS = 0.25

export function redondearUSD(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function calcularObjetivoPar(
  stockAntesPedido: number | null,
  cantidadPedida: number
): number | null {
  if (stockAntesPedido === null) return null
  return Math.max(0, Math.trunc(stockAntesPedido) + Math.trunc(cantidadPedida))
}

export function calcularCantidadSugerida(
  objetivoPar: number | null,
  stockActual: number
): number | null {
  if (objetivoPar === null) return null
  return Math.max(0, Math.trunc(objetivoPar) - Math.trunc(stockActual))
}

export function clasificarStockEndmill(
  stockActual: number,
  objetivoPar: number | null
): EstadoStockEndmill {
  if (objetivoPar === null) return "sin_base"
  if (objetivoPar <= 0) return "ok"
  if (
    stockActual === 0 ||
    stockActual <= Math.ceil(objetivoPar * UMBRAL_CRITICO_ENDMILLS)
  ) {
    return "critico"
  }
  if (stockActual < objetivoPar) return "bajo"
  return "ok"
}

export interface LineaTotalEndmills {
  cantidadPedida: number
  precioUnitarioUSD: number
}

export interface TotalesPedidoEndmills {
  costoItemsUSD: number
  aliCostUSD: number
  shippingUSD: number
  totalUSD: number
  numeroPartidas: number
  numeroPiezas: number
}

export function calcularTotalesPedidoEndmills(
  partidas: readonly LineaTotalEndmills[],
  aliCostUSD: number,
  shippingUSD: number
): TotalesPedidoEndmills {
  const incluidas = partidas.filter((partida) => partida.cantidadPedida > 0)
  const costoItemsUSD = redondearUSD(
    incluidas.reduce(
      (total, partida) =>
        total + redondearUSD(partida.cantidadPedida * partida.precioUnitarioUSD),
      0
    )
  )
  const ali = redondearUSD(Math.max(0, aliCostUSD))
  const shipping = redondearUSD(Math.max(0, shippingUSD))
  return {
    costoItemsUSD,
    aliCostUSD: ali,
    shippingUSD: shipping,
    totalUSD: redondearUSD(costoItemsUSD + ali + shipping),
    numeroPartidas: incluidas.length,
    numeroPiezas: incluidas.reduce((total, partida) => total + partida.cantidadPedida, 0),
  }
}

export function sugerenciaParaMedida(medida: EndmillMedida): number | null {
  return calcularCantidadSugerida(medida.objetivoPar, medida.stockActual)
}

