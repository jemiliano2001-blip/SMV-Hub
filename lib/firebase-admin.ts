import { getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
}

export const adminAuth = getAuth()
