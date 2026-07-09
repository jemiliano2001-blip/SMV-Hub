import type { PrioridadRequisicion, Requisicion } from "@/lib/schemas"

/** Resultado del semáforo: null = sin semáforo (ya comprada, sin prioridad, o dato inválido). */
export type EstadoAtraso =
  | { tipo: "a_tiempo" | "por_vencer" | "atrasada"; dias: number }
  | null

const LIMITE_DIAS: Record<PrioridadRequisicion, number | null> = {
  "1-2 dias": 2,
  "3-5 dias": 5,
  "7-14 dias": 14,
  "cuando se pueda": null,
}

const MS_DIA = 86_400_000

function parseUTC(fecha: string): number | null {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(t) ? null : t
}

/** Semáforo por prioridad (tab Compras generales). */
export function estadoAtraso(
  r: Pick<Requisicion, "estado" | "prioridad" | "fechaPedido">,
  hoy: string
): EstadoAtraso {
  if (r.estado === "comprado" || r.estado === "recibido") return null
  if (!r.prioridad) return null
  const limite = LIMITE_DIAS[r.prioridad]
  if (limite === null) return null
  const pedido = parseUTC(r.fechaPedido)
  const hoyMs = parseUTC(hoy)
  if (pedido === null || hoyMs === null) return null
  const dias = Math.round((pedido + limite * MS_DIA - hoyMs) / MS_DIA)
  if (dias > 0) return { tipo: "a_tiempo", dias }
  if (dias === 0) return { tipo: "por_vencer", dias: 0 }
  return { tipo: "atrasada", dias: -dias }
}

/** Semáforo por fecha de entrega estimada (tab Automatización). */
export function estadoAtrasoEntrega(
  r: Pick<Requisicion, "estado" | "fechaEntregaEst">,
  hoy: string
): EstadoAtraso {
  if (r.estado === "comprado" || r.estado === "recibido") return null
  if (!r.fechaEntregaEst) return null
  const entrega = parseUTC(r.fechaEntregaEst)
  const hoyMs = parseUTC(hoy)
  if (entrega === null || hoyMs === null) return null
  const dias = Math.round((entrega - hoyMs) / MS_DIA)
  if (dias > 0) return { tipo: "a_tiempo", dias }
  if (dias === 0) return { tipo: "por_vencer", dias: 0 }
  return { tipo: "atrasada", dias: -dias }
}

/** Fecha local del cliente como YYYY-MM-DD. */
export function hoyLocal(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function textoAtraso(a: NonNullable<EstadoAtraso>): string {
  if (a.tipo === "por_vencer") return "vence hoy"
  const unidad = a.dias === 1 ? "día" : "días"
  return a.tipo === "a_tiempo" ? `${a.dias} ${unidad}` : `+${a.dias} ${unidad}`
}

export const ATRASO_BADGE: Record<"a_tiempo" | "por_vencer" | "atrasada", string> = {
  a_tiempo: "bg-green-50 text-green-700",
  por_vencer: "bg-yellow-50 text-yellow-800",
  atrasada: "bg-red-50 text-red-700",
}
