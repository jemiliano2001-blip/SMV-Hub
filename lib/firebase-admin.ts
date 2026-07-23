import { createRequire } from "node:module"
import type { App } from "firebase-admin/app"

const require = createRequire(import.meta.url)
const { getApps, initializeApp } = require(/* turbopackIgnore: true */ "firebase-admin/app") as typeof import("firebase-admin/app")
const { getAuth } = require(/* turbopackIgnore: true */ "firebase-admin/auth") as typeof import("firebase-admin/auth")
const { getFirestore } = require(/* turbopackIgnore: true */ "firebase-admin/firestore") as typeof import("firebase-admin/firestore")

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
