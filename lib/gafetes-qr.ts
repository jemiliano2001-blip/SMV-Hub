import type { Operador } from "@/lib/schemas"

export const PREFIJO_QR_OPERADOR = "smv:op:"

/**
 * Genera el payload canónico para el código QR de un operador.
 */
export function construirPayloadQROperador(operador: Pick<Operador, "id" | "nombre">): string {
  return `${PREFIJO_QR_OPERADOR}${operador.id}`
}

/**
 * Parsea el payload escaneado desde un código QR o texto.
 */
export function parsearPayloadQROperador(payload: string): { operadorId?: string; textoPlano?: string } | null {
  const texto = payload.trim()
  if (!texto) return null

  if (texto.startsWith(PREFIJO_QR_OPERADOR)) {
    const id = texto.slice(PREFIJO_QR_OPERADOR.length).trim()
    return id ? { operadorId: id } : null
  }

  // Fallback si el QR contenía directamente el ID o el nombre
  return { textoPlano: texto }
}

/**
 * Resuelve un operador activo a partir del payload escaneado del código QR.
 */
export function resolverOperadorPorQR(payload: string, operadores: Operador[]): Operador | null {
  const parsed = parsearPayloadQROperador(payload)
  if (!parsed) return null

  if (parsed.operadorId) {
    const encontradoPorId = operadores.find((op) => op.id === parsed.operadorId && op.activo !== false)
    if (encontradoPorId) return encontradoPorId
  }

  if (parsed.textoPlano) {
    const normalizado = parsed.textoPlano.trim().toLowerCase()
    // Buscar por ID exacto
    const porId = operadores.find((op) => op.id.toLowerCase() === normalizado && op.activo !== false)
    if (porId) return porId

    // Buscar por nombre exacto
    const porNombre = operadores.find((op) => op.nombre.trim().toLowerCase() === normalizado && op.activo !== false)
    if (porNombre) return porNombre
  }

  return null
}
