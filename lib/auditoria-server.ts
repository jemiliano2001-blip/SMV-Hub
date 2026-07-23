import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import type { AccionAuditoria } from "@/lib/auditoria"

export async function registrarAuditoriaServer(
  emailUsuario: string | null | undefined,
  accion: AccionAuditoria,
  coleccion: string,
  idDoc: string,
  resumen: string
) {
  if (!emailUsuario) return

  try {
    await adminDb.collection("auditoria").add({
      emailUsuario: emailUsuario.toLowerCase(),
      accion,
      coleccion,
      idDoc,
      resumen,
      fechaHora: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error("Error al registrar auditoría en servidor:", error)
  }
}
