import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type AccionAuditoria = 'CREAR' | 'EDITAR' | 'BORRAR'

export async function registrarAuditoria(
  emailUsuario: string | null | undefined,
  accion: AccionAuditoria,
  coleccion: string,
  idDoc: string,
  resumen: string
) {
  if (!emailUsuario) return
  
  try {
    await addDoc(collection(db, 'auditoria'), {
      emailUsuario: emailUsuario.toLowerCase(),
      accion,
      coleccion,
      idDoc,
      resumen,
      fechaHora: serverTimestamp()
    })
  } catch (error) {
    console.error('Error al registrar auditoría:', error)
  }
}
