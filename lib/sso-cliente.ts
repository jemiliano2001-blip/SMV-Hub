import { getClienteAuth } from "@/lib/firebase"

/**
 * Abre una aplicación externa compartida del ecosistema SMV (ej. SMV Vision, Dashboard SMV)
 * transfiriendo la sesión mediante un Firebase Custom Token (Single Sign-On).
 *
 * Abre la ventana/pestaña inmediatamente para prevenir bloqueos de ventanas emergentes (pop-up blocker)
 * y actualiza la ubicación una vez obtenido el token.
 */
export async function abrirAppConSSO(urlDestino: string, options?: { mismaPestana?: boolean }): Promise<void> {
  if (typeof window === "undefined") return

  const mismaPestana = options?.mismaPestana ?? false
  let targetWindow: Window | null = null

  if (!mismaPestana) {
    // Abrir la ventana de inmediato en respuesta al evento de usuario
    targetWindow = window.open("", "_blank")
  }

  const redirigir = (url: string) => {
    if (mismaPestana) {
      window.location.href = url
    } else if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = url
    } else {
      window.open(url, "_blank")
    }
  }

  try {
    const auth = getClienteAuth()
    const currentUser = auth.currentUser

    // Si no hay usuario en sesión, navegar directamente a la URL original
    if (!currentUser) {
      redirigir(urlDestino)
      return
    }

    const idToken = await currentUser.getIdToken()
    const response = await fetch("/api/auth/sso-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      console.warn("No se pudo obtener token SSO, abriendo enlace normal.")
      redirigir(urlDestino)
      return
    }

    const data = (await response.json()) as { ok?: boolean; token?: string }
    if (!data.token) {
      redirigir(urlDestino)
      return
    }

    // Construir URL con el token en el fragmento hash (#sso_token=...)
    // Usar hash evita que el token quede expuesto en logs de servidor HTTP / Referer.
    const urlFinal = new URL(urlDestino, window.location.origin)
    urlFinal.hash = `sso_token=${encodeURIComponent(data.token)}`

    redirigir(urlFinal.toString())
  } catch (error) {
    console.error("Error al procesar SSO para app externa:", error)
    redirigir(urlDestino)
  }
}
