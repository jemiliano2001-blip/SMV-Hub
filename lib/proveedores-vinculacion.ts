/**
 * Cliente de la vinculación histórica de proveedores.
 *
 * La lectura y escritura masiva viven en una Route Handler: así no quedan
 * expuestas como operaciones directas de Firestore desde el navegador.
 */

import { getClienteAuth } from "@/lib/firebase"
import type { ResultadoBackfill } from "@/lib/proveedores-vinculacion-core"

export {
  analizarVinculacionHistoricaEnMemoria,
  detectarFantasmasEnMemoria,
  type DocumentoProveedorHistorico,
  type ProveedorFantasma,
  type ResultadoBackfill,
} from "@/lib/proveedores-vinculacion-core"

export interface PrevisualizacionVinculacion {
  ordenes: ResultadoBackfill
  cotizaciones: ResultadoBackfill
  fantasmas: import("@/lib/proveedores-vinculacion-core").ProveedorFantasma[]
}

export interface ResultadoAplicacionVinculacion {
  ordenes: ResultadoBackfill
  cotizaciones: ResultadoBackfill
}

type SolicitudVinculacion =
  | { accion: "analizar" }
  | { accion: "aplicarAutomaticas" }
  | {
      accion: "vincularManual"
      coleccion: "ordenes" | "cotizaciones"
      idsDocs: string[]
      proveedorId: string
    }

async function solicitarVinculacion<T>(payload: SolicitudVinculacion): Promise<T> {
  const usuario = getClienteAuth().currentUser
  if (!usuario) throw new Error("Inicia sesión para administrar el histórico de proveedores.")

  const token = await usuario.getIdToken()
  const respuesta = await fetch("/api/proveedores/vinculacion", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const body = (await respuesta.json().catch(() => ({}))) as { error?: string } & T
  if (!respuesta.ok) throw new Error(body.error || "No se pudo procesar la vinculación histórica.")
  return body
}

export async function previsualizarVinculacionHistorica(): Promise<PrevisualizacionVinculacion> {
  return solicitarVinculacion<PrevisualizacionVinculacion>({ accion: "analizar" })
}

export async function aplicarVinculacionesAutomaticas(): Promise<ResultadoAplicacionVinculacion> {
  return solicitarVinculacion<ResultadoAplicacionVinculacion>({ accion: "aplicarAutomaticas" })
}

export async function vincularProveedorManual(
  coleccion: "ordenes" | "cotizaciones",
  idsDocs: string[],
  proveedorId: string
): Promise<void> {
  await solicitarVinculacion<{ ok: true }>({
    accion: "vincularManual",
    coleccion,
    idsDocs,
    proveedorId,
  })
}
