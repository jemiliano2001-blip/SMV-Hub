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
import type { Operador } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"

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
  return ref.id
}

export async function actualizarOperador(
  id: string,
  cambios: Partial<Omit<Operador, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("operadores", id, cambios as Record<string, unknown>)
}

export async function eliminarOperador(id: string): Promise<void> {
  await deleteDoc(doc(db, "operadores", id))
}
