import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { PedidoAlmacen, NuevoPedidoAlmacen } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"
import { emitirNotificacion, tituloParaTipo } from "@/lib/notificaciones"

const pedidoAlmacenConverter = makeDateConverter<PedidoAlmacen>()
const pedidosAlmacenRef = () =>
  collection(db, "pedidos-almacen").withConverter(pedidoAlmacenConverter)

function actorNotificacion(): { uid: string; nombre: string } {
  const user = getClienteAuth().currentUser
  return {
    uid: user?.uid ?? "",
    nombre: user?.displayName || user?.email || "Usuario",
  }
}

export async function listarPedidosAlmacen(): Promise<PedidoAlmacen[]> {
  const snap = await getDocs(query(pedidosAlmacenRef(), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
}

export function suscribirPedidosAlmacen(
  onData: (pedidos: PedidoAlmacen[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(pedidosAlmacenRef(), orderBy("creadoEn", "desc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data()))
    },
    (err) => {
      console.error("Error en suscripción a pedidos-almacen:", err)
      onError?.(err)
    }
  )
}

export async function crearPedidoAlmacen(payload: NuevoPedidoAlmacen): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(pedidosAlmacenRef(), {
    ...payload,
    estado: "pendiente" as const,
    ordenIdVinculada: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as PedidoAlmacen)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "CREAR",
    "pedidos-almacen",
    ref.id,
    `Pidió compra: ${payload.descripcion}`
  )

  const actor = actorNotificacion()
  await emitirNotificacion({
    tipo: "pedido_almacen_creado",
    titulo: tituloParaTipo("pedido_almacen_creado"),
    cuerpo: payload.urgente
      ? `Urgente: ${payload.descripcion}`
      : payload.descripcion,
    origenModulo: "pedidos-almacen",
    origenId: ref.id,
    audiencia: "pedidos-almacen",
    destinatarioUid: null,
    href: "/pedidos-almacen",
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })

  return ref.id
}

export async function marcarPedidoAlmacenComprado(id: string, ordenId: string): Promise<void> {
  const prev = await getDoc(doc(db, "pedidos-almacen", id))
  const descripcion =
    prev.exists() && typeof prev.data()?.descripcion === "string"
      ? (prev.data()?.descripcion as string)
      : id

  await actualizarDocumento("pedidos-almacen", id, {
    estado: "comprado" as const,
    ordenIdVinculada: ordenId,
  })

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    "pedidos-almacen",
    id,
    `Marcó como comprado, vinculado a orden ${ordenId}`
  )

  const actor = actorNotificacion()
  await emitirNotificacion({
    tipo: "pedido_almacen_estado",
    titulo: tituloParaTipo("pedido_almacen_estado"),
    cuerpo: `«${descripcion}» → comprado (orden ${ordenId})`,
    origenModulo: "pedidos-almacen",
    origenId: id,
    audiencia: "pedidos-almacen",
    destinatarioUid: null,
    href: "/pedidos-almacen",
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })
}

export async function cancelarPedidoAlmacen(id: string): Promise<void> {
  const prev = await getDoc(doc(db, "pedidos-almacen", id))
  const descripcion =
    prev.exists() && typeof prev.data()?.descripcion === "string"
      ? (prev.data()?.descripcion as string)
      : id

  await actualizarDocumento("pedidos-almacen", id, { estado: "cancelado" as const })

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "pedidos-almacen", id, "Canceló pedido")

  const actor = actorNotificacion()
  await emitirNotificacion({
    tipo: "pedido_almacen_estado",
    titulo: tituloParaTipo("pedido_almacen_estado"),
    cuerpo: `«${descripcion}» → cancelado`,
    origenModulo: "pedidos-almacen",
    origenId: id,
    audiencia: "pedidos-almacen",
    destinatarioUid: null,
    href: "/pedidos-almacen",
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })
}
