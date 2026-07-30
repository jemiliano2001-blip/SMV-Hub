import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Cotizacion } from "@/lib/schemas"
import { makeDateConverter, crearLote, eliminarLote, actualizarDocumento } from "@/lib/firestore-helpers"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"
import { generarLlavePieza } from "@/lib/pieza-matching"

const cotizacionConverter = makeDateConverter<Cotizacion>()
const cotizacionesRef = () =>
  collection(db, "cotizaciones").withConverter(cotizacionConverter)

// ── CRUD ──────────────────────────────────────────────────────────────────────

// Datos de una cotización antes de guardarse (sin id ni marcas de tiempo, que
// asigna Firestore / esta capa). Listo para la captura manual de la Fase 2.
export type NuevaCotizacionPayload = Omit<Cotizacion, "id" | "creadoEn" | "actualizadoEn">

export async function crearCotizacion(payload: NuevaCotizacionPayload): Promise<string> {
  const ahora = new Date()
  const llavePieza =
    payload.llavePieza || generarLlavePieza(payload.numeroParte, payload.descripcion)
  const ref = await addDoc(cotizacionesRef(), {
    ...payload,
    llavePieza,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as Cotizacion)
  
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'CREAR', 'cotizaciones', ref.id, `Creó cotización de ${payload.proveedor}`)
  
  return ref.id
}

// Inserta muchas cotizaciones con writeBatch (atómico por lote, ≤500 escrituras).
// Reutilizado por la importación masiva del Google Sheet.
export async function crearCotizacionesLote(
  payloads: NuevaCotizacionPayload[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  const conLlave = payloads.map((p) => ({
    ...p,
    llavePieza: p.llavePieza || generarLlavePieza(p.numeroParte, p.descripcion),
  }))
  const result = await crearLote(cotizacionesRef, conLlave as Record<string, unknown>[], onProgreso)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'CREAR', 'cotizaciones', 'LOTE', `Creó ${payloads.length} cotizaciones`)
  return result
}

// Ordena por fecha de cotización descendente; las que no tienen fecha caen al
// final (Firestore coloca null antes, por eso se reordena en memoria).
export async function listarCotizaciones(): Promise<Cotizacion[]> {
  const snap = await getDocs(query(cotizacionesRef(), orderBy("creadoEn", "desc")))
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
}

export type CursorCotizaciones = QueryDocumentSnapshot<Cotizacion>

export interface PaginaCotizaciones {
  items: Cotizacion[]
  siguienteCursor: CursorCotizaciones | null
  hayMas: boolean
}

function normalizarTamanoPaginaCotizaciones(tamano: number): number {
  if (!Number.isFinite(tamano)) return 50
  return Math.min(100, Math.max(1, Math.trunc(tamano)))
}

export async function obtenerPaginaCotizaciones(
  tamano = 50,
  cursor?: CursorCotizaciones | null
): Promise<PaginaCotizaciones> {
  const tamanoSeguro = normalizarTamanoPaginaCotizaciones(tamano)
  const restricciones: QueryConstraint[] = [orderBy("creadoEn", "desc")]
  if (cursor) restricciones.push(startAfter(cursor))
  restricciones.push(limit(tamanoSeguro + 1))

  const snapshot = await getDocs(query(cotizacionesRef(), ...restricciones))
  const hayMas = snapshot.docs.length > tamanoSeguro
  const documentos = snapshot.docs.slice(0, tamanoSeguro)

  return {
    items: documentos.map((documento) => documento.data()),
    siguienteCursor: hayMas ? documentos.at(-1) ?? null : null,
    hayMas,
  }
}

export async function obtenerCotizacion(id: string): Promise<Cotizacion | null> {
  const snap = await getDoc(doc(db, "cotizaciones", id).withConverter(cotizacionConverter))
  return snap.exists() ? snap.data() : null
}

export async function actualizarCotizacion(
  id: string,
  cambios: Partial<Omit<Cotizacion, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("cotizaciones", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'EDITAR', 'cotizaciones', id, `Actualizó cotización: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarCotizacion(id: string): Promise<void> {
  await deleteDoc(doc(db, "cotizaciones", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'BORRAR', 'cotizaciones', id, `Eliminó cotización`)
}

export async function eliminarCotizacionesLote(ids: string[]): Promise<number> {
  const result = await eliminarLote("cotizaciones", ids)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'BORRAR', 'cotizaciones', 'LOTE', `Eliminó ${ids.length} cotizaciones`)
  return result
}

// Clave de deduplicación para re-importaciones del Sheet: una cotización se
// considera la misma si coinciden fecha + proveedor + descripción + no. de parte.
export function claveDedupCotizacion(c: {
  fecha: string | null
  proveedor: string
  descripcion: string
  numeroParte: string | null
}): string {
  return [c.fecha ?? "", c.proveedor, c.descripcion, c.numeroParte ?? ""]
    .map((s) => s.trim().toLowerCase())
    .join("|")
}

// Devuelve las claves de dedup de todas las cotizaciones ya guardadas, para que
// el preview de importación marque duplicados sin recargar toda la colección por fila.
export async function clavesExistentes(): Promise<Set<string>> {
  const snap = await getDocs(cotizacionesRef())
  return new Set(snap.docs.map((d) => claveDedupCotizacion(d.data())))
}
