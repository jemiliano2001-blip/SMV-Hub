import {
  orderBy,
  limit,
  type QueryConstraint,
} from "firebase/firestore"
import { makeDateConverter } from "@/lib/firestore-helpers"
import { crearRepositorio } from "@/lib/repositorio"
import { registrarAuditoria } from "@/lib/auditoria"
import { getClienteAuth } from "@/lib/firebase"
import { crearOrden } from "@/lib/ordenes"
import type {
  OrdenCompraUsa,
  ItemOrdenCompraUsa,
  EstadoOrdenCompraUsa,
  HistorialNotaUsa,
} from "@/lib/schemas"

const poConverter = makeDateConverter<OrdenCompraUsa>()

const repo = crearRepositorio<OrdenCompraUsa>({
  coleccion: "ordenes_compra_usa",
  converter: poConverter,
})

export const EMPRESA_USA_DEFAULT = "RGV Metal and Plastics CO."
export const DIRECCION_USA_DEFAULT = "5423 Lovers Ln Brownsville, Texas 78526"

export const TERMINOS_PAGO_USA_OPCIONES = [
  { id: "Credit (Net 30)", label: "Credit (Net 30) - Principal" },
  { id: "Credit (Net 60)", label: "Credit (Net 60)" },
  { id: "Credit (Net 15)", label: "Credit (Net 15)" },
  { id: "Credit (Net 45)", label: "Credit (Net 45)" },
  { id: "Credit (Net 90)", label: "Credit (Net 90)" },
  { id: "Corporate Credit Card", label: "Tarjeta de Crédito Corporativa (Credit Card)" },
  { id: "Wire Transfer / ACH", label: "Transferencia Bancaria / Wire / ACH" },
  { id: "Prepaid / Advance Payment", label: "Prepago / Pago Anticipado (Prepaid)" },
  { id: "Check / COD", label: "Cheque / Cobro contra entrega (COD)" },
] as const

export const TERMINOS_PAGO_DEFAULT = "Credit (Net 30)"

/**
 * Calcula los totales de una Purchase Order a partir de sus partidas.
 */
export function calcularTotalesPO(
  items: Array<Pick<ItemOrdenCompraUsa, "cantidad" | "precioUnitario" | "impuestos">>,
  envio = 0
): {
  subtotal: number
  impuestos: number
  envio: number
  total: number
  itemsConSubtotal: { subtotal: number }[]
} {
  let subtotal = 0
  let totalImpuestos = 0

  const itemsConSubtotal = items.map((it) => {
    const cant = Number.isFinite(it.cantidad) && it.cantidad > 0 ? it.cantidad : 0
    const precio = Number.isFinite(it.precioUnitario) && it.precioUnitario >= 0 ? it.precioUnitario : 0
    const itemSubtotal = Math.round(cant * precio * 100) / 100
    const itemImpuestos = Number.isFinite(it.impuestos) && it.impuestos >= 0 ? it.impuestos : 0

    subtotal += itemSubtotal
    totalImpuestos += itemImpuestos

    return { subtotal: itemSubtotal }
  })

  subtotal = Math.round(subtotal * 100) / 100
  totalImpuestos = Math.round(totalImpuestos * 100) / 100
  const envioLimpio = Number.isFinite(envio) && envio >= 0 ? Math.round(envio * 100) / 100 : 0
  const total = Math.round((subtotal + totalImpuestos + envioLimpio) * 100) / 100

  return {
    subtotal,
    impuestos: totalImpuestos,
    envio: envioLimpio,
    total,
    itemsConSubtotal,
  }
}

/**
 * Genera el siguiente folio secuencial automático en formato PO-YYYY-XXXX (ej. PO-2026-0001).
 */
export async function generarSiguienteFolioPO(): Promise<string> {
  const anioActual = new Date().getFullYear()
  const prefijo = `PO-${anioActual}-`

  try {
    const ordenesRecientes = await repo.listar([
      orderBy("creadoEn", "desc"),
      limit(50),
    ])

    let maxNum = 0
    for (const ord of ordenesRecientes) {
      if (ord.folio && ord.folio.startsWith(prefijo)) {
        const numPart = ord.folio.slice(prefijo.length)
        const parsed = parseInt(numPart, 10)
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed
        }
      }
    }

    const siguienteNum = maxNum + 1
    const secStr = String(siguienteNum).padStart(4, "0")
    return `${prefijo}${secStr}`
  } catch {
    const fallbackSec = Math.floor(1000 + Math.random() * 9000)
    return `${prefijo}${fallbackSec}`
  }
}

