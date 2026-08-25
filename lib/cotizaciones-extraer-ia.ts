import { configGeneracionJson } from "@/lib/gemini-generation-config"
import { GEMINI_MODELO_WORKHORSE } from "@/lib/gemini-modelos"
import { ErrorIA, resolverModeloExtraccion, type MediaTypeFactura } from "@/lib/extraer-ia"
import { obtenerGeminiApiKey, MENSAJE_FALTA_GEMINI_API_KEY } from "@/lib/gemini-api-key"

export interface CotizacionExtraidaItem {
  numeroParte: string | null
  descripcion: string
  marca: string | null
  precioUnitario: number | null
  cantidad: number | null
  total: number | null
  diasHabiles: string | null
  link: string | null
  notas: string | null
}

export interface ExtraccionCotizacionMulti {
  proveedor: string
  moneda: "USD" | "MXN"
  ubicacion: "USA" | "MX"
  fechaCotizacion: string | null
  solicitante: string | null
  notasGenerales: string | null
  items: CotizacionExtraidaItem[]
}

// Compatibilidad con interfaz anterior
export interface CotizacionExtraida extends CotizacionExtraidaItem {
  proveedor: string
  moneda: "USD" | "MXN"
  ubicacion: "USA" | "MX"
}

const COTIZACIONES_MULTI_SCHEMA = {
  type: "object",
  properties: {
    proveedor: { type: "string" },
    moneda: { type: "string", enum: ["USD", "MXN"] },
    ubicacion: { type: "string", enum: ["USA", "MX"] },
    fechaCotizacion: { type: "string", nullable: true },
    solicitante: { type: "string", nullable: true },
    notasGenerales: { type: "string", nullable: true },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numeroParte: { type: "string", nullable: true },
          descripcion: { type: "string" },
          marca: { type: "string", nullable: true },
          cantidad: { type: "number", nullable: true },
          precioUnitario: { type: "number", nullable: true },
          total: { type: "number", nullable: true },
          diasHabiles: { type: "string", nullable: true },
          link: { type: "string", nullable: true },
          notas: { type: "string", nullable: true },
        },
        required: ["descripcion"],
      },
    },
  },
  required: ["proveedor", "moneda", "ubicacion", "items"],
}

const PROMPT_MULTI_COTIZACION = `Analiza esta captura de pantalla o documento PDF de una cotización formal, catálogo, carrito de compras o tienda en línea industrial (ej. McMaster-Carr, Misumi, Rockwell Automation, Grainger, Festo, Radwell, Digikey, Mouser, Amazon, etc.) y extrae TODOS los productos o partidas detectadas:

Metadatos Generales:
- proveedor: Nombre del proveedor, distribuidor o tienda (ej. "McMaster-Carr", "Misumi", "Grainger", "Rockwell Automation", "Radwell").
- moneda: "USD" si los precios son en dólares estadounidenses, o "MXN" si están en pesos mexicanos.
- ubicacion: "USA" si el proveedor es estadounidense/dólares, o "MX" si es mexicano/pesos.
- fechaCotizacion: Fecha del documento o cotización en formato "YYYY-MM-DD" si aparece, o null.
- solicitante: Nombre del solicitante o contacto interno si aparece (ej. "Edgar", "Pablo", "Francisco") o null.
- notasGenerales: Condiciones comerciales, vigencia de la cotización, número de cotización/RFQ o términos de envío.

Partidas (items): Extrae cada producto como un objeto en la lista:
- numeroParte: SKU, código de parte, modelo o número de catálogo (ej. "140M-C2E-C16", "91290A115", "E5CN-R2MT").
- descripcion: Descripción clara y técnica del producto en español o bilingüe técnico.
- marca: Fabricante o marca original (ej. "Allen-Bradley", "SMC", "Festo", "Mitutoyo", etc.) o null.
- cantidad: Cantidad cotizada (default 1).
- precioUnitario: Precio unitario numérico sin comas ni símbolos. Si hay precio por paquete o lote, divide o indica el unitario.
- total: Importe total de la partida (cantidad * precioUnitario) si aparece, o null.
- diasHabiles: Tiempo de entrega o disponibilidad (ej. "En stock (2-3 días)", "Envío inmediato", "2-3 semanas") o null.
- link: Enlace o URL específico del producto si aparece en la captura o texto, o null.
- notas: Especificaciones técnicas clave de la partida (voltaje, medidas, rosca, material, acabado).

Si la cotización contiene múltiples páginas o varias filas en una tabla, incluye TODAS las partidas en el array de "items". Si solo hay un producto, devuelve un array con 1 solo ítem. Usa null en campos numéricos o textos no disponibles.`

function obtenerApiKey(): string {
  const key = obtenerGeminiApiKey()
  if (!key) {
    throw new ErrorIA(
      MENSAJE_FALTA_GEMINI_API_KEY
    )
  }
  return key
}

export function normalizarItemExtraido(
  raw: Partial<CotizacionExtraidaItem>,
  linkFallback?: string | null
): CotizacionExtraidaItem {
  const cantidadNum =
    typeof raw.cantidad === "number" && raw.cantidad > 0 ? raw.cantidad : 1
  const precioNum =
    typeof raw.precioUnitario === "number" && Number.isFinite(raw.precioUnitario)
      ? raw.precioUnitario
      : null
  const total =
    typeof raw.total === "number" && Number.isFinite(raw.total)
      ? raw.total
      : precioNum !== null
      ? Number((precioNum * cantidadNum).toFixed(2))
      : null

  return {
    numeroParte: raw.numeroParte?.trim() || null,
    descripcion: raw.descripcion?.trim() || "Producto cotizado",
    marca: raw.marca?.trim() || null,
    cantidad: cantidadNum,
    precioUnitario: precioNum,
    total,
    diasHabiles: raw.diasHabiles?.trim() || null,
    link: raw.link?.trim() || linkFallback?.trim() || null,
    notas: raw.notas?.trim() || null,
  }
}

