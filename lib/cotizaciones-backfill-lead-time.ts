/**
 * Cliente del backfill de lead time de cotizaciones (Route Handler super-admin).
 * Mismo patrón que `lib/proveedores-backfill-mercado.ts`.
 */

import { getClienteAuth } from "@/lib/firebase"
import type { PlanBackfillLeadTime } from "@/lib/lead-time"

export type { CambioLeadTime, PlanBackfillLeadTime } from "@/lib/lead-time"

export interface ResultadoBackfillLeadTime {
  aplicados: number
  parseadas: number
  nulas: number
  yaCorrectos: number
}

async function solicitar<T>(accion: "previsualizar" | "aplicar"): Promise<T> {
  const usuario = getClienteAuth().currentUser
  if (!usuario) throw new Error("Inicia sesión para administrar cotizaciones.")
  const token = await usuario.getIdToken()
  const respuesta = await fetch("/api/cotizaciones/backfill-lead-time", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ accion }),
  })
  const body = (await respuesta.json().catch(() => ({}))) as { error?: string } & T
  if (!respuesta.ok) throw new Error(body.error || "No se pudo procesar el backfill de lead time.")
  return body
}

export function previsualizarBackfillLeadTime(): Promise<PlanBackfillLeadTime> {
  return solicitar<PlanBackfillLeadTime>("previsualizar")
}

export function aplicarBackfillLeadTime(): Promise<ResultadoBackfillLeadTime> {
  return solicitar<ResultadoBackfillLeadTime>("aplicar")
}
