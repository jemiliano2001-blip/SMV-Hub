import { z } from "zod"
import { verificarAdmin } from "@/lib/api-auth"
import { resetearPasswordAdmin } from "@/lib/usuarios-admin"

const ResetPasswordSchema = z.object({
  password: z.string().min(6).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const parseResult = ResetPasswordSchema.safeParse(body)
  if (!parseResult.success) {
    return Response.json({ error: "Contraseña inválida (mínimo 6 caracteres)" }, { status: 400 })
  }

  const { uid } = await params
  try {
    const tempPassword = await resetearPasswordAdmin(uid, parseResult.data.password)
    return Response.json({ tempPassword })
  } catch (error: unknown) {
    console.error("Error reseteando password:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo resetear la contraseña" }, { status: 500 })
  }
}
