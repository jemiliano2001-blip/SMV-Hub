/**
 * Asistente de Investigación de Precios, Proveedores e Insumos con Gemini IA.
 * Proporciona estimaciones de mercado, opciones de distribuidores (USA/MX),
 * tiempos de entrega y recomendaciones técnicas para manufactura CNC y taller.
 */

import { z } from "zod"
import { ErrorIA } from "@/lib/extraer-ia"
import { TIPO_CAMBIO_DEFAULT_USD_MXN } from "@/lib/tipo-cambio"
import type { CompraOdooItem, OrdenCompra } from "@/lib/schemas"

export const MODELO_INVESTIGACION_DEFAULT = "gemini-3.7-flash"
const TIEMPO_TIMEOUT_MS = 25_000

export const MercadoObjetivoSchema = z.enum(["usa", "mexico", "ambos"])
export type MercadoObjetivo = z.infer<typeof MercadoObjetivoSchema>

export const CategoriaInsumoInvestigacionSchema = z.enum([
  "herramientas_corte",
  "metales",
  "plasticos",
  "tornilleria_fijacion",
  "abrasivos_quimicos",
  "componentes_automatizacion",
  "consumibles_taller",
  "otros",
])
export type CategoriaInsumoInvestigacion = z.infer<typeof CategoriaInsumoInvestigacionSchema>

export const OpcionProveedorInvestigacionSchema = z.object({
  proveedor: z.string().trim().min(1),
  mercado: z.enum(["USA", "México"]),
  skuReferencia: z.string().trim().default(""),
  precioEstimadoUSD: z.number().min(0),
  precioEstimadoMXN: z.number().min(0),
  tiempoEntregaDias: z.number().int().min(1),
  calidadGrado: z.string().trim().default("Estándar industrial"),
  urlBusqueda: z.string().trim().default(""),
  notas: z.string().trim().default(""),
})
export type OpcionProveedorInvestigacion = z.infer<typeof OpcionProveedorInvestigacionSchema>

export const CoincidenciaHistoricaLocalSchema = z.object({
  encontrado: z.boolean(),
  fuente: z.enum(["odoo", "compras_americanas", "ninguna"]),
  proveedor: z.string().default(""),
  precioUltimoUSD: z.number().nullable().default(null),
  precioUltimoMXN: z.number().nullable().default(null),
  fechaUltimaCompra: z.string().default(""),
  descripcionHistorica: z.string().default(""),
})
export type CoincidenciaHistoricaLocal = z.infer<typeof CoincidenciaHistoricaLocalSchema>

export const ResultadoInvestigacionPreciosSchema = z.object({
  concepto: z.string().trim().min(1),
  categoria: CategoriaInsumoInvestigacionSchema,
  especificacionesClave: z.array(z.string()).default([]),
  rangoPreciosUSD: z.object({
    min: z.number().min(0),
    promedio: z.number().min(0),
    max: z.number().min(0),
  }),
  rangoPreciosMXN: z.object({
    min: z.number().min(0),
    promedio: z.number().min(0),
    max: z.number().min(0),
  }),
  opciones: z.array(OpcionProveedorInvestigacionSchema).min(1),
  mejorOpcionCosto: z.string().default(""),
  mejorOpcionTiempo: z.string().default(""),
  recomendacionesTecnicas: z.string().default(""),
  alternativasMaterial: z.array(z.string()).default([]),
  coincidenciaHistorica: CoincidenciaHistoricaLocalSchema.optional(),
})
export type ResultadoInvestigacionPrecios = z.infer<typeof ResultadoInvestigacionPreciosSchema>

export type ConsultaInvestigacionParams = {
  consulta: string
  mercado?: MercadoObjetivo
  cantidad?: number
  tipoCambio?: number
}

