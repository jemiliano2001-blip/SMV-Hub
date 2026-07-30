import { FieldValue, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { adminDb } from "@/lib/firebase-admin"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { emitirNotificacionServer } from "@/lib/notificaciones-server"
import { construirResumenRegistro } from "@/lib/banos-solicitudes-borrado"
import { evaluarSolicitudBorradoConIa, type EvaluacionBano } from "@/lib/banos-ia"
import { CrearSolicitudBorradoBanoInputSchema, type RegistroBano } from "@/lib/schemas"

function registroDesdeSnapshot(id: string, data: DocumentData): RegistroBano {
  return {
    id,
    operador: data.operador,
    bano: data.bano,
    horaEntrada: data.horaEntrada,
    horaLlegada: data.horaLlegada ?? null,
    fecha: data.fecha,
    tiempoMinutos: data.tiempoMinutos ?? null,
    creadoEn: data.creadoEn.toDate(),
    actualizadoEn: data.actualizadoEn.toDate(),
    creadoPorUid: data.creadoPorUid,
    creadoPorNombre: data.creadoPorNombre,
  }
}

export async function POST(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => null)
    const parsed = CrearSolicitudBorradoBanoInputSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Datos inválidos" }, { status: 400 })
    }
    const { registroId, motivo, nota } = parsed.data

    const registroSnap = await adminDb.collection("registros-bano").doc(registroId).get()
    if (!registroSnap.exists) {
      return Response.json({ error: "El registro ya no existe" }, { status: 404 })
    }
    const registro = registroDesdeSnapshot(registroSnap.id, registroSnap.data() as DocumentData)

    const infoUsuario = await obtenerUsuarioAdmin(auth.uid, auth.email)
    const esSuperAdmin = infoUsuario?.esSuperAdmin === true
    if (registro.creadoPorUid !== auth.uid && !esSuperAdmin) {
      return Response.json(
        { error: "Solo quien creó el registro puede solicitar su eliminación" },
        { status: 403 }
      )
    }

    const yaPendiente = await adminDb
      .collection("solicitudes_borrado_banos")
      .where("registroId", "==", registroId)
      .where("estado", "==", "pendiente")
      .limit(1)
      .get()
    if (!yaPendiente.empty) {
      return Response.json({ error: "Ya hay una solicitud pendiente para este registro" }, { status: 409 })
    }

    const relacionadosSnap = await adminDb
      .collection("registros-bano")
      .where("operador", "==", registro.operador)
      .where("bano", "==", registro.bano)
      .where("fecha", "==", registro.fecha)
      .get()
    const relacionados = relacionadosSnap.docs.map((d: QueryDocumentSnapshot) => registroDesdeSnapshot(d.id, d.data()))

    let evaluacionIa: EvaluacionBano | null = null
    try {
      evaluacionIa = await evaluarSolicitudBorradoConIa({ registro, motivo, nota, relacionados })
    } catch (error) {
      // Una caída de Gemini nunca debe borrar ni rechazar datos automáticamente.
      console.error("Evaluación IA de Baños no disponible:", error instanceof Error ? error.message : "error desconocido")
    }

    const iaConConfianza = evaluacionIa && evaluacionIa.confianza >= 0.8 ? evaluacionIa : null
    const regla = iaConConfianza?.decision === "aprobar"
      ? "ia_aprobada"
      : iaConConfianza?.decision === "rechazar"
        ? "ia_rechazada"
        : null
    const registroResumen = construirResumenRegistro(registro)
    const solicitudRef = adminDb.collection("solicitudes_borrado_banos").doc()
    const solicitadoPorNombre = auth.email

    if (regla === "ia_rechazada") {
      await solicitudRef.set({
        registroId,
        registroResumen,
        motivo,
        ...(nota ? { nota } : {}),
        solicitadoPorUid: auth.uid,
        solicitadoPorNombre,
        estado: "rechazada",
        reglaAutoAplicada: regla,
        evaluacionIa,
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      })
      await emitirNotificacionServer({
        tipo: "banos_solicitud_resuelta",
        titulo: "Solicitud de borrado rechazada por IA",
        cuerpo: `${registro.operador} · ${registro.bano} (${registro.fecha}) — ${iaConConfianza?.motivo ?? "el registro se conserva"}`,
        origenModulo: "banos",
        origenId: solicitudRef.id,
        href: "/banos",
        creadoPorUid: auth.uid,
        creadoPorNombre: solicitadoPorNombre,
      })
      return Response.json({ estado: "rechazada", regla, evaluacionIa }, { status: 201 })
    }

    if (regla === "ia_aprobada") {
      await solicitudRef.set({
        registroId,
        registroResumen,
        motivo,
        ...(nota ? { nota } : {}),
        solicitadoPorUid: auth.uid,
        solicitadoPorNombre,
        estado: "auto_aprobada",
        reglaAutoAplicada: regla,
        evaluacionIa,
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      })
      await adminDb.collection("registros-bano").doc(registroId).delete()
      await registrarAuditoriaServer(
        auth.email,
        "BORRAR",
        "registros-bano",
        registroId,
        `Auto-aprobado (${regla}): eliminó registro de ${registro.operador}, solicitado por ${solicitadoPorNombre}`
      )
      await emitirNotificacionServer({
        tipo: "banos_solicitud_resuelta",
        titulo: "Solicitud de borrado auto-aprobada",
        cuerpo: `${registro.operador} · ${registro.bano} (${registro.fecha}) se borró automáticamente — regla: ${regla}`,
        origenModulo: "banos",
        origenId: solicitudRef.id,
        href: "/banos",
        creadoPorUid: auth.uid,
        creadoPorNombre: solicitadoPorNombre,
      })
      return Response.json({ estado: "auto_aprobada", regla, evaluacionIa }, { status: 201 })
    }

    await solicitudRef.set({
      registroId,
      registroResumen,
      motivo,
      ...(nota ? { nota } : {}),
      solicitadoPorUid: auth.uid,
      solicitadoPorNombre,
      estado: "pendiente",
      ...(evaluacionIa ? { evaluacionIa } : {}),
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    })
    await adminDb.collection("registros-bano").doc(registroId).update({ solicitudBorradoEstado: "pendiente" })
    await emitirNotificacionServer({
      tipo: "banos_solicitud_creada",
      titulo: "Solicitud de borrado de baño",
      cuerpo: `${registro.operador} · ${registro.bano} (${registro.fecha}) — motivo: ${motivo}${nota ? `: ${nota}` : ""}`,
      origenModulo: "banos",
      origenId: solicitudRef.id,
      href: "/banos",
      creadoPorUid: auth.uid,
      creadoPorNombre: solicitadoPorNombre,
    })
    return Response.json({ estado: "pendiente" }, { status: 201 })
  } catch (error: unknown) {
    console.error("Error creando solicitud de borrado de baño:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo crear la solicitud" }, { status: 500 })
  }
}
