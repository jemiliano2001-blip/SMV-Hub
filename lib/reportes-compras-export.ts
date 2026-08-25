import { generarBufferExcelFormal, fechaIso, type ColumnaExcelConfig } from "./excel-export-base"
import type { Linea } from "./reportes"

export const COLUMNAS_EXCEL_COMPRAS: ColumnaExcelConfig[] = [
  { header: "Fecha", width: 12, align: "center" },
  { header: "Factura / Ref", width: 16, align: "left" },
  { header: "Proveedor", width: 24, align: "left" },
  { header: "Descripción", width: 40, align: "left", wrapText: true },
  { header: "Cant.", width: 10, align: "right", numFmt: "#,##0.###" },
  { header: "P. Unitario", width: 14, align: "right", numFmt: "#,##0.00" },
  { header: "Subtotal", width: 14, align: "right", numFmt: "#,##0.00" },
  { header: "Total", width: 14, align: "right", numFmt: "#,##0.00" },
  { header: "Moneda", width: 9, align: "center" },
  { header: "Requisitor", width: 18, align: "left" },
  { header: "Cuenta Cargo", width: 16, align: "left" },
  { header: "Destino", width: 18, align: "left" },
]

export function armarFilasExcelCompras(lineas: Linea[]): (string | number)[][] {
  return lineas.map((l) => [
    fechaIso(l.dia),
    l.referencia || "—",
    l.proveedor,
    l.descripcionSimplificada || l.descripcion,
    l.cantidad ?? 0,
    l.precioUnitario ?? 0,
    l.subtotal,
    l.total,
    l.moneda,
    l.requisitor || "—",
    l.cuentaCargo || "—",
    l.destino || "—",
  ])
}

export async function generarExcelReporteCompras(opts: {
  lineas: Linea[]
  subtitulo: string
  moneda: string
  generadoEn?: Date
}): Promise<ArrayBuffer> {
  const filas = armarFilasExcelCompras(opts.lineas)
  const totalGeneral = opts.lineas.reduce((s, l) => s + l.total, 0)
  const subtotalGeneral = opts.lineas.reduce((s, l) => s + l.subtotal, 0)

  return generarBufferExcelFormal({
    nombreHoja: "Reporte de Compras",
    titulo: "Reporte de Compras",
    subtitulo: opts.subtitulo,
    metadatos: `${opts.moneda} · ${opts.lineas.length} partidas`,
    columnas: COLUMNAS_EXCEL_COMPRAS,
    filas,
    totales: {
      labelColSpan: 6,
      label: `TOTAL GENERAL (${opts.moneda})`,
      valores: [
        { colIndex: 7, valor: subtotalGeneral, numFmt: "#,##0.00" },
        { colIndex: 8, valor: totalGeneral, numFmt: "#,##0.00" },
        { colIndex: 9, valor: opts.moneda, align: "center" },
      ],
    },
    orientacion: "landscape",
    generadoEn: opts.generadoEn,
  })
}
