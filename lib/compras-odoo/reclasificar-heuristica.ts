/**
 * Re-clasificación heurística de ítems en `otros` sin llamar a Gemini.
 * Re-ejecuta resolverCategoriaProducto + detectarTipoInsumo sobre el espejo cargado.
 */

import { doc, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  detectarTipoInsumo,
  resolverCategoriaProducto,
} from "./categorias-registro"
import { parseAtributosMetal } from "./parse-metal"
import type { CompraOdooItemNormalizado } from "./construir-item"

export type ItemReclasificable = Pick<
  CompraOdooItemNormalizado,
  | "id"
  | "descripcion"
  | "claveProdServ"
  | "odooCategoria"
  | "categoriaId"
  | "tipoInsumo"
  | "tipoMetal"
  | "medida"
>

export type ActualizacionHeuristica = {
  itemId: string
  categoriaId: string
  tipoInsumo: string | null
  tipoMetal: string | null
  medida: string | null
}

export type ResultadoReclasificacionHeuristica = {
  evaluados: number
  actualizados: number
  sinCambio: number
}

const BATCH_SIZE = 400

/** Calcula la clasificación heurística para un ítem en `otros`. */
export function calcularClasificacionHeuristica(
  item: ItemReclasificable,
): ActualizacionHeuristica | null {
  if (item.categoriaId !== "otros") return null

  const metal = parseAtributosMetal(item.descripcion)
  const categoriaId = resolverCategoriaProducto({
    claveProdServ: item.claveProdServ,
    descripcion: item.descripcion,
    odooCategoria: item.odooCategoria,
  })

  if (categoriaId === "otros") return null

  const tipoInsumo =
    metal.tipoMetal ?? detectarTipoInsumo(item.descripcion, categoriaId)

  return {
    itemId: item.id,
    categoriaId,
    tipoInsumo,
    tipoMetal: categoriaId === "metals" ? tipoInsumo : null,
    medida: metal.medida,
  }
}

/** Evalúa un lote de ítems y devuelve solo los que salen de `otros`. */
export function evaluarReclasificacionHeuristica(
  items: ItemReclasificable[],
): ActualizacionHeuristica[] {
  const actualizaciones: ActualizacionHeuristica[] = []
  for (const item of items) {
    const cambio = calcularClasificacionHeuristica(item)
    if (cambio) actualizaciones.push(cambio)
  }
  return actualizaciones
}

/** Persiste actualizaciones heurísticas en Firestore (sin marcar clasificadoPorIa). */
export async function aplicarReclasificacionHeuristica(
  items: ItemReclasificable[],
): Promise<ResultadoReclasificacionHeuristica> {
  const candidatos = items.filter((i) => i.categoriaId === "otros")
  const actualizaciones = evaluarReclasificacionHeuristica(candidatos)

  if (actualizaciones.length === 0) {
    return {
      evaluados: candidatos.length,
      actualizados: 0,
      sinCambio: candidatos.length,
    }
  }

  const ahora = new Date()
  for (let i = 0; i < actualizaciones.length; i += BATCH_SIZE) {
    const lote = actualizaciones.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const act of lote) {
      const ref = doc(db, "compras_odoo_items", act.itemId)
      batch.update(ref, {
        categoriaId: act.categoriaId,
        tipoInsumo: act.tipoInsumo,
        tipoMetal: act.tipoMetal,
        medida: act.medida,
        actualizadoEn: ahora,
      })
    }
    await batch.commit()
  }

  return {
    evaluados: candidatos.length,
    actualizados: actualizaciones.length,
    sinCambio: candidatos.length - actualizaciones.length,
  }
}
