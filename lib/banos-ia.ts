import { z } from "zod"
import type { RegistroBano, MotivoSolicitudBorradoBano } from "@/lib/schemas"

const MODELO_BANOS = "gemini-3.6-flash"

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

function promptParaSolicitud(
  registro: RegistroBano,
  motivo: MotivoSolicitudBorradoBano,
  nota: string | undefined,
  relacionados: readonly RegistroBano[],
): string {
  return `Evalúa una solicitud de eliminación de un registro interno de uso de baños.
Decide aprobar solo si parece un error claro (duplicado, captura accidental o dato evidentemente equivocado).
Decide rechazar solo si el registro parece válido y la solicitud no justifica eliminarlo.
Usa revision si faltan datos o no hay certeza suficiente. No inventes hechos.
Devuelve JSON con decision (aprobar|rechazar|revision), confianza de 0 a 1 y motivo breve en español.

Registro: ${JSON.stringify(registro)}
Motivo declarado: ${motivo}
Nota: ${nota ?? "(sin nota)"}
Registros relacionados del mismo operador/baño/fecha: ${JSON.stringify(relacionados.slice(0, 20))}`
}

export async function evaluarSolicitudBorradoConIa(args: {
  registro: RegistroBano
  motivo: MotivoSolicitudBorradoBano
  nota?: string
  relacionados: readonly RegistroBano[]
}): Promise<EvaluacionBano> {
  const modelo = process.env.GEMINI_MODEL_BANOS?.trim() || MODELO_BANOS
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${obtenerApiKey()}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptParaSolicitud(args.registro, args.motivo, args.nota, args.relacionados) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  })

  if (!response.ok) throw new Error(`Gemini respondió HTTP ${response.status}`)
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const texto = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) throw new Error("Gemini no devolvió una evaluación")
  const evaluacion = EvaluacionBanoSchema.safeParse(JSON.parse(texto))
  if (!evaluacion.success) throw new Error("La evaluación de Gemini no cumple el schema")
  return evaluacion.data
}
