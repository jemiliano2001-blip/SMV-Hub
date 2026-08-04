'use client'

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
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

export async function iniciarSesionConGoogle(): Promise<User> {
  if (authBypassActivo()) return USUARIO_DEBUG
  const result = await signInWithPopup(getClienteAuth(), proveedorGoogle)
  return result.user
}

export async function iniciarSesionConEmailYPassword(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(getClienteAuth(), email, password)
  return result.user
}

export async function cerrarSesion(): Promise<void> {
  if (authBypassActivo()) return
  await fbSignOut(getClienteAuth())
}

export interface EstadoSesion {
  usuario: User | null
  cargando: boolean
}

const SesionContext = createContext<EstadoSesion | null>(null)

/** Una única suscripción a Firebase Auth para todo el árbol de la app. */
function useSesionFirebase(): EstadoSesion {
  // En modo debug arrancamos con el usuario simulado y sin estado de carga.
  // Estado inicial null en modo normal: no tocamos Firebase Auth en el servidor.
  const [usuario, setUsuario] = useState<User | null>(
    authBypassActivo() ? USUARIO_DEBUG : null
  )
  const [cargando, setCargando] = useState(!authBypassActivo())

  useEffect(() => {
    if (authBypassActivo()) return
    try {
      const unsub = onAuthStateChanged(getClienteAuth(), (u) => {
        setUsuario(u)
        setCargando(false)
      })
      return unsub
    } catch (error) {
      // getAuth() valida la API key al construirse y lanza sincrónicamente si
      // falta/es inválida (config de Firebase ausente o rota). Sin este catch,
      // la excepción no controlada tumbaba toda la página (Next.js la atrapaba
      // como error global) en vez de degradar a "sin sesión" — exactamente lo
      // que la regla de CLAUDE.md de no romper la UI por un fallo de sistema
      // pide evitar.
      console.error("No se pudo inicializar Firebase Auth:", error)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsuario(null)
      setCargando(false)
    }
  }, [])

  return { usuario, cargando }
}

/** Provee una sesión consistente a navegación, permisos y pantallas. */
export function SesionProvider({ children }: { children: ReactNode }) {
  const sesion = useSesionFirebase()
  return createElement(SesionContext.Provider, { value: sesion }, children)
}

/** Estado de la sesión compartido por toda la aplicación. */
export function useUsuario(): EstadoSesion {
  const sesion = useContext(SesionContext)
  if (!sesion) {
    throw new Error("useUsuario debe usarse dentro de SesionProvider")
  }
  return sesion
}
