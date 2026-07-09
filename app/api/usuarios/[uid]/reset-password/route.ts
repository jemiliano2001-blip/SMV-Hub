import { verificarAdmin } from "@/lib/api-auth"
import { resetearPasswordAdmin } from "@/lib/usuarios-admin"

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await verificarAdmin(request)
  if (!auth.ok) return auth.response

  const { uid } = await params
  try {
    const tempPassword = await resetearPasswordAdmin(uid)
    return Response.json({ tempPassword })
  } catch (error: unknown) {
    console.error("Error reseteando password:", error instanceof Error ? error.message : "error desconocido")
    return Response.json({ error: "No se pudo resetear la contraseña" }, { status: 500 })
  }
}
