import type { OrdenCompra } from "@/lib/schemas"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"

/**
 * Entradas ligeras para sugerencia SAT desde el cliente.
 * Vive fuera de `sugerir-clave` / `catalogo` para no meter ~10 MB de catálogo en el bundle.
 */
export function extraerEntradasHistorialSat(
  ordenes: OrdenCompra[],
  maxEntradas = 500
): Array<{ descripcion: string; claveProdServ: string }> {
  const mapa = new Map<string, { descripcion: string; claveProdServ: string }>()
  for (const orden of ordenes) {
    for (const item of orden.items ?? []) {
      const clave = normalizarClaveProdServ(item.claveProdServ)
      const desc = item.descripcion?.trim()
      if (!clave || !desc) continue
      const key = desc.toLowerCase().replace(/\s+/g, " ")
      if (!mapa.has(key)) {
        mapa.set(key, { descripcion: desc, claveProdServ: clave })
        if (mapa.size >= maxEntradas) break
      }
    }
    if (mapa.size >= maxEntradas) break
  }
  return Array.from(mapa.values())
}
