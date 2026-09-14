/**
 * Cliente del backfill de `mercado` / `origenProveedor` (Route Handler super-admin).
 * Mismo patrón que `lib/proveedores-vinculacion.ts`: la escritura masiva vive en el servidor.
 */

import { getClienteAuth } from "@/lib/firebase"
import type { PlanBackfillMercado } from "@/lib/proveedor-mercado"

export type { CambioMercadoProveedor, PlanBackfillMercado } from "@/lib/proveedor-mercado"

export interface ResultadoBackfillMercado {
  aplicados: number
  conMercado: number
  conOrigen: number
  sinCambio: number
}

async function solicitar<T>(accion: "previsualizar" | "aplicar"): Promise<T> {
  const usuario = getClienteAuth().currentUser
  if (!usuario) throw new Error("Inicia sesión para administrar el catálogo de proveedores.")
  const token = await usuario.getIdToken()
  const respuesta = await fetch("/api/proveedores/backfill-mercado", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ accion }),
  })
  const body = (await respuesta.json().catch(() => ({}))) as { error?: string } & T
  if (!respuesta.ok) throw new Error(body.error || "No se pudo procesar el backfill de mercado.")
  return body
}

export function previsualizarBackfillMercado(): Promise<PlanBackfillMercado> {
  return solicitar<PlanBackfillMercado>("previsualizar")
}

export function aplicarBackfillMercado(): Promise<ResultadoBackfillMercado> {
  return solicitar<ResultadoBackfillMercado>("aplicar")
}
