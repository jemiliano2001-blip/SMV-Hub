import { adminAuth } from "@/lib/firebase-admin"
import { esCorreoAutorizado } from "@/lib/authorized-emails"

export { CORREOS_AUTORIZADOS } from "@/lib/authorized-emails"

type ResultadoAuth =
  | {
      ok: true
      uid: string
      email: string
    }
  | {
      ok: false
      response: Response
    }

function respuestaError(status: number, error: string): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}

export async function verificarUsuarioAutorizado(request: Request): Promise<ResultadoAuth> {
  const authHeader = request.headers.get("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: respuestaError(401, "No autorizado"),
    }
  }

  const token = authHeader.slice("Bearer ".length).trim()
  if (!token) {
    return {
      ok: false,
      response: respuestaError(401, "No autorizado"),
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token)
    const email = decodedToken.email

    if (!email || decodedToken.email_verified !== true) {
      return {
        ok: false,
        response: respuestaError(403, "Correo no verificado"),
      }
    }

    if (!esCorreoAutorizado(email)) {
      return {
        ok: false,
        response: respuestaError(
          403,
          `Tu correo (${email}) no está autorizado para usar esta función`
        ),
      }
    }

    return {
      ok: true,
      uid: decodedToken.uid,
      email,
    }
  } catch {
    return {
      ok: false,
      response: respuestaError(401, "Token inválido o expirado"),
    }
  }
}
