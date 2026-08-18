/**
 * IDs GA de modelos Gemini usados en SMV Hub.
 * Fuente de verdad: https://ai.google.dev/gemini-api/docs/models
 */

/** Visión + structured output (facturas, PO, investigación, baños). */
export const GEMINI_MODELO_WORKHORSE = "gemini-3.7-flash"

/** Tablas densas en extracción por lote (`calidad=alta`). */
export const GEMINI_MODELO_EXTRACCION_ALTA = "gemini-3.1-pro-preview"

/** Clasificación masiva económica (SAT lite, Odoo, traducción contable). */
export const GEMINI_MODELO_LITE = "gemini-3.5-flash-lite"

/** Embeddings semánticos (índice + búsqueda en vivo). */
export const GEMINI_MODELO_EMBEDDING = "gemini-embedding-2"

/**
 * Alternativa económica para A/B en flujos no críticos (baños, clasificación Odoo).
 * Override vía `GEMINI_MODEL_BANOS` o `GEMINI_MODEL_CLASIFICACION`.
 */
export const GEMINI_MODELO_FLASH_ECONOMICO = "gemini-3.6-flash"

/** IDs retirados — migrar al reemplazo GA en runtime. */
export const GEMINI_MODELOS_OBSOLETOS: Readonly<Record<string, string>> = {
  "gemini-3.1-flash-lite-preview": GEMINI_MODELO_LITE,
  "gemini-embedding-2-preview": GEMINI_MODELO_EMBEDDING,
}

/**
 * Resuelve un modelo Gemini respetando override de entorno y migrando IDs obsoletos.
 */
export function resolverModeloGemini(
  configurado: string | undefined,
  defaultModelo: string,
  obsoletos: Readonly<Record<string, string>> = GEMINI_MODELOS_OBSOLETOS,
): string {
  const trimmed = configurado?.trim()
  if (trimmed && trimmed in obsoletos) {
    const reemplazo = obsoletos[trimmed]
    console.warn(`[gemini] ${trimmed} ya no existe; se usará ${reemplazo}`)
    return reemplazo
  }
  return trimmed || defaultModelo
}
