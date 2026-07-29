/**
 * Inicializa de forma idempotente reportes_integridad_state/config.
 *
 * Seguro por defecto:
 *   node scripts/init-reportes-integridad-config.mjs
 *     -> smv-brain-dev, mode=off
 *
 * Ejemplos:
 *   node scripts/init-reportes-integridad-config.mjs --project=smv-brain-dev --mode=shadow
 *   node scripts/init-reportes-integridad-config.mjs --project=smv-brain --mode=off --confirm-production
 *   node scripts/init-reportes-integridad-config.mjs --project=smv-brain --mode=shadow --confirm-production-shadow
 */
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const index = arg.indexOf("=")
      return [arg.slice(2, index), arg.slice(index + 1)]
    })
)
const flags = new Set(process.argv.slice(2).filter((arg) => !arg.includes("=")))
const projectId = args.get("project") ?? "smv-brain-dev"
const mode = args.get("mode") ?? "off"
const databaseId = "compras-americanas"

if (!["off", "shadow", "pilot", "on"].includes(mode)) {
  throw new Error("--mode debe ser off, shadow, pilot u on")
}
if (projectId === "smv-brain") {
  const confirmedOff =
    mode === "off" && flags.has("--confirm-production")
  const confirmedShadow =
    mode === "shadow" && flags.has("--confirm-production-shadow")
  if (!confirmedOff && !confirmedShadow) {
    throw new Error(
      "Producción permite off con --confirm-production o shadow con --confirm-production-shadow. Pilot/on requieren el gate formal y no se habilitan con este script."
    )
  }
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const adcCli = join(
    homedir(),
    "AppData",
    "Roaming",
    "firebase",
    "jemiliano2001_gmail_com_application_default_credentials.json"
  )
  if (existsSync(adcCli)) process.env.GOOGLE_APPLICATION_CREDENTIALS = adcCli
}
process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= projectId

initializeApp({ projectId })
const db = getFirestore(databaseId)
const ref = db.collection("reportes_integridad_state").doc("config")
const current = await ref.get()
const defaults = {
  mode,
  pilotAllowlistUids: [],
  executiveOwner: "",
  financeOwner: "",
  purchasingOwner: "",
  ruleVersion: "integrity-v1",
  tolerancePct: 2,
  scheduleIntervalMinutes: 120,
}

await ref.set(
  {
    ...defaults,
    ...(current.exists ? current.data() : {}),
    mode,
    updatedAt: new Date(),
  },
  { merge: true }
)

console.log(
  `Integridad inicializada: project=${projectId}, database=${databaseId}, mode=${mode}.`
)
