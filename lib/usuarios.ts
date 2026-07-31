import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ModuloId, Rol } from "@/lib/schemas"
import { esCorreoBreakGlass } from "@/lib/authorized-emails"
import {
  esSuperAdminDesdeUsuarioLegacy,
  modulosDePlantilla,
  modulosDesdeUsuarioLegacy,
  plantillaDesdeUsuarioLegacy,
} from "@/lib/roles"

export interface PermisosUsuario {
  /** @deprecated Preferir plantilla + modulos. Alias de plantilla para compat. */
  rol: Rol
  plantilla: Rol
  modulos: ModuloId[]
  esSuperAdmin: boolean
  atiendeDocumentosVenta: boolean
  editaHorasExtra: boolean
  activo: boolean
}

/**
 * Resuelve permisos de un usuario autenticado leyendo su documento en
 * Firestore. Devuelve null si no tiene acceso (documento inexistente o
 * desactivado). Break-glass → super-admin con plantilla admin completa.
 */
export async function obtenerPermisosUsuario(
  uid: string,
  email: string | null | undefined
): Promise<PermisosUsuario | null> {
  if (esCorreoBreakGlass(email)) {
    return {
      rol: "admin",
      plantilla: "admin",
      modulos: modulosDePlantilla("admin"),
      esSuperAdmin: true,
      atiendeDocumentosVenta: true,
      editaHorasExtra: true,
      activo: true,
    }
  }

  const snap = await getDoc(doc(db, "usuarios", uid))
  if (!snap.exists()) return null

  const data = snap.data()
  if (data.activo !== true) return null

  const plantilla = plantillaDesdeUsuarioLegacy(data)
  if (!plantilla) return null

  const modulos = modulosDesdeUsuarioLegacy(data)
  const esSuperAdmin = esSuperAdminDesdeUsuarioLegacy(data)

  return {
    rol: plantilla,
    plantilla,
    modulos,
    esSuperAdmin,
    atiendeDocumentosVenta: data.atiendeDocumentosVenta === true || esSuperAdmin,
    editaHorasExtra: data.editaHorasExtra === true,
    activo: true,
  }
}

/**
 * @deprecated Usar obtenerPermisosUsuario. Devuelve solo el rol/plantilla.
 */
export async function obtenerRolUsuario(
  uid: string,
  email: string | null | undefined
): Promise<Rol | null> {
  const perms = await obtenerPermisosUsuario(uid, email)
  return perms?.plantilla ?? null
}
