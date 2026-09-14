import { z } from "zod"
import { FieldValue } from "firebase-admin/firestore"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { adminDb } from "@/lib/firebase-admin"
import { planBackfillMercado, type PlanBackfillMercado } from "@/lib/proveedor-mercado"

/**
 * Backfill de `mercado` / `origenProveedor` en `proveedores` (frente B, B4).
 *
 * Persiste lo que `lib/proveedores.ts` ya infiere al leer, para que el indexador semántico, el
 * sync de Odoo y los scripts vean lo mismo que la UI. Acción de super-admin con previsualización,
 * como la vinculación histórica: la cuenta de servicio local es de solo lectura a propósito y
 * los backfills viven en la app, auditados y repetibles.
 */

const BATCH_SIZE = 400

const RequestSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("previsualizar") }),
  z.object({ accion: z.literal("aplicar") }),
])

async function cargarPlan(): Promise<PlanBackfillMercado> {
  const snap = await adminDb.collection("proveedores").get()
  const docs = snap.docs.flatMap((doc) => {
    const data = doc.data()
    const nombre = typeof data.nombre === "string" ? data.nombre.trim() : ""
    if (!nombre) return []
    return [
      {
        id: doc.id,
        nombre,
        mercado: data.mercado,
        origenProveedor: data.origenProveedor,
        odooPartnerId: data.odooPartnerId,
      },
    ]
  })
  return planBackfillMercado(docs)
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
    return Response.json({ error: "Solicitud de backfill inválida" }, { status: 400 })
  }

  try {
    const plan = await cargarPlan()
    if (parsed.data.accion === "previsualizar") {
      return Response.json(plan, { headers: { "Cache-Control": "no-store" } })
    }

    for (let inicio = 0; inicio < plan.cambios.length; inicio += BATCH_SIZE) {
      const batch = adminDb.batch()
      for (const cambio of plan.cambios.slice(inicio, inicio + BATCH_SIZE)) {
        batch.update(adminDb.collection("proveedores").doc(cambio.id), {
          ...cambio.cambios,
          actualizadoEn: FieldValue.serverTimestamp(),
        })
      }
      await batch.commit()
    }

    const conMercado = plan.cambios.filter((c) => c.cambios.mercado).length
    const conOrigen = plan.cambios.filter((c) => c.cambios.origenProveedor).length
    await registrarAuditoriaServer(
      auth.email,
      "EDITAR",
      "proveedores",
      "BACKFILL_MERCADO",
      `Persistió mercado en ${conMercado} y origenProveedor en ${conOrigen} proveedor(es) (${plan.sinCambio} ya estaban completos).`
    )
    return Response.json({ ok: true, aplicados: plan.cambios.length, conMercado, conOrigen, sinCambio: plan.sinCambio })
  } catch (error) {
    console.error("[proveedores/backfill-mercado]", error)
    return Response.json({ error: "No se pudo completar el backfill de mercado." }, { status: 500 })
  }
}
