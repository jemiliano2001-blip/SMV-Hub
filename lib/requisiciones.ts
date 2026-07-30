import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Requisicion } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento, eliminarLote } from "@/lib/firestore-helpers"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"
import { emitirNotificacion, tituloParaTipo } from "@/lib/notificaciones"

const requisicionConverter = makeDateConverter<Requisicion>()
const requisicionesRef = () =>
  collection(db, "requisiciones").withConverter(requisicionConverter)

function actorNotificacion(): { uid: string; nombre: string } {
  const user = getClienteAuth().currentUser
  return {
    uid: user?.uid ?? "",
    nombre: user?.displayName || user?.email || "Usuario",
  }
}

export type NuevaRequisicionPayload = Omit<Requisicion, "id" | "creadoEn" | "actualizadoEn">

export async function listarRequisiciones(): Promise<Requisicion[]> {
  const snap = await getDocs(query(requisicionesRef(), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
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

  const snapshot = await getDocs(query(requisicionesRef(), ...restricciones))
  const hayMas = snapshot.docs.length > tamanoSeguro
  const documentos = snapshot.docs.slice(0, tamanoSeguro)

  return {
    items: documentos.map((documento) => documento.data()),
    siguienteCursor: hayMas ? documentos.at(-1) ?? null : null,
    hayMas,
  }
}

export async function contarRequisiciones(): Promise<number> {
  const snapshot = await getCountFromServer(requisicionesRef())
  return snapshot.data().count
}

export async function crearRequisicion(payload: NuevaRequisicionPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(requisicionesRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as Requisicion)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "CREAR",
    "requisiciones",
    ref.id,
    `Creó requisición para ${payload.tienda || "proveedor no especificado"}`
  )

  const actor = actorNotificacion()
  const resumen = payload.descripcion || payload.tienda || "Sin descripción"
  await emitirNotificacion({
    tipo: "requisicion_creada",
    titulo: tituloParaTipo("requisicion_creada"),
    cuerpo: resumen,
    origenModulo: "requisiciones",
    origenId: ref.id,
    href: "/requisiciones",
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })

  return ref.id
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

  await actualizarDocumento("requisiciones", id, cambios as Record<string, unknown>)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    "requisiciones",
    id,
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
      href: "/requisiciones",
      creadoPorUid: actor.uid,
      creadoPorNombre: actor.nombre,
    })
  }
}

export async function eliminarRequisicion(id: string): Promise<void> {
  await deleteDoc(doc(db, "requisiciones", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "requisiciones", id, `Eliminó requisición`)
}

export async function eliminarRequisicionesLote(ids: string[]): Promise<number> {
  const result = await eliminarLote("requisiciones", ids)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "BORRAR",
    "requisiciones",
    "LOTE",
    `Eliminó ${ids.length} requisiciones`
  )
  return result
}
