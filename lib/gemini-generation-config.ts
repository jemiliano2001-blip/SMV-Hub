/**
 * generationConfig compartido para structured output JSON en Gemini.
 *
 * `temperature`, `top_p` y `top_k` están deprecados desde jul 2026 en modelos 3.x.
 * Cuando Google los retire del schema, activar `GEMINI_OMIT_TEMPERATURE=true`.
 */

export type ConfigGeneracionJsonOpciones = {
  responseSchema: Record<string, unknown>
  /** Default 0.1. Ignorado si `GEMINI_OMIT_TEMPERATURE=true`. */
  temperature?: number
}

export function debeOmitirTemperatureGemini(): boolean {
  return process.env.GEMINI_OMIT_TEMPERATURE?.trim().toLowerCase() === "true"
}

export function configGeneracionJson(
  opciones: ConfigGeneracionJsonOpciones,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: opciones.responseSchema,
  }
  if (!debeOmitirTemperatureGemini()) {
    base.temperature = opciones.temperature ?? 0.1
  }
  return base
}
