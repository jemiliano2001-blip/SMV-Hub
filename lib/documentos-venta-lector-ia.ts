/**
 * Módulo de Extracción Inteligente de Órdenes de Compra de Clientes (Customer PO Reader).
 *
 * Utiliza Gemini 3.7 Flash con capacidades multimodales (PDF e imágenes)
 * para leer órdenes de compra de clientes industriales y emparejarlas con ventas en Odoo.
 */

import { z } from "zod"
import { ErrorIA } from "./extraer-ia"
import type { VentaOdooSo } from "./schemas"

export const MODELO_ORDENES_CLIENTE_DEFAULT = "gemini-3.7-flash"

export const PartidaOrdenClienteSchema = z.object({
  numeroLinea: z.number().int().optional().default(1),
  numeroParteCliente: z.string().optional().default(""),
  descripcion: z.string().min(1, "La descripción de la partida es obligatoria"),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero"),
  unidad: z.string().optional().default("PZA"),
  precioUnitario: z.number().nullable().optional().default(null),
  total: z.number().nullable().optional().default(null),
  fechaEntregaRequerida: z.string().optional().default(""),
})

export type PartidaOrdenCliente = z.infer<typeof PartidaOrdenClienteSchema>

export const OrdenCompraClienteExtraidaSchema = z.object({
  numeroOrdenCompraCliente: z.string().min(1, "Número de orden de compra o PO no encontrado"),
  nombreCliente: z.string().min(1, "Nombre del cliente requerido"),
  rfcCliente: z.string().optional().default(""),
  fechaOrden: z.string().optional().default(""),
  fechaEntregaRequerida: z.string().optional().default(""),
  moneda: z.enum(["USD", "MXN", "EUR"]).default("USD"),
  subtotal: z.number().nullable().optional().default(null),
  impuestos: z.number().nullable().optional().default(null),
  total: z.number().nullable().optional().default(null),
  partidas: z.array(PartidaOrdenClienteSchema).min(1, "Debe contener al menos una partida"),
  terminosEntrega: z.string().optional().default(""),
  notasEspeciales: z.string().optional().default(""),
  confianzaExtraccion: z.number().min(0).max(1).default(0.9),
})

export type OrdenCompraClienteExtraida = z.infer<typeof OrdenCompraClienteExtraidaSchema>

export interface EmparejamientoVentaOdoo {
  so: VentaOdooSo
  scoreCoincidencia: number // 0 a 100
  motivoCoincidencia: string
  partidasSugeridas: Array<{
    odooLineId: number
    productName: string
    qtySolicitada: number
  }>
}

export function resolverModeloExtraccionCliente(): string {
  return process.env.GEMINI_MODEL_CLIENTE_PO?.trim() || MODELO_ORDENES_CLIENTE_DEFAULT
}

const SYSTEM_PROMPT_PO_CLIENTE = `
Eres un extractor experto de Órdenes de Compra de Clientes Industriales (Customer Purchase Orders / POs) para SMV (taller de manufactura de precisión, pailería y maquinado CNC).
Tu objetivo es analizar el documento adjunto (PDF o imagen escaneada) y extraer fielmente:
1. El número de orden de compra del cliente (ej. "PO-2026-4412", "450098231", "OC-889").
2. Nombre o Razón Social del cliente compradora (ej. "Suprajit Automotive", "Schneider Electric", "BorgWarner", "Honeywell").
3. Moneda (USD o MXN).
4. Cada una de las partidas/líneas de producto: número de parte, descripción técnica, cantidad solicitada, precio unitario y total.
5. Fechas de emisión y de entrega requerida.

Sé extremadamente preciso con las cantidades y números de parte. Si algún dato no está explícito en el documento, indícalo como null o cadena vacía.
`.trim()

/**
 * Extrae los datos de una Orden de Compra de Cliente desde un archivo base64 usando Gemini 3.7.
 */
