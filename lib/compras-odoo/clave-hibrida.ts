/**
 * Clave híbrida para comparar el mismo ítem entre proveedores
 * y rangos históricos min/avg/máx por clave + moneda.
 *
 * No reutiliza `llaveItem` (incluye partner y no sirve para cruzar proveedores).
 */

import { esItemComprable } from "./rangos"
import { normalizarTextoLlave } from "./llave-item"

export const TOLERANCIA_PRECIO_BARATO = 0.05

export type ItemParaClaveHibrida = {
  odooRefInterna?: string | null
  categoriaId: string
  tipoInsumo?: string | null
  tipoMetal?: string | null
  medida?: string | null
  descripcion: string
  moneda?: string | null
  precioUnitario: number
  odooPartnerId?: number
  fecha?: string | null
}

export type RangoHistoricoClave = {
  clave: string
  moneda: string
  min: number
  max: number
  promedio: number
  n: number
  proveedores: number
}

export type PosicionPrecioRango = "barato" | "en_medio" | "caro"

function textoClave(valor: string | null | undefined): string {
  if (!valor) return ""
  return normalizarTextoLlave(valor)
}

export function monedaItem(item: { moneda?: string | null }): string {
  return item.moneda === "USD" ? "USD" : "MXN"
}

export function llaveRangoHistorico(clave: string, moneda: string): string {
  return `${clave}::${moneda}`
}

/**
 * SKU si existe; si no, familia+tipo+medida; si no, descripción.
 */
export function claveHibridaItem(item: ItemParaClaveHibrida): string {
  const sku = textoClave(item.odooRefInterna)
  if (sku) return `sku:${sku}`

  const tipo = textoClave(item.tipoInsumo ?? item.tipoMetal)
  const medida = textoClave(item.medida)
  const categoria = item.categoriaId.trim()
  if (categoria && tipo && medida) {
    return `fam:${categoria}|tipo:${tipo}|med:${medida}`
  }

  const descripcion = textoClave(item.descripcion)
  return `desc:${descripcion || "sin_descripcion"}`
}

function acumularRango(
  mapa: Map<string, { precios: number[]; partners: Set<number>; clave: string; moneda: string }>,
  item: ItemParaClaveHibrida,
): void {
  if (!esItemComprable(item)) return
  const clave = claveHibridaItem(item)
  const moneda = monedaItem(item)
  const llave = llaveRangoHistorico(clave, moneda)
  const actual = mapa.get(llave)
  if (!actual) {
    const partners = new Set<number>()
    if (typeof item.odooPartnerId === "number" && item.odooPartnerId > 0) {
      partners.add(item.odooPartnerId)
    }
    mapa.set(llave, {
      clave,
      moneda,
      precios: [item.precioUnitario],
      partners,
    })
    return
  }
  actual.precios.push(item.precioUnitario)
  if (typeof item.odooPartnerId === "number" && item.odooPartnerId > 0) {
    actual.partners.add(item.odooPartnerId)
  }
}

function cerrarRango(acumulado: {
  clave: string
  moneda: string
  precios: number[]
  partners: Set<number>
}): RangoHistoricoClave {
  const min = Math.min(...acumulado.precios)
  const max = Math.max(...acumulado.precios)
  const suma = acumulado.precios.reduce((acc, precio) => acc + precio, 0)
  const promedio = Math.round((suma / acumulado.precios.length) * 100) / 100
  return {
    clave: acumulado.clave,
    moneda: acumulado.moneda,
    min,
    max,
    promedio,
    n: acumulado.precios.length,
    proveedores: acumulado.partners.size,
  }
}

export function indiceRangosHistoricos(
  items: ItemParaClaveHibrida[],
): Map<string, RangoHistoricoClave> {
  const acumulado = new Map<
    string,
    { precios: number[]; partners: Set<number>; clave: string; moneda: string }
  >()
  for (const item of items) {
    acumularRango(acumulado, item)
  }
  const indice = new Map<string, RangoHistoricoClave>()
  for (const [llave, grupo] of acumulado) {
    indice.set(llave, cerrarRango(grupo))
  }
  return indice
}

export function rangoHistoricoPorClave(
  items: ItemParaClaveHibrida[],
  clave: string,
  moneda: string,
): RangoHistoricoClave | null {
  return indiceRangosHistoricos(items).get(llaveRangoHistorico(clave, moneda)) ?? null
}

export function posicionPrecioEnRango(
  precio: number,
  rango: RangoHistoricoClave,
): PosicionPrecioRango {
  if (Math.abs(precio - rango.min) < TOLERANCIA_PRECIO_BARATO) return "barato"
  if (precio <= rango.promedio) return "en_medio"
  return "caro"
}

export function grupoConMasCompras(
  rangos: Iterable<RangoHistoricoClave>,
): RangoHistoricoClave | null {
  let ganador: RangoHistoricoClave | null = null
  for (const rango of rangos) {
    if (!ganador) {
      ganador = rango
      continue
    }
    if (rango.n > ganador.n) {
      ganador = rango
      continue
    }
    if (rango.n === ganador.n && rango.clave.localeCompare(ganador.clave) < 0) {
      ganador = rango
    }
  }
  return ganador
}

export function comprasHistoricasDelGrupo<T extends ItemParaClaveHibrida>(
  items: T[],
  clave: string,
  moneda: string,
  limite = 8,
): T[] {
  return items
    .filter(
      (item) =>
        esItemComprable(item) &&
        claveHibridaItem(item) === clave &&
        monedaItem(item) === moneda,
    )
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
    .slice(0, limite)
}
