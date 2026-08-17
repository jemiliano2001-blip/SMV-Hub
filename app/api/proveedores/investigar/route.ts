import { NextRequest } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import {
  investigarPreciosInsumoIA,
  MercadoObjetivoSchema,
} from "@/lib/proveedores-investigacion-ia"
import { ErrorIA } from "@/lib/extraer-ia"

const RequestSchema = z.object({
  consulta: z.string().trim().min(2, "La consulta debe tener al menos 2 caracteres").max(300),
  mercado: MercadoObjetivoSchema.optional().default("ambos"),
  cantidad: z.number().min(1).max(10000).optional().default(1),
  tipoCambio: z.number().min(1).max(100).optional(),
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

  try {
    const resultado = await investigarPreciosInsumoIA(parsed.data)
    return Response.json({ ok: true, data: resultado })
  } catch (err: unknown) {
    if (err instanceof ErrorIA) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[api/proveedores/investigar] Error inesperado:", msg)
    return Response.json({ error: "Error al procesar la investigación con IA" }, { status: 500 })
  }
}
