import { getFunctions, httpsCallable } from "firebase/functions"
import { firebaseApp } from "@/lib/firebase"

type ResultadoSync = { sincronizadas: number }

/** Llama a la Cloud Function `syncOdooVentasManual` (botón "Actualizar desde Odoo"). */
export async function sincronizarVentasOdoo(): Promise<ResultadoSync> {
  const functions = getFunctions(firebaseApp)
  const syncOdooVentasManual = httpsCallable<undefined, ResultadoSync>(
    functions,
    "syncOdooVentasManual"
  )
  const result = await syncOdooVentasManual()
  return result.data
}
