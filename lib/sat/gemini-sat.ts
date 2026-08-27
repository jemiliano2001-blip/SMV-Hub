import { ErrorIA } from "@/lib/extraer-ia"
import { configGeneracionJson } from "@/lib/gemini-generation-config"
import { resolverModeloGemini } from "@/lib/gemini-modelos"
import type { SatSearchResult } from "@/lib/sat/buscar"
import { findSatCatalogEntryByKey } from "@/lib/sat/catalogo"
import { clasificarAreaComprasSmv, contextoSmvParaIa } from "@/lib/sat/perfil-compras-smv"
import { obtenerGeminiApiKey, MENSAJE_FALTA_GEMINI_API_KEY } from "@/lib/gemini-api-key"

/** Modelo económico para traducción/clasificación SAT (override con GEMINI_MODEL_SAT). */
export const MODELO_SAT_LITE = "gemini-3.5-flash-lite"
/** Modelo más capaz para casos ambiguos (override con GEMINI_MODEL_SAT_ESCALADO). */
export const MODELO_SAT_ESCALADO = "gemini-3.7-flash"
/** IDs retirados por Google — migrar al lite vigente. */
const MODELOS_SAT_OBSOLETOS: Readonly<Record<string, string>> = {
  "gemini-3.1-flash-lite-preview": MODELO_SAT_LITE,
}
const TIEMPO_MAXIMO_GEMINI_MS = 15_000

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
}

function obtenerApiKey(): string {
  const key = obtenerGeminiApiKey()
  if (!key) {
    throw new ErrorIA(
      MENSAJE_FALTA_GEMINI_API_KEY
    )
  }
  return key
}

export function resolverModeloLite(): string {
  return resolverModeloGemini(process.env.GEMINI_MODEL_SAT, MODELO_SAT_LITE, MODELOS_SAT_OBSOLETOS)
}

function resolverModeloEscalado(): string {
  return process.env.GEMINI_MODEL_SAT_ESCALADO?.trim() || MODELO_SAT_ESCALADO
}

async function llamarGeminiTexto(
  prompt: string,
  responseSchema: Record<string, unknown>,
  modelo?: string
): Promise<string> {
  const apiKey = obtenerApiKey()
  const modeloUsado = modelo ?? resolverModeloLite()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloUsado}:generateContent?key=${apiKey}`

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: configGeneracionJson({ responseSchema }),
  }

  // The report processor retries a failed chunk. Keeping this call to one
  // bounded attempt prevents a slow 5xx/429 sequence from exhausting the
  // 60-second Hosting SSR limit.
  const maxReintentos = 1
  for (let intento = 1; intento <= maxReintentos; intento++) {
    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_GEMINI_MS),
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
          "La API Key de Gemini configurada no es válida (API_KEY_INVALID). Genera una clave activa en Google AI Studio (https://aistudio.google.com/app/apikey) y actualiza GEMINI_API_KEY en tu archivo .env.local"
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

  throw new ErrorIA("Gemini no respondió tras varios reintentos (rate limit o error 5xx)")
}

const EXTRACCION_SCHEMA = {
  type: "object",
  properties: {
    tipoProducto: { type: "string", description: "Tipo de producto en español" },
    material: { type: "string", description: "Material principal si aplica" },
    funcion: { type: "string", description: "Función o uso principal" },
    terminosBusqueda: { type: "string", description: "Términos en español para catálogo SAT" },
    categoriaSat: { type: "string", description: "Categoría industrial breve" },
  },
  required: ["tipoProducto", "terminosBusqueda", "categoriaSat"],
}

const FUSION_SCHEMA = {
  type: "object",
  properties: {
    terminosBusqueda: { type: "string" },
    clave: { type: "string" },
    motivo: { type: "string" },
    confianza: { type: "string", description: "alta, media o baja" },
  },
  required: ["terminosBusqueda", "clave", "motivo", "confianza"],
}

const TRADUCCION_SCHEMA = {
  type: "object",
  properties: {
    terminosBusqueda: { type: "string" },
    categoria: { type: "string" },
  },
  required: ["terminosBusqueda", "categoria"],
}

const RAG_SCHEMA = {
  type: "object",
  properties: {
    clave: { type: "string" },
    motivo: { type: "string" },
  },
  required: ["clave", "motivo"],
}

const MAX_DESC_CANDIDATO = 200

function truncarDescripcion(desc: string): string {
  const t = desc.trim()
  return t.length <= MAX_DESC_CANDIDATO ? t : `${t.slice(0, MAX_DESC_CANDIDATO)}…`
}

export type CandidatoSat = { clave: string; descripcion: string }

export type ResultadoTraduccionFusion = {
  terminosBusqueda: string
  clave: string | null
  motivo: string
  confianzaIa: "alta" | "media" | "baja"
}

export type ExtraccionIndustrial = {
  tipoProducto: string
  material: string
  funcion: string
  terminosBusqueda: string
  categoriaSat: string
}

function parsearConfianzaIa(valor: string | undefined): "alta" | "media" | "baja" {
  const v = valor?.toLowerCase().trim()
  if (v === "alta" || v === "media" || v === "baja") return v
  return "media"
}

function validarClaveEnCandidatos(clave: string | undefined, candidatos: CandidatoSat[]): string | null {
  const claveLimpia = clave?.replace(/\D+/g, "") ?? ""
  if (claveLimpia.length !== 8) return null
  if (candidatos.some((c) => c.clave === claveLimpia)) return claveLimpia
  const enCatalogo = findSatCatalogEntryByKey(claveLimpia)
  if (enCatalogo) return enCatalogo.clave
  return null
}

export async function extraerProductoIndustrial(
  descripcion: string,
  proveedor?: string,
  contextoNegocio?: string
): Promise<ExtraccionIndustrial> {
  const prov = proveedor ? `\nProveedor: ${proveedor}` : ""
  const ctx =
    contextoNegocio ??
    contextoSmvParaIa(clasificarAreaComprasSmv(descripcion, proveedor ?? ""))
  const prompt = `${ctx}

