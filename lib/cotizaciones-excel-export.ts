import type { Cotizacion } from '@/lib/schemas'
import {
  bordeFino,
  fechaIso,
  descargarExcelEnNavegador,
  COLOR_HEADER_BG,
  COLOR_HEADER_FG,
  COLOR_ZEBRA,
  COLOR_TOTAL_BG,
  COLOR_TEXT,
  COLOR_MUTED,
  type ColumnaExcelConfig,
} from './excel-export-base'
import { sanitizarNombreArchivo } from './orden-excel-export'

export type CriterioAgrupacionCotizaciones =
  | 'proveedor'
  | 'solicitante'
  | 'ubicacion'
  | 'ninguno'

export type EstructuraLibroCotizaciones = 'hojas_separadas' | 'una_hoja'

export interface OpcionesExportarCotizaciones {
  cotizaciones: Cotizacion[]
  criterioAgrupacion?: CriterioAgrupacionCotizaciones
  estructura?: EstructuraLibroCotizaciones
  nombreProyecto?: string
  generadoEn?: Date
}

export type GrupoCotizaciones = {
  nombre: string
  items: Cotizacion[]
  totalUSD: number
  totalMXN: number
}

/**
 * Agrupa una lista de cotizaciones según el criterio elegido y suma totales por divisa.
 */
export function agruparCotizaciones(
  cotizaciones: Cotizacion[],
  criterio: CriterioAgrupacionCotizaciones = 'proveedor'
): GrupoCotizaciones[] {
  if (criterio === 'ninguno') {
    let totalUSD = 0
    let totalMXN = 0
    cotizaciones.forEach((c) => {
      const t = typeof c.total === 'number' && Number.isFinite(c.total)
        ? c.total
        : (c.cantidad ?? 1) * (c.precioUnitario ?? 0)
      if (c.moneda === 'USD') totalUSD += t
      else totalMXN += t
    })

    return [
      {
        nombre: 'Todas las Cotizaciones',
        items: cotizaciones,
        totalUSD: Math.round(totalUSD * 100) / 100,
        totalMXN: Math.round(totalMXN * 100) / 100,
      },
    ]
  }

  const mapa = new Map<string, Cotizacion[]>()

  for (const c of cotizaciones) {
    let clave = 'Sin clasificar'
    if (criterio === 'proveedor') {
      clave = c.proveedor?.trim() || 'Proveedor no especificado'
    } else if (criterio === 'solicitante') {
      clave = c.solicitante?.trim() || 'Sin Solicitante'
    } else if (criterio === 'ubicacion') {
      clave = c.ubicacion === 'USA' ? 'EUA (USD)' : 'México (MXN)'
    }

    const grupo = mapa.get(clave) || []
    grupo.push(c)
    mapa.set(clave, grupo)
  }

  const grupos: GrupoCotizaciones[] = []
  for (const [nombre, items] of mapa.entries()) {
    let totalUSD = 0
    let totalMXN = 0
    items.forEach((c) => {
      const t = typeof c.total === 'number' && Number.isFinite(c.total)
        ? c.total
        : (c.cantidad ?? 1) * (c.precioUnitario ?? 0)
      if (c.moneda === 'USD') totalUSD += t
      else totalMXN += t
    })

    grupos.push({
      nombre,
      items,
      totalUSD: Math.round(totalUSD * 100) / 100,
      totalMXN: Math.round(totalMXN * 100) / 100,
    })
  }

  // Ordenar grupos alfabéticamente
  grupos.sort((a, b) => a.nombre.localeCompare(b.nombre))
  return grupos
}

