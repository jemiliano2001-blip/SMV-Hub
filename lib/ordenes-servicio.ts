import {
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type FirestoreDataConverter,
} from "firebase/firestore"
import type { OrdenServicio } from "@/lib/schemas"
import { makeDateConverter } from "@/lib/firestore-helpers"
import { normalizarOrdenServicioDesdeFirestore } from "@/lib/ordenes-servicio-helpers"
import { crearRepositorio } from "@/lib/repositorio"

const baseConverter = makeDateConverter<OrdenServicio>()
const ordenServicioConverter: FirestoreDataConverter<OrdenServicio> = {
  toFirestore: baseConverter.toFirestore,
  fromFirestore(snap) {
    const raw = baseConverter.fromFirestore(snap)
    return normalizarOrdenServicioDesdeFirestore(raw)
  },
}

const repo = crearRepositorio<OrdenServicio>({
  coleccion: "ordenes-servicio",
  converter: ordenServicioConverter,
})

export type NuevaOrdenServicioPayload = Omit<OrdenServicio, "id" | "creadoEn" | "actualizadoEn">

export async function listarOrdenesServicio(): Promise<OrdenServicio[]> {
  return repo.listar([orderBy("creadoEn", "desc")])
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

  const snapshot = await getDocs(query(repo.ref(), ...restricciones))
  const hayMas = snapshot.docs.length > tamanoSeguro
  const documentos = snapshot.docs.slice(0, tamanoSeguro)

  return {
    items: documentos.map((d) => d.data()),
    siguienteCursor: hayMas ? documentos.at(-1) ?? null : null,
    hayMas,
  }
}

export async function contarOrdenesServicio(): Promise<number> {
  return repo.contar()
}

export async function crearOrdenServicio(payload: NuevaOrdenServicioPayload): Promise<string> {
  return repo.crear(
    payload,
    `Creó orden de servicio para ${payload.requisitor || "requisitor sin nombre"}`
  )
}

export async function actualizarOrdenServicio(
  id: string,
  cambios: Partial<Omit<OrdenServicio, "id" | "creadoEn">>
): Promise<void> {
  await repo.actualizar(id, cambios, `Actualizó orden de servicio: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarOrdenServicio(id: string): Promise<void> {
  await repo.eliminar(id, "Eliminó orden de servicio")
}

export async function eliminarOrdenesServicioLote(ids: string[]): Promise<number> {
  return repo.eliminarEnLote(ids, `Eliminó ${ids.length} órdenes de servicio`)
}
