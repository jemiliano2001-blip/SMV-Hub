import {
  ExtraccionInvoiceSchema,
  type ExtraccionInvoice,
} from "@/lib/schemas"

/**
 * Modelos Gemini para extracción de facturas.
 * Verificar IDs vigentes en https://ai.google.dev/gemini-api/docs/models
 */
/** Default: visión + structured output (override con GEMINI_MODEL). */
export const MODELO_EXTRACCION = "gemini-3.5-flash"

/** Calidad alta para tablas densas en extracción por lote. */
export const MODELO_EXTRACCION_ALTA = "gemini-3.1-pro-preview"

// Tipos de archivo que acepta Gemini para facturas (imagen o PDF).
export type MediaTypeImagen = "image/jpeg" | "image/png" | "image/gif" | "image/webp"
export type MediaTypeFactura = MediaTypeImagen | "application/pdf"
const TIPOS_VALIDOS: MediaTypeFactura[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]

export function esMediaTypeValido(tipo: string): tipo is MediaTypeFactura {
  return (TIPOS_VALIDOS as string[]).includes(tipo)
}

export class ErrorIA extends Error {}

const INSTRUCCIONES = `Analiza esta factura/invoice o confirmación de pedido y extrae sus datos.
- proveedor: nombre del proveedor o vendedor.
- numeroFactura: número de factura/invoice/orden, o null si no aparece.
- fechaFactura: fecha en formato YYYY-MM-DD, o null si no aparece.
- moneda: código ISO de moneda (USD, MXN, EUR…); usa "USD" si no aparece.
- subtotal, envio, impuestos, total: montos numéricos, o null si no se leen con certeza.
  envio = cargo de envío/shipping/freight (NO incluir en subtotal).
  En USA el total suele ser subtotal + envio + impuestos; en Texas el tax (~8.25%) aplica sobre mercancía + envío.
- items: cada producto/servicio con descripcion, descripcionSimplificada, cantidad, precioUnitario, total,
  empresa, cuentaCargo, requisitor y ordenTrabajo.
  - descripcionSimplificada: traduce la descripción original al español y resúmela en pocas palabras claras (para la contadora).
  En McMaster-Carr y proveedores similares, el campo "Your reference" / referencia del ítem suele contener esta información:
  - empresa (destino): detecta a qué empresa va dirigido. Ejemplos de clientes: AFX INDUSTRIES, CYPRESS INDUSTRIES MEXICO, FISHER DYNAMICS MEXICO, LOGASA, LLC., MECALUX MEXICO, OHD OPERATORS DE MEXICO, SENSATA TECHNOLIGIES INC, SILICONE TECHNOLOGIES, SUPRAJIT MEXICO, TERMOFORMADOS INDUSTRIALES DE MATAMOROS. También "SMV" para herramientas propias. Suele venir abreviado (ej. APX, OHD, SMV, Fisher).
  - cuentaCargo: texto después del "/" (ej. SO1148, linea p749). Un SO por ítem.
  - requisitor: la persona que lo pide. Usualmente son: Antonio, Pantoja, Chava, Oscar, Pablo, Baez, Francisco.
  Si NO hay referencia explícita y el ítem es una herramienta de taller (brocas, fresas,
  reamers, machuelos, inserts, calibradores, etc.), usa empresa "SMV" y cuentaCargo "Stock".
  Si la referencia existe, respétala (no inventes "Stock").
  requisitor y ordenTrabajo en ítems: déjalos "" salvo que aparezcan explícitos o se deduzcan de la referencia.
Usa null en campos numéricos y "" en textos cuando no haya dato con certeza.`

const INSTRUCCIONES_LOTE = `Analiza esta imagen, que puede ser:
(a) una factura/invoice única, o
(b) una captura de una tabla o listado con VARIAS compras (una por fila).

Devuelve un campo "registros" con un elemento por cada compra detectada:
- Si es una factura única, "registros" tendrá UN elemento con los datos de esa factura.
- Si es una tabla/listado, "registros" tendrá UN elemento por cada fila de compra.

Para cada registro extrae: proveedor, numeroFactura, fechaFactura (YYYY-MM-DD),
moneda (ISO, "USD" si no aparece), subtotal, envio, impuestos, total e items
(descripcion, descripcionSimplificada, cantidad, precioUnitario, total, empresa, cuentaCargo, requisitor, ordenTrabajo).
En descripcionSimplificada traduce al español y resume brevemente para la contadora.
En McMaster-Carr parsea "Your reference" por ítem.
Empresas/Destinos comunes (pueden venir abreviados): AFX, CYPRESS, FISHER, LOGASA, MECALUX, OHD, SENSATA, SILICONE, SUPRAJIT, TERMOFORMADOS, o SMV.
Requisitores comunes: Antonio, Pantoja, Chava, Oscar, Pablo, Baez, Francisco.
Si no hay referencia y el ítem es herramienta de taller, usa empresa "SMV" y cuentaCargo "Stock".
Usa null en numéricos y "" en textos cuando no haya dato con certeza.`

