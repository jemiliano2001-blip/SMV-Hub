import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Requisicion } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento, eliminarLote } from "@/lib/firestore-helpers"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"

const requisicionConverter = makeDateConverter<Requisicion>()
const requisicionesRef = () =>
  collection(db, "requisiciones").withConverter(requisicionConverter)

export type NuevaRequisicionPayload = Omit<Requisicion, "id" | "creadoEn" | "actualizadoEn">

export async function listarRequisiciones(): Promise<Requisicion[]> {
  const snap = await getDocs(query(requisicionesRef(), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
}

export async function crearRequisicion(payload: NuevaRequisicionPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(requisicionesRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as Requisicion)
  
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'CREAR', 'requisiciones', ref.id, `Creó requisición para ${payload.tienda || 'proveedor no especificado'}`)
  
  return ref.id
}

export async function actualizarRequisicion(
  id: string,
  cambios: Partial<Omit<Requisicion, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("requisiciones", id, cambios as Record<string, unknown>)
  
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'EDITAR', 'requisiciones', id, `Actualizó requisición: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarRequisicion(id: string): Promise<void> {
  await deleteDoc(doc(db, "requisiciones", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'BORRAR', 'requisiciones', id, `Eliminó requisición`)
}

export async function eliminarRequisicionesLote(ids: string[]): Promise<number> {
  const result = await eliminarLote("requisiciones", ids)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'BORRAR', 'requisiciones', 'LOTE', `Eliminó ${ids.length} requisiciones`)
  return result
}
