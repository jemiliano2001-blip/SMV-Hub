import { getFunctions, httpsCallable } from "firebase/functions"
import { firebaseApp } from "@/lib/firebase"

type ResultadoSync = { sincronizadas: number }

/** Llama a la Cloud Function `syncOdooFacturasManual` (botón "Sincronizar ahora", solo admin). */
export async function sincronizarFinanzasOdoo(): Promise<ResultadoSync> {
  const functions = getFunctions(firebaseApp)
  const syncOdooFacturasManual = httpsCallable<undefined, ResultadoSync>(functions, "syncOdooFacturasManual")
  const result = await syncOdooFacturasManual()
  return result.data
}
