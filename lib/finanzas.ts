import { fechaHoyLocal } from "@/lib/format"
import type { FacturaCliente } from "@/lib/schemas"

export type GrupoCliente = {
  cliente: string
  facturas: FacturaCliente[]
  subtotal: number
  total: number
  pctDelTotal: number
}

export type KpisFinanzas = {
  facturacionTotal: number // neto: facturas - notas de crédito
  subtotal: number
  impuestos: number
  numFacturas: number
  numNotasCredito: number
  numClientes: number
}

export type EstadoCobranza = "pagada" | "pendiente" | "vencida"

// Borradores/cancelados nunca cuentan como facturación real.
function esValida(f: FacturaCliente): boolean {
  return f.estado === "publicado"
}

// Una nota de crédito resta de la facturación neta del cliente/periodo.
function signo(f: FacturaCliente): 1 | -1 {
  return f.tipo === "nota_credito" ? -1 : 1
}

export function facturasValidas(facturas: FacturaCliente[]): FacturaCliente[] {
  return facturas.filter(esValida)
}

export function monedasPresentes(facturas: FacturaCliente[]): string[] {
  return Array.from(new Set(facturas.map((f) => f.moneda)))
}

export function filtrarPorMoneda(facturas: FacturaCliente[], moneda: string): FacturaCliente[] {
  return facturas.filter((f) => f.moneda === moneda)
}

export function filtrarPorRango(
  facturas: FacturaCliente[],
  desde: Date,
  hasta: Date
): FacturaCliente[] {
  const desdeStr = fechaHoyLocal(desde)
  const hastaStr = fechaHoyLocal(hasta)
  return facturasValidas(facturas).filter((f) => {
    if (!f.fechaFactura) return false
    return f.fechaFactura >= desdeStr && f.fechaFactura <= hastaStr
  })
}

export function calcularKpisFinanzas(facturas: FacturaCliente[]): KpisFinanzas {
  const validas = facturasValidas(facturas)
  return {
    facturacionTotal: validas.reduce((s, f) => s + signo(f) * f.total, 0),
    subtotal: validas.reduce((s, f) => s + signo(f) * f.subtotal, 0),
    impuestos: validas.reduce((s, f) => s + signo(f) * f.impuestos, 0),
    numFacturas: validas.filter((f) => f.tipo === "factura").length,
    numNotasCredito: validas.filter((f) => f.tipo === "nota_credito").length,
    numClientes: new Set(validas.map((f) => f.cliente)).size,
  }
}

export function agruparPorCliente(facturas: FacturaCliente[]): GrupoCliente[] {
  const validas = facturasValidas(facturas)
  const totalGeneral = validas.reduce((s, f) => s + signo(f) * f.total, 0)

  const map = new Map<string, FacturaCliente[]>()
  for (const f of validas) {
    const arr = map.get(f.cliente) ?? []
    arr.push(f)
    map.set(f.cliente, arr)
  }

  return Array.from(map.entries())
    .map(([cliente, fs]) => {
      const total = fs.reduce((s, f) => s + signo(f) * f.total, 0)
      return {
        cliente,
        facturas: fs,
        subtotal: fs.reduce((s, f) => s + signo(f) * f.subtotal, 0),
        total,
        pctDelTotal: totalGeneral > 0 ? (total / totalGeneral) * 100 : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}

// Se basa en saldoPendiente (numérico) en vez de payment_state: una factura
// emitida no significa que el dinero ya se recibió (CLAUDE.md). Compara
// strings YYYY-MM-DD directamente (ordenan igual que fechas) para evitar
// bugs de zona horaria al construir Date desde una fecha sin hora.
export function clasificarCobranza(f: FacturaCliente, hoy: Date = new Date()): EstadoCobranza {
  if (f.saldoPendiente <= 0) return "pagada"
  if (f.fechaVencimiento && f.fechaVencimiento < fechaHoyLocal(hoy)) return "vencida"
  return "pendiente"
}

export function diasAtraso(f: FacturaCliente, hoy: Date = new Date()): number {
  if (!f.fechaVencimiento || f.saldoPendiente <= 0) return 0
  const dias = Math.floor(
    (parseFechaUTC(fechaHoyLocal(hoy)) - parseFechaUTC(f.fechaVencimiento)) / 86_400_000
  )
  return dias > 0 ? dias : 0
}

function parseFechaUTC(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

export function periodoPreset(tipo: "mes" | "anio"): { desde: Date; hasta: Date } {
  const hoy = new Date()
  if (tipo === "mes") {
    return {
      desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
      hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0),
    }
  }
  return {
    desde: new Date(hoy.getFullYear(), 0, 1),
    hasta: new Date(hoy.getFullYear(), 11, 31),
  }
}

/** Convierte el valor de un <input type="month"> ("YYYY-MM") al primer y último día de ese mes. */
export function rangoDeMes(anioMes: string): { desde: Date; hasta: Date } {
  const [anio, mes] = anioMes.split("-").map(Number)
  return {
    desde: new Date(anio, mes - 1, 1),
    hasta: new Date(anio, mes, 0),
  }
}

/** Valor por defecto para un <input type="month">: el mes actual como "YYYY-MM". */
export function mesActualStr(hoy: Date = new Date()): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
}