const RESPONSE_SCHEMA_GEMINI = {
  type: "object",
  properties: {
    concepto: { type: "string" },
    categoria: {
      type: "string",
      enum: [
        "herramientas_corte",
        "metales",
        "plasticos",
        "tornilleria_fijacion",
        "abrasivos_quimicos",
        "componentes_automatizacion",
        "consumibles_taller",
        "otros",
      ],
    },
    especificacionesClave: {
      type: "array",
      items: { type: "string" },
    },
    rangoPreciosUSD: {
      type: "object",
      properties: {
        min: { type: "number" },
        promedio: { type: "number" },
        max: { type: "number" },
      },
      required: ["min", "promedio", "max"],
    },
    opciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          proveedor: { type: "string" },
          mercado: { type: "string", enum: ["USA", "México"] },
          skuReferencia: { type: "string" },
          precioEstimadoUSD: { type: "number" },
          tiempoEntregaDias: { type: "integer" },
          calidadGrado: { type: "string" },
          urlBusqueda: { type: "string" },
          notas: { type: "string" },
        },
        required: [
          "proveedor",
          "mercado",
          "precioEstimadoUSD",
          "tiempoEntregaDias",
        ],
      },
    },
    mejorOpcionCosto: { type: "string" },
    mejorOpcionTiempo: { type: "string" },
    recomendacionesTecnicas: { type: "string" },
    alternativasMaterial: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "concepto",
    "categoria",
    "especificacionesClave",
    "rangoPreciosUSD",
    "opciones",
    "mejorOpcionCosto",
    "mejorOpcionTiempo",
    "recomendacionesTecnicas",
  ],
}

function obtenerApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new ErrorIA("Falta GEMINI_API_KEY en las variables de entorno.")
  }
  return key
}

export function resolverModeloInvestigacion(): string {
  return (
    process.env.GEMINI_MODEL_INVESTIGACION?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    MODELO_INVESTIGACION_DEFAULT
  )
}

function construirPrompt(params: ConsultaInvestigacionParams): string {
  const { consulta, mercado = "ambos", cantidad = 1 } = params
  const mercadoInstruccion =
    mercado === "usa"
      ? "Enfócate principalmente en distribuidores de USA (ej. McMaster-Carr, MSC Industrial, Shars Tool, OnlineMetals, Grainger USA, Fastenal)."
      : mercado === "mexico"
      ? "Enfócate principalmente en proveedores y distribuidores en México (ej. Grainger MX, Truper, Aceros Murillo, Aceros Olarra, Sumitomo MX, Misumi MX, distribuidores locales de maquinados)."
      : "Incluye opciones comparativas tanto de USA (McMaster, MSC, Shars, etc.) como de distribuidores en México."

  return `Eres el Asistente Experto en Compras Industriales, Maquinados CNC y Precios de Mercado de SMV (taller de maquinados de precisión y automatización).
Analiza el siguiente requerimiento de compras y elabora un estudio comparativo de precios y proveedores de referencia:

REQUERIMIENTO: "${consulta}"
CANTIDAD REQUERIDA: ${cantidad} pieza(s) / unidad(es).
ALCANCE DE MERCADO: ${mercadoInstruccion}

INSTRUCCIONES CLAVE:
1. Normaliza el nombre del concepto o material técnico (ej. aleación 6061-T6, Acero 4140 pretratado, Delrin/Acetal, Endmill de carburo AlTiN 4 gavilanes, etc.).
2. Genera entre 2 y 5 opciones realistas de distribuidores conocidos para este tipo de insumo industrial.
3. Proporciona precios unitarios estimados en USD realistas para el mercado industrial actual.
4. Para cada proveedor indica:
   - Nombre del proveedor (ej. McMaster-Carr, MSC Industrial Supply, Shars Tool, Grainger, Fastenal, OnlineMetals).
   - Mercado ("USA" o "México").
   - SKU o número de parte referencial típico cuando aplique.
   - Precio unitario estimado en USD.
   - Tiempo de entrega típico en días naturales/hábiles (ej. 1-2 días USA local, 3-5 días importación, 1-3 días nacional).
   - Calidad / Grado (ej. "Premium importado", "Económico alta rotación", "Grado ingeniería").
   - Notas clave (ej. "Venta por tramos de 3 pies", "Mínimo de compra", "Excelente para desbaste").
5. Calcula los rangos de mercado (min, promedio, max en USD).
6. Identifica claramente la mejor opción en costo y la mejor en tiempo de entrega.
7. Brinda recomendaciones técnicas esenciales (ej. tolerancias, lubricación requerida, velocidad de corte recomendada o aleaciones equivalentes sustitutas).`
}

/**
 * Ejecuta la investigación de precios usando Gemini Structured Output.
 */
