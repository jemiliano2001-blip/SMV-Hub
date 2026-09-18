import { NextResponse } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { findSatCatalogEntryByKey } from "@/lib/sat/catalogo"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"

/**
 * Valida claves SAT contra el catálogo local sin mandar el catálogo al cliente.
 *
 * `data/sat/catalogo.json` pesa 10.5 MB y `lib/sat/catalogo.ts` es `server-only`;
 * los formularios (`/nueva-compra`, modales de `/ordenes`) consultan aquí en lote
 * vía `lib/sat/validar-clave-cliente.ts`. Devuelve sólo las claves que existen,
 * ya normalizadas, con su descripción para mostrarla en la UI.
 */
const MAX_CLAVES_POR_PETICION = 200

const BodySchema = z.object({
  claves: z.array(z.string().trim().max(16)).min(1).max(MAX_CLAVES_POR_PETICION),
})

export type ClaveSatValidada = { clave: string; descripcion: string }

export async function POST(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido: se esperaba JSON" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Se esperaba { claves: string[] } con 1 a ${MAX_CLAVES_POR_PETICION} elementos` },
      { status: 400 }
    )
  }

  const validas = new Map<string, ClaveSatValidada>()
  for (const valor of parsed.data.claves) {
    const clave = normalizarClaveProdServ(valor)
    if (!clave || validas.has(clave)) continue
    const entry = findSatCatalogEntryByKey(clave)
    if (entry) validas.set(clave, { clave, descripcion: entry.descripcion })
  }

  return NextResponse.json(
    { validas: [...validas.values()] },
    { headers: { "Cache-Control": "no-store" } }
  )
}
