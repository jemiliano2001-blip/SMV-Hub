import { describe, expect, it } from 'vitest'
import { aMXN, aUSD } from '@/lib/tipo-cambio'

describe('Conversiones de moneda para comparador y presupuesto', () => {
  it('convierte montos MXN a USD con tipo de cambio de referencia', () => {
    const usd = aUSD(200, 'MXN', 20.0)
    expect(usd).toBe(10)
  })

  it('mantiene USD sin cambios en aUSD', () => {
    const usd = aUSD(50, 'USD', 20.0)
    expect(usd).toBe(50)
  })

  it('convierte montos USD a MXN con tipo de cambio de referencia', () => {
    const mxn = aMXN(15, 'USD', 20.0)
    expect(mxn).toBe(300)
  })

  it('mantiene MXN sin cambios en aMXN', () => {
    const mxn = aMXN(150, 'MXN', 20.0)
    expect(mxn).toBe(150)
  })
})
