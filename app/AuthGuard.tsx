'use client'

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authBypassActivo, useUsuario } from "@/lib/auth"
import { usePermisos } from "@/lib/hooks/useRol"
import { tienePermiso } from "@/lib/roles"

// Protege rutas: solo renderiza children cuando hay usuario autenticado y con
// módulos válidos. Mientras carga muestra un placeholder; si no hay sesión o
// permiso, redirige a /login o /.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { usuario, cargando: cargandoAuth } = useUsuario()
  const { modulos, esSuperAdmin, cargando: cargandoPermisos } = usePermisos(
    authBypassActivo() ? null : usuario
  )
  const router = useRouter()
  const pathname = usePathname()
  const cargando = cargandoAuth || cargandoPermisos

  useEffect(() => {
    if (!cargando) {
      if (!usuario) {
        router.replace("/login")
        return
      }

      // En bypass de auth (dev) no aplicamos la matriz de módulos.
      if (authBypassActivo()) return

      // /usuarios solo super-admin (además del módulo en la matriz)
      if (pathname === "/usuarios" || pathname.startsWith("/usuarios/")) {
        if (!esSuperAdmin) {
          router.replace("/")
          return
        }
      }

      if (!tienePermiso(modulos, pathname)) {
        router.replace("/")
      }
    }
  }, [cargando, usuario, modulos, esSuperAdmin, router, pathname])

  if (cargando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    )
  }

  return <>{children}</>
}
