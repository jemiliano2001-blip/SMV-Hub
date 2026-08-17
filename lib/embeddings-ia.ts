/**
 * Módulo de generación de embeddings vectoriales y búsqueda semántica con Gemini.
 *
 * Utiliza el modelo `gemini-embedding-2-preview` (multimodal y multilingüe)
 * para calcular representaciones vectoriales densas y permitir búsqueda semántica
 * bilingüe (Español ⇄ Inglés) en catálogos, refacciones y órdenes.
 */

import { ErrorIA } from "./extraer-ia"

export const MODELO_EMBEDDING_DEFAULT = "gemini-embedding-2-preview"
export const MODELO_EMBEDDING_FALLBACK = "gemini-embedding-001"

export type TaskTypeEmbedding =
  | "RETRIEVAL_QUERY"
  | "RETRIEVAL_DOCUMENT"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING"

export interface OpcionesEmbedding {
  apiKey?: string
  modelo?: string
  fetchFn?: typeof fetch
  timeoutMs?: number
  taskType?: TaskTypeEmbedding
}

export interface ItemVectorizado<T = unknown> {
  id: string
  embedding: number[]
  data: T
}

export interface ResultadoSimilitud<T = unknown> {
  id: string
  score: number // Valor entre -1.0 y 1.0 (usualmente 0.0 a 1.0 para embeddings normalizados)
  porcentajeSimilitud: number // 0% a 100%
  data: T
}

/**
 * Resuelve el modelo de embeddings a utilizar, priorizando variables de entorno.
 */
export function resolverModeloEmbedding(): string {
  const envModel = process.env.GEMINI_MODEL_EMBEDDING?.trim()
  if (envModel) {
    return envModel
  }
  return MODELO_EMBEDDING_DEFAULT
}

/**
 * Calcula la similitud coseno entre dos vectores numéricos.
 * Retorna un valor entre -1 y 1 (1 = idénticos, 0 = ortogonales).
 */
export function similitudCoseno(vecA: readonly number[], vecB: readonly number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0
  }
  if (vecA.length !== vecB.length) {
    throw new Error(`Los vectores deben tener la misma dimensión (${vecA.length} vs ${vecB.length})`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i]
    const b = vecB[i]
    dotProduct += a * b
    normA += a * a
    normB += b * b
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  const similitud = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  // Asegurar límites numéricos contra precisión de coma flotante
  return Math.max(-1, Math.min(1, similitud))
}

/**
 * Genera el embedding vectorial de un texto usando la API de Gemini Embeddings.
 */
export async function generarEmbeddingTexto(
  texto: string,
  opciones: OpcionesEmbedding = {}
): Promise<number[]> {
  const textoLimpio = texto?.trim()
  if (!textoLimpio) {
    throw new ErrorIA("El texto para generar embedding no puede estar vacío")
  }

  const apiKey = opciones.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ErrorIA("No se ha configurado GEMINI_API_KEY en el entorno")
  }

  const modelo = opciones.modelo || resolverModeloEmbedding()
  const fetchFn = opciones.fetchFn || fetch
  const timeoutMs = opciones.timeoutMs || 15_000
  const taskType = opciones.taskType || "RETRIEVAL_QUERY"

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:embedContent?key=${apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: `models/${modelo}`,
        content: {
          parts: [{ text: textoLimpio }],
        },
        taskType,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new ErrorIA(
        `Error de API Gemini Embeddings (${response.status}): ${errorBody || response.statusText}`
      )
    }

    const data = await response.json()
    const values = data?.embedding?.values

    if (!Array.isArray(values) || values.length === 0) {
      throw new ErrorIA("La respuesta de Gemini no contiene un vector de embedding válido")
    }

    return values
  } catch (error) {
    if (error instanceof ErrorIA) {
      throw error
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ErrorIA(`Tiempo de espera agotado al generar embedding con Gemini (${timeoutMs}ms)`)
    }
    throw new ErrorIA(
      `Fallo al generar embedding: ${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Genera embeddings para una lista de textos mediante llamadas por lotes o paralelas.
 */
export async function generarEmbeddingsLote(
  textos: readonly string[],
  opciones: OpcionesEmbedding = {}
): Promise<number[][]> {
  if (!textos || textos.length === 0) {
    return []
  }

  const apiKey = opciones.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ErrorIA("No se ha configurado GEMINI_API_KEY en el entorno")
  }

  const modelo = opciones.modelo || resolverModeloEmbedding()
  const fetchFn = opciones.fetchFn || fetch
  const timeoutMs = opciones.timeoutMs || 25_000
  const taskType = opciones.taskType || "RETRIEVAL_DOCUMENT"

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:batchEmbedContents?key=${apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const requests = textos.map((t) => ({
      model: `models/${modelo}`,
      content: {
        parts: [{ text: t.trim() || " " }],
      },
      taskType,
    }))

    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ requests }),
    })

    if (!response.ok) {
      // Fallback a peticiones individuales si batch no es soportado por el modelo
      return await Promise.all(
        textos.map((t) => generarEmbeddingTexto(t, { ...opciones, taskType }))
      )
    }

    const data = await response.json()
    const embeddings = data?.embeddings

    if (Array.isArray(embeddings) && embeddings.length === textos.length) {
      return embeddings.map((e: { values: number[] }) => e.values)
    }

    // Fallback individual
    return await Promise.all(
      textos.map((t) => generarEmbeddingTexto(t, { ...opciones, taskType }))
    )
  } catch (error) {
    if (error instanceof ErrorIA) {
      throw error
    }
    // Si falla el batch, intentar peticiones individuales
    return await Promise.all(
      textos.map((t) => generarEmbeddingTexto(t, { ...opciones, taskType }))
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Busca los elementos más similares semánticamente respecto a un vector de consulta.
 */
export function buscarPorSimilitudSemantica<T = unknown>(
  queryVector: readonly number[],
  itemsVectorizados: readonly ItemVectorizado<T>[],
  opciones: {
    topK?: number
    minScore?: number
  } = {}
): ResultadoSimilitud<T>[] {
  const topK = Math.max(1, opciones.topK || 5)
  const minScore = opciones.minScore ?? 0.35 // Umbral mínimo de afinidad

  const conScore: ResultadoSimilitud<T>[] = []

  for (const item of itemsVectorizados) {
    if (!item.embedding || item.embedding.length === 0) continue
    const score = similitudCoseno(queryVector, item.embedding)

    if (score >= minScore) {
      const porcentajeSimilitud = Math.round(Math.max(0, Math.min(100, score * 100)))
      conScore.push({
        id: item.id,
        score,
        porcentajeSimilitud,
        data: item.data,
      })
    }
  }

  // Ordenar de mayor a menor similitud
  conScore.sort((a, b) => b.score - a.score)

  return conScore.slice(0, topK)
}
