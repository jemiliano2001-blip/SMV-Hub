import { normalizarClaveProdServ } from "@/lib/sat/normalizar"
import type { ItemParaSugerirSat } from "@/lib/sat/types"

/** Tope del POST /api/sugerir-clave-sat: Gemini + timeout del SSR. El cliente parte lotes más grandes. */
export const MAX_ITEMS_SUGERIR_CLAVE_SAT = 50

export type HistorialEntradaSat = {
  descripcion: string
  claveProdServ: string
}

export function partirLoteSugerirClaveSat<T>(
  items: readonly T[],
  tamano = MAX_ITEMS_SUGERIR_CLAVE_SAT
): T[][] {
  if (tamano < 1) throw new Error("El tamaño de lote debe ser mayor que cero")
  if (items.length === 0) return []

  const lotes: T[][] = []
  for (let i = 0; i < items.length; i += tamano) {
    lotes.push(items.slice(i, i + tamano))
  }
  return lotes
}

export function itemPayloadSugerirClaveSat(item: {
  descripcion: unknown
  proveedor?: unknown
  terminosPrevios?: unknown
}): ItemParaSugerirSat {
  const descripcion = typeof item.descripcion === "string" ? item.descripcion : ""
  const proveedor = typeof item.proveedor === "string" ? item.proveedor : undefined
  const terminosPrevios =
    typeof item.terminosPrevios === "string"
      ? item.terminosPrevios.slice(0, 1000)
      : undefined

  return {
    descripcion,
    ...(proveedor !== undefined ? { proveedor } : {}),
    ...(terminosPrevios ? { terminosPrevios } : {}),
  }
}

export function normalizarHistorialEntradasSat(valor: unknown): HistorialEntradaSat[] {
  if (!Array.isArray(valor)) return []

  return valor.flatMap((entrada) => {
    if (!entrada || typeof entrada !== "object") return []
    const record = entrada as Record<string, unknown>
    const descripcion = typeof record.descripcion === "string" ? record.descripcion.trim() : ""
    const clave =
      typeof record.claveProdServ === "string" || typeof record.claveProdServ === "number"
        ? normalizarClaveProdServ(String(record.claveProdServ))
        : null

    return descripcion && clave ? [{ descripcion, claveProdServ: clave }] : []
  })
}
