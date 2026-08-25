/**
 * Resuelve la API key de Gemini para todo el código server-side del Hub.
 *
 * En producción la monta Secret Manager como `HUB_GEMINI_API_KEY`, declarado en
 * `firebase.json` → `hosting.frameworksBackend.secrets`; el valor nunca toca el repo.
 * En local se sigue leyendo `GEMINI_API_KEY` de `.env.local`, que es lo que documenta
 * el README, así que el fallback mantiene el flujo de desarrollo intacto.
 *
 * `smv-brain` es un proyecto compartido con SMV-VISION y Visual Factory: el prefijo
 * `HUB_` es obligatorio para no pisar secretos de los otros productos.
 */
export function obtenerGeminiApiKey(): string | undefined {
  return (
    process.env.HUB_GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || undefined
  )
}

/** Mensaje único para los llamadores que necesitan fallar con contexto accionable. */
export const MENSAJE_FALTA_GEMINI_API_KEY =
  "Falta la API key de Gemini: define GEMINI_API_KEY en .env.local (local) o el secreto HUB_GEMINI_API_KEY (producción)"
