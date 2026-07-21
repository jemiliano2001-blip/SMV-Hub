import { NextResponse } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { findSatCatalogEntryByKey } from "@/lib/sat/catalogo"

export async function POST(req: Request) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const claves = body.claves as string[]
    
    if (!claves || !Array.isArray(claves)) {
      return NextResponse.json({ error: "Invalid array of claves" }, { status: 400 })
    }

    const descripciones: Record<string, string> = {}
    
    for (const clave of claves) {
      if (!clave) continue
      const entry = findSatCatalogEntryByKey(clave)
      if (entry) {
        descripciones[clave] = entry.descripcion
      } else {
        descripciones[clave] = "No encontrado"
      }
    }

    return NextResponse.json(descripciones)
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
