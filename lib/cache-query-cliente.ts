/**
 * Capa liviana de caché en memoria Stale-While-Revalidate para consultas frecuentes
 * en el cliente (Firestore / APIs locales).
 *
 * Evita sobre-lecturas y parpadeos al navegar recurrentemente entre pestañas.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cacheGlobal = new Map<string, CacheEntry<unknown>>()

/**
 * Obtiene un valor en caché si aún no ha expirado el TTL.
 */
export function obtenerCacheQuery<T>(llave: string, ttlMs = 30000): T | null {
  const entrada = cacheGlobal.get(llave) as CacheEntry<T> | undefined
  if (!entrada) return null

  const ahora = Date.now()
  if (ahora - entrada.timestamp > ttlMs) {
    cacheGlobal.delete(llave)
    return null
  }

  return entrada.data
}

/**
 * Guarda un valor en la caché en memoria con marca de tiempo actual.
 */
export function guardarCacheQuery<T>(llave: string, data: T): void {
  cacheGlobal.set(llave, {
    data,
    timestamp: Date.now(),
  })
}

/**
 * Invalida una llave específica o todas las que comiencen con un prefijo.
 * Útil tras mutaciones (crear, editar o eliminar registros).
 */
export function invalidarCacheQuery(prefijo?: string): void {
  if (!prefijo) {
    cacheGlobal.clear()
    return
  }

  for (const llave of cacheGlobal.keys()) {
    if (llave.startsWith(prefijo)) {
      cacheGlobal.delete(llave)
    }
  }
}

/**
 * Ejecuta una consulta con soporte de caché en memoria y fallback a fetcher.
 */
export async function ejecutarConCache<T>(
  llave: string,
  fetcher: () => Promise<T>,
  ttlMs = 30000
): Promise<T> {
  const enCache = obtenerCacheQuery<T>(llave, ttlMs)
  if (enCache !== null) {
    return enCache
  }

  const datos = await fetcher()
  guardarCacheQuery(llave, datos)
  return datos
}
