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

export type ColeccionVinculable = "ordenes" | "cotizaciones"

export interface OpcionesVinculoManual {
  /** Nombre crudo con el que venían los documentos; con `guardarAlias` se agrega al proveedor. */
  nombreLibre?: string
  guardarAlias?: boolean
}

export interface AltaYVinculoPayload {
  coleccion: ColeccionVinculable
  idsDocs: string[]
  nombre: string
  mercado: "usa" | "mexico"
  esMarketplace?: boolean
  nombreLibre?: string
}

type SolicitudVinculacion =
  | { accion: "analizar" }
  | { accion: "aplicarAutomaticas" }
  | ({
      accion: "vincularManual"
      coleccion: ColeccionVinculable
      idsDocs: string[]
      proveedorId: string
    } & OpcionesVinculoManual)
  | ({ accion: "altaYVincular" } & AltaYVinculoPayload)

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
  coleccion: ColeccionVinculable,
  idsDocs: string[],
  proveedorId: string,
  opciones: OpcionesVinculoManual = {}
): Promise<{ aliasAprendido: boolean }> {
  const respuesta = await solicitarVinculacion<{ ok: true; aliasAprendido?: boolean }>({
    accion: "vincularManual",
    coleccion,
    idsDocs,
    proveedorId,
    ...opciones,
  })
  return { aliasAprendido: respuesta.aliasAprendido === true }
}

/**
 * Da de alta un proveedor mínimo desde un fantasma y vincula sus documentos en un solo paso.
 * Si ya existe uno con ese nombre o alias, la ruta responde 409 y hay que vincular al existente.
 */
export async function darDeAltaYVincular(payload: AltaYVinculoPayload): Promise<{ proveedorId: string }> {
  const respuesta = await solicitarVinculacion<{ ok: true; proveedorId: string }>({
    accion: "altaYVincular",
    ...payload,
  })
  return { proveedorId: respuesta.proveedorId }
}
