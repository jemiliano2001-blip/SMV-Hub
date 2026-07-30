import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
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
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"
import { emitirNotificacion, tituloParaTipo } from "@/lib/notificaciones"
import { puedeTransicionarEstado, validarPartidasRemision } from "@/lib/documentos-venta-helpers"

const COLECCION = "solicitudes_documento"

const solicitudConverter = makeDateConverter<SolicitudDocumento>()
const solicitudesRef = () =>
  collection(db, COLECCION).withConverter(solicitudConverter)

const mensajeConverter: FirestoreDataConverter<MensajeSolicitudDocumento> = {
  toFirestore(entity: MensajeSolicitudDocumento) {
    const { id: _id, creadoEn, ...rest } = entity
    return {
      ...rest,
      creadoEn: Timestamp.fromDate(creadoEn),
    }
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

function etiquetaTipo(tipo: SolicitudDocumento["tipo"]): string {
  return tipo === "factura" ? "Factura" : "Remisión"
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

  const ahora = new Date()
  const ref = await addDoc(solicitudesRef(), {
    ...parsed,
    folioOdoo: null,
    motivoRechazo: null,
    atendidoPorUid: null,
    atendidoPorNombre: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as SolicitudDocumento)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "CREAR",
    COLECCION,
    ref.id,
    `Creó solicitud de ${etiquetaTipo(parsed.tipo)} para SO ${parsed.odooSoName}`
  )

  const actor = actorNotificacion()
  await emitirNotificacion({
    tipo: "solicitud_documento_creada",
    titulo: tituloParaTipo("solicitud_documento_creada"),
    cuerpo: `${etiquetaTipo(parsed.tipo)} · ${parsed.odooSoName} · ${parsed.partnerName}`,
    origenModulo: "documentos-venta",
    origenId: ref.id,
    href: `/documentos-venta?solicitud=${ref.id}`,
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })

  return ref.id
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

  const prev = await getDoc(doc(db, COLECCION, args.id).withConverter(solicitudConverter))
  const resumenSo =
    prev.exists() && typeof prev.data().odooSoName === "string"
      ? prev.data().odooSoName
      : args.id

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

  await actualizarDocumento(COLECCION, args.id, cambios)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    COLECCION,
    args.id,
    `Estado ${args.desde} → ${args.hacia} (SO ${resumenSo})`
  )

  const actor = actorNotificacion()
  await emitirNotificacion({
    tipo: "solicitud_documento_estado",
    titulo: tituloParaTipo("solicitud_documento_estado"),
    cuerpo: `SO ${resumenSo}: ${args.desde} → ${args.hacia}`,
    origenModulo: "documentos-venta",
    origenId: args.id,
    href: `/documentos-venta?solicitud=${args.id}`,
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })
}

export function suscribirSolicitudesDocumento(
  onData: (rows: SolicitudDocumento[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = query(solicitudesRef(), orderBy("creadoEn", "desc"), limit(200))
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
