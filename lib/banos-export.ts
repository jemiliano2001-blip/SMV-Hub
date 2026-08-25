import type { RegistroBano } from "@/lib/schemas"
import {
  generarBufferExcelFormal,
  type ColumnaExcelConfig,
} from "@/lib/excel-export-base"

export interface VisitaDetalleOperador {
  horaEntrada: string
  horaLlegada: string | null
  minutos: number | null
  bano: string
}

export interface ResumenOperadorDiario {
  operador: string
  visitas: number
  tiempoTotalMinutos: number
  tiempoPromedioMinutos: number
  visitasEnCurso: number
  visitasProlongadas: number
  visitasDetalle: VisitaDetalleOperador[]
}

export interface ResumenBanoDiario {
  bano: string
  visitas: number
  tiempoTotalMinutos: number
}

export interface EstadisticasDiariasBanos {
  fecha: string
  totalVisitas: number
  operadoresDistintos: number
  tiempoTotalMinutos: number
  promedioMinutosPorVisita: number
  visitasProlongadas: number
  visitasEnCurso: number
  personaMayorTiempo: { operador: string; minutos: number } | null
  porOperador: ResumenOperadorDiario[]
  porBano: ResumenBanoDiario[]
  registros: RegistroBano[]
}

export interface ResumenOperadorMensual {
  operador: string
  totalVisitas: number
  totalMinutos: number
  formatoHoras: string
  promedioMinutosPorVisita: number
  diasConVisita: number
}

export interface EstadisticasMensualesBanos {
  mes: string
  totalVisitas: number
  operadoresDistintos: number
  tiempoTotalMinutos: number
  formatoHorasTotal: string
  promedioMinutosPorVisita: number
  operadores: ResumenOperadorMensual[]
  porBano: ResumenBanoDiario[]
}

export function formatearHorasMinutos(minutosTotales: number): string {
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  if (horas === 0) return `${minutos} min`
  return `${horas}h ${minutos.toString().padStart(2, "0")}m`
}

export function formatearHorasReloj(minutosTotales: number): string {
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  return `${horas}:${minutos.toString().padStart(2, "0")}:00`
}

