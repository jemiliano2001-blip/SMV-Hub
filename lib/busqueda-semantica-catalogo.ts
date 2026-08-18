/**
 * Búsqueda semántica sobre el índice real de SMV Hub (ítems de órdenes +
 * proveedores) — ver docs/superpowers/specs/2026-08-17-busqueda-semantica-datos-reales.md.
 */

import { generarEmbeddingTexto, buscarPorSimilitudSemantica, type ItemVectorizado } from "./embeddings-ia"
import { adminDb } from "./firebase-admin"
import { ErrorIA } from "./extraer-ia"
import type { BusquedaIndice, FuenteBusquedaIndice } from "./schemas"

// Debe coincidir con DIMENSIONES_EMBEDDING_INDICE en
// functions/src/busqueda-indice-gemini.ts (no se puede importar cruzado —
// boundary de deploy). Cambiarlo exige reindexar todo el índice.
const DIMENSIONES_INDICE = 768

export type ResultadoBusquedaSemantica = Pick<BusquedaIndice, "fuente" | "refPath" | "titulo" | "metadata"> & {
  id: string
}

export interface ResultadoBusquedaSemanticaCompleta {
  query: string
  tiempoMs: number
  totalEncontrados: number
  resultados: Array<{
    item: ResultadoBusquedaSemantica
    score: number
    porcentajeSimilitud: number
  }>
}

/**
 * Busca en el índice real, restringido a las fuentes que el usuario puede ver
 * (`fuentesPermitidas` la calcula el caller a partir de sus módulos — nunca un
 * default "todo permitido": ver app/api/busqueda-semantica/route.ts).
 * No atrapa errores de Gemini/Firestore aquí a propósito: el Route Handler ya
 * distingue error real de "sin resultados" (ErrorIA → 502, resto → 500); un
 * try/catch aquí solo lo escondería.
 */
export async function buscarEnCatalogoSemantico(
  query: string,
  opciones: {
    fuentesPermitidas: readonly FuenteBusquedaIndice[]
    apiKey?: string
    fetchFn?: typeof fetch
    topK?: number
    minScore?: number
  }
): Promise<ResultadoBusquedaSemanticaCompleta> {
  const inicio = performance.now()
  const qLimpio = query.trim()

  if (!qLimpio || opciones.fuentesPermitidas.length === 0) {
    return { query: qLimpio, tiempoMs: 0, totalEncontrados: 0, resultados: [] }
  }

  const queryVector = await generarEmbeddingTexto(qLimpio, {
    apiKey: opciones.apiKey,
    fetchFn: opciones.fetchFn,
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: DIMENSIONES_INDICE,
  })

  // Si Gemini alguna vez ignora outputDimensionality (ya verificado empíricamente que
  // hoy sí lo respeta, tanto aquí como en el indexador), esto lo convierte en un 502
  // con mensaje claro en vez de un 500 opaco desde dentro de similitudCoseno().
  if (queryVector.length !== DIMENSIONES_INDICE) {
    throw new ErrorIA(
      `Gemini devolvió un vector de ${queryVector.length} dimensiones; se esperaban ${DIMENSIONES_INDICE}`
    )
  }

  let snap
  try {
    snap = await adminDb
      .collection("busqueda_indice")
      .where("fuente", "in", opciones.fuentesPermitidas)
      .get()
  } catch (error) {
    throw new ErrorIA(
      `No se pudo leer el índice de búsqueda semántica: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const itemsVectorizados: ItemVectorizado<ResultadoBusquedaSemantica>[] = []
  let entradasDimensionIncorrecta = 0

  for (const doc of snap.docs) {
    const d = doc.data()
    const embedding = Array.isArray(d.embedding) ? d.embedding : []
    if (embedding.length > 0 && embedding.length !== DIMENSIONES_INDICE) {
      entradasDimensionIncorrecta++
      continue
    }

    itemsVectorizados.push({
      id: doc.id,
      embedding,
      data: {
        id: doc.id,
        fuente: d.fuente,
        refPath: d.refPath,
        titulo: d.titulo,
        metadata: d.metadata ?? {},
      },
    })
  }

  if (entradasDimensionIncorrecta > 0) {
    console.warn(
      `[busqueda-semantica] ${entradasDimensionIncorrecta} entradas del índice tienen dimensión distinta a ${DIMENSIONES_INDICE} y se omitieron; ejecuta syncBusquedaIndiceManual para reindexar.`
    )
  }

  const resultadosSimilitud = buscarPorSimilitudSemantica(queryVector, itemsVectorizados, {
    topK: opciones.topK || 6,
    minScore: opciones.minScore ?? 0.35,
  })

  return {
    query: qLimpio,
    tiempoMs: Math.round(performance.now() - inicio),
    totalEncontrados: resultadosSimilitud.length,
    resultados: resultadosSimilitud.map((r) => ({
      item: r.data,
      score: r.score,
      porcentajeSimilitud: r.porcentajeSimilitud,
    })),
  }
}
