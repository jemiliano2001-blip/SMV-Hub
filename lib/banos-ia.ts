import { z } from "zod"
import type { RegistroBano, MotivoSolicitudBorradoBano } from "@/lib/schemas"

export const MODELO_BANOS_DEFAULT = "gemini-3.7-flash"
const MODELO_BANOS_TIMEOUT_MS = 15_000

const EvaluacionBanoSchema = z.object({
  decision: z.enum(["aprobar", "rechazar", "revision"]),
  confianza: z.number().min(0).max(1),
  motivo: z.string().trim().min(1).max(500),
})

export type EvaluacionBano = z.infer<typeof EvaluacionBanoSchema>

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["aprobar", "rechazar", "revision"] },
    confianza: { type: "number" },
    motivo: { type: "string" },
  },
  required: ["decision", "confianza", "motivo"],
}

function obtenerApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error("Falta GEMINI_API_KEY")
  return key
}

export function resolverModeloBanos(configurado = process.env.GEMINI_MODEL_BANOS): string {
  return configurado?.trim() || MODELO_BANOS_DEFAULT
}

function promptParaSolicitud(
  registro: RegistroBano,
  motivo: MotivoSolicitudBorradoBano,
  nota: string | undefined,
  relacionados: readonly RegistroBano[],
): string {
  return `Evalua una solicitud de eliminacion de un registro interno de uso de banos.
Decide aprobar solo si parece un error claro (duplicado, captura accidental o dato evidentemente equivocado).
Decide rechazar solo si el registro parece valido y la solicitud no justifica eliminarlo.
Usa revision si faltan datos o no hay certeza suficiente. No inventes hechos.
Devuelve JSON con decision (aprobar|rechazar|revision), confianza de 0 a 1 y motivo breve en espanol.

Registro: ${JSON.stringify(registro)}
Motivo declarado: ${motivo}
Nota: ${nota ?? "(sin nota)"}
Registros relacionados del mismo operador/bano/fecha: ${JSON.stringify(relacionados.slice(0, 20))}`
}

class GeminiBanosError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = "GeminiBanosError"
  }
}

async function llamarGemini(modelo: string, payload: Record<string, unknown>): Promise<EvaluacionBano> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MODELO_BANOS_TIMEOUT_MS)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${obtenerApiKey()}`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new GeminiBanosError(`Gemini respondio HTTP ${response.status}`, response.status)
    }
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const texto = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!texto) throw new GeminiBanosError("Gemini no devolvio una evaluacion")

    let datos: unknown
    try {
      datos = JSON.parse(texto)
    } catch {
      throw new GeminiBanosError("Gemini devolvio JSON invalido")
    }
    const evaluacion = EvaluacionBanoSchema.safeParse(datos)
    if (!evaluacion.success) throw new GeminiBanosError("La evaluacion de Gemini no cumple el schema")
    return evaluacion.data
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GeminiBanosError("Gemini tardo demasiado en responder")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function evaluarSolicitudBorradoConIa(args: {
  registro: RegistroBano
  motivo: MotivoSolicitudBorradoBano
  nota?: string
  relacionados: readonly RegistroBano[]
}): Promise<EvaluacionBano> {
  const modeloConfigurado = resolverModeloBanos()
  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: promptParaSolicitud(args.registro, args.motivo, args.nota, args.relacionados) }],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  }

  try {
    return await llamarGemini(modeloConfigurado, payload)
  } catch (error) {
    // Si el override apunta a un modelo retirado, prueba el estable oficial.
    // No se reintentan fallos de credenciales, cuota ni respuestas invalidas.
    const status = error instanceof GeminiBanosError ? error.status : undefined
    if (modeloConfigurado === MODELO_BANOS_DEFAULT || (status !== 400 && status !== 404)) {
      throw error
    }
    return llamarGemini(MODELO_BANOS_DEFAULT, payload)
  }
}
