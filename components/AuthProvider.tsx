'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authBypassActivo, cerrarSesion, useUsuario } from '@/lib/auth'
import { useRol } from '@/lib/hooks/useRol'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useUsuario()
  // En modo bypass el usuario simulado no tiene token real de Firebase Auth,
  // así que una lectura a Firestore para su rol fallaría siempre (ver
  // lib/auth.ts). Pasamos null para que useRol no la intente.
  const { rol, cargando: cargandoRol } = useRol(authBypassActivo() ? null : usuario)
  const router = useRouter()
  const pathname = usePathname()
  const esLogin = pathname === '/login'
  const usuarioProcesadoSinAcceso = useRef<string | null>(null)

  const usuarioNoAutorizado =
    !cargando &&
    !!usuario &&
    !authBypassActivo() &&
    !cargandoRol &&
    !rol

  useEffect(() => {
    if (!usuario) usuarioProcesadoSinAcceso.current = null

    if (!cargando && !usuario && pathname !== '/login') {
      router.replace('/login')
      return
    }

    if (!cargando && usuario && authBypassActivo() && pathname === '/login') {
      router.push('/')
      return
    }

    if (usuarioNoAutorizado) {
      if (usuarioProcesadoSinAcceso.current === usuario?.uid) return
      usuarioProcesadoSinAcceso.current = usuario?.uid ?? null
      void cerrarSesion()
        .catch((error) => {
          console.error('No se pudo cerrar la sesión no autorizada:', error)
        })
        .finally(() => {
          router.replace('/login?error=no_autorizado')
        })
      return
    }

    if (!cargando && !cargandoRol && usuario && pathname === '/login') {
      router.replace('/')
    }
  }, [usuario, cargando, cargandoRol, router, pathname, usuarioNoAutorizado])

  if (
    cargando ||
    usuarioNoAutorizado ||
    (!esLogin && (!usuario || (!!usuario && !authBypassActivo() && cargandoRol)))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0369A1]"></div>
      </div>
    )
  }

  return <>{children}</>
}
