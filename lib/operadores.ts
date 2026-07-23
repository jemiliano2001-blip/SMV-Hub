import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { Operador } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"

const operadorConverter = makeDateConverter<Operador>()
const operadoresRef = () =>
  collection(db, "operadores").withConverter(operadorConverter)

export type NuevoOperadorPayload = Omit<Operador, "id" | "creadoEn" | "actualizadoEn">

export async function listarOperadores(): Promise<Operador[]> {
  const snap = await getDocs(query(operadoresRef(), orderBy("nombre", "asc")))
  return snap.docs.map((d) => d.data())
}

export async function crearOperador(payload: NuevoOperadorPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(operadoresRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as Operador)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "operadores", ref.id, `Creó operador: ${payload.nombre} (${payload.area})`)

  return ref.id
}

export async function actualizarOperador(
  id: string,
  cambios: Partial<Omit<Operador, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("operadores", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "operadores", id, `Actualizó operador: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarOperador(id: string): Promise<void> {
  await deleteDoc(doc(db, "operadores", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "operadores", id, "Eliminó operador")
}
