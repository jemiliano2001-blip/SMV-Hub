import { NextRequest } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { adminDb } from "@/lib/firebase-admin"
import { ErrorIA } from "@/lib/extraer-ia"
import {
  aplicarReglaConfianza,
  construirPromptTraduccionLote,
  crearResumenProcesamiento,
  parsearRespuestaTraduccion,
  type ResumenProcesamientoContableIa,
} from "@/lib/reportes-contables-ia"
import {
  combinarMapeosSmv,
  construirHistorialSatDesdeEntradas,
  getMapeosSmv,
  sugerirClavesSatLote,
} from "@/lib/sat/sugerir-clave"
import { cargarMapeosSatDesdeFirestore } from "@/lib/sat/cargar-mapeos-firestore"
import { resolverModeloLite } from "@/lib/sat/gemini-sat"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"

const MAX_ORDENES_SEGURAS_POR_REQUEST = 2
const MAX_ORDENES_LEGACY_POR_REQUEST = 10

type HistorialEntradaRequest = {
  descripcion: string
  claveProdServ: string
}

function normalizarHistorialEntradas(valor: unknown): HistorialEntradaRequest[] {
  if (!Array.isArray(valor)) return []

  return valor.flatMap((entrada) => {
    if (!entrada || typeof entrada !== "object") return []
    const record = entrada as Record<string, unknown>
    const descripcion = typeof record.descripcion === "string" ? record.descripcion.trim() : ""
    const clave = typeof record.claveProdServ === "string"
      ? normalizarClaveProdServ(record.claveProdServ)
      : null

    return descripcion && clave ? [{ descripcion, claveProdServ: clave }] : []
  })
}

const RequestSchema = z.object({
  ordenesIds: z.array(z.string().trim().min(1)).min(1).max(MAX_ORDENES_LEGACY_POR_REQUEST),
  historialEntradas: z.unknown().optional().transform(normalizarHistorialEntradas),
})

const ItemOrdenSchema = z
  .object({
    descripcion: z.string().min(1),
    descripcionSimplificada: z.string().optional().default(""),
    claveProdServ: z.string().regex(/^\d{8}$/).nullable().optional().default(null),
    satPendiente: z.boolean().optional().default(true),
  })
  .passthrough()

type ItemOrden = z.infer<typeof ItemOrdenSchema>

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
}

function resolverModeloTraduccion(): string {
  return resolverModeloLite()
}

async function traducirDescripciones(descripciones: string[]): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new ErrorIA("Falta GEMINI_API_KEY en .env.local")

  const modelo = resolverModeloTraduccion()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: construirPromptTraduccionLote(descripciones) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: { type: "array", items: { type: "string" } },
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ErrorIA("Gemini tardó demasiado en traducir este bloque")
    }
    throw error
  }

  if (!res.ok) {
    const detalle = (await res.text()).slice(0, 500)
    throw new ErrorIA(`Gemini respondió HTTP ${res.status}: ${detalle}`)
  }

  const respuesta = (await res.json()) as GeminiResponse
  const texto = respuesta.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) {
    throw new ErrorIA(
      `Gemini no devolvió datos estructurados (${respuesta.candidates?.[0]?.finishReason ?? "sin texto"})`
    )
  }
  return parsearRespuestaTraduccion(texto, descripciones.length)
}

function leerItems(data: Record<string, unknown>): ItemOrden[] {
  const parsed = z.array(ItemOrdenSchema).safeParse(data.items)
  if (!parsed.success) throw new Error("La orden tiene ítems con formato inválido")
  return parsed.data
}

function proveedorDeOrden(data: Record<string, unknown>): string | undefined {
  return typeof data.proveedor === "string" && data.proveedor.trim()
    ? data.proveedor.trim()
    : undefined
}

async function procesarOrden(
  ordenId: string,
  resumen: ResumenProcesamientoContableIa,
  historial: ReturnType<typeof construirHistorialSatDesdeEntradas>,
  mapeos: Awaited<ReturnType<typeof cargarMapeosSatDesdeFirestore>>
): Promise<void> {
  const doc = await adminDb.collection("ordenes").doc(ordenId).get()
  if (!doc.exists) throw new Error("La orden ya no existe")

  const data = doc.data() as Record<string, unknown> | undefined
  if (!data) throw new Error("No se pudieron leer los datos de la orden")

  const items = leerItems(data)
  const proveedor = proveedorDeOrden(data)
  const indicesSinTraduccion = items
    .map((item, indice) => (!item.descripcionSimplificada.trim() ? indice : -1))
    .filter((indice) => indice >= 0)

  const actualizados = items.map((item) => ({ ...item }))
  if (indicesSinTraduccion.length > 0) {
    const traducciones = await traducirDescripciones(
      indicesSinTraduccion.map((indice) => actualizados[indice].descripcion)
    )
    indicesSinTraduccion.forEach((indice, posicion) => {
      actualizados[indice].descripcionSimplificada = traducciones[posicion]
      resumen.traducidas += 1
    })
  }

  const indicesSinClave = actualizados
    .map((item, indice) => (!item.claveProdServ ? indice : -1))
    .filter((indice) => indice >= 0)

  if (indicesSinClave.length > 0) {
    const sugerencias = await sugerirClavesSatLote(
      indicesSinClave.map((indice) => ({
        descripcion: actualizados[indice].descripcion,
        proveedor,
        terminosPrevios: actualizados[indice].descripcionSimplificada || undefined,
      })),
      historial,
      { mapeos: combinarMapeosSmv(getMapeosSmv(), mapeos) }
    )

    sugerencias.forEach((sugerencia, posicion) => {
      const indice = indicesSinClave[posicion]
      const resultado = aplicarReglaConfianza(sugerencia)
      actualizados[indice].claveProdServ = resultado.claveProdServ
      actualizados[indice].satPendiente = resultado.satPendiente
      if (resultado.claveProdServ) resumen.clavesAsignadas += 1
      else resumen.clavesPendientes += 1
    })
  }

  await doc.ref.update({ items: actualizados, actualizadoEn: new Date() })
  resumen.procesadas += 1
}

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Payload inválido", detalles: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const resumen = crearResumenProcesamiento()
  try {
    const historial = construirHistorialSatDesdeEntradas(parsed.data.historialEntradas ?? [])
    const mapeos = await cargarMapeosSatDesdeFirestore()
    const ordenesUnicas = [...new Set(parsed.data.ordenesIds)]
    const ordenesAProcesar = ordenesUnicas.slice(0, MAX_ORDENES_SEGURAS_POR_REQUEST)
    resumen.ordenesOmitidas.push(...ordenesUnicas.slice(MAX_ORDENES_SEGURAS_POR_REQUEST))

    for (const ordenId of ordenesAProcesar) {
      try {
        await procesarOrden(ordenId, resumen, historial, mapeos)
      } catch (error) {
        console.error("[retro-traducir-lote] orden fallida", ordenId, error)
        resumen.ordenesFallidas.push(ordenId)
      }
    }

    return Response.json({ resumen })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido"
    console.error("[retro-traducir-lote] error", mensaje)
    const status = error instanceof ErrorIA && mensaje.includes("GEMINI_API_KEY") ? 503 : 502
    return Response.json({ error: mensaje }, { status })
  }
}
