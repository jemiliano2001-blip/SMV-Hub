import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { getApps, initializeApp } = require(/* turbopackIgnore: true */ "firebase-admin/app") as typeof import("firebase-admin/app")
const { getAuth } = require(/* turbopackIgnore: true */ "firebase-admin/auth") as typeof import("firebase-admin/auth")
const { getFirestore } = require(/* turbopackIgnore: true */ "firebase-admin/firestore") as typeof import("firebase-admin/firestore")

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
}

export const adminAuth = getAuth()
export const adminDb = getFirestore(process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "compras-americanas")
