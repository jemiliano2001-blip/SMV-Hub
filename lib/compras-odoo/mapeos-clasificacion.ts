/**
 * Persistencia y reutilización de mapeos de clasificación aprobados por el usuario.
 * Se guardan en Firestore `clasificacion_ia_mapeos`.
 */

import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { CompraOdooItemNormalizado } from "./construir-item"

export type MapeoClasificacionAprobado = {
  id: string
  descripcionNormalizada: string
  descripcionEjemplo: string
  categoriaId: string
  tipoInsumo: string | null
  medida: string | null
  aprobadoPor: string
  creadoEn: Date
  actualizadoEn: Date
}

export function normalizarDescripcionMapeo(desc: string): string {
  return desc
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Carga mapeos aprobados desde Firestore `clasificacion_ia_mapeos`.
 */
export async function cargarMapeosClasificacion(): Promise<MapeoClasificacionAprobado[]> {
  try {
    const snap = await getDocs(collection(db, "clasificacion_ia_mapeos"))
    const lista: MapeoClasificacionAprobado[] = []
    for (const d of snap.docs) {
      const data = d.data()
      if (!data.descripcionNormalizada || !data.categoriaId) continue
      lista.push({
        id: d.id,
        descripcionNormalizada: data.descripcionNormalizada as string,
        descripcionEjemplo: (data.descripcionEjemplo as string) ?? "",
        categoriaId: data.categoriaId as string,
        tipoInsumo: (data.tipoInsumo as string) || null,
        medida: (data.medida as string) || null,
        aprobadoPor: (data.aprobadoPor as string) ?? "desconocido",
        creadoEn: data.creadoEn?.toDate ? data.creadoEn.toDate() : new Date(),
        actualizadoEn: data.actualizadoEn?.toDate ? data.actualizadoEn.toDate() : new Date(),
      })
    }
    return lista
  } catch (err) {
    console.error("[clasificacion_ia_mapeos] Error al cargar mapeos:", err)
    return []
  }
}

/**
 * Guarda o actualiza un mapeo aprobado en Firestore y actualiza el ítem en `compras_odoo_items`.
 */
export async function aprobarYGuardarClasificacion(input: {
  itemId: string
  descripcion: string
  categoriaId: string
  tipoInsumo: string | null
  medida: string | null
  aprobadoPor: string
}): Promise<void> {
  const norm = normalizarDescripcionMapeo(input.descripcion)
  if (!norm) return

  const mapeoDocId = `map_${norm.replace(/\s+/g, "_").slice(0, 100)}`
  const ahora = new Date()

  // 1. Guardar en clasificacion_ia_mapeos
  const mapeoRef = doc(db, "clasificacion_ia_mapeos", mapeoDocId)
  await setDoc(
    mapeoRef,
    {
      id: mapeoDocId,
      descripcionNormalizada: norm,
      descripcionEjemplo: input.descripcion,
      categoriaId: input.categoriaId,
      tipoInsumo: input.tipoInsumo ?? null,
      medida: input.medida ?? null,
      aprobadoPor: input.aprobadoPor,
      actualizadoEn: ahora,
      creadoEn: ahora,
    },
    { merge: true }
  )

  // 2. Actualizar el documento del ítem en compras_odoo_items
  const itemRef = doc(db, "compras_odoo_items", input.itemId)
  await updateDoc(itemRef, {
    categoriaId: input.categoriaId,
    tipoInsumo: input.tipoInsumo ?? null,
    tipoMetal: input.categoriaId === "metals" ? input.tipoInsumo ?? null : null,
    medida: input.medida ?? null,
    clasificadoPorIa: true,
    actualizadoEn: ahora,
  })
}

/**
 * Busca si un ítem coincide con un mapeo previamente aprobado.
 */
export function buscarMapeoAprobado(
  descripcion: string,
  mapeos: MapeoClasificacionAprobado[]
): MapeoClasificacionAprobado | null {
  const norm = normalizarDescripcionMapeo(descripcion)
  if (!norm) return null

  // Coincidencia exacta de texto normalizado
  const exacto = mapeos.find((m) => m.descripcionNormalizada === norm)
  if (exacto) return exacto

  // Coincidencia si una descripción incluye a la otra (para variaciones menores)
  return (
    mapeos.find(
      (m) =>
        m.descripcionNormalizada.length > 5 &&
        (norm.includes(m.descripcionNormalizada) || m.descripcionNormalizada.includes(norm))
    ) ?? null
  )
}

/**
 * Aplica mapeos aprobados a ítems sin clasificar antes de enviarlos a Gemini.
 */
export function aplicarMapeosAprobados(
  items: CompraOdooItemNormalizado[],
  mapeos: MapeoClasificacionAprobado[]
): {
  aplicados: Array<{ item: CompraOdooItemNormalizado; mapeo: MapeoClasificacionAprobado }>
  pendientes: CompraOdooItemNormalizado[]
} {
  const aplicados: Array<{ item: CompraOdooItemNormalizado; mapeo: MapeoClasificacionAprobado }> = []
  const pendientes: CompraOdooItemNormalizado[] = []

  for (const item of items) {
    if (item.categoriaId !== "otros") {
      continue
    }
    const mapeo = buscarMapeoAprobado(item.descripcion, mapeos)
    if (mapeo) {
      aplicados.push({ item, mapeo })
    } else {
      pendientes.push(item)
    }
  }

  return { aplicados, pendientes }
}
