import { NextResponse } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { buscarOrdenesTrabajoOdoo } from "@/lib/odoo-crear-cotizacion"

export async function GET(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10)

  try {
    const ordenes = await buscarOrdenesTrabajoOdoo(q, limit)
    return NextResponse.json({
      ok: true,
      ordenes,
    })
  } catch (error) {
    console.error("Error al buscar órdenes de trabajo en Odoo:", error)
    return NextResponse.json({
      ok: false,
      ordenes: [],
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
