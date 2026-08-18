/**
 * Módulo de generación de embeddings vectoriales y búsqueda semántica con Gemini.
 *
 * Utiliza el modelo GA `gemini-embedding-2` (multimodal y multilingüe)
 * para calcular representaciones vectoriales densas y permitir búsqueda semántica
 * bilingüe (Español ⇄ Inglés) en catálogos, refacciones y órdenes.
 */

import { ErrorIA } from "./extraer-ia"
import { modeloUsaPrefijosEmbedding, prefijarTextoEmbedding } from "./embeddings-prefijos"

export const MODELO_EMBEDDING_DEFAULT = "gemini-embedding-2"

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
  /** Título del documento (Embeddings 2, rol RETRIEVAL_DOCUMENT). */
  titulo?: string
  /** Debe coincidir con la dimensión de los vectores ya guardados al comparar contra un índice. */
  outputDimensionality?: number
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

/** Error de la API de Gemini que conserva el status HTTP para distinguir causas (404 vs 429 vs 5xx). */
class ErrorGeminiHttp extends ErrorIA {
  constructor(
    public readonly status: number,
    mensaje: string
  ) {
    super(mensaje)
  }
}

function prepararTextoParaEmbedding(
  texto: string,
  modelo: string,
  taskType: TaskTypeEmbedding,
  titulo?: string
): string {
  if (modeloUsaPrefijosEmbedding(modelo)) {
    return prefijarTextoEmbedding(taskType, texto, titulo)
  }
  return texto
}

function construirEmbedContentConfig(
  modelo: string,
  taskType: TaskTypeEmbedding,
  outputDimensionality?: number
): Record<string, unknown> {
  if (modeloUsaPrefijosEmbedding(modelo)) {
    return outputDimensionality ? { outputDimensionality } : {}
  }
  return {
    taskType,
    ...(outputDimensionality ? { outputDimensionality } : {}),
  }
}

async function llamarEmbedContent(
  textoLimpio: string,
  modelo: string,
  apiKey: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
  taskType: TaskTypeEmbedding,
  outputDimensionality?: number,
  titulo?: string
): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:embedContent?key=${apiKey}`
  const textoEnviado = prepararTextoParaEmbedding(textoLimpio, modelo, taskType, titulo)
  const embedContentConfig = construirEmbedContentConfig(modelo, taskType, outputDimensionality)

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
          parts: [{ text: textoEnviado }],
        },
        ...(Object.keys(embedContentConfig).length > 0 ? { embedContentConfig } : {}),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new ErrorGeminiHttp(
        response.status,
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

  return await llamarEmbedContent(
    textoLimpio,
    modelo,
    apiKey,
    fetchFn,
    timeoutMs,
    taskType,
    opciones.outputDimensionality,
    opciones.titulo
  )
}

// Límite propio y conservador, no documentado por Gemini (no publica un máximo de
// requests por batchEmbedContents) — evita mandar un solo request gigante al indexar
// catálogos grandes.
const TAMANO_CHUNK_LOTE = 100
// Pausa entre chunks sucesivos como cortesía de rate limit; no es backoff, es fijo.
const PAUSA_ENTRE_CHUNKS_MS = 200

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Genera embeddings para una lista de textos mediante llamadas por lotes.
 */
export async function generarEmbeddingsLote(
  textos: readonly string[],
  opciones: OpcionesEmbedding = {}
): Promise<number[][]> {
  if (!textos || textos.length === 0) {
    return []
  }

  if (textos.length > TAMANO_CHUNK_LOTE) {
    const resultado: number[][] = []
    for (let i = 0; i < textos.length; i += TAMANO_CHUNK_LOTE) {
      if (i > 0) await esperar(PAUSA_ENTRE_CHUNKS_MS)
      const chunk = textos.slice(i, i + TAMANO_CHUNK_LOTE)
      resultado.push(...(await generarEmbeddingsLote(chunk, opciones)))
    }
    return resultado
  }

  const apiKey = opciones.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ErrorIA("No se ha configurado GEMINI_API_KEY en el entorno")
  }

  const modelo = opciones.modelo || resolverModeloEmbedding()
  const fetchFn = opciones.fetchFn || fetch
  const timeoutMs = opciones.timeoutMs || 25_000
  const taskType = opciones.taskType || "RETRIEVAL_DOCUMENT"
  const embedContentConfig = construirEmbedContentConfig(modelo, taskType, opciones.outputDimensionality)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:batchEmbedContents?key=${apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    const requests = textos.map((t) => {
      const textoBase = t.trim() || " "
      const textoEnviado = prepararTextoParaEmbedding(textoBase, modelo, taskType, opciones.titulo)
      return {
        model: `models/${modelo}`,
        content: {
          parts: [{ text: textoEnviado }],
        },
        ...(Object.keys(embedContentConfig).length > 0 ? { embedContentConfig } : {}),
      }
    })

    response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ requests }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ErrorIA(`Tiempo de espera agotado al generar embeddings en lote (${timeoutMs}ms)`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    // Solo se degrada a N peticiones individuales cuando el lote específicamente no es
    // soportado (400 — p.ej. el modelo no acepta batchEmbedContents). Un 429 (rate limit)
    // o un 5xx NO deben disparar N peticiones: eso multiplica el costo y la probabilidad
    // de fallo en vez de resolverlo, porque cada una tropieza con la misma causa.
    if (response.status === 400) {
      return await Promise.all(
        textos.map((t) => generarEmbeddingTexto(t, { ...opciones, taskType }))
      )
    }
    const errorBody = await response.text().catch(() => "")
    if (response.status === 429) {
      throw new ErrorIA(
        "Límite de tasa de Gemini alcanzado al generar embeddings en lote (429). Intenta de nuevo en unos segundos."
      )
    }
    throw new ErrorIA(
      `Error de API Gemini Embeddings en lote (${response.status}): ${errorBody || response.statusText}`
    )
  }

  const data = await response.json()
  const embeddings = data?.embeddings

  if (Array.isArray(embeddings) && embeddings.length === textos.length) {
    return embeddings.map((e: { values: number[] }) => e.values)
  }

  throw new ErrorIA("La respuesta de Gemini en lote no coincide con la cantidad de textos enviados")
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
    if (item.embedding.length !== queryVector.length) continue
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
