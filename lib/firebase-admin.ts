import { getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
}

export const adminAuth = getAuth()
export const adminDb = getFirestore(process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "compras-americanas")
