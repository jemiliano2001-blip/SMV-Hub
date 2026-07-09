import { useEffect, useRef, useState } from "react"
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
  const [cargando, setCargando] = useState(!!usuario)
  const vigente = useRef(0)

  async function cargarRol(u: User, idPeticion: number) {
    setCargando(true)
    const r = await obtenerRolUsuario(u.uid, u.email)
    if (vigente.current === idPeticion) {
      setRol(r)
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!usuario) return
    const idPeticion = ++vigente.current
    cargarRol(usuario, idPeticion)
  }, [usuario])

  if (!usuario) return { rol: null, cargando: false }
  return { rol, cargando }
}
