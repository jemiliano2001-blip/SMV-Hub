import type { EstadoOrden, EstadoRecepcion } from "@/lib/schemas"

export type EstadoPasoAbastecimiento = "pendiente" | "actual" | "completo"

export type PasoAbastecimiento = {
  id: "solicitado" | "comprado" | "recibido"
  titulo: string
  detalle: string
  estado: EstadoPasoAbastecimiento
  href?: string | null
}

export type InputDerivacionAbastecimiento = {
  origen?: {
    tipo: "requisicion" | "pedido-almacen"
    id: string
    folio?: string | null
    descripcion?: string | null
    estado?: string | null
    estatusFlujo?: string | null
  } | null
  orden?: {
    id: string
    numeroFactura?: string | null
    proveedor?: string | null
    estado?: EstadoOrden | null
    estadoRecepcion?: EstadoRecepcion | null
    fechaRecepcion?: string | null
    recibidoPor?: string | null
  } | null
  entradaAlmacenId?: string | null
}

/**
 * Deriva de forma pura los 3 pasos de trazabilidad de abastecimiento
 * a partir del estado de los documentos de Origen, Orden y Almacén.
 * Cero invento de máquinas de estado; puramente proyectado.
 */
export function derivarPasosAbastecimiento(
  input: InputDerivacionAbastecimiento
): PasoAbastecimiento[] {
  const { origen, orden, entradaAlmacenId } = input

  const esRecibido =
    orden?.estadoRecepcion === "recibida" ||
    Boolean(entradaAlmacenId) ||
    origen?.estado === "recibido"

  const tieneOrden = Boolean(orden?.id)
  const ordenAprobada = orden?.estado === "aprobada"

  // ── Paso 1: Solicitado ──────────────────────────────────────────
  let paso1Titulo = "Solicitado"
  let paso1Detalle = "Requisición o pedido"
  let paso1Estado: EstadoPasoAbastecimiento = "pendiente"
  let paso1Href: string | null = null

  if (origen) {
    if (origen.tipo === "requisicion") {
      paso1Titulo = origen.folio ? `Requisición ${origen.folio}` : "Requisición"
      paso1Detalle = origen.descripcion || "Solicitud de material"
      paso1Href = "/requisiciones"
      paso1Estado = tieneOrden || origen.estado === "comprado" || origen.estado === "recibido"
        ? "completo"
        : "actual"
    } else {
      paso1Titulo = "Pedido de Almacén"
      paso1Detalle = origen.descripcion || "Pedido de taller"
      paso1Href = "/pedidos-almacen"
      paso1Estado = tieneOrden || origen.estado === "comprado" || origen.estado === "recibido"
        ? "completo"
        : "actual"
    }
  } else if (tieneOrden) {
    paso1Titulo = "Compra Directa"
    paso1Detalle = "Sin solicitud previa"
    paso1Estado = "completo"
    paso1Href = null
  }

  // ── Paso 2: Comprado ────────────────────────────────────────────
  let paso2Titulo = "Comprado"
  let paso2Detalle = "En espera de compra"
  let paso2Estado: EstadoPasoAbastecimiento = "pendiente"
  let paso2Href: string | null = null

  if (tieneOrden && orden) {
    paso2Href = "/ordenes"
    const prov = orden.proveedor ? orden.proveedor : `Orden ${orden.id}`
    const fac = orden.numeroFactura ? ` #${orden.numeroFactura}` : ""
    paso2Titulo = `OC ${prov}${fac}`

    if (esRecibido) {
      paso2Detalle = "Compra procesada"
      paso2Estado = "completo"
    } else if (orden.estado === "rechazada") {
      paso2Detalle = "Orden rechazada"
      paso2Estado = "actual"
    } else if (ordenAprobada) {
      paso2Detalle = "Orden aprobada (en tránsito)"
      paso2Estado = "actual"
    } else {
      paso2Detalle = "Orden pendiente de aprobación"
      paso2Estado = "actual"
    }
  } else if (origen?.estado === "comprado" || origen?.estatusFlujo === "convertida_a_oc") {
    paso2Titulo = "Comprado"
    paso2Detalle = "Orden registrada"
    paso2Estado = esRecibido ? "completo" : "actual"
    paso2Href = "/ordenes"
  }

  // ── Paso 3: Recibido ────────────────────────────────────────────
  let paso3Titulo = "Recepción Almacén"
  let paso3Detalle = "Pendiente de llegada"
  let paso3Estado: EstadoPasoAbastecimiento = "pendiente"
  let paso3Href: string | null = null

  if (esRecibido) {
    paso3Titulo = "Recibido en Almacén"
    paso3Detalle = orden?.fechaRecepcion
      ? `Recibido el ${orden.fechaRecepcion}${orden.recibidoPor ? ` (${orden.recibidoPor})` : ""}`
      : "Material disponible en planta"
    paso3Estado = "completo"
    paso3Href = "/almacen"
  } else if (ordenAprobada) {
    paso3Detalle = "Esperando entrega en taller"
    paso3Estado = "pendiente"
    paso3Href = "/almacen"
  }

  return [
    {
      id: "solicitado",
      titulo: paso1Titulo,
      detalle: paso1Detalle,
      estado: paso1Estado,
      href: paso1Href,
    },
    {
      id: "comprado",
      titulo: paso2Titulo,
      detalle: paso2Detalle,
      estado: paso2Estado,
      href: paso2Href,
    },
    {
      id: "recibido",
      titulo: paso3Titulo,
      detalle: paso3Detalle,
      estado: paso3Estado,
      href: paso3Href,
    },
  ]
}
