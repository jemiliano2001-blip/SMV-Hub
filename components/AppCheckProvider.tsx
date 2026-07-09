'use client'

import { useEffect } from 'react'
import { inicializarAppCheck } from '@/lib/app-check'

/** Monta App Check una vez en el cliente antes de acceder a Firestore/Storage. */
export function AppCheckProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    inicializarAppCheck()
  }, [])

  return <>{children}</>
}
