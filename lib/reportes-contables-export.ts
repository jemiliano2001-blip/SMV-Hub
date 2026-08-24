import ExcelJS from "exceljs"
import type { Linea } from "@/lib/reportes"

export type FilaExcelContable = {
  Fecha: string
  Factura: string
  Proveedor: string
  "Descripción Simplificada": string
  "Clave SAT": string
  "Descripción Clave SAT": string
  Cantidad: number
  "Precio Unitario": number
  Total: number
  Moneda: string
}

export type AnchoColumnaExcel = { wch: number }

/** Encabezados de la tabla de datos (fila de columnas). */
export const ENCABEZADOS_EXCEL_CONTABLE = [
  "Fecha",
  "Factura",
  "Proveedor",
  "Descripción Simplificada",
  "Clave SAT",
  "Descripción Clave SAT",
  "Cantidad",
  "Precio Unitario",
  "Total",
  "Moneda",
] as const

/** Anchos legibles en landscape para el cierre contable. */
export const ANCHOS_COLUMNAS_EXCEL_CONTABLE: AnchoColumnaExcel[] = [
  { wch: 12 }, // Fecha
  { wch: 16 }, // Factura
  { wch: 22 }, // Proveedor
  { wch: 42 }, // Descripción Simplificada
  { wch: 12 }, // Clave SAT
  { wch: 36 }, // Descripción Clave SAT
  { wch: 10 }, // Cantidad
  { wch: 14 }, // Precio Unitario
  { wch: 12 }, // Total
  { wch: 8 }, // Moneda
]

/** Filas reservadas arriba de la tabla: título, meta, vacío. */
export const FILA_INICIO_TABLA_EXCEL = 4

const COLOR_HEADER_BG = "FF111111"
const COLOR_HEADER_FG = "FFFFFFFF"
const COLOR_ZEBRA = "FFFAFAFA"
const COLOR_TOTAL_BG = "FFF5F5F5"
const COLOR_BORDER = "FFD4D4D8"

