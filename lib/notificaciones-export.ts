import {
  generarBufferExcelFormal,
  descargarExcelEnNavegador,
  type ColumnaExcelConfig,
} from "./excel-export-base"
import type { NotificacionConLeida } from "./schemas"

export const COLUMNAS_EXCEL_NOTIFICACIONES: ColumnaExcelConfig[] = [
  { header: "Fecha y Hora", width: 22, align: "center" },
  { header: "Título", width: 30, align: "left" },
  { header: "Mensaje / Detalle", width: 44, align: "left", wrapText: true },
  { header: "Módulo Origen", width: 18, align: "center" },
  { header: "Tipo Notificación", width: 24, align: "left" },
  { header: "Estado", width: 12, align: "center" },
  { header: "Generado Por", width: 22, align: "left" },
]

export function armarFilasNotificaciones(
  notificaciones: readonly NotificacionConLeida[]
): (string | number)[][] {
  return notificaciones.map((n) => [
    n.creadoEn.toLocaleString("es-MX"),
    n.titulo,
    n.cuerpo,
    n.origenModulo,
    n.tipo,
    n.leida ? "LEÍDA" : "NO LEÍDA",
    n.creadoPorNombre || "Sistema / Automático",
  ])
}

export function generarCSVNotificaciones(
  notificaciones: readonly NotificacionConLeida[]
): string {
  const headers = [
    "Fecha y Hora",
    "Titulo",
    "Mensaje",
    "Modulo Origen",
    "Tipo Notificacion",
    "Estado",
    "Generado Por",
  ]

  const filas = armarFilasNotificaciones(notificaciones)
  const lineas = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
    ...filas.map((fila) =>
      fila
        .map((val) => {
          const s = String(val ?? "")
          return `"${s.replace(/"/g, '""')}"`
        })
        .join(",")
    ),
  ]

  return lineas.join("\r\n")
}

export function descargarCSVNotificaciones(
  notificaciones: readonly NotificacionConLeida[],
  nombreArchivo = "notificaciones_smv.csv"
): void {
  const csv = generarCSVNotificaciones(notificaciones)
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = nombreArchivo.endsWith(".csv") ? nombreArchivo : `${nombreArchivo}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportarExcelNotificaciones(
  notificaciones: readonly NotificacionConLeida[],
  nombreArchivo = "notificaciones_smv.xlsx"
): Promise<void> {
  const filas = armarFilasNotificaciones(notificaciones)
  const buffer = await generarBufferExcelFormal({
    nombreHoja: "Notificaciones",
    titulo: "Registro y Control de Notificaciones",
    subtitulo: "Historial de Alertas Operativas SMV Hub",
    metadatos: `${notificaciones.length} notificaciones`,
    columnas: COLUMNAS_EXCEL_NOTIFICACIONES,
    filas,
    orientacion: "landscape",
  })

  descargarExcelEnNavegador(buffer, nombreArchivo)
}
