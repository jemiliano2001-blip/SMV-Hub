'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUsuario } from '@/lib/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useUsuario()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!cargando) {
      if (!usuario && pathname !== '/login') {
        router.push('/login')
      } else if (usuario && pathname === '/login') {
        router.push('/')
      }
    }
  }, [usuario, cargando, router, pathname])

  // Mientras se comprueba el estado de la sesión, no mostramos nada
  // para evitar destellos de contenido no autorizado
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0369A1]"></div>
      </div>
    )
  }

  return <>{children}</>
}
