/**
 * Consolidación del histórico de costos por llaveItem (PO + factura).
 * Preferencia: precio de factura posteada sobre línea de PO cuando comparten llave.
 */

import type { CompraOdooItemNormalizado } from "./construir-item"

export type PuntoCostoHistorico = {
  llaveItem: string
  descripcion: string
  tipoMetal: string | null
  medida: string | null
  categoriaId: string
  precioUnitario: number
  moneda: string
  cantidad: number
  fecha: string | null
  fuente: "po" | "factura"
  referenciaDoc: string
  proveedorNombre: string
  claveProdServ: string | null
}

export type HistoricoCostoPorItem = {
  llaveItem: string
  descripcion: string
  tipoMetal: string | null
  medida: string | null
  categoriaId: string
  claveProdServ: string | null
  puntos: PuntoCostoHistorico[]
  precioPreferido: number | null
  fuentePreferida: "po" | "factura" | null
}

/**
 * Agrupa ítems por llaveItem. Si hay factura y PO, el precio preferido es el de factura.
 */
export function consolidarHistoricoCostos(
  items: CompraOdooItemNormalizado[]
): HistoricoCostoPorItem[] {
  const porLlave = new Map<string, CompraOdooItemNormalizado[]>()
  for (const item of items) {
    const lista = porLlave.get(item.llaveItem) ?? []
    lista.push(item)
    porLlave.set(item.llaveItem, lista)
  }

  const resultado: HistoricoCostoPorItem[] = []
  for (const [llaveItem, grupo] of porLlave) {
    const puntos: PuntoCostoHistorico[] = grupo.map((i) => ({
      llaveItem: i.llaveItem,
      descripcion: i.descripcion,
      tipoMetal: i.tipoMetal,
      medida: i.medida,
      categoriaId: i.categoriaId,
      precioUnitario: i.precioUnitario,
      moneda: i.moneda,
      cantidad: i.cantidad,
      fecha: i.fecha,
      fuente: i.fuente,
      referenciaDoc: i.referenciaDoc,
      proveedorNombre: i.proveedorNombre,
      claveProdServ: i.claveProdServ,
    }))

    const facturas = grupo.filter((i) => i.fuente === "factura")
    const preferido = facturas.length > 0 ? facturas[facturas.length - 1] : grupo[grupo.length - 1]
    const base = preferido ?? grupo[0]

    resultado.push({
      llaveItem,
      descripcion: base.descripcion,
      tipoMetal: base.tipoMetal,
      medida: base.medida,
      categoriaId: base.categoriaId,
      claveProdServ: base.claveProdServ,
      puntos,
      precioPreferido: preferido?.precioUnitario ?? null,
      fuentePreferida: preferido?.fuente ?? null,
    })
  }

  return resultado.sort((a, b) => a.llaveItem.localeCompare(b.llaveItem))
}
