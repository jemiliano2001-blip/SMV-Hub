import { NextResponse } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { buscarClavesSat } from "@/lib/sat/buscar"
import { getSatCatalogMeta } from "@/lib/sat/catalogo"

export async function GET(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() ?? ""
  const limitValue = Number(searchParams.get("limit") ?? "20")
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(limitValue, 50)) : 20

  return NextResponse.json({
    query,
    meta: getSatCatalogMeta(),
    results: query ? buscarClavesSat(query, limit) : [],
  })
}
