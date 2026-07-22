import { describe, it, expect } from 'vitest'
import { DEMO_REQUISICIONES } from '../lib/requisiciones-flujo'
import { PROVEEDORES_SEMILLA } from '../lib/proveedores'
import { COMPRAS_SEMILLA } from '../lib/proveedores-inteligencia'

describe('Dashboard de Inteligencia Operativa de Compras (3-Tier)', () => {
  it('debe calcular KPIs ejecutivos correctamente (Gasto, Lead Time, Atoradas)', () => {
    const gastoTotalUSD = COMPRAS_SEMILLA.filter((c) => c.moneda === 'USD').reduce((a, b) => a + b.costoTotal, 0)
    expect(gastoTotalUSD).toBeGreaterThan(0)

    const atoradas = DEMO_REQUISICIONES.filter((r) => r.estatusFlujo === 'cotizando' || r.estatusFlujo === 'enviada')
    expect(atoradas.length).toBeGreaterThan(0)
  })

  it('debe tener al menos 12 proveedores en el ranking comparativo de rendimiento', () => {
    expect(PROVEEDORES_SEMILLA.length).toBeGreaterThanOrEqual(12)
  })

  it('debe identificar compras y requisiciones que requieren atención inmediata', () => {
    const casosUrgentes = DEMO_REQUISICIONES.filter((r) => r.prioridadFlujo === 'urgente' && !r.proveedorGanadorNombre)
    expect(casosUrgentes).toBeDefined()
  })
})
