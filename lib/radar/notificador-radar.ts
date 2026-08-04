import { emitirNotificacion } from "@/lib/notificaciones"
import type { DiagnosticoOperativo } from "./orquestador"

/**
 * Notificador del Radar: Emite alertas in-app a la colección `notificaciones`
 * cuando detecta atrasos críticos o desvíos graves de precios.
 */
export async function emitirNotificacionesRadar(
  diagnostico: DiagnosticoOperativo,
  actor: { uid: string; nombre: string }
): Promise<number> {
  let emitidas = 0

  // 1. Notificar atrasos urgentes
  const atrasosUrgentes = diagnostico.atrasos.filter((a) => a.urgente)
  for (const a of atrasosUrgentes.slice(0, 3)) {
    const res = await emitirNotificacion({
      tipo: "requisicion_estado",
      titulo: `Radar: Requisición atascada (${a.diasAtraso} días)`,
      cuerpo: `«${a.titulo}» solicitada por ${a.solicitante} requiere atención inmediata.`,
      origenModulo: "requisiciones",
      origenId: a.id,
      audiencia: "requisiciones",
      destinatarioUid: null,
      href: a.href,
      creadoPorUid: actor.uid,
      creadoPorNombre: actor.nombre,
    })
    if (res) emitidas++
  }

  // 2. Notificar desvíos de precios graves (>25%)
  const anomaliasGraves = diagnostico.anomaliasPrecio.filter((p) => p.porcentajeIncremento >= 25)
  for (const p of anomaliasGraves.slice(0, 3)) {
    const res = await emitirNotificacion({
      tipo: "requisicion_estado",
      titulo: `Radar: Alerta de Precio (+${p.porcentajeIncremento}%)`,
      cuerpo: `«${p.descripcion}» en ${p.proveedorNombre} subió ${p.mensaje}.`,
      origenModulo: "requisiciones",
      origenId: p.id,
      audiencia: "requisiciones",
      destinatarioUid: null,
      href: "/cotizaciones",
      creadoPorUid: actor.uid,
      creadoPorNombre: actor.nombre,
    })
    if (res) emitidas++
  }

  return emitidas
}
