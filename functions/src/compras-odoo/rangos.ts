/**
 * Rangos de precio por familia de insumo (metales, plásticos, herramientas, etc.).
 * Nunca suma monedas distintas.
 */

import type { CompraOdooItemNormalizado } from "./construir-item"
import { detectarTipoInsumo } from "./categorias-registro"

export type FiltroRangoFamilia = {
  categoriaId: string
  /** Tipo dentro de la familia (ej. acero_1018, nylon, fresa). */
  tipo?: string | null
  medida?: string | null
  moneda?: string | null
}

/** @deprecated Usar FiltroRangoFamilia. */
export type FiltroRangoMetal = {
  tipoMetal: string
  medida?: string | null
  moneda?: string | null
  categoriaId?: string
}

export type RangoPreciosFamilia = {
  categoriaId: string
  tipo: string | null
  medida: string | null
  moneda: string | null
  min: number | null
  max: number | null
  promedio: number | null
  n: number
  precios: number[]
}

/** @deprecated Alias de RangoPreciosFamilia con campo tipoMetal. */
export type RangoPreciosMetal = {
  tipoMetal: string
  medida: string | null
  moneda: string | null
  min: number | null
  max: number | null
  promedio: number | null
  n: number
  precios: number[]
}

function medidaCoincide(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!b) return true
  if (!a) return false
  const na = a.replace(/\s+/g, "").toLowerCase()
  const nb = b.replace(/\s+/g, "").toLowerCase()
  return na === nb || na.includes(nb) || nb.includes(na)
}

/** Tipo efectivo del ítem: campo tipoInsumo, metal parseado o keyword. */
export function tipoEfectivoItem(item: CompraOdooItemNormalizado): string | null {
  if (item.tipoInsumo) return item.tipoInsumo
  if (item.tipoMetal) return item.tipoMetal
  return detectarTipoInsumo(item.descripcion, item.categoriaId)
}

export function rangoPreciosPorFamilia(
  items: CompraOdooItemNormalizado[],
  filtro: FiltroRangoFamilia
): RangoPreciosFamilia {
  const tipoNorm = (filtro.tipo ?? "").trim().toLowerCase()
  const precios: number[] = []
  let monedaUsada: string | null = filtro.moneda ?? null

  for (const item of items) {
    if (item.categoriaId !== filtro.categoriaId) continue
    const tipoItem = tipoEfectivoItem(item)
    if (tipoNorm) {
      if (!tipoItem || tipoItem.toLowerCase() !== tipoNorm) continue
    }
    if (!medidaCoincide(item.medida, filtro.medida)) continue
    if (filtro.moneda && item.moneda !== filtro.moneda) continue
    if (item.precioUnitario < 0) continue
    precios.push(item.precioUnitario)
    if (!monedaUsada) monedaUsada = item.moneda
  }

  if (precios.length === 0) {
    return {
      categoriaId: filtro.categoriaId,
      tipo: filtro.tipo ?? null,
      medida: filtro.medida ?? null,
      moneda: monedaUsada,
      min: null,
      max: null,
      promedio: null,
      n: 0,
      precios: [],
    }
  }

  const min = Math.min(...precios)
  const max = Math.max(...precios)
  const suma = precios.reduce((acc, p) => acc + p, 0)
  const promedio = Math.round((suma / precios.length) * 100) / 100

  return {
    categoriaId: filtro.categoriaId,
    tipo: filtro.tipo ?? null,
    medida: filtro.medida ?? null,
    moneda: monedaUsada,
    min,
    max,
    promedio,
    n: precios.length,
    precios,
  }
}

/** Compat: rangos de metales con API anterior. */
export function rangoPreciosPorMetal(
  items: CompraOdooItemNormalizado[],
  filtro: FiltroRangoMetal
): RangoPreciosMetal {
  const r = rangoPreciosPorFamilia(items, {
    categoriaId: filtro.categoriaId ?? "metals",
    tipo: filtro.tipoMetal,
    medida: filtro.medida,
    moneda: filtro.moneda,
  })
  return {
    tipoMetal: filtro.tipoMetal,
    medida: r.medida,
    moneda: r.moneda,
    min: r.min,
    max: r.max,
    promedio: r.promedio,
    n: r.n,
    precios: r.precios,
  }
}

export function listarTiposEnCategoria(
  items: CompraOdooItemNormalizado[],
  categoriaId: string
): string[] {
  const set = new Set<string>()
  for (const i of items) {
    if (i.categoriaId !== categoriaId) continue
    const t = tipoEfectivoItem(i)
    if (t) set.add(t)
  }
  return [...set].sort()
}

export function listarTiposMetal(items: CompraOdooItemNormalizado[]): string[] {
  return listarTiposEnCategoria(items, "metals")
}

export function listarMedidasEnCategoria(
  items: CompraOdooItemNormalizado[],
  categoriaId: string,
  tipo?: string | null
): string[] {
  const set = new Set<string>()
  const t = (tipo ?? "").toLowerCase()
  for (const i of items) {
    if (i.categoriaId !== categoriaId) continue
    if (t) {
      const tipoItem = tipoEfectivoItem(i)
      if (!tipoItem || tipoItem.toLowerCase() !== t) continue
    }
    if (i.medida) set.add(i.medida)
  }
  return [...set].sort()
}

export function listarMedidasParaMetal(
  items: CompraOdooItemNormalizado[],
  tipoMetal: string
): string[] {
  return listarMedidasEnCategoria(items, "metals", tipoMetal)
}
