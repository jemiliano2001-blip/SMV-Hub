import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  Timestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getClienteAuth } from "@/lib/firebase"
import type {
  EstadoSolicitudDocumento,
  MensajeSolicitudDocumento,
  NuevaSolicitudDocumento,
  SolicitudDocumento,
} from "@/lib/schemas"
import {
  MensajeSolicitudDocumentoSchema,
  NuevaSolicitudDocumentoSchema,
} from "@/lib/schemas"
import { makeDateConverter } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"
import { emitirNotificacion, tituloParaTipo } from "@/lib/notificaciones"
import { puedeTransicionarEstado, validarPartidasRemision } from "@/lib/documentos-venta-helpers"

const COLECCION = "solicitudes_documento"

const solicitudConverter = makeDateConverter<SolicitudDocumento>()
const solicitudesRef = () =>
  collection(db, COLECCION).withConverter(solicitudConverter)

const mensajeConverter: FirestoreDataConverter<MensajeSolicitudDocumento> = {
  toFirestore(entity: MensajeSolicitudDocumento) {
    const data: Record<string, unknown> = { ...entity, creadoEn: Timestamp.fromDate(entity.creadoEn) }
    delete data.id
    return data
  },
  fromFirestore(snap: QueryDocumentSnapshot) {
    const d = snap.data()
    return {
      id: snap.id,
      texto: d.texto,
      autorUid: d.autorUid,
      autorNombre: d.autorNombre,
      creadoEn: d.creadoEn instanceof Timestamp ? d.creadoEn.toDate() : new Date(),
    } as MensajeSolicitudDocumento
  },
}

function mensajesRef(solicitudId: string) {
  return collection(db, COLECCION, solicitudId, "mensajes").withConverter(mensajeConverter)
}

function actorNotificacion(): { uid: string; nombre: string } {
  const user = getClienteAuth().currentUser
  return {
    uid: user?.uid ?? "",
    nombre: user?.displayName || user?.email || "Usuario",
  }
}

export async function crearSolicitudDocumento(
  data: NuevaSolicitudDocumento,
  opts?: { lineasSo?: readonly { odooLineId: number; qtyPending: number }[] }
): Promise<string> {
  const parsed = NuevaSolicitudDocumentoSchema.parse(data)

  if (parsed.tipo === "remision" && parsed.partidas.length === 0) {
    throw new Error("Selecciona al menos una partida")
  }

  if (parsed.tipo === "remision" && opts?.lineasSo) {
    const err = validarPartidasRemision(parsed.tipo, parsed.partidas, opts.lineasSo)
    if (err) throw new Error(err)
  }

  const token = await getClienteAuth().currentUser?.getIdToken()
  if (!token) throw new Error("Inicia sesión para crear una solicitud")

  const response = await fetch("/api/documentos-venta/solicitudes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(parsed),
  })
  const body = await response.json().catch(() => ({})) as { id?: string; error?: string }
  if (!response.ok || !body.id) {
    throw new Error(body.error || "No se pudo crear la solicitud")
  }
  return body.id
}

export async function actualizarEstadoSolicitudDocumento(args: {
  id: string
  desde: EstadoSolicitudDocumento
  hacia: EstadoSolicitudDocumento
  esAtendedor: boolean
  esSolicitante: boolean
  uid: string
  nombre: string
  folioOdoo?: string | null
  motivoRechazo?: string | null
}): Promise<void> {
  if (
    !puedeTransicionarEstado(args.desde, args.hacia, {
      esAtendedor: args.esAtendedor,
      esSolicitante: args.esSolicitante,
    })
  ) {
    throw new Error("Transición de estado no permitida")
  }

  if (args.hacia === "rechazada" && !(args.motivoRechazo ?? "").trim()) {
    throw new Error("Motivo de rechazo requerido")
  }

  let estadoAnterior: EstadoSolicitudDocumento | null = null
  let resumenSo = args.id
  let solicitadoPorUid: string | null = null
  const ref = doc(db, COLECCION, args.id)

  await runTransaction(db, async (tx) => {
    const actualSnap = await tx.get(ref)
    if (!actualSnap.exists()) throw new Error("Solicitud no encontrada")

    const actual = actualSnap.data() as Partial<SolicitudDocumento>
    const estadoActual = actual.estado
    if (
      estadoActual !== "pendiente" &&
      estadoActual !== "en_proceso" &&
      estadoActual !== "completada" &&
      estadoActual !== "rechazada"
    ) {
      throw new Error("Estado actual inválido")
    }
    if (estadoActual !== args.desde) {
      throw new Error("La solicitud cambió en otra pestaña; recarga e inténtalo de nuevo")
    }
    if (!puedeTransicionarEstado(estadoActual, args.hacia, {
      esAtendedor: args.esAtendedor,
      esSolicitante: args.esSolicitante,
    })) {
      throw new Error("Transición de estado no permitida")
    }

    estadoAnterior = estadoActual
    resumenSo = typeof actual.odooSoName === "string" ? actual.odooSoName : args.id
    solicitadoPorUid = typeof actual.solicitadoPorUid === "string" ? actual.solicitadoPorUid : null

    const cambios: Record<string, unknown> = { estado: args.hacia }
    if (args.esAtendedor) {
      cambios.atendidoPorUid = args.uid
      cambios.atendidoPorNombre = args.nombre
    }
    if (args.hacia === "rechazada") {
      cambios.motivoRechazo = (args.motivoRechazo ?? "").trim()
    }
    if (args.folioOdoo !== undefined) {
      cambios.folioOdoo = args.folioOdoo
    }

    tx.update(ref, {
      ...cambios,
      actualizadoEn: Timestamp.fromDate(new Date()),
    })
  })

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    COLECCION,
    args.id,
    `Estado ${estadoAnterior ?? args.desde} → ${args.hacia} (SO ${resumenSo})`
  )

  const actor = actorNotificacion()
  await emitirNotificacion({
    tipo: "solicitud_documento_estado",
    titulo: tituloParaTipo("solicitud_documento_estado"),
    cuerpo: `SO ${resumenSo}: ${args.desde} → ${args.hacia}`,
    origenModulo: "documentos-venta",
    origenId: args.id,
    audiencia: "documentos-venta",
    destinatarioUid: solicitadoPorUid,
    href: `/documentos-venta?solicitud=${args.id}`,
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })
}