export async function investigarPreciosInsumoIA(
  params: ConsultaInvestigacionParams,
  deps?: { apiKey?: string; modelo?: string; fetchFn?: typeof fetch }
): Promise<ResultadoInvestigacionPrecios> {
  const apiKey = deps?.apiKey || obtenerApiKey()
  const modelo = deps?.modelo || resolverModeloInvestigacion()
  const fetchImpl = deps?.fetchFn || fetch
  const tc = params.tipoCambio || TIPO_CAMBIO_DEFAULT_USD_MXN

  const prompt = construirPrompt(params)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA_GEMINI,
      temperature: 0.2,
    },
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIEMPO_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === "AbortError") {
      throw new ErrorIA("Tiempo de espera agotado al consultar a Gemini AI.")
    }
    throw new ErrorIA(
      `Error de conexión con Gemini AI: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "")
    throw new ErrorIA(`Gemini API respondió con error ${res.status}: ${errorBody}`)
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) {
    throw new ErrorIA("Gemini no devolvió texto de respuesta.")
  }

  let parsedRaw: Record<string, unknown>
  try {
    parsedRaw = JSON.parse(rawText) as Record<string, unknown>
  } catch {
    throw new ErrorIA("La respuesta de Gemini no fue un JSON válido.")
  }

  // Complementar cálculos de moneda MXN en opciones y rangos
  const opcionesCrudas = Array.isArray(parsedRaw.opciones) ? parsedRaw.opciones : []
  const opcionesConMXN = opcionesCrudas.map((op: Record<string, unknown>) => {
    const precioUSD = typeof op.precioEstimadoUSD === "number" ? op.precioEstimadoUSD : 0
    return {
      proveedor: String(op.proveedor || "Proveedor Industrial"),
      mercado: op.mercado === "México" ? ("México" as const) : ("USA" as const),
      skuReferencia: String(op.skuReferencia || ""),
      precioEstimadoUSD: Number(precioUSD.toFixed(2)),
      precioEstimadoMXN: Number((precioUSD * tc).toFixed(2)),
      tiempoEntregaDias: typeof op.tiempoEntregaDias === "number" ? Math.max(1, Math.round(op.tiempoEntregaDias)) : 3,
      calidadGrado: String(op.calidadGrado || "Estándar industrial"),
      urlBusqueda: String(op.urlBusqueda || ""),
      notas: String(op.notas || ""),
    }
  })

  const rangoUSDCrudo = (parsedRaw.rangoPreciosUSD as Record<string, number>) || {
    min: 0,
    promedio: 0,
    max: 0,
  }
  const minUSD = Number(Number(rangoUSDCrudo.min || 0).toFixed(2))
  const avgUSD = Number(Number(rangoUSDCrudo.promedio || 0).toFixed(2))
  const maxUSD = Number(Number(rangoUSDCrudo.max || 0).toFixed(2))

  const resultadoCompleto = {
    concepto: String(parsedRaw.concepto || params.consulta),
    categoria: (parsedRaw.categoria as CategoriaInsumoInvestigacion) || "otros",
    especificacionesClave: Array.isArray(parsedRaw.especificacionesClave)
      ? parsedRaw.especificacionesClave.map(String)
      : [],
    rangoPreciosUSD: {
      min: minUSD,
      promedio: avgUSD,
      max: maxUSD,
    },
    rangoPreciosMXN: {
      min: Number((minUSD * tc).toFixed(2)),
      promedio: Number((avgUSD * tc).toFixed(2)),
      max: Number((maxUSD * tc).toFixed(2)),
    },
    opciones: opcionesConMXN.length > 0 ? opcionesConMXN : [
      {
        proveedor: "Mercado Industrial General",
        mercado: "USA" as const,
        skuReferencia: "",
        precioEstimadoUSD: avgUSD || 10,
        precioEstimadoMXN: Number(((avgUSD || 10) * tc).toFixed(2)),
        tiempoEntregaDias: 3,
        calidadGrado: "Estándar industrial",
        urlBusqueda: "",
        notas: "Estimación general de mercado.",
      },
    ],
    mejorOpcionCosto: String(parsedRaw.mejorOpcionCosto || ""),
    mejorOpcionTiempo: String(parsedRaw.mejorOpcionTiempo || ""),
    recomendacionesTecnicas: String(parsedRaw.recomendacionesTecnicas || ""),
    alternativasMaterial: Array.isArray(parsedRaw.alternativasMaterial)
      ? parsedRaw.alternativasMaterial.map(String)
      : [],
  }

  return ResultadoInvestigacionPreciosSchema.parse(resultadoCompleto)
}

interface MatchHistorico {
  fuente: "odoo" | "compras_americanas"
  proveedor: string
  precioUltimoUSD: number
  precioUltimoMXN: number
  fechaUltimaCompra: string
  descripcionHistorica: string
}

/**
 * Cruza la investigación técnica con el historial local de SMV Hub y Odoo.
 * Recolecta todos los matches que cumplen los criterios y selecciona el más reciente.
 */
export function cruzarConHistoricoLocal(
  investigacion: ResultadoInvestigacionPrecios,
  ordenesCompras: readonly OrdenCompra[],
  itemsOdoo: readonly CompraOdooItem[],
  tipoCambio: number = TIPO_CAMBIO_DEFAULT_USD_MXN
): ResultadoInvestigacionPrecios {
  const palabrasConcepto = investigacion.concepto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[\s,./\-_()]+/)
    .filter((w) => w.length >= 3)

  if (palabrasConcepto.length === 0) {
    return investigacion
  }

  function calcularCoincidencias(texto: string): number {
    const norm = texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    const palabrasTexto = norm.split(/[\s,./\-_()]+/).filter((w) => w.length > 0)
    let count = 0
    for (const w of palabrasConcepto) {
      if (palabrasTexto.includes(w)) {
        count++
      } else if (w.length >= 5) {
        // Coincidencia con frontera de palabra de al menos 5 caracteres (ej. "alumi" -> aluminio / aluminum)
        const raiz = w.slice(0, 5)
        if (palabrasTexto.some((pw) => pw.startsWith(raiz) || (pw.length >= 5 && raiz.startsWith(pw.slice(0, 5))))) {
          count++
        }
      }
    }
    return count
  }

  const matches: MatchHistorico[] = []
  const umbralCoincidencias = Math.min(2, palabrasConcepto.length)

  // 1. Recolectar coincidencias en items de Odoo
  for (const it of itemsOdoo) {
    if (!it.descripcion) continue
    const coinciden = calcularCoincidencias(it.descripcion)
    if (coinciden >= umbralCoincidencias) {
      const precioUSD = it.moneda === "USD" ? it.precioUnitario : it.precioUnitario / tipoCambio
      const precioMXN = it.moneda === "MXN" ? it.precioUnitario : it.precioUnitario * tipoCambio
      matches.push({
        fuente: "odoo",
        proveedor: it.proveedorNombre || "Proveedor Odoo",
        precioUltimoUSD: Number(precioUSD.toFixed(2)),
        precioUltimoMXN: Number(precioMXN.toFixed(2)),
        fechaUltimaCompra: it.fecha || "",
        descripcionHistorica: it.descripcion,
      })
    }
  }

  // 2. Recolectar coincidencias en órdenes de compras americanas
  for (const ord of ordenesCompras) {
    for (const item of ord.items || []) {
      const textoCompleto = `${item.descripcion || ""} ${item.descripcionSimplificada || ""}`
      if (!textoCompleto.trim()) continue
      const coinciden = calcularCoincidencias(textoCompleto)
      if (coinciden >= umbralCoincidencias) {
        const precioUnit = item.precioUnitario ?? (item.total && item.cantidad ? item.total / item.cantidad : null)
        if (precioUnit !== null) {
          const precioUSD = ord.moneda === "USD" ? precioUnit : precioUnit / tipoCambio
          const precioMXN = ord.moneda === "MXN" ? precioUnit : precioUnit * tipoCambio
          const fechaStr = ord.fechaFactura
            ? String(ord.fechaFactura)
            : ord.creadoEn instanceof Date
            ? ord.creadoEn.toISOString().split("T")[0]
            : String(ord.creadoEn || "")

          matches.push({
            fuente: "compras_americanas",
            proveedor: ord.proveedor || "Proveedor USA",
            precioUltimoUSD: Number(precioUSD.toFixed(2)),
            precioUltimoMXN: Number(precioMXN.toFixed(2)),
            fechaUltimaCompra: fechaStr,
            descripcionHistorica: item.descripcionSimplificada || item.descripcion,
          })
        }
      }
    }
  }

  if (matches.length === 0) {
    return investigacion
  }

  // Ordenar por fecha más reciente descendente
  matches.sort((a, b) => b.fechaUltimaCompra.localeCompare(a.fechaUltimaCompra))
  const masReciente = matches[0]

  return {
    ...investigacion,
    coincidenciaHistorica: {
      encontrado: true,
      fuente: masReciente.fuente,
      proveedor: masReciente.proveedor,
      precioUltimoUSD: masReciente.precioUltimoUSD,
      precioUltimoMXN: masReciente.precioUltimoMXN,
      fechaUltimaCompra: masReciente.fechaUltimaCompra,
      descripcionHistorica: masReciente.descripcionHistorica,
    },
  }
}
