import { generarBufferExcelFormal, fechaIso, type ColumnaExcelConfig } from "./excel-export-base"
import type { FacturaCliente } from "./schemas"

export const COLUMNAS_EXCEL_FINANZAS: ColumnaExcelConfig[] = [
  { header: "Cliente", width: 30, align: "left" },
  { header: "Factura", width: 16, align: "left" },
  { header: "Tipo", width: 16, align: "center" },
  { header: "Fecha Emisión", width: 14, align: "center" },
  { header: "Vencimiento", width: 14, align: "center" },
  { header: "Moneda", width: 9, align: "center" },
  { header: "Subtotal", width: 15, align: "right", numFmt: "#,##0.00" },
  { header: "IVA", width: 14, align: "right", numFmt: "#,##0.00" },
  { header: "Total", width: 15, align: "right", numFmt: "#,##0.00" },
  { header: "Saldo Pendiente", width: 15, align: "right", numFmt: "#,##0.00" },
  { header: "Estado", width: 14, align: "center" },
]

export function armarFilasExcelFinanzas(facturas: FacturaCliente[]): (string | number)[][] {
  return facturas.map((f) => [
    f.cliente,
    f.numeroFactura,
    f.tipo === "nota_credito" ? "Nota de crédito" : "Factura",
    f.fechaFactura ? fechaIso(f.fechaFactura) : "—",
    f.fechaVencimiento ? fechaIso(f.fechaVencimiento) : "—",
    f.moneda,
    f.subtotal,
    f.impuestos,
    f.total,
    f.saldoPendiente,
    f.estadoPago,
  ])
}

export async function generarExcelReporteFinanzas(opts: {
  facturas: FacturaCliente[]
  periodoLabel: string
  moneda: string
  generadoEn?: Date
}): Promise<ArrayBuffer> {
  const filas = armarFilasExcelFinanzas(opts.facturas)
  const totalSubtotal = opts.facturas.reduce((s, f) => s + f.subtotal, 0)
  const totalIva = opts.facturas.reduce((s, f) => s + f.impuestos, 0)
  const totalFacturacion = opts.facturas.reduce((s, f) => s + f.total, 0)
  const totalSaldo = opts.facturas.reduce((s, f) => s + f.saldoPendiente, 0)

  return generarBufferExcelFormal({
    nombreHoja: "Facturación Clientes",
    titulo: "Reporte de Facturación a Clientes (Odoo)",
    subtitulo: opts.periodoLabel,
    metadatos: `${opts.moneda} · ${opts.facturas.length} documentos`,
    columnas: COLUMNAS_EXCEL_FINANZAS,
    filas,
    totales: {
      labelColSpan: 6,
      label: `TOTALES (${opts.moneda})`,
      valores: [
        { colIndex: 7, valor: totalSubtotal, numFmt: "#,##0.00" },
        { colIndex: 8, valor: totalIva, numFmt: "#,##0.00" },
        { colIndex: 9, valor: totalFacturacion, numFmt: "#,##0.00" },
        { colIndex: 10, valor: totalSaldo, numFmt: "#,##0.00" },
      ],
    },
    orientacion: "landscape",
    generadoEn: opts.generadoEn,
  })
}
