import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { OrdenServicio } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento, eliminarLote } from "@/lib/firestore-helpers"
import { normalizarOrdenServicioDesdeFirestore } from "@/lib/ordenes-servicio-helpers"
import type { FirestoreDataConverter, QueryDocumentSnapshot, QueryConstraint } from "firebase/firestore"
import { registrarAuditoria } from "@/lib/auditoria"

const baseConverter = makeDateConverter<OrdenServicio>()
const ordenServicioConverter: FirestoreDataConverter<OrdenServicio> = {
  toFirestore: baseConverter.toFirestore,
  fromFirestore(snap: QueryDocumentSnapshot) {
    const raw = baseConverter.fromFirestore(snap)
    return normalizarOrdenServicioDesdeFirestore(raw)
  },
}
const ordenesServicioRef = () =>
  collection(db, "ordenes-servicio").withConverter(ordenServicioConverter)

export type NuevaOrdenServicioPayload = Omit<OrdenServicio, "id" | "creadoEn" | "actualizadoEn">

export async function listarOrdenesServicio(): Promise<OrdenServicio[]> {
  const snap = await getDocs(query(ordenesServicioRef(), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
}

export type CursorOrdenesServicio = QueryDocumentSnapshot<OrdenServicio>

export interface PaginaOrdenesServicio {
  items: OrdenServicio[]
  siguienteCursor: CursorOrdenesServicio | null
  hayMas: boolean
}

function normalizarTamanoPagina(tamano: number): number {
  if (!Number.isFinite(tamano)) return 50
  return Math.min(100, Math.max(1, Math.trunc(tamano)))
}

export async function obtenerPaginaOrdenesServicio(
  tamano = 50,
  cursor?: CursorOrdenesServicio | null
): Promise<PaginaOrdenesServicio> {
  const tamanoSeguro = normalizarTamanoPagina(tamano)
  const restricciones: QueryConstraint[] = [orderBy("creadoEn", "desc")]
  if (cursor) restricciones.push(startAfter(cursor))
  restricciones.push(limit(tamanoSeguro + 1))

  const snapshot = await getDocs(query(ordenesServicioRef(), ...restricciones))
  const hayMas = snapshot.docs.length > tamanoSeguro
  const documentos = snapshot.docs.slice(0, tamanoSeguro)

  return {
    items: documentos.map((d) => d.data()),
    siguienteCursor: hayMas ? documentos.at(-1) ?? null : null,
    hayMas,
  }
}

export async function contarOrdenesServicio(): Promise<number> {
  const snapshot = await getCountFromServer(ordenesServicioRef())
  return snapshot.data().count
}

export async function crearOrdenServicio(payload: NuevaOrdenServicioPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(ordenesServicioRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as OrdenServicio)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "ordenes-servicio", ref.id, `Creó orden de servicio para ${payload.requisitor || "requisitor sin nombre"}`)

  return ref.id
}

export async function actualizarOrdenServicio(
  id: string,
  cambios: Partial<Omit<OrdenServicio, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("ordenes-servicio", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "ordenes-servicio", id, `Actualizó orden de servicio: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarOrdenServicio(id: string): Promise<void> {
  await deleteDoc(doc(db, "ordenes-servicio", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "ordenes-servicio", id, "Eliminó orden de servicio")
}

export async function eliminarOrdenesServicioLote(ids: string[]): Promise<number> {
  const res = await eliminarLote("ordenes-servicio", ids)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "ordenes-servicio", "LOTE", `Eliminó ${ids.length} órdenes de servicio`)
  return res
}
