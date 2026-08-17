import { NextResponse } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { buscarProveedoresOdoo } from "@/lib/odoo-crear-cotizacion"

export async function GET(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10)

  try {
    const proveedores = await buscarProveedoresOdoo(q, limit)
    return NextResponse.json({
      ok: true,
      proveedores,
    })
  } catch (error) {
    console.error("Error al buscar proveedores en Odoo:", error)
    // Devolvemos lista vacía si las credenciales de Odoo no están disponibles en local
    return NextResponse.json({
      ok: false,
      proveedores: [],
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
