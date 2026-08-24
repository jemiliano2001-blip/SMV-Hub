/**
 * Convierte líneas de una orden americana en filas de cotización.
 * Lógica pura: sin Firestore. El upsert vive en lib/cotizaciones.ts.
 */
import {
  generarLlavePieza,
  normalizarNombreProveedor,
  simplificarDescripcion,
} from "@/lib/pieza-matching"

export type ItemOrdenParaCotizacion = {
  descripcion: string
  cantidad: number | null
  precioUnitario: number | null
  total: number | null
  requisitor?: string
}

export type OrdenParaCotizacion = {
  id: string
  proveedor: string
  proveedorId?: string | null
  numeroFactura: string | null
  fechaFactura: string | null
  moneda: string
  linkProveedor?: string | null
  items: ItemOrdenParaCotizacion[]
  requisitor?: string
  creadoEn?: Date
}

export type PayloadCotizacionDesdeOrden = {
  solicitante: string
  fecha: string | null
  estatus: "cotizado"
  ubicacion: "MX" | "USA"
  proveedor: string
  proveedorId: string | null
  descripcion: string
  numeroParte: string | null
  llavePieza: string
  cantidad: number | null
  precioUnitario: number | null
  moneda: "USD" | "MXN"
  total: number | null
  diasHabiles: null
  link: string | null
  notas: string | null
  origen: "compra"
  ordenIdOrigen: string
  claveUpsertCompra: string
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Flete, tax y cargos: no son piezas buscables. */
const PATRON_RUIDO =
  /\b(freight|shipping|handling|sales\s*tax|vat|iva|envio|flete|impuesto|discount|descuento|fuel\s*surcharge|expedite|tarifa)\b/i

export function esCotizacionComprada(origen: string | null | undefined): boolean {
  return origen === "compra"
}

export function monedaDeOrden(moneda: string): "USD" | "MXN" {
  return moneda.trim().toUpperCase() === "MXN" ? "MXN" : "USD"
}

export function generarClaveUpsertCompra(input: {
  proveedor: string
  numeroParte: string | null | undefined
  descripcion: string
}): string {
  const proveedor = normalizarNombreProveedor(input.proveedor)
  const pieza = generarLlavePieza(input.numeroParte, input.descripcion)
  return `${proveedor}|${pieza}`
}

export function esLineaCompraParaCotizacion(item: ItemOrdenParaCotizacion): boolean {
  const descripcion = item.descripcion.trim()
  if (descripcion.length < 3) return false
  if (item.precioUnitario == null || item.precioUnitario <= 0) return false
  const simple = simplificarDescripcion(descripcion)
  if (!simple) return false
  const pareceCargo = PATRON_RUIDO.test(simple) && !/\d/.test(simple)
  if (pareceCargo) return false
  return true
}

export function fechaCotizacionDesdeOrden(orden: OrdenParaCotizacion): string | null {
  if (orden.fechaFactura && FECHA_ISO.test(orden.fechaFactura)) return orden.fechaFactura
  if (orden.creadoEn instanceof Date && !Number.isNaN(orden.creadoEn.getTime())) {
    return orden.creadoEn.toISOString().slice(0, 10)
  }
  return null
}

/**
 * True si la compra nueva debe pisar la fila existente.
 * Misma fecha o más reciente gana; una compra vieja no revierte un precio nuevo.
 */
export function debeActualizarCompraExistente(
  fechaExistente: string | null | undefined,
  fechaNueva: string | null
): boolean {
  const existenteOk = Boolean(fechaExistente && FECHA_ISO.test(fechaExistente))
  const nuevaOk = Boolean(fechaNueva && FECHA_ISO.test(fechaNueva))
  if (!nuevaOk || !fechaNueva) return !existenteOk
  if (!existenteOk || !fechaExistente) return true
  return fechaNueva >= fechaExistente
}

function notasDesdeOrden(orden: OrdenParaCotizacion): string {
  const folio = orden.numeroFactura?.trim()
  if (folio) return `Compra ${folio}`
  return `Compra ${orden.id}`
}

export function payloadsCotizacionDesdeOrden(
  orden: OrdenParaCotizacion
): PayloadCotizacionDesdeOrden[] {
  const proveedor = orden.proveedor.trim()
  if (!proveedor) return []

  const fecha = fechaCotizacionDesdeOrden(orden)
  const moneda = monedaDeOrden(orden.moneda)
  const ubicacion = moneda === "MXN" ? ("MX" as const) : ("USA" as const)
  const link = orden.linkProveedor?.trim() ? orden.linkProveedor.trim() : null
  const notas = notasDesdeOrden(orden)
  const proveedorId = orden.proveedorId ?? null

  const payloads: PayloadCotizacionDesdeOrden[] = []
  const clavesVistas = new Set<string>()

  for (const item of orden.items) {
    if (!esLineaCompraParaCotizacion(item)) continue
    const descripcion = item.descripcion.trim()
    const claveUpsertCompra = generarClaveUpsertCompra({
      proveedor,
      numeroParte: null,
      descripcion,
    })
    if (clavesVistas.has(claveUpsertCompra)) continue
    clavesVistas.add(claveUpsertCompra)

    const solicitante = item.requisitor?.trim() || orden.requisitor?.trim() || "Compras"
    payloads.push({
      solicitante,
      fecha,
      estatus: "cotizado",
      ubicacion,
      proveedor,
      proveedorId,
      descripcion,
      numeroParte: null,
      llavePieza: generarLlavePieza(null, descripcion),
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      moneda,
      total: item.total,
      diasHabiles: null,
      link,
      notas,
      origen: "compra",
      ordenIdOrigen: orden.id,
      claveUpsertCompra,
    })
  }

  return payloads
}
