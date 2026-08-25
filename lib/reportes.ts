import type { OrdenCompra } from "@/lib/schemas"
import { resolverCampoItem, resolverDestinoItem } from "@/lib/schemas"
import { parseFechaLocal } from "@/lib/format"

export type CriterioAgrupacion = "proveedor" | "destino" | "requisitor"

export type Linea = {
  ordenId: string
  /** Índice del ítem dentro de orden.items; -1 si la línea no corresponde a un ítem real (orden sin ítems). */
  itemIndex: number
  referencia: string
  dia: Date | null
  proveedor: string
  descripcion: string
  descripcionSimplificada?: string
  claveProdServ?: string
  cantidad: number | null
  precioUnitario: number | null
  subtotal: number
  total: number
  requisitor: string
  cuentaCargo: string
  destino: string
  moneda: string
}

export type Grupo = {
  clave: string
  lineas: Linea[]
  subtotal: number
  total: number
}

export type Kpis = {
  totalComprado: number
  numOrdenes: number
  numArticulos: number
  numProveedores: number
  destinoTop: string
  destinoTopPct: number
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

/**
 * Fecha efectiva de una orden para reportes, siempre en zona **local**.
 *
 * `fechaFactura` es un string YYYY-MM-DD; parsearlo con `new Date()` lo trataría
 * como medianoche UTC y en México lo correría un día hacia atrás. Cuando no hay
 * factura se usa `creadoEn`, que ya es un timestamp real.
 */
function fechaEfectivaOrden(orden: OrdenCompra): Date {
  return parseFechaLocal(orden.fechaFactura) ?? new Date(orden.creadoEn)
}

export function filtrarPorRango(
  ordenes: OrdenCompra[],
  desde: Date,
  hasta: Date
): OrdenCompra[] {
  const ini = startOfDay(desde)
  const fin = endOfDay(hasta)
  return ordenes.filter((o) => {
    const f = fechaEfectivaOrden(o)
    return f >= ini && f <= fin
  })
}

export function aplanarLineas(ordenes: OrdenCompra[]): Linea[] {
  const lineas: Linea[] = []

  for (const orden of ordenes) {
    const ref = orden.numeroFactura ?? orden.id
    const dia = fechaEfectivaOrden(orden)
    const baseOrden = {
      ordenId: orden.id,
      referencia: ref,
      dia,
      proveedor: orden.proveedor,
      moneda: orden.moneda,
    }

    if (orden.items.length === 0) {
      lineas.push({
        ...baseOrden,
        itemIndex: -1,
        descripcion: "(orden sin ítems)",
        descripcionSimplificada: "",
        claveProdServ: "",
        cantidad: null,
        precioUnitario: null,
        subtotal: orden.subtotal ?? 0,
        total: orden.total ?? 0,
        requisitor: orden.requisitor ?? "",
        cuentaCargo: orden.cuentaCargo ?? "",
        destino: orden.destino ?? orden.empresa ?? "",
      })
      continue
    }

    const ordenSubtotal = orden.items.reduce((s, item) => s + (item.total ?? 0), 0)
    const impuestos = orden.impuestos ?? 0
    const envio = orden.envio ?? 0

    orden.items.forEach((item, itemIndex) => {
      const subLinea = item.total ?? 0
      const propTax = ordenSubtotal > 0
        ? impuestos * (subLinea / ordenSubtotal)
        : impuestos / orden.items.length
      const propEnvio = ordenSubtotal > 0
        ? envio * (subLinea / ordenSubtotal)
        : envio / orden.items.length
      lineas.push({
        ...baseOrden,
        itemIndex,
        descripcion: item.descripcion,
        descripcionSimplificada: item.descripcionSimplificada || "",
        claveProdServ: item.claveProdServ || "",
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: subLinea,
        total: subLinea + propTax + propEnvio,
        requisitor: resolverCampoItem(item, orden, "requisitor"),
        cuentaCargo: resolverCampoItem(item, orden, "cuentaCargo"),
        destino: resolverDestinoItem(item, orden),
      })
    })
  }

  return lineas
}

export function agrupar(lineas: Linea[], criterio: CriterioAgrupacion): Grupo[] {
  const map = new Map<string, Linea[]>()
  for (const linea of lineas) {
    const clave = linea[criterio] || `(sin ${criterio})`
    const arr = map.get(clave) ?? []
    arr.push(linea)
    map.set(clave, arr)
  }
  return Array.from(map.entries())
    .map(([clave, ls]) => ({
      clave,
      lineas: ls,
      subtotal: ls.reduce((s, l) => s + l.subtotal, 0),
      total: ls.reduce((s, l) => s + l.total, 0),
    }))
    .sort((a, b) => b.total - a.total)
}

export function calcularKpis(lineas: Linea[]): Kpis {
  const totalComprado = lineas.reduce((s, l) => s + l.total, 0)
  const numOrdenes = new Set(lineas.map((l) => l.referencia)).size
  const numArticulos = lineas.reduce((s, l) => s + (l.cantidad ?? 0), 0)
  const numProveedores = new Set(lineas.map((l) => l.proveedor)).size

  const gastosPorDestino = new Map<string, number>()
  for (const l of lineas) {
    const d = l.destino || "(sin destino)"
    gastosPorDestino.set(d, (gastosPorDestino.get(d) ?? 0) + l.total)
  }

  let destinoTop = ""
  let destinoTopGasto = 0
  for (const [d, gasto] of gastosPorDestino) {
    if (gasto > destinoTopGasto) {
      destinoTop = d
      destinoTopGasto = gasto
    }
  }

  const destinoTopPct = totalComprado > 0
    ? (destinoTopGasto / totalComprado) * 100
    : 0

  return { totalComprado, numOrdenes, numArticulos, numProveedores, destinoTop, destinoTopPct }
}

export function periodoPreset(tipo: "semana" | "mes"): { desde: Date; hasta: Date } {
  const hoy = new Date()
  if (tipo === "semana") {
    const day = hoy.getDay() // 0=dom,1=lun...
    const diffLunes = day === 0 ? -6 : 1 - day
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diffLunes)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    return { desde: lunes, hasta: domingo }
  }
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { desde, hasta }
}
