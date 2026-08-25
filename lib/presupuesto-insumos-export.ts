import { generarBufferExcelFormal, type ColumnaExcelConfig } from "./excel-export-base"
import type { PartidaPresupuesto } from "./hooks/usePresupuestoInsumos"

export const COLUMNAS_EXCEL_PRESUPUESTO: ColumnaExcelConfig[] = [
  { header: "#", width: 6, align: "center" },
  { header: "Descripción", width: 36, align: "left", wrapText: true },
  { header: "Categoría", width: 16, align: "left" },
  { header: "Tipo / Material", width: 18, align: "left" },
  { header: "Medida", width: 16, align: "left" },
  { header: "Proveedor", width: 22, align: "left" },
  { header: "Cant.", width: 10, align: "right", numFmt: "#,##0.###" },
  { header: "Moneda", width: 10, align: "center" },
  { header: "P. Unitario", width: 14, align: "right", numFmt: "#,##0.00" },
  { header: "Importe Orig.", width: 15, align: "right", numFmt: "#,##0.00" },
  { header: "Importe MXN", width: 16, align: "right", numFmt: "$#,##0.00" },
  { header: "Importe USD", width: 16, align: "right", numFmt: "$#,##0.00" },
]

export function armarFilasPresupuesto(partidas: PartidaPresupuesto[]): (string | number)[][] {
  return partidas.map((p, idx) => [
    idx + 1,
    p.descripcion,
    p.categoriaId,
    p.tipoInsumo ?? "—",
    p.medida ?? "—",
    p.proveedorNombre,
    p.cantidad,
    p.moneda,
    p.precioUnitario,
    p.subtotal,
    p.subtotalMxn,
    p.subtotalUsd,
  ])
}

export async function generarExcelPresupuestoInsumos(opts: {
  partidas: PartidaPresupuesto[]
  usdToMxn: number
  totalMxn: number
  totalUsd: number
  generadoEn?: Date
}): Promise<ArrayBuffer> {
  const filas = armarFilasPresupuesto(opts.partidas)

  return generarBufferExcelFormal({
    nombreHoja: "Presupuesto Insumos",
    titulo: "Presupuesto de Insumos y Materiales",
    subtitulo: `Tipo de cambio referencia: $${opts.usdToMxn.toFixed(2)} MXN/USD`,
    metadatos: `${opts.partidas.length} partidas presupuestadas`,
    columnas: COLUMNAS_EXCEL_PRESUPUESTO,
    filas,
    totales: {
      labelColSpan: 10,
      label: "TOTALES ESTIMADOS",
      valores: [
        { colIndex: 11, valor: opts.totalMxn, numFmt: "$#,##0.00" },
        { colIndex: 12, valor: opts.totalUsd, numFmt: "$#,##0.00" },
      ],
    },
    orientacion: "landscape",
    generadoEn: opts.generadoEn,
  })
}