function fechaIso(dia: Date | null): string {
  if (!dia) return ""
  const yyyy = dia.getFullYear()
  const mm = String(dia.getMonth() + 1).padStart(2, "0")
  const dd = String(dia.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function armarFilasExcelContable(
  lineas: Linea[],
  satDict: Record<string, string>,
  moneda: string
): FilaExcelContable[] {
  return lineas.map((l) => ({
    Fecha: fechaIso(l.dia),
    Factura: l.referencia || "",
    Proveedor: l.proveedor,
    "Descripción Simplificada": l.descripcionSimplificada || l.descripcion,
    "Clave SAT": l.claveProdServ || "",
    "Descripción Clave SAT": satDict[l.claveProdServ || ""] || "",
    Cantidad: l.cantidad ?? 0,
    "Precio Unitario": l.precioUnitario ?? 0,
    Total: l.total,
    Moneda: moneda,
  }))
}

export function valoresFilaExcelContable(fila: FilaExcelContable): (string | number)[] {
  return ENCABEZADOS_EXCEL_CONTABLE.map((h) => fila[h])
}

/** Nombre de archivo estable para el diálogo "Guardar como". */
export function nombreArchivoExcelContable(opts: {
  tab: "pendientes" | "historial"
  loteId: string | null
  moneda: string
  generadoEn?: Date
}): string {
  const dia = opts.generadoEn ?? new Date()
  const stamp = fechaIso(dia)
  const moneda = opts.moneda.replace(/[^\w]/g, "") || "MXN"
  if (opts.tab === "pendientes") {
    return `Cierre_Contable_Pendientes_${moneda}_${stamp}.xlsx`
  }
  const lote = (opts.loteId || "lote").replace(/[^\w-]+/g, "_")
  return `Cierre_Contable_${lote}_${moneda}_${stamp}.xlsx`
}

export function tituloPdfContable(opts: {
  tab: "pendientes" | "historial"
  loteId: string | null
  moneda: string
  generadoEn?: Date
}): string {
  const dia = opts.generadoEn ?? new Date()
  const stamp = fechaIso(dia)
  const moneda = opts.moneda.replace(/[^\w]/g, "") || "MXN"
  if (opts.tab === "pendientes") {
    return `Cierre_Contable_Pendientes_${moneda}_${stamp}`
  }
  const lote = (opts.loteId || "lote").replace(/[^\w-]+/g, "_")
  return `Cierre_Contable_${lote}_${moneda}_${stamp}`
}

export function subtituloContablePrint(
  tab: "pendientes" | "historial",
  loteId: string | null
): string {
  if (tab === "pendientes") return "Compras pendientes de enviar"
  return loteId ? `Lote ${loteId}` : "Historial de reportes"
}

export type OpcionesWorkbookExcelContable = {
  filas: FilaExcelContable[]
  moneda: string
  subtitulo: string
  generadoEn?: Date
}

function bordeFino(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: "thin", color: { argb: COLOR_BORDER } }
  return { top: side, left: side, bottom: side, right: side }
}

/**
 * Workbook con encabezado de documento + tabla con estilo (filtro, freeze, total).
 */
export async function construirWorkbookExcelContable(
  opts: OpcionesWorkbookExcelContable
): Promise<ExcelJS.Workbook> {
  const generadoEn = opts.generadoEn ?? new Date()
  const generadoLabel = generadoEn.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  const totalGeneral = opts.filas.reduce((s, f) => s + f.Total, 0)
  const colCount = ENCABEZADOS_EXCEL_CONTABLE.length
  const lastCol = colCount
  const headerRowNum = FILA_INICIO_TABLA_EXCEL
  const firstDataRow = headerRowNum + 1
  const lastDataRow = headerRowNum + opts.filas.length
  const totalRowNum = lastDataRow + 1

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "SMV Hub"
  workbook.created = generadoEn

  const sheet = workbook.addWorksheet("Reporte Contable", {
    views: [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })

  sheet.columns = ANCHOS_COLUMNAS_EXCEL_CONTABLE.map((c) => ({ width: c.wch }))

  // ── Encabezado de documento ──────────────────────────────────────────────
  sheet.mergeCells(1, 1, 1, lastCol)
  const titulo = sheet.getCell(1, 1)
  titulo.value = "SMV Maquinados — Cierre contable"
  titulo.font = { bold: true, size: 16, color: { argb: "FF111111" } }
  titulo.alignment = { vertical: "middle", horizontal: "left" }
  sheet.getRow(1).height = 24

  sheet.mergeCells(2, 1, 2, lastCol)
  const meta = sheet.getCell(2, 1)
  meta.value = `${opts.subtitulo}  ·  ${opts.moneda}  ·  ${opts.filas.length} líneas  ·  Generado el ${generadoLabel}`
  meta.font = { size: 10, color: { argb: "FF52525B" } }
  meta.alignment = { vertical: "middle", horizontal: "left" }
  sheet.getRow(2).height = 18

  // Fila 3 en blanco (separador visual)
  sheet.getRow(3).height = 8

  // ── Fila de columnas (estilo tabla) ──────────────────────────────────────
  const headerRow = sheet.getRow(headerRowNum)
  headerRow.height = 20
  ENCABEZADOS_EXCEL_CONTABLE.forEach((nombre, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = nombre
    cell.font = { bold: true, size: 10, color: { argb: COLOR_HEADER_FG } }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_BG },
    }
    cell.alignment = {
      vertical: "middle",
      horizontal: idx >= 6 && idx <= 8 ? "right" : "left",
      wrapText: true,
    }
    cell.border = bordeFino()
  })

  // ── Datos ────────────────────────────────────────────────────────────────
  opts.filas.forEach((fila, i) => {
    const rowNum = firstDataRow + i
    const row = sheet.getRow(rowNum)
    const valores = valoresFilaExcelContable(fila)
    valores.forEach((valor, idx) => {
      const cell = row.getCell(idx + 1)
      cell.value = valor
      cell.font = { size: 9, color: { argb: "FF18181B" } }
      cell.border = bordeFino()
      cell.alignment = {
        vertical: "middle",
        horizontal: idx >= 6 && idx <= 8 ? "right" : "left",
        wrapText: idx === 3 || idx === 5,
      }
      if (i % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR_ZEBRA },
        }
      }
      if (idx === 6) {
        cell.numFmt = "#,##0.###"
      }
      if (idx === 7 || idx === 8) {
        cell.numFmt = '#,##0.00'
      }
    })
  })

  // ── Fila total ───────────────────────────────────────────────────────────
  if (opts.filas.length > 0) {
    const totalRow = sheet.getRow(totalRowNum)
    totalRow.height = 20
    for (let col = 1; col <= lastCol; col++) {
      const cell = totalRow.getCell(col)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL_BG },
      }
      cell.border = bordeFino()
      cell.font = { bold: true, size: 10 }
    }
    sheet.mergeCells(totalRowNum, 1, totalRowNum, 8)
    const label = totalRow.getCell(1)
    label.value = `TOTAL (${opts.moneda})`
    label.alignment = { horizontal: "right", vertical: "middle" }
    const totalCell = totalRow.getCell(9)
    totalCell.value = totalGeneral
    totalCell.numFmt = "#,##0.00"
    totalCell.alignment = { horizontal: "right", vertical: "middle" }
    totalRow.getCell(10).value = opts.moneda
    totalRow.getCell(10).alignment = { horizontal: "left", vertical: "middle" }
  }

  // AutoFilter solo sobre encabezado + datos (sin fila total)
  if (opts.filas.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to: { row: lastDataRow, column: lastCol },
    }
  }

  return workbook
}

/** Genera el .xlsx listo para descargar en el navegador. */
export async function generarBufferExcelContable(
  opts: OpcionesWorkbookExcelContable
): Promise<ArrayBuffer> {
  const workbook = await construirWorkbookExcelContable(opts)
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}