export function calcularEstadisticasDiarias(
  registros: RegistroBano[],
  fecha: string
): EstadisticasDiariasBanos {
  const registrosDelDia = registros
    .filter((r) => r.fecha === fecha)
    .sort((a, b) => a.horaEntrada.localeCompare(b.horaEntrada))

  const totalVisitas = registrosDelDia.length
  let tiempoTotalMinutos = 0
  let visitasProlongadas = 0
  let visitasEnCurso = 0
  let visitasConTiempo = 0

  const opMap = new Map<string, ResumenOperadorDiario>()
  const banoMap = new Map<string, { visitas: number; tiempoTotalMinutos: number }>()

  // Inicializar mapa de baños conocidos
  const banosConocidos = ["Baño #1", "Baño #2", "CNC", "Automatizacion"]
  banosConocidos.forEach((b) => banoMap.set(b, { visitas: 0, tiempoTotalMinutos: 0 }))

  for (const r of registrosDelDia) {
    const mins = typeof r.tiempoMinutos === "number" ? r.tiempoMinutos : 0
    const esEnCurso = !r.horaLlegada
    const esProlongada = mins >= 15

    if (esEnCurso) {
      visitasEnCurso++
    } else {
      tiempoTotalMinutos += mins
      visitasConTiempo++
    }

    if (esProlongada) {
      visitasProlongadas++
    }

    // Agrupación por operador
    if (!opMap.has(r.operador)) {
      opMap.set(r.operador, {
        operador: r.operador,
        visitas: 0,
        tiempoTotalMinutos: 0,
        tiempoPromedioMinutos: 0,
        visitasEnCurso: 0,
        visitasProlongadas: 0,
        visitasDetalle: [],
      })
    }

    const opData = opMap.get(r.operador)!
    opData.visitas++
    if (esEnCurso) {
      opData.visitasEnCurso++
    } else {
      opData.tiempoTotalMinutos += mins
    }
    if (esProlongada) {
      opData.visitasProlongadas++
    }
    opData.visitasDetalle.push({
      horaEntrada: r.horaEntrada,
      horaLlegada: r.horaLlegada,
      minutos: r.tiempoMinutos ?? null,
      bano: r.bano,
    })

    // Agrupación por baño
    if (!banoMap.has(r.bano)) {
      banoMap.set(r.bano, { visitas: 0, tiempoTotalMinutos: 0 })
    }
    const bData = banoMap.get(r.bano)!
    bData.visitas++
    bData.tiempoTotalMinutos += mins
  }

  // Calcular promedios por operador y ordenar por mayor tiempo acumulado
  const porOperador = Array.from(opMap.values())
    .map((op) => {
      const completadas = op.visitas - op.visitasEnCurso
      const tiempoPromedioMinutos =
        completadas > 0 ? Math.round(op.tiempoTotalMinutos / completadas) : 0
      return {
        ...op,
        tiempoPromedioMinutos,
      }
    })
    .sort((a, b) => b.tiempoTotalMinutos - a.tiempoTotalMinutos || b.visitas - a.visitas)

  const porBano = Array.from(banoMap.entries()).map(([bano, data]) => ({
    bano,
    visitas: data.visitas,
    tiempoTotalMinutos: data.tiempoTotalMinutos,
  }))

  const promedioMinutosPorVisita =
    visitasConTiempo > 0 ? Math.round(tiempoTotalMinutos / visitasConTiempo) : 0

  const personaMayorTiempo =
    porOperador.length > 0 && porOperador[0].tiempoTotalMinutos > 0
      ? { operador: porOperador[0].operador, minutos: porOperador[0].tiempoTotalMinutos }
      : null

  return {
    fecha,
    totalVisitas,
    operadoresDistintos: opMap.size,
    tiempoTotalMinutos,
    promedioMinutosPorVisita,
    visitasProlongadas,
    visitasEnCurso,
    personaMayorTiempo,
    porOperador,
    porBano,
    registros: registrosDelDia,
  }
}

export function calcularEstadisticasMensuales(
  registros: RegistroBano[],
  mes: string
): EstadisticasMensualesBanos {
  const start = `${mes}-01`
  const end = `${mes}-31`
  const registrosDelMes = registros.filter((r) => r.fecha >= start && r.fecha <= end)

  let totalVisitas = 0
  let tiempoTotalMinutos = 0
  let visitasConTiempo = 0

  const opMap = new Map<
    string,
    {
      totalVisitas: number
      totalMinutos: number
      fechas: Set<string>
      visitasConTiempo: number
    }
  >()

  const banoMap = new Map<string, { visitas: number; tiempoTotalMinutos: number }>()
  const banosConocidos = ["Baño #1", "Baño #2", "CNC", "Automatizacion"]
  banosConocidos.forEach((b) => banoMap.set(b, { visitas: 0, tiempoTotalMinutos: 0 }))

  for (const r of registrosDelMes) {
    totalVisitas++
    const mins = typeof r.tiempoMinutos === "number" ? r.tiempoMinutos : 0
    if (typeof r.tiempoMinutos === "number") {
      tiempoTotalMinutos += mins
      visitasConTiempo++
    }

    if (!opMap.has(r.operador)) {
      opMap.set(r.operador, {
        totalVisitas: 0,
        totalMinutos: 0,
        fechas: new Set<string>(),
        visitasConTiempo: 0,
      })
    }
    const opData = opMap.get(r.operador)!
    opData.totalVisitas++
    opData.fechas.add(r.fecha)
    if (typeof r.tiempoMinutos === "number") {
      opData.totalMinutos += mins
      opData.visitasConTiempo++
    }

    if (!banoMap.has(r.bano)) {
      banoMap.set(r.bano, { visitas: 0, tiempoTotalMinutos: 0 })
    }
    const bData = banoMap.get(r.bano)!
    bData.visitas++
    bData.tiempoTotalMinutos += mins
  }

  const operadores: ResumenOperadorMensual[] = Array.from(opMap.entries())
    .map(([operador, data]) => ({
      operador,
      totalVisitas: data.totalVisitas,
      totalMinutos: data.totalMinutos,
      formatoHoras: formatearHorasReloj(data.totalMinutos),
      promedioMinutosPorVisita:
        data.visitasConTiempo > 0
          ? Math.round(data.totalMinutos / data.visitasConTiempo)
          : 0,
      diasConVisita: data.fechas.size,
    }))
    .sort((a, b) => b.totalMinutos - a.totalMinutos || b.totalVisitas - a.totalVisitas)

  const porBano = Array.from(banoMap.entries()).map(([bano, data]) => ({
    bano,
    visitas: data.visitas,
    tiempoTotalMinutos: data.tiempoTotalMinutos,
  }))

  const promedioMinutosPorVisita =
    visitasConTiempo > 0 ? Math.round(tiempoTotalMinutos / visitasConTiempo) : 0

  return {
    mes,
    totalVisitas,
    operadoresDistintos: opMap.size,
    tiempoTotalMinutos,
    formatoHorasTotal: formatearHorasMinutos(tiempoTotalMinutos),
    promedioMinutosPorVisita,
    operadores,
    porBano,
  }
}

