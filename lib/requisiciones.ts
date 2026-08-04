import {
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { Requisicion } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"
import { emitirNotificacion, tituloParaTipo } from "@/lib/notificaciones"
import { makeDateConverter } from "@/lib/firestore-helpers"

const requisicionConverter = makeDateConverter<Requisicion>()

const repo = crearRepositorio<Requisicion>({
  coleccion: "requisiciones",
  converter: requisicionConverter,
})

function actorNotificacion(): { uid: string; nombre: string } {
  const user = getClienteAuth().currentUser
  return {
    uid: user?.uid ?? "",
    nombre: user?.displayName || user?.email || "Usuario",
  }
}

export type NuevaRequisicionPayload = Omit<Requisicion, "id" | "creadoEn" | "actualizadoEn">

export async function listarRequisiciones(): Promise<Requisicion[]> {
  return repo.listar([orderBy("creadoEn", "desc")])
}

export type CursorRequisiciones = QueryDocumentSnapshot<Requisicion>

export interface PaginaRequisiciones {
  items: Requisicion[]
  siguienteCursor: CursorRequisiciones | null
  hayMas: boolean
}

function normalizarTamanoPagina(tamano: number): number {
  if (!Number.isFinite(tamano)) return 50
  return Math.min(100, Math.max(1, Math.trunc(tamano)))
}

export async function obtenerPaginaRequisiciones(
  tamano = 50,
  cursor?: CursorRequisiciones | null
): Promise<PaginaRequisiciones> {
  const tamanoSeguro = normalizarTamanoPagina(tamano)
  const restricciones: QueryConstraint[] = [orderBy("creadoEn", "desc")]
  if (cursor) restricciones.push(startAfter(cursor))
  restricciones.push(limit(tamanoSeguro + 1))

  const snapshot = await getDocs(query(repo.ref(), ...restricciones))
  const hayMas = snapshot.docs.length > tamanoSeguro
  const documentos = snapshot.docs.slice(0, tamanoSeguro)

  return {
    items: documentos.map((documento) => documento.data()),
    siguienteCursor: hayMas ? documentos.at(-1) ?? null : null,
    hayMas,
  }
}

export async function contarRequisiciones(): Promise<number> {
  return repo.contar()
}

export async function crearRequisicion(payload: NuevaRequisicionPayload): Promise<string> {
  const id = await repo.crear(
    payload,
    `Creó requisición para ${payload.tienda || "proveedor no especificado"}`
  )

  const actor = actorNotificacion()
  const resumen = payload.descripcion || payload.tienda || "Sin descripción"
  await emitirNotificacion({
    tipo: "requisicion_creada",
    titulo: tituloParaTipo("requisicion_creada"),
    cuerpo: resumen,
    origenModulo: "requisiciones",
    origenId: id,
    audiencia: "requisiciones",
    destinatarioUid: null,
    href: "/requisiciones",
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })

  return id
}

export async function actualizarRequisicion(
  id: string,
  cambios: Partial<Omit<Requisicion, "id" | "creadoEn">>
): Promise<void> {
  let estadoAnterior: string | undefined
  if (cambios.estado !== undefined) {
    const prev = await getDoc(doc(db, "requisiciones", id).withConverter(requisicionConverter))
    if (prev.exists()) estadoAnterior = prev.data().estado
  }

  await repo.actualizar(
    id,
    cambios,
    `Actualizó requisición: ${Object.keys(cambios).join(", ")}`
  )

  if (cambios.estado !== undefined && cambios.estado !== estadoAnterior) {
    const actor = actorNotificacion()
    const descSnap = await getDoc(doc(db, "requisiciones", id))
    const descripcion =
      descSnap.exists() && typeof descSnap.data()?.descripcion === "string"
        ? (descSnap.data()?.descripcion as string)
        : id
    await emitirNotificacion({
      tipo: "requisicion_estado",
      titulo: tituloParaTipo("requisicion_estado"),
      cuerpo: `«${descripcion}» ${estadoAnterior ?? "?"} → ${cambios.estado}`,
      origenModulo: "requisiciones",
      origenId: id,
      audiencia: "requisiciones",
      destinatarioUid: null,
      href: "/requisiciones",
      creadoPorUid: actor.uid,
      creadoPorNombre: actor.nombre,
    })
  }
}

export async function eliminarRequisicion(id: string): Promise<void> {
  await repo.eliminar(id, "Eliminó requisición")
}

export async function eliminarRequisicionesLote(ids: string[]): Promise<number> {
  return repo.eliminarEnLote(ids, `Eliminó ${ids.length} requisiciones`)
}
