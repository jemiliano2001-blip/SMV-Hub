import {
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import type { Cotizacion } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"
import { generarLlavePieza } from "@/lib/pieza-matching"
import {
  debeActualizarCompraExistente,
  generarClaveUpsertCompra,
  payloadsCotizacionDesdeOrden,
  type OrdenParaCotizacion,
  type PayloadCotizacionDesdeOrden,
} from "@/lib/cotizaciones-desde-ordenes"

const repo = crearRepositorio<Cotizacion>({ coleccion: "cotizaciones" })

// ── CRUD ──────────────────────────────────────────────────────────────────────

// Datos de una cotización antes de guardarse (sin id ni marcas de tiempo, que
// asigna Firestore / esta capa). Listo para la captura manual de la Fase 2.
export type NuevaCotizacionPayload = Omit<Cotizacion, "id" | "creadoEn" | "actualizadoEn">

function conClavesPieza(payload: NuevaCotizacionPayload): NuevaCotizacionPayload {
  const llavePieza =
    payload.llavePieza || generarLlavePieza(payload.numeroParte, payload.descripcion)
  if (payload.origen !== "compra") {
    return { ...payload, llavePieza }
  }
  const claveUpsertCompra =
    payload.claveUpsertCompra ||
    generarClaveUpsertCompra({
      proveedor: payload.proveedor,
      numeroParte: payload.numeroParte,
      descripcion: payload.descripcion,
    })
  return { ...payload, llavePieza, claveUpsertCompra }
}

export async function crearCotizacion(payload: NuevaCotizacionPayload): Promise<string> {
  return repo.crear(conClavesPieza(payload), `Creó cotización de ${payload.proveedor}`)
}

// Inserta muchas cotizaciones con writeBatch (atómico por lote, ≤500 escrituras).
// Reutilizado por la importación masiva del Google Sheet.
export async function crearCotizacionesLote(
  payloads: NuevaCotizacionPayload[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  const conLlave = payloads.map((p) => conClavesPieza(p))
  return repo.crearEnLote(
    conLlave as Record<string, unknown>[],
    `Creó ${payloads.length} cotizaciones`,
    onProgreso
  )
}

// Ordena por fecha de cotización descendente; las que no tienen fecha caen al
// final (Firestore coloca null antes, por eso se reordena en memoria).
export async function listarCotizaciones(): Promise<Cotizacion[]> {
  const items = await repo.listar([orderBy("creadoEn", "desc")])
  return items.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
}

export type CursorCotizaciones = QueryDocumentSnapshot<Cotizacion>

export interface PaginaCotizaciones {
  items: Cotizacion[]
  siguienteCursor: CursorCotizaciones | null
  hayMas: boolean
}

function normalizarTamanoPaginaCotizaciones(tamano: number): number {
  if (!Number.isFinite(tamano)) return 50
  return Math.min(100, Math.max(1, Math.trunc(tamano)))
}

export async function obtenerPaginaCotizaciones(
  tamano = 50,
  cursor?: CursorCotizaciones | null
): Promise<PaginaCotizaciones> {
  const tamanoSeguro = normalizarTamanoPaginaCotizaciones(tamano)
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

export async function obtenerCotizacion(id: string): Promise<Cotizacion | null> {
  return repo.obtener(id)
}

export async function actualizarCotizacion(
  id: string,
  cambios: Partial<Omit<Cotizacion, "id" | "creadoEn">>
): Promise<void> {
  await repo.actualizar(id, cambios, `Actualizó cotización: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarCotizacion(id: string): Promise<void> {
  await repo.eliminar(id, "Eliminó cotización")
}

export async function eliminarCotizacionesLote(ids: string[]): Promise<number> {
  return repo.eliminarEnLote(ids, `Eliminó ${ids.length} cotizaciones`)
}

// Clave de deduplicación para re-importaciones del Sheet: una cotización se
// considera la misma si coinciden fecha + proveedor + descripción + no. de parte.
export function claveDedupCotizacion(c: {
  fecha: string | null
  proveedor: string
  descripcion: string
  numeroParte: string | null
}): string {
  return [c.fecha ?? "", c.proveedor, c.descripcion, c.numeroParte ?? ""]
    .map((s) => s.trim().toLowerCase())
    .join("|")
}

// Devuelve las claves de dedup de todas las cotizaciones ya guardadas, para que
// el preview de importación marque duplicados sin recargar toda la colección por fila.
export async function clavesExistentes(): Promise<Set<string>> {
  const snap = await getDocs(repo.ref())
  return new Set(snap.docs.map((d) => claveDedupCotizacion(d.data())))
}

export async function buscarCotizacionPorClaveUpsert(
  clave: string
): Promise<Cotizacion | null> {
  if (!clave) return null
  const snap = await getDocs(
    query(repo.ref(), where("claveUpsertCompra", "==", clave), limit(1))
  )
  const documento = snap.docs[0]
  return documento ? documento.data() : null
}

export async function upsertCotizacionesDesdeOrden(
  orden: OrdenParaCotizacion
): Promise<{ creadas: number; actualizadas: number; omitidas: number }> {
  const payloads = payloadsCotizacionDesdeOrden(orden)
  let creadas = 0
  let actualizadas = 0
  let omitidas = 0

  for (const payload of payloads) {
    const existente = await buscarCotizacionPorClaveUpsert(payload.claveUpsertCompra)
    if (!existente) {
      await crearCotizacion(payload)
      creadas += 1
      continue
    }
    if (!debeActualizarCompraExistente(existente.fecha, payload.fecha)) {
      omitidas += 1
      continue
    }
    await actualizarCotizacion(existente.id, cambiosDesdeCompra(payload))
    actualizadas += 1
  }

  return { creadas, actualizadas, omitidas }
}

function cambiosDesdeCompra(
  payload: PayloadCotizacionDesdeOrden
): Partial<Omit<Cotizacion, "id" | "creadoEn">> {
  return {
    fecha: payload.fecha,
    precioUnitario: payload.precioUnitario,
    cantidad: payload.cantidad,
    total: payload.total,
    moneda: payload.moneda,
    origen: "compra",
    ordenIdOrigen: payload.ordenIdOrigen,
    notas: payload.notas,
    claveUpsertCompra: payload.claveUpsertCompra,
    llavePieza: payload.llavePieza,
    solicitante: payload.solicitante,
    ...(payload.link ? { link: payload.link } : {}),
  }
}
