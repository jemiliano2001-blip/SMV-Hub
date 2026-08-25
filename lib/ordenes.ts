import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { OrdenCompra, NuevaCompraForm, EstadoOrden, EstadoRecepcion, ItemFactura } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"
import { makeDateConverter } from "@/lib/firestore-helpers"

const ordenConverter = makeDateConverter<OrdenCompra>()

const repo = crearRepositorio<OrdenCompra>({
  coleccion: "ordenes",
  converter: ordenConverter,
})

// ── CRUD ──────────────────────────────────────────────────────────────────────

export type NuevaOrdenPayload = NuevaCompraForm & {
  imagenUrl?: string
  imagenPath?: string
  linkProveedor?: string | null
  fechaEntrega?: string | null
  estado?: EstadoOrden
  estadoRecepcion?: EstadoRecepcion
  fechaRecepcion?: string | null
  recibidoPor?: string | null
  entradaAlmacenId?: string | null
  proveedorId?: string | null
  cotizacionGanadoraId?: string | null
  requisicionId?: string | null
}

export async function crearOrden(payload: NuevaOrdenPayload): Promise<string> {
  return repo.crear(
    {
      ...payload,
      estado: payload.estado ?? ("pendiente" as const),
      estadoRecepcion: payload.estadoRecepcion ?? ("pendiente" as const),
    },
    `Creó orden para proveedor ${payload.proveedor}`
  )
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
    estadoRecepcion: p.estadoRecepcion ?? ("pendiente" as const),
  }))
  return repo.crearEnLote(
    listos as Record<string, unknown>[],
    `Creó ${payloads.length} órdenes en lote`,
    onProgreso
  )
}

export async function listarOrdenes(): Promise<OrdenCompra[]> {
  return repo.listar([orderBy("creadoEn", "desc")])
}

const LIMITE_RECIENTES_DEFAULT = 200
const LIMITE_RECIENTES_MAX = 500

export async function listarOrdenesRecientes(
  limite = LIMITE_RECIENTES_DEFAULT
): Promise<OrdenCompra[]> {
  const n = Number.isFinite(limite)
    ? Math.min(LIMITE_RECIENTES_MAX, Math.max(1, Math.trunc(limite)))
    : LIMITE_RECIENTES_DEFAULT
  return repo.listar([orderBy("creadoEn", "desc"), limit(n)])
}

/** Órdenes con creadoEn en [desde, hasta]. Callers de reportes deben aplicar filtrarPorRango para fechaFactura. */
export async function listarOrdenesEnRango(
  desde: Date,
  hasta: Date
): Promise<OrdenCompra[]> {
  return repo.listar([
    where("creadoEn", ">=", desde),
    where("creadoEn", "<=", hasta),
    orderBy("creadoEn", "desc"),
  ])
}

function fechaFacturaISO(dia: Date): string {
  const yyyy = dia.getFullYear()
  const mm = String(dia.getMonth() + 1).padStart(2, "0")
  const dd = String(dia.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/** Carga órdenes por fecha de captura o fecha de factura y deduplica ambas consultas. */
export async function listarOrdenesParaReporte(
  desde: Date,
  hasta: Date
): Promise<OrdenCompra[]> {
  const inicio = new Date(desde)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(hasta)
  fin.setHours(23, 59, 59, 999)
  const inicioFactura = fechaFacturaISO(inicio)
  const finFactura = fechaFacturaISO(fin)

  const ordenesRef = repo.ref()

  const [porCreacion, porFactura] = await Promise.all([
    getDocs(
      query(
        ordenesRef,
        where("creadoEn", ">=", inicio),
        where("creadoEn", "<=", fin),
        orderBy("creadoEn", "desc")
      )
    ),
    getDocs(
      query(
        ordenesRef,
        where("fechaFactura", ">=", inicioFactura),
        where("fechaFactura", "<=", finFactura),
        orderBy("fechaFactura", "desc")
      )
    ),
  ])

  const unicas = new Map<string, OrdenCompra>()
  for (const snap of [...porCreacion.docs, ...porFactura.docs]) {
    unicas.set(snap.id, snap.data())
  }
  return [...unicas.values()]
}

/** Órdenes de un lote contable, incluyendo lotes históricos fuera de la ventana reciente. */
export async function listarOrdenesPorReporteContable(
  reporteContableId: string
): Promise<OrdenCompra[]> {
  return repo.listar([where("reporteContableId", "==", reporteContableId)])
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

  const snapshot = await getDocs(query(repo.ref(), ...restricciones))
  const hayMas = snapshot.docs.length > tamanoSeguro
  const documentos = snapshot.docs.slice(0, tamanoSeguro)

  return {
    items: documentos.map((documento) => documento.data()),
    siguienteCursor: hayMas ? documentos.at(-1) ?? null : null,
    hayMas,
  }
}

export async function contarOrdenes(): Promise<number> {
  return repo.contar()
}

export async function obtenerOrden(id: string): Promise<OrdenCompra | null> {
  return repo.obtener(id)
}

export async function actualizarOrden(
  id: string,
  cambios: Partial<Omit<OrdenCompra, "id" | "creadoEn">>
): Promise<void> {
  await repo.actualizar(id, cambios, `Actualizó campos: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarOrden(id: string): Promise<void> {
  await repo.eliminar(id, "Eliminó orden")
}

export async function eliminarOrdenesLote(ids: string[]): Promise<number> {
  return repo.eliminarEnLote(ids, `Eliminó ${ids.length} órdenes en lote`)
}

export async function actualizarOrdenesEstadoLote(
  ids: string[],
  estado: EstadoOrden
): Promise<number> {
  if (ids.length === 0) return 0
  return repo.actualizarEnLote(
    ids.map((id) => ({ id, cambios: { estado } })),
    `Cambió estado de ${ids.length} órdenes a ${estado}`
  )
}

// Busca órdenes existentes por combinación numeroFactura+proveedor para deduplicación.
// Solo evalúa facturas con numeroFactura no nulo. Divide en chunks de 30 (límite Firestore `in`).
/**
 * Órdenes existentes que comparten número de factura con los pares dados.
 *
 * Incluye el `id` para que quien edite una orden pueda excluirse a sí misma del
 * chequeo de duplicados (`OrdenFormModal`); `esOrdenDuplicada` ignora el campo.
 */
export async function buscarPorFacturaYProveedor(
  pares: Array<{ numeroFactura: string; proveedor: string }>
): Promise<Array<{ id: string; numeroFactura: string | null; proveedor: string }>> {
  if (pares.length === 0) return []

  const CHUNK = 30
  const resultados: Array<{ id: string; numeroFactura: string | null; proveedor: string }> = []

  for (let i = 0; i < pares.length; i += CHUNK) {
    const facturas = pares.slice(i, i + CHUNK).map((p) => p.numeroFactura)
    const snap = await getDocs(
      query(collection(db, "ordenes"), where("numeroFactura", "in", facturas))
    )
    snap.docs.forEach((d) => {
      const data = d.data() as { numeroFactura?: string | null; proveedor?: string }
      resultados.push({
        id: d.id,
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
  return repo.actualizarEnLote(payloads, `Actualizó claves SAT en ${actualizaciones.length} órdenes`, onProgreso)
}
