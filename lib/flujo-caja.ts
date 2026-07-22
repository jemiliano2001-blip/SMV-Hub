import type { FacturaCliente, FacturaProveedor } from "@/lib/schemas"

export type PuntoFlujoCaja = {
  semanaKey: string // YYYY-Www
  semanaLabel: string // "Sem 28 (14 Jul - 20 Jul)"
  ingresosAR: number
  egresosAP: number
  netoSemanal: number
  netoAcumulado: number
}

export type ResumenFlujoCaja = {
  totalIngresosEsperados: number
  totalEgresosComprometidos: number
  balanceNetoProyectado: number
  coberturaPorcentaje: number // (AR / AP) * 100
  puntosSemanales: PuntoFlujoCaja[]
  numClientesPendientes: number
  numProveedoresPendientes: number
}

function obtenerNumeroSemana(d: Date): { ano: number; semana: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const semana = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { ano: date.getUTCFullYear(), semana }
}

function generarEtiquetaSemana(ano: number, semana: number): string {
  // Calcular primer y último día de la semana ISO
  const simple = new Date(Date.UTC(ano, 0, 1 + (semana - 1) * 7))
  const dow = simple.getUTCDay()
  const ISOweekStart = simple
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getUTCDay() + 1)
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getUTCDay())

  const ISOweekEnd = new Date(ISOweekStart)
  ISOweekEnd.setDate(ISOweekStart.getDate() + 6)

  const fmt = (d: Date) => `${d.getUTCDate()} ${d.toLocaleString("es-MX", { month: "short" })}`
  return `Sem ${semana} (${fmt(ISOweekStart)} - ${fmt(ISOweekEnd)})`
}

export function calcularFlujoCaja(
  facturasCliente: FacturaCliente[],
  facturasProveedor: FacturaProveedor[],
  monedaFiltro: string = "MXN"
): ResumenFlujoCaja {
  const arValidas = facturasCliente.filter(
    (f) => f.estado === "publicado" && f.moneda === monedaFiltro && f.saldoPendiente > 0
  )
  const apValidas = facturasProveedor.filter(
    (f) => f.estado === "posted" && f.moneda === monedaFiltro && f.saldoPendiente > 0
  )

  const totalIngresosEsperados = arValidas.reduce(
    (sum, f) => sum + (f.tipo === "nota_credito" ? -1 : 1) * f.saldoPendiente,
    0
  )
  const totalEgresosComprometidos = apValidas.reduce(
    (sum, f) => sum + (f.tipo === "nota_credito_proveedor" ? -1 : 1) * f.saldoPendiente,
    0
  )
  const balanceNetoProyectado = totalIngresosEsperados - totalEgresosComprometidos
  const coberturaPorcentaje =
    totalEgresosComprometidos > 0
      ? (totalIngresosEsperados / totalEgresosComprometidos) * 100
      : totalIngresosEsperados > 0
      ? 100
      : 0

  // Agrupar por semana de vencimiento/factura
  const semanasMap = new Map<string, { label: string; ingresos: number; egresos: number }>()

  for (const f of arValidas) {
    const fechaStr = f.fechaVencimiento || f.fechaFactura
    if (!fechaStr) continue
    const date = new Date(fechaStr)
    if (isNaN(date.getTime())) continue

    const { ano, semana } = obtenerNumeroSemana(date)
    const key = `${ano}-W${String(semana).padStart(2, "0")}`
    const label = generarEtiquetaSemana(ano, semana)
    const entry = semanasMap.get(key) ?? { label, ingresos: 0, egresos: 0 }
    entry.ingresos += (f.tipo === "nota_credito" ? -1 : 1) * f.saldoPendiente
    semanasMap.set(key, entry)
  }

  for (const f of apValidas) {
    const fechaStr = f.fechaVencimiento || f.fechaFactura
    if (!fechaStr) continue
    const date = new Date(fechaStr)
    if (isNaN(date.getTime())) continue

    const { ano, semana } = obtenerNumeroSemana(date)
    const key = `${ano}-W${String(semana).padStart(2, "0")}`
    const label = generarEtiquetaSemana(ano, semana)
    const entry = semanasMap.get(key) ?? { label, ingresos: 0, egresos: 0 }
    entry.egresos += (f.tipo === "nota_credito_proveedor" ? -1 : 1) * f.saldoPendiente
    semanasMap.set(key, entry)
  }

  const keysOrdenadas = Array.from(semanasMap.keys()).sort()
  let acumulado = 0
  const puntosSemanales: PuntoFlujoCaja[] = keysOrdenadas.map((key) => {
    const data = semanasMap.get(key)!
    const netoSemanal = data.ingresos - data.egresos
    acumulado += netoSemanal
    return {
      semanaKey: key,
      semanaLabel: data.label,
      ingresosAR: data.ingresos,
      egresosAP: data.egresos,
      netoSemanal,
      netoAcumulado: acumulado,
    }
  })

  const clientesUnicos = new Set(arValidas.map((f) => f.cliente))
  const proveedoresUnicos = new Set(apValidas.map((f) => f.proveedorNombre))

  return {
    totalIngresosEsperados,
    totalEgresosComprometidos,
    balanceNetoProyectado,
    coberturaPorcentaje,
    puntosSemanales,
    numClientesPendientes: clientesUnicos.size,
    numProveedoresPendientes: proveedoresUnicos.size,
  }
}
