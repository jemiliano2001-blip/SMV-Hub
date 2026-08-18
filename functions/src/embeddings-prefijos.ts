/** Duplicado de lib/embeddings-prefijos.ts — functions/ no importa lib/ (boundary de deploy). */

export type TaskTypeEmbeddingIndice = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"

export function modeloUsaPrefijosEmbedding(modelo: string): boolean {
  return modelo.startsWith("gemini-embedding-2")
}

export function prefijarTextoDocumentoIndice(texto: string, titulo?: string): string {
  const limpio = texto.trim()
  if (!limpio) return limpio
  return `title: ${titulo?.trim() || "none"} | text: ${limpio}`
}
