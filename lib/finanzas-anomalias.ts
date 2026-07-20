import type { FacturaCliente } from "@/lib/schemas"
import { facturasValidas, serieMensual } from "@/lib/finanzas"

export type SeveridadAnomalia = "alta" | "media" | "baja"

export type TipoAnomaliaFinanciera =
  | "total_no_cuadra"
  | "saldo_inconsistente"
  | "pago_inconsistente"
  | "fecha_inconsistente"
  | "cliente_vacio"
  | "moneda_invalida"
  | "factura_duplicada"
  | "facturacion_fuera_rango"

export type AnomaliaFinanciera = {
  id: string
  tipo: TipoAnomaliaFinanciera
  severidad: SeveridadAnomalia
  titulo: string
  detalle: string
  accion: string
  facturaId?: string
  referencias?: string[]
  periodo?: string
  moneda?: string
  cliente?: string
  valorActual?: number
  valorEsperado?: number
  porcentajeCambio?: number
}

type OpcionesFacturacion = {
  meses?: number
  observacionesMinimas?: number
  cambioMinimoPorcentaje?: number
}

const TOLERANCIA_MONETARIA = 0.02
const ORDEN_SEVERIDAD: Record<SeveridadAnomalia, number> = { alta: 0, media: 1, baja: 2 }

function esFechaIso(fecha: string | null): boolean {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const [anio, mes, dia] = fecha.split("-").map(Number)
  const valor = new Date(Date.UTC(anio, mes - 1, dia))
  return valor.getUTCFullYear() === anio && valor.getUTCMonth() === mes - 1 && valor.getUTCDate() === dia
}

function ordenarAlertas(alertas: AnomaliaFinanciera[]): AnomaliaFinanciera[] {
  return [...alertas].sort((a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad])
}

export function detectarAnomaliasIntegridad(facturas: FacturaCliente[]): AnomaliaFinanciera[] {
  const alertas: AnomaliaFinanciera[] = []
  const validas = facturasValidas(facturas)

  for (const factura of validas) {
    const importeCalculado = factura.subtotal + factura.impuestos
    if (Math.abs(factura.total - importeCalculado) > TOLERANCIA_MONETARIA) {
      alertas.push({
        id: `total_no_cuadra:${factura.id}`,
        tipo: "total_no_cuadra",
        severidad: "alta",
        titulo: `Total inconsistente en ${factura.numeroFactura}`,
        detalle: `Total ${factura.total.toFixed(2)} no coincide con subtotal + impuestos (${importeCalculado.toFixed(2)}).`,
        accion: "Revisar la factura en Odoo y confirmar impuestos o cargos adicionales.",
        facturaId: factura.id,
        moneda: factura.moneda,
        cliente: factura.cliente,
        valorActual: factura.total,
        valorEsperado: importeCalculado,
      })
    }

    if (
      factura.tipo === "factura" &&
      (factura.saldoPendiente < -TOLERANCIA_MONETARIA || factura.saldoPendiente > factura.total + TOLERANCIA_MONETARIA)
    ) {
      alertas.push({
        id: `saldo_inconsistente:${factura.id}`,
        tipo: "saldo_inconsistente",
        severidad: "alta",
        titulo: `Saldo inconsistente en ${factura.numeroFactura}`,
        detalle: `El saldo pendiente es ${factura.saldoPendiente.toFixed(2)} frente a un total de ${factura.total.toFixed(2)}.`,
        accion: "Revisar conciliación, moneda y pagos aplicados en Odoo.",
        facturaId: factura.id,
        moneda: factura.moneda,
        cliente: factura.cliente,
        valorActual: factura.saldoPendiente,
        valorEsperado: factura.total,
      })
    }

    const pagoCalculado = factura.total - factura.saldoPendiente
    if (Math.abs(factura.montoPagado - pagoCalculado) > TOLERANCIA_MONETARIA) {
      alertas.push({
        id: `pago_inconsistente:${factura.id}`,
        tipo: "pago_inconsistente",
        severidad: "media",
        titulo: `Pago inconsistente en ${factura.numeroFactura}`,
        detalle: `Pago registrado ${factura.montoPagado.toFixed(2)} frente al cálculo esperado ${pagoCalculado.toFixed(2)}.`,
        accion: "Verificar el saldo residual y la conciliación de pagos en Odoo.",
        facturaId: factura.id,
        moneda: factura.moneda,
        cliente: factura.cliente,
        valorActual: factura.montoPagado,
        valorEsperado: pagoCalculado,
      })
    }

    if (factura.fechaFactura && factura.fechaVencimiento) {
      if (!esFechaIso(factura.fechaFactura) || !esFechaIso(factura.fechaVencimiento) || factura.fechaVencimiento < factura.fechaFactura) {
        alertas.push({
          id: `fecha_inconsistente:${factura.id}`,
          tipo: "fecha_inconsistente",
          severidad: "media",
          titulo: `Fechas inconsistentes en ${factura.numeroFactura}`,
          detalle: `Factura: ${factura.fechaFactura}; vencimiento: ${factura.fechaVencimiento}.`,
          accion: "Confirmar fechas de emisión y vencimiento en Odoo.",
          facturaId: factura.id,
          moneda: factura.moneda,
          cliente: factura.cliente,
        })
      }
    }

    if (!factura.cliente.trim()) {
      alertas.push({
        id: `cliente_vacio:${factura.id}`,
        tipo: "cliente_vacio",
        severidad: "alta",
        titulo: `Factura sin cliente: ${factura.numeroFactura}`,
        detalle: "El registro publicado no tiene nombre de cliente.",
        accion: "Completar el cliente en Odoo antes de usar esta factura en reportes.",
        facturaId: factura.id,
        moneda: factura.moneda,
      })
    }

    if (!/^[A-Z]{3}$/.test(factura.moneda)) {
      alertas.push({
        id: `moneda_invalida:${factura.id}`,
        tipo: "moneda_invalida",
        severidad: "alta",
        titulo: `Moneda inválida en ${factura.numeroFactura}`,
        detalle: `El código recibido es “${factura.moneda || "vacío"}”.`,
        accion: "Revisar la moneda configurada en Odoo.",
        facturaId: factura.id,
        cliente: factura.cliente,
      })
    }
  }

  const duplicados = new Map<string, FacturaCliente[]>()
  for (const factura of validas) {
    const folio = factura.numeroFactura.trim()
    if (!folio || folio === "/") continue
    const clave = `${factura.odooCompanyId}:${folio}`
    const grupo = duplicados.get(clave) ?? []
    grupo.push(factura)
    duplicados.set(clave, grupo)
  }

  for (const grupo of duplicados.values()) {
    if (grupo.length < 2) continue
    const referencias = grupo.map((factura) => factura.id)
    alertas.push({
      id: `factura_duplicada:${referencias.sort().join(",")}`,
      tipo: "factura_duplicada",
      severidad: "alta",
      titulo: `Folio duplicado: ${grupo[0].numeroFactura}`,
      detalle: `El folio aparece ${grupo.length} veces dentro de la misma empresa.`,
      accion: "Confirmar si existe una duplicidad en Odoo antes de cerrar el periodo.",
      referencias,
      moneda: grupo[0].moneda,
      cliente: grupo[0].cliente,
    })
  }

  return ordenarAlertas(alertas)
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
    : ordenados[mitad]
}

