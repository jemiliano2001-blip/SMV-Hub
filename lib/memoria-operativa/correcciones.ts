import { collection, doc, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { MemoriaCorreccion } from "@/lib/schemas"

export type EntradaCorreccionMemoria = Omit<MemoriaCorreccion, "id" | "creadoEn">

/**
 * Registra un lote de correcciones o aceptaciones en `memoria_correcciones`.
 *
 * Best-effort: Si falla (offline, reglas o red), registra un warning y NO interrumpe
 * el flujo de la aplicación ni la experiencia del usuario (spec §4).
 */
function sanitizarEntrada(entrada: EntradaCorreccionMemoria) {
  const contexto: Record<string, unknown> = {
    modulo: entrada.contexto.modulo,
  }
  if (typeof entrada.contexto.docId === "string") contexto.docId = entrada.contexto.docId
  if (typeof entrada.contexto.llavePieza === "string") contexto.llavePieza = entrada.contexto.llavePieza
  if (typeof entrada.contexto.campo === "string") contexto.campo = entrada.contexto.campo

  return {
    tipo: entrada.tipo,
    contexto,
    sugerido: entrada.sugerido ?? null,
    elegido: entrada.elegido ?? null,
    aceptado: Boolean(entrada.aceptado),
    usuario: entrada.usuario || "desconocido",
  }
}

export async function registrarCorrecciones(
  entradas: readonly EntradaCorreccionMemoria[]
): Promise<void> {
  if (!entradas || entradas.length === 0) return

  try {
    const batch = writeBatch(db)
    const colRef = collection(db, "memoria_correcciones")
    const ahora = new Date().toISOString()

    for (const entrada of entradas) {
      if (!entrada) continue
      const docRef = doc(colRef)
      batch.set(docRef, {
        ...sanitizarEntrada(entrada),
        creadoEn: ahora,
      })
    }

    await batch.commit()
  } catch (error) {
    console.warn(
      "No se pudieron registrar las correcciones de memoria operativa (best-effort):",
      error
    )
  }
}
