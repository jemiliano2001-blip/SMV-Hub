import { z } from "zod"
import { verificarAdmin } from "@/lib/api-auth"
import { listarUsuariosAdmin, crearUsuarioAdmin } from "@/lib/usuarios-admin"
import { RolSchema } from "@/lib/schemas"

const NuevoUsuarioSchema = z.object({
  email: z.string().email(),
  rol: RolSchema,
})

export async function GET(request: Request) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const usuarios = await listarUsuariosAdmin()
  return Response.json({
    usuarios: usuarios.map((u) => ({
      ...u,
      creadoEn: u.creadoEn.toISOString(),
      actualizadoEn: u.actualizadoEn.toISOString(),
    })),
  })
}

export async function POST(request: Request) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parseResult = NuevoUsuarioSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json({ error: "Correo o rol inválido" }, { status: 400 })
  }

  try {
    const resultado = await crearUsuarioAdmin({
      ...parseResult.data,
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
