'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authBypassActivo, cerrarSesion, useUsuario } from '@/lib/auth'
import { esCorreoAutorizado } from '@/lib/authorized-emails'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useUsuario()
  const router = useRouter()
  const pathname = usePathname()

  const usuarioNoAutorizado =
    !cargando &&
    !!usuario &&
    !authBypassActivo() &&
    !esCorreoAutorizado(usuario.email)

  useEffect(() => {
    if (!cargando && !usuario && pathname !== '/login') {
      router.push('/login')
      return
    }

    if (!cargando && usuario && authBypassActivo() && pathname === '/login') {
      router.push('/')
      return
    }

    if (usuarioNoAutorizado) {
      void cerrarSesion().then(() => {
        router.replace('/login?error=no_autorizado')
      })
      return
    }

    if (!cargando && usuario && pathname === '/login') {
      router.push('/')
    }
  }, [usuario, cargando, router, pathname, usuarioNoAutorizado])

  if (cargando || usuarioNoAutorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0369A1]"></div>
      </div>
    )
  }

  return <>{children}</>
}
