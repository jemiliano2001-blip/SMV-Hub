import { FieldValue, type DocumentData } from "firebase-admin/firestore"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { adminDb } from "@/lib/firebase-admin"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { emitirNotificacionServer } from "@/lib/notificaciones-server"
import { NuevaSolicitudDocumentoSchema } from "@/lib/schemas"

const SOLICITUDES = "solicitudes_documento"
const VENTAS_SO = "ventas_odoo_so"
const RESERVAS = "solicitudes_documento_reservas"

class ConflictoSolicitud extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConflictoSolicitud"
  }
}

function idReserva(odooSoId: number, odooLineId: number): string {
  return `${odooSoId}_${odooLineId}`
}

function nombreTipo(tipo: "factura" | "remision"): string {
  return tipo === "factura" ? "Factura" : "Remisión"
}

function respuestaError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } })
}

function numeroFinito(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/**
 * Crea una solicitud dentro de una transacción y reserva las partidas de
 * remisión en documentos deterministas. La reserva evita que dos pestañas
 * que leen el mismo qtyPending puedan aprobar simultáneamente la misma
 * cantidad. Las reservas no son visibles para el cliente: sólo las escribe
 * este Route Handler con Admin SDK.
 */
export async function POST(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  const info = await obtenerUsuarioAdmin(auth.uid, auth.email)
  if (
    !info?.activo ||
    (!info.esSuperAdmin && !info.modulos.includes("documentos-venta"))
  ) {
    return respuestaError(403, "No tienes acceso a documentos de venta")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return respuestaError(400, "JSON inválido")
  }

  const parsed = NuevaSolicitudDocumentoSchema.safeParse(body)
  if (!parsed.success) return respuestaError(400, "Datos inválidos")
  const data = parsed.data

  if (data.solicitadoPorUid !== auth.uid) {
    return respuestaError(403, "La solicitud debe pertenecer al usuario autenticado")
  }
  if (data.tipo === "remision" && data.partidas.length === 0) {
    return respuestaError(400, "Selecciona al menos una partida")
  }

  try {
    const resultado = await adminDb.runTransaction(async (transaction) => {
      const soRef = adminDb.collection(VENTAS_SO).doc(`odoo_${data.odooSoId}`)
      const solicitudesQuery = adminDb
        .collection(SOLICITUDES)
        .where("odooSoId", "==", data.odooSoId)
      const soSnap = await transaction.get(soRef)
      const solicitudesSnap = await transaction.get(solicitudesQuery)

      if (!soSnap.exists) {
        throw new ConflictoSolicitud("La orden de venta ya no está disponible")
      }

      const soData = (soSnap.data() ?? {}) as DocumentData
      const lineasRaw = Array.isArray(soData.lineas) ? soData.lineas : []
      const lineas = new Map<number, { qtyPending: number; productName: string }>()
      for (const linea of lineasRaw) {
        if (!linea || typeof linea !== "object") continue
        const id = (linea as DocumentData).odooLineId
        const qtyPending = (linea as DocumentData).qtyPending
        if (!numeroFinito(id) || !Number.isInteger(id) || !numeroFinito(qtyPending)) continue
        lineas.set(id, {
          qtyPending: Math.max(0, qtyPending),
          productName: typeof (linea as DocumentData).productName === "string"
            ? (linea as DocumentData).productName
            : "Sin descripción",
        })
      }

      const activasPorLinea = new Map<number, number>()
      for (const solicitudSnap of solicitudesSnap.docs) {
        const solicitud = solicitudSnap.data() as DocumentData
        if (solicitud.estado !== "pendiente" && solicitud.estado !== "en_proceso") continue
        if (!Array.isArray(solicitud.partidas)) continue
        for (const partida of solicitud.partidas) {
          const lineId = partida?.odooLineId
          const qty = partida?.qtySolicitada
          if (!numeroFinito(lineId) || !numeroFinito(qty) || qty <= 0) continue
          activasPorLinea.set(lineId, (activasPorLinea.get(lineId) ?? 0) + qty)
        }
      }

      const cantidades = new Map<number, number>()
      const partidasValidadas = [] as Array<{
        odooLineId: number
        productName: string
        qtySolicitada: number
      }>
      for (const partida of data.partidas) {
        if (cantidades.has(partida.odooLineId)) {
          throw new ConflictoSolicitud(`La línea ${partida.odooLineId} está repetida`)
        }
        const linea = lineas.get(partida.odooLineId)
        if (!linea) throw new ConflictoSolicitud(`La línea ${partida.odooLineId} no pertenece a la SO`)
        const disponible = linea.qtyPending - (activasPorLinea.get(partida.odooLineId) ?? 0)
        if (!(partida.qtySolicitada > 0) || partida.qtySolicitada > disponible + 1e-9) {
          throw new ConflictoSolicitud(
            `La cantidad disponible de ${partida.productName || linea.productName} es ${Math.max(0, disponible)}`
          )
        }
        cantidades.set(partida.odooLineId, partida.qtySolicitada)
        partidasValidadas.push({
          odooLineId: partida.odooLineId,
          productName: linea.productName,
          qtySolicitada: partida.qtySolicitada,
        })
      }

      // Leer todas las reservas antes de escribirlas mantiene el orden de
      // lectura/escritura de la transacción y hace que dos creadores
      // concurrentes choquen en la misma clave determinista.
      const reservasRefs = [...cantidades.keys()].map((lineId) =>
        adminDb.collection(RESERVAS).doc(idReserva(data.odooSoId, lineId))
      )
      const reservasSnap = []
      for (const reservaRef of reservasRefs) reservasSnap.push(await transaction.get(reservaRef))

      const solicitudRef = adminDb.collection(SOLICITUDES).doc()
      const ahora = FieldValue.serverTimestamp()
      const solicitud = {
        ...data,
        odooSoName: typeof soData.name === "string" ? soData.name : data.odooSoName,
        clientOrderRef: typeof soData.clientOrderRef === "string" ? soData.clientOrderRef : null,
        ordenCompra: typeof soData.ordenCompra === "string" ? soData.ordenCompra : null,
        partnerName: typeof soData.partnerName === "string" && soData.partnerName.trim()
          ? soData.partnerName
          : data.partnerName,
        partidas: partidasValidadas,
        folioOdoo: null,
        motivoRechazo: null,
        atendidoPorUid: null,
        atendidoPorNombre: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      transaction.set(solicitudRef, solicitud)

      for (let i = 0; i < reservasRefs.length; i++) {
        const lineId = [...cantidades.keys()][i]
        const reservado = (activasPorLinea.get(lineId) ?? 0) + (cantidades.get(lineId) ?? 0)
        const reserva = {
          odooSoId: data.odooSoId,
          odooLineId: lineId,
          qtyReservada: reservado,
          actualizadoEn: ahora,
        }
        if (reservasSnap[i]?.exists) transaction.update(reservasRefs[i], reserva)
        else transaction.create(reservasRefs[i], reserva)
      }

      return { id: solicitudRef.id, solicitud }
    })

    const nombre = resultado.solicitud.solicitadoPorNombre.trim()
    await registrarAuditoriaServer(
      auth.email,
      "CREAR",
      SOLICITUDES,
      resultado.id,
      `Creó solicitud de ${nombreTipo(resultado.solicitud.tipo)} para SO ${resultado.solicitud.odooSoName}`
    )
    await emitirNotificacionServer({
      tipo: "solicitud_documento_creada",
      titulo: "Nueva solicitud de documento",
      cuerpo: `${nombreTipo(resultado.solicitud.tipo)} · ${resultado.solicitud.odooSoName} · ${resultado.solicitud.partnerName}`,
      origenModulo: "documentos-venta",
      origenId: resultado.id,
      audiencia: "documentos-venta",
      destinatarioUid: resultado.solicitud.solicitadoPorUid,
      href: `/documentos-venta?solicitud=${resultado.id}`,
      creadoPorUid: auth.uid,
      creadoPorNombre: nombre,
    })

    return Response.json({ id: resultado.id }, { status: 201 })
  } catch (error) {
    if (error instanceof ConflictoSolicitud) return respuestaError(409, error.message)
    console.error(
      "Error creando solicitud de documento:",
      error instanceof Error ? error.message : "error desconocido"
    )
    return respuestaError(500, "No se pudo crear la solicitud")
  }
}
