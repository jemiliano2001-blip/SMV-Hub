import {
  query,
  orderBy,
  where,
  onSnapshot,
} from "firebase/firestore"
import { getClienteAuth } from "@/lib/firebase"
import type { RegistroBano, SolicitudBorradoBano } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"
import { registrarAuditoria } from "@/lib/auditoria"

const repo = crearRepositorio<RegistroBano>({ coleccion: "registros-bano" })

const repoSolicitudes = crearRepositorio<SolicitudBorradoBano>({
  coleccion: "solicitudes_borrado_banos",
})

export type NuevoRegistroBanoPayload = Omit<RegistroBano, "id" | "creadoEn" | "actualizadoEn">

export async function listarRegistrosBano(mes?: string): Promise<RegistroBano[]> {
  if (mes) {
    const start = `${mes}-01`
    const end = `${mes}-31`
    return repo.listar([
      where("fecha", ">=", start),
      where("fecha", "<=", end),
      orderBy("fecha", "desc"),
      orderBy("horaEntrada", "desc"),
    ])
  }
  return repo.listar([orderBy("fecha", "desc"), orderBy("horaEntrada", "desc")])
}

export function suscribirRegistrosBano(
  onData: (registros: RegistroBano[]) => void,
  mes?: string,
  onError?: (err: Error) => void
): () => void {
  let q = query(repo.ref(), orderBy("fecha", "desc"), orderBy("horaEntrada", "desc"))

  if (mes) {
    const start = `${mes}-01`
    const end = `${mes}-31`
    q = query(
      repo.ref(),
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
  const user = getClienteAuth().currentUser
  // crearRegistroBano enriches with creadoPorUid/Nombre, so we use repo.crear
  // with the enriched payload
  const enrichedPayload = {
    ...payload,
    creadoPorUid: user?.uid,
    creadoPorNombre: user?.displayName || user?.email || undefined,
  }
  const id = await repo.crear(
    enrichedPayload,
    `Registró baño de ${payload.operador} (${payload.bano})`
  )
  return id
}

export async function actualizarRegistroBano(
  id: string,
  cambios: Partial<Omit<RegistroBano, "id" | "creadoEn">>
): Promise<void> {
  await repo.actualizar(id, cambios, `Actualizó registro de baño: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarRegistroBano(id: string): Promise<void> {
  await repo.eliminar(id, "Eliminó registro de baño")
}

/**
 * Solo super admin la usa (para pintar los botones Aprobar/Rechazar en
 * /notificaciones); ver firestore.rules — el resto de usuarios no tiene
 * permiso de lectura sobre esta colección.
 */
export function suscribirSolicitudesBorradoBanosPendientes(
  onData: (solicitudes: SolicitudBorradoBano[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(repoSolicitudes.ref(), where("estado", "==", "pendiente"))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data())),
    (err) => {
      console.error("Error en suscripción a solicitudes_borrado_banos:", err)
      onError?.(err)
    }
  )
}
