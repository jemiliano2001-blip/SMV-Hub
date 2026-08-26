import type { EstadisticasDiariasBanos } from "@/lib/banos-export"
import { formatearHorasMinutos } from "@/lib/banos-export"

function formatearFechaLegible(fechaStr: string): string {
  if (!fechaStr) return ""
  const [yyyy, mm, dd] = fechaStr.split("-").map(Number)
  if (!yyyy || !mm || !dd) return fechaStr
  const fecha = new Date(yyyy, mm - 1, dd)
  return fecha.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatearFechaCorta(fechaStr: string): string {
  const [yyyy, mm, dd] = fechaStr.split("-")
  return dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : fechaStr
}

function redondearRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export interface ResultadoImagenReporte {
  blobJpg: Blob
  blobPng: Blob
  dataUrlJpg: string
}

/**
 * Genera un canvas 2D en alta resolución (1080px de ancho) estilizado como tarjeta ejecutiva
 * para compartir por WhatsApp de manera clara y nítida.
 */
export async function generarImagenReporteDiario(
  stats: EstadisticasDiariasBanos
): Promise<ResultadoImagenReporte> {
  if (typeof document === "undefined") {
    throw new Error("La generación de imagen solo está disponible en el navegador.")
  }

  const canvas = document.createElement("canvas")
  const width = 1080
  const margin = 48
  const contentWidth = width - margin * 2

  // Dimensiones dinámicas
  const headerHeight = 170
  const kpiHeight = 150
  const tableHeaderHeight = 52
  const rowHeight = 48
  const footerHeight = 80
  const totalRows = Math.max(stats.registros.length, 1)
  const tableContentHeight = totalRows * rowHeight
  const extraPadding = 60

  const height =
    margin +
    headerHeight +
    24 +
    kpiHeight +
    32 +
    tableHeaderHeight +
    tableContentHeight +
    extraPadding +
    footerHeight +
    margin

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("No se pudo obtener el contexto 2D del Canvas")
  }

  // 1. Fondo general (Blanco puro con sutil gradiente a slate muy claro)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
  bgGrad.addColorStop(0, "#ffffff")
  bgGrad.addColorStop(1, "#f8fafc")
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // Borde contenedor exterior
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 4
  redondearRect(ctx, 16, 16, width - 32, height - 32, 28)
  ctx.stroke()

  let currentY = margin

  // 2. Encabezado principal (Tarjeta oscura elegante #0f172a)
  ctx.fillStyle = "#0f172a"
  redondearRect(ctx, margin, currentY, contentWidth, headerHeight, 20)
  ctx.fill()

  // Logo / Tag SMV
  ctx.fillStyle = "#38bdf8"
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText("SMV MAQUINADOS S.A. DE C.V.", margin + 32, currentY + 45)

  // Subtitulo de área
  ctx.fillStyle = "#94a3b8"
  ctx.font = "500 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  ctx.fillText("Control de Tiempos e Incidencias en Baño", margin + 32, currentY + 72)

  // Título del Reporte
  ctx.fillStyle = "#ffffff"
  ctx.font = "800 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  ctx.fillText("REPORTE DIARIO DE CONTROL DE BAÑOS", margin + 32, currentY + 115)

  // Fecha legible
  ctx.fillStyle = "#38bdf8"
  ctx.font = "600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  const fechaTexto = formatearFechaLegible(stats.fecha).toUpperCase()
  ctx.fillText(fechaTexto, margin + 32, currentY + 144)

  currentY += headerHeight + 24

  // 3. Grid de 4 KPIs Ejecutivos
  const kpiGap = 16
  const kpiColWidth = (contentWidth - kpiGap * 3) / 4

  const kpis = [
    {
      label: "TOTAL VISITAS",
      val: `${stats.totalVisitas}`,
      sub: `${stats.operadoresDistintos} operadores`,
      color: "#0f172a",
      valColor: "#0f172a",
    },
    {
      label: "TIEMPO ACUMULADO",
      val: formatearHorasMinutos(stats.tiempoTotalMinutos),
      sub: `${stats.tiempoTotalMinutos} minutos totales`,
      color: "#0284c7",
      valColor: "#0369a1",
    },
    {
      label: "PROMEDIO / VISITA",
      val: `${stats.promedioMinutosPorVisita} min`,
      sub: "por estancia",
      color: "#475569",
      valColor: "#0f172a",
    },
    {
      label: "PROLONGADAS",
      val: `${stats.visitasProlongadas}`,
      sub: stats.visitasProlongadas > 0 ? "≥ 15 min (alerta)" : "Sin incidencias",
      color: stats.visitasProlongadas > 0 ? "#dc2626" : "#16a34a",
      valColor: stats.visitasProlongadas > 0 ? "#b91c1c" : "#15803d",
    },
  ]

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiColWidth + kpiGap)

    // Tarjeta de fondo
    ctx.fillStyle = "#ffffff"
    redondearRect(ctx, kpiX, currentY, kpiColWidth, kpiHeight, 16)
    ctx.fill()
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 2
    redondearRect(ctx, kpiX, currentY, kpiColWidth, kpiHeight, 16)
    ctx.stroke()

    // Borde superior de color
    ctx.fillStyle = kpi.color
    redondearRect(ctx, kpiX, currentY, kpiColWidth, 6, 3)
    ctx.fill()

    // Label KPI
    ctx.fillStyle = "#64748b"
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(kpi.label, kpiX + 18, currentY + 36)

    // Valor KPI
    ctx.fillStyle = kpi.valColor
    ctx.font = "800 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    ctx.fillText(kpi.val, kpiX + 18, currentY + 80)

    // Subtexto KPI
    ctx.fillStyle = "#94a3b8"
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    ctx.fillText(kpi.sub, kpiX + 18, currentY + 114)
  })

  currentY += kpiHeight + 32

  // 4. Tabla de Movimientos
  // Encabezado de tabla
  ctx.fillStyle = "#1e293b"
  redondearRect(ctx, margin, currentY, contentWidth, tableHeaderHeight, 12)
  ctx.fill()

  // Columnas: x offsets y anchos
  const colX = {
    num: margin + 20,
    operador: margin + 70,
    bano: margin + 350,
    entrada: margin + 530,
    salida: margin + 660,
    duracion: margin + 790,
    estatus: margin + 920,
  }

  ctx.fillStyle = "#f8fafc"
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

  ctx.textAlign = "left"
  ctx.fillText("#", colX.num, currentY + 32)
  ctx.fillText("OPERADOR", colX.operador, currentY + 32)
  ctx.fillText("BAÑO", colX.bano, currentY + 32)

  ctx.textAlign = "center"
  ctx.fillText("ENTRADA", colX.entrada, currentY + 32)
  ctx.fillText("SALIDA", colX.salida, currentY + 32)
  ctx.fillText("DURACIÓN", colX.duracion, currentY + 32)
  ctx.fillText("ESTATUS", colX.estatus, currentY + 32)

  currentY += tableHeaderHeight + 6

  // Filas de la tabla
  if (stats.registros.length === 0) {
    ctx.fillStyle = "#f1f5f9"
    redondearRect(ctx, margin, currentY, contentWidth, 80, 10)
    ctx.fill()

    ctx.fillStyle = "#64748b"
    ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("No hay registros en esta fecha.", width / 2, currentY + 46)
    currentY += 80
  } else {
    stats.registros.forEach((r, idx) => {
      const isEven = idx % 2 === 0
      const rowY = currentY + idx * rowHeight

      // Fondo de fila alternada
      ctx.fillStyle = isEven ? "#ffffff" : "#f8fafc"
      redondearRect(ctx, margin, rowY, contentWidth, rowHeight - 4, 8)
      ctx.fill()
      ctx.strokeStyle = "#f1f5f9"
      ctx.lineWidth = 1
      redondearRect(ctx, margin, rowY, contentWidth, rowHeight - 4, 8)
      ctx.stroke()

      const esProlongado = typeof r.tiempoMinutos === "number" && r.tiempoMinutos >= 15
      const esEnCurso = !r.horaLlegada

      // #
      ctx.fillStyle = "#94a3b8"
      ctx.font = "600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      ctx.textAlign = "left"
      ctx.fillText(`${idx + 1}`, colX.num, rowY + 28)

      // Operador
      ctx.fillStyle = "#0f172a"
      ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      ctx.fillText(r.operador, colX.operador, rowY + 28)

      // Baño
      ctx.fillStyle = "#475569"
      ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      ctx.fillText(r.bano, colX.bano, rowY + 28)

      // Entrada
      ctx.fillStyle = "#0f172a"
      ctx.font = "600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace"
      ctx.textAlign = "center"
      ctx.fillText(r.horaEntrada, colX.entrada, rowY + 28)

      // Salida
      ctx.fillStyle = r.horaLlegada ? "#0f172a" : "#94a3b8"
      ctx.font = "600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace"
      ctx.fillText(r.horaLlegada || "—", colX.salida, rowY + 28)

      // Duración
      if (typeof r.tiempoMinutos === "number") {
        ctx.fillStyle = esProlongado ? "#dc2626" : "#0f172a"
        ctx.font = esProlongado
          ? "800 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace"
          : "700 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace"
        ctx.fillText(`${r.tiempoMinutos} min`, colX.duracion, rowY + 28)
      } else {
        ctx.fillStyle = "#d97706"
        ctx.font = "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        ctx.fillText("En curso", colX.duracion, rowY + 28)
      }

      // Badge de Estatus
      const badgeW = 90
      const badgeH = 26
      const badgeX = colX.estatus - badgeW / 2
      const badgeY = rowY + 11

      if (esEnCurso) {
        ctx.fillStyle = "#fef3c7"
        redondearRect(ctx, badgeX, badgeY, badgeW, badgeH, 13)
        ctx.fill()
        ctx.fillStyle = "#b45309"
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        ctx.fillText("En baño", colX.estatus, rowY + 28)
      } else if (esProlongado) {
        ctx.fillStyle = "#fee2e2"
        redondearRect(ctx, badgeX, badgeY, badgeW, badgeH, 13)
        ctx.fill()
        ctx.fillStyle = "#b91c1c"
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        ctx.fillText("≥ 15 min", colX.estatus, rowY + 28)
      } else {
        ctx.fillStyle = "#dcfce7"
        redondearRect(ctx, badgeX, badgeY, badgeW, badgeH, 13)
        ctx.fill()
        ctx.fillStyle = "#15803d"
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        ctx.fillText("Normal", colX.estatus, rowY + 28)
      }
    })

    currentY += stats.registros.length * rowHeight
  }

  currentY += 28

  // 5. Pie de página formal
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margin, currentY)
  ctx.lineTo(width - margin, currentY)
  ctx.stroke()

  currentY += 24

  ctx.fillStyle = "#64748b"
  ctx.font = "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText("SMV Hub · Sistema de Control y Reportes", margin + 12, currentY + 12)

  const ahora = new Date()
  const horaEmitido = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  const fechaEmitido = formatearFechaCorta(stats.fecha)

  ctx.fillStyle = "#94a3b8"
  ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  ctx.textAlign = "right"
  ctx.fillText(`Emitido: ${fechaEmitido} ${horaEmitido}`, width - margin - 12, currentY + 12)

  // 6. Conversión a Blobs
  const blobJpg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error("Error generando Blob JPG"))
      },
      "image/jpeg",
      0.95
    )
  })

  const blobPng = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error("Error generando Blob PNG"))
      },
      "image/png"
    )
  })

  const dataUrlJpg = canvas.toDataURL("image/jpeg", 0.95)

  return {
    blobJpg,
    blobPng,
    dataUrlJpg,
  }
}

/**
 * Descarga el archivo JPG en el navegador y copia la imagen al portapapeles
 * para que el usuario pueda enviarlo por WhatsApp directamente.
 */
export async function descargarYCopiarImagenDiaria(
  stats: EstadisticasDiariasBanos
): Promise<{ copiado: boolean; descargado: boolean }> {
  const { blobJpg, blobPng } = await generarImagenReporteDiario(stats)

  // 1. Descarga automática del archivo JPG
  let descargado = false
  try {
    const url = URL.createObjectURL(blobJpg)
    const a = document.createElement("a")
    a.href = url
    a.download = `Reporte_Diario_Banos_${stats.fecha}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    descargado = true
  } catch (err) {
    console.warn("No se pudo iniciar la descarga automática:", err)
  }

  // 2. Copia al portapapeles (usando PNG ya que la API ClipboardItem tiene soporte universal para image/png)
  let copiado = false
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blobPng,
        }),
      ])
      copiado = true
    } catch (clipErr) {
      console.warn("No se pudo copiar la imagen al portapapeles:", clipErr)
    }
  }

  return { copiado, descargado }
}
