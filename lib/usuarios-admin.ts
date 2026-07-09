import { randomInt } from "node:crypto"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { RolSchema, type Rol, type Usuario } from "@/lib/schemas"
import { CORREO_ADMIN_BREAK_GLASS } from "@/lib/authorized-emails"

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
  rol: Rol
  activo: boolean
}

/**
 * Resuelve rol + estado de acceso de un usuario. El correo break-glass
 * siempre resuelve a admin activo sin tocar Firestore (red de seguridad).
 */
export async function obtenerUsuarioAdmin(
  uid: string,
  email: string | null | undefined
): Promise<InfoUsuarioAdmin | null> {
  if (email && email.trim().toLowerCase() === CORREO_ADMIN_BREAK_GLASS) {
    return { rol: "admin", activo: true }
  }

  const snap = await adminDb.collection(COLECCION).doc(uid).get()
  if (!snap.exists) return null

  const data = snap.data()
  const rolParseado = RolSchema.safeParse(data?.rol)
  if (!rolParseado.success) return null

  return { rol: rolParseado.data, activo: data?.activo === true }
}

export interface NuevoUsuarioPayload {
  email: string
  rol: Rol
  creadoPor: string
}

export interface UsuarioCreado {
  uid: string
  tempPassword: string
}

/** Crea la cuenta en Firebase Auth (con contraseña temporal y correo ya
 * verificado, porque el admin da fe del correo) y su documento en Firestore. */
export async function crearUsuarioAdmin(payload: NuevoUsuarioPayload): Promise<UsuarioCreado> {
  const tempPassword = generarPasswordTemporal()
  const cuenta = await adminAuth.createUser({
    email: payload.email,
    password: tempPassword,
    emailVerified: true,
  })

  const ahora = new Date()
  await adminDb.collection(COLECCION).doc(cuenta.uid).set({
    email: payload.email,
    rol: payload.rol,
    activo: true,
    proveedor: "password",
    creadoPor: payload.creadoPor,
    creadoEn: ahora,
    actualizadoEn: ahora,
  })

  return { uid: cuenta.uid, tempPassword }
}

export interface CambiosUsuarioAdmin {
  rol?: Rol
  activo?: boolean
}

/** Actualiza rol y/o estado de acceso. Al cambiar `activo`, además
 * habilita/deshabilita la cuenta en Firebase Auth (doble candado: aunque a
 * alguien le quede una sesión abierta, el siguiente refresh de token falla). */
export async function actualizarUsuarioAdmin(
  uid: string,
  cambios: CambiosUsuarioAdmin
): Promise<void> {
  if (cambios.activo !== undefined) {
    await adminAuth.updateUser(uid, { disabled: !cambios.activo })
  }

  await adminDb.collection(COLECCION).doc(uid).update({
    ...cambios,
    actualizadoEn: new Date(),
  })
}

/** Genera y aplica una nueva contraseña temporal. Se muestra una sola vez al
 * admin — no se persiste en texto plano en ningún lado. */
export async function resetearPasswordAdmin(uid: string): Promise<string> {
  const tempPassword = generarPasswordTemporal()
  await adminAuth.updateUser(uid, { password: tempPassword })
  await adminDb.collection(COLECCION).doc(uid).update({ actualizadoEn: new Date() })
  return tempPassword
}

/** Lista los usuarios administrados. Documentos con un `rol` inválido o
 * corrupto se omiten (mismo criterio defensivo que obtenerUsuarioAdmin) en
 * vez de romper la pantalla de admin completa. */
export async function listarUsuariosAdmin(): Promise<Usuario[]> {
  const snap = await adminDb.collection(COLECCION).orderBy("email", "asc").get()
  const usuarios: Usuario[] = []

  for (const d of snap.docs) {
    const data = d.data()
    const rolParseado = RolSchema.safeParse(data.rol)
    if (!rolParseado.success) continue

    usuarios.push({
      id: d.id,
      email: data.email,
      rol: rolParseado.data,
      activo: data.activo === true,
      proveedor: data.proveedor,
      creadoPor: data.creadoPor,
      creadoEn: data.creadoEn?.toDate?.() ?? new Date(),
      actualizadoEn: data.actualizadoEn?.toDate?.() ?? new Date(),
    })
  }

  return usuarios
}