Analiza este producto comprado en USA:
${descripcion}${prov}

Extrae tipo, material, función y términos en español para catálogo c_ClaveProdServ México.
Taller: escariador/rema, broca, fresa, tornillería, metales (div. 23/30/31).
Automatización: sensores, contactores, motores, cableado (div. 26/32).
Oficina: papel, toner, artículos de escritorio (div. 14/41/55).`

  const texto = await llamarGeminiTexto(prompt, EXTRACCION_SCHEMA)
  const parsed = JSON.parse(texto) as Partial<ExtraccionIndustrial>
  if (!parsed.terminosBusqueda?.trim()) {
    throw new ErrorIA("Gemini no devolvió términos de búsqueda válidos")
  }
  return {
    tipoProducto: parsed.tipoProducto?.trim() ?? "",
    material: parsed.material?.trim() ?? "",
    funcion: parsed.funcion?.trim() ?? "",
    terminosBusqueda: parsed.terminosBusqueda.trim(),
    categoriaSat: parsed.categoriaSat?.trim() ?? "",
  }
}

function construirPromptEleccion(
  descripcion: string,
  candidatos: CandidatoSat[],
  proveedor: string | undefined,
  extraccion?: ExtraccionIndustrial,
  motivoPrevio?: string,
  contextoNegocio?: string
): string {
  const prov = proveedor ? `\nProveedor: ${proveedor}` : ""
  const ctx =
    contextoNegocio ??
    contextoSmvParaIa(clasificarAreaComprasSmv(descripcion, proveedor ?? ""))
  const contexto = extraccion
    ? `\nAnálisis: tipo=${extraccion.tipoProducto}, material=${extraccion.material}, términos=${extraccion.terminosBusqueda}`
    : ""
  const previo = motivoPrevio ? `\nEvaluación previa: ${motivoPrevio}` : ""
  const lista =
    candidatos.length > 0
      ? `\nCandidatos SAT:\n${candidatos.map((c) => `- ${c.clave}: ${truncarDescripcion(c.descripcion)}`).join("\n")}`
      : ""

  return `${ctx}

Producto USA: ${descripcion}${prov}${contexto}${previo}${lista}

