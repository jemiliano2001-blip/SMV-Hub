import { z } from "zod"
import { verificarAdmin } from "@/lib/api-auth"
import { actualizarUsuarioAdmin, eliminarUsuarioAdmin } from "@/lib/usuarios-admin"
import { RolSchema } from "@/lib/schemas"

const CambiosUsuarioSchema = z
  .object({
    rol: RolSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((c) => c.rol !== undefined || c.activo !== undefined, {
    message: "Debe incluir rol y/o activo",
  })

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const { uid } = await params
  const body = await request.json().catch(() => null)
  const parseResult = CambiosUsuarioSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json({ error: "Debe incluir rol y/o activo" }, { status: 400 })
  }

  try {
    await actualizarUsuarioAdmin(uid, parseResult.data)
    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error("Error actualizando usuario:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo actualizar el usuario" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const { uid } = await params
  if (uid === auth.uid) {
    return Response.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 })
  }

  try {
    await eliminarUsuarioAdmin(uid)
    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error("Error eliminando usuario:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo eliminar el usuario" }, { status: 500 })
  }
}
