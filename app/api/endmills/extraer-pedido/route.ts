import { NextRequest } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { listarMedidasEndmills } from "@/lib/endmills"
import { ErrorIA } from "@/lib/extraer-ia"
import { extraerPedidoEndmillsIA } from "@/lib/endmills-extraer-ia"

const RequestSchema = z.object({
  texto: z.string().min(1, "El texto o contenido es requerido"),
})

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) return auth.response

  const info = await obtenerUsuarioAdmin(auth.uid, auth.email)
  if (!info?.activo || (!info.esSuperAdmin && !info.modulos.includes("endmills"))) {
    return Response.json(
      { error: "No tienes acceso al módulo de endmills" },
      { status: 403 }
    )
  }

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
    const catalogo = await listarMedidasEndmills()
    const resultado = await extraerPedidoEndmillsIA(parsed.data.texto, catalogo)
    return Response.json(resultado)
  } catch (err: unknown) {
    if (err instanceof ErrorIA) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    console.error("Error al extraer pedido de endmills:", err)
    const mensaje = err instanceof Error ? err.message : "Error al procesar la solicitud"
    return Response.json({ error: mensaje }, { status: 500 })
  }
}