const COLUMNAS_COTIZACION: ColumnaExcelConfig[] = [
  { header: '#', width: 6, align: 'center' },
  { header: 'Fecha', width: 12, align: 'center' },
  { header: 'No. Parte', width: 18, align: 'left' },
  { header: 'Descripción de Pieza / Insumo', width: 42, align: 'left', wrapText: true },
  { header: 'Proveedor', width: 24, align: 'left' },
  { header: 'Solicitante', width: 18, align: 'left' },
  { header: 'Tiempo Entrega', width: 16, align: 'center' },
  { header: 'Cant.', width: 10, align: 'right', numFmt: '#,##0.###' },
  { header: 'P. Unitario', width: 15, align: 'right', numFmt: '$#,##0.00' },
  { header: 'Total', width: 16, align: 'right', numFmt: '$#,##0.00' },
  { header: 'Moneda', width: 9, align: 'center' },
  { header: 'Estatus', width: 12, align: 'center' },
  { header: 'Enlace / Link', width: 30, align: 'left' },
  { header: 'Notas', width: 25, align: 'left', wrapText: true },
]

/**
 * Genera el buffer ArrayBuffer del libro formal Excel para cotizaciones con agrupación.
 */
export async function generarBufferExcelCotizaciones(
  opts: OpcionesExportarCotizaciones
): Promise<ArrayBuffer> {
  const generadoEn = opts.generadoEn ?? new Date()
  const generadoLabel = generadoEn.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const criterio = opts.criterioAgrupacion ?? 'proveedor'
  const estructura = opts.estructura ?? (opts.cotizaciones.length > 25 ? 'hojas_separadas' : 'una_hoja')
  const nombreProyecto = opts.nombreProyecto?.trim() || 'Cotización de Piezas e Insumos'

  const grupos = agruparCotizaciones(opts.cotizaciones, criterio)

  const ExcelJSModule = await import('exceljs')
  const ExcelJSClass = (
    'default' in ExcelJSModule ? ExcelJSModule.default : ExcelJSModule
  ) as unknown as typeof import('exceljs')
  const workbook = new ExcelJSClass.Workbook()
  workbook.creator = 'SMV Hub'
  workbook.created = generadoEn

  const colCount = COLUMNAS_COTIZACION.length

  if (estructura === 'hojas_separadas') {
    // ── 1. Hoja Resumen Ejecutivo si hay más de 1 grupo ───────────────────────
    if (grupos.length > 1) {
      const sheetResumen = workbook.addWorksheet('Resumen de Grupos', {
        views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      })

      const colsResumen = [
        { header: '#', width: 6, align: 'center' as const },
        { header: `Grupo (${criterio})`, width: 36, align: 'left' as const },
        { header: 'Partidas', width: 12, align: 'right' as const, numFmt: '#,##0' },
        { header: 'Total (USD)', width: 18, align: 'right' as const, numFmt: '$#,##0.00' },
        { header: 'Total (MXN)', width: 18, align: 'right' as const, numFmt: '$#,##0.00' },
      ]
      sheetResumen.columns = colsResumen.map((c) => ({ width: c.width }))

      // Membrete resumen
      sheetResumen.mergeCells(1, 1, 1, colsResumen.length)
      const titRes = sheetResumen.getCell(1, 1)
      titRes.value = `SMV MAQUINADOS — RESUMEN DE COTIZACIONES: ${nombreProyecto.toUpperCase()}`
      titRes.font = { bold: true, size: 14, color: { argb: COLOR_HEADER_BG } }
      sheetResumen.getRow(1).height = 24

      sheetResumen.mergeCells(2, 1, 2, colsResumen.length)
      const subRes = sheetResumen.getCell(2, 1)
      subRes.value = `${grupos.length} grupos  ·  ${opts.cotizaciones.length} partidas en total  ·  Generado el ${generadoLabel}`
      subRes.font = { size: 9.5, color: { argb: COLOR_MUTED } }
      sheetResumen.getRow(2).height = 18

      sheetResumen.getRow(3).height = 6

      // Header row
      const hRow = sheetResumen.getRow(4)
      hRow.height = 22
      colsResumen.forEach((col, i) => {
        const cell = hRow.getCell(i + 1)
        cell.value = col.header
        cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } }
        cell.border = bordeFino()
        cell.alignment = { vertical: 'middle', horizontal: col.align }
      })

      let rIdx = 5
      let sumUSD = 0
      let sumMXN = 0
      grupos.forEach((g, idx) => {
        sumUSD += g.totalUSD
        sumMXN += g.totalMXN
        const row = sheetResumen.getRow(rIdx)
        row.height = 20
        const vals = [idx + 1, g.nombre, g.items.length, g.totalUSD, g.totalMXN]
        vals.forEach((v, cIdx) => {
          const col = colsResumen[cIdx]
          const cell = row.getCell(cIdx + 1)
          cell.value = v
          cell.font = { size: 9.5, color: { argb: COLOR_TEXT } }
          cell.border = bordeFino()
          cell.alignment = { vertical: 'middle', horizontal: col.align }
          if (rIdx % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } }
          }
          if (col.numFmt && typeof v === 'number') cell.numFmt = col.numFmt
        })
        rIdx++
      })

      // Total general resumen
      const totRow = sheetResumen.getRow(rIdx)
      totRow.height = 22
      sheetResumen.mergeCells(rIdx, 1, rIdx, 2)
      for (let c = 1; c <= 2; c++) {
        totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
        totRow.getCell(c).border = bordeFino()
      }
      const lCell = totRow.getCell(1)
      lCell.value = 'TOTAL CONSOLIDADO GENERAL'
      lCell.font = { bold: true, size: 10, color: { argb: COLOR_HEADER_BG } }
      lCell.alignment = { horizontal: 'right', vertical: 'middle' }

      totRow.getCell(3).value = opts.cotizaciones.length
      totRow.getCell(3).font = { bold: true, size: 10 }
      totRow.getCell(3).numFmt = '#,##0'
      totRow.getCell(3).border = bordeFino()
      totRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }

      totRow.getCell(4).value = sumUSD
      totRow.getCell(4).font = { bold: true, size: 10 }
      totRow.getCell(4).numFmt = '$#,##0.00'
      totRow.getCell(4).border = bordeFino()
      totRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }

      totRow.getCell(5).value = sumMXN
      totRow.getCell(5).font = { bold: true, size: 10 }
      totRow.getCell(5).numFmt = '$#,##0.00'
      totRow.getCell(5).border = bordeFino()
      totRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
    }

    // ── Hojas individuales para cada grupo ────────────────────────────────────
    const nombresUsados = new Set<string>()
    for (const g of grupos) {
      const baseName = sanitizarNombreArchivo(g.nombre).slice(0, 26) || 'Grupo'
      let finalName = baseName
      let suffix = 1
      while (nombresUsados.has(finalName.toLowerCase())) {
        finalName = `${baseName.slice(0, 24)}_${suffix++}`
      }
      nombresUsados.add(finalName.toLowerCase())

      const sheet = workbook.addWorksheet(finalName, {
        views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      })
      sheet.columns = COLUMNAS_COTIZACION.map((c) => ({ width: c.width }))

      // Membrete de grupo
      sheet.mergeCells(1, 1, 1, colCount)
      const cTit = sheet.getCell(1, 1)
      cTit.value = `SMV MAQUINADOS — COTIZACIÓN: ${g.nombre.toUpperCase()}`
      cTit.font = { bold: true, size: 14, color: { argb: COLOR_HEADER_BG } }
      sheet.getRow(1).height = 24

      sheet.mergeCells(2, 1, 2, colCount)
      const cMeta = sheet.getCell(2, 1)
      const metaPartes = [
        `Proyecto: ${nombreProyecto}`,
        `Criterio: ${criterio}`,
        `${g.items.length} partidas`,
        g.totalUSD > 0 ? `Subtotal USD: $${g.totalUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null,
        g.totalMXN > 0 ? `Subtotal MXN: $${g.totalMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null,
        `Generado el ${generadoLabel}`,
      ].filter(Boolean)
      cMeta.value = metaPartes.join('  ·  ')
      cMeta.font = { size: 9.5, color: { argb: COLOR_MUTED } }
      sheet.getRow(2).height = 18

      sheet.getRow(3).height = 6

      // Encabezados
      const rHeader = sheet.getRow(4)
      rHeader.height = 22
      COLUMNAS_COTIZACION.forEach((col, idx) => {
        const cell = rHeader.getCell(idx + 1)
        cell.value = col.header
        cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } }
        cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' }
        cell.border = bordeFino()
      })

      // Filas de cotización
      let curRow = 5
      g.items.forEach((item, itemIdx) => {
        const row = sheet.getRow(curRow)
        row.height = 19
        const cant = item.cantidad ?? 1
        const pUnit = item.precioUnitario ?? 0
        const total = typeof item.total === 'number' && Number.isFinite(item.total) ? item.total : cant * pUnit

        const vals = [
          itemIdx + 1,
          fechaIso(item.fecha),
          item.numeroParte || '—',
          item.descripcion,
          item.proveedor,
          item.solicitante || '—',
          item.diasHabiles || '—',
          cant,
          pUnit,
          total,
          item.moneda,
          (item.estatus || 'cotizado').toUpperCase(),
          item.link || '—',
          item.notas || '—',
        ]

        vals.forEach((v, idx) => {
          const col = COLUMNAS_COTIZACION[idx]
          const cell = row.getCell(idx + 1)
          cell.value = v
          cell.font = { size: 9, color: { argb: COLOR_TEXT } }
          cell.border = bordeFino()
          cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', wrapText: col.wrapText ?? false }
          if (curRow % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } }
          }
          if (col.numFmt && typeof v === 'number') cell.numFmt = col.numFmt
        })
        curRow++
      })

      const lastRow = curRow - 1
      sheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: lastRow, column: colCount },
      }

      // Totales del grupo (por divisa sin mezclar)
      const agregarFilaTotal = (etiqueta: string, monto: number) => {
        const row = sheet.getRow(curRow)
        row.height = 20
        sheet.mergeCells(curRow, 1, curRow, 9)
        for (let c = 1; c <= 9; c++) {
          row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
          row.getCell(c).border = bordeFino()
        }
        const lCell = row.getCell(1)
        lCell.value = etiqueta
        lCell.font = { bold: true, size: 9.5, color: { argb: COLOR_TEXT } }
        lCell.alignment = { horizontal: 'right', vertical: 'middle' }

        const vCell = row.getCell(10)
        vCell.value = monto
        vCell.font = { bold: true, size: 10, color: { argb: COLOR_HEADER_BG } }
        vCell.numFmt = '$#,##0.00'
        vCell.alignment = { horizontal: 'right', vertical: 'middle' }
        vCell.border = bordeFino()
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }

        curRow++
      }

      if (g.totalUSD > 0) agregarFilaTotal(`SUBTOTAL GRUPO (${g.nombre}) USD:`, g.totalUSD)
      if (g.totalMXN > 0) agregarFilaTotal(`SUBTOTAL GRUPO (${g.nombre}) MXN:`, g.totalMXN)
    }
  } else {
    // ── Estructura 'una_hoja': Todo en una sola hoja con bloques de grupos ────
    const sheet = workbook.addWorksheet('Cotizaciones Agrupadas', {
      views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })
    sheet.columns = COLUMNAS_COTIZACION.map((c) => ({ width: c.width }))

    // Membrete principal
    sheet.mergeCells(1, 1, 1, colCount)
    const cTit = sheet.getCell(1, 1)
    cTit.value = `SMV MAQUINADOS — COTIZACIÓN: ${nombreProyecto.toUpperCase()}`
    cTit.font = { bold: true, size: 15, color: { argb: COLOR_HEADER_BG } }
    sheet.getRow(1).height = 24

    sheet.mergeCells(2, 1, 2, colCount)
    const cMeta = sheet.getCell(2, 1)
    cMeta.value = [
      `Agrupación: ${criterio.toUpperCase()}`,
      `${grupos.length} grupos`,
      `${opts.cotizaciones.length} partidas en total`,
      `Generado el ${generadoLabel}`,
    ].join('  ·  ')
    cMeta.font = { size: 9.5, color: { argb: COLOR_MUTED } }
    sheet.getRow(2).height = 18

    sheet.getRow(3).height = 6

    // Fila 4: Header maestro
    const rHeader = sheet.getRow(4)
    rHeader.height = 22
    COLUMNAS_COTIZACION.forEach((col, idx) => {
      const cell = rHeader.getCell(idx + 1)
      cell.value = col.header
      cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } }
      cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' }
      cell.border = bordeFino()
    })

    let curRow = 5
    let totalGeneralUSD = 0
    let totalGeneralMXN = 0

    grupos.forEach((g) => {
      totalGeneralUSD += g.totalUSD
      totalGeneralMXN += g.totalMXN

      // Banner separador de grupo
      const bRow = sheet.getRow(curRow)
      bRow.height = 24
      sheet.mergeCells(curRow, 1, curRow, colCount)
      for (let c = 1; c <= colCount; c++) {
        bRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E4E7' } }
        bRow.getCell(c).border = bordeFino()
      }
      const bCell = bRow.getCell(1)
      const totalesGrupoTxt = [
        g.totalUSD > 0 ? `USD $${g.totalUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null,
        g.totalMXN > 0 ? `MXN $${g.totalMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null,
      ].filter(Boolean).join('  ·  ')
      bCell.value = `GRUPO: ${g.nombre.toUpperCase()}  (${g.items.length} partidas)  —  ${totalesGrupoTxt}`
      bCell.font = { bold: true, size: 10.5, color: { argb: COLOR_HEADER_BG } }
      bCell.alignment = { horizontal: 'left', vertical: 'middle' }
      curRow++

      // Partidas del grupo
      g.items.forEach((item, itemIdx) => {
        const row = sheet.getRow(curRow)
        row.height = 19
        const cant = item.cantidad ?? 1
        const pUnit = item.precioUnitario ?? 0
        const total = typeof item.total === 'number' && Number.isFinite(item.total) ? item.total : cant * pUnit

        const vals = [
          itemIdx + 1,
          fechaIso(item.fecha),
          item.numeroParte || '—',
          item.descripcion,
          item.proveedor,
          item.solicitante || '—',
          item.diasHabiles || '—',
          cant,
          pUnit,
          total,
          item.moneda,
          (item.estatus || 'cotizado').toUpperCase(),
          item.link || '—',
          item.notas || '—',
        ]

        vals.forEach((v, idx) => {
          const col = COLUMNAS_COTIZACION[idx]
          const cell = row.getCell(idx + 1)
          cell.value = v
          cell.font = { size: 9, color: { argb: COLOR_TEXT } }
          cell.border = bordeFino()
          cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', wrapText: col.wrapText ?? false }
          if (curRow % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } }
          }
          if (col.numFmt && typeof v === 'number') cell.numFmt = col.numFmt
        })
        curRow++
      })

      // Subtotal del grupo
      const sRow = sheet.getRow(curRow)
      sRow.height = 20
      sheet.mergeCells(curRow, 1, curRow, 9)
      for (let c = 1; c <= 9; c++) {
        sRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
        sRow.getCell(c).border = bordeFino()
      }
      const slCell = sRow.getCell(1)
      slCell.value = `SUBTOTAL GRUPO (${g.nombre}):`
      slCell.font = { bold: true, size: 9.5, color: { argb: COLOR_TEXT } }
      slCell.alignment = { horizontal: 'right', vertical: 'middle' }

      const svCell = sRow.getCell(10)
      svCell.value = g.totalUSD > 0 && g.totalMXN > 0 ? `USD $${g.totalUSD.toFixed(2)} · MXN $${g.totalMXN.toFixed(2)}` : (g.totalUSD > 0 ? g.totalUSD : g.totalMXN)
      svCell.font = { bold: true, size: 10, color: { argb: COLOR_HEADER_BG } }
      if (typeof svCell.value === 'number') svCell.numFmt = '$#,##0.00'
      svCell.alignment = { horizontal: 'right', vertical: 'middle' }
      svCell.border = bordeFino()
      svCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
      curRow++

      // Espacio entre grupos
      sheet.getRow(curRow).height = 8
      curRow++
    })

    // Totales finales consolidados
    const tRow = sheet.getRow(curRow)
    tRow.height = 22
    sheet.mergeCells(curRow, 1, curRow, 9)
    for (let c = 1; c <= 9; c++) {
      tRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4D4D8' } }
      tRow.getCell(c).border = bordeFino()
    }
    const tlCell = tRow.getCell(1)
    tlCell.value = 'GRAN TOTAL COTIZACIÓN CONSOLIDADO'
    tlCell.font = { bold: true, size: 10.5, color: { argb: COLOR_HEADER_BG } }
    tlCell.alignment = { horizontal: 'right', vertical: 'middle' }

    const tvCell = tRow.getCell(10)
    tvCell.value = totalGeneralUSD > 0 && totalGeneralMXN > 0
      ? `USD $${totalGeneralUSD.toFixed(2)} · MXN $${totalGeneralMXN.toFixed(2)}`
      : (totalGeneralUSD > 0 ? totalGeneralUSD : totalGeneralMXN)
    tvCell.font = { bold: true, size: 11, color: { argb: COLOR_HEADER_BG } }
    if (typeof tvCell.value === 'number') tvCell.numFmt = '$#,##0.00'
    tvCell.alignment = { horizontal: 'right', vertical: 'middle' }
    tvCell.border = bordeFino()
    tvCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4D4D8' } }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

