import { adminAuth } from "@/lib/firebase-admin"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import type { ModuloId } from "@/lib/roles"

type ResultadoAuth =
  | {
      ok: true
      uid: string
      email: string
      token: string
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

    const info = await obtenerUsuarioAdmin(decodedToken.uid, email)
    if (!info || !info.activo) {
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
      token,
    }
  } catch {
    return {
      ok: false,
      response: respuestaError(401, "Token inválido o expirado"),
    }
  }
}

/**
 * Exige super-admin (flag `esSuperAdmin`, plantilla/rol admin legacy, o break-glass).
 * Alias histórico: verificarAdmin.
 */
export async function verificarSuperAdmin(request: Request): Promise<ResultadoAuth> {
  const base = await verificarUsuarioAutorizado(request)
  if (!base.ok) return base

  try {
    const info = await obtenerUsuarioAdmin(base.uid, base.email)
    if (!info || !info.esSuperAdmin) {
      return {
        ok: false,
        response: respuestaError(403, "Se requiere acceso de super-administrador"),
      }
    }

    return base
  } catch {
    return {
      ok: false,
      response: respuestaError(500, "No se pudo verificar el acceso, intenta de nuevo"),
    }
  }
}

/** @deprecated Usar verificarSuperAdmin. */
export async function verificarAdmin(request: Request): Promise<ResultadoAuth> {
  return verificarSuperAdmin(request)
}

/**
 * Exige sesión válida **y** al menos uno de los módulos indicados.
 *
 * Un super-admin siempre pasa. Se usa en las rutas que gastan cuota de Gemini o
 * tocan datos de un módulo concreto: sin esto, cualquier usuario activo —aunque
 * la UI le oculte la sección— podía invocarlas directamente con su propio token.
 */
export async function verificarModulo(
  request: Request,
  modulos: readonly ModuloId[],
  mensaje = "No tienes acceso a esta función"
): Promise<ResultadoAuth> {
  const base = await verificarUsuarioAutorizado(request)
  if (!base.ok) return base

  try {
    const info = await obtenerUsuarioAdmin(base.uid, base.email)
    if (!info?.activo) {
      return { ok: false, response: respuestaError(403, "Tu acceso está inactivo") }
    }
    if (!info.esSuperAdmin && !modulos.some((m) => info.modulos.includes(m))) {
      return { ok: false, response: respuestaError(403, mensaje) }
    }
    return base
  } catch {
    return {
      ok: false,
      response: respuestaError(500, "No se pudo verificar el acceso, intenta de nuevo"),
    }
  }
}
