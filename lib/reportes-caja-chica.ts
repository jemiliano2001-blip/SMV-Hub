import type { MovimientoCajaChica } from "@/lib/schemas"

// Solo los gastos (SALIDA) participan de estos reportes — las recargas (ENTRADA)
// siempre traen comprobante forzado a NINGUNO (ver ModalMovimientoCaja.tsx) y no
// son un gasto que deba facturarse.
export function filtrarMovimientosCajaChicaReporte(
  movimientos: MovimientoCajaChica[],
  conFactura: boolean
): MovimientoCajaChica[] {
  return movimientos.filter(
    (m) => m.tipo === "SALIDA" && (m.comprobante === "FACTURA") === conFactura
  )
}

export function calcularTotalesReporteCaja(
  movimientos: MovimientoCajaChica[]
): { total: number; ivaTotal: number } {
  return movimientos.reduce(
    (acc, m) => ({
      total: acc.total + m.monto,
      ivaTotal: acc.ivaTotal + m.ivaEstimado,
    }),
    { total: 0, ivaTotal: 0 }
  )
}
