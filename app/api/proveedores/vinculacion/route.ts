import { z } from "zod"
import { FieldValue } from "firebase-admin/firestore"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { adminDb } from "@/lib/firebase-admin"
import {
  analizarVinculacionHistoricaEnMemoria,
  type AnalisisVinculacionHistorica,
  type DocumentoProveedorHistorico,
  type ProveedorCatalogoMinimo,
  type ResultadoBackfill,
  type VinculoProveedorPendiente,
} from "@/lib/proveedores-vinculacion-core"

const BATCH_SIZE = 400
const MAX_VINCULOS_MANUALES = 20

const RequestSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("analizar") }),
  z.object({ accion: z.literal("aplicarAutomaticas") }),
  z.object({
    accion: z.literal("vincularManual"),
    coleccion: z.enum(["ordenes", "cotizaciones"]),
    idsDocs: z.array(z.string().trim().min(1)).min(1).max(MAX_VINCULOS_MANUALES),
    proveedorId: z.string().trim().min(1),
  }),
])

function documentoHistorico(id: string, data: Record<string, unknown>): DocumentoProveedorHistorico {
  return {
    id,
    proveedor: typeof data.proveedor === "string" ? data.proveedor : "",
    proveedorId: typeof data.proveedorId === "string" ? data.proveedorId : null,
  }
}

function proveedorCatalogo(id: string, data: Record<string, unknown>): ProveedorCatalogoMinimo | null {
  const nombre = typeof data.nombre === "string" ? data.nombre.trim() : ""
  return nombre ? { id, nombre } : null
}

async function cargarAnalisis(): Promise<AnalisisVinculacionHistorica> {
  const [ordenesSnap, cotizacionesSnap, proveedoresSnap] = await Promise.all([
    adminDb.collection("ordenes").get(),
    adminDb.collection("cotizaciones").get(),
    adminDb.collection("proveedores").get(),
  ])

  const ordenes = ordenesSnap.docs.map((doc) => documentoHistorico(doc.id, doc.data()))
  const cotizaciones = cotizacionesSnap.docs.map((doc) => documentoHistorico(doc.id, doc.data()))
  const proveedores = proveedoresSnap.docs.flatMap((doc) => {
    const proveedor = proveedorCatalogo(doc.id, doc.data())
    return proveedor ? [proveedor] : []
  })

  return analizarVinculacionHistoricaEnMemoria(ordenes, cotizaciones, proveedores)
}

function respuestaPrevisualizacion(analisis: AnalisisVinculacionHistorica) {
  return {
    ordenes: analisis.ordenes,
    cotizaciones: analisis.cotizaciones,
    fantasmas: analisis.fantasmas,
  }
}

async function aplicarVinculos(
  coleccion: "ordenes" | "cotizaciones",
  vinculos: VinculoProveedorPendiente[]
): Promise<void> {
  for (let inicio = 0; inicio < vinculos.length; inicio += BATCH_SIZE) {
    const batch = adminDb.batch()
    for (const vinculo of vinculos.slice(inicio, inicio + BATCH_SIZE)) {
      batch.update(adminDb.collection(coleccion).doc(vinculo.id), {
        proveedorId: vinculo.proveedorId,
        actualizadoEn: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

function resultadoAplicado(analisis: AnalisisVinculacionHistorica): {
  ordenes: ResultadoBackfill
  cotizaciones: ResultadoBackfill
} {
  return { ordenes: analisis.ordenes, cotizaciones: analisis.cotizaciones }
}

export async function POST(request: Request) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Solicitud de vinculación inválida" }, { status: 400 })
  }

  try {
    if (parsed.data.accion === "analizar") {
      return Response.json(respuestaPrevisualizacion(await cargarAnalisis()), {
        headers: { "Cache-Control": "no-store" },
      })
    }

    if (parsed.data.accion === "aplicarAutomaticas") {
      const analisis = await cargarAnalisis()
      await Promise.all([
        aplicarVinculos("ordenes", analisis.vinculosOrdenes),
        aplicarVinculos("cotizaciones", analisis.vinculosCotizaciones),
      ])
      const resultado = resultadoAplicado(analisis)
      await registrarAuditoriaServer(
        auth.email,
        "EDITAR",
        "proveedores",
        "BACKFILL_PROVEEDOR_ID",
        `Vinculación automática exacta: ${resultado.ordenes.vinculados} órdenes y ${resultado.cotizaciones.vinculados} cotizaciones.`
      )
      return Response.json(resultado)
    }

    if (parsed.data.accion !== "vincularManual") {
      return Response.json({ error: "Acción de vinculación no soportada" }, { status: 400 })
    }
    const solicitud = parsed.data
    const idsDocs = [...new Set(solicitud.idsDocs)]
    const proveedorRef = adminDb.collection("proveedores").doc(solicitud.proveedorId)
    const [proveedor, ...documentos] = await adminDb.getAll(
      proveedorRef,
      ...idsDocs.map((id) => adminDb.collection(solicitud.coleccion).doc(id))
    )
    if (!proveedor.exists) {
      return Response.json({ error: "El proveedor seleccionado ya no existe en el catálogo." }, { status: 400 })
    }
    if (documentos.some((documento) => !documento.exists)) {
      return Response.json({ error: "Uno de los registros históricos ya no existe. Actualiza el análisis." }, { status: 409 })
    }

    await aplicarVinculos(
      solicitud.coleccion,
      idsDocs.map((id) => ({ id, proveedorId: solicitud.proveedorId }))
    )
    await registrarAuditoriaServer(
      auth.email,
      "EDITAR",
      solicitud.coleccion,
      "VINCULACION_MANUAL",
      `Vinculó ${idsDocs.length} registro(s) a proveedorId=${solicitud.proveedorId}.`
    )
    return Response.json({ ok: true })
  } catch (error) {
    console.error("[proveedores/vinculacion]", error)
    return Response.json({ error: "No se pudo completar la vinculación histórica." }, { status: 500 })
  }
}
