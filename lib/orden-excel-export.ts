import type { OrdenCompra } from '@/lib/schemas'
import { cuentaCargoEfectiva, displayOGuion } from '@/lib/ordenes-display'
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

/**
 * Higieniza cadenas para que sean seguras como nombre de archivo en Windows y web.
 */
export function sanitizarNombreArchivo(texto: string): string {
  return texto
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60)
}

/**
 * Retorna el nombre de archivo contextual formal para la orden.
 * Formato: OC_{Proveedor}_{FacturaOId}_{Moneda}.xlsx
 */
export function nombreArchivoOrdenExcel(orden: OrdenCompra): string {
  const proveedor = sanitizarNombreArchivo(orden.proveedor || 'Proveedor')
  const ref = sanitizarNombreArchivo(orden.numeroFactura || orden.id || 'S_N')
  const moneda = (orden.moneda || 'USD').toUpperCase()
  return `OC_${proveedor}_${ref}_${moneda}.xlsx`
}

/**
 * Genera el buffer ArrayBuffer del libro Excel formal (.xlsx) para una orden individual.
 */
export async function generarBufferExcelOrden(
  orden: OrdenCompra,
  opts?: { generadoEn?: Date }
): Promise<ArrayBuffer> {
  const generadoEn = opts?.generadoEn ?? new Date()
  const generadoLabel = generadoEn.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const ExcelJSModule = await import('exceljs')
  const ExcelJSClass = (
    'default' in ExcelJSModule ? ExcelJSModule.default : ExcelJSModule
  ) as unknown as typeof import('exceljs')
  const workbook = new ExcelJSClass.Workbook()
  workbook.creator = 'SMV Hub'
  workbook.created = generadoEn

  const sheetName = sanitizarNombreArchivo(`OC ${orden.numeroFactura || orden.id}`).slice(0, 31)
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: true }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    },
  })

  const moneda = (orden.moneda || 'USD').toUpperCase()
  const numFmtMoneda = '$#,##0.00'

  // ── Columnas de la tabla ───────────────────────────────────────────────────
  const columnasConfig: ColumnaExcelConfig[] = [
    { header: '#', width: 6, align: 'center' },
    { header: 'Descripción', width: 44, align: 'left', wrapText: true },
    { header: 'Clave SAT', width: 14, align: 'center' },
    { header: 'Requisitor', width: 18, align: 'left' },
    { header: 'Cuenta Cargo', width: 18, align: 'left' },
    { header: 'Empresa / Destino', width: 18, align: 'left' },
    { header: 'OT', width: 14, align: 'center' },
    { header: 'Cant.', width: 10, align: 'right', numFmt: '#,##0.###' },
    { header: `P. Unitario (${moneda})`, width: 18, align: 'right', numFmt: numFmtMoneda },
    { header: `Total (${moneda})`, width: 18, align: 'right', numFmt: numFmtMoneda },
  ]
  const colCount = columnasConfig.length
  sheet.columns = columnasConfig.map((c) => ({ width: c.width }))

  // ── 1. Membrete Institucional ──────────────────────────────────────────────
  sheet.mergeCells(1, 1, 1, colCount)
  const cellTitulo = sheet.getCell(1, 1)
  cellTitulo.value = 'SMV MAQUINADOS — ORDEN DE COMPRA'
  cellTitulo.font = { bold: true, size: 15, color: { argb: COLOR_HEADER_BG } }
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 24

  sheet.mergeCells(2, 1, 2, colCount)
  const cellSub = sheet.getCell(2, 1)
  cellSub.value = `OC / Factura: ${orden.numeroFactura || orden.id}  ·  Proveedor: ${orden.proveedor}  ·  Moneda: ${moneda}  ·  Fecha: ${orden.fechaFactura || fechaIso(orden.creadoEn)}  ·  Generado el ${generadoLabel}`
  cellSub.font = { size: 9.5, color: { argb: COLOR_MUTED } }
  cellSub.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(2).height = 18

  sheet.getRow(3).height = 6 // Separador

  // ── 2. Bloque de Datos de la Orden (Filas 4, 5, 6) ───────────────────────────
  const celdaMeta = (r: number, c: number, val: string | number, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
    const cell = sheet.getCell(r, c)
    cell.value = val
    cell.font = { size: 9, bold, color: { argb: COLOR_TEXT } }
    cell.alignment = { vertical: 'middle', horizontal: align }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
    cell.border = bordeFino()
  }
  const celdaEtiqueta = (r: number, c: number, label: string) => {
    const cell = sheet.getCell(r, c)
    cell.value = label
    cell.font = { size: 8.5, bold: true, color: { argb: COLOR_MUTED } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F2' } }
    cell.border = bordeFino()
  }

  // Fila 4
  sheet.getRow(4).height = 19
  celdaEtiqueta(4, 1, 'PROVEEDOR:')
  sheet.mergeCells(4, 2, 4, 3)
  celdaMeta(4, 2, orden.proveedor, true)
  sheet.getCell(4, 3).border = bordeFino()
  celdaEtiqueta(4, 4, 'REQUISITOR:')
  celdaMeta(4, 5, displayOGuion(orden.requisitor))
  celdaEtiqueta(4, 6, 'EMPRESA / DESTINO:')
  sheet.mergeCells(4, 7, 4, 8)
  celdaMeta(4, 7, orden.empresa || orden.destino || 'SMV')
  sheet.getCell(4, 8).border = bordeFino()
  celdaEtiqueta(4, 9, 'MONEDA:')
  celdaMeta(4, 10, moneda, true, 'center')

  // Fila 5
  sheet.getRow(5).height = 19
  celdaEtiqueta(5, 1, 'N° FACTURA / REF:')
  sheet.mergeCells(5, 2, 5, 3)
  celdaMeta(5, 2, orden.numeroFactura || 'S/N', true)
  sheet.getCell(5, 3).border = bordeFino()
  celdaEtiqueta(5, 4, 'CUENTA CARGO:')
  celdaMeta(5, 5, displayOGuion(cuentaCargoEfectiva(orden)))
  celdaEtiqueta(5, 6, 'ORDEN TRABAJO (OT):')
  sheet.mergeCells(5, 7, 5, 8)
  celdaMeta(5, 7, displayOGuion(orden.ordenTrabajo))
  sheet.getCell(5, 8).border = bordeFino()
  celdaEtiqueta(5, 9, 'ESTADO:')
  celdaMeta(5, 10, (orden.estado || 'pendiente').toUpperCase(), true, 'center')

  // Fila 6
  sheet.getRow(6).height = 19
  celdaEtiqueta(6, 1, 'FECHA FACTURA:')
  sheet.mergeCells(6, 2, 6, 3)
  celdaMeta(6, 2, orden.fechaFactura || '—')
  sheet.getCell(6, 3).border = bordeFino()
  celdaEtiqueta(6, 4, 'FECHA ENTREGA:')
  celdaMeta(6, 5, displayOGuion(orden.fechaEntrega))
  celdaEtiqueta(6, 6, 'RECEPCIÓN ALMACÉN:')
  sheet.mergeCells(6, 7, 6, 8)
  const recepcionTxt =
    orden.estadoRecepcion === 'recibida'
      ? `Recibido (${orden.recibidoPor || 'Almacén'})`
      : 'Pendiente'
  celdaMeta(6, 7, recepcionTxt)
  sheet.getCell(6, 8).border = bordeFino()
  celdaEtiqueta(6, 9, 'ID INTERNO:')
  celdaMeta(6, 10, orden.id.slice(0, 12), false, 'center')

  sheet.getRow(7).height = 8 // Separador

  // ── 3. Encabezados de Tabla de Partidas (Fila 8) ────────────────────────────
  const headerRowNum = 8
  const headerRow = sheet.getRow(headerRowNum)
  headerRow.height = 22
  columnasConfig.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = col.header
    cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } }
    cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', wrapText: true }
    cell.border = bordeFino()
  })

  // ── 4. Partidas de la Orden (Filas 9+) ──────────────────────────────────────
  const items =
    orden.items && orden.items.length > 0
      ? orden.items
      : [
          {
            descripcion: `Compra / Partida única — ${orden.proveedor}`,
            cantidad: 1,
            precioUnitario: orden.subtotal ?? orden.total ?? 0,
            total: orden.subtotal ?? orden.total ?? 0,
            claveProdServ: null,
            requisitor: orden.requisitor || '',
            cuentaCargo: cuentaCargoEfectiva(orden) || '',
            empresa: orden.empresa || orden.destino || 'SMV',
            ordenTrabajo: orden.ordenTrabajo || '',
          },
        ]

  const firstDataRow = 9
  let currentRowNum = firstDataRow

  items.forEach((it, i) => {
    const row = sheet.getRow(currentRowNum)
    row.height = 19

    const cantidad = it.cantidad ?? 1
    const pUnitario = it.precioUnitario ?? 0
    const totalItem = it.total ?? (cantidad * pUnitario)

    const valores = [
      i + 1,
      it.descripcion || '—',
      it.claveProdServ || '—',
      it.requisitor || orden.requisitor || '—',
      it.cuentaCargo || cuentaCargoEfectiva(orden) || '—',
      it.empresa || orden.empresa || orden.destino || 'SMV',
      it.ordenTrabajo || orden.ordenTrabajo || '—',
      cantidad,
      pUnitario,
      totalItem,
    ]

    valores.forEach((val, idx) => {
      const col = columnasConfig[idx]
      const cell = row.getCell(idx + 1)
      cell.value = val
      cell.font = { size: 9, color: { argb: COLOR_TEXT } }
      cell.border = bordeFino()
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align ?? 'left',
        wrapText: col.wrapText ?? false,
      }
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } }
      }
      if (col.numFmt && typeof val === 'number') {
        cell.numFmt = col.numFmt
      }
    })

    currentRowNum++
  })

  const lastDataRow = currentRowNum - 1

  // ── AutoFiltro en partidas ─────────────────────────────────────────────────
  sheet.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: lastDataRow, column: colCount },
  }

  // ── 5. Desglose de Totales Financieros ──────────────────────────────────────
  const sumaPartidas = items.reduce((s, it) => s + (it.total ?? ((it.cantidad ?? 1) * (it.precioUnitario ?? 0))), 0)
  const subtotalReal = typeof orden.subtotal === 'number' && Number.isFinite(orden.subtotal) ? orden.subtotal : sumaPartidas
  const envioReal = typeof orden.envio === 'number' && Number.isFinite(orden.envio) ? orden.envio : 0
  const impuestosReal = typeof orden.impuestos === 'number' && Number.isFinite(orden.impuestos) ? orden.impuestos : 0
  const totalGeneral = typeof orden.total === 'number' && Number.isFinite(orden.total) ? orden.total : (subtotalReal + envioReal + impuestosReal)

  const filaTotalSub = (label: string, valor: number, esTotalGeneral = false) => {
    const row = sheet.getRow(currentRowNum)
    row.height = esTotalGeneral ? 22 : 19

    sheet.mergeCells(currentRowNum, 1, currentRowNum, 9)
    for (let c = 1; c <= 9; c++) {
      const cLabel = row.getCell(c)
      cLabel.border = bordeFino()
      if (esTotalGeneral) {
        cLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
      }
    }
    const labelCell = row.getCell(1)
    labelCell.value = label
    labelCell.font = { bold: true, size: esTotalGeneral ? 10 : 9, color: { argb: COLOR_TEXT } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }

    const valCell = row.getCell(10)
    valCell.value = valor
    valCell.font = { bold: true, size: esTotalGeneral ? 11 : 9.5, color: { argb: esTotalGeneral ? COLOR_HEADER_BG : COLOR_TEXT } }
    valCell.alignment = { horizontal: 'right', vertical: 'middle' }
    valCell.border = bordeFino()
    valCell.numFmt = numFmtMoneda
    if (esTotalGeneral) {
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
    }

    currentRowNum++
  }

  filaTotalSub('SUBTOTAL MERCANCÍA:', subtotalReal)

  if (envioReal > 0) {
    filaTotalSub('ENVÍO / FLETE (SHIPPING):', envioReal)
  }

  if (impuestosReal > 0) {
    filaTotalSub(`IMPUESTOS (${moneda === 'USD' ? 'SALES TAX' : 'IVA'}):`, impuestosReal)
  }

  filaTotalSub(`TOTAL ORDEN (${moneda}):`, totalGeneral, true)

  // ── 6. Pie de Página del Documento ─────────────────────────────────────────
  currentRowNum++
  sheet.mergeCells(currentRowNum, 1, currentRowNum, colCount)
  const cellFoot = sheet.getCell(currentRowNum, 1)
  cellFoot.value = `Documento emitido formalmente desde SMV Hub  ·  Sistema de Compras y Taller  ·  ID: ${orden.id}`
  cellFoot.font = { size: 8.5, italic: true, color: { argb: COLOR_MUTED } }
  cellFoot.alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getRow(currentRowNum).height = 16

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

