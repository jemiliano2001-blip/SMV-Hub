import { randomInt } from "node:crypto"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { type ModuloId, type Rol, type Usuario } from "@/lib/schemas"
import { CORREO_ADMIN_BREAK_GLASS } from "@/lib/authorized-emails"
import {
  esSuperAdminDesdeUsuarioLegacy,
  modulosDePlantilla,
  modulosDesdeUsuarioLegacy,
  plantillaDesdeUsuarioLegacy,
} from "@/lib/roles"

const COLECCION = "usuarios"
const ALFABETO_PASSWORD =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"

/** Genera una contraseña temporal aleatoria criptográficamente segura. */
export function generarPasswordTemporal(longitud = 16): string {
  let password = ""
  for (let i = 0; i < longitud; i++) {
    password += ALFABETO_PASSWORD[randomInt(ALFABETO_PASSWORD.length)]
  }
  return password
}

export interface InfoUsuarioAdmin {
  /** Alias de plantilla (compat con verificarAdmin legacy). */
  rol: Rol
  plantilla: Rol
  modulos: ModuloId[]
  esSuperAdmin: boolean
  activo: boolean
}

/**
 * Resuelve permisos de un usuario. El correo break-glass siempre resuelve a
 * super-admin activo sin tocar Firestore (red de seguridad).
 */
export async function obtenerUsuarioAdmin(
  uid: string,
  email: string | null | undefined
): Promise<InfoUsuarioAdmin | null> {
  if (email && email.trim().toLowerCase() === CORREO_ADMIN_BREAK_GLASS) {
    return {
      rol: "admin",
      plantilla: "admin",
      modulos: modulosDePlantilla("admin"),
      esSuperAdmin: true,
      activo: true,
    }
  }

  const snap = await adminDb.collection(COLECCION).doc(uid).get()
  if (!snap.exists) return null

  const data = snap.data() ?? {}
  const plantilla = plantillaDesdeUsuarioLegacy(data)
  if (!plantilla) return null

  return {
    rol: plantilla,
    plantilla,
    modulos: modulosDesdeUsuarioLegacy(data),
    esSuperAdmin: esSuperAdminDesdeUsuarioLegacy(data),
    activo: data.activo === true,
  }
}

/**
 * Sincroniza el custom claim `smvHubActivo` en el ID token del usuario. Las
 * reglas de Storage lo necesitan porque no pueden leer la colección `usuarios`:
 * las cross-service rules de Storage solo alcanzan la base Firestore "(default)"
 * y esta app usa la base nombrada "compras-americanas". El claim se refleja en
 * el cliente hasta el siguiente refresh del token (≤1 h); la desactivación
 * inmediata la cubre `disabled` en la cuenta de Auth.
 */
async function sincronizarClaimAcceso(uid: string, activo: boolean): Promise<void> {
  await adminAuth.setCustomUserClaims(uid, { smvHubActivo: activo })
}

export interface NuevoUsuarioPayload {
  email: string
  /** Plantilla inicial (rellena modulos). Preferir sobre `rol`. */
  plantilla?: Rol
  /** Si se omite, se usan los módulos de la plantilla. */
  modulos?: ModuloId[]
  esSuperAdmin?: boolean
  creadoPor: string
  /** Si se omite, se genera una temporal aleatoria. */
  password?: string
  /** @deprecated Usar plantilla. */
  rol?: Rol
}

export interface UsuarioCreado {
  uid: string
  /** null cuando el admin fijó su propia contraseña (ya la conoce, no hay que mostrarla). */
  tempPassword: string | null
}

function resolverPlantillaYModulos(payload: {
  plantilla?: Rol
  rol?: Rol
  modulos?: ModuloId[]
}): { plantilla: Rol; modulos: ModuloId[] } {
  const plantilla = payload.plantilla ?? payload.rol ?? "compras"
  const modulos = payload.modulos ?? modulosDePlantilla(plantilla)
  return { plantilla, modulos }
}

/** Crea la cuenta en Firebase Auth y su documento en Firestore. */
export async function crearUsuarioAdmin(payload: NuevoUsuarioPayload): Promise<UsuarioCreado> {
  const { plantilla, modulos } = resolverPlantillaYModulos(payload)
  const passwordFinal = payload.password ?? generarPasswordTemporal()
  const cuenta = await adminAuth.createUser({
    email: payload.email,
    password: passwordFinal,
    emailVerified: true,
  })
  await sincronizarClaimAcceso(cuenta.uid, true)

  const ahora = new Date()
  await adminDb.collection(COLECCION).doc(cuenta.uid).set({
    email: payload.email,
    rol: plantilla,
    plantilla,
    modulos,
    esSuperAdmin: payload.esSuperAdmin === true,
    activo: true,
    proveedor: "password",
    creadoPor: payload.creadoPor,
    creadoEn: ahora,
    actualizadoEn: ahora,
  })

  return { uid: cuenta.uid, tempPassword: payload.password ? null : passwordFinal }
}

export interface CambiosUsuarioAdmin {
  plantilla?: Rol
  modulos?: ModuloId[]
  esSuperAdmin?: boolean
  activo?: boolean
  /** @deprecated Usar plantilla (también reescribe modulos si no mandas modulos). */
  rol?: Rol
}

