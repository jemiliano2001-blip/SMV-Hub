import { getFunctions, httpsCallable } from "firebase/functions"
import { firebaseApp } from "@/lib/firebase"

/** Espejo de `ResultadoIndexacion` en functions/src/busqueda-indice-escritura.ts. */
export type ResultadoSyncBusquedaIndice = {
  entradasEsperadas: number
  reembebidas: number
  sinCambios: number
  metadataActualizadas: number
  podadas: number
  ordenesLeidas: number
  proveedoresLeidos: number
  /** Ausente en respuestas de Functions anteriores a C1 (frente C). */
  cotizacionesLeidas?: number
}

/**
 * Reindexación manual de `busqueda_indice` (callable `syncBusquedaIndiceManual`, solo super-admin).
 * Solo re-embebe lo que cambió de texto; lo demás se refresca por metadata o se salta.
 */
export async function reindexarBusquedaSemantica(): Promise<ResultadoSyncBusquedaIndice> {
  const functions = getFunctions(firebaseApp)
  const fn = httpsCallable<undefined, ResultadoSyncBusquedaIndice>(functions, "syncBusquedaIndiceManual")
  const result = await fn()
  return result.data
}
