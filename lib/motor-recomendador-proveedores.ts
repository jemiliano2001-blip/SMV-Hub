import type { Proveedor, EvaluacionProveedor, CompraProveedor } from "@/lib/schemas"
import { aUSD, TIPO_CAMBIO_DEFAULT_USD_MXN } from "@/lib/tipo-cambio"

export type ModoRecomendacion = "primera_compra" | "recompra" | "personalizado"

export interface ConfiguracionPesosRecomendador {
  pesoPrecio: number        // 0.30 (30%)
  pesoLeadTime: number      // 0.20 (20%)
  pesoCalidad: number       // 0.20 (20%)
  pesoCumplimiento: number  // 0.15 (15%)
  pesoComunicacion: number  // 0.10 (10%)
  pesoHistorial: number     // 0.05 (5%)
}

export const CONFIGURACION_PESOS_DEFAULT: ConfiguracionPesosRecomendador = {
  pesoPrecio: 0.30,
  pesoLeadTime: 0.20,
  pesoCalidad: 0.20,
  pesoCumplimiento: 0.15,
  pesoComunicacion: 0.10,
  pesoHistorial: 0.05,
}

export const PESOS_PRIMERA_COMPRA: ConfiguracionPesosRecomendador = {
  pesoPrecio: 0.40,
  pesoLeadTime: 0.25,
  pesoCalidad: 0.15,
  pesoCumplimiento: 0.10,
  pesoComunicacion: 0.10,
  pesoHistorial: 0.00,
}

export const PESOS_RECOMPRA: ConfiguracionPesosRecomendador = {
  pesoPrecio: 0.20,
  pesoLeadTime: 0.10,
  pesoCalidad: 0.25,
  pesoCumplimiento: 0.25,
  pesoComunicacion: 0.05,
  pesoHistorial: 0.15,
}

export interface OfertaParaEvaluacion {
  proveedorId: string
  proveedorNombre: string
  precioTotal: number
  moneda: "USD" | "MXN"
  leadTimeDias: number
  condicionesPago?: string
  observaciones?: string
  idCotizacion?: string
}

export interface DesgloseCriterios {
  scorePrecio: number
  scoreLeadTime: number
  scoreCalidad: number
  scoreCumplimiento: number
  scoreComunicacion: number
  scoreHistorial: number
  penalizaciones: number
}

export interface AlertaInteligente {
  tipo: "warning" | "danger" | "info"
  mensaje: string
}

export interface ResultadoEvaluacionProveedor {
  proveedorId: string
  proveedorNombre: string
  scoreTotal: number
  desglose: DesgloseCriterios
  razonRecomendacion: string
  puntosFuertes: string[]
  riesgosDetectados: string[]
  alertas: AlertaInteligente[]
  esGanadorRecomendado: boolean
  esEmpateTecnico: boolean
  esInformacionInsuficiente: boolean
  datosProveedor?: Proveedor
}

export interface ResultadoRecomendacionGlobal {
  proveedorRecomendado: ResultadoEvaluacionProveedor | null
  empateSegundaOpcion: ResultadoEvaluacionProveedor | null
  evaluaciones: ResultadoEvaluacionProveedor[]
  estadoGlobal: "recomendacion_clara" | "empate_tecnico" | "informacion_insuficiente"
  mensajeExplicativo: string
  modoEvaluacion: ModoRecomendacion
  explicacionModo: string
  pesosAplicados: ConfiguracionPesosRecomendador
}

/**
 * Motor Transparente y Explicable de Recomendación de Proveedores SMV.
 * @param tipoCambioUsdMxn — MXN por 1 USD (configurable; default 20). Nunca hardcodear en callers.
 * @param confiabilidadPorProveedor — score 1–5 de lead time real vs prometido (reemplaza cumplimiento default).
 */
