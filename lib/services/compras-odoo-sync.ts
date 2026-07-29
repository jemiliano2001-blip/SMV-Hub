import { getFunctions, httpsCallable } from "firebase/functions"
import { firebaseApp } from "@/lib/firebase"

export type ResultadoSyncComprasOdoo = {
  pos: number
  facturas: number
  items: number
  proveedores: number
  huerfanos: number
  integrityMode: "off" | "shadow" | "pilot" | "on"
  integrityRunId: string | null
  integrityCases: number
  integrityErrorCode: string | null
}

/** Reutiliza el sync manual de compras y su lease de Integridad. */
export async function sincronizarComprasOdoo(): Promise<ResultadoSyncComprasOdoo> {
  const functions = getFunctions(firebaseApp)
  const fn = httpsCallable<undefined, ResultadoSyncComprasOdoo>(functions, "syncOdooComprasManual")
  const result = await fn()
  return result.data
}
