/**
 * Clasificación inteligente de ítems de compra con Gemini.
 * Re-clasifica ítems que cayeron en "otros" analizando la descripción.
 */

import { ErrorIA } from "@/lib/extraer-ia"
import { CATEGORIAS_PRODUCTO_REGISTRO } from "./categorias-registro"

/** Modelo para clasificación (override con GEMINI_MODEL_CLASIFICACION). */
export const MODELO_CLASIFICACION_DEFAULT = "gemini-3.5-flash-lite"

export type ClasificacionIA = {
  categoriaId: string
  tipoInsumo: string | null
  medida: string | null
  confianza: number
}

export type ItemParaClasificar = {
  id: string
  descripcion: string
  proveedorNombre?: string
  odooCategoria?: string | null
}

export type ResultadoClasificacionLote = {
  items: Array<{
    id: string
    clasificacion: ClasificacionIA
  }>
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
}

const TIEMPO_MAXIMO_MS = 30_000

const CLASIFICACION_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID del ítem" },
          categoriaId: {
            type: "string",
            description: "Familia del producto",
          },
          tipoInsumo: {
            type: "string",
            description: "Tipo específico dentro de la familia (ej: acero_1018, fresa, nylon)",
            nullable: true,
          },
          medida: {
            type: "string",
            description: "Medida/dimensión del producto si aplica (ej: 1/4 x 2, Ø25mm)",
            nullable: true,
          },
          confianza: {
            type: "number",
            description: "Confianza de 0 a 1",
          },
        },
        required: ["id", "categoriaId", "confianza"],
      },
    },
  },
  required: ["items"],
}

function obtenerApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new ErrorIA(
      "Falta GEMINI_API_KEY en .env.local (crea una en Google AI Studio)"
    )
  }
  return key
}

function resolverModelo(): string {
  return process.env.GEMINI_MODEL_CLASIFICACION?.trim() || MODELO_CLASIFICACION_DEFAULT
}

function construirPrompt(items: ItemParaClasificar[]): string {
  const familiasDisponibles = CATEGORIAS_PRODUCTO_REGISTRO
    .filter((c) => c.id !== "otros")
    .map((c) => `- ${c.id}: ${c.etiqueta} (ejemplos: ${c.palabrasClave.slice(0, 8).join(", ")})`)
    .join("\n")

  const listaItems = items
    .map((it) => {
      const ctx = it.odooCategoria ? ` [Odoo: ${it.odooCategoria}]` : ""
      const prov = it.proveedorNombre ? ` (proveedor: ${it.proveedorNombre})` : ""
      return `- id="${it.id}": ${it.descripcion.slice(0, 200)}${ctx}${prov}`
    })
    .join("\n")

  return `Eres un clasificador de productos industriales para un taller de manufactura (SMV) en México.

## Familias disponibles:
${familiasDisponibles}
- otros: Solo si realmente no encaja en ninguna familia

## Reglas:
1. Clasifica cada producto en la familia más específica posible.
2. Si la descripción menciona metal, acero, aluminio, solera, barra, tubo, lámina → "metals"
3. Si menciona herramienta, fresa, broca, inserto, tornillo, tuerca → "tools"
4. Si menciona plástico, nylon, delrin, acrílico → "plastics"
5. Si menciona papel, tinta, oficina → "office"
6. Si menciona medicina, botiquín → "medical"
7. Para tipoInsumo, usa identificadores normalizados (ej: acero_1018, aluminio_6061, fresa, broca, nylon)
8. Para medida, extrae dimensiones si las hay (ej: "1/4 x 2", "Ø25mm", "3/8\"")
9. Confianza: 0.9+ si estás seguro, 0.7-0.9 si probable, <0.7 si dudoso
10. Usa "otros" SOLO como último recurso — intenta clasificar todo

## Productos a clasificar:
${listaItems}

Clasifica cada producto.`
}

async function llamarGemini(prompt: string): Promise<string> {
  const apiKey = obtenerApiKey()
  const modelo = resolverModelo()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: CLASIFICACION_SCHEMA,
      temperature: 0.1,
    },
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ErrorIA("Gemini tardó demasiado en responder")
    }
    throw error
  }

  if (!res.ok) {
    const detalle = (await res.text()).slice(0, 500)
    if (detalle.includes("API_KEY_INVALID") || detalle.includes("API key not valid")) {
      throw new ErrorIA(
        "La API Key de Gemini no es válida. Genera una en Google AI Studio y actualiza GEMINI_API_KEY en .env.local"
      )
    }
    throw new ErrorIA(`Gemini respondió HTTP ${res.status}: ${detalle}`)
  }

  const json = (await res.json()) as GeminiGenerateResponse
  const texto = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) {
    const razon = json.candidates?.[0]?.finishReason ?? "sin texto"
    throw new ErrorIA(`Gemini no devolvió datos estructurados (${razon})`)
  }
  return texto
}

const CATEGORIAS_VALIDAS = new Set(
  CATEGORIAS_PRODUCTO_REGISTRO.map((c) => c.id)
)

function validarClasificacion(raw: {
  id?: string
  categoriaId?: string
  tipoInsumo?: string | null
  medida?: string | null
  confianza?: number
}): { id: string; clasificacion: ClasificacionIA } | null {
  if (!raw.id || !raw.categoriaId) return null
  const categoriaId = CATEGORIAS_VALIDAS.has(raw.categoriaId)
    ? raw.categoriaId
    : "otros"
  return {
    id: raw.id,
    clasificacion: {
      categoriaId,
      tipoInsumo: raw.tipoInsumo?.trim() || null,
      medida: raw.medida?.trim() || null,
      confianza: typeof raw.confianza === "number"
        ? Math.max(0, Math.min(1, raw.confianza))
        : 0.5,
    },
  }
}

/**
 * Clasifica un lote de ítems con Gemini.
 * Máximo 50 ítems por llamada.
 */
export async function clasificarLoteConGemini(
  items: ItemParaClasificar[]
): Promise<ResultadoClasificacionLote> {
  if (items.length === 0) return { items: [] }
  if (items.length > 50) {
    throw new ErrorIA("Máximo 50 ítems por lote de clasificación")
  }

  const prompt = construirPrompt(items)
  const texto = await llamarGemini(prompt)

  let parsed: { items?: unknown[] }
  try {
    parsed = JSON.parse(texto)
  } catch {
    throw new ErrorIA("Gemini devolvió JSON inválido para clasificación")
  }

  if (!Array.isArray(parsed.items)) {
    throw new ErrorIA("Gemini no devolvió array de clasificaciones")
  }

  const resultados = parsed.items
    .map((raw) => validarClasificacion(raw as Record<string, unknown>))
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return { items: resultados }
}
