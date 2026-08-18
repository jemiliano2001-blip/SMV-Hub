/**
 * Cliente mínimo de Gemini Embeddings para el job de indexación de búsqueda
 * semántica. Deliberadamente NO es el mismo código que lib/embeddings-ia.ts:
 * functions/ se despliega como paquete aislado (sin import cruzado a lib/, ver
 * busqueda-indice-texto.ts) y, sobre todo, tiene una semántica de fallas
 * distinta. lib/embeddings-ia.ts sirve una búsqueda en vivo — debe degradar
 * con gracia porque un usuario está esperando respuesta. Este cliente alimenta
 * un job programado — si un chunk falla, lo correcto es tronar todo el run
 * (no se escribe nada a medias) y dejar que la siguiente corrida programada
 * reintente; no hace falta la distinción 400/429/degradación de la ruta viva.
 *
 * Usa el shape moderno `embedContentConfig` (taskType/outputDimensionality
 * planos están deprecados según ai.google.dev/api/embeddings, aunque siguen
 * funcionando — código nuevo usa el shape recomendado).
 */

export const MODELO_EMBEDDING_INDICE = "gemini-embedding-2-preview"
// 768 en vez del default de la API (3072): la calidad medida por Gemini en su
// propio benchmark MTEB es prácticamente idéntica (67.99 vs 68.17) y el
// vector pesa ~4x menos — relevante porque Option B (Fase 0) lee el índice
// completo a memoria en cada consulta fría.
export const DIMENSIONES_EMBEDDING_INDICE = 768

const TAMANO_CHUNK = 100
const PAUSA_ENTRE_CHUNKS_MS = 200

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface SolicitudEmbedding {
  id: string
  texto: string
}

export interface OpcionesEmbeddingIndice {
  apiKey: string
  modelo?: string
  dimensiones?: number
  fetchFn?: typeof fetch
  timeoutMs?: number
}

async function embedContentsChunk(
  solicitudes: readonly SolicitudEmbedding[],
  opciones: Required<Omit<OpcionesEmbeddingIndice, "apiKey">> & { apiKey: string }
): Promise<Map<string, number[]>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opciones.modelo}:batchEmbedContents?key=${opciones.apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opciones.timeoutMs)

  let response: Response
  try {
    response = await opciones.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        requests: solicitudes.map((s) => ({
          model: `models/${opciones.modelo}`,
          content: { parts: [{ text: s.texto }] },
          embedContentConfig: {
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: opciones.dimensiones,
          },
        })),
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Tiempo de espera agotado generando embeddings (${opciones.timeoutMs}ms)`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Gemini batchEmbedContents (${response.status}): ${body || response.statusText}`)
  }

  const data = (await response.json()) as { embeddings?: Array<{ values: number[] }> }
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== solicitudes.length) {
    throw new Error(
      `Gemini batchEmbedContents devolvió ${data.embeddings?.length ?? 0} vectores para ${solicitudes.length} solicitudes`
    )
  }

  // Verificado empíricamente que embedContentConfig.outputDimensionality trunca de verdad
  // (no se ignora en silencio) — este guard igual se queda: si algún día cambia de
  // comportamiento o de modelo, es la diferencia entre tronar aquí mismo y escribir
  // vectores de otra dimensión etiquetados con `dimensiones` equivocado, que solo se
  // notarían hasta que similitudCoseno() reviente en Fase 3 con un índice ya corrupto.
  const dimensionIncorrecta = data.embeddings.find((e) => e.values.length !== opciones.dimensiones)
  if (dimensionIncorrecta) {
    throw new Error(
      `Gemini devolvió un vector de ${dimensionIncorrecta.values.length} dimensiones; se esperaban ${opciones.dimensiones} (outputDimensionality no se aplicó)`
    )
  }

  const resultado = new Map<string, number[]>()
  data.embeddings.forEach((e, i) => resultado.set(solicitudes[i].id, e.values))
  return resultado
}

/** Genera embeddings para N solicitudes, partidas en chunks de 100 con pausa entre ellas. */
export async function generarEmbeddingsIndice(
  solicitudes: readonly SolicitudEmbedding[],
  opciones: OpcionesEmbeddingIndice
): Promise<Map<string, number[]>> {
  if (solicitudes.length === 0) return new Map()

  const resueltas: Required<Omit<OpcionesEmbeddingIndice, "apiKey">> & { apiKey: string } = {
    apiKey: opciones.apiKey,
    modelo: opciones.modelo ?? MODELO_EMBEDDING_INDICE,
    dimensiones: opciones.dimensiones ?? DIMENSIONES_EMBEDDING_INDICE,
    fetchFn: opciones.fetchFn ?? fetch,
    timeoutMs: opciones.timeoutMs ?? 30_000,
  }

  const resultado = new Map<string, number[]>()
  for (let i = 0; i < solicitudes.length; i += TAMANO_CHUNK) {
    if (i > 0) await esperar(PAUSA_ENTRE_CHUNKS_MS)
    const chunk = solicitudes.slice(i, i + TAMANO_CHUNK)
    const embeddings = await embedContentsChunk(chunk, resueltas)
    for (const [id, vector] of embeddings) resultado.set(id, vector)
  }
  return resultado
}
