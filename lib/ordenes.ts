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
  limit,
  startAfter,
  getCountFromServer,
  type QueryConstraint,
  type QueryDocumentSnapshot,
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

const LIMITE_RECIENTES_DEFAULT = 200
const LIMITE_RECIENTES_MAX = 500

export async function listarOrdenesRecientes(
  limite = LIMITE_RECIENTES_DEFAULT
): Promise<OrdenCompra[]> {
  const n = Number.isFinite(limite)
    ? Math.min(LIMITE_RECIENTES_MAX, Math.max(1, Math.trunc(limite)))
    : LIMITE_RECIENTES_DEFAULT
  const snap = await getDocs(
    query(ordenesRef(), orderBy("creadoEn", "desc"), limit(n))
  )
  return snap.docs.map((d) => d.data())
}

/** Órdenes con creadoEn en [desde, hasta]. Callers de reportes deben aplicar filtrarPorRango para fechaFactura. */
export async function listarOrdenesEnRango(
  desde: Date,
  hasta: Date
): Promise<OrdenCompra[]> {
  const snap = await getDocs(
    query(
      ordenesRef(),
      where("creadoEn", ">=", desde),
      where("creadoEn", "<=", hasta),
      orderBy("creadoEn", "desc")
    )
  )
  return snap.docs.map((d) => d.data())
}

export type CursorOrdenes = QueryDocumentSnapshot<OrdenCompra>

export interface PaginaOrdenes {
  items: OrdenCompra[]
  siguienteCursor: CursorOrdenes | null
  hayMas: boolean
}

function normalizarTamanoPagina(tamano: number): number {
  if (!Number.isFinite(tamano)) return 50
  return Math.min(100, Math.max(1, Math.trunc(tamano)))
}

export async function obtenerPaginaOrdenes(
  tamano = 50,
  cursor?: CursorOrdenes | null
): Promise<PaginaOrdenes> {
  const tamanoSeguro = normalizarTamanoPagina(tamano)
  const restricciones: QueryConstraint[] = [orderBy("creadoEn", "desc")]
  if (cursor) restricciones.push(startAfter(cursor))
  restricciones.push(limit(tamanoSeguro + 1))

  const snapshot = await getDocs(query(ordenesRef(), ...restricciones))
  const hayMas = snapshot.docs.length > tamanoSeguro
  const documentos = snapshot.docs.slice(0, tamanoSeguro)

  return {
    items: documentos.map((documento) => documento.data()),
    siguienteCursor: hayMas ? documentos.at(-1) ?? null : null,
    hayMas,
  }
}

export async function contarOrdenes(): Promise<number> {
  const snapshot = await getCountFromServer(ordenesRef())
  return snapshot.data().count
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
