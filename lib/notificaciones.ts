import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  Timestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  Notificacion,
  NotificacionConLeida,
  NotificacionLeida,
  NuevaNotificacion,
  TipoNotificacion,
} from "@/lib/schemas"

const LIMITE_DEFAULT = 50

const notificacionConverter: FirestoreDataConverter<Notificacion> = {
  toFirestore(entity) {
    const { id: _id, creadoEn, actualizadoEn, ...rest } = entity as Notificacion
    return {
      ...rest,
      creadoEn: Timestamp.fromDate(creadoEn),
      actualizadoEn: Timestamp.fromDate(actualizadoEn),
    }
  },
  fromFirestore(snap: QueryDocumentSnapshot) {
    const d = snap.data()
    return {
      id: snap.id,
      tipo: d.tipo,
      titulo: d.titulo,
      cuerpo: d.cuerpo ?? "",
      origenModulo: d.origenModulo,
      origenId: d.origenId,
      href: d.href,
      creadoPorUid: d.creadoPorUid ?? "",
      creadoPorNombre: d.creadoPorNombre ?? "",
      creadoEn: d.creadoEn instanceof Timestamp ? d.creadoEn.toDate() : new Date(),
      actualizadoEn:
        d.actualizadoEn instanceof Timestamp ? d.actualizadoEn.toDate() : new Date(),
    } as Notificacion
  },
}

const notificacionesRef = () =>
  collection(db, "notificaciones").withConverter(notificacionConverter)

function leidasRef(uid: string) {
  return collection(db, "usuarios", uid, "notificaciones_leidas")
}

const TITULOS: Record<TipoNotificacion, string> = {
  pedido_almacen_creado: "Nuevo pedido de almacén",
  pedido_almacen_estado: "Pedido de almacén actualizado",
  requisicion_creada: "Nueva requisición",
  requisicion_estado: "Requisición actualizada",
  banos_solicitud_creada: "Nueva solicitud de eliminación de registro de baño",
  banos_solicitud_resuelta: "Solicitud de eliminación de baño resuelta",
  solicitud_documento_creada: "Nueva solicitud de documento",
  solicitud_documento_estado: "Solicitud de documento actualizada",
  solicitud_documento_mensaje: "Nuevo mensaje en solicitud",
}

export function tituloParaTipo(tipo: TipoNotificacion): string {
  return TITULOS[tipo]
}

export function mergeNotificacionesConLeidas(
  notificaciones: readonly Notificacion[],
  leidasIds: ReadonlySet<string>
): NotificacionConLeida[] {
  return notificaciones.map((n) => ({
    ...n,
    leida: leidasIds.has(n.id),
  }))
}

export function contarNoLeidas(items: readonly NotificacionConLeida[]): number {
  return items.reduce((acc, n) => (n.leida ? acc : acc + 1), 0)
}

/** Ordena no leídas primero, luego por fecha desc (ya suelen venir ordenadas). */
export function ordenarParaDropdown(
  items: readonly NotificacionConLeida[]
): NotificacionConLeida[] {
  return [...items].sort((a, b) => {
    if (a.leida !== b.leida) return a.leida ? 1 : -1
    return b.creadoEn.getTime() - a.creadoEn.getTime()
  })
}

export async function crearNotificacion(payload: NuevaNotificacion): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(notificacionesRef(), {
    ...payload,
    id: "",
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as Notificacion)
  return ref.id
}

/**
 * Emite una notificación sin tumbar el flujo origen si falla.
 * Devuelve el id o null si hubo error.
 */
export async function emitirNotificacion(
  payload: NuevaNotificacion
): Promise<string | null> {
  try {
    return await crearNotificacion(payload)
  } catch (err) {
    console.error("No se pudo emitir notificación:", err)
    return null
  }
}

export function suscribirNotificaciones(
  onData: (items: Notificacion[]) => void,
  onError?: (err: Error) => void,
  limiteDocs: number = LIMITE_DEFAULT
): () => void {
  const q = query(notificacionesRef(), orderBy("creadoEn", "desc"), limit(limiteDocs))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data()))
    },
    (err) => {
      console.error("Error en suscripción a notificaciones:", err)
      onError?.(err)
    }
  )
}

export function suscribirNotificacionesLeidas(
  uid: string,
  onData: (ids: Set<string>) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    leidasRef(uid),
    (snap) => {
      onData(new Set(snap.docs.map((d) => d.id)))
    },
    (err) => {
      console.error("Error en suscripción a notificaciones leídas:", err)
      onError?.(err)
    }
  )
}

export async function marcarNotificacionLeida(uid: string, notificacionId: string): Promise<void> {
  await setDoc(doc(leidasRef(uid), notificacionId), {
    leidoEn: Timestamp.now(),
  })
}

export async function marcarTodasNotificacionesLeidas(
  uid: string,
  ids: readonly string[]
): Promise<void> {
  const pendientes = ids.filter(Boolean)
  if (pendientes.length === 0) return

  const LOTE = 400
  for (let i = 0; i < pendientes.length; i += LOTE) {
    const grupo = pendientes.slice(i, i + LOTE)
    const batch = writeBatch(db)
    const ahora = Timestamp.now()
    for (const id of grupo) {
      batch.set(doc(leidasRef(uid), id), { leidoEn: ahora })
    }
    await batch.commit()
  }
}

/** Solo para tests / listados one-shot. */
export async function listarNotificacionesLeidasIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(leidasRef(uid))
  return new Set(snap.docs.map((d) => d.id))
}

export type { NotificacionLeida }
