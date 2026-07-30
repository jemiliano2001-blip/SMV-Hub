import type {
  EstadoSolicitudDocumento,
  TipoSolicitudDocumento,
  VentaOdooSo,
} from "@/lib/schemas"

export function puedeTransicionarEstado(
  desde: EstadoSolicitudDocumento,
  hacia: EstadoSolicitudDocumento,
  opts: { esAtendedor: boolean; esSolicitante: boolean }
): boolean {
  if (desde === hacia) return false
  if (desde === "completada" || desde === "rechazada") return false
  if (hacia === "rechazada" && desde === "pendiente" && opts.esSolicitante) return true
  if (!opts.esAtendedor) return false
  if (desde === "pendiente" && (hacia === "en_proceso" || hacia === "completada" || hacia === "rechazada"))
    return true
  if (desde === "en_proceso" && (hacia === "completada" || hacia === "rechazada")) return true
  return false
}

export function filtrarSoPorTexto(sos: readonly VentaOdooSo[], q: string): VentaOdooSo[] {
  const n = q.trim().toLowerCase()
  if (!n) return [...sos]
  return sos.filter((s) => {
    const hay = [s.name, s.partnerName, s.clientOrderRef ?? ""].join(" ").toLowerCase()
    return hay.includes(n)
  })
}

export function validarPartidasRemision(
  tipo: TipoSolicitudDocumento,
  partidas: readonly { odooLineId: number; qtySolicitada: number }[],
  lineasSo: readonly { odooLineId: number; qtyPending: number }[]
): string | null {
  if (tipo === "factura") return null
  if (partidas.length === 0) return "Selecciona al menos una partida"
  const byId = new Map(lineasSo.map((l) => [l.odooLineId, l]))
  for (const p of partidas) {
    const l = byId.get(p.odooLineId)
    if (!l) return `Línea ${p.odooLineId} no pertenece a la SO`
    if (!(p.qtySolicitada > 0) || p.qtySolicitada > l.qtyPending + 1e-9) {
      return `Cantidad inválida para ${p.odooLineId}`
    }
  }
  return null
}
