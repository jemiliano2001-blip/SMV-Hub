import type { Requisicion, PedidoAlmacen } from "@/lib/schemas"
import type { PuntoPrecioHistorico } from "@/lib/proveedores-inteligencia-cruzada"
import { detectarAtrasosOperativos, type ItemAtrasoRadar } from "./detector-atrasos"
import { detectarAnomaliasPrecio, type AnomaliaPrecioRadar } from "./detector-precios"

export interface DiagnosticoOperativo {
  atrasos: ItemAtrasoRadar[]
  anomaliasPrecio: AnomaliaPrecioRadar[]
  scoreSaludOperativa: number // 0 a 100
  nivelSalud: "optimo" | "atencion" | "critico"
  totalAlertasCriticas: number
  fechaEvaluacion: string
}

/**
 * Orquestador principal del Radar de Inteligencia.
 * Coordina los sub-detectores de atrasos y anomalías de precio para calcular
 * el diagnóstico general de salud operativa (0-100%).
 */
export function evaluarSaludOperativa(args: {
  requisiciones: Requisicion[]
  pedidosAlmacen: PedidoAlmacen[]
  puntosPrecio: PuntoPrecioHistorico[]
  hoyISO?: string
}): DiagnosticoOperativo {
  const atrasos = detectarAtrasosOperativos(args.requisiciones, args.pedidosAlmacen, args.hoyISO)
  const anomaliasPrecio = detectarAnomaliasPrecio(args.puntosPrecio)

  let score = 100

  // Penalización por atrasos
  for (const a of atrasos) {
    if (a.urgente) {
      score -= 15
    } else {
      score -= 8
    }
  }

  // Penalización por desvíos de precios
  for (const p of anomaliasPrecio) {
    if (p.porcentajeIncremento >= 30) {
      score -= 10
    } else {
      score -= 5
    }
  }

  score = Math.max(0, Math.min(100, score))

  const totalAlertasCriticas = atrasos.filter((a) => a.urgente).length + anomaliasPrecio.filter((p) => p.porcentajeIncremento >= 25).length

  let nivelSalud: "optimo" | "atencion" | "critico" = "optimo"
  if (score < 60 || totalAlertasCriticas > 2) {
    nivelSalud = "critico"
  } else if (score < 85 || atrasos.length > 0 || anomaliasPrecio.length > 0) {
    nivelSalud = "atencion"
  }

  return {
    atrasos,
    anomaliasPrecio,
    scoreSaludOperativa: score,
    nivelSalud,
    totalAlertasCriticas,
    fechaEvaluacion: new Date().toISOString(),
  }
}
