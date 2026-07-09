'use client'

import { inicializarAppCheck } from '@/lib/app-check'

if (typeof window !== 'undefined') {
  inicializarAppCheck()
}

/** Monta App Check una vez en el cliente antes de acceder a Firestore/Storage. */
export function AppCheckProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
