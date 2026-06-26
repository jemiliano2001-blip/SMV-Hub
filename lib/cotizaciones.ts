import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Cotizacion } from "@/lib/schemas"
import { makeDateConverter, crearLote, eliminarLote, actualizarDocumento } from "@/lib/firestore-helpers"

const cotizacionConverter = makeDateConverter<Cotizacion>()
const cotizacionesRef = () =>
  collection(db, "cotizaciones").withConverter(cotizacionConverter)

// ── CRUD ──────────────────────────────────────────────────────────────────────

// Datos de una cotización antes de guardarse (sin id ni marcas de tiempo, que
// asigna Firestore / esta capa). Listo para la captura manual de la Fase 2.
export type NuevaCotizacionPayload = Omit<Cotizacion, "id" | "creadoEn" | "actualizadoEn">

export async function crearCotizacion(payload: NuevaCotizacionPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(cotizacionesRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as Cotizacion)
  return ref.id
}

// Inserta muchas cotizaciones con writeBatch (atómico por lote, ≤500 escrituras).
// Reutilizado por la importación masiva del Google Sheet.
export async function crearCotizacionesLote(
  payloads: NuevaCotizacionPayload[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  return crearLote(cotizacionesRef, payloads as Record<string, unknown>[], onProgreso)
}

// Ordena por fecha de cotización descendente; las que no tienen fecha caen al
// final (Firestore coloca null antes, por eso se reordena en memoria).
export async function listarCotizaciones(): Promise<Cotizacion[]> {
  const snap = await getDocs(query(cotizacionesRef(), orderBy("creadoEn", "desc")))
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
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
}

export async function eliminarCotizacion(id: string): Promise<void> {
  await deleteDoc(doc(db, "cotizaciones", id))
}

export async function eliminarCotizacionesLote(ids: string[]): Promise<number> {
  return eliminarLote("cotizaciones", ids)
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
