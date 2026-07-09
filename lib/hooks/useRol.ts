import { useEffect, useState } from "react"
import type { User } from "firebase/auth"
import { obtenerRolUsuario } from "@/lib/usuarios"
import type { Rol } from "@/lib/schemas"

export interface EstadoRol {
  rol: Rol | null
  cargando: boolean
}

/** Resuelve el rol del usuario autenticado leyendo su documento en Firestore. */
export function useRol(usuario: User | null): EstadoRol {
  const [rol, setRol] = useState<Rol | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) {
      setRol(null)
      setCargando(false)
      return
    }

    let cancelado = false
    setCargando(true)
    obtenerRolUsuario(usuario.uid, usuario.email)
      .then((r) => {
        if (!cancelado) setRol(r)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [usuario])

  return { rol, cargando }
}
