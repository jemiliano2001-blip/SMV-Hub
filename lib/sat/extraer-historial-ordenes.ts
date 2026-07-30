import type { OrdenCompra } from "@/lib/schemas"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"

/**
 * Entradas ligeras para sugerencia SAT desde el cliente.
 * Vive fuera de `sugerir-clave` / `catalogo` para no meter ~10 MB de catálogo en el bundle.
 */
export function extraerEntradasHistorialSat(
  ordenes: OrdenCompra[]
): Array<{ descripcion: string; claveProdServ: string }> {
  const entradas: Array<{ descripcion: string; claveProdServ: string }> = []
  for (const orden of ordenes) {
    for (const item of orden.items ?? []) {
      const clave = normalizarClaveProdServ(item.claveProdServ)
      if (!clave || !item.descripcion?.trim()) continue
      entradas.push({ descripcion: item.descripcion, claveProdServ: clave })
    }
  }
  return entradas
}