/**
 * Revisa el último mes cerrado contra la mediana de meses anteriores. Separa
 * monedas y no intenta inferir una anomalía cuando todavía hay poca historia.
 */
export function detectarAnomaliasFacturacion(
  facturas: FacturaCliente[],
  hoy: Date = new Date(),
  opciones: OpcionesFacturacion = {}
): AnomaliaFinanciera[] {
  const meses = opciones.meses ?? 12
  const observacionesMinimas = opciones.observacionesMinimas ?? 4
  const cambioMinimo = opciones.cambioMinimoPorcentaje ?? 40
  const ultimoMesCerrado = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  const porMoneda = new Map<string, FacturaCliente[]>()

  for (const factura of facturasValidas(facturas)) {
    const grupo = porMoneda.get(factura.moneda) ?? []
    grupo.push(factura)
    porMoneda.set(factura.moneda, grupo)
  }

  const alertas: AnomaliaFinanciera[] = []
  for (const [moneda, delMoneda] of porMoneda) {
    if (!/^[A-Z]{3}$/.test(moneda)) continue
    const serie = serieMensual(delMoneda, meses, ultimoMesCerrado)
    if (serie.length < 2) continue
    const objetivo = serie[serie.length - 1]
    const historico = serie.slice(0, -1).filter((punto) => punto.total !== 0)
    if (historico.length < observacionesMinimas) continue

    const esperado = mediana(historico.map((punto) => punto.total))
    const porcentajeCambio = esperado === 0
      ? objetivo.total === 0 ? 0 : 100
      : ((objetivo.total - esperado) / Math.abs(esperado)) * 100

    if (Math.abs(porcentajeCambio) < cambioMinimo) continue
    const direccion = porcentajeCambio < 0 ? "Caída" : "Aumento"
    const severidad: SeveridadAnomalia = Math.abs(porcentajeCambio) >= 100 ? "alta" : "media"
    alertas.push({
      id: `facturacion_fuera_rango:${moneda}:${objetivo.mes}`,
      tipo: "facturacion_fuera_rango",
      severidad,
      titulo: `${direccion} de facturación en ${objetivo.mes}`,
      detalle: `${objetivo.total.toFixed(2)} ${moneda} frente a un histórico típico de ${esperado.toFixed(2)} ${moneda} (${porcentajeCambio >= 0 ? "+" : ""}${porcentajeCambio.toFixed(1)}%).`,
      accion: "Revisar clientes principales, notas de crédito y estado de sincronización.",
      periodo: objetivo.mes,
      moneda,
      valorActual: objetivo.total,
      valorEsperado: esperado,
      porcentajeCambio,
    })
  }

  return ordenarAlertas(alertas)
}

export function detectarAnomaliasFinancieras(
  facturas: FacturaCliente[],
  hoy: Date = new Date()
): AnomaliaFinanciera[] {
  return ordenarAlertas([
    ...detectarAnomaliasIntegridad(facturas),
    ...detectarAnomaliasFacturacion(facturas, hoy),
  ])
}