export function suscribirSolicitudesDocumento(
  onData: (rows: SolicitudDocumento[]) => void,
  onError: (e: Error) => void,
  opts?: { atiende?: boolean; uid?: string | null }
): () => void {
  const atiende = opts?.atiende === true
  const uid = opts?.uid ?? null
  const q =
    atiende || !uid
      ? query(solicitudesRef(), orderBy("creadoEn", "desc"), limit(200))
      : query(
          solicitudesRef(),
          where("solicitadoPorUid", "==", uid),
          orderBy("creadoEn", "desc"),
          limit(200)
        )
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data()))
    },
    (err) => {
      console.error("Error en suscripción a solicitudes_documento:", err)
      onError(err)
    }
  )
}

/**
 * Recupera una solicitud concreta para resolver deep links que quedaron fuera
 * de la ventana de la suscripción (por ejemplo, una solicitud antigua).
 * Las reglas de Firestore siguen siendo la autorización efectiva.
 */
export async function obtenerSolicitudDocumento(
  solicitudId: string
): Promise<SolicitudDocumento | null> {
  const snap = await getDoc(doc(db, COLECCION, solicitudId).withConverter(solicitudConverter))
  return snap.exists() ? snap.data() : null
}

export async function agregarMensajeSolicitud(
  solicitudId: string,
  texto: string,
  autorUid: string,
  autorNombre: string
): Promise<string> {
  const parsed = MensajeSolicitudDocumentoSchema.omit({ id: true, creadoEn: true }).parse({
    texto,
    autorUid,
    autorNombre,
  })

  const ahora = new Date()
  const ref = await addDoc(mensajesRef(solicitudId), {
    ...parsed,
    id: "",
    creadoEn: ahora,
  } as MensajeSolicitudDocumento)

  try {
    const snap = await getDoc(doc(db, COLECCION, solicitudId).withConverter(solicitudConverter))
    const sol = snap.data()
    if (sol) {
      const actor = actorNotificacion()
      const etiqueta = sol.tipo === "factura" ? "Factura" : "Remisión"
      await emitirNotificacion({
        tipo: "solicitud_documento_mensaje",
        titulo: tituloParaTipo("solicitud_documento_mensaje"),
        cuerpo: `Nuevo mensaje · ${etiqueta} ${sol.odooSoName}`,
        origenModulo: "documentos-venta",
        origenId: solicitudId,
        audiencia: "documentos-venta",
        destinatarioUid: sol.solicitadoPorUid,
        href: `/documentos-venta?solicitud=${solicitudId}`,
        creadoPorUid: actor.uid || autorUid,
        creadoPorNombre: actor.nombre || autorNombre,
      })
    }
  } catch (err) {
    console.error("Notif mensaje solicitud_documento falló:", err)
  }

  return ref.id
}

export function suscribirMensajesSolicitud(
  solicitudId: string,
  onData: (rows: MensajeSolicitudDocumento[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = query(mensajesRef(solicitudId), orderBy("creadoEn", "asc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data()))
    },
    (err) => {
      console.error("Error en suscripción a mensajes de solicitud:", err)
      onError(err)
    }
  )
}
