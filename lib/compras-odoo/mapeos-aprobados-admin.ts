/**
 * Mapeos aprobados (`clasificacion_ia_mapeos`) para Route Handlers, con Admin SDK y caché de
 * 5 min — mismo patrón que `lib/sat/cargar-mapeos-firestore.ts`. El loader cliente
 * (`cargarMapeosClasificacion`) usa el SDK web y no sirve en servidor; este no lo sustituye.
 * Reusa `cargarMapeosAprobados` (la lógica de B2 que también corre en Functions).
 */

import { adminDb } from "@/lib/firebase-admin"
import { cargarMapeosAprobados, type IndiceMapeosAprobados } from "@/lib/compras-odoo/mapeos-aprobados"

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { indice: IndiceMapeosAprobados; expiraEn: number } | null = null

/** Solo para pruebas. */
export function invalidarCacheMapeosAprobados(): void {
  cache = null
}

/**
 * Índice de mapeos aprobados o null si Firestore falla (best-effort: la memoria operativa
 * responde sin `familia` antes que fallar). Una lectura fallida no se cachea.
 */
export async function cargarMapeosAprobadosAdmin(ahora: () => number = Date.now): Promise<IndiceMapeosAprobados | null> {
  if (cache && cache.expiraEn > ahora()) return cache.indice
  const indice = await cargarMapeosAprobados(adminDb)
  if (indice) cache = { indice, expiraEn: ahora() + CACHE_TTL_MS }
  return indice
}
