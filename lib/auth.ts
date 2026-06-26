'use client'

import { useEffect, useState } from "react"
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { getClienteAuth } from "@/lib/firebase"

const proveedorGoogle = new GoogleAuthProvider()

// ── Modo debug: omitir login (opt-in) ─────────────────────────────────────────
//
// Por defecto se exige sesión real de Google SIEMPRE, también en localhost. Esto
// es necesario porque el usuario simulado no genera token de Firebase Auth, y sin
// ese token Firestore rechaza las lecturas/escrituras con "Missing or
// insufficient permissions". El bypass es opt-in explícito y nunca aplica en
// producción. Control via NEXT_PUBLIC_DEV_AUTH_BYPASS:
//   - "true"  → bypass de UI solo fuera de producción (rompe Firestore real;
//               úsalo únicamente para maquetar UI sin tocar datos)
//   - cualquier otro valor o sin definir → exige login real con Google
export function authBypassActivo(): boolean {
  if (process.env.NODE_ENV === "production") return false
  return process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"
}

// Usuario simulado para el modo debug. firebase/auth.User tiene métodos que no
// podemos construir aquí; solo la UI lee `email`, así que basta una forma mínima
// con doble aserción tipada (sin `any` ni `@ts-ignore`).
const USUARIO_DEBUG = {
  uid: "debug-local",
  email: "debug@localhost",
  displayName: "Modo debug (sin sesión)",
  emailVerified: true,
  isAnonymous: false,
  providerData: [],
} as unknown as User

export async function iniciarSesionConGoogle(): Promise<void> {
  if (authBypassActivo()) return
  await signInWithPopup(getClienteAuth(), proveedorGoogle)
}

export async function cerrarSesion(): Promise<void> {
  if (authBypassActivo()) return
  await fbSignOut(getClienteAuth())
}

export interface EstadoSesion {
  usuario: User | null
  cargando: boolean
}

// Hook que sigue el estado de autenticación en tiempo real.
export function useUsuario(): EstadoSesion {
  // En modo debug arrancamos con el usuario simulado y sin estado de carga.
  // Estado inicial null en modo normal: no tocamos Firebase Auth en el servidor.
  const [usuario, setUsuario] = useState<User | null>(
    authBypassActivo() ? USUARIO_DEBUG : null
  )
  const [cargando, setCargando] = useState(!authBypassActivo())

  useEffect(() => {
    if (authBypassActivo()) return
    const unsub = onAuthStateChanged(getClienteAuth(), (u) => {
      setUsuario(u)
      setCargando(false)
    })
    return unsub
  }, [])

  return { usuario, cargando }
}
