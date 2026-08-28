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
  Timestamp,
  where,
  writeBatch,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  AudienciaNotificacion,
  ModuloId,
  Notificacion,
  NotificacionConLeida,
  NotificacionLeida,
  NuevaNotificacion,
  TipoNotificacion,
} from "@/lib/schemas"

const LIMITE_DEFAULT = 50

const notificacionConverter: FirestoreDataConverter<Notificacion> = {
  toFirestore(entity) {
    const data: Record<string, unknown> = {
      ...(entity as Notificacion),
      creadoEn: Timestamp.fromDate((entity as Notificacion).creadoEn),
      actualizadoEn: Timestamp.fromDate((entity as Notificacion).actualizadoEn),
    }
    delete data.id
    return data
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
      audiencia: d.audiencia,
      destinatarioUid: d.destinatarioUid ?? null,
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

function descartadasRef(uid: string) {
  return collection(db, "usuarios", uid, "notificaciones_descartadas")
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
  endmills_stock_critico: "Stock crítico de Endmill",
  orden_recibida_almacen: "Material recibido en almacén",
}

export function tituloParaTipo(tipo: TipoNotificacion): string {
  return TITULOS[tipo]
}

/** Convierte el destino almacenado a una ruta interna segura. */
export function hrefSeguroNotificacion(href: string): string {
  const valor = href.trim()
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/notificaciones"

  try {
    const base = new URL("https://smv-hub.local")
    const destino = new URL(valor, base)
    if (destino.origin !== base.origin) return "/notificaciones"
    return `${destino.pathname}${destino.search}${destino.hash}`
  } catch {
    return "/notificaciones"
  }
}

export function mergeNotificacionesConLeidas(
  notificaciones: readonly Notificacion[],
  leidasIds: ReadonlySet<string>,
  descartadasIds?: ReadonlySet<string>
): NotificacionConLeida[] {
  const noDescartadas = descartadasIds
    ? notificaciones.filter((n) => !descartadasIds.has(n.id))
    : notificaciones
  return noDescartadas.map((n) => ({ ...n, leida: leidasIds.has(n.id) }))
}

export function contarNoLeidas(items: readonly NotificacionConLeida[]): number {
  return items.reduce((acc, n) => (n.leida ? acc : acc + 1), 0)
}

/** Ordena no leídas primero, luego por fecha descendente. */
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

/** Emite una notificación sin tumbar el flujo origen si falla. */
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

export function audienciasNotificacionParaUsuario(args: {
  modulos: readonly ModuloId[] | null | undefined
  esSuperAdmin: boolean
  atiendeDocumentosVenta: boolean
}): AudienciaNotificacion[] {
  const audiencias: AudienciaNotificacion[] = []
  if (args.modulos?.includes("pedidos-almacen")) audiencias.push("pedidos-almacen")
  if (args.modulos?.includes("requisiciones")) audiencias.push("requisiciones")
  if (args.modulos?.includes("endmills")) audiencias.push("endmills")
  if (args.esSuperAdmin) audiencias.push("banos")
  if (args.esSuperAdmin || args.atiendeDocumentosVenta) audiencias.push("documentos-venta")
  return audiencias
}

export function suscribirNotificaciones(
  onData: (items: Notificacion[]) => void,
  opciones: {
    uid: string
    audiencias: readonly AudienciaNotificacion[]
    limiteDocs?: number
  },
  onError?: (err: Error) => void
): () => void {
  const limiteDocs = opciones.limiteDocs ?? LIMITE_DEFAULT
  const audiencias = [...new Set(opciones.audiencias)]
  const consultas = [
    query(
      notificacionesRef(),
      where("destinatarioUid", "==", opciones.uid),
      orderBy("creadoEn", "desc"),
      limit(limiteDocs)
    ),
    ...audiencias.map((audiencia) =>
      query(
        notificacionesRef(),
        where("audiencia", "==", audiencia),
        orderBy("creadoEn", "desc"),
        limit(limiteDocs)
      )
    ),
  ]
  const resultados = new Map<number, Notificacion[]>()
  const inicializadas = new Set<number>()
  let cerrada = false

  const emitirCombinadas = () => {
    if (cerrada || inicializadas.size !== consultas.length) return
    const porId = new Map<string, Notificacion>()
    for (const lista of resultados.values()) {
      for (const notificacion of lista) porId.set(notificacion.id, notificacion)
    }
    onData(
      [...porId.values()]
        .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())
        .slice(0, limiteDocs)
    )
  }

  const desuscribir = consultas.map((consulta, indice) =>
    onSnapshot(
      consulta,
      (snap) => {
        resultados.set(indice, snap.docs.map((d) => d.data()))
        inicializadas.add(indice)
        emitirCombinadas()
      },
      (err) => {
        console.error("Error en suscripción a notificaciones:", err)
        onError?.(err)
      }
    )
  )
  return () => {
    cerrada = true
    desuscribir.forEach((fn) => fn())
  }
}

export function suscribirNotificacionesLeidas(
  uid: string,
  onData: (ids: Set<string>) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    leidasRef(uid),
    (snap) => onData(new Set(snap.docs.map((d) => d.id))),
    (err) => {
      console.error("Error en suscripción a notificaciones leídas:", err)
      onError?.(err)
    }
  )
}