export interface RawExtraccionCotizacionMulti {
  proveedor?: string
  moneda?: "USD" | "MXN"
  ubicacion?: "USA" | "MX"
  fechaCotizacion?: string | null

  solicitante?: string | null
  notasGenerales?: string | null
  items?: Partial<CotizacionExtraidaItem>[]
}

export function normalizarCotizacionMulti(
  raw: RawExtraccionCotizacionMulti,
  linkFallback?: string | null
): ExtraccionCotizacionMulti {

  const moneda: "USD" | "MXN" = raw.moneda === "MXN" ? "MXN" : "USD"
  const ubicacion: "USA" | "MX" =
    raw.ubicacion === "MX" || (moneda === "MXN" && raw.ubicacion !== "USA")
      ? "MX"
      : "USA"

  const itemsRaw = Array.isArray(raw.items) && raw.items.length > 0 ? raw.items : []
  const items = itemsRaw.map((it) => normalizarItemExtraido(it, linkFallback))

  // Si no se detectó ningún ítem, crear uno con valores por defecto
  if (items.length === 0) {
    items.push(normalizarItemExtraido({}, linkFallback))
  }

  return {
    proveedor: raw.proveedor?.trim() || "Proveedor",
    moneda,
    ubicacion,
    fechaCotizacion: raw.fechaCotizacion?.trim() || null,
    solicitante: raw.solicitante?.trim() || null,
    notasGenerales: raw.notasGenerales?.trim() || null,
    items,
  }
}

export async function extraerCotizacionesMultiplesIA(
  base64: string,
  mimeType: MediaTypeFactura = "image/png",
  linkOpcional?: string | null,
  modeloOpcional?: string
): Promise<ExtraccionCotizacionMulti> {
  const modelo = resolverModeloExtraccion(modeloOpcional || GEMINI_MODELO_WORKHORSE)
  const apiKey = obtenerApiKey()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const promptFinal = linkOpcional
    ? `${PROMPT_MULTI_COTIZACION}\n\nNota: El usuario proporcionó este enlace o referencia de origen: ${linkOpcional}`
    : PROMPT_MULTI_COTIZACION

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: promptFinal },
        ],
      },
    ],
    generationConfig: configGeneracionJson({ responseSchema: COTIZACIONES_MULTI_SCHEMA }),
  }

  const timeoutMs = 60_000
  const maxReintentos = 3

  for (let intento = 1; intento <= maxReintentos; intento++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (res.status === 429 || res.status >= 500) {
      if (intento < maxReintentos) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(30000, 2000 * 2 ** (intento - 1)))
        )
        continue
      }
    }

    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 500)
      if (detalle.includes("API_KEY_INVALID") || detalle.includes("API key not valid")) {
        throw new ErrorIA(
          "La API Key de Gemini configurada no es válida (API_KEY_INVALID). Genera una clave activa en Google AI Studio y actualiza GEMINI_API_KEY en .env.local"
        )
      }
      throw new ErrorIA(`Gemini respondió HTTP ${res.status}: ${detalle}`)
    }

    const json = await res.json()
    const texto = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!texto) {
      const razon = json.candidates?.[0]?.finishReason ?? "sin texto"
      throw new ErrorIA(`Gemini no devolvió datos estructurados (${razon})`)
    }

    try {
      const rawParsed = JSON.parse(texto) as Partial<ExtraccionCotizacionMulti>
      return normalizarCotizacionMulti(rawParsed, linkOpcional)
    } catch (err) {
      throw new ErrorIA(`Error al interpretar respuesta estructurada de Gemini: ${String(err)}`)
    }
  }

  throw new ErrorIA("No se pudo completar la extracción tras varios intentos")
}

export function normalizarCotizacionExtraida(
  raw: Partial<CotizacionExtraida>,
  linkFallback?: string | null
): CotizacionExtraida {
  const item = normalizarItemExtraido(raw, linkFallback)
  const moneda: "USD" | "MXN" = raw.moneda === "MXN" ? "MXN" : "USD"
  const ubicacion: "USA" | "MX" =
    raw.ubicacion === "MX" || (moneda === "MXN" && raw.ubicacion !== "USA")
      ? "MX"
      : "USA"

  return {
    ...item,
    proveedor: raw.proveedor?.trim() || "Proveedor",
    moneda,
    ubicacion,
  }
}

// Retrocompatibilidad con función y tipos existentes
export async function extraerCotizacionScreenshotIA(
  base64: string,
  mimeType: MediaTypeFactura = "image/png",
  linkOpcional?: string | null,
  modeloOpcional?: string
): Promise<CotizacionExtraida> {
  const multi = await extraerCotizacionesMultiplesIA(
    base64,
    mimeType,
    linkOpcional,
    modeloOpcional
  )
  const primerItem = multi.items[0] || normalizarItemExtraido({}, linkOpcional)
  return {
    ...primerItem,
    proveedor: multi.proveedor,
    moneda: multi.moneda,
    ubicacion: multi.ubicacion,
  }
}


