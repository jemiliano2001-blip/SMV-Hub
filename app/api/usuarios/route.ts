import { z } from "zod"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { listarUsuariosAdmin, crearUsuarioAdmin } from "@/lib/usuarios-admin"
import { ModuloIdSchema, RolSchema } from "@/lib/schemas"

const NuevoUsuarioSchema = z.object({
  email: z.string().email(),
  plantilla: RolSchema.optional(),
  /** @deprecated Usar plantilla */
  rol: RolSchema.optional(),
  modulos: z.array(ModuloIdSchema).optional(),
  esSuperAdmin: z.boolean().optional(),
  atiendeDocumentosVenta: z.boolean().optional(),
  editaHorasExtra: z.boolean().optional(),
  password: z.string().min(6).optional(),
}).refine((d) => d.plantilla !== undefined || d.rol !== undefined, {
  message: "Debe incluir plantilla o rol",
})

export async function GET(request: Request) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const usuarios = await listarUsuariosAdmin(auth.token)
    return Response.json({
      usuarios: usuarios.map((u) => ({
        ...u,
        creadoEn: u.creadoEn.toISOString(),
        actualizadoEn: u.actualizadoEn.toISOString(),
      })),
    })
  } catch (error: unknown) {
    console.error("Error listando usuarios:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo cargar la lista de usuarios" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parseResult = NuevoUsuarioSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json({ error: "Correo o plantilla inválidos" }, { status: 400 })
  }

  try {
    const { plantilla, rol, ...rest } = parseResult.data
    const resultado = await crearUsuarioAdmin({
      ...rest,
      plantilla: plantilla ?? rol!,
      creadoPor: auth.email,
    })
    return Response.json(resultado, { status: 201 })
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : ""
    if (code === "auth/email-already-exists") {
      return Response.json({ error: "Ese correo ya tiene cuenta" }, { status: 409 })
    }
    console.error("Error creando usuario:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo crear el usuario" }, { status: 500 })
  }
}
