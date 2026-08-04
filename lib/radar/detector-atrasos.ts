import type { Requisicion, PedidoAlmacen } from "@/lib/schemas"
import { estadoAtraso, estadoAtrasoEntrega, hoyLocal } from "@/lib/requisicion-atraso"

export interface ItemAtrasoRadar {
  id: string
  tipo: "requisicion" | "pedido_almacen"
  prioridad: string
  titulo: string
  solicitante: string
  diasAtraso: number
  creadoEnISO: string
  href: string
  urgente: boolean
}

/**
 * Sub-detector que escanea requisiciones y pedidos de almacén para encontrar
 * cuellos de botella atascados o fuera de tiempo.
 */
export function detectarAtrasosOperativos(
  requisiciones: Requisicion[],
  pedidosAlmacen: PedidoAlmacen[],
  hoyISO: string = hoyLocal()
): ItemAtrasoRadar[] {
  const resultados: ItemAtrasoRadar[] = []
  const hoyMs = new Date(hoyISO).getTime()

  // 1. Requisiciones
  for (const req of requisiciones) {
    if (req.estado === "comprado" || req.estado === "recibido") continue
    if (req.estatusFlujo === "convertida_a_oc" || req.estatusFlujo === "aprobada") continue

    const semaforoPrioridad = estadoAtraso(req, hoyISO)
    const semaforoEntrega = estadoAtrasoEntrega(req, hoyISO)

    const estaAtrasada =
      semaforoPrioridad?.tipo === "atrasada" ||
      semaforoPrioridad?.tipo === "por_vencer" ||
      semaforoEntrega?.tipo === "atrasada" ||
      semaforoEntrega?.tipo === "por_vencer"

    if (estaAtrasada) {
      const dias =
        (semaforoPrioridad?.tipo === "atrasada" ? semaforoPrioridad.dias : 0) ||
        (semaforoEntrega?.tipo === "atrasada" ? semaforoEntrega.dias : 0) ||
        1

      resultados.push({
        id: req.id,
        tipo: "requisicion",
        prioridad: req.prioridadFlujo || req.prioridad || "media",
        titulo: req.folio ? `${req.folio}: ${req.descripcion}` : req.descripcion,
        solicitante: req.solicitante || "Sin solicitante",
        diasAtraso: dias,
        creadoEnISO: typeof req.creadoEn === "string" ? req.creadoEn : req.creadoEn.toISOString(),
        href: "/requisiciones",
        urgente: req.prioridadFlujo === "urgente" || req.prioridad === "1-2 dias",
      })
    }
  }

  // 2. Pedidos de almacén
  for (const ped of pedidosAlmacen) {
    if (ped.estado !== "pendiente") continue

    const fechaCreacion = typeof ped.creadoEn === "string" ? new Date(ped.creadoEn) : ped.creadoEn
    const diasTranscurridos = Math.max(0, Math.floor((hoyMs - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24)))

    if (ped.urgente || diasTranscurridos >= 2) {
      resultados.push({
        id: ped.id,
        tipo: "pedido_almacen",
        prioridad: ped.urgente ? "urgente" : "normal",
        titulo: `Pedido Almacén: ${ped.descripcion}`,
        solicitante: ped.solicitadoPorNombre || "Almacén",
        diasAtraso: diasTranscurridos,
        creadoEnISO: fechaCreacion.toISOString(),
        href: "/pedidos-almacen",
        urgente: ped.urgente,
      })
    }
  }

  // Ordenar atrasos: urgentes primero, luego por días de atraso descendente
  return resultados.sort((a, b) => {
    if (a.urgente !== b.urgente) return a.urgente ? -1 : 1
    return b.diasAtraso - a.diasAtraso
  })
}
