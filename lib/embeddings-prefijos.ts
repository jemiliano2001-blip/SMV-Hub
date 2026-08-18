export type TaskTypeEmbeddingPrefijo =
  | "RETRIEVAL_QUERY"
  | "RETRIEVAL_DOCUMENT"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING"

/** Modelos Embeddings 2 usan prefijos en el texto; no soportan task_type en la API. */
export function modeloUsaPrefijosEmbedding(modelo: string): boolean {
  return modelo.startsWith("gemini-embedding-2")
}

/**
 * Formatea texto para gemini-embedding-2 según ai.google.dev/gemini-api/docs/embeddings.
 * Para gemini-embedding-001 el caller usa taskType en embedContentConfig sin prefijo.
 */
export function prefijarTextoEmbedding(
  taskType: TaskTypeEmbeddingPrefijo,
  texto: string,
  titulo?: string
): string {
  const limpio = texto.trim()
  if (!limpio) return limpio

  switch (taskType) {
    case "RETRIEVAL_QUERY":
      return `task: search result | query: ${limpio}`
    case "RETRIEVAL_DOCUMENT":
      return `title: ${titulo?.trim() || "none"} | text: ${limpio}`
    case "SEMANTIC_SIMILARITY":
      return `task: sentence similarity | query: ${limpio}`
    case "CLASSIFICATION":
      return `task: classification | query: ${limpio}`
    case "CLUSTERING":
      return `task: clustering | query: ${limpio}`
    default:
      return limpio
  }
}