export type NuevaOrdenCompraUsaPayload = Omit<
  OrdenCompraUsa,
  "id" | "creadoEn" | "actualizadoEn" | "folio" | "subtotal" | "impuestos" | "total" | "creadoPor" | "historialNotas"
> & {
  folio?: string
  subtotal?: number
  impuestos?: number
  total?: number
  creadoPor?: string
  historialNotas?: HistorialNotaUsa[]
}

/**
 * Crea una nueva Purchase Order en Firestore.
 */
export async function crearOrdenCompraUsa(
  payload: NuevaOrdenCompraUsaPayload
): Promise<{ id: string; folio: string }> {
  const folio = payload.folio?.trim() || (await generarSiguienteFolioPO())
  const user = getClienteAuth().currentUser
  const usuarioEmail = user?.email || payload.creadoPor || "desconocido"

  const totales = calcularTotalesPO(payload.items, payload.envio)

  const itemsNormalizados: ItemOrdenCompraUsa[] = payload.items.map((it, idx) => ({
    producto: it.producto?.trim() || "",
    descripcion: it.descripcion?.trim() || "",
    cantidad: it.cantidad > 0 ? it.cantidad : 1,
    precioUnitario: it.precioUnitario >= 0 ? it.precioUnitario : 0,
    impuestos: it.impuestos >= 0 ? it.impuestos : 0,
    subtotal: totales.itemsConSubtotal[idx]?.subtotal ?? 0,
    fechaPlanificada: it.fechaPlanificada || null,
    cuentaCargo: it.cuentaCargo?.trim() || payload.cuentaCargo || "Stock",
    ordenTrabajo: it.ordenTrabajo?.trim() || payload.ordenTrabajo || "",
    claveProdServ: it.claveProdServ || null,
  }))

  const notaInicial: HistorialNotaUsa = {
    id: `nota-${Date.now()}`,
    fecha: new Date().toISOString(),
    autor: usuarioEmail,
    texto: `Creó orden de compra ${folio} para ${payload.proveedor} en estado ${payload.estado}`,
    tipo: "sistema",
  }

  const id = await repo.crear(
    {
      ...payload,
      folio,
      empresa: payload.empresa?.trim() || EMPRESA_USA_DEFAULT,
      terminosPago: payload.terminosPago?.trim() || TERMINOS_PAGO_DEFAULT,
      shippingAddressUSA: payload.shippingAddressUSA?.trim() || DIRECCION_USA_DEFAULT,
      items: itemsNormalizados,
      subtotal: totales.subtotal,
      impuestos: totales.impuestos,
      envio: totales.envio,
      total: totales.total,
      creadoPor: usuarioEmail,
      historialNotas: payload.historialNotas?.length ? [...payload.historialNotas, notaInicial] : [notaInicial],
    },
    `Creó orden de compra USA ${folio} (${payload.proveedor})`
  )

  return { id, folio }
}

/**
 * Actualiza una Purchase Order existente.
 */
export async function actualizarOrdenCompraUsa(
  id: string,
  cambios: Partial<Omit<OrdenCompraUsa, "id" | "creadoEn">>
): Promise<void> {
  const user = getClienteAuth().currentUser
  const usuarioEmail = user?.email || "desconocido"

  let payloadAjustado = { ...cambios }

  if (cambios.items) {
    // Sin `envio` explicito hay que leer el guardado: asumir 0 borraria el flete del total.
    const envioEfectivo = cambios.envio ?? (await repo.obtener(id))?.envio ?? 0
    const totales = calcularTotalesPO(cambios.items, envioEfectivo)
    payloadAjustado = {
      ...payloadAjustado,
      subtotal: totales.subtotal,
      impuestos: totales.impuestos,
      envio: totales.envio,
      total: totales.total,
      items: cambios.items.map((it, idx) => ({
        ...it,
        subtotal: totales.itemsConSubtotal[idx]?.subtotal ?? 0,
      })),
    }
  }

  await repo.actualizar(id, payloadAjustado, `Actualizó orden de compra USA ${id}`)
  await registrarAuditoria(
    usuarioEmail,
    "EDITAR",
    "ordenes_compra_usa",
    id,
    `Actualizó datos de la orden de compra USA ${id}`
  )
}

/**
 * Cambia el estado de una PO y registra una nota en su historial.
 */
