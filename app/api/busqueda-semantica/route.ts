import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { buscarEnCatalogoSemantico } from "@/lib/busqueda-semantica-catalogo"
import { ErrorIA } from "@/lib/extraer-ia"
import type { FuenteBusquedaIndice } from "@/lib/schemas"
import { excedeLimite } from "@/lib/rate-limit-memoria"

export const runtime = "nodejs"
/** Embedding + lectura del índice completo puede tardar >60s en frío. */
export const maxDuration = 120

const BusquedaSemanticaBodySchema = z.object({
  query: z.string().min(1, "La consulta de búsqueda no puede estar vacía").max(300),
  topK: z.number().int().min(1).max(20).optional().default(6),
  minScore: z.number().min(0).max(1).optional().default(0.35),
})

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) {
    return auth.response
  }

  if (excedeLimite(auth.uid)) {
    return NextResponse.json(
      { error: "Demasiadas búsquedas. Espera un momento e intenta de nuevo." },
      { status: 429 }
    )
  }

  const info = await obtenerUsuarioAdmin(auth.uid, auth.email)
  if (!info?.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // Filtro por permisos del lado del servidor (criterio de éxito #2 del spec):
  // quien no tiene el módulo no recibe esa fuente, ni siquiera en el fetch a Firestore.
  const fuentesPermitidas: FuenteBusquedaIndice[] = []
  if (info.esSuperAdmin || info.modulos.includes("ordenes")) fuentesPermitidas.push("orden-item")
  if (info.esSuperAdmin || info.modulos.includes("proveedores")) fuentesPermitidas.push("proveedor")

  if (fuentesPermitidas.length === 0) {
    return NextResponse.json(
      {
        error:
          "Tu usuario no tiene acceso a órdenes ni proveedores; la búsqueda semántica no aplica. Pide a un admin los módulos correspondientes.",
      },
      { status: 403 }
    )
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

  const { query, topK, minScore } = parsed.data

  try {
    const resultado = await buscarEnCatalogoSemantico(query, { topK, minScore, fuentesPermitidas })

    return NextResponse.json({
      ok: true,
      resultado,
    })
  } catch (error) {
    if (error instanceof ErrorIA) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    const mensaje = error instanceof Error ? error.message : String(error)
    console.error("[busqueda-semantica] Error interno:", error)
    if (mensaje.includes("dimensión") || mensaje.includes("dimension")) {
      return NextResponse.json(
        {
          error:
            "El índice de búsqueda tiene vectores incompatibles. Un super-admin debe ejecutar la reindexación (syncBusquedaIndiceManual).",
        },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: "Ocurrió un error inesperado al procesar la búsqueda semántica" },
      { status: 500 }
    )
  }
}
