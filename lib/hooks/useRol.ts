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
  // Arranca en true: si `usuario` pasa de null a un User real en el mismo
  // render (onAuthStateChanged hace setUsuario+setCargando(false) juntos),
  // este hook no debe reportar "cargando: false" antes de que su propio
  // efecto corra — eso haría que un usuario válido parezca "sin rol" por un
  // instante y se le cierre la sesión de más. Ver AuthProvider.tsx.
  const [cargando, setCargando] = useState(true)
  const vigente = useRef(0)

  async function cargarRol(u: User, idPeticion: number) {
    setCargando(true)
    try {
      const r = await obtenerRolUsuario(u.uid, u.email)
      if (vigente.current === idPeticion) {
        setRol(r)
        setCargando(false)
      }
    } catch (err) {
      console.error("Error al resolver rol de usuario:", err)
      if (vigente.current === idPeticion) {
        setRol(null)
        setCargando(false)
      }
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
