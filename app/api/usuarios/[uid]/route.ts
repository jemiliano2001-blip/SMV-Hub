import { z } from "zod"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { actualizarUsuarioAdmin, eliminarUsuarioAdmin } from "@/lib/usuarios-admin"
import { ModuloIdSchema, RolSchema } from "@/lib/schemas"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"

const CambiosUsuarioSchema = z
  .object({
    plantilla: RolSchema.optional(),
    /** @deprecated Usar plantilla */
    rol: RolSchema.optional(),
    modulos: z.array(ModuloIdSchema).optional(),
    esSuperAdmin: z.boolean().optional(),
    atiendeDocumentosVenta: z.boolean().optional(),
    editaHorasExtra: z.boolean().optional(),
    activo: z.boolean().optional(),
  })
  .refine(
    (c) =>
      c.plantilla !== undefined ||
      c.rol !== undefined ||
      c.modulos !== undefined ||
      c.esSuperAdmin !== undefined ||
      c.atiendeDocumentosVenta !== undefined ||
      c.editaHorasExtra !== undefined ||
      c.activo !== undefined,
    { message: "Debe incluir al menos un campo a actualizar" }
  )

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { uid } = await params
  const body = await request.json().catch(() => null)
  const parseResult = CambiosUsuarioSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json({ error: "Datos de actualización inválidos" }, { status: 400 })
  }

  try {
    const { plantilla, rol, ...rest } = parseResult.data
    const campos = Object.keys(parseResult.data)
    await actualizarUsuarioAdmin(uid, {
      ...rest,
      ...(plantilla !== undefined || rol !== undefined
        ? { plantilla: plantilla ?? rol }
        : {}),
    })

    await registrarAuditoriaServer(
      auth.email,
      "EDITAR",
      "usuarios",
      uid,
      `Actualizó usuario ${uid} (campos: ${campos.join(", ")})`
    )

    return Response.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "error desconocido"
    if (msg.includes("último super-admin")) {
      return Response.json({ error: msg }, { status: 400 })
    }
    console.error("Error actualizando usuario:", msg)
    return Response.json({ error: "No se pudo actualizar el usuario" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { uid } = await params
  if (uid === auth.uid) {
    return Response.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 })
  }

  try {
    await eliminarUsuarioAdmin(uid)
    await registrarAuditoriaServer(
      auth.email,
      "BORRAR",
      "usuarios",
      uid,
      `Eliminó usuario ${uid}`
    )
    return Response.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "error desconocido"
    if (msg.includes("último super-admin")) {
      return Response.json({ error: msg }, { status: 400 })
    }
    console.error("Error eliminando usuario:", msg)
    return Response.json({ error: "No se pudo eliminar el usuario" }, { status: 500 })
  }
}
