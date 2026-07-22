import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { OrdenCompra, NuevaCompraForm, EstadoOrden, ItemFactura } from "@/lib/schemas"
import { makeDateConverter, crearLote, eliminarLote, actualizarDocumento, actualizarLote } from "@/lib/firestore-helpers"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"

const ordenConverter = makeDateConverter<OrdenCompra>()
const ordenesRef = () => collection(db, "ordenes").withConverter(ordenConverter)

// ── CRUD ──────────────────────────────────────────────────────────────────────

export type NuevaOrdenPayload = NuevaCompraForm & {
  imagenUrl?: string
  imagenPath?: string
  linkProveedor?: string | null
  fechaEntrega?: string | null
  estado?: EstadoOrden
  proveedorId?: string | null
  cotizacionGanadoraId?: string | null
  requisicionId?: string | null
}

export async function crearOrden(payload: NuevaOrdenPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(ordenesRef(), {
    ...payload,
    estado: payload.estado ?? ("pendiente" as const),
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as OrdenCompra)
  
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'CREAR', 'ordenes', ref.id, `Creó orden para proveedor ${payload.proveedor}`)
  
  return ref.id
}

// Inserta muchas órdenes con writeBatch (atómico por lote, ≤500 escrituras).
// Reutilizado por la importación masiva (CSV y capturas).
export async function crearOrdenesLote(
  payloads: NuevaOrdenPayload[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  const listos = payloads.map((p) => ({
    ...p,
    estado: p.estado ?? ("pendiente" as const),
  }))
  const result = await crearLote(ordenesRef, listos as Record<string, unknown>[], onProgreso)
  
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'CREAR', 'ordenes', 'LOTE', `Creó ${payloads.length} órdenes en lote`)
  
  return result
}

export async function listarOrdenes(): Promise<OrdenCompra[]> {
  const snap = await getDocs(query(ordenesRef(), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
}

export async function obtenerOrden(id: string): Promise<OrdenCompra | null> {
  const snap = await getDoc(doc(db, "ordenes", id).withConverter(ordenConverter))
  return snap.exists() ? snap.data() : null
}

export async function actualizarOrden(
  id: string,
  cambios: Partial<Omit<OrdenCompra, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("ordenes", id, cambios as Record<string, unknown>)
  
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'EDITAR', 'ordenes', id, `Actualizó campos: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarOrden(id: string): Promise<void> {
  await deleteDoc(doc(db, "ordenes", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'BORRAR', 'ordenes', id, `Eliminó orden`)
}

export async function eliminarOrdenesLote(ids: string[]): Promise<number> {
  const result = await eliminarLote("ordenes", ids)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, 'BORRAR', 'ordenes', 'LOTE', `Eliminó ${ids.length} órdenes en lote`)
  return result
}

export async function actualizarOrdenesEstadoLote(
  ids: string[],
  estado: EstadoOrden
): Promise<number> {
  if (ids.length === 0) return 0
  return actualizarLote(
    "ordenes",
    ids.map((id) => ({ id, cambios: { estado } }))
  )
}

// Busca órdenes existentes por combinación numeroFactura+proveedor para deduplicación.
// Solo evalúa facturas con numeroFactura no nulo. Divide en chunks de 30 (límite Firestore `in`).
export async function buscarPorFacturaYProveedor(
  pares: Array<{ numeroFactura: string; proveedor: string }>
): Promise<Array<{ numeroFactura: string | null; proveedor: string }>> {
  if (pares.length === 0) return []

  const CHUNK = 30
  const resultados: Array<{ numeroFactura: string | null; proveedor: string }> = []

  for (let i = 0; i < pares.length; i += CHUNK) {
    const facturas = pares.slice(i, i + CHUNK).map((p) => p.numeroFactura)
    const snap = await getDocs(
      query(collection(db, "ordenes"), where("numeroFactura", "in", facturas))
    )
    snap.docs.forEach((d) => {
      const data = d.data() as { numeroFactura?: string | null; proveedor?: string }
      resultados.push({
        numeroFactura: data.numeroFactura ?? null,
        proveedor: data.proveedor ?? "",
      })
    })
  }

  return resultados
}

export type ActualizacionClavesSat = {
  ordenId: string
  items: ItemFactura[]
}

export async function actualizarClavesSatLote(
  actualizaciones: ActualizacionClavesSat[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  const payloads = actualizaciones.map(({ ordenId, items }) => ({
    id: ordenId,
    cambios: { items } as Record<string, unknown>,
  }))
  return actualizarLote("ordenes", payloads, onProgreso)
}
