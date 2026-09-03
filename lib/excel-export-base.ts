import type ExcelJS from "exceljs"

export const COLOR_HEADER_BG = "FF111111"
export const COLOR_HEADER_FG = "FFFFFFFF"
export const COLOR_ZEBRA = "FFFAFAFA"
export const COLOR_TOTAL_BG = "FFF5F5F5"
export const COLOR_BORDER = "FFD4D4D8"
export const COLOR_TEXT = "FF18181B"
export const COLOR_MUTED = "FF52525B"

export type ColumnaExcelConfig = {
  header: string
  width: number
  align?: "left" | "center" | "right"
  numFmt?: string
  wrapText?: boolean
}

export type TotalColumnaConfig = {
  colIndex: number // 1-indexed
  valor: number | string
  numFmt?: string
  align?: "left" | "center" | "right"
}

export type OpcionesTablaExcel = {
  nombreHoja: string
  titulo: string
  subtitulo?: string
  metadatos?: string
  columnas: ColumnaExcelConfig[]
  filas: (string | number | boolean | null | undefined)[][]
  totales?: {
    labelColSpan: number
    label: string
    valores: TotalColumnaConfig[]
  }
  orientacion?: "portrait" | "landscape"
  generadoEn?: Date
}

export function bordeFino(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: "thin", color: { argb: COLOR_BORDER } }
  return { top: side, left: side, bottom: side, right: side }
}

export function fechaIso(dia: Date | string | null | undefined): string {
  if (!dia) return "—"
  if (typeof dia === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(dia)) {
      return dia.slice(0, 10)
    }
    const d = new Date(dia)
    if (isNaN(d.getTime())) return dia
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }
  if (dia instanceof Date && !isNaN(dia.getTime())) {
    const yyyy = dia.getFullYear()
    const mm = String(dia.getMonth() + 1).padStart(2, "0")
    const dd = String(dia.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }
  return "—"
}

/**
 * Construye un Workbook formal de ExcelJS con membrete institucional,
 * encabezados oscuros, bandas cebra, formatos numéricos y totales.
 */
export async function construirWorkbookFormal(
  opts: OpcionesTablaExcel
): Promise<ExcelJS.Workbook> {
  const generadoEn = opts.generadoEn ?? new Date()
  const generadoLabel = generadoEn.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  const ExcelJSModule = await import("exceljs")
  const ExcelJSClass = (
    "default" in ExcelJSModule ? ExcelJSModule.default : ExcelJSModule
  ) as unknown as typeof import("exceljs")
  const workbook = new ExcelJSClass.Workbook()
  workbook.creator = "SMV Hub"
  workbook.created = generadoEn

  const colCount = opts.columnas.length
  const headerRowNum = 4
  const firstDataRow = headerRowNum + 1
  const lastDataRow = headerRowNum + opts.filas.length
  const totalRowNum = lastDataRow + 1

  const sheet = workbook.addWorksheet(opts.nombreHoja.slice(0, 31), {
    views: [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }],
    pageSetup: {
      orientation: opts.orientacion ?? "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })

  sheet.columns = opts.columnas.map((c) => ({ width: c.width }))

  // ── Encabezado de documento (Membrete SMV) ────────────────────────────────
  sheet.mergeCells(1, 1, 1, colCount)
  const cellTitulo = sheet.getCell(1, 1)
  cellTitulo.value = opts.titulo.startsWith("SMV") ? opts.titulo : `SMV Maquinados — ${opts.titulo}`
  cellTitulo.font = { bold: true, size: 15, color: { argb: COLOR_HEADER_BG } }
  cellTitulo.alignment = { vertical: "middle", horizontal: "left" }
  sheet.getRow(1).height = 24

  sheet.mergeCells(2, 1, 2, colCount)
  const cellMeta = sheet.getCell(2, 1)
  const partesMeta = [
    opts.subtitulo,
    opts.metadatos,
    `${opts.filas.length} registros`,
    `Generado el ${generadoLabel}`,
  ].filter(Boolean)
  cellMeta.value = partesMeta.join("  ·  ")
  cellMeta.font = { size: 9.5, color: { argb: COLOR_MUTED } }
  cellMeta.alignment = { vertical: "middle", horizontal: "left" }
  sheet.getRow(2).height = 18

  // Fila 3 en blanco (separador)
  sheet.getRow(3).height = 8

  // ── Encabezados de columnas de la tabla ───────────────────────────────────
  const headerRow = sheet.getRow(headerRowNum)
  headerRow.height = 22
  opts.columnas.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = col.header
    cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_BG },
    }
    cell.alignment = {
      vertical: "middle",
      horizontal: col.align ?? "left",
      wrapText: true,
    }
    cell.border = bordeFino()
  })

  // ── Filas de datos ───────────────────────────────────────────────────────
  opts.filas.forEach((fila, i) => {
    const rowNum = firstDataRow + i
    const row = sheet.getRow(rowNum)
    row.height = 18

    fila.forEach((valor, idx) => {
      const colConfig = opts.columnas[idx]
      const cell = row.getCell(idx + 1)
      cell.value = valor ?? ""
      cell.font = { size: 9, color: { argb: COLOR_TEXT } }
      cell.border = bordeFino()
      cell.alignment = {
        vertical: "middle",
        horizontal: colConfig?.align ?? "left",
        wrapText: colConfig?.wrapText ?? false,
      }

      if (i % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR_ZEBRA },
        }
      }

      if (colConfig?.numFmt && typeof valor === "number") {
        cell.numFmt = colConfig.numFmt
      }
    })
  })

  // ── Fila de totales (si aplica) ──────────────────────────────────────────
  if (opts.totales && opts.filas.length > 0) {
    const totalRow = sheet.getRow(totalRowNum)
    totalRow.height = 22

    for (let col = 1; col <= colCount; col++) {
      const cell = totalRow.getCell(col)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL_BG },
      }
      cell.border = bordeFino()
      cell.font = { bold: true, size: 9.5, color: { argb: COLOR_TEXT } }
    }

    if (opts.totales.labelColSpan > 1) {
      sheet.mergeCells(totalRowNum, 1, totalRowNum, opts.totales.labelColSpan)
    }
    const labelCell = totalRow.getCell(1)
    labelCell.value = opts.totales.label
    labelCell.alignment = { horizontal: "right", vertical: "middle" }

    opts.totales.valores.forEach((tot) => {
      const cell = totalRow.getCell(tot.colIndex)
      cell.value = tot.valor
      if (tot.numFmt && typeof tot.valor === "number") {
        cell.numFmt = tot.numFmt
      }
      cell.alignment = { horizontal: tot.align ?? "right", vertical: "middle" }
    })
  }

  // ── AutoFilter en encabezado y datos ─────────────────────────────────────
  if (opts.filas.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to: { row: lastDataRow, column: colCount },
    }
  }

  return workbook
}

/** Genera el ArrayBuffer del workbook listo para descarga */
export async function generarBufferExcelFormal(
  opts: OpcionesTablaExcel
): Promise<ArrayBuffer> {
  const workbook = await construirWorkbookFormal(opts)
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

/** Dispara la descarga del archivo Excel (.xlsx) en el navegador del usuario */
export function descargarExcelEnNavegador(
  buffer: ArrayBuffer | Uint8Array,
  nombreArchivo: string
): void {
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = nombreArchivo.endsWith(".xlsx") ? nombreArchivo : `${nombreArchivo}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