export async function cambiarEstadoOrdenCompraUsa(
  id: string,
  nuevoEstado: EstadoOrdenCompraUsa,
  notaTexto?: string
): Promise<void> {
  const actual = await repo.obtener(id)
  if (!actual) throw new Error(`Orden ${id} no encontrada`)

  const user = getClienteAuth().currentUser
  const usuarioEmail = user?.email || "desconocido"

  const nuevaNota: HistorialNotaUsa = {
    id: `nota-${Date.now()}`,
    fecha: new Date().toISOString(),
    autor: usuarioEmail,
    texto: notaTexto?.trim()
      ? `Cambió estado a ${nuevoEstado}. Nota: ${notaTexto.trim()}`
      : `Cambió estado a ${nuevoEstado}`,
    tipo: "cambio_estado",
  }

  const notasActualizadas = [...(actual.historialNotas || []), nuevaNota]

  await repo.actualizar(
    id,
    {
      estado: nuevoEstado,
      historialNotas: notasActualizadas,
    },
    `Cambió estado de ${actual.folio} a ${nuevoEstado}`
  )
}

/**
 * Agrega una nota de texto al historial/chatter de la PO.
 */
export async function agregarNotaOrdenCompraUsa(
  id: string,
  texto: string
): Promise<void> {
  if (!texto.trim()) return
  const actual = await repo.obtener(id)
  if (!actual) throw new Error(`Orden ${id} no encontrada`)

  const user = getClienteAuth().currentUser
  const usuarioEmail = user?.email || "desconocido"

  const nuevaNota: HistorialNotaUsa = {
    id: `nota-${Date.now()}`,
    fecha: new Date().toISOString(),
    autor: usuarioEmail,
    texto: texto.trim(),
    tipo: "nota",
  }

  await repo.actualizar(
    id,
    {
      historialNotas: [...(actual.historialNotas || []), nuevaNota],
    },
    `Agregó nota a ${actual.folio}`
  )
}

/**
 * Registra una PO en la bitácora general de órdenes de SMV Hub (`ordenes`).
 */
export async function registrarPOEnBitacoraOrdenes(
  po: OrdenCompraUsa
): Promise<{ ordenHubId: string }> {
  if (po.ordenHubId) {
    return { ordenHubId: po.ordenHubId }
  }

  const user = getClienteAuth().currentUser
  const usuarioEmail = user?.email || "desconocido"

  const requisitor = po.solicitante || po.comprador || "SMV Compras"
  const empresa = po.empresa || EMPRESA_USA_DEFAULT
  const cuentaCargo = po.cuentaCargo || "Stock"
  const ordenTrabajo = po.ordenTrabajo || ""

  const ordenId = await crearOrden({
    proveedor: po.proveedor,
    proveedorId: po.proveedorId || null,
    numeroFactura: po.referenciaProveedor || po.folio,
    fechaFactura: po.fechaPedido,
    moneda: po.moneda,
    subtotal: po.subtotal,
    envio: po.envio,
    impuestos: po.impuestos,
    total: po.total,
    estado: "aprobada",
    estadoRecepcion: "recibida",
    fechaRecepcion: po.fechaEntregaEstimada || po.fechaPedido,
    recibidoPor: usuarioEmail,
    requisitor,
    empresa,
    destino: empresa,
    cuentaCargo,
    ordenTrabajo,
    cotizacionGanadoraId: po.cotizacionId || null,
    requisicionId: po.requisicionId || null,
    items: po.items.map((it) => ({
      descripcion: it.descripcion,
      descripcionSimplificada: it.producto ? `[${it.producto}] ${it.descripcion}` : it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      total: it.subtotal,
      claveProdServ: it.claveProdServ || null,
      satPendiente: false,
      empresa: empresa,
      cuentaCargo: it.cuentaCargo || cuentaCargo,
      requisitor: requisitor,
      ordenTrabajo: it.ordenTrabajo || ordenTrabajo,
    })),
  })

  await cambiarEstadoOrdenCompraUsa(
    po.id,
    "recibida",
    `Registrado en bitácora de órdenes con ID ${ordenId}`
  )

  await repo.actualizar(po.id, {
    ordenHubId: ordenId,
    estado: "recibida",
  })

  return { ordenHubId: ordenId }
}

export async function obtenerOrdenCompraUsa(id: string): Promise<OrdenCompraUsa | null> {
  return repo.obtener(id)
}

export async function listarOrdenesCompraUsa(
  constraints: QueryConstraint[] = [orderBy("creadoEn", "desc")]
): Promise<OrdenCompraUsa[]> {
  return repo.listar(constraints)
}

export async function eliminarOrdenCompraUsa(id: string): Promise<void> {
  const user = getClienteAuth().currentUser
  const usuarioEmail = user?.email || "desconocido"
  await repo.eliminar(id, `Eliminó orden de compra USA ${id}`)
  await registrarAuditoria(
    usuarioEmail,
    "BORRAR",
    "ordenes_compra_usa",
    id,
    `Eliminó orden de compra USA ${id}`
  )
}
