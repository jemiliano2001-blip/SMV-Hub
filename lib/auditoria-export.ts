import {
  generarBufferExcelFormal,
  descargarExcelEnNavegador,
  type ColumnaExcelConfig,
} from "./excel-export-base"
import type { Timestamp } from "firebase/firestore"

export interface EventoAuditoriaExportable {
  id: string
  emailUsuario?: string
  accion?: string
  coleccion?: string
  idDoc?: string
  resumen?: string
  fechaHora?: Timestamp | Date | string
}

export const COLUMNAS_EXCEL_AUDITORIA: ColumnaExcelConfig[] = [
  { header: "Fecha y Hora", width: 22, align: "center" },
  { header: "Usuario", width: 28, align: "left" },
  { header: "Acción", width: 14, align: "center" },
  { header: "Colección / Sección", width: 22, align: "left" },
  { header: "ID Documento", width: 24, align: "left" },
  { header: "Resumen de Operación", width: 48, align: "left", wrapText: true },
]

export function formatearFechaAuditoria(fechaHora?: Timestamp | Date | string): string {
  if (!fechaHora) return "—"
  if (typeof fechaHora === "object" && "toDate" in fechaHora && typeof fechaHora.toDate === "function") {
    return fechaHora.toDate().toLocaleString("es-MX")
  }
  if (fechaHora instanceof Date) {
    return fechaHora.toLocaleString("es-MX")
  }
  if (typeof fechaHora === "string") {
    const d = new Date(fechaHora)
    return isNaN(d.getTime()) ? fechaHora : d.toLocaleString("es-MX")
  }
  return "—"
}

export function armarFilasAuditoria(eventos: readonly EventoAuditoriaExportable[]): (string | number)[][] {
  return eventos.map((e) => [
    formatearFechaAuditoria(e.fechaHora),
    e.emailUsuario ?? "—",
    e.accion ?? "—",
    e.coleccion ?? "—",
    e.idDoc ?? "—",
    e.resumen ?? "—",
  ])
}

export function generarCSVAuditoria(eventos: readonly EventoAuditoriaExportable[]): string {
  const headers = [
    "Fecha y Hora",
    "Usuario",
    "Accion",
    "Coleccion",
    "ID Documento",
    "Resumen de Operacion",
  ]

  const filas = armarFilasAuditoria(eventos)
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

export function descargarCSVAuditoria(
  eventos: readonly EventoAuditoriaExportable[],
  nombreArchivo = "bitacora_auditoria_smv.csv"
): void {
  const csv = generarCSVAuditoria(eventos)
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

export async function exportarExcelAuditoria(
  eventos: readonly EventoAuditoriaExportable[],
  nombreArchivo = "bitacora_auditoria_smv.xlsx"
): Promise<void> {
  const filas = armarFilasAuditoria(eventos)
  const buffer = await generarBufferExcelFormal({
    nombreHoja: "Auditoría",
    titulo: "Bitácora de Auditoría — Registro de Operaciones",
    subtitulo: "Control y Trazabilidad de Acciones en SMV Hub",
    metadatos: `${eventos.length} eventos registrados`,
    columnas: COLUMNAS_EXCEL_AUDITORIA,
    filas,
    orientacion: "landscape",
  })

  descargarExcelEnNavegador(buffer, nombreArchivo)
}
