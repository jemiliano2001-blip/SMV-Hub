'use client'

import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'
import { firebaseApp } from './firebase'

let appCheckInstance: AppCheck | undefined

/**
 * Inicializa Firebase App Check con reCAPTCHA v3.
 * Requiere NEXT_PUBLIC_RECAPTCHA_SITE_KEY (registrar en Firebase Console → App Check).
 * En desarrollo, opcionalmente define NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN y regístralo
 * en la consola para evitar bloqueos en localhost.
 */
export function inicializarAppCheck(): AppCheck | null {
  if (typeof window === 'undefined') return null
  if (appCheckInstance) return appCheckInstance

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim()
  if (!siteKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[App Check] NEXT_PUBLIC_RECAPTCHA_SITE_KEY no definida; Firestore/Storage pueden rechazar peticiones si las reglas exigen App Check.'
      )
    }
    return null
  }

  const debugToken = process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN?.trim()
  if (debugToken && process.env.NODE_ENV !== 'production') {
    const globalScope = globalThis as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: string
    }
    globalScope.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken
  }

  appCheckInstance = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })

  return appCheckInstance
}
