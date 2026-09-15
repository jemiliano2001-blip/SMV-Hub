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

export type EntradaIndiceVectorizada = ItemVectorizado<ResultadoBusquedaSemantica>

// ── Caché en proceso del índice (frente C, T2.1) ────────────────────────────
// Cada lectura fría baja el índice completo (~10 KB por entrada: 993 entradas ≈ 10 MB en
// 2026-09). Cmd+K y la memoria operativa comparten esta caché por instancia: TTL corto porque
// el sync corre cada 24 h y el reindex manual es raro; lo que importa es no releer en cada
// tecla. La clave es la lista ordenada de fuentes (misma que el `where in`).
const TTL_CACHE_INDICE_MS = 5 * 60 * 1000

type EntradaCacheIndice = {
  promesa: Promise<EntradaIndiceVectorizada[]>
  expiraEn: number
}

const cacheIndice = new Map<string, EntradaCacheIndice>()

/** Solo para pruebas y para el reindex manual: la siguiente lectura vuelve a Firestore. */
export function invalidarCacheIndice(): void {
  cacheIndice.clear()
}

function claveCache(fuentes: readonly FuenteBusquedaIndice[]): string {
  return [...fuentes].sort().join(",")
}

async function leerIndiceDesdeFirestore(
  fuentes: readonly FuenteBusquedaIndice[]
): Promise<EntradaIndiceVectorizada[]> {
  let snap
  try {
    snap = await adminDb
      .collection("busqueda_indice")
      .where("fuente", "in", fuentes)
      .get()
  } catch (error) {
    throw new ErrorIA(
      `No se pudo leer el índice de búsqueda semántica: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const items: EntradaIndiceVectorizada[] = []
  let entradasDimensionIncorrecta = 0

  for (const doc of snap.docs) {
    const d = doc.data()
    const embedding = Array.isArray(d.embedding) ? d.embedding : []
    if (embedding.length > 0 && embedding.length !== DIMENSIONES_INDICE) {
      entradasDimensionIncorrecta++
      continue
    }

    items.push({
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

  return items
}

/**
 * Índice vectorizado restringido a `fuentes`, con caché de 5 min por combinación de fuentes y
 * deduplicación de lecturas concurrentes (dos consultas al mismo tiempo → una sola lectura).
 * Una lectura fallida no se cachea. Devuelve el mismo array a todos los llamadores: no mutarlo.
 */
export async function leerIndiceVectorizado(
  fuentes: readonly FuenteBusquedaIndice[],
  opciones: { ahora?: () => number } = {}
): Promise<EntradaIndiceVectorizada[]> {
  if (fuentes.length === 0) return []
  const ahora = opciones.ahora ?? Date.now
  const clave = claveCache(fuentes)
  const vigente = cacheIndice.get(clave)
  if (vigente && vigente.expiraEn > ahora()) return vigente.promesa

  const promesa = leerIndiceDesdeFirestore(fuentes)
  cacheIndice.set(clave, { promesa, expiraEn: ahora() + TTL_CACHE_INDICE_MS })
  promesa.catch(() => {
    if (cacheIndice.get(clave)?.promesa === promesa) cacheIndice.delete(clave)
  })
  return promesa
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

  const itemsVectorizados = await leerIndiceVectorizado(opciones.fuentesPermitidas)

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
