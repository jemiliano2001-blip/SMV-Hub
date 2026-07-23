import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getAuth, type Auth } from "firebase/auth"
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from "firebase/analytics"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// El proyecto smv-brain aloja varias bases Firestore; esta app usa la base
// nombrada "compras-americanas" (la "(default)" pertenece a otro proyecto).
const firestoreDbId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ?? "compras-americanas"

export const db = getFirestore(firebaseApp, firestoreDbId)
export const storage = getStorage(firebaseApp)

// Auth se inicializa de forma perezosa y solo en el navegador: getAuth valida
// la API key al construirse y rompería el prerender en el servidor.
let authInstance: Auth | undefined
export function getClienteAuth(): Auth {
  if (!authInstance) authInstance = getAuth(firebaseApp)
  return authInstance
}

// Analytics solo funciona en el navegador y requiere measurementId. isSupported
// evita errores en SSR/entornos sin window. Devuelve null si no está disponible.
let analyticsInstance: Analytics | null = null
export async function getClienteAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null
  if (!firebaseConfig.measurementId) return null
  if (analyticsInstance) return analyticsInstance
  if (!(await isAnalyticsSupported())) return null
  analyticsInstance = getAnalytics(firebaseApp)
  return analyticsInstance
}