/**
 * Genera un texto conciso y formateado del reporte diario listo para copiar
 * y compartir en WhatsApp, Slack, Teams o Correo.
 */
export function generarTextoResumenDiario(stats: EstadisticasDiariasBanos): string {
  const [yyyy, mm, dd] = stats.fecha.split("-")
  const fechaFormateada = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : stats.fecha

  let texto = `*📊 REPORTE DIARIO DE CONTROL DE BAÑOS — SMV*\n`
  texto += `📅 *Fecha:* ${fechaFormateada}\n`
  texto += `👥 *Total visitas:* ${stats.totalVisitas} (${stats.operadoresDistintos} operadores distintos)\n`
  texto += `⏱ *Tiempo total acumulado:* ${formatearHorasMinutos(stats.tiempoTotalMinutos)}\n`
  texto += `🎯 *Promedio por visita:* ${stats.promedioMinutosPorVisita} min\n`

  if (stats.visitasProlongadas > 0) {
    texto += `⚠️ *Visitas prolongadas (≥15 min):* ${stats.visitasProlongadas}\n`
  }

  if (stats.personaMayorTiempo) {
    texto += `📌 *Mayor permanencia:* ${stats.personaMayorTiempo.operador} (${stats.personaMayorTiempo.minutos} min)\n`
  }

  texto += `\n*── Desglose por Operador ──*\n`
  if (stats.porOperador.length === 0) {
    texto += `_Sin registros en esta fecha._\n`
  } else {
    stats.porOperador.forEach((op, index) => {
      const horariosStr = op.visitasDetalle
        .map((v) => `${v.horaEntrada}-${v.horaLlegada || "En curso"} (${v.minutos !== null ? `${v.minutos}m` : "?"})`)
        .join(", ")
      texto += `${index + 1}. *${op.operador}:* ${op.visitas} ${op.visitas === 1 ? "visita" : "visitas"} · ${op.tiempoTotalMinutos} min total [${horariosStr}]\n`
    })
  }

  texto += `\n_Generado automáticamente desde SMV Hub_`
  return texto
}

/**
 * Genera el archivo Excel formal (.xlsx) del Reporte Diario de Baños
 */
