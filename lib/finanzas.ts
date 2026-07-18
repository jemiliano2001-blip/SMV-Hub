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

/** Mes anterior a un valor "YYYY-MM" (cruza años: "2026-01" → "2025-12"). */
export function mesAnteriorStr(anioMes: string): string {
  const [anio, mes] = anioMes.split("-").map(Number)
  return mesActualStr(new Date(anio, mes - 2, 1))
}

// ── Comparación de periodos ──────────────────────────────────────────────────

export type DeltaKpi = {
  absoluto: number
  /** null cuando el periodo anterior es 0 (no hay base de comparación). */
  porcentaje: number | null
}

export type DeltasKpis = Record<keyof KpisFinanzas, DeltaKpi>

export function compararKpis(actual: KpisFinanzas, anterior: KpisFinanzas): DeltasKpis {
  const claves = Object.keys(actual) as Array<keyof KpisFinanzas>
  const out = {} as DeltasKpis
  for (const clave of claves) {
    const a = actual[clave]
    const b = anterior[clave]
    out[clave] = {
      absoluto: a - b,
      porcentaje: b === 0 ? null : ((a - b) / Math.abs(b)) * 100,
    }
  }
  return out
}

// ── Serie mensual (tendencia) ────────────────────────────────────────────────

export type PuntoMensual = {
  /** "YYYY-MM" */
  mes: string
  /** Facturación neta del mes (facturas − notas de crédito). */
  total: number
}

/**
 * Facturación neta por mes para los últimos `meses` meses terminando en el mes
 * de `hasta`. Meses sin facturas aparecen en 0 (sin huecos). Las facturas deben
 * venir ya filtradas por moneda — nunca mezclar monedas en una serie.
 */
export function serieMensual(
  facturas: FacturaCliente[],
  meses: number,
  hasta: Date = new Date()
): PuntoMensual[] {
  const totales = new Map<string, number>()
  for (const f of facturasValidas(facturas)) {
    if (!f.fechaFactura) continue
    const mes = f.fechaFactura.slice(0, 7)
    totales.set(mes, (totales.get(mes) ?? 0) + signo(f) * f.total)
  }

  const out: PuntoMensual[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const mes = mesActualStr(new Date(hasta.getFullYear(), hasta.getMonth() - i, 1))
    out.push({ mes, total: totales.get(mes) ?? 0 })
  }
  return out
}

// ── Aging (antigüedad de saldos) ─────────────────────────────────────────────

export type BucketAging = "corriente" | "b1_30" | "b31_60" | "b61_90" | "b90"

export const BUCKETS_AGING: BucketAging[] = ["corriente", "b1_30", "b31_60", "b61_90", "b90"]

export function bucketAging(f: FacturaCliente, hoy: Date = new Date()): BucketAging {
  const dias = diasAtraso(f, hoy)
  if (dias <= 0) return "corriente"
  if (dias <= 30) return "b1_30"
  if (dias <= 60) return "b31_60"
  if (dias <= 90) return "b61_90"
  return "b90"
}

export type DistribucionAging = {
  totalPorCobrar: number
  buckets: Record<BucketAging, { total: number; cantidad: number; pct: number }>
}

/**
 * Distribución del saldo abierto por bucket de antigüedad. Solo facturas
 * publicadas de tipo "factura" con saldo pendiente > 0 (las notas de crédito
 * no son cuentas por cobrar). Benchmark de referencia: 90+ arriba del 5% del
 * total indica problema sistémico de cobranza.
 */
export function distribucionAging(
  facturas: FacturaCliente[],
  hoy: Date = new Date()
): DistribucionAging {
  const abiertas = facturasValidas(facturas).filter(
    (f) => f.tipo === "factura" && f.saldoPendiente > 0
  )

  const buckets = Object.fromEntries(
    BUCKETS_AGING.map((b) => [b, { total: 0, cantidad: 0, pct: 0 }])
  ) as DistribucionAging["buckets"]

  for (const f of abiertas) {
    const b = bucketAging(f, hoy)
    buckets[b].total += f.saldoPendiente
    buckets[b].cantidad += 1
  }

  const totalPorCobrar = abiertas.reduce((s, f) => s + f.saldoPendiente, 0)
  if (totalPorCobrar > 0) {
    for (const b of BUCKETS_AGING) {
      buckets[b].pct = (buckets[b].total / totalPorCobrar) * 100
    }
  }

  return { totalPorCobrar, buckets }
}

// ── KPIs de cobranza ─────────────────────────────────────────────────────────

/**
 * DSO clásico: (saldo por cobrar vigente / facturación del periodo) × días del
 * periodo. Devuelve null si no hubo facturación en el periodo (sin base).
 * Las facturas deben venir ya filtradas por moneda.
 */
