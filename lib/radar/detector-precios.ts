import type { PuntoPrecioHistorico } from "@/lib/proveedores-inteligencia-cruzada"
import { formatPrecio } from "@/lib/format"

export interface AnomaliaPrecioRadar {
  id: string
  llavePieza: string
  descripcion: string
  proveedorNombre: string
  precioActualUSD: number
  precioHistoricoUSD: number
  porcentajeIncremento: number
  fechaUltima: string
  fuente: string
  mensaje: string
}

const UMBRAL_PORCENTAJE_ANOMALIA = 15 // 15% incremento

/**
 * Sub-detector que escanea puntos de precio histórico agrupados por pieza y proveedor
 * para encontrar incrementos atípicos de costo (>15%).
 */
export function detectarAnomaliasPrecio(
  puntos: PuntoPrecioHistorico[]
): AnomaliaPrecioRadar[] {
  const anomalias: AnomaliaPrecioRadar[] = []
  if (puntos.length < 2) return []

  // Agrupar puntos por llavePieza + proveedorNombre
  const grupos = new Map<string, PuntoPrecioHistorico[]>()

  for (const p of puntos) {
    if (p.precioUnitarioUSD <= 0) continue
    const clave = `${p.llavePieza}|${p.proveedorNombre.toLowerCase().trim()}`
    const list = grupos.get(clave) ?? []
    list.push(p)
    grupos.set(clave, list)
  }

  for (const [clave, items] of grupos.entries()) {
    if (items.length < 2) continue

    // Ordenar por fecha ascendente
    items.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))

    const ultimo = items[items.length - 1]
    const anteriores = items.slice(0, items.length - 1)

    // Calcular promedio histórico anterior
    const sumaAnteriores = anteriores.reduce((acc, i) => acc + i.precioUnitarioUSD, 0)
    const promedioAnterior = sumaAnteriores / anteriores.length

    if (promedioAnterior <= 0) continue

    const incrementoPct = ((ultimo.precioUnitarioUSD - promedioAnterior) / promedioAnterior) * 100

    if (incrementoPct >= UMBRAL_PORCENTAJE_ANOMALIA) {
      anomalias.push({
        id: `${ultimo.docId || clave}-${ultimo.fecha}`,
        llavePieza: ultimo.llavePieza,
        descripcion: ultimo.descripcion,
        proveedorNombre: ultimo.proveedorNombre,
        precioActualUSD: ultimo.precioUnitarioUSD,
        precioHistoricoUSD: promedioAnterior,
        porcentajeIncremento: Math.round(incrementoPct),
        fechaUltima: ultimo.fecha,
        fuente: ultimo.fuente,
        mensaje: `Sube +${Math.round(incrementoPct)}% (${formatPrecio(ultimo.precioUnitarioUSD, "USD")} vs promedio histórico ${formatPrecio(promedioAnterior, "USD")})`,
      })
    }
  }

  // Ordenar anomalías por mayor incremento de precio descendente
  return anomalias.sort((a, b) => b.porcentajeIncremento - a.porcentajeIncremento)
}
