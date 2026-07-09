import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { RolSchema, type Rol } from "@/lib/schemas"
import { esCorreoBreakGlass } from "@/lib/authorized-emails"

/**
 * Resuelve el rol de un usuario autenticado leyendo su propio documento en
 * Firestore. Devuelve null si no tiene acceso (documento inexistente,
 * desactivado, o rol inválido) — el llamador debe tratar null como "sin
 * autorización".
 */
export async function obtenerRolUsuario(
  uid: string,
  email: string | null | undefined
): Promise<Rol | null> {
  if (esCorreoBreakGlass(email)) return "admin"

  const snap = await getDoc(doc(db, "usuarios", uid))
  if (!snap.exists()) return null

  const data = snap.data()
  if (data.activo !== true) return null

  const rolParseado = RolSchema.safeParse(data.rol)
  return rolParseado.success ? rolParseado.data : null
}
