import { generarBufferExcelFormal, type ColumnaExcelConfig } from "./excel-export-base"
import type { MovimientoCajaChica } from "./schemas"

export const COLUMNAS_EXCEL_CAJA: ColumnaExcelConfig[] = [
  { header: "Fecha", width: 14, align: "center" },
  { header: "Descripción", width: 38, align: "left", wrapText: true },
  { header: "Proveedor / Lugar", width: 26, align: "left" },
  { header: "Categoría", width: 18, align: "left" },
  { header: "Comprobante", width: 16, align: "center" },
  { header: "Monto (MXN)", width: 16, align: "right", numFmt: "$#,##0.00" },
]

export function armarFilasExcelCaja(movimientos: MovimientoCajaChica[]): (string | number)[][] {
  return movimientos.map((m) => [
    m.fecha,
    m.descripcion,
    m.proveedor,
    m.categoria,
    m.comprobante,
    m.monto,
  ])
}

export async function generarExcelReporteCaja(opts: {
  movimientos: MovimientoCajaChica[]
  etiquetaModo: string
  conFactura: boolean
  generadoEn?: Date
}): Promise<ArrayBuffer> {
  const filas = armarFilasExcelCaja(opts.movimientos)
  const total = opts.movimientos.reduce((s, m) => s + m.monto, 0)
  const filtroFactura = opts.conFactura ? "Con Factura" : "Sin Factura"

  return generarBufferExcelFormal({
    nombreHoja: "Caja Chica",
    titulo: "Reporte de Gastos — Caja Chica",
    subtitulo: `${opts.etiquetaModo} · Gastos ${filtroFactura}`,
    metadatos: `MXN · ${opts.movimientos.length} movimientos`,
    columnas: COLUMNAS_EXCEL_CAJA,
    filas,
    totales: {
      labelColSpan: 5,
      label: "TOTAL GASTOS (MXN)",
      valores: [{ colIndex: 6, valor: total, numFmt: "$#,##0.00" }],
    },
    orientacion: "landscape",
    generadoEn: opts.generadoEn,
  })
}
