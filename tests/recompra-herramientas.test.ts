import { describe, it, expect } from 'vitest'
import {
  calcularEvaluacionRecompra,
  DEMO_ITEMS_RECOMPRA,
} from '../lib/recompra-herramientas'

describe('Motor de Reabastecimiento e Inventario de Recompra (ROP & EOQ)', () => {
  it('debe calcular correctamente el Punto de Recompra (ROP) y Cantidad Sugerida', () => {
    const item = calcularEvaluacionRecompra({
      id: 'test-1',
      nombre: 'Endmill 1/4 Carburo',
      categoria: 'endmills',
      marca: 'Shars Tool',
      especificacionTecnica: '4-Flute AlTiN',
      proveedorPreferidoId: 'prov-shars',
      proveedorPreferidoNombre: 'Shars Tool Company',
      unidad: 'pza',
      stockActual: 2,
      stockMinimo: 10,
      stockSeguridad: 5,
      consumoPromedioSemanal: 10, // 2/día
      leadTimeDias: 4,            // Demanda = 8 pzas
      pedidoMinimoMOQ: 10,
      ultimaCompraFecha: '2026-06-01',
      costoEstimadoUSD: 15.00,
      frecuenciaCompra: 'semanal',
    })

    // ROP = 8 (demanda) + 5 (seguridad) = 13
    expect(item.puntoRecompraROP).toBe(13)
    // Como stockActual (2) <= stockSeguridad (5) -> URGENTE
    expect(item.estatusRecompra).toBe('urgente')
    expect(item.nivelUrgencia).toBe('alto')
    // Cantidad sugerida = max((5 + 10) - 2 = 13, 10 MOQ) = 13
    expect(item.cantidadSugerida).toBe(13)
  })

  it('debe clasificar en monitorear cuando el stock es saludable', () => {
    const item = calcularEvaluacionRecompra({
      id: 'test-2',
      nombre: 'Boquilla ER32',
      categoria: 'tooling',
      marca: 'Techniks',
      especificacionTecnica: 'Precision Collet',
      proveedorPreferidoId: 'prov-mcmaster',
      proveedorPreferidoNombre: 'McMaster-Carr',
      unidad: 'pza',
      stockActual: 25,
      stockMinimo: 10,
      stockSeguridad: 5,
      consumoPromedioSemanal: 2,
      leadTimeDias: 2,
      pedidoMinimoMOQ: 4,
      ultimaCompraFecha: '2026-07-01',
      costoEstimadoUSD: 30.00,
      frecuenciaCompra: 'mensual',
    })

    expect(item.estatusRecompra).toBe('monitorear')
    expect(item.nivelUrgencia).toBe('bajo')
  })

  it('debe tener datos demo cargados para endmills, insertos y consumibles', () => {
    expect(DEMO_ITEMS_RECOMPRA.length).toBeGreaterThanOrEqual(4)
    const urgentes = DEMO_ITEMS_RECOMPRA.filter((i) => i.estatusRecompra === 'urgente')
    expect(urgentes.length).toBeGreaterThan(0)
  })
})
