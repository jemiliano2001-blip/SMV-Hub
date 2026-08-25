import { generarBufferExcelFormal, type ColumnaExcelConfig } from "./excel-export-base"

export interface PartidaEndmillsExport {
  id: string
  medidaPulgadas: string
  descripcion: string
  specPropuesta: string
  cantidad: number
  precio: number
  subtotal: number
}

export const COLUMNAS_EXCEL_ENDMILLS: ColumnaExcelConfig[] = [
  { header: "#", width: 6, align: "center" },
  { header: "Size (in)", width: 12, align: "center" },
  { header: "Item Description", width: 34, align: "left", wrapText: true },
  { header: "Specification / Flutes / Coating", width: 38, align: "left", wrapText: true },
  { header: "Qty (pcs)", width: 12, align: "right", numFmt: "#,##0" },
  { header: "Unit Price (USD)", width: 16, align: "right", numFmt: "$#,##0.00" },
  { header: "Total (USD)", width: 16, align: "right", numFmt: "$#,##0.00" },
]

export function armarFilasEndmills(partidas: PartidaEndmillsExport[]): (string | number)[][] {
  return partidas.map((p, idx) => [
    idx + 1,
    p.medidaPulgadas,
    p.descripcion,
    p.specPropuesta,
    p.cantidad,
    p.precio,
    p.subtotal,
  ])
}

export async function generarExcelPOEndmills(opts: {
  partidas: PartidaEndmillsExport[]
  fecha: string
  numeroProveedor?: string
  proveedorNombre: string
  itemsSubtotal: number
  shippingUSD: number
  aliCostUSD: number
  totalUSD: number
  generadoEn?: Date
}): Promise<ArrayBuffer> {
  const filas = armarFilasEndmills(opts.partidas)
  const totalPcs = opts.partidas.reduce((s, p) => s + p.cantidad, 0)

  return generarBufferExcelFormal({
    nombreHoja: "Purchase Order",
    titulo: "SMV MAQUINADOS — INTERNATIONAL PURCHASE ORDER",
    subtitulo: `Supplier: ${opts.proveedorNombre} · PO: ${opts.numeroProveedor || "PO-ENDMILLS"} · Date: ${opts.fecha}`,
    metadatos: `${totalPcs} pcs total · Currency: USD`,
    columnas: COLUMNAS_EXCEL_ENDMILLS,
    filas,
    totales: {
      labelColSpan: 4,
      label: `TOTAL ITEMS (${totalPcs} pcs)`,
      valores: [
        { colIndex: 5, valor: totalPcs, numFmt: "#,##0" },
        { colIndex: 7, valor: opts.itemsSubtotal, numFmt: "$#,##0.00" },
      ],
    },
    orientacion: "landscape",
    generadoEn: opts.generadoEn,
  })
}
