import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { buscarEnCatalogoSemantico } from "@/lib/busqueda-semantica-catalogo"
import { ErrorIA } from "@/lib/extraer-ia"

export const runtime = "nodejs"

const BusquedaSemanticaBodySchema = z.object({
  query: z.string().min(1, "La consulta de búsqueda no puede estar vacía").max(300),
  topK: z.number().int().min(1).max(20).optional().default(6),
  minScore: z.number().min(0).max(1).optional().default(0.3),
  categoriaFiltro: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) {
    return auth.response
  }

  let bodyRaw: unknown
  try {
    bodyRaw = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido en el cuerpo de la petición" }, { status: 400 })
  }

  const parsed = BusquedaSemanticaBodySchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros de búsqueda inválidos", detalles: parsed.error.format() },
      { status: 400 }
    )
  }

  const { query, topK, minScore, categoriaFiltro } = parsed.data

  try {
    const resultado = await buscarEnCatalogoSemantico(query, {
      topK,
      minScore,
      categoriaFiltro,
    })

    return NextResponse.json({
      ok: true,
      resultado,
    })
  } catch (error) {
    if (error instanceof ErrorIA) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error("[busqueda-semantica] Error interno:", error)
    return NextResponse.json(
      { error: "Ocurrió un error inesperado al procesar la búsqueda semántica" },
      { status: 500 }
    )
  }
}
