import { formatFecha } from "@/lib/format"
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

  let itemsTexto = ""
  if (itemsListStr.length === 1) {
    itemsTexto = itemsListStr[0]
  } else if (itemsListStr.length === 2) {
    itemsTexto = `${itemsListStr[0]} y ${itemsListStr[1]}`
  } else if (itemsListStr.length > 2) {
    const ultimo = itemsListStr[itemsListStr.length - 1]
    const resto = itemsListStr.slice(0, -1).join(", ")
    itemsTexto = `${resto} y ${ultimo}`
  } else {
    itemsTexto = "compra"
  }

  const empresas = Array.from(
    new Set(
      items
        .map((item) => item.empresa?.trim() || orden.empresa?.trim())
        .filter(Boolean)
    )
  )

  const destinoTexto = empresas.length > 0 ? ` para *${empresas.join(" / ")}*` : ""
  const provTexto = proveedor ? ` en *${proveedor}*` : ""
  const totalTexto = orden.total ? ` por *${orden.moneda || 'USD'} $${orden.total}*` : ""

  return `*Notificación de Compra (EUA)*\n\nBuen día, se pidió ${itemsTexto}${destinoTexto}${provTexto}${totalTexto}.`
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
