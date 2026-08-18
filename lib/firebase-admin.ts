import { createRequire } from "node:module"
import { existsSync } from "node:fs"
import type { App } from "firebase-admin/app"

const require = createRequire(import.meta.url)
const { getApps, initializeApp } = require(/* turbopackIgnore: true */ "firebase-admin/app") as typeof import("firebase-admin/app")
const { getAuth } = require(/* turbopackIgnore: true */ "firebase-admin/auth") as typeof import("firebase-admin/auth")
const { getFirestore } = require(/* turbopackIgnore: true */ "firebase-admin/firestore") as typeof import("firebase-admin/firestore")

/**
 * Next.js carga `.env.local` también en `next build`, así que una ruta de
 * GOOGLE_APPLICATION_CREDENTIALS de la máquina del dev puede quedar embebida
 * en el SSR de Firebase Hosting. En Cloud Run/Functions hay ADC del service
 * account — hay que ignorar rutas locales antes de inicializar Admin.
 */
function limpiarCredencialesAdminEmbebidas(): void {
  const ruta = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!ruta) return

  const enRuntimeCloud =
    typeof process.env.K_SERVICE === "string" ||
    typeof process.env.FUNCTION_TARGET === "string" ||
    typeof process.env.FIREBASE_CONFIG === "string"

  if (enRuntimeCloud || !existsSync(ruta)) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  }
}

limpiarCredencialesAdminEmbebidas()

/**
 * En Firebase Hosting (frameworksBackend), `firebase-frameworks` ya inicializa
 * Admin con el nombre `firebase-frameworks` (no `[DEFAULT]`). Si solo checamos
 * `getApps().length === 0` y luego llamamos `getAuth()` sin app, falla con
 * "The default Firebase app does not exist".
 *
 * @see https://github.com/firebase/firebase-tools/issues/7224
 */
const ADMIN_APP_FRAMEWORKS = "firebase-frameworks"

function obtenerAdminApp(): App {
  const apps = getApps()
  const frameworks = apps.find((a) => a.name === ADMIN_APP_FRAMEWORKS)
  if (frameworks) return frameworks

  const def = apps.find((a) => a.name === "[DEFAULT]")
  if (def) return def

  if (apps.length > 0) return apps[0]!

  return initializeApp({
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      "smv-brain-dev",
  })
}

const adminApp = obtenerAdminApp()

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(
  adminApp,
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "compras-americanas"
)
