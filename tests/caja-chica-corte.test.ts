import { describe, it, expect } from "vitest"
import type { MovimientoCajaChica } from "@/lib/schemas"

function movimientoBase(overrides: Partial<MovimientoCajaChica> = {}): MovimientoCajaChica {
  const ahora = new Date("2026-08-01T12:00:00Z")
  return {
    id: "mov-1",
    fecha: "2026-08-01",
    periodo: "2026-08",
    descripcion: "Compra menor",
    proveedor: "Proveedor X",
    categoria: "Consumibles/Comida",
    solicitante: "Operador",
    comprobante: "TICKET",
    deducible: false,
    tipo: "SALIDA",
    monto: 250,
    costoReal: 250,
    ivaEstimado: 0,
    verificado: true,
    estadoCorte: "ACTIVO",
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  }
}

function filtrarCicloActivo(movimientos: MovimientoCajaChica[]): MovimientoCajaChica[] {
  return movimientos.filter((m) => !m.anulado && m.estadoCorte !== "CORTADO" && !m.corteId)
}

function calcularResumenCiclo(movimientos: MovimientoCajaChica[]) {
  let totalEntradas = 0
  let totalSalidas = 0

  movimientos.forEach((m) => {
    if (m.tipo === "ENTRADA") {
      totalEntradas += m.monto
    } else {
      totalSalidas += m.monto
    }
  })

  return {
    totalEntradas,
    totalSalidas,
    saldoReembolso: totalSalidas,
    saldoNeto: totalEntradas - totalSalidas,
  }
}

describe("Lógica de Ciclo Activo y Corte de Caja", () => {
  it("mantiene visibles movimientos de meses calendarios anteriores si no han sido cortados", () => {
    const movimientos = [
      movimientoBase({ id: "1", fecha: "2026-07-20", periodo: "2026-07", estadoCorte: "ACTIVO" }),
      movimientoBase({ id: "2", fecha: "2026-08-02", periodo: "2026-08", estadoCorte: "ACTIVO" }),
      movimientoBase({ id: "3", fecha: "2026-06-15", periodo: "2026-06", estadoCorte: "CORTADO", corteId: "corte-001" }),
    ]

    const activos = filtrarCicloActivo(movimientos)
    expect(activos.map((m) => m.id)).toEqual(["1", "2"])
  })

  it("calcula correctamente el saldo a reembolsar para un corte de caja acumulado", () => {
    const activos = [
      movimientoBase({ id: "1", tipo: "ENTRADA", monto: 5000 }),
      movimientoBase({ id: "2", tipo: "SALIDA", monto: 450 }),
      movimientoBase({ id: "3", tipo: "SALIDA", monto: 1200 }),
      movimientoBase({ id: "4", tipo: "SALIDA", monto: 350 }),
    ]

    const resumen = calcularResumenCiclo(activos)
    expect(resumen.totalEntradas).toBe(5000)
    expect(resumen.totalSalidas).toBe(2000)
    expect(resumen.saldoReembolso).toBe(2000)
    expect(resumen.saldoNeto).toBe(3000)
  })

  it("excluye movimientos anulados de la lista activa", () => {
    const movimientos = [
      movimientoBase({ id: "1", estadoCorte: "ACTIVO" }),
      movimientoBase({ id: "2", estadoCorte: "ACTIVO", anulado: true }),
    ]

    const activos = filtrarCicloActivo(movimientos)
    expect(activos.map((m) => m.id)).toEqual(["1"])
  })

  it("permite personalizar el monto de reabastecimiento en el resumen de corte", () => {
    const activos = [
      movimientoBase({ id: "1", tipo: "SALIDA", monto: 10000 }),
    ]
    const resumen = calcularResumenCiclo(activos)
    const montoPersonalizado = 7221
    expect(resumen.totalSalidas).toBe(10000)
    expect(montoPersonalizado).toBe(7221)
  })
})
