import { findSatCatalogEntryByKey } from "@/lib/sat/catalogo"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"

/** Devuelve la clave normalizada sólo cuando existe en el catálogo SAT local. */
export function validarClaveProdServCatalogo(value: string | null | undefined): string | null {
  const clave = normalizarClaveProdServ(value)
  return clave && findSatCatalogEntryByKey(clave) ? clave : null
}