Elige la clave SAT más precisa para facturación CFDI en México. No inventes claves. Confianza: alta/media/baja.`
}

async function elegirClaveConModelo(
  descripcion: string,
  candidatos: CandidatoSat[],
  proveedor: string | undefined,
  modelo: string,
  extraccion?: ExtraccionIndustrial,
  motivoPrevio?: string
): Promise<ResultadoTraduccionFusion> {
  const prompt = construirPromptEleccion(descripcion, candidatos, proveedor, extraccion, motivoPrevio)
  const texto = await llamarGeminiTexto(prompt, FUSION_SCHEMA, modelo)
  const parsed = JSON.parse(texto) as {
    terminosBusqueda?: string
    clave?: string
    motivo?: string
    confianza?: string
  }

  const terminos = parsed.terminosBusqueda?.trim() ?? extraccion?.terminosBusqueda ?? ""
  if (!terminos) throw new ErrorIA("Gemini no devolvió términos de búsqueda válidos")

  const claveValida = validarClaveEnCandidatos(parsed.clave, candidatos)
  return {
    terminosBusqueda: terminos,
    clave: claveValida,
    motivo: parsed.motivo?.trim() ?? (claveValida ? "Selección por IA" : "Traducción por IA"),
    confianzaIa: parsearConfianzaIa(parsed.confianza),
  }
}

export function necesitaEscalamiento(
  resultado: ResultadoTraduccionFusion,
  candidatosScores?: SatSearchResult[]
): boolean {
  if (!resultado.clave) return true
  if (resultado.confianzaIa === "baja") return true
  if (resultado.confianzaIa === "alta") return false
  const top = candidatosScores?.[0]
  const segundo = candidatosScores?.[1]
  if (top && segundo && top.score - segundo.score < 40) return true
  return resultado.confianzaIa === "media" && Boolean(segundo)
}

export async function traducirYElegirClaveSat(
  descripcion: string,
  candidatos: CandidatoSat[],
  proveedor?: string,
  candidatosScores?: SatSearchResult[]
): Promise<ResultadoTraduccionFusion> {
  // The lightweight model already receives the product and validated SAT
  // candidates. Reserve the extra analysis for genuinely ambiguous cases.
  const lite = await elegirClaveConModelo(
    descripcion,
    candidatos,
    proveedor,
    resolverModeloLite()
  )

  if (!necesitaEscalamiento(lite, candidatosScores)) return lite

  try {
    let extraccion: ExtraccionIndustrial | undefined
    try {
      extraccion = await extraerProductoIndustrial(descripcion, proveedor)
    } catch {
      // The escalated model can still decide from the original description.
    }
    const escalado = await elegirClaveConModelo(
      descripcion,
      candidatos,
      proveedor,
      resolverModeloEscalado(),
      extraccion,
      lite.motivo
    )
    if (escalado.clave || escalado.confianzaIa !== "baja") return escalado
  } catch {
    // usar lite
  }

  return lite
}

export async function traducirDescripcionParaSat(
  descripcion: string,
  proveedor?: string
): Promise<{ terminosBusqueda: string; categoria: string }> {
  const prov = proveedor ? `\nProveedor: ${proveedor}` : ""
  const prompt = `Traduce a términos SAT en español:\n${descripcion}${prov}`
  const texto = await llamarGeminiTexto(prompt, TRADUCCION_SCHEMA)
  const parsed = JSON.parse(texto) as { terminosBusqueda?: string; categoria?: string }
  if (!parsed.terminosBusqueda?.trim()) {
    throw new ErrorIA("Gemini no devolvió términos de búsqueda válidos")
  }
  return {
    terminosBusqueda: parsed.terminosBusqueda.trim(),
    categoria: parsed.categoria?.trim() ?? "",
  }
}

export async function elegirClaveSatConRag(
  descripcion: string,
  candidatos: CandidatoSat[],
  proveedor?: string
): Promise<{ clave: string; motivo: string } | null> {
  if (candidatos.length === 0) return null
  const prov = proveedor ? `\nProveedor: ${proveedor}` : ""
  const lista = candidatos.map((c) => `- ${c.clave}: ${truncarDescripcion(c.descripcion)}`).join("\n")
  const prompt = `Producto USA: ${descripcion}${prov}\nElige UNA clave:\n${lista}`
  const texto = await llamarGeminiTexto(prompt, RAG_SCHEMA)
  const parsed = JSON.parse(texto) as { clave?: string; motivo?: string }
  const claveValida = validarClaveEnCandidatos(parsed.clave, candidatos)
  if (!claveValida) return null
  return { clave: claveValida, motivo: parsed.motivo?.trim() ?? "Selección por IA entre candidatos" }
}

export type GeminiSatDeps = {
  traducirYElegir?: (
    descripcion: string,
    candidatos: CandidatoSat[],
    proveedor?: string,
    candidatosScores?: SatSearchResult[]
  ) => Promise<ResultadoTraduccionFusion>
  traducir?: typeof traducirDescripcionParaSat
  elegirRag?: typeof elegirClaveSatConRag
}
