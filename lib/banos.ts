import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { RegistroBano } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"

const banoConverter = makeDateConverter<RegistroBano>()
const banosRef = () => collection(db, "registros-bano").withConverter(banoConverter)

export type NuevoRegistroBanoPayload = Omit<RegistroBano, "id" | "creadoEn" | "actualizadoEn">

export async function listarRegistrosBano(mes?: string): Promise<RegistroBano[]> {
  let q = query(banosRef(), orderBy("fecha", "desc"), orderBy("horaEntrada", "desc"))
  
  if (mes) {
    // mes format: "YYYY-MM"
    const start = `${mes}-01`
    const end = `${mes}-31`
    q = query(
      banosRef(),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
      orderBy("fecha", "desc"),
      orderBy("horaEntrada", "desc")
    )
  }
  
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export function suscribirRegistrosBano(
  onData: (registros: RegistroBano[]) => void,
  mes?: string,
  onError?: (err: Error) => void
): () => void {
  let q = query(banosRef(), orderBy("fecha", "desc"), orderBy("horaEntrada", "desc"))
  
  if (mes) {
    const start = `${mes}-01`
    const end = `${mes}-31`
    q = query(
      banosRef(),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
      orderBy("fecha", "desc"),
      orderBy("horaEntrada", "desc")
    )
  }

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data()))
    },
    (err) => {
      console.error("Error en suscripción a registros-bano:", err)
      onError?.(err)
    }
  )
}

export async function crearRegistroBano(payload: NuevoRegistroBanoPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(banosRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as RegistroBano)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "registros-bano", ref.id, `Registró baño de ${payload.operador} (${payload.bano})`)
  return ref.id
}

export async function actualizarRegistroBano(
  id: string,
  cambios: Partial<Omit<RegistroBano, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("registros-bano", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "registros-bano", id, `Actualizó registro de baño: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarRegistroBano(id: string): Promise<void> {
  await deleteDoc(doc(db, "registros-bano", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "registros-bano", id, "Eliminó registro de baño")
}
