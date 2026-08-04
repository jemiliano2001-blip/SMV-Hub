import { NextRequest } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import {
  construirHistorialSat,
  construirHistorialSatDesdeEntradas,
  sugerirClavesSatLote,
  combinarMapeosSmv,
  getMapeosSmv,
  type ItemParaSugerirSat,
} from "@/lib/sat/sugerir-clave"
import { cargarMapeosSatDesdeFirestore } from "@/lib/sat/cargar-mapeos-firestore"
import { ErrorIA } from "@/lib/extraer-ia"

const ItemRequestSchema = z.object({
  descripcion: z.string(),
  proveedor: z.string().optional(),
  terminosPrevios: z.string().max(1000).optional(),
})

const HistorialEntradaSchema = z.object({
  descripcion: z.string(),
  claveProdServ: z.string().regex(/^\d{8}$/),
})

const RequestSchema = z.object({
  items: z.array(ItemRequestSchema).min(1).max(50),
  historialEntradas: z.array(HistorialEntradaSchema).optional(),
})

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