/**
 * Dispara la descarga del Excel de una orden individual en el navegador.
 */
export async function descargarExcelOrden(orden: OrdenCompra): Promise<void> {
  const buffer = await generarBufferExcelOrden(orden)
  const nombre = nombreArchivoOrdenExcel(orden)
  descargarExcelEnNavegador(buffer, nombre)
}

/**
 * Genera el buffer Excel de un lote consolidado de órdenes seleccionadas.
 */
export async function generarBufferExcelLoteOrdenes(
  ordenes: OrdenCompra[],
  opts?: {
    titulo?: string
    subtitulo?: string
    generadoEn?: Date
  }
): Promise<ArrayBuffer> {
  const generadoEn = opts?.generadoEn ?? new Date()
  const ExcelJSModule = await import('exceljs')
  const ExcelJSClass = (
    'default' in ExcelJSModule ? ExcelJSModule.default : ExcelJSModule
  ) as unknown as typeof import('exceljs')
  const workbook = new ExcelJSClass.Workbook()
  workbook.creator = 'SMV Hub'
  workbook.created = generadoEn

  const sheet = workbook.addWorksheet('Órdenes de Compra', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })

  const columnas: ColumnaExcelConfig[] = [
    { header: '#', width: 6, align: 'center' },
    { header: 'Fecha', width: 12, align: 'center' },
    { header: 'N° Factura', width: 16, align: 'left' },
    { header: 'Proveedor', width: 26, align: 'left' },
    { header: 'Descripción Partida', width: 38, align: 'left', wrapText: true },
    { header: 'Clave SAT', width: 13, align: 'center' },
    { header: 'Cant.', width: 10, align: 'right', numFmt: '#,##0.###' },
    { header: 'P. Unitario', width: 14, align: 'right', numFmt: '$#,##0.00' },
    { header: 'Total Partida', width: 15, align: 'right', numFmt: '$#,##0.00' },
    { header: 'Moneda', width: 9, align: 'center' },
    { header: 'Requisitor', width: 16, align: 'left' },
    { header: 'Cuenta Cargo', width: 16, align: 'left' },
    { header: 'Empresa', width: 16, align: 'left' },
    { header: 'OT', width: 14, align: 'center' },
    { header: 'Estado', width: 12, align: 'center' },
    { header: 'Recepción', width: 14, align: 'center' },
  ]
  sheet.columns = columnas.map((c) => ({ width: c.width }))
  const colCount = columnas.length

  // Membrete
  sheet.mergeCells(1, 1, 1, colCount)
  const cellTitulo = sheet.getCell(1, 1)
  cellTitulo.value = opts?.titulo ?? 'SMV MAQUINADOS — CONSOLIDADO DE ÓRDENES DE COMPRA'
  cellTitulo.font = { bold: true, size: 15, color: { argb: COLOR_HEADER_BG } }
  sheet.getRow(1).height = 24

  sheet.mergeCells(2, 1, 2, colCount)
  const cellMeta = sheet.getCell(2, 1)
  cellMeta.value = [
    opts?.subtitulo ?? `${ordenes.length} órdenes seleccionadas`,
    `Generado el ${generadoEn.toLocaleDateString('es-MX')}`,
  ].filter(Boolean).join('  ·  ')
  cellMeta.font = { size: 9.5, color: { argb: COLOR_MUTED } }
  sheet.getRow(2).height = 18

  sheet.getRow(3).height = 6

  // Encabezados
  const rHeader = sheet.getRow(4)
  rHeader.height = 22
  columnas.forEach((col, i) => {
    const cell = rHeader.getCell(i + 1)
    cell.value = col.header
    cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } }
    cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' }
    cell.border = bordeFino()
  })

  let rowNum = 5
  let partidaIndex = 1
  let totalUSD = 0
  let totalMXN = 0

  for (const orden of ordenes) {
    const items =
      orden.items && orden.items.length > 0
        ? orden.items
        : [
            {
              descripcion: `Compra general - ${orden.proveedor}`,
              cantidad: 1,
              precioUnitario: orden.subtotal ?? orden.total ?? 0,
              total: orden.subtotal ?? orden.total ?? 0,
              claveProdServ: null,
              requisitor: orden.requisitor || '',
              cuentaCargo: cuentaCargoEfectiva(orden) || '',
              empresa: orden.empresa || orden.destino || 'SMV',
              ordenTrabajo: orden.ordenTrabajo || '',
            },
          ]

    const moneda = (orden.moneda || 'USD').toUpperCase()

    for (const it of items) {
      const row = sheet.getRow(rowNum)
      row.height = 18
      const cant = it.cantidad ?? 1
      const pUnit = it.precioUnitario ?? 0
      const totalPartida = it.total ?? (cant * pUnit)

      if (moneda === 'USD') totalUSD += totalPartida
      else totalMXN += totalPartida

      const vals = [
        partidaIndex++,
        orden.fechaFactura || fechaIso(orden.creadoEn),
        orden.numeroFactura || 'S/N',
        orden.proveedor,
        it.descripcion || '—',
        it.claveProdServ || '—',
        cant,
        pUnit,
        totalPartida,
        moneda,
        it.requisitor || orden.requisitor || '—',
        it.cuentaCargo || cuentaCargoEfectiva(orden) || '—',
        it.empresa || orden.empresa || orden.destino || 'SMV',
        it.ordenTrabajo || orden.ordenTrabajo || '—',
        (orden.estado || 'pendiente').toUpperCase(),
        orden.estadoRecepcion === 'recibida' ? 'Recibida' : 'Pendiente',
      ]

      vals.forEach((v, idx) => {
        const col = columnas[idx]
        const cell = row.getCell(idx + 1)
        cell.value = v
        cell.font = { size: 9, color: { argb: COLOR_TEXT } }
        cell.border = bordeFino()
        cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', wrapText: col.wrapText ?? false }
        if (rowNum % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } }
        }
        if (col.numFmt && typeof v === 'number') {
          cell.numFmt = col.numFmt
        }
      })

      rowNum++
    }
  }

  const lastRow = rowNum - 1
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: lastRow, column: colCount },
  }

  // Fila de totales por divisa (sin mezclar monedas)
  const filaTotal = (etiqueta: string, monto: number) => {
    const row = sheet.getRow(rowNum)
    row.height = 20
    sheet.mergeCells(rowNum, 1, rowNum, 8)
    for (let c = 1; c <= 8; c++) {
      row.getCell(c).border = bordeFino()
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }
    }
    const lCell = row.getCell(1)
    lCell.value = etiqueta
    lCell.alignment = { horizontal: 'right', vertical: 'middle' }
    lCell.font = { bold: true, size: 9.5, color: { argb: COLOR_TEXT } }

    const vCell = row.getCell(9)
    vCell.value = monto
    vCell.numFmt = '$#,##0.00'
    vCell.font = { bold: true, size: 10, color: { argb: COLOR_HEADER_BG } }
    vCell.alignment = { horizontal: 'right', vertical: 'middle' }
    vCell.border = bordeFino()
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } }

    rowNum++
  }

  if (totalUSD > 0) {
    filaTotal('TOTAL CONSOLIDADO USD:', totalUSD)
  }
  if (totalMXN > 0) {
    filaTotal('TOTAL CONSOLIDADO MXN:', totalMXN)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

/**
 * Dispara la descarga de un lote de órdenes a Excel.
 */
export async function descargarExcelLoteOrdenes(
  ordenes: OrdenCompra[],
  nombreArchivo?: string
): Promise<void> {
  const buffer = await generarBufferExcelLoteOrdenes(ordenes)
  const fechaHoy = new Date().toISOString().slice(0, 10)
  const nombreFinal = nombreArchivo ?? `Ordenes_Compra_Consolidado_${fechaHoy}.xlsx`
  descargarExcelEnNavegador(buffer, nombreFinal)
}
