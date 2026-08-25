import { describe, expect, it } from 'vitest'
import {
  INSUMOS_FRECUENTES,
  CATEGORIAS_INSUMOS,
  agregarInsumoADescripcion,
} from '@/lib/insumos-frecuentes'

describe('Insumos Frecuentes', () => {
  it('contiene catálogo de herramientas de corte y consumibles esenciales', () => {
    expect(INSUMOS_FRECUENTES.length).toBeGreaterThanOrEqual(15)

    const categorias = new Set(INSUMOS_FRECUENTES.map((i) => i.categoria))
    expect(categorias.has('corte')).toBe(true)
    expect(categorias.has('consumibles')).toBe(true)
    expect(categorias.has('ferreteria')).toBe(true)
  })

  it('agrupa por categorías con etiquetas legibles', () => {
    expect(CATEGORIAS_INSUMOS.length).toBe(3)
    const catCorte = CATEGORIAS_INSUMOS.find((c) => c.id === 'corte')
    expect(catCorte).toBeDefined()
    expect(catCorte?.items.some((i) => i.nombre.includes('APMT'))).toBe(true)
  })

  it('agrega un insumo a una descripción vacía con su cantidad sugerida', () => {
    const item = INSUMOS_FRECUENTES.find((i) => i.id === 'apmt-1135')!
    const res = agregarInsumoADescripcion('', item)
    expect(res).toBe('Insertos APMT 1135 (10 pzas)')
  })

  it('concatena insumos adicionales sin duplicar existentes', () => {
    const item1 = INSUMOS_FRECUENTES.find((i) => i.id === 'apmt-1135')!
    const item2 = INSUMOS_FRECUENTES.find((i) => i.id === 'guantes-nitrilo-m')!

    let desc = agregarInsumoADescripcion('', item1)
    desc = agregarInsumoADescripcion(desc, item2)
    expect(desc).toBe('Insertos APMT 1135 (10 pzas), Guantes nitrilo M (1 caja)')

    // Al intentar agregar de nuevo el mismo item, no lo duplica
    const descRepetida = agregarInsumoADescripcion(desc, item1)
    expect(descRepetida).toBe(desc)
  })
})
