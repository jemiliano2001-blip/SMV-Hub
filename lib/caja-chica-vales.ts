import type { MovimientoCajaChica } from "@/lib/schemas"

export const VALES_POR_HOJA = 6

/**
 * Filtra los movimientos de caja chica que corresponden a gastos (SALIDA)
 * y cuyo comprobante sea 'NINGUNO' (o según opciones adicionales).
 */
export function filtrarGastosSinComprobante(
  movimientos: MovimientoCajaChica[],
  opciones?: { incluirVales?: boolean }
): MovimientoCajaChica[] {
  const incluirVales = opciones?.incluirVales ?? false

  return movimientos.filter((m) => {
    if (m.anulado) return false
    if (m.tipo !== "SALIDA") return false
    if (m.comprobante === "NINGUNO") return true
    if (incluirVales && m.comprobante === "VALE") return true
    return false
  })
}

/**
 * Agrupa una lista de elementos en páginas con un máximo de elementos por página (default 6).
 */
export function agruparEnHojasDeSeis<T>(items: T[], tamanoHoja = VALES_POR_HOJA): T[][] {
  if (!items || items.length === 0) return []
  const hojas: T[][] = []
  for (let i = 0; i < items.length; i += tamanoHoja) {
    hojas.push(items.slice(i, i + tamanoHoja))
  }
  return hojas
}

/**
 * Calcula el número total de hojas físicas requeridas para imprimir N vales.
 */
export function calcularHojasRequeridas(totalItems: number, itemsPorHoja = VALES_POR_HOJA): number {
  if (totalItems <= 0) return 0
  return Math.ceil(totalItems / itemsPorHoja)
}

/**
 * Genera un folio corto y legible para el vale físico a partir del ID del movimiento.
 */
export function obtenerFolioCortoVale(id: string): string {
  if (!id) return "VALE-0000"
  const limpio = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  const sufijo = limpio.slice(-6).padStart(4, "0")
  return `V-${sufijo}`
}

/**
 * Suma el monto total de una lista de movimientos para vales.
 */
export function calcularTotalMontoVales(movimientos: MovimientoCajaChica[]): number {
  return movimientos.reduce((acc, m) => acc + (Number(m.monto) || 0), 0)
}
