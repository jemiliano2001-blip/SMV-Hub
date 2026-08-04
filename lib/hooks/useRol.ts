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
  editaHorasExtra: boolean
  cargando: boolean
}

/** Resuelve módulos + super-admin del usuario autenticado. */
export function usePermisos(usuario: User | null): EstadoPermisos {
  const [estado, setEstado] = useState<{
    uid: string | null
    permisos: PermisosUsuario | null
    cargando: boolean
  }>({ uid: null, permisos: null, cargando: false })
  const vigente = useRef(0)
  const uid = usuario?.uid ?? null
  const [uidSesion, setUidSesion] = useState<string | null>(uid)

  // La lectura de permisos pertenece a una sesión, no solo a un uid. Cuando
  // Firebase emite null al cerrar sesión y después el mismo usuario vuelve a
  // entrar, el resultado anterior ya no es válido. Ajustamos el estado durante
  // el render para que React lo vuelva a evaluar antes de exponer un "sin
  // permisos" intermedio al proveedor global de autenticación.
  if (uid !== uidSesion) {
    setUidSesion(uid)
    setEstado({ uid, permisos: null, cargando: uid !== null })
  }

  useEffect(() => {
    const idPeticion = ++vigente.current
    if (!usuario) return

    void obtenerPermisosUsuario(usuario.uid, usuario.email)
      .then((permisos) => {
        if (vigente.current === idPeticion) {
          setEstado({ uid: usuario.uid, permisos, cargando: false })
        }
      })
      .catch((err) => {
        console.error("Error al resolver permisos de usuario:", err)
        if (vigente.current === idPeticion) {
          setEstado({ uid: usuario.uid, permisos: null, cargando: false })
        }
      })
  }, [uid, usuario])

  if (!usuario) {
    return {
      rol: null,
      plantilla: null,
      modulos: null,
      esSuperAdmin: false,
      atiendeDocumentosVenta: false,
      editaHorasExtra: false,
      cargando: false,
    }
  }

  const estadoActual = estado.uid === usuario.uid
  const cargando = !estadoActual || estado.cargando
  const permisos = !cargando && estadoActual ? estado.permisos : null

  return {
    rol: permisos?.plantilla ?? null,
    plantilla: permisos?.plantilla ?? null,
    modulos: permisos?.modulos ?? null,
    esSuperAdmin: permisos?.esSuperAdmin ?? false,
    atiendeDocumentosVenta: permisos?.atiendeDocumentosVenta ?? false,
    editaHorasExtra: permisos?.editaHorasExtra ?? false,
    cargando,
  }
}

/** @deprecated Usar usePermisos. */
export function useRol(usuario: User | null): { rol: Rol | null; cargando: boolean } {
  const { rol, cargando } = usePermisos(usuario)
  return { rol, cargando }
}
