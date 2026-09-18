import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { recibirOrdenEnAlmacen } from "@/lib/abastecimiento-server"

const RecibirLoteBodySchema = z.object({
  ordenIds: z.array(z.string().min(1)).min(1).max(50),
  notas: z.string().nullable().optional(),
})

export async function POST(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  // Verificar que el usuario tenga acceso a almacén, compras u órdenes
  const infoUsuario = await obtenerUsuarioAdmin(auth.uid, auth.email)
  const tienePermiso =
    infoUsuario?.esSuperAdmin ||
    infoUsuario?.modulos.includes("almacen") ||
    infoUsuario?.modulos.includes("ordenes") ||
    infoUsuario?.modulos.includes("nueva-compra")

  if (!tienePermiso) {
    return Response.json(
      { error: "No tienes permisos para registrar la recepción en almacén" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = RecibirLoteBodySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: "Payload inválido. Se requiere un arreglo de 1 a 50 ordenIds." },
        { status: 400 }
      )
    }

    const { ordenIds, notas } = parsed.data
    const recibidas: string[] = []
    const fallidas: Array<{ ordenId: string; error: string }> = []

    for (const ordenId of ordenIds) {
      try {
        await recibirOrdenEnAlmacen({
          ordenId,
          uid: auth.uid,
          email: auth.email,
          nombre: auth.email.split("@")[0],
          notas: notas || null,
        })
        recibidas.push(ordenId)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar orden"
        fallidas.push({ ordenId, error: msg })
      }
    }

    return Response.json({ recibidas, fallidas }, { status: 200 })
  } catch (error: unknown) {
    console.error("Error inesperado en recepción en lote:", error)
    return Response.json(
      { error: "Error interno al procesar la recepción en lote" },
      { status: 500 }
    )
  }
}
