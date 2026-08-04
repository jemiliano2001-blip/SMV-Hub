import {
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { PedidoAlmacen, NuevoPedidoAlmacen } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"
import { emitirNotificacion, tituloParaTipo } from "@/lib/notificaciones"

const repo = crearRepositorio<PedidoAlmacen>({ coleccion: "pedidos-almacen" })

function actorNotificacion(): { uid: string; nombre: string } {
  const user = getClienteAuth().currentUser
  return {
    uid: user?.uid ?? "",
    nombre: user?.displayName || user?.email || "Usuario",
  }
}

export async function listarPedidosAlmacen(): Promise<PedidoAlmacen[]> {
  return repo.listar([orderBy("creadoEn", "desc")])
}

export function suscribirPedidosAlmacen(
  onData: (pedidos: PedidoAlmacen[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(repo.ref(), orderBy("creadoEn", "desc"))
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
  const id = await repo.crear(
    {
      ...payload,
      estado: "pendiente" as const,
      ordenIdVinculada: null,
    },
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
    origenId: id,
    audiencia: "pedidos-almacen",
    destinatarioUid: null,
    href: "/pedidos-almacen",
    creadoPorUid: actor.uid,
    creadoPorNombre: actor.nombre,
  })

  return id
}

export async function marcarPedidoAlmacenComprado(id: string, ordenId: string): Promise<void> {
  const prev = await getDoc(doc(db, "pedidos-almacen", id))
  const descripcion =
    prev.exists() && typeof prev.data()?.descripcion === "string"
      ? (prev.data()?.descripcion as string)
      : id

  await repo.actualizar(
    id,
    { estado: "comprado" as const, ordenIdVinculada: ordenId },
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

  await repo.actualizar(id, { estado: "cancelado" as const }, "Canceló pedido")

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
