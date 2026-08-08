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

/**
 * Días entre dos fechas `YYYY-MM-DD`. Devuelve `null` cuando alguna no es válida
 * o cuando la final es anterior a la inicial: un lead time negativo es un error
 * de captura que hay que corregir, no un 0 que se traga el problema.
 */
export function diferenciaEnDias(
  fechaInicioISO: string,
  fechaFinISO: string
): number | null {
  const ini = new Date(`${fechaInicioISO}T00:00:00Z`).getTime()
  const fin = new Date(`${fechaFinISO}T00:00:00Z`).getTime()
  if (Number.isNaN(ini) || Number.isNaN(fin) || fin < ini) return null
  return Math.round((fin - ini) / (1000 * 60 * 60 * 24))
}

export function calcularLeadTimePromedio(
  pedidos: readonly { diasLeadTime?: number | null; estado: string }[]
): number | null {
  const conLeadTime = pedidos.filter(
    (p) => p.estado === "recibido" && p.diasLeadTime !== undefined && p.diasLeadTime !== null
  )
  if (conLeadTime.length === 0) return null
  const suma = conLeadTime.reduce((acc, curr) => acc + (curr.diasLeadTime ?? 0), 0)
  return Math.round(suma / conLeadTime.length)
}

export function generarTextoWeChat(
  seleccionadas: readonly EndmillMedida[],
  filas: Record<string, { cantidad: number; precio: number }>
): string {
  // Solo las partidas con cantidad real: numerarlas y contarlas sobre la
  // selección completa dejaría huecos (1, 3, 4) y un total de artículos que no
  // corresponde a lo que se le está pidiendo al proveedor.
  const incluidas = seleccionadas
    .map((medida) => ({ medida, fila: filas[medida.id] }))
    .filter((item) => item.fila && item.fila.cantidad > 0)

  const totalPiezas = incluidas.reduce((total, { fila }) => total + fila.cantidad, 0)
  const totalUSD = incluidas.reduce(
    (total, { fila }) => total + redondearUSD(fila.cantidad * fila.precio),
    0
  )

  return [
    "Hi Rita,",
    "Please confirm price & stock for the following end mills order:",
    "",
    ...incluidas.map(
      ({ medida, fila }, index) =>
        `${index + 1}. ${medida.medidaPulgadas}" ${medida.descripcion} (${medida.specPropuesta}) - Qty: ${fila.cantidad} pcs @ $${fila.precio.toFixed(2)} USD = $${redondearUSD(fila.cantidad * fila.precio).toFixed(2)} USD`
    ),
    "",
    `Total Items: ${incluidas.length} | Total Pieces: ${totalPiezas}`,
    `Estimated Total: $${redondearUSD(totalUSD).toFixed(2)} USD`,
    "Thank you! - SMV Maquinados",
  ].join("\n")
}

