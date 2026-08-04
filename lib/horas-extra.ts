import {
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
  type Unsubscribe,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { HorasExtra, Departamento } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"
import { registrarAuditoria } from "@/lib/auditoria"

const repo = crearRepositorio<HorasExtra>({ coleccion: "horas-extra" })

export type NuevaHorasExtraPayload = Omit<HorasExtra, "id" | "creadoEn" | "actualizadoEn">

export async function listarHorasExtra(
  semanaInicio: string,
  departamento: Departamento
): Promise<HorasExtra[]> {
  return repo.listar([
    where("semanaInicio", "==", semanaInicio),
    where("departamento", "==", departamento),
  ])
}

export async function listarHorasExtraRango(
  mes: string,
  departamento: Departamento
): Promise<HorasExtra[]> {
  const inicio = `${mes}-01`
  const fin = `${mes}-31`
  return repo.listar([
    where("departamento", "==", departamento),
    where("semanaInicio", ">=", inicio),
    where("semanaInicio", "<=", fin),
  ])
}

export function suscribirHorasExtra(
  semanaInicio: string,
  departamento: Departamento,
  onData: (registros: HorasExtra[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    repo.ref(),
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
  return repo.crear(
    payload,
    `Registró horas extra para ${payload.empleado} (${payload.departamento})`
  )
}

export async function crearHorasExtraLote(
  payloads: NuevaHorasExtraPayload[]
): Promise<void> {
  if (payloads.length === 0) return
  const ahora = new Date()
  const batch = writeBatch(db)
  for (const payload of payloads) {
    const ref = doc(repo.ref())
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
  await repo.actualizar(id, cambios, `Actualizó horas extra: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarHorasExtra(id: string): Promise<void> {
  await repo.eliminar(id, "Eliminó horas extra")
}
