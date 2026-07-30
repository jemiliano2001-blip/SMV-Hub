import { useEffect, useState } from "react"
import { suscribirSolicitudesBorradoBanosPendientes } from "@/lib/banos"
import type { SolicitudBorradoBano } from "@/lib/schemas"

const VACIO = new Map<string, SolicitudBorradoBano>()

/**
 * Solo habilitar (`enabled: true`) para super admin: es lo unico que puede
 * leer `solicitudes_borrado_banos` segun firestore.rules. Sirve en
 * /notificaciones para mostrar u ocultar Aprobar/Rechazar.
 */
export function useSolicitudesBorradoBanosPendientes(
  enabled: boolean
): Map<string, SolicitudBorradoBano> {
  const [porId, setPorId] = useState<Map<string, SolicitudBorradoBano>>(VACIO)

  useEffect(() => {
    if (!enabled) return
    const unsub = suscribirSolicitudesBorradoBanosPendientes(
      (items) => setPorId(new Map(items.map((s) => [s.id, s]))),
      (err) => console.error("Error suscribiendo a solicitudes de borrado de banos:", err)
    )
    return unsub
  }, [enabled])

  return enabled ? porId : VACIO
}
