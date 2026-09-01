import type { RegistroCotizacionOdoo } from "@/lib/schemas"
import {
  construirWorkbookFormal,
  descargarExcelEnNavegador,
  fechaIso,
  bordeFino,
  COLOR_HEADER_BG,
  COLOR_HEADER_FG,
  COLOR_TEXT,
  COLOR_ZEBRA,
  type ColumnaExcelConfig,
  type OpcionesTablaExcel,
} from "@/lib/excel-export-base"

export type TotalesPorMonedaOdoo = {
  mxn: number
  usd: number
}

function redondearCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function acumularPorMoneda(
  totales: TotalesPorMonedaOdoo,
  moneda: string,
  monto: number
): void {
  if (!Number.isFinite(monto) || monto === 0) return
  if (moneda === "USD") totales.usd = redondearCentavos(totales.usd + monto)
  else if (moneda === "MXN") totales.mxn = redondearCentavos(totales.mxn + monto)
}

/** Suma totales de cotizaciones Odoo por moneda. Nunca mezcla MXN y USD. */
export function sumarTotalesPorMoneda(
  registros: Array<{ moneda: string; total?: number | null }>
): TotalesPorMonedaOdoo {
  const totales: TotalesPorMonedaOdoo = { mxn: 0, usd: 0 }
  for (const registro of registros) {
    const monto = typeof registro.total === "number" ? registro.total : 0
    acumularPorMoneda(totales, registro.moneda, monto)
  }
  return totales
}

/** Suma subtotales de partidas agrupados por la moneda del documento padre. */
export function sumarSubtotalesPartidasPorMoneda(
  registros: Array<{
    moneda: string
    partidas?: Array<{
      subtotal?: number | null
      cantidad?: number | null
      precioUnitario?: number | null
    }> | null
  }>
): TotalesPorMonedaOdoo {
  const totales: TotalesPorMonedaOdoo = { mxn: 0, usd: 0 }
  for (const registro of registros) {
    if (!registro.partidas?.length) continue
    let subtotalDoc = 0
    for (const partida of registro.partidas) {
      const linea =
        typeof partida.subtotal === "number" && Number.isFinite(partida.subtotal)
          ? partida.subtotal
          : (partida.cantidad || 0) * (partida.precioUnitario || 0)
      subtotalDoc += linea
    }
    acumularPorMoneda(totales, registro.moneda, subtotalDoc)
  }
  return totales
}

/**
 * Valor para la celda de total de Excel: número si hay una sola moneda,
 * texto con desglose si hay MXN y USD. Nunca devuelve MXN+USD.
 */
export function valorExcelSinMezclarMonedas(
  totales: TotalesPorMonedaOdoo
): number | string {
  const hayMxn = totales.mxn !== 0
  const hayUsd = totales.usd !== 0
  if (hayMxn && hayUsd) {
    return `MXN ${totales.mxn.toFixed(2)} · USD ${totales.usd.toFixed(2)}`
  }
  if (hayUsd) return totales.usd
  return totales.mxn
}

export function etiquetaTotalesHistorialOdoo(totales: TotalesPorMonedaOdoo): string {
  const hayMxn = totales.mxn !== 0
  const hayUsd = totales.usd !== 0
  if (hayMxn && hayUsd) return "TOTALES POR MONEDA (no mezclar MXN+USD):"
  if (hayUsd) return "TOTAL GENERAL (USD):"
  if (hayMxn) return "TOTAL GENERAL (MXN):"
  return "TOTALES GENERALES:"
}

/**
 * Genera y descarga un archivo Excel profesional (.xlsx) con el historial de cotizaciones Odoo
 * y el desglose de partidas detallado.
 */
