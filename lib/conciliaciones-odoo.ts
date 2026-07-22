import type { OrdenCompra, FacturaProveedor } from "@/lib/schemas"

export type EstatusConciliacion = "conciliado_exacto" | "desviacion_precio" | "solo_local" | "solo_odoo"

export type ItemConciliacionOdoo = {
  id: string
  folio: string
  proveedor: string
  ordenCompraLocal: OrdenCompra | null
  facturaOdoo: FacturaProveedor | null
  montoLocal: number
  montoOdoo: number
  diferenciaMonto: number
  porcentajeDesviacion: number
  estatus: EstatusConciliacion
  alertaInconsistencia: string | null
}

export type ResumenConciliacion = {
  totalConciliadas: number
  totalDesviaciones: number
  totalSoloLocal: number
  totalSoloOdoo: number
  items: ItemConciliacionOdoo[]
}

function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

export function conciliarComprasConOdoo(
  ordenesLocales: OrdenCompra[],
  facturasOdoo: FacturaProveedor[],
  umbralDesviacionPct: number = 2.0
): ResumenConciliacion {
  const odooProcesadas = new Set<string>()
  const resultItems: ItemConciliacionOdoo[] = []

  // Mapa de facturas Odoo por Folio/NumeroFactura normalizado y por Proveedor
  const mapOdoo = new Map<string, FacturaProveedor>()
  for (const f of facturasOdoo) {
    if (f.estado !== "posted") continue
    const keyFolioProv = `${normalizarTexto(f.numeroFactura)}_${normalizarTexto(f.proveedorNombre)}`
    mapOdoo.set(keyFolioProv, f)

    // También mapear por numeroFactura si es único
    if (f.numeroFactura && f.numeroFactura !== "/") {
      mapOdoo.set(normalizarTexto(f.numeroFactura), f)
    }
  }

  let totalConciliadas = 0
  let totalDesviaciones = 0
  let totalSoloLocal = 0
  let totalSoloOdoo = 0

  for (const orden of ordenesLocales) {
    const folioNorm = normalizarTexto(orden.numeroFactura || "")
    const provNorm = normalizarTexto(orden.proveedor || "")
    const keyCombo = `${folioNorm}_${provNorm}`

    const facturaMatch = mapOdoo.get(keyCombo) || (folioNorm ? mapOdoo.get(folioNorm) : undefined)

    if (facturaMatch) {
      odooProcesadas.add(facturaMatch.id)
      const montoLocal = orden.total || 0
      const montoOdoo = facturaMatch.total || 0
      const diferenciaMonto = Math.abs(montoLocal - montoOdoo)
      const porcentajeDesviacion = montoOdoo > 0 ? (diferenciaMonto / montoOdoo) * 100 : 0

      let estatus: EstatusConciliacion = "conciliado_exacto"
      let alertaInconsistencia: string | null = null

      if (porcentajeDesviacion > umbralDesviacionPct) {
        estatus = "desviacion_precio"
        totalDesviaciones++
        alertaInconsistencia = `Diferencia de $${diferenciaMonto.toFixed(2)} ${orden.moneda} (${porcentajeDesviacion.toFixed(1)}%) entre SMV Hub ($${montoLocal.toFixed(2)}) y Odoo ($${montoOdoo.toFixed(2)})`
      } else {
        totalConciliadas++
      }

      resultItems.push({
        id: `conc_${orden.id}_${facturaMatch.id}`,
        folio: orden.numeroFactura || facturaMatch.numeroFactura,
        proveedor: orden.proveedor || facturaMatch.proveedorNombre,
        ordenCompraLocal: orden,
        facturaOdoo: facturaMatch,
        montoLocal,
        montoOdoo,
        diferenciaMonto,
        porcentajeDesviacion,
        estatus,
        alertaInconsistencia,
      })
    } else {
      totalSoloLocal++
      resultItems.push({
        id: `solo_loc_${orden.id}`,
        folio: orden.numeroFactura || "Sin Folio",
        proveedor: orden.proveedor || "Sin Proveedor",
        ordenCompraLocal: orden,
        facturaOdoo: null,
        montoLocal: orden.total || 0,
        montoOdoo: 0,
        diferenciaMonto: orden.total || 0,
        porcentajeDesviacion: 100,
        estatus: "solo_local",
        alertaInconsistencia: "Compra registrada en SMV Hub no encontrada en Odoo (Factura de proveedor pendiente)",
      })
    }
  }

  // Identificar facturas de Odoo que no están en SMV Hub
  for (const f of facturasOdoo) {
    if (f.estado !== "posted" || odooProcesadas.has(f.id)) continue
    totalSoloOdoo++
    resultItems.push({
      id: `solo_odoo_${f.id}`,
      folio: f.numeroFactura,
      proveedor: f.proveedorNombre,
      ordenCompraLocal: null,
      facturaOdoo: f,
      montoLocal: 0,
      montoOdoo: f.total,
      diferenciaMonto: f.total,
      porcentajeDesviacion: 100,
      estatus: "solo_odoo",
      alertaInconsistencia: "Factura registrada en Odoo sin captura correspondiente en SMV Hub",
    })
  }

  return {
    totalConciliadas,
    totalDesviaciones,
    totalSoloLocal,
    totalSoloOdoo,
    items: resultItems,
  }
}
