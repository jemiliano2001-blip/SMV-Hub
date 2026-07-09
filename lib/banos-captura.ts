import type { Operador } from "@/lib/schemas"

/** Devuelve el operador activo si el nombre coincide exactamente (trim). */
export function resolverOperadorActivo(
  nombre: string,
  operadores: Operador[]
): Operador | null {
  const trimmed = nombre.trim()
  if (!trimmed) return null
  return operadores.find((o) => o.nombre === trimmed) ?? null
}
