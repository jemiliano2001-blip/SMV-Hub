import type { SugerenciaClaveSat } from "@/lib/sat/types"
import { normalizarTexto } from "@/lib/sugerencias-compra"

const TTL_MS = 24 * 60 * 60 * 1000
/** Incrementar al cambiar glosario, scoring o modelos IA para invalidar caché lógica. */
const CACHE_VERSION = "v2"

type CacheEntry = {
  sugerencia: SugerenciaClaveSat
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export function claveCacheSat(descripcion: string, proveedor = ""): string {
  const desc = normalizarTexto(descripcion)
  const prov = normalizarTexto(proveedor)
  const base = prov ? `${desc}::${prov}` : desc
  return `${CACHE_VERSION}::${base}`
}

export function getSatSugerenciaCache(
  descripcion: string,
  proveedor?: string
): SugerenciaClaveSat | null {
  const key = claveCacheSat(descripcion, proveedor ?? "")
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.sugerencia
}

export function setSatSugerenciaCache(
  descripcion: string,
  proveedor: string | undefined,
  sugerencia: SugerenciaClaveSat
): void {
  if (!sugerencia.claveProdServ) return
  const key = claveCacheSat(descripcion, proveedor ?? "")
  cache.set(key, { sugerencia, expiresAt: Date.now() + TTL_MS })
}

/** Solo para tests. */
export function clearSatSugerenciaCache(): void {
  cache.clear()
}
