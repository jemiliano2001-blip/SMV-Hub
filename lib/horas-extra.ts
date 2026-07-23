import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { HorasExtra, Departamento } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"

const horasExtraConverter = makeDateConverter<HorasExtra>()
const horasExtraRef = () => collection(db, "horas-extra").withConverter(horasExtraConverter)

export type NuevaHorasExtraPayload = Omit<HorasExtra, "id" | "creadoEn" | "actualizadoEn">

export async function listarHorasExtra(
  semanaInicio: string,
  departamento: Departamento
): Promise<HorasExtra[]> {
  const q = query(
    horasExtraRef(),
    where("semanaInicio", "==", semanaInicio),
    where("departamento", "==", departamento)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export async function listarHorasExtraRango(
  mes: string,
  departamento: Departamento
): Promise<HorasExtra[]> {
  const inicio = `${mes}-01`
  const fin = `${mes}-31`
  const q = query(
    horasExtraRef(),
    where("departamento", "==", departamento),
    where("semanaInicio", ">=", inicio),
    where("semanaInicio", "<=", fin)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export function suscribirHorasExtra(
  semanaInicio: string,
  departamento: Departamento,
  onData: (registros: HorasExtra[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    horasExtraRef(),
    where("semanaInicio", "==", semanaInicio),
    where("departamento", "==", departamento)
  )
  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs.map((d) => d.data())
      data.sort((a, b) => a.empleado.localeCompare(b.empleado, "es"))
      onData(data)
    },
    (err) => onError(err)
  )
}

export async function crearHorasExtra(payload: NuevaHorasExtraPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(horasExtraRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as HorasExtra)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "horas-extra", ref.id, `Registró horas extra para ${payload.empleado} (${payload.departamento})`)

  return ref.id
}

export async function crearHorasExtraLote(
  payloads: NuevaHorasExtraPayload[]
): Promise<void> {
  if (payloads.length === 0) return
  const ahora = new Date()
  const batch = writeBatch(db)
  for (const payload of payloads) {
    const ref = doc(horasExtraRef())
    batch.set(ref, {
      ...payload,
      creadoEn: ahora,
      actualizadoEn: ahora,
    } as HorasExtra)
  }
  await batch.commit()

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "horas-extra", "LOTE", `Registró ${payloads.length} registros de horas extra`)
}

export async function actualizarHorasExtra(
  id: string,
  cambios: Partial<Omit<HorasExtra, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("horas-extra", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "horas-extra", id, `Actualizó horas extra: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarHorasExtra(id: string): Promise<void> {
  await deleteDoc(doc(db, "horas-extra", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "horas-extra", id, "Eliminó horas extra")
}
