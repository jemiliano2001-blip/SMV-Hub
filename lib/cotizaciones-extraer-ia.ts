import { configGeneracionJson } from "@/lib/gemini-generation-config"
import { GEMINI_MODELO_WORKHORSE } from "@/lib/gemini-modelos"
import { ErrorIA, resolverModeloExtraccion, type MediaTypeFactura } from "@/lib/extraer-ia"

export interface CotizacionExtraida {
  numeroParte: string | null
  descripcion: string
  proveedor: string
  marca: string | null
  precioUnitario: number | null
  moneda: "USD" | "MXN"
  ubicacion: "USA" | "MX"
  cantidad: number | null
  total: number | null
  diasHabiles: string | null
  link: string | null
  notas: string | null
}

const COTIZACION_PRODUCTO_SCHEMA = {
  type: "object",
  properties: {
    numeroParte: { type: "string", nullable: true },
    descripcion: { type: "string" },
    proveedor: { type: "string" },
    marca: { type: "string", nullable: true },
    precioUnitario: { type: "number", nullable: true },
    moneda: { type: "string", enum: ["USD", "MXN"] },
    ubicacion: { type: "string", enum: ["USA", "MX"] },
    cantidad: { type: "number", nullable: true },
    diasHabiles: { type: "string", nullable: true },
    link: { type: "string", nullable: true },
    notas: { type: "string", nullable: true },
  },
  required: [
    "descripcion",
    "proveedor",
    "moneda",
    "ubicacion",
  ],
}

const PROMPT_PRODUCTO = `Analiza esta captura de pantalla de un producto, cotización, catálogo o tienda en línea industrial (ej. McMaster-Carr, Allen-Bradley, Rockwell, Radwell, Grainger, Misumi, Digikey, Mouser, Amazon, etc.) y extrae la información para una cotización de compra:

- numeroParte: Código de parte / SKU / Modelo del producto (ej. "140M-C2E-C16", "91290A115"). Si no aparece, usa null.
- descripcion: Nombre claro y descriptivo del producto en español o bilingüe técnico (ej. "Guardamotor 10-16A", "Tornillo Socket M6x20mm acero inoxidable").
- proveedor: Nombre de la tienda, distribuidor o sitio web donde se cotiza (ej. "Rockwell Automation", "Radwell", "McMaster-Carr", "Grainger", "Misumi", "Amazon México", "DigiKey").
- marca: Fabricante o marca original (ej. "Allen-Bradley", "Siemens", "SMC", "Festo", "Mitutoyo"). Si coincide con el proveedor o no aparece, puede ser null.
- precioUnitario: Precio unitario numérico sin comas ni símbolos. Si hay un precio por paquete, coloca el precio del paquete o unitario claro.
- moneda: "USD" si la tienda es en dólares / USA, o "MXN" si los precios están en pesos mexicanos (revisa símbolos como $, USD, MXN, IVA incluido, .com.mx, etc.).
- ubicacion: "USA" si el proveedor o moneda es de Estados Unidos, o "MX" si es de México.
- cantidad: Cantidad sugerida o vista en la captura (default 1).
- diasHabiles: Tiempo de entrega o disponibilidad detectada (ej. "En stock (2-3 días)", "Envío mismo día", "1-2 semanas"). Si no aparece, usa null.
- link: Enlace URL del producto si aparece en la captura o barra de direcciones, o null.
- notas: Especificaciones técnicas clave detectadas (voltaje, corriente, material, medidas, condición como nuevo/reacondicionado) o null.

Usa null en campos numéricos y textos cuando no haya certeza.`

function obtenerApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new ErrorIA(
      "Falta GEMINI_API_KEY en .env.local (crea una en Google AI Studio)"
    )
  }
  return key
}

export function normalizarCotizacionExtraida(
  raw: Partial<CotizacionExtraida>,
  linkFallback?: string | null
): CotizacionExtraida {
  const moneda: "USD" | "MXN" = raw.moneda === "MXN" ? "MXN" : "USD"
  const ubicacion: "USA" | "MX" = raw.ubicacion === "MX" || (moneda === "MXN" && raw.ubicacion !== "USA") ? "MX" : "USA"
  
  const cantidadNum = typeof raw.cantidad === "number" && raw.cantidad > 0 ? raw.cantidad : 1
  const precioNum = typeof raw.precioUnitario === "number" && Number.isFinite(raw.precioUnitario) ? raw.precioUnitario : null
  const total = precioNum !== null ? Number((precioNum * cantidadNum).toFixed(2)) : null

  return {
    numeroParte: raw.numeroParte?.trim() || null,
    descripcion: raw.descripcion?.trim() || "Producto cotizado",
    proveedor: raw.proveedor?.trim() || "Proveedor",
    marca: raw.marca?.trim() || null,
    precioUnitario: precioNum,
    moneda,
    ubicacion,
    cantidad: cantidadNum,
    total,
    diasHabiles: raw.diasHabiles?.trim() || null,
    link: raw.link?.trim() || linkFallback?.trim() || null,
    notas: raw.notas?.trim() || null,
  }
}

export async function extraerCotizacionScreenshotIA(
  base64: string,
  mimeType: MediaTypeFactura = "image/png",
  linkOpcional?: string | null,
  modeloOpcional?: string
): Promise<CotizacionExtraida> {
  const modelo = resolverModeloExtraccion(modeloOpcional || GEMINI_MODELO_WORKHORSE)
  const apiKey = obtenerApiKey()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const promptFinal = linkOpcional
    ? `${PROMPT_PRODUCTO}\n\nNota: El usuario proporcionó este enlace de referencia: ${linkOpcional}`
    : PROMPT_PRODUCTO

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
    generationConfig: configGeneracionJson({ responseSchema: COTIZACION_PRODUCTO_SCHEMA }),
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
        await new Promise((resolve) => setTimeout(resolve, Math.min(30000, 2000 * 2 ** (intento - 1))))
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
      const rawParsed = JSON.parse(texto) as Partial<CotizacionExtraida>
      return normalizarCotizacionExtraida(rawParsed, linkOpcional)
    } catch (err) {
      throw new ErrorIA(`Error al interpretar respuesta estructurada de Gemini: ${String(err)}`)
    }
  }

  throw new ErrorIA("No se pudo completar la extracción tras varios intentos")
}
