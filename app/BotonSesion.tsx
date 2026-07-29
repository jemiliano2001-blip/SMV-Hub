'use client'

import { useRouter } from "next/navigation"
import { cerrarSesion, useUsuario } from "@/lib/auth"

// Muestra el correo del usuario y un botón para cerrar sesión.
export default function BotonSesion() {
  const { usuario } = useUsuario()
  const router = useRouter()

  if (!usuario) return null

  async function handleLogout() {
    await cerrarSesion()
    router.replace("/login")
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline text-xs text-gray-600">{usuario.email}</span>
      <button
        onClick={handleLogout}
        className="text-gray-500 hover:text-gray-900 transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
