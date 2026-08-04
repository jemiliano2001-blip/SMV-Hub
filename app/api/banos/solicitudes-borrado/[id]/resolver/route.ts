import { FieldValue, type DocumentData } from "firebase-admin/firestore"
import { z } from "zod"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { adminDb } from "@/lib/firebase-admin"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { emitirNotificacionServer } from "@/lib/notificaciones-server"
import type { SolicitudBorradoBano } from "@/lib/schemas"

const ResolverSolicitudInputSchema = z.object({
  decision: z.enum(["aprobar", "rechazar"]),
})

type SolicitudBorradoBanoData = Omit<SolicitudBorradoBano, "id" | "creadoEn" | "actualizadoEn">

function solicitudDesdeSnapshot(data: DocumentData): SolicitudBorradoBanoData {
  return {
    registroId: data.registroId,
    registroResumen: data.registroResumen,
    motivo: data.motivo,
    nota: data.nota,
    solicitadoPorUid: data.solicitadoPorUid,
    solicitadoPorNombre: data.solicitadoPorNombre,
    estado: data.estado,
    reglaAutoAplicada: data.reglaAutoAplicada,
    resueltoPorUid: data.resueltoPorUid,
    resueltoPorNombre: data.resueltoPorNombre,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const body = await request.json().catch(() => null)
    const parsed = ResolverSolicitudInputSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Decisión inválida" }, { status: 400 })
    }

    const solicitudRef = adminDb.collection("solicitudes_borrado_banos").doc(id)
    const solicitudSnap = await solicitudRef.get()
    if (!solicitudSnap.exists) {
      return Response.json({ error: "Solicitud no encontrada" }, { status: 404 })
    }
    const solicitud = solicitudDesdeSnapshot(solicitudSnap.data() as DocumentData)
    if (solicitud.estado !== "pendiente") {
      return Response.json({ error: "Esta solicitud ya fue resuelta" }, { status: 409 })
    }

    const nuevoEstado = parsed.data.decision === "aprobar" ? "aprobada" : "rechazada"

    const registroRef = adminDb.collection("registros-bano").doc(solicitud.registroId)
    if (nuevoEstado === "aprobada") {
      // delete() es idempotente: si el registro ya desaparecio, la solicitud
      // aun puede cerrarse y no queda bloqueada en estado pendiente.
      await registroRef.delete()
      await registrarAuditoriaServer(
        auth.email,
        "BORRAR",
        "registros-bano",
        solicitud.registroId,
        `Aprobó solicitud de ${solicitud.solicitadoPorNombre}: eliminó registro de ${solicitud.registroResumen.operador}`
      )
    } else {
      // Un registro borrado entre la solicitud y la resolucion no debe hacer
      // fallar el rechazo ni recrear un documento vacio.
      const registroSnap = await registroRef.get()
      if (registroSnap.exists) {
        await registroRef.set({ solicitudBorradoEstado: FieldValue.delete() }, { merge: true })
      }
    }

    await solicitudRef.update({
      estado: nuevoEstado,
      resueltoPorUid: auth.uid,
      resueltoPorNombre: auth.email,
      actualizadoEn: FieldValue.serverTimestamp(),
    })

    await emitirNotificacionServer({
      tipo: "banos_solicitud_resuelta",
      titulo:
        nuevoEstado === "aprobada" ? "Solicitud de borrado aprobada" : "Solicitud de borrado rechazada",
      cuerpo: `${solicitud.registroResumen.operador} · ${solicitud.registroResumen.bano} (${solicitud.registroResumen.fecha}) — ${
        nuevoEstado === "aprobada" ? "se eliminó" : "se conserva"
      }`,
      origenModulo: "banos",
      origenId: id,
      audiencia: "banos",
      destinatarioUid: solicitud.solicitadoPorUid,
      href: "/banos",
      creadoPorUid: auth.uid,
      creadoPorNombre: auth.email,
    })

    return Response.json({ estado: nuevoEstado })
  } catch (error: unknown) {
    console.error("Error resolviendo solicitud de borrado de baño:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo resolver la solicitud" }, { status: 500 })
  }
}
