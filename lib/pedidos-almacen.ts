import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { PedidoAlmacen, NuevoPedidoAlmacen } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"

const pedidoAlmacenConverter = makeDateConverter<PedidoAlmacen>()
const pedidosAlmacenRef = () =>
  collection(db, "pedidos-almacen").withConverter(pedidoAlmacenConverter)

export async function listarPedidosAlmacen(): Promise<PedidoAlmacen[]> {
  const snap = await getDocs(query(pedidosAlmacenRef(), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
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

  return ref.id
}

export async function marcarPedidoAlmacenComprado(id: string, ordenId: string): Promise<void> {
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
}

export async function cancelarPedidoAlmacen(id: string): Promise<void> {
  await actualizarDocumento("pedidos-almacen", id, { estado: "cancelado" as const })

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "pedidos-almacen", id, "Canceló pedido")
}
