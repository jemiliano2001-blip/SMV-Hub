import { z } from "zod"
import { FieldValue } from "firebase-admin/firestore"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { adminDb } from "@/lib/firebase-admin"
import { planBackfillLeadTime, type PlanBackfillLeadTime } from "@/lib/lead-time"

/**
 * Backfill de `leadTimeMinDias` / `leadTimeMaxDias` en `cotizaciones` (frente B, B3).
 *
 * Recalcula el lead time desde `diasHabiles` con `lib/lead-time.ts` y escribe solo donde difiere
 * (idempotente); los textos no parseables quedan explícitamente en null. Acción de super-admin
 * con previsualización, auditada — mismo patrón que la vinculación histórica y el backfill de
 * mercado.
 */

const BATCH_SIZE = 400

const RequestSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("previsualizar") }),
  z.object({ accion: z.literal("aplicar") }),
])

async function cargarPlan(): Promise<PlanBackfillLeadTime> {
  const snap = await adminDb.collection("cotizaciones").select("diasHabiles", "leadTimeMinDias", "leadTimeMaxDias").get()
  return planBackfillLeadTime(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
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
        batch.update(adminDb.collection("cotizaciones").doc(cambio.id), {
          leadTimeMinDias: cambio.leadTimeMinDias,
          leadTimeMaxDias: cambio.leadTimeMaxDias,
          actualizadoEn: FieldValue.serverTimestamp(),
        })
      }
      await batch.commit()
    }

    const parseadas = plan.cambios.filter((c) => c.leadTimeMinDias !== null).length
    await registrarAuditoriaServer(
      auth.email,
      "EDITAR",
      "cotizaciones",
      "BACKFILL_LEAD_TIME",
      `Lead time derivado en ${plan.cambios.length} cotización(es): ${parseadas} parseadas, ${plan.cambios.length - parseadas} en null explícito (${plan.yaCorrectos} ya estaban).`
    )
    return Response.json({ ok: true, aplicados: plan.cambios.length, parseadas, nulas: plan.cambios.length - parseadas, yaCorrectos: plan.yaCorrectos })
  } catch (error) {
    console.error("[cotizaciones/backfill-lead-time]", error)
    return Response.json({ error: "No se pudo completar el backfill de lead time." }, { status: 500 })
  }
}
