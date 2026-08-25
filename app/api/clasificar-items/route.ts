import { NextRequest } from "next/server"
import { z } from "zod"
import { verificarModulo } from "@/lib/api-auth"
import { ErrorIA } from "@/lib/extraer-ia"
import {
  clasificarLoteConGemini,
  type ItemParaClasificar,
} from "@/lib/compras-odoo/clasificar-items-ia"

const ItemRequestSchema = z.object({
  id: z.string(),
  descripcion: z.string().min(1),
  proveedorNombre: z.string().optional(),
  odooCategoria: z.string().nullable().optional(),
})

const RequestSchema = z.object({
  items: z.array(ItemRequestSchema).min(1).max(50),
})

export async function POST(req: NextRequest) {
  const auth = await verificarModulo(req, ["proveedores", "compras-odoo"], "No tienes acceso al modulo de proveedores")
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
    const resultado = await clasificarLoteConGemini(
      parsed.data.items as ItemParaClasificar[]
    )
    return Response.json(resultado)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "error desconocido"
    console.error("[api/clasificar-items] error:", mensaje)
    const status =
      err instanceof ErrorIA && mensaje.includes("GEMINI_API_KEY") ? 503 : 502
    const error =
      err instanceof ErrorIA ? mensaje : "Error al clasificar ítems con IA"
    return Response.json({ error }, { status })
  }
}