export async function marcarNotificacionLeida(uid: string, notificacionId: string): Promise<void> {
  await setDoc(doc(leidasRef(uid), notificacionId), { leidoEn: Timestamp.now() })
}

export async function marcarTodasNotificacionesLeidas(
  uid: string,
  ids: readonly string[]
): Promise<void> {
  const pendientes = [...new Set(ids.filter(Boolean))]
  if (pendientes.length === 0) return

  const LOTE = 400
  for (let i = 0; i < pendientes.length; i += LOTE) {
    const grupo = pendientes.slice(i, i + LOTE)
    const batch = writeBatch(db)
    const ahora = Timestamp.now()
    for (const id of grupo) batch.set(doc(leidasRef(uid), id), { leidoEn: ahora })
    await batch.commit()
  }
}

/** Suscribe a los IDs de notificaciones que el usuario ha descartado/borrado. */
export function suscribirNotificacionesDescartadas(
  uid: string,
  onData: (ids: Set<string>) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    descartadasRef(uid),
    (snap) => onData(new Set(snap.docs.map((d) => d.id))),
    (err) => {
      console.error("Error en suscripción a notificaciones descartadas:", err)
      onError?.(err)
    }
  )
}

/** Descarta/elimina una notificación de la bandeja personal del usuario. */
export async function descartarNotificacion(uid: string, notificacionId: string): Promise<void> {
  await setDoc(doc(descartadasRef(uid), notificacionId), { descartadoEn: Timestamp.now() })
}

/** Descarta/elimina múltiples notificaciones de la bandeja personal en lote. */
export async function descartarTodasNotificaciones(
  uid: string,
  ids: readonly string[]
): Promise<void> {
  const pendientes = [...new Set(ids.filter(Boolean))]
  if (pendientes.length === 0) return

  const LOTE = 400
  for (let i = 0; i < pendientes.length; i += LOTE) {
    const grupo = pendientes.slice(i, i + LOTE)
    const batch = writeBatch(db)
    const ahora = Timestamp.now()
    for (const id of grupo) batch.set(doc(descartadasRef(uid), id), { descartadoEn: ahora })
    await batch.commit()
  }
}

/** Solo para tests y listados de una sola consulta. */
export async function listarNotificacionesLeidasIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(leidasRef(uid))
  return new Set(snap.docs.map((d) => d.id))
}

/** Solo para tests de notificaciones descartadas. */
export async function listarNotificacionesDescartadasIds(uid: string): Promise<Set<string>> {
  const snap = await getDocs(descartadasRef(uid))
  return new Set(snap.docs.map((d) => d.id))
}

export type { NotificacionLeida }
