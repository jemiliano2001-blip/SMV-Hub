import { adminDb } from "@/lib/firebase-admin"
import { mapeoDesdeFirestore } from "@/lib/sat/mapeos-persistir"
import type { MapeoSmvEntry } from "@/lib/sat/types"

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { entries: MapeoSmvEntry[]; expiresAt: number } | null = null

/** Carga mapeos validados por el equipo desde Firestore `sat_asignaciones`. */
export async function cargarMapeosSatDesdeFirestore(): Promise<MapeoSmvEntry[]> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.entries
  }

  try {
    const snap = await adminDb.collection("sat_asignaciones").get()
    const entries: MapeoSmvEntry[] = []
    for (const doc of snap.docs) {
      const mapeo = mapeoDesdeFirestore(doc.data() as Record<string, unknown>)
      if (!mapeo) continue
      entries.push({ ...mapeo, origen: "firestore" })
    }

    cache = { entries, expiresAt: Date.now() + CACHE_TTL_MS }
    return entries
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "error desconocido"
    console.error("[sat_asignaciones] no se pudieron cargar mapeos:", mensaje)
    return []
  }
}

/** Solo para tests. */
export function invalidarCacheMapeosFirestore(): void {
  cache = null
}
