import { useEffect, useRef, useState } from "react"
import type { User } from "firebase/auth"
import { obtenerPermisosUsuario, type PermisosUsuario } from "@/lib/usuarios"
import type { ModuloId, Rol } from "@/lib/schemas"

export interface EstadoPermisos {
  /** @deprecated Preferir plantilla. Alias para compat con NavBar/AuthProvider. */
  rol: Rol | null
  plantilla: Rol | null
  modulos: ModuloId[] | null
  esSuperAdmin: boolean
  atiendeDocumentosVenta: boolean
  cargando: boolean
}

/** Resuelve módulos + super-admin del usuario autenticado. */
export function usePermisos(usuario: User | null): EstadoPermisos {
  const [permisos, setPermisos] = useState<PermisosUsuario | null>(null)
  // Arranca en true: si `usuario` pasa de null a un User real en el mismo
  // render (onAuthStateChanged hace setUsuario+setCargando(false) juntos),
  // este hook no debe reportar "cargando: false" antes de que su propio
  // efecto corra — eso haría que un usuario válido parezca "sin rol" por un
  // instante y se le cierre la sesión de más. Ver AuthProvider.tsx.
  const [cargando, setCargando] = useState(true)
  const vigente = useRef(0)

  async function cargar(u: User, idPeticion: number) {
    setCargando(true)
    try {
      const p = await obtenerPermisosUsuario(u.uid, u.email)
      if (vigente.current === idPeticion) {
        setPermisos(p)
        setCargando(false)
      }
    } catch (err) {
      console.error("Error al resolver permisos de usuario:", err)
      if (vigente.current === idPeticion) {
        setPermisos(null)
        setCargando(false)
      }
    }
  }

  useEffect(() => {
    if (!usuario) return
    const idPeticion = ++vigente.current
    void cargar(usuario, idPeticion)
  }, [usuario])

  if (!usuario) {
    return {
      rol: null,
      plantilla: null,
      modulos: null,
      esSuperAdmin: false,
      atiendeDocumentosVenta: false,
      cargando: false,
    }
  }

  return {
    rol: permisos?.plantilla ?? null,
    plantilla: permisos?.plantilla ?? null,
    modulos: permisos?.modulos ?? null,
    esSuperAdmin: permisos?.esSuperAdmin ?? false,
    atiendeDocumentosVenta: permisos?.atiendeDocumentosVenta ?? false,
    cargando,
  }
}

/** @deprecated Usar usePermisos. */
export function useRol(usuario: User | null): { rol: Rol | null; cargando: boolean } {
  const { rol, cargando } = usePermisos(usuario)
  return { rol, cargando }
}
