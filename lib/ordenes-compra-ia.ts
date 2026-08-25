import { configGeneracionJson } from "@/lib/gemini-generation-config"
import { GEMINI_MODELO_WORKHORSE } from "@/lib/gemini-modelos"
import { ErrorIA, resolverModeloExtraccion, type MediaTypeFactura } from "@/lib/extraer-ia"

export interface ExtraccionPOUsa {
  proveedor: string
  referenciaProveedor: string | null
  fechaPedido: string | null
  fechaEntregaEstimada: string | null
  moneda: "USD" | "MXN"
  items: Array<{
    producto: string
    descripcion: string
    cantidad: number
    precioUnitario: number
    impuestos: number
    subtotal: number
  }>
  subtotal: number | null
  envio: number | null
  impuestos: number | null
  total: number | null
  terminosPago: string | null
  notas: string | null
}

const PO_USA_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    proveedor: { type: "string" },
    referenciaProveedor: { type: "string", nullable: true },
    fechaPedido: { type: "string", nullable: true },
    fechaEntregaEstimada: { type: "string", nullable: true },
    moneda: { type: "string", enum: ["USD", "MXN"] },
    subtotal: { type: "number", nullable: true },
    envio: { type: "number", nullable: true },
    impuestos: { type: "number", nullable: true },
    total: { type: "number", nullable: true },
    terminosPago: { type: "string", nullable: true },
    notas: { type: "string", nullable: true },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          producto: { type: "string" },
          descripcion: { type: "string" },
          cantidad: { type: "number" },
          precioUnitario: { type: "number" },
          impuestos: { type: "number", nullable: true },
          subtotal: { type: "number" },
        },
        required: ["producto", "descripcion", "cantidad", "precioUnitario", "subtotal"],
      },
    },
  },
  required: ["proveedor", "moneda", "items"],
}

const PROMPT_EXTRAER_PO_USA = `Analiza este documento PDF o captura de pantalla de una cotización americana, carrito de compra, confirmación de orden o lista de precios de un proveedor industrial de Estados Unidos (ej. McMaster-Carr, MSC Industrial Supply, Shars Tool, Fastenal, Grainger, Diehl Tool Steel, Travers Tool, OnlineMetals, Alro Steel, etc.).

Extrae los datos en formato estructurado para generar una Purchase Order (PO):
1. **proveedor**: Nombre del proveedor estadounidense (ej. "McMaster-Carr", "MSC Industrial", "Shars Tool", "Diehl Tool Steel").
2. **referenciaProveedor**: Número de cotización (Quote #), número de carrito (Cart ID), número de referencia o "Your Reference".
3. **fechaPedido**: Fecha del documento o cotización en formato YYYY-MM-DD (o null si no viene).
4. **fechaEntregaEstimada**: Lead time o fecha estimada de entrega si está indicada (YYYY-MM-DD o null).
5. **moneda**: Por defecto "USD".
6. **items**: Lista de todas las partidas o artículos cotizados:
   - **producto**: Número de parte, SKU, código de catálogo o identificación de producto (ej. "91290A115", "303-1250", "CPM 3V").
   - **descripcion**: Descripción clara del producto, dimensiones, material o especificación.
   - **cantidad**: Cantidad ordenada/cotizada (número positivo).
   - **precioUnitario**: Precio por unidad en USD (número).
   - **impuestos**: Impuesto aplicable a la línea si viene desglosado (número o 0).
   - **subtotal**: Cantidad multiplicada por precioUnitario (o el subtotal de la línea).
7. **subtotal**: Subtotal antes de envío e impuestos.
8. **envio**: Cargo por flete/envío/shipping en USD (o 0 si no viene o es free shipping).
9. **impuestos**: Sales tax o impuestos en USD (o 0).
10. **total**: Total general en USD.
11. **terminosPago**: Términos de pago si se mencionan (ej. "Net 30", "Credit Card", "Prepaid") o null.
12. **notas**: Instrucciones especiales, notas de entrega o términos comerciales relevantes.`

/**
 * Llama a la API de Gemini para extraer datos de una cotización o documento de compra USA.
 */
export async function extraerPOUsaDesdeArchivo(
  base64Data: string,
  mediaType: MediaTypeFactura = "image/jpeg"
): Promise<ExtraccionPOUsa> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ErrorIA(
      "GEMINI_API_KEY no configurada. Agrega la clave a las variables de entorno."
    )
  }

  const modelo = resolverModeloExtraccion("normal") || GEMINI_MODELO_WORKHORSE
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const requestBody = {
    contents: [
      {
        parts: [
          { text: PROMPT_EXTRAER_PO_USA },
          {
            inline_data: {
              mime_type: mediaType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: configGeneracionJson({ responseSchema: PO_USA_EXTRACTION_SCHEMA }),
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === "AbortError") {
      throw new ErrorIA("La extracción con IA tardó demasiado (>60s).")
    }
    throw new ErrorIA(`Error de conexión al llamar a Gemini: ${String(err)}`)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const errorText = await res.text()
    throw new ErrorIA(`Gemini devolvió error ${res.status}: ${errorText}`)
  }

  const json = await res.json()
  const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!candidate) {
    throw new ErrorIA("Gemini no devolvió texto de extracción estructurado.")
  }

  try {
    const data = JSON.parse(candidate) as ExtraccionPOUsa
    return {
      proveedor: data.proveedor || "",
      referenciaProveedor: data.referenciaProveedor || null,
      fechaPedido: data.fechaPedido || null,
      fechaEntregaEstimada: data.fechaEntregaEstimada || null,
      moneda: data.moneda === "MXN" ? "MXN" : "USD",
      subtotal: typeof data.subtotal === "number" ? data.subtotal : null,
      envio: typeof data.envio === "number" ? data.envio : null,
      impuestos: typeof data.impuestos === "number" ? data.impuestos : null,
      total: typeof data.total === "number" ? data.total : null,
      terminosPago: data.terminosPago || null,
      notas: data.notas || null,
      items: Array.isArray(data.items)
        ? data.items.map((it) => ({
            producto: it.producto || "",
            descripcion: it.descripcion || "",
            cantidad: typeof it.cantidad === "number" && it.cantidad > 0 ? it.cantidad : 1,
            precioUnitario: typeof it.precioUnitario === "number" ? it.precioUnitario : 0,
            impuestos: typeof it.impuestos === "number" ? it.impuestos : 0,
            subtotal:
              typeof it.subtotal === "number"
                ? it.subtotal
                : (it.cantidad || 1) * (it.precioUnitario || 0),
          }))
        : [],
    }
  } catch (err: unknown) {
    throw new ErrorIA(`Error parseando JSON de Gemini: ${String(err)}`)
  }
}