export function evaluarYRecomendarProveedores(
  ofertas: OfertaParaEvaluacion[],
  catalogoProveedores: Proveedor[] = [],
  evaluacionesHistoricas: EvaluacionProveedor[] = [],
  comprasHistoricas: CompraProveedor[] = [],
  configuracion: ConfiguracionPesosRecomendador = CONFIGURACION_PESOS_DEFAULT,
  tipoCambioUsdMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN,
  confiabilidadPorProveedor: Record<string, number> = {}
): ResultadoRecomendacionGlobal {
  // Determinar si es Recompra o Primera Compra
  const tieneComprasPrevias = ofertas.some((of) =>
    comprasHistoricas.some(
      (c) => c.proveedorId === of.proveedorId || c.proveedorNombre.toLowerCase().includes(of.proveedorNombre.toLowerCase())
    )
  )

  let modoEvaluacion: ModoRecomendacion = "primera_compra"
  let pesosEfectivos = PESOS_PRIMERA_COMPRA
  let explicacionModo = "Modo Primera Compra: Se asigna mayor peso a Precio (40%), Lead Time (25%) y Respuesta rápida por falta de historial previo."

  if (configuracion !== CONFIGURACION_PESOS_DEFAULT) {
    modoEvaluacion = "personalizado"
    pesosEfectivos = configuracion
    explicacionModo = "Modo Personalizado: Se aplican los pesos de ponderación ajustados manualmente."
  } else if (tieneComprasPrevias) {
    modoEvaluacion = "recompra"
    pesosEfectivos = PESOS_RECOMPRA
    explicacionModo = "Modo Recompra: Se asigna mayor peso a Cumplimiento (25%), Calidad en taller (25%) e Historial comprobado (15%)."
  }

  if (ofertas.length === 0) {
    return {
      proveedorRecomendado: null,
      empateSegundaOpcion: null,
      evaluaciones: [],
      estadoGlobal: "informacion_insuficiente",
      mensajeExplicativo: "No hay cotizaciones disponibles para evaluar.",
      modoEvaluacion,
      explicacionModo,
      pesosAplicados: pesosEfectivos,
    }
  }

  // Filtrar ofertas válidas con precio y lead time
  const ofertasValidas = ofertas.filter((o) => o.precioTotal > 0 && o.leadTimeDias > 0)

  if (ofertasValidas.length === 0) {
    return {
      proveedorRecomendado: null,
      empateSegundaOpcion: null,
      evaluaciones: [],
      estadoGlobal: "informacion_insuficiente",
      mensajeExplicativo: "Información insuficiente: las cotizaciones no incluyen precio o tiempo de entrega válido.",
      modoEvaluacion,
      explicacionModo,
      pesosAplicados: pesosEfectivos,
    }
  }

  // Valores de referencia para puntuación relativa (divisa normalizada vía tipo de cambio configurable)
  const preciosUSD = ofertasValidas.map((o) => aUSD(o.precioTotal, o.moneda, tipoCambioUsdMxn))
  const minPrecioUSD = Math.min(...preciosUSD)
  const maxPrecioUSD = Math.max(...preciosUSD)

  const leadTimes = ofertasValidas.map((o) => o.leadTimeDias)
  const minLeadTime = Math.min(...leadTimes)

  const resultados: ResultadoEvaluacionProveedor[] = ofertas.map((of) => {
    // Si la oferta no tiene precio válido
    if (of.precioTotal <= 0 || of.leadTimeDias <= 0) {
      return {
        proveedorId: of.proveedorId,
        proveedorNombre: of.proveedorNombre,
        scoreTotal: 0,
        desglose: {
          scorePrecio: 0,
          scoreLeadTime: 0,
          scoreCalidad: 0,
          scoreCumplimiento: 0,
          scoreComunicacion: 0,
          scoreHistorial: 0,
          penalizaciones: 0,
        },
        razonRecomendacion: "Datos incompletos en cotización.",
        puntosFuertes: [],
        riesgosDetectados: ["Cotización incompleta"],
        alertas: [{ tipo: "warning", mensaje: "Falta precio o lead time en cotización." }],
        esGanadorRecomendado: false,
        esEmpateTecnico: false,
        esInformacionInsuficiente: true,
      }
    }

    // Datos del proveedor en catálogo
    const provCat = catalogoProveedores.find(
      (p) => p.id === of.proveedorId || p.nombre.toLowerCase().includes(of.proveedorNombre.toLowerCase())
    )

    // Datos de evaluaciones históricas
    const evalHist = evaluacionesHistoricas.find(
      (e) => e.proveedorId === of.proveedorId || (provCat && e.proveedorId === provCat.id)
    )

    // Compras previas
    const comprasProv = comprasHistoricas.filter(
      (c) => c.proveedorId === of.proveedorId || (provCat && c.proveedorId === provCat.id)
    )

    // 1. Score Precio (30%)
    const precioNormalizadoUSD = aUSD(of.precioTotal, of.moneda, tipoCambioUsdMxn)
    const scorePrecio = (minPrecioUSD / precioNormalizadoUSD) * 100

    // 2. Score Lead Time (20%)
    const scoreLeadTime = (minLeadTime / of.leadTimeDias) * 100

    // 3. Score Calidad (20%)
    const calificacionEstrellas = evalHist ? evalHist.calidad : provCat?.calificacion ?? 4.0
    const scoreCalidad = (calificacionEstrellas / 5.0) * 100

    // 4. Score Cumplimiento (15%) — preferir confiabilidad lead-time real si existe
    const idConfiabilidad = of.proveedorId || provCat?.id || ""
    const cumplimientoVal =
      confiabilidadPorProveedor[idConfiabilidad] ??
      (evalHist ? evalHist.cumplimiento : 4.0)
    const scoreCumplimiento = (cumplimientoVal / 5.0) * 100

    // 5. Score Comunicación (10%)
    let scoreComunicacion = 80
    if (provCat?.tiempoRespuesta === "inmediato" || provCat?.tiempoRespuesta === "mismo_dia") scoreComunicacion = 100
    else if (provCat?.tiempoRespuesta === "24_48h") scoreComunicacion = 75
    else if (provCat?.tiempoRespuesta === "lento") scoreComunicacion = 50

    // 6. Score Historial (5%)
    const numCompras = comprasProv.length
    const scoreHistorial = Math.min(100, numCompras * 20 + 20)

    // Penalizaciones
    let penalizaciones = 0
    const riesgos: string[] = []
    const alertas: AlertaInteligente[] = []
    const puntosFuertes: string[] = []

    // Penalización por mala calidad
    if (calificacionEstrellas < 3.0) {
      penalizaciones += 25
      riesgos.push("Bajo desempeño de calidad reportado en evaluaciones previas")
      alertas.push({ tipo: "danger", mensaje: "Proveedor con calificación de calidad de riesgo (< 3.0 ⭐)." })
    }

    // Alerta de lead time alto
    if (of.leadTimeDias > 7) {
      riesgos.push(`Lead time elevado (${of.leadTimeDias} días hábiles)`)
      alertas.push({ tipo: "warning", mensaje: `Tiempo de entrega elevado: ${of.leadTimeDias} días.` })
    }

    // Alerta de precio muy caro
    if (maxPrecioUSD > minPrecioUSD * 1.35 && precioNormalizadoUSD === maxPrecioUSD) {
      riesgos.push("Precio cotizado 35% por encima de la opción más económica")
      alertas.push({ tipo: "info", mensaje: "Cotización significativamente más costosa que alternativas." })
    }

    // Sin historial / Prospecto
    if (comprasProv.length === 0) {
      alertas.push({ tipo: "info", mensaje: "Proveedor prospecto sin compras históricas registradas." })
      if (!provCat || provCat.estatus === "prospecto") {
        riesgos.push("Primera compra / Sin historial previo de entregas")
      }
    } else {
      puntosFuertes.push(`Historial comprobado con ${comprasProv.length} compras exitosas`)
    }

    if (precioNormalizadoUSD === minPrecioUSD) {
      puntosFuertes.push("Opción más económica de la cotización")
    }

    if (of.leadTimeDias === minLeadTime) {
      puntosFuertes.push(`Entrega más rápida (${of.leadTimeDias} días)`)
    }

    if (provCat?.recomendado || provCat?.tipoProveedor === "premium") {
      puntosFuertes.push("Proveedor recomendado / High Performance")
    }

    // CÁLCULO FINAL DE SCORE
    const scoreBruto =
      scorePrecio * pesosEfectivos.pesoPrecio +
      scoreLeadTime * pesosEfectivos.pesoLeadTime +
      scoreCalidad * pesosEfectivos.pesoCalidad +
      scoreCumplimiento * pesosEfectivos.pesoCumplimiento +
      scoreComunicacion * pesosEfectivos.pesoComunicacion +
      scoreHistorial * pesosEfectivos.pesoHistorial

    const scoreTotal = Math.max(0, Math.round(scoreBruto - penalizaciones))

    let razonRecomendacion = "Recomendado por mejor balance entre precio, lead time y desempeño."
    if (precioNormalizadoUSD === minPrecioUSD && of.leadTimeDias === minLeadTime) {
      razonRecomendacion = "Recomendado: combina el precio más bajo y la entrega más rápida."
    } else if (precioNormalizadoUSD === minPrecioUSD) {
      razonRecomendacion = "Recomendado por ser la alternativa con el precio más competitivo."
    } else if (of.leadTimeDias === minLeadTime && calificacionEstrellas >= 4.5) {
      razonRecomendacion = "Recomendado por alta velocidad de entrega y excelente calidad de herramientas."
    }

    return {
      proveedorId: of.proveedorId,
      proveedorNombre: of.proveedorNombre,
      scoreTotal,
      desglose: {
        scorePrecio: Math.round(scorePrecio),
        scoreLeadTime: Math.round(scoreLeadTime),
        scoreCalidad: Math.round(scoreCalidad),
        scoreCumplimiento: Math.round(scoreCumplimiento),
        scoreComunicacion: Math.round(scoreComunicacion),
        scoreHistorial: Math.round(scoreHistorial),
        penalizaciones,
      },
      razonRecomendacion,
      puntosFuertes,
      riesgosDetectados: riesgos,
      alertas,
      esGanadorRecomendado: false,
      esEmpateTecnico: false,
      esInformacionInsuficiente: false,
      datosProveedor: provCat,
    }
  })

  // Ordenar por score descendente
  resultados.sort((a, b) => b.scoreTotal - a.scoreTotal)

  if (resultados.length === 0 || resultados[0].scoreTotal === 0) {
    return {
      proveedorRecomendado: null,
      empateSegundaOpcion: null,
      evaluaciones: resultados,
      estadoGlobal: "informacion_insuficiente",
      mensajeExplicativo: "Información insuficiente para emitir una recomendación automática sólida.",
      modoEvaluacion,
      explicacionModo,
      pesosAplicados: pesosEfectivos,
    }
  }

  const mejor = resultados[0]
  const segundaOpcion = resultados.length > 1 ? resultados[1] : null

  // Verificar si hay empate técnico (diferencia <= 2 puntos)
  const esEmpate = segundaOpcion !== null && Math.abs(mejor.scoreTotal - segundaOpcion.scoreTotal) <= 2

  if (esEmpate && segundaOpcion) {
    mejor.esEmpateTecnico = true
    segundaOpcion.esEmpateTecnico = true
    return {
      proveedorRecomendado: mejor,
      empateSegundaOpcion: segundaOpcion,
      evaluaciones: resultados,
      estadoGlobal: "empate_tecnico",
      mensajeExplicativo: `Empate técnico entre ${mejor.proveedorNombre} (${mejor.scoreTotal} pts) y ${segundaOpcion.proveedorNombre} (${segundaOpcion.scoreTotal} pts). Ambos son opciones viables.`,
      modoEvaluacion,
      explicacionModo,
      pesosAplicados: pesosEfectivos,
    }
  }

  mejor.esGanadorRecomendado = true

  return {
    proveedorRecomendado: mejor,
    empateSegundaOpcion: null,
    evaluaciones: resultados,
    estadoGlobal: "recomendacion_clara",
    mensajeExplicativo: `Recomendación automática (${modoEvaluacion === "primera_compra" ? "Primera Compra" : "Recompra"}): ${mejor.proveedorNombre} (${mejor.scoreTotal} pts). ${mejor.razonRecomendacion}`,
    modoEvaluacion,
    explicacionModo,
    pesosAplicados: pesosEfectivos,
  }
}
