import { formatFecha, formatPrecio } from "@/lib/format"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"
import { resolverCampoItem, type OrdenCompra } from "@/lib/schemas"

export const LINK_GRUPO_WHATSAPP = "https://chat.whatsapp.com/IDCzgRSehHiEKiBldKFMLM"

export type FechaOrdenDisplay = {
  principal: string
  secundaria: string | null
}

function formatCreadoEn(creadoEn: unknown): string {
  if (!creadoEn) return "—"
  let d: Date
  if (creadoEn instanceof Date) {
    d = creadoEn
  } else if (
    creadoEn &&
    typeof creadoEn === "object" &&
    "toDate" in creadoEn &&
    typeof (creadoEn as { toDate: unknown }).toDate === "function"
  ) {
    d = (creadoEn as { toDate: () => Date }).toDate()
  } else if (typeof creadoEn === "string" || typeof creadoEn === "number") {
    d = new Date(creadoEn)
  } else {
    return "—"
  }
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** Celda dual: fecha de factura principal; registro secundario si hay factura. */
export function formatFechaOrden(orden: OrdenCompra): FechaOrdenDisplay {
  const registro = formatCreadoEn(orden.creadoEn)
  if (orden.fechaFactura) {
    return {
      principal: formatFecha(orden.fechaFactura),
      secundaria: `Reg: ${registro}`,
    }
  }
  return {
    principal: registro,
    secundaria: null,
  }
}

export function cuentaCargoEfectiva(orden: OrdenCompra): string {
  const primero = orden.items?.[0]
  if (!primero) return orden.cuentaCargo?.trim() ?? ""
  return resolverCampoItem(primero, orden, "cuentaCargo")
}

export function itemSatPendiente(item: OrdenCompra["items"][number]): boolean {
  return item.satPendiente !== false && !normalizarClaveProdServ(item.claveProdServ)
}

export function ordenTieneSatPendiente(orden: OrdenCompra): boolean {
  return (orden.items ?? []).some(itemSatPendiente)
}

export function displayOGuion(valor: string | null | undefined): string {
  const t = valor?.trim()
  return t ? t : "—"
}

export function generarMensajeWhatsApp(
  orden: Omit<OrdenCompra, "id" | "creadoEn" | "actualizadoEn"> & {
    id?: string
    imagenUrl?: string | null
    creadoEn?: Date
    actualizadoEn?: Date
  }
): string {
  const proveedor = orden.proveedor?.trim() || ""
  const items = orden.items || []

  const itemsListStr = items
    .map((item) => {
      const cant = item.cantidad && item.cantidad > 1 ? `${item.cantidad} ` : ""
      const desc = item.descripcionSimplificada?.trim() || item.descripcion?.trim() || ""
      return `${cant}${desc}`
    })
    .filter(Boolean)

  const valoresPorCampo = (
    campo: "empresa" | "cuentaCargo" | "requisitor" | "ordenTrabajo"
  ) =>
    Array.from(
      new Set(items.map((item) => resolverCampoItem(item, orden, campo)).filter(Boolean))
    )

  const empresas = valoresPorCampo("empresa")
  const requisitores = valoresPorCampo("requisitor")
  const cuentasCargo = valoresPorCampo("cuentaCargo")
  const ordenesTrabajo = valoresPorCampo("ordenTrabajo")
  const lineas = ["*Notificación de compra*"]

  if (proveedor) lineas.push(`Proveedor: *${proveedor}*`)
  if (orden.linkProveedor?.trim()) lineas.push(`Lugar / enlace de compra: ${orden.linkProveedor.trim()}`)
  if (orden.numeroFactura?.trim()) lineas.push(`Factura: *${orden.numeroFactura.trim()}*`)
  if (orden.fechaFactura?.trim()) lineas.push(`Fecha de factura: *${formatFecha(orden.fechaFactura)}*`)
  if (empresas.length) lineas.push(`Empresa / destino: *${empresas.join(" / ")}*`)
  if (requisitores.length) lineas.push(`Requisitor: *${requisitores.join(" / ")}*`)
  if (cuentasCargo.length) lineas.push(`Cuenta cargo / SO: *${cuentasCargo.join(" / ")}*`)
  if (ordenesTrabajo.length) lineas.push(`Orden de trabajo: *${ordenesTrabajo.join(" / ")}*`)
  if (orden.fechaEntrega?.trim()) lineas.push(`Entrega estimada: *${formatFecha(orden.fechaEntrega)}*`)
  if (orden.total !== null && orden.total !== undefined) {
    lineas.push(`Total: *${formatPrecio(orden.total, orden.moneda || "USD")}*`)
  }
  if (itemsListStr.length) {
    lineas.push("", "Partidas:", ...itemsListStr.map((item) => `• ${item}`))
  }

  return lineas.join("\n")
}

export function obtenerUrlWhatsApp(mensaje: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`
}

/**
 * Copia el texto limpio de la orden al portapapeles.
 * Al presionar Ctrl+V en el grupo de WhatsApp Web, se pega el texto de la orden.
 */
export async function copiarOrdenAlPortapapeles(mensaje: string): Promise<void> {
  if (typeof window === "undefined" || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(mensaje)
  } catch (err) {
    console.warn("[copiarOrdenAlPortapapeles] No se pudo copiar al portapapeles:", err)
  }
}
