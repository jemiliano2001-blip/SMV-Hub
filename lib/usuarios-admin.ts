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
  rol: Rol
  creadoPor: string
  /** Si se omite, se genera una temporal aleatoria. */
  password?: string
}

export interface UsuarioCreado {
  uid: string
  /** null cuando el admin fijó su propia contraseña (ya la conoce, no hay que mostrarla). */
  tempPassword: string | null
}

/** Crea la cuenta en Firebase Auth (correo ya verificado, porque el admin da fe
 * del correo) y su documento en Firestore. Contraseña: la que mande el admin,
 * o una temporal aleatoria si no mandó ninguna. */
export async function crearUsuarioAdmin(payload: NuevoUsuarioPayload): Promise<UsuarioCreado> {
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
    rol: payload.rol,
    activo: true,
    proveedor: "password",
    creadoPor: payload.creadoPor,
    creadoEn: ahora,
    actualizadoEn: ahora,
  })

  return { uid: cuenta.uid, tempPassword: payload.password ? null : passwordFinal }
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
    await sincronizarClaimAcceso(uid, cambios.activo)
  }

  await adminDb.collection(COLECCION).doc(uid).update({
    ...cambios,
    actualizadoEn: new Date(),
  })
}

/** Aplica una contraseña nueva: la que mande el admin, o una temporal aleatoria
 * si no mandó ninguna. La temporal se muestra una sola vez — no se persiste en
 * texto plano en ningún lado. */
export async function resetearPasswordAdmin(uid: string, password?: string): Promise<string | null> {
  const passwordFinal = password ?? generarPasswordTemporal()
  await adminAuth.updateUser(uid, { password: passwordFinal })
  await adminDb.collection(COLECCION).doc(uid).update({ actualizadoEn: new Date() })
  return password ? null : passwordFinal
}

/** Elimina la cuenta de Firebase Auth y su documento en `usuarios`. Irreversible.
 * Si la cuenta de Auth ya no existe (doc huérfano, p.ej. borrada manualmente
 * antes), igual borra el documento de Firestore en vez de bloquear para siempre. */
export async function eliminarUsuarioAdmin(uid: string): Promise<void> {
  try {
    await adminAuth.deleteUser(uid)
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : ""
    if (code !== "auth/user-not-found") throw error
  }
  await adminDb.collection(COLECCION).doc(uid).delete()
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