export function calcularDso(
  facturas: FacturaCliente[],
  desde: Date,
  hasta: Date
): number | null {
  const saldoVigente = facturasValidas(facturas)
    .filter((f) => f.tipo === "factura" && f.saldoPendiente > 0)
    .reduce((s, f) => s + f.saldoPendiente, 0)

  const facturadoPeriodo = filtrarPorRango(facturas, desde, hasta)
    .filter((f) => f.tipo === "factura")
    .reduce((s, f) => s + f.total, 0)

  if (facturadoPeriodo <= 0) return null

  const diasPeriodo = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1
  return (saldoVigente / facturadoPeriodo) * diasPeriodo
}

/**
 * CEI (Collection Effectiveness Index) aproximado con los datos del espejo:
 * cobrado de las facturas del periodo / cobrable (facturado menos lo que aún
 * no vence). Sin fechas de pago reales (llegarían con el sync de
 * account.payment, Fase 3 del plan) esto es una aproximación por snapshot:
 * asume que el saldo actual refleja lo no cobrado del periodo. Devuelve null
 * si no hay nada cobrable todavía. Rango: 0–100; >90 excelente, <70 problema.
 */
export function calcularCei(
  facturas: FacturaCliente[],
  desde: Date,
  hasta: Date,
  hoy: Date = new Date()
): number | null {
  const delPeriodo = filtrarPorRango(facturas, desde, hasta).filter(
    (f) => f.tipo === "factura"
  )

  const facturado = delPeriodo.reduce((s, f) => s + f.total, 0)
  const saldoAbierto = delPeriodo.reduce((s, f) => s + Math.max(0, f.saldoPendiente), 0)
  const noVencido = delPeriodo
    .filter((f) => f.saldoPendiente > 0 && clasificarCobranza(f, hoy) !== "vencida")
    .reduce((s, f) => s + f.saldoPendiente, 0)

  const cobrado = facturado - saldoAbierto
  const cobrable = facturado - noVencido
  if (cobrable <= 0) return null
  return (cobrado / cobrable) * 100
}

// ── Priorización de cobranza ─────────────────────────────────────────────────

export type ClienteVencido = {
  cliente: string
  saldoVencido: number
  cantidadFacturas: number
  facturaMasAntigua: string
  fechaVencimientoMasAntigua: string
  diasMaximosAtraso: number
}

function exigirMonedaUnica(facturas: FacturaCliente[]): void {
  const monedas = new Set(facturas.map((factura) => factura.moneda))
  if (monedas.size > 1) {
    throw new Error("El cálculo financiero requiere facturas de una sola moneda.")
  }
}

/**
 * Agrupa facturas vencidas por cliente y prioriza por saldo. Las facturas deben
 * venir filtradas por una sola moneda.
 */
export function topClientesVencidos(
  facturas: FacturaCliente[],
  hoy: Date = new Date(),
  limite = 5
): ClienteVencido[] {
  exigirMonedaUnica(facturas)
  const vencidas = facturasValidas(facturas).filter(
    (f) =>
      f.tipo === "factura" &&
      f.saldoPendiente > 0 &&
      clasificarCobranza(f, hoy) === "vencida"
  )
  const porCliente = new Map<string, FacturaCliente[]>()
  for (const factura of vencidas) {
    const actuales = porCliente.get(factura.cliente) ?? []
    actuales.push(factura)
    porCliente.set(factura.cliente, actuales)
  }

  return Array.from(porCliente.entries())
    .map(([cliente, delCliente]) => {
      const porAntiguedad = [...delCliente].sort((a, b) =>
        (a.fechaVencimiento ?? "").localeCompare(b.fechaVencimiento ?? "")
      )
      const masAntigua = porAntiguedad[0]
      return {
        cliente,
        saldoVencido: delCliente.reduce((s, f) => s + f.saldoPendiente, 0),
        cantidadFacturas: delCliente.length,
        facturaMasAntigua: masAntigua.numeroFactura,
        fechaVencimientoMasAntigua: masAntigua.fechaVencimiento ?? "",
        diasMaximosAtraso: diasAtraso(masAntigua, hoy),
      }
    })
    .sort((a, b) => b.saldoVencido - a.saldoVencido)
    .slice(0, Math.max(0, limite))
}

/**
 * Selecciona el cuartil superior (máximo 5) por saldo dentro del bucket 31–60,
 * la zona donde el seguimiento personal ofrece mejor retorno.
 */
export function idsFacturasPrioritarias(
  facturas: FacturaCliente[],
  hoy: Date = new Date()
): string[] {
  exigirMonedaUnica(facturas)
  const candidatas = facturasValidas(facturas)
    .filter(
      (f) =>
        f.tipo === "factura" &&
        f.saldoPendiente > 0 &&
        bucketAging(f, hoy) === "b31_60"
    )
    .sort((a, b) => b.saldoPendiente - a.saldoPendiente)

  if (candidatas.length === 0) return []
  const limite = Math.min(5, Math.max(1, Math.ceil(candidatas.length * 0.25)))
  return candidatas.slice(0, limite).map((factura) => factura.id)
}