// Subset OpenAPI que entiende Gemini structured output.
const ITEM_FACTURA_SCHEMA = {
  type: "object",
  properties: {
    descripcion: { type: "string" },
    descripcionSimplificada: { type: "string" },
    cantidad: { type: "number", nullable: true },
    precioUnitario: { type: "number", nullable: true },
    total: { type: "number", nullable: true },
    empresa: { type: "string" },
    cuentaCargo: { type: "string" },
    requisitor: { type: "string" },
    ordenTrabajo: { type: "string" },
  },
  required: [
    "descripcion",
    "descripcionSimplificada",
    "cantidad",
    "precioUnitario",
    "total",
    "empresa",
    "cuentaCargo",
    "requisitor",
    "ordenTrabajo",
  ],
}

const EXTRACCION_INVOICE_SCHEMA = {
  type: "object",
  properties: {
    proveedor: { type: "string" },
    numeroFactura: { type: "string", nullable: true },
    fechaFactura: { type: "string", nullable: true },
    moneda: { type: "string" },
    subtotal: { type: "number", nullable: true },
    envio: { type: "number", nullable: true },
    impuestos: { type: "number", nullable: true },
    total: { type: "number", nullable: true },
    linkProveedor: { type: "string", nullable: true },
    fechaEntrega: { type: "string", nullable: true },
    items: { type: "array", items: ITEM_FACTURA_SCHEMA },
  },
  required: [
    "proveedor",
    "numeroFactura",
    "fechaFactura",
    "moneda",
    "subtotal",
    "envio",
    "impuestos",
    "total",
    "items",
  ],
}

const LOTE_SCHEMA = {
  type: "object",
  properties: {
    registros: { type: "array", items: EXTRACCION_INVOICE_SCHEMA },
  },
  required: ["registros"],
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
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

function resolverModelo(modelo?: string): string {
  if (modelo?.trim()) return modelo.trim()
  return process.env.GEMINI_MODEL?.trim() || MODELO_EXTRACCION
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function llamarGemini(
  base64: string,
  mimeType: MediaTypeFactura,
  prompt: string,
  responseSchema: Record<string, unknown>,
  modelo: string
): Promise<string> {
  const apiKey = obtenerApiKey()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  }

  const maxReintentos = 3
  for (let intento = 1; intento <= maxReintentos; intento++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.status === 429 || res.status >= 500) {
      if (intento < maxReintentos) {
        await sleep(Math.min(30000, 2000 * 2 ** (intento - 1)))
        continue
      }
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

// Extrae los datos de una factura de una imagen usando Gemini con structured output.
export async function extraerFactura(
  base64: string,
  mimeType: MediaTypeFactura,
  modelo?: string
): Promise<ExtraccionInvoice> {
  const texto = await llamarGemini(
    base64,
    mimeType,
    INSTRUCCIONES,
    EXTRACCION_INVOICE_SCHEMA,
    resolverModelo(modelo)
  )

  const parsed = JSON.parse(texto) as unknown
  const datos = ExtraccionInvoiceSchema.safeParse(parsed)
  if (!datos.success) {
    throw new ErrorIA("La IA devolvió datos que no cumplen el schema esperado")
  }
  return datos.data
}

// Extrae uno o varios registros de una imagen (factura única o tabla/listado).
export async function extraerRegistros(
  base64: string,
  mimeType: MediaTypeFactura,
  modelo?: string
): Promise<ExtraccionInvoice[]> {
  const texto = await llamarGemini(
    base64,
    mimeType,
    INSTRUCCIONES_LOTE,
    LOTE_SCHEMA,
    resolverModelo(modelo)
  )

  const parsed = JSON.parse(texto) as { registros?: unknown }
  if (!Array.isArray(parsed.registros)) {
    throw new ErrorIA("La IA no devolvió el campo registros")
  }

  const registros: ExtraccionInvoice[] = []
  for (const registro of parsed.registros) {
    const datos = ExtraccionInvoiceSchema.safeParse(registro)
    if (!datos.success) {
      throw new ErrorIA("La IA devolvió un registro con formato inválido")
    }
    registros.push(datos.data)
  }
  return registros
}
