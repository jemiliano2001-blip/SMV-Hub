import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import type { NuevaNotificacion } from "@/lib/schemas"

/**
 * Equivalente Admin SDK de `emitirNotificacion` (lib/notificaciones.ts) para
 * usarse desde Route Handlers, donde no hay sesión de cliente de Firestore.
 * Best-effort: un fallo aquí nunca debe tumbar el flujo que lo llama.
 */
export async function emitirNotificacionServer(payload: NuevaNotificacion): Promise<string | null> {
  try {
    const ref = await adminDb.collection("notificaciones").add({
      ...payload,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    })
    return ref.id
  } catch (error) {
    console.error("No se pudo emitir notificación desde el servidor:", error)
    return null
  }
}
