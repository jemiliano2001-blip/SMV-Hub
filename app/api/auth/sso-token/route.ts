import { adminAuth } from "@/lib/firebase-admin"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"

export async function POST(request: Request) {
  const auth = await verificarUsuarioAutorizado(request)
  if (!auth.ok) return auth.response

  try {
    const customToken = await adminAuth.createCustomToken(auth.uid)
    return Response.json(
      { ok: true, token: customToken },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error: unknown) {
    console.error("Error generando custom token SSO:", error instanceof Error ? error.message : "error desconocido")
    return Response.json(
      { error: "No se pudo generar el token de acceso para la aplicación externa" },
      { status: 500 }
    )
  }
}