export async function exportarHistorialOdooExcel(
  registros: RegistroCotizacionOdoo[],
  filtros?: { moneda?: string; periodo?: string }
): Promise<void> {
  if (!registros.length) return

  const columnasResumen: ColumnaExcelConfig[] = [
    { header: "Folio Odoo", width: 14, align: "center" },
    { header: "Proveedor", width: 30, align: "left" },
    { header: "Ref. Proveedor", width: 18, align: "left" },
    { header: "Fecha", width: 13, align: "center" },
    { header: "Fecha Recep.", width: 13, align: "center" },
    { header: "Moneda", width: 10, align: "center" },
    { header: "Partidas", width: 10, align: "right", numFmt: "#,##0" },
    { header: "Subtotal", width: 16, align: "right", numFmt: "$#,##0.00" },
    { header: "IVA", width: 14, align: "right", numFmt: "$#,##0.00" },
    { header: "Total", width: 16, align: "right", numFmt: "$#,##0.00" },
    { header: "Creado Por", width: 24, align: "left" },
    { header: "Notas", width: 35, align: "left" },
  ]

  const totalesPorMoneda = sumarTotalesPorMoneda(registros)
  const totalPartidas = registros.reduce((acc, r) => acc + (r.itemsCount || r.partidas?.length || 0), 0)
  const valorTotalResumen = valorExcelSinMezclarMonedas(totalesPorMoneda)

  const filasResumen = registros.map((r) => [
    r.odooName,
    r.proveedor,
    r.referenciaProveedor || "—",
    fechaIso(r.fecha || (r.creadoEn ? new Date(r.creadoEn) : null)),
    fechaIso(r.fechaRecepcion),
    r.moneda,
    r.itemsCount || r.partidas?.length || 0,
    r.totalUntaxed || 0,
    r.totalTax || 0,
    r.total || 0,
    r.creadoPorNombre ? `${r.creadoPorNombre} (${r.creadoPorEmail})` : r.creadoPorEmail || "—",
    r.notas || "—",
  ])

  const metaFiltros = [
    filtros?.moneda ? `Moneda: ${filtros.moneda}` : null,
    filtros?.periodo ? `Período: ${filtros.periodo}` : null,
    `Total MXN: $${totalesPorMoneda.mxn.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
    `Total USD: $${totalesPorMoneda.usd.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
  ].filter(Boolean).join("  ·  ")

  const opcionesResumen: OpcionesTablaExcel = {
    nombreHoja: "Cotizaciones Odoo",
    titulo: "SMV Hub — Historial de Cotizaciones Odoo",
    subtitulo: "Registro de solicitudes de compra (RFQs) enviadas a Odoo ERP",
    metadatos: metaFiltros,
    columnas: columnasResumen,
    filas: filasResumen,
    orientacion: "landscape",
    totales: {
      labelColSpan: 6,
      label: etiquetaTotalesHistorialOdoo(totalesPorMoneda),
      valores: [
        { colIndex: 7, valor: totalPartidas, numFmt: "#,##0", align: "right" },
        {
          colIndex: 10,
          valor: valorTotalResumen,
          numFmt: typeof valorTotalResumen === "number" ? "$#,##0.00" : undefined,
          align: "right",
        },
      ],
    },
  }

  const workbook = await construirWorkbookFormal(opcionesResumen)

  // ── Hoja 2: Partidas Detalladas ──────────────────────────────────────────
  const partidasSheet = workbook.addWorksheet("Partidas Detalladas", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const columnasPartidas: ColumnaExcelConfig[] = [
    { header: "Folio Odoo", width: 14, align: "center" },
    { header: "Proveedor", width: 24, align: "left" },
    { header: "#", width: 6, align: "center" },
    { header: "Clave / SKU", width: 16, align: "left" },
    { header: "Descripción", width: 35, align: "left" },
    { header: "Requisitor", width: 14, align: "left" },
    { header: "Empresa", width: 14, align: "left" },
    { header: "OT / Uso", width: 16, align: "left" },
    { header: "Cant.", width: 10, align: "right", numFmt: "#,##0.00" },
    { header: "UdM", width: 10, align: "center" },
    { header: "P. Unitario", width: 14, align: "right", numFmt: "$#,##0.00" },
    { header: "IVA", width: 12, align: "center" },
    { header: "Subtotal", width: 16, align: "right", numFmt: "$#,##0.00" },
  ]

  partidasSheet.columns = columnasPartidas.map((c) => ({ width: c.width }))

  // Membrete Hoja 2
  partidasSheet.mergeCells(1, 1, 1, columnasPartidas.length)
  const cellTitPartidas = partidasSheet.getCell(1, 1)
  cellTitPartidas.value = "SMV Maquinados — Desglose de Partidas de Cotización"
  cellTitPartidas.font = { bold: true, size: 14, color: { argb: COLOR_HEADER_BG } }
  cellTitPartidas.alignment = { vertical: "middle", horizontal: "left" }
  partidasSheet.getRow(1).height = 22

  partidasSheet.mergeCells(2, 1, 2, columnasPartidas.length)
  const cellMetaPartidas = partidasSheet.getCell(2, 1)
  cellMetaPartidas.value = `Detalle de ítems cotizados  ·  Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`
  cellMetaPartidas.font = { size: 9.5, color: { argb: "FF52525B" } }
  cellMetaPartidas.alignment = { vertical: "middle", horizontal: "left" }
  partidasSheet.getRow(2).height = 18

  partidasSheet.getRow(3).height = 8

  // Encabezados Hoja 2
  const headerRowPartidas = partidasSheet.getRow(4)
  headerRowPartidas.height = 22
  columnasPartidas.forEach((col, idx) => {
    const cell = headerRowPartidas.getCell(idx + 1)
    cell.value = col.header
    cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } }
    cell.alignment = { vertical: "middle", horizontal: col.align ?? "left" }
    cell.border = bordeFino()
  })

  // Filas Hoja 2
  let rowIdx = 5

  for (const r of registros) {
    if (!r.partidas || !r.partidas.length) continue
    for (let pIdx = 0; pIdx < r.partidas.length; pIdx++) {
      const p = r.partidas[pIdx]
      const row = partidasSheet.getRow(rowIdx)
      row.height = 18

      const subtotal = p.subtotal || (p.cantidad || 0) * (p.precioUnitario || 0)

      const vals = [
        r.odooName,
        r.proveedor,
        p.partida || pIdx + 1,
        p.clave || "—",
        p.descripcion,
        p.requisitor || "—",
        p.empresa || "—",
        p.ordenTrabajo || p.uso || "—",
        p.cantidad,
        p.udm || "Pieza",
        p.precioUnitario || 0,
        p.impuesto || (p.tasaIva != null ? `${Math.round(p.tasaIva * 100)}%` : "—"),
        subtotal,
      ]

      vals.forEach((valor, cIdx) => {
        const cell = row.getCell(cIdx + 1)
        cell.value = valor ?? ""
        cell.font = { size: 9, color: { argb: COLOR_TEXT } }
        cell.border = bordeFino()

        const colConfig = columnasPartidas[cIdx]
        if (colConfig.align) {
          cell.alignment = { vertical: "middle", horizontal: colConfig.align }
        }
        if (colConfig.numFmt && typeof valor === "number") {
          cell.numFmt = colConfig.numFmt
        }
      })

      if (rowIdx % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ZEBRA } }
      }
      rowIdx++
    }
  }

  // Fila Total Hoja 2 — desglose por moneda; nunca MXN+USD
  if (rowIdx > 5) {
    const subtotalesPartidas = sumarSubtotalesPartidasPorMoneda(registros)
    const valorPartidas = valorExcelSinMezclarMonedas(subtotalesPartidas)
    const totalPartidasRow = partidasSheet.getRow(rowIdx)
    totalPartidasRow.height = 22
    totalPartidasRow.font = { bold: true, size: 9.5 }
    totalPartidasRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } }

    partidasSheet.mergeCells(rowIdx, 1, rowIdx, 12)
    const labelPartidasTotal = totalPartidasRow.getCell(1)
    labelPartidasTotal.value = etiquetaTotalesHistorialOdoo(subtotalesPartidas)
    labelPartidasTotal.alignment = { horizontal: "right", vertical: "middle" }

    const cellSum = totalPartidasRow.getCell(13)
    cellSum.value = valorPartidas
    if (typeof valorPartidas === "number") {
      cellSum.numFmt = "$#,##0.00"
    }
    cellSum.alignment = { horizontal: "right", vertical: "middle" }

    for (let c = 1; c <= columnasPartidas.length; c++) {
      totalPartidasRow.getCell(c).border = bordeFino()
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const fechaStr = new Date().toISOString().slice(0, 10)
  descargarExcelEnNavegador(buffer as ArrayBuffer, `Cotizaciones_Odoo_SMV_${fechaStr}.xlsx`)
}
