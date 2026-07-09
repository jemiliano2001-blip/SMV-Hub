import type { EstatusOrdenServicio, OrdenServicio } from "@/lib/schemas"
import { EstatusOrdenServicioSchema } from "@/lib/schemas"

/** Valores de estatus en orden de aparición en filtros y selects. */
export const ESTATUS_ORDEN_SERVICIO: EstatusOrdenServicio[] = [
  "pendiente",
  "en_proceso",
  "detenida",
  "entregada",
  "cancelado",
]

export const ESTATUS_LABEL: Record<EstatusOrdenServicio, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  detenida: "Detenida",
  entregada: "Entregada",
  cancelado: "Cancelado",
}

export const ESTATUS_BADGE: Record<EstatusOrdenServicio, string> = {
  pendiente: "bg-gray-100 text-gray-700 ring-gray-600/20",
  en_proceso: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
  detenida: "bg-red-50 text-red-700 ring-red-600/20",
  entregada: "bg-green-50 text-green-700 ring-green-600/20",
  cancelado: "bg-gray-100 text-gray-500 ring-gray-400/20",
}

/** Mapea `recibido` (legacy) → `entregada`. */
export function normalizarEstatusOrdenServicio(estatus: string): EstatusOrdenServicio {
  if (estatus === "recibido") return "entregada"
  const parsed = EstatusOrdenServicioSchema.safeParse(estatus)
  return parsed.success ? parsed.data : "pendiente"
}

/** Extrae el primer entero de un texto de cantidad (`"12"`, `"1 pza"` → 12). */
export function parseCantidadNumerica(cantidad: string | null | undefined): number | null {
  if (!cantidad?.trim()) return null
  const match = cantidad.trim().match(/\d+/)
  if (!match) return null
  const n = Number.parseInt(match[0], 10)
  return Number.isFinite(n) ? n : null
}

/** Calcula pendiente = total − entregada cuando ambos son conocidos. */
export function calcularCantidadPendiente(
  cantidad: string | null | undefined,
  cantidadEntregada: number | null | undefined
): number | null {
  const total = parseCantidadNumerica(cantidad)
  if (total === null || cantidadEntregada === null || cantidadEntregada === undefined) {
    return null
  }
  return Math.max(0, total - cantidadEntregada)
}

/** Aplica defaults y normaliza estatus al leer de Firestore. */
export function normalizarOrdenServicioDesdeFirestore(
  raw: Omit<OrdenServicio, "estatus"> & { estatus: string }
): OrdenServicio {
  return {
    ...raw,
    estatus: normalizarEstatusOrdenServicio(raw.estatus),
    cantidadEntregada: raw.cantidadEntregada ?? null,
    cantidadPendiente: raw.cantidadPendiente ?? null,
    fechaEntregaActualizada: raw.fechaEntregaActualizada ?? null,
    nota: raw.nota ?? null,
  }
}

export function truncarNota(nota: string | null | undefined, max = 60): string {
  if (!nota?.trim()) return ""
  const t = nota.trim().replace(/\s+/g, " ")
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export function formatearCantidadEntrega(orden: OrdenServicio): string {
  const { cantidad, cantidadEntregada, cantidadPendiente } = orden
  if (cantidadEntregada !== null && cantidadEntregada !== undefined) {
    const pend = cantidadPendiente ?? calcularCantidadPendiente(cantidad, cantidadEntregada)
    if (pend !== null) {
      return `${cantidadEntregada}/${parseCantidadNumerica(cantidad) ?? "?"} (↓${pend})`
    }
    return String(cantidadEntregada)
  }
  return cantidad ?? "-"
}
