'use client'

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authBypassActivo, useUsuario } from "@/lib/auth"
import { useRol } from "@/lib/hooks/useRol"
import { tienePermiso } from "@/lib/roles"

// Protege rutas: solo renderiza children cuando hay usuario autenticado y con
// rol válido. Mientras carga muestra un placeholder; si no hay sesión o rol,
// redirige a /login o /.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { usuario, cargando: cargandoAuth } = useUsuario()
  const { rol, cargando: cargandoRol } = useRol(authBypassActivo() ? null : usuario)
  const router = useRouter()
  const pathname = usePathname()
  const cargando = cargandoAuth || cargandoRol

  useEffect(() => {
    if (!cargando) {
      if (!usuario) {
        router.replace("/login")
        return
      }

      if (!tienePermiso(rol, pathname)) {
        router.replace("/")
      }
    }
  }, [cargando, usuario, rol, router, pathname])

  if (cargando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    )
  }

  return <>{children}</>
}
