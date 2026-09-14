/**
 * Construcción de ítems intermedios a partir de líneas de compra (capa derivada).
 * No muta documentos crudos de Odoo.
 */

import { resolverCategoriaProducto, detectarTipoInsumo, type CategoriaProductoDef } from "./categorias-registro"
import { generarLlaveItem } from "./llave-item"
import { buscarMapeoAprobadoSync, type IndiceMapeosAprobados } from "./mapeos-aprobados"
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
  /**
   * Indica que la clasificación viene de un mapeo aprobado por el equipo
   * (`clasificacion_ia_mapeos`) aplicado en el sync, no de la heurística.
   */
  clasificadoPorMapeo: boolean
}

export type OpcionesConstruirItem = {
  /** Índice de mapeos aprobados; si se omite, la clasificación es puramente heurística. */
  mapeosAprobados?: IndiceMapeosAprobados | null
}

function normalizarClaveSat(clave: string | null | undefined): string | null {
  if (!clave) return null
  const digits = clave.replace(/\D/g, "")
  if (digits.length !== 8) return null
  return digits
}

export function construirItemDesdeLinea(
  linea: LineaCompraInput,
  opciones: OpcionesConstruirItem = {}
): CompraOdooItemNormalizado {
  const claveProdServ = normalizarClaveSat(linea.claveProdServ)
  const satPendiente = claveProdServ === null
  const metal = parseAtributosMetal(linea.descripcion)
  const categoriaHeuristica = resolverCategoriaProducto({
    claveProdServ,
    descripcion: linea.descripcion,
    registro: linea.registroCategorias,
    odooCategoria: linea.odooCategoria,
  })
  const tipoHeuristico =
    metal.tipoMetal ??
    detectarTipoInsumo(linea.descripcion, categoriaHeuristica, linea.registroCategorias)

  // Un mapeo aprobado por el equipo manda sobre la heurística. Se aplica con la misma forma
  // que `aprobarYGuardarClasificacion` en el cliente: tipoMetal solo cuando la familia es
  // metals, y los campos que el mapeo no trae conservan el valor heurístico.
  const mapeo = opciones.mapeosAprobados
    ? buscarMapeoAprobadoSync(linea.descripcion, opciones.mapeosAprobados)
    : null
  const categoriaId = mapeo?.categoriaId ?? categoriaHeuristica
  const tipoInsumo = mapeo ? (mapeo.tipoInsumo ?? tipoHeuristico) : tipoHeuristico
  const medida = mapeo ? (mapeo.medida ?? metal.medida) : metal.medida
  const tipoMetal = mapeo ? (categoriaId === "metals" ? tipoInsumo : null) : metal.tipoMetal

  // La llave se calcula sobre la clasificación final para que dos corridas (con y sin mapeo
  // nuevo) agrupen igual que lo que el equipo ve en el comparador.
  const llaveItem = generarLlaveItem({
    descripcion: linea.descripcion,
    medida,
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
    tipoMetal,
    tipoInsumo,
    medida,
    unidad: metal.unidad,
    esRfq: linea.esRfq ?? false,
    origen: "odoo",
    odooCategoria: linea.odooCategoria ?? null,
    odooUom: linea.odooUom ?? null,
    odooCostoEstandar: linea.odooCostoEstandar ?? null,
    odooRefInterna: linea.odooRefInterna ?? null,
    // Un mapeo aprobado nace de IA + validación humana: el ítem queda en el mismo estado que
    // deja `aprobarYGuardarClasificacion` (clasificadoPorIa) y además marcado como de mapeo.
    clasificadoPorIa: mapeo !== null,
    clasificadoPorMapeo: mapeo !== null,
  }
}
