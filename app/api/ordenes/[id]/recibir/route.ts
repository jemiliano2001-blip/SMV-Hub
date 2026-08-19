import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import {
  recibirOrdenEnAlmacen,
  ErrorRecepcionOrden,
} from "@/lib/abastecimiento-server"

const RecibirOrdenBodySchema = z.object({
  notas: z.string().nullable().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  if (!id) {
    return Response.json({ error: "ID de orden no proporcionado" }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = RecibirOrdenBodySchema.safeParse(body)
    const notas = parsed.success ? parsed.data.notas : null

    const resultado = await recibirOrdenEnAlmacen({
      ordenId: id,
      uid: auth.uid,
      email: auth.email,
      nombre: auth.email.split("@")[0],
      notas,
    })

    return Response.json(resultado, { status: 200 })
  } catch (error: unknown) {
    if (error instanceof ErrorRecepcionOrden) {
      return Response.json({ error: error.message }, { status: error.statusCode })
    }

    console.error("Error inesperado en recepción de orden:", error)
    return Response.json(
      { error: "No se pudo registrar la recepción de la orden" },
      { status: 500 }
    )
  }
}
