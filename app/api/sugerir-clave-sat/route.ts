import { NextRequest } from "next/server"
import { z } from "zod"
import { verificarModulo } from "@/lib/api-auth"
import {
  construirHistorialSat,
  construirHistorialSatDesdeEntradas,
  sugerirClavesSatLote,
  combinarMapeosSmv,
  getMapeosSmv,
  type ItemParaSugerirSat,
} from "@/lib/sat/sugerir-clave"
import { cargarMapeosSatDesdeFirestore } from "@/lib/sat/cargar-mapeos-firestore"
import {
  MAX_ITEMS_SUGERIR_CLAVE_SAT,
  normalizarHistorialEntradasSat,
} from "@/lib/sat/payload-sugerir-clave"
import { ErrorIA } from "@/lib/extraer-ia"

const ItemRequestSchema = z.object({
  descripcion: z.unknown().transform((v) => (typeof v === "string" ? v : "")),
  proveedor: z.unknown().optional().transform((v) => (typeof v === "string" ? v : undefined)),
  terminosPrevios: z.unknown().optional().transform((v) => {
    if (typeof v !== "string") return undefined
    return v.length <= 1000 ? v : v.slice(0, 1000)
  }),
})

const RequestSchema = z.object({
  items: z.array(ItemRequestSchema).min(1).max(MAX_ITEMS_SUGERIR_CLAVE_SAT),
  historialEntradas: z.unknown().optional().transform(normalizarHistorialEntradasSat),
})

export async function POST(req: NextRequest) {
  const auth = await verificarModulo(req, ["nueva-compra", "ordenes", "reportes", "claves-sat", "cotizaciones"], "No tienes acceso a la clasificacion SAT")
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    const itemsRecibidos =
      body !== null && typeof body === "object" && "items" in body && Array.isArray(body.items)
        ? body.items.length
        : 0
    const demasiadosItems = itemsRecibidos > MAX_ITEMS_SUGERIR_CLAVE_SAT
    return Response.json(
      {
        error: demasiadosItems
          ? `Demasiados ítems: máximo ${MAX_ITEMS_SUGERIR_CLAVE_SAT} por solicitud`
          : "Payload inválido",
        detalles: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { items, historialEntradas } = parsed.data

  try {
    const historialMap = historialEntradas?.length
      ? construirHistorialSatDesdeEntradas(historialEntradas)
      : construirHistorialSat([])

    const mapeosFirestore = await cargarMapeosSatDesdeFirestore()
    const mapeos = combinarMapeosSmv(getMapeosSmv(), mapeosFirestore)

    const sugerencias = await sugerirClavesSatLote(items as ItemParaSugerirSat[], historialMap, {
      mapeos,
    })

    return Response.json({ sugerencias })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "error desconocido"
    console.error("[sugerir-clave-sat] error:", mensaje)
    const status =
      err instanceof ErrorIA && mensaje.includes("GEMINI_API_KEY") ? 503 : 502
    const error =
      err instanceof ErrorIA ? mensaje : "Error al generar sugerencias de clave SAT"
    return Response.json({ error }, { status })
  }
}
