import { describe, expect, it } from 'vitest'
import { tieneModulo } from '@/lib/roles'
import type { ModuloId } from '@/lib/schemas'

describe('Almacén Recepción - Privacidad de Montos y Seguridad', () => {
  it('garantiza que la plantilla de almacén puro no tiene acceso a ver montos ni precios', () => {
    const modulosAlmacenPuro: ModuloId[] = ['almacen']

    const puedeVerMontos = (modulos: ModuloId[], esSuperAdmin = false) =>
      esSuperAdmin ||
      tieneModulo(modulos, 'nueva-compra') ||
      tieneModulo(modulos, 'ordenes') ||
      tieneModulo(modulos, 'reportes')

    expect(puedeVerMontos(modulosAlmacenPuro, false)).toBe(false)
  })

  it('permite ver montos a personal de compras, finanzas o super-admin', () => {
    const puedeVerMontos = (modulos: ModuloId[], esSuperAdmin = false) =>
      esSuperAdmin ||
      tieneModulo(modulos, 'nueva-compra') ||
      tieneModulo(modulos, 'ordenes') ||
      tieneModulo(modulos, 'reportes')

    expect(puedeVerMontos(['almacen', 'nueva-compra'], false)).toBe(true)
    expect(puedeVerMontos(['ordenes'], false)).toBe(true)
    expect(puedeVerMontos(['reportes'], false)).toBe(true)
    expect(puedeVerMontos(['almacen'], true)).toBe(true)
  })
})
