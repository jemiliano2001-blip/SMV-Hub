import { formatFecha } from "@/lib/format"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"
import { resolverCampoItem, type OrdenCompra } from "@/lib/schemas"

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
