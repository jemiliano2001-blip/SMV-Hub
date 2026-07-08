'use client'

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUsuario } from "@/lib/auth"
import { obtenerRol, tienePermiso } from "@/lib/roles"

// Protege rutas: solo renderiza children cuando hay usuario autenticado.
// Mientras carga muestra un placeholder; si no hay sesión, redirige a /login.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useUsuario()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!cargando) {
      if (!usuario) {
        router.replace("/login")
        return
      }
      
      const rol = obtenerRol(usuario.email)
      if (!tienePermiso(rol, pathname)) {
        router.replace("/")
      }
    }
  }, [cargando, usuario, router, pathname])

  if (cargando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    )
  }

  return <>{children}</>
}
