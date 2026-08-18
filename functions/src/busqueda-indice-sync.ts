import * as functions from "firebase-functions"
import { getCallablePrincipal, errorMessage } from "./auth"
import { getDb } from "./firestore-db"
import { sincronizarIndiceBusqueda } from "./busqueda-indice-escritura"

const db = getDb()

// Prefijado (no GEMINI_API_KEY a secas): smv-brain es compartido con
// SMV-VISION y Visual Factory — mismo criterio que FINANZAS_ODOO_* en
// odooSync.ts, para no pisar un secreto de nombre plano de otra app en el
// próximo deploy de cualquiera de las dos.
// Configurar con: firebase functions:secrets:set HUB_GEMINI_API_KEY
const GEMINI_SECRETS = ["HUB_GEMINI_API_KEY"]

async function ejecutarSyncConLogging() {
  const apiKey = process.env.HUB_GEMINI_API_KEY
  if (!apiKey) throw new Error("Falta el secreto HUB_GEMINI_API_KEY")

  const ahora = new Date()
  try {
    const resultado = await sincronizarIndiceBusqueda(apiKey)
    await db.collection("busqueda_indice_sync_state").doc("estado").set({
      ultimaCorridaEn: ahora,
      ultimoError: null,
      ...resultado,
    })
    console.log(
      `Sync índice de búsqueda: ${resultado.entradasEsperadas} entradas (${resultado.reembebidas} reembebidas, ${resultado.sinCambios} sin cambios, ${resultado.podadas} podadas)`
    )
    return resultado
  } catch (error) {
    console.error("Sync índice de búsqueda falló:", errorMessage(error))
    await db.collection("busqueda_indice_sync_state").doc("estado").set(
      { ultimoError: errorMessage(error), ultimoErrorEn: ahora },
      { merge: true }
    )
    throw error
  }
}

// Cada 24h, no cada 2h como los syncs de Odoo: a diferencia de facturación o
// compras, el propio spec dice que la búsqueda semántica no necesita
// frescura de minutos ("nadie espera que una compra capturada hace 30
// segundos ya esté indexada") — ver "Cómo se mantiene fresco" en el spec.
export const syncBusquedaIndiceScheduled = functions
  .runWith({ secrets: GEMINI_SECRETS, timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 24 hours")
  .onRun(async () => {
    try {
      await ejecutarSyncConLogging()
    } catch {
      // Ya quedó registrado en busqueda_indice_sync_state.
    }
  })

// Botón "Reindexar ahora" (sin UI todavía — se invoca manualmente para
// validar Fase 4 contra smv-brain-dev antes de exponerlo). Gateado a
// super-admin: dispara costo real de Gemini y reescribe una colección entera.
export const syncBusquedaIndiceManual = functions
  .runWith({ secrets: GEMINI_SECRETS, timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
    const principal = await getCallablePrincipal(context)
    if (!principal.isSuperAdmin && !principal.isBreakGlass) {
      throw new functions.https.HttpsError("permission-denied", "Requiere super-admin.")
    }
    try {
      return await ejecutarSyncConLogging()
    } catch (error) {
      throw new functions.https.HttpsError("internal", errorMessage(error))
    }
  })
