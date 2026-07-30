import { useEffect, useState } from "react"
import { suscribirSolicitudesBorradoBanosPendientes } from "@/lib/banos"
import type { SolicitudBorradoBano } from "@/lib/schemas"

/**
 * Solo debe habilitarse (`enabled: true`) para súper admin — es lo único que
 * puede leer `solicitudes_borrado_banos` según firestore.rules. Se usa para
 * saber, dentro de /notificaciones, si una solicitud sigue pendiente y así
 * mostrar (o esconder) los botones Aprobar/Rechazar.
 */
export function useSolicitudesBorradoBanosPendientes(
  enabled: boolean
): Map<string, SolicitudBorradoBano> {
  const [porId, setPorId] = useState<Map<string, SolicitudBorradoBano>>(new Map())

  useEffect(() => {
    if (!enabled) {
      setPorId(new Map())
      return
    }
    const unsub = suscribirSolicitudesBorradoBanosPendientes(
      (items) => setPorId(new Map(items.map((s) => [s.id, s]))),
      (err) => console.error("Error suscribiendo a solicitudes de borrado de baños:", err)
    )
    return unsub
  }, [enabled])

  return porId
}
