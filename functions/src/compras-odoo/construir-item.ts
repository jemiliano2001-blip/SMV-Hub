/**
 * Construcción de ítems intermedios a partir de líneas de compra (capa derivada).
 * No muta documentos crudos de Odoo.
 */

import { resolverCategoriaProducto, detectarTipoInsumo, type CategoriaProductoDef } from "./categorias-registro"
import { generarLlaveItem } from "./llave-item"
import { parseAtributosMetal } from "./parse-metal"

export type FuenteCompraOdoo = "po" | "factura"

export type LineaCompraInput = {
  fuente: FuenteCompraOdoo
  odooDocId: number
  odooLineId: number
  referenciaDoc: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  moneda: string
  fecha: string | null
  odooPartnerId: number
  proveedorNombre: string
  /** Clave SAT del producto Odoo si existe; null = pendiente. */
  claveProdServ?: string | null
  /** PO origen en facturas (invoice_origin). */
  origenPo?: string | null
  productOdooId?: number | null
  esRfq?: boolean
  registroCategorias?: CategoriaProductoDef[]
  /** Categoría de producto en Odoo (product.category name). */
  odooCategoria?: string | null
  /** Unidad de medida en Odoo (product.uom name). */
  odooUom?: string | null
  /** Costo estándar del producto en Odoo (standard_price). */
  odooCostoEstandar?: number | null
  /** Referencia interna del producto en Odoo (default_code). */
  odooRefInterna?: string | null
}

export type CompraOdooItemNormalizado = {
  id: string
  llaveItem: string
  fuente: FuenteCompraOdoo
  odooDocId: number
  odooLineId: number
  referenciaDoc: string
  origenPo: string | null
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  moneda: string
  fecha: string | null
  odooPartnerId: number
  proveedorNombre: string
  productOdooId: number | null
  claveProdServ: string | null
  satPendiente: boolean
  categoriaId: string
  tipoMetal: string | null
  /** Tipo dentro de la familia (metal grade, nylon, fresa, etc.). */
  tipoInsumo: string | null
  medida: string | null
  unidad: string | null
  esRfq: boolean
  origen: "odoo"
  /** Categoría del producto en Odoo (jerárquica, ej. "Metal / Acero"). */
  odooCategoria: string | null
  /** Unidad de medida Odoo. */
  odooUom: string | null
  /** Costo estándar Odoo. */
  odooCostoEstandar: number | null
  /** Referencia interna Odoo. */
  odooRefInterna: string | null
  /** Indica si fue re-clasificado por IA (Gemini). */
  clasificadoPorIa: boolean
}

function normalizarClaveSat(clave: string | null | undefined): string | null {
  if (!clave) return null
  const digits = clave.replace(/\D/g, "")
  if (digits.length !== 8) return null
  return digits
}

export function construirItemDesdeLinea(linea: LineaCompraInput): CompraOdooItemNormalizado {
  const claveProdServ = normalizarClaveSat(linea.claveProdServ)
  const satPendiente = claveProdServ === null
  const metal = parseAtributosMetal(linea.descripcion)
  const categoriaId = resolverCategoriaProducto({
    claveProdServ,
    descripcion: linea.descripcion,
    registro: linea.registroCategorias,
    odooCategoria: linea.odooCategoria,
  })
  const tipoInsumo =
    metal.tipoMetal ??
    detectarTipoInsumo(linea.descripcion, categoriaId, linea.registroCategorias)
  const llaveItem = generarLlaveItem({
    descripcion: linea.descripcion,
    medida: metal.medida,
    tipoMetal: tipoInsumo,
    odooPartnerId: linea.odooPartnerId,
  })
  const id = `${linea.fuente}_${linea.odooDocId}_${linea.odooLineId}`

  return {
    id,
    llaveItem,
    fuente: linea.fuente,
    odooDocId: linea.odooDocId,
    odooLineId: linea.odooLineId,
    referenciaDoc: linea.referenciaDoc,
    origenPo: linea.origenPo ?? null,
    descripcion: linea.descripcion,
    cantidad: linea.cantidad,
    precioUnitario: linea.precioUnitario,
    subtotal: linea.subtotal,
    moneda: linea.moneda,
    fecha: linea.fecha,
    odooPartnerId: linea.odooPartnerId,
    proveedorNombre: linea.proveedorNombre,
    productOdooId: linea.productOdooId ?? null,
    claveProdServ,
    satPendiente,
    categoriaId,
    tipoMetal: metal.tipoMetal,
    tipoInsumo,
    medida: metal.medida,
    unidad: metal.unidad,
    esRfq: linea.esRfq ?? false,
    origen: "odoo",
    odooCategoria: linea.odooCategoria ?? null,
    odooUom: linea.odooUom ?? null,
    odooCostoEstandar: linea.odooCostoEstandar ?? null,
    odooRefInterna: linea.odooRefInterna ?? null,
    clasificadoPorIa: false,
  }
}