/**
 * Descarga el archivo Excel de cotizaciones en el navegador.
 */
export async function descargarExcelCotizaciones(
  opts: OpcionesExportarCotizaciones
): Promise<void> {
  const buffer = await generarBufferExcelCotizaciones(opts)
  const fechaHoy = new Date().toISOString().slice(0, 10)
  const sufijoCrit = opts.criterioAgrupacion && opts.criterioAgrupacion !== 'ninguno'
    ? `_Por_${opts.criterioAgrupacion}`
    : ''
  const baseNombre = opts.nombreProyecto
    ? sanitizarNombreArchivo(opts.nombreProyecto)
    : 'Cotizaciones_SMV'
  const nombreFinal = `${baseNombre}${sufijoCrit}_${fechaHoy}.xlsx`
  descargarExcelEnNavegador(buffer, nombreFinal)
}

/**
 * Genera y descarga un Excel formal para una sola cotización individual.
 */
export async function descargarExcelCotizacionIndividual(
  cotizacion: Cotizacion
): Promise<void> {
  const buffer = await generarBufferExcelCotizaciones({
    cotizaciones: [cotizacion],
    criterioAgrupacion: 'ninguno',
    estructura: 'una_hoja',
    nombreProyecto: `Cotización ${cotizacion.proveedor} - ${cotizacion.numeroParte || cotizacion.id.slice(0, 8)}`,
  })
  const proveedor = sanitizarNombreArchivo(cotizacion.proveedor || 'Proveedor')
  const pieza = sanitizarNombreArchivo(cotizacion.numeroParte || cotizacion.descripcion || 'Pieza').slice(0, 20)
  const nombre = `Cotizacion_${proveedor}_${pieza}_${cotizacion.moneda}.xlsx`
  descargarExcelEnNavegador(buffer, nombre)
}