export async function generarExcelReporteDiario(
  stats: EstadisticasDiariasBanos
): Promise<ArrayBuffer> {
  const columnas: ColumnaExcelConfig[] = [
    { header: "#", width: 6, align: "center" },
    { header: "Operador", width: 28, align: "left" },
    { header: "Baño", width: 18, align: "center" },
    { header: "Hora Entrada", width: 14, align: "center" },
    { header: "Hora Llegada", width: 14, align: "center" },
    { header: "Duración (Min)", width: 16, align: "right", numFmt: "#,##0" },
    { header: "Estatus", width: 16, align: "center" },
  ]

  const filas = stats.registros.map((r, idx) => {
    const mins = r.tiempoMinutos ?? ""
    const estatus = !r.horaLlegada
      ? "En curso"
      : typeof r.tiempoMinutos === "number" && r.tiempoMinutos >= 15
      ? "Prolongado (≥15m)"
      : "Completado"

    return [
      idx + 1,
      r.operador,
      r.bano,
      r.horaEntrada,
      r.horaLlegada || "—",
      mins,
      estatus,
    ]
  })

  return generarBufferExcelFormal({
    nombreHoja: `Reporte ${stats.fecha}`,
    titulo: "Reporte Diario de Control de Baños",
    subtitulo: `Fecha: ${stats.fecha}`,
    metadatos: `Total visitas: ${stats.totalVisitas}  ·  Tiempo acumulado: ${formatearHorasMinutos(stats.tiempoTotalMinutos)}  ·  Promedio: ${stats.promedioMinutosPorVisita} min`,
    columnas,
    filas,
    totales: {
      labelColSpan: 5,
      label: "TOTAL MINUTOS:",
      valores: [
        {
          colIndex: 6,
          valor: stats.tiempoTotalMinutos,
          numFmt: "#,##0",
          align: "right",
        },
      ],
    },
    orientacion: "portrait",
  })
}

/**
 * Genera el archivo Excel formal (.xlsx) del Resumen Mensual de Baños
 */
export async function generarExcelResumenMensual(
  stats: EstadisticasMensualesBanos
): Promise<ArrayBuffer> {
  const columnas: ColumnaExcelConfig[] = [
    { header: "#", width: 6, align: "center" },
    { header: "Operador", width: 30, align: "left" },
    { header: "Visitas Totales", width: 16, align: "right", numFmt: "#,##0" },
    { header: "Días con Visita", width: 16, align: "right", numFmt: "#,##0" },
    { header: "Total Minutos", width: 16, align: "right", numFmt: "#,##0" },
    { header: "Horas y Minutos", width: 18, align: "center" },
    { header: "Promedio / Visita", width: 18, align: "right", numFmt: "#,##0" },
  ]

  const filas = stats.operadores.map((op, idx) => [
    idx + 1,
    op.operador,
    op.totalVisitas,
    op.diasConVisita,
    op.totalMinutos,
    op.formatoHoras,
    op.promedioMinutosPorVisita,
  ])

  return generarBufferExcelFormal({
    nombreHoja: `Resumen ${stats.mes}`,
    titulo: "Resumen Mensual de Control de Baños",
    subtitulo: `Periodo: ${stats.mes}`,
    metadatos: `Total visitas: ${stats.totalVisitas}  ·  Operadores: ${stats.operadoresDistintos}  ·  Tiempo acumulado: ${stats.formatoHorasTotal}`,
    columnas,
    filas,
    totales: {
      labelColSpan: 2,
      label: "TOTAL GENERAL:",
      valores: [
        {
          colIndex: 3,
          valor: stats.totalVisitas,
          numFmt: "#,##0",
          align: "right",
        },
        {
          colIndex: 5,
          valor: stats.tiempoTotalMinutos,
          numFmt: "#,##0",
          align: "right",
        },
        {
          colIndex: 6,
          valor: formatearHorasReloj(stats.tiempoTotalMinutos),
          align: "center",
        },
      ],
    },
    orientacion: "portrait",
  })
}