export async function extraerOrdenCompraClienteIA(
  base64Data: string,
  mimeType: string,
  opciones: {
    apiKey?: string
    modelo?: string
    fetchFn?: typeof fetch
    timeoutMs?: number
  } = {}
): Promise<OrdenCompraClienteExtraida> {
  const apiKey = opciones.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ErrorIA("No se ha configurado GEMINI_API_KEY en el entorno")
  }

  const modelo = opciones.modelo || resolverModeloExtraccionCliente()
  const fetchFn = opciones.fetchFn || fetch
  const timeoutMs = opciones.timeoutMs || 30_000

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Por favor extrae todos los datos de esta orden de compra de cliente de forma estructurada según el esquema definido.",
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT_PO_CLIENTE }],
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            numeroOrdenCompraCliente: { type: "STRING" },
            nombreCliente: { type: "STRING" },
            rfcCliente: { type: "STRING" },
            fechaOrden: { type: "STRING" },
            fechaEntregaRequerida: { type: "STRING" },
            moneda: { type: "STRING", enum: ["USD", "MXN", "EUR"] },
            subtotal: { type: "NUMBER" },
            impuestos: { type: "NUMBER" },
            total: { type: "NUMBER" },
            partidas: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  numeroLinea: { type: "INTEGER" },
                  numeroParteCliente: { type: "STRING" },
                  descripcion: { type: "STRING" },
                  cantidad: { type: "NUMBER" },
                  unidad: { type: "STRING" },
                  precioUnitario: { type: "NUMBER" },
                  total: { type: "NUMBER" },
                  fechaEntregaRequerida: { type: "STRING" },
                },
                required: ["descripcion", "cantidad"],
              },
            },
            terminosEntrega: { type: "STRING" },
            notasEspeciales: { type: "STRING" },
            confianzaExtraccion: { type: "NUMBER" },
          },
          required: ["numeroOrdenCompraCliente", "nombreCliente", "partidas"],
        },
        temperature: 0.1,
      },
    }

    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      throw new ErrorIA(`Error de Gemini (${response.status}): ${errorText || response.statusText}`)
    }

    const json = await response.json()
    const contentText = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!contentText) {
      throw new ErrorIA("Gemini no devolvió texto de extracción")
    }

    const parsedRaw = JSON.parse(contentText)
    return OrdenCompraClienteExtraidaSchema.parse(parsedRaw)
  } catch (error) {
    if (error instanceof ErrorIA) {
      throw error
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ErrorIA(`Tiempo de espera agotado al extraer la orden de compra (${timeoutMs}ms)`)
    }
    throw new ErrorIA(
      `Fallo al extraer orden de compra de cliente: ${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Empareja los datos extraídos de la orden de cliente con las órdenes de venta existentes en Odoo (`ventas_odoo_so`).
 */
export function emparejarConVentasOdoo(
  ordenCliente: OrdenCompraClienteExtraida,
  listaSos: readonly VentaOdooSo[]
): EmparejamientoVentaOdoo[] {
  const resultados: EmparejamientoVentaOdoo[] = []

  const poBuscadaNorm = ordenCliente.numeroOrdenCompraCliente.toLowerCase().replace(/[^a-z0-9]/g, "")
  const clienteNorm = ordenCliente.nombreCliente.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")

  for (const so of listaSos) {
    let score = 0
    const motivos: string[] = []

    // 1. Coincidencia por número de orden de compra / PO
    const ocSo = (so.ordenCompra || so.clientOrderRef || "").toLowerCase().replace(/[^a-z0-9]/g, "")
    if (ocSo && poBuscadaNorm) {
      if (ocSo === poBuscadaNorm) {
        score += 65
        motivos.push(`Coincidencia exacta de Orden de Compra: ${so.ordenCompra || so.clientOrderRef}`)
      } else if (ocSo.includes(poBuscadaNorm) || poBuscadaNorm.includes(ocSo)) {
        score += 40
        motivos.push(`Coincidencia parcial de PO: ${so.ordenCompra || so.clientOrderRef}`)
      }
    }

    // 2. Coincidencia por cliente / partnerName
    const partnerNorm = (so.partnerName || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    if (partnerNorm && clienteNorm) {
      if (partnerNorm.includes(clienteNorm) || clienteNorm.includes(partnerNorm)) {
        score += 25
        motivos.push(`Cliente coincidente: ${so.partnerName}`)
      }
    }

    // 3. Coincidencia por partidas
    const partidasSugeridas: Array<{
      odooLineId: number
      productName: string
      qtySolicitada: number
    }> = []

    let lineasCoincidentes = 0
    for (const lineaSo of so.lineas || []) {
      const descSo = (lineaSo.productName || "").toLowerCase()
      const codeSo = (lineaSo.productDefaultCode || "").toLowerCase()

      for (const partCliente of ordenCliente.partidas) {
        const descCliente = partCliente.descripcion.toLowerCase()
        const numParte = (partCliente.numeroParteCliente || "").toLowerCase()

        const match =
          (numParte && (descSo.includes(numParte) || (codeSo && codeSo.includes(numParte)))) ||
          descSo.includes(descCliente) ||
          descCliente.includes(descSo)

        if (match) {
          lineasCoincidentes++
          partidasSugeridas.push({
            odooLineId: lineaSo.odooLineId,
            productName: lineaSo.productName,
            qtySolicitada: Math.min(partCliente.cantidad, lineaSo.qtyPending || partCliente.cantidad),
          })
          break
        }
      }
    }

    if (lineasCoincidentes > 0) {
      score += Math.min(25, lineasCoincidentes * 10)
      motivos.push(`${lineasCoincidentes} partida(s) coincidentes`)
    }

    if (score >= 25) {
      resultados.push({
        so,
        scoreCoincidencia: Math.min(100, score),
        motivoCoincidencia: motivos.join(" · ") || "Coincidencia general",
        partidasSugeridas,
      })
    }
  }

  // Ordenar por mejor score
  resultados.sort((a, b) => b.scoreCoincidencia - a.scoreCoincidencia)
  return resultados
}
