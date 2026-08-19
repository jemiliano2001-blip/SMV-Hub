import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { emitirNotificacionServer } from "@/lib/notificaciones-server"
import { fechaHoyLocal } from "@/lib/format"

export interface RecibirOrdenParams {
  ordenId: string
  uid: string
  email: string
  nombre?: string | null
  notas?: string | null
}

export interface ResultadoRecepcionOrden {
  estadoRecepcion: "recibida"
  entradaAlmacenId: string
}

export class ErrorRecepcionOrden extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = "ErrorRecepcionOrden"
    this.statusCode = statusCode
  }
}

/**
 * Orquesta la recepción en cascada de una Orden de Compra en el Almacén.
 * Ejecuta con Admin SDK para garantizar que el personal de almacén pueda cerrar
 * el ciclo sin bloqueos por permisos de múltiples colecciones cliente.
 */
export async function recibirOrdenEnAlmacen(
  params: RecibirOrdenParams
): Promise<ResultadoRecepcionOrden> {
  const { ordenId, uid, email, nombre, notas } = params
  const nombreRecibio = nombre?.trim() || email.trim() || "Almacén"
  const hoy = fechaHoyLocal()

  // ── 1. FASE DE LECTURA (Antes del batch) ───────────────────────────────────

  const ordenRef = adminDb.collection("ordenes").doc(ordenId)
  const ordenSnap = await ordenRef.get()

  if (!ordenSnap.exists) {
    throw new ErrorRecepcionOrden("Orden de compra no encontrada", 404)
  }

  const ordenData = ordenSnap.data() || {}

  // Idempotencia estricta: si ya fue recibida, responder 409 sin duplicar registros.
  if (ordenData.estadoRecepcion === "recibida") {
    throw new ErrorRecepcionOrden("Esta orden de compra ya fue recibida en almacén", 409)
  }

  // Consulta inversa a pedidos-almacén (para rescatar solicitadoPorUid del solicitante)
  const pedidosSnap = await adminDb
    .collection("pedidos-almacen")
    .where("ordenIdVinculada", "==", ordenId)
    .limit(1)
    .get()

  const pedidoDoc = !pedidosSnap.empty ? pedidosSnap.docs[0] : null
  const pedidoData = pedidoDoc ? pedidoDoc.data() : null
  const solicitadoPorUid = typeof pedidoData?.solicitadoPorUid === "string" ? pedidoData.solicitadoPorUid : null

  // Lectura opcional de la requisición vinculada
  let requisicionData: Record<string, unknown> | null = null
  let reqRef = null
  if (typeof ordenData.requisicionId === "string" && ordenData.requisicionId.trim()) {
    reqRef = adminDb.collection("requisiciones").doc(ordenData.requisicionId)
    const reqSnap = await reqRef.get()
    if (reqSnap.exists) {
      requisicionData = reqSnap.data() || null
    }
  }

  // ── 2. FASE DE ESCRITURA ATÓMICA (adminDb.batch) ──────────────────────────

  const batch = adminDb.batch()
  const entradaRef = adminDb.collection("almacen-entradas").doc()

  // Construir descripción y cantidad amigables para almacén
  const primerItemDesc = Array.isArray(ordenData.items) && ordenData.items[0]?.descripcion
    ? String(ordenData.items[0].descripcion)
    : null
  const totalItems = Array.isArray(ordenData.items) ? ordenData.items.length : 0

  const descripcionEntrada = primerItemDesc
    ? totalItems > 1
      ? `${primerItemDesc} (+${totalItems - 1} partida${totalItems - 1 > 1 ? "s" : ""})`
      : primerItemDesc
    : ordenData.proveedor
      ? `Material de ${ordenData.proveedor}`
      : `Recepción de Orden ${ordenId}`

  const cantidadTotal = Array.isArray(ordenData.items)
    ? ordenData.items.reduce((acc, it) => acc + (typeof it?.cantidad === "number" ? it.cantidad : 1), 0)
    : 1

  const cargoA =
    (Array.isArray(ordenData.items) && ordenData.items[0]?.cuentaCargo) ||
    ordenData.cuentaCargo ||
    ordenData.empresa ||
    "Almacén"

  // A. Crear registro en 'almacen-entradas'
  batch.set(entradaRef, {
    fecha: hoy,
    descripcion: descripcionEntrada,
    cantidad: `${cantidadTotal} pz(s)`,
    cargoA: String(cargoA),
    recibio: nombreRecibio,
    revision: null,
    estatus: "entregado",
    notas: notas?.trim() || `Recepción automática de OC ${ordenData.proveedor || ordenId}`,
    ordenId,
    proveedor: ordenData.proveedor || null,
    creadoEn: FieldValue.serverTimestamp(),
    actualizadoEn: FieldValue.serverTimestamp(),
  })

  // B. Actualizar Orden en 'ordenes'
  batch.update(ordenRef, {
    estadoRecepcion: "recibida",
    fechaRecepcion: hoy,
    recibidoPor: nombreRecibio,
    entradaAlmacenId: entradaRef.id,
    actualizadoEn: FieldValue.serverTimestamp(),
  })

  // C. Si hubo requisición, actualizar su estado a 'recibido'
  if (reqRef && requisicionData) {
    batch.update(reqRef, {
      estado: "recibido",
      recibio: nombreRecibio,
      actualizadoEn: FieldValue.serverTimestamp(),
    })
  }

  // D. Si hubo pedido de almacén, marcar timestamp de actualización
  if (pedidoDoc) {
    batch.update(pedidoDoc.ref, {
      actualizadoEn: FieldValue.serverTimestamp(),
    })
  }

  await batch.commit()

  // ── 3. POST-COMMIT: NOTIFICACIÓN Y AUDITORÍA (Best-Effort) ────────────────

  try {
    if (solicitadoPorUid) {
      await emitirNotificacionServer({
        tipo: "orden_recibida_almacen",
        titulo: "Material recibido en almacén",
        cuerpo: `Tu pedido de almacén vinculado a ${ordenData.proveedor || "la orden"} ya fue recibido en almacén y está disponible.`,
        origenModulo: "pedidos-almacen",
        origenId: pedidoDoc?.id || ordenId,
        audiencia: "pedidos-almacen",
        destinatarioUid: solicitadoPorUid,
        href: "/pedidos-almacen",
        creadoPorUid: uid,
        creadoPorNombre: nombreRecibio,
      })
    } else if (ordenData.requisicionId) {
      const folioReq = typeof requisicionData?.folio === "string" ? requisicionData.folio : ordenData.requisicionId
      await emitirNotificacionServer({
        tipo: "orden_recibida_almacen",
        titulo: "Material recibido en almacén",
        cuerpo: `La requisición ${folioReq} (${ordenData.proveedor || "material"}) fue recibida en almacén.`,
        origenModulo: "requisiciones",
        origenId: String(ordenData.requisicionId),
        audiencia: "requisiciones",
        destinatarioUid: null,
        href: "/requisiciones",
        creadoPorUid: uid,
        creadoPorNombre: nombreRecibio,
      })
    }

    await registrarAuditoriaServer(
      email,
      "EDITAR",
      "ordenes",
      ordenId,
      `Marcó orden como recibida en almacén (Entrada ${entradaRef.id})`
    )
  } catch (err) {
    console.error("Error post-commit en recepción de orden (no bloqueante):", err)
  }

  return {
    estadoRecepcion: "recibida",
    entradaAlmacenId: entradaRef.id,
  }
}