async function contarSuperAdminsActivos(exceptoUid?: string): Promise<number> {
  const snap = await adminDb.collection(COLECCION).get()
  let n = 0
  for (const d of snap.docs) {
    if (exceptoUid && d.id === exceptoUid) continue
    const data = d.data()
    if (data.activo !== true) continue
    if (esSuperAdminDesdeUsuarioLegacy(data)) n++
  }
  return n
}

/**
 * Actualiza plantilla/módulos/super-admin y/o estado de acceso.
 * Protege: no quitar el último super-admin activo.
 */
export async function actualizarUsuarioAdmin(
  uid: string,
  cambios: CambiosUsuarioAdmin
): Promise<void> {
  const ref = adminDb.collection(COLECCION).doc(uid)
  const snap = await ref.get()
  if (!snap.exists) throw new Error("Usuario no encontrado")

  const actual = snap.data() ?? {}
  const eraSuper = esSuperAdminDesdeUsuarioLegacy(actual)
  const seguiraActivo = cambios.activo !== undefined ? cambios.activo : actual.activo === true
  const seguiraSuper =
    cambios.esSuperAdmin !== undefined ? cambios.esSuperAdmin : eraSuper

  if (eraSuper && (!seguiraSuper || !seguiraActivo)) {
    const otros = await contarSuperAdminsActivos(uid)
    if (otros === 0) {
      throw new Error("No puedes quitar el último super-admin activo")
    }
  }

  if (cambios.activo !== undefined) {
    await adminAuth.updateUser(uid, { disabled: !cambios.activo })
    await sincronizarClaimAcceso(uid, cambios.activo)
  }

  const update: Record<string, unknown> = {
    actualizadoEn: new Date(),
  }

  const plantillaNueva = cambios.plantilla ?? cambios.rol
  if (plantillaNueva !== undefined) {
    update.plantilla = plantillaNueva
    update.rol = plantillaNueva
    if (cambios.modulos === undefined) {
      update.modulos = modulosDePlantilla(plantillaNueva)
    }
  }

  if (cambios.modulos !== undefined) {
    update.modulos = cambios.modulos
  }

  if (cambios.esSuperAdmin !== undefined) {
    update.esSuperAdmin = cambios.esSuperAdmin
  }

  if (cambios.activo !== undefined) {
    update.activo = cambios.activo
  }

  await ref.update(update)
}

/** Aplica una contraseña nueva: la que mande el admin, o una temporal aleatoria. */
export async function resetearPasswordAdmin(uid: string, password?: string): Promise<string | null> {
  const passwordFinal = password ?? generarPasswordTemporal()
  await adminAuth.updateUser(uid, { password: passwordFinal })
  await adminDb.collection(COLECCION).doc(uid).update({ actualizadoEn: new Date() })
  return password ? null : passwordFinal
}

/** Elimina la cuenta de Firebase Auth y su documento en `usuarios`. Irreversible. */
export async function eliminarUsuarioAdmin(uid: string): Promise<void> {
  const snap = await adminDb.collection(COLECCION).doc(uid).get()
  if (snap.exists) {
    const data = snap.data() ?? {}
    if (esSuperAdminDesdeUsuarioLegacy(data) && data.activo === true) {
      const otros = await contarSuperAdminsActivos(uid)
      if (otros === 0) {
        throw new Error("No puedes eliminar el último super-admin activo")
      }
    }
  }

  try {
    await adminAuth.deleteUser(uid)
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : ""
    if (code !== "auth/user-not-found") throw error
  }
  await adminDb.collection(COLECCION).doc(uid).delete()
}

interface DocUsuarioFirestore {
  email?: string
  rol?: unknown
  plantilla?: unknown
  modulos?: unknown
  esSuperAdmin?: unknown
  activo?: unknown
  proveedor?: unknown
  creadoPor?: string
  creadoEn?: { toDate?: () => Date }
  actualizadoEn?: { toDate?: () => Date }
}

function mapearDocUsuario(id: string, data: DocUsuarioFirestore): Usuario | null {
  const plantilla = plantillaDesdeUsuarioLegacy(data)
  if (!plantilla) return null
  if (typeof data.email !== "string") return null

  const proveedor = data.proveedor === "google" || data.proveedor === "password" ? data.proveedor : "password"

  return {
    id,
    email: data.email,
    rol: plantilla,
    plantilla,
    modulos: modulosDesdeUsuarioLegacy(data),
    esSuperAdmin: esSuperAdminDesdeUsuarioLegacy(data),
    activo: data.activo === true,
    proveedor,
    creadoPor: data.creadoPor ?? "",
    creadoEn: data.creadoEn?.toDate?.() ?? new Date(),
    actualizadoEn: data.actualizadoEn?.toDate?.() ?? new Date(),
  }
}

/** Lista los usuarios administrados. Docs sin plantilla/rol válido se omiten. */
export async function listarUsuariosAdmin(): Promise<Usuario[]> {
  const snap = await adminDb.collection(COLECCION).orderBy("email", "asc").get()
  const usuarios: Usuario[] = []

  for (const d of snap.docs) {
    const u = mapearDocUsuario(d.id, d.data() as DocUsuarioFirestore)
    if (u) usuarios.push(u)
  }

  return usuarios
}
