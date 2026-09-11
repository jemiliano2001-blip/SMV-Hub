import { describe, expect, it } from 'vitest'
import { tienePermiso } from '@/lib/roles'
import type { ModuloId } from '@/lib/schemas'

describe('MobileMasDrawer y Filtrado de Permisos Móvil', () => {
  it('filtra módulos restringidos para un operador sin acceso a finanzas ni compras', () => {
    const modulosOperador: ModuloId[] = ['almacen', 'pedidos-almacen', 'banos']

    expect(tienePermiso(modulosOperador, '/almacen', false)).toBe(true)
    expect(tienePermiso(modulosOperador, '/pedidos-almacen', false)).toBe(true)
    expect(tienePermiso(modulosOperador, '/banos', false)).toBe(true)

    // Rutas protegidas que no deben mostrarse
    expect(tienePermiso(modulosOperador, '/nueva-compra', false)).toBe(false)
    expect(tienePermiso(modulosOperador, '/caja-chica', false)).toBe(false)
    expect(tienePermiso(modulosOperador, '/finanzas', false)).toBe(false)
    expect(tienePermiso(modulosOperador, '/usuarios', false)).toBe(false)
  })

  it('permite acceso total a todos los módulos si esSuperAdmin es true', () => {
    const rutas = [
      '/nueva-compra',
      '/ordenes',
      '/cotizaciones',
      '/almacen',
      '/caja-chica',
      '/finanzas',
      '/usuarios',
      '/auditoria',
    ]

    for (const r of rutas) {
      expect(tienePermiso([], r, true)).toBe(true)
    }
  })

  it('maneja listas vacías o nulas de módulos sin lanzar excepciones', () => {
    expect(tienePermiso(null, '/almacen', false)).toBe(false)
    expect(tienePermiso(undefined, '/caja-chica', false)).toBe(false)
    expect(tienePermiso([], '/pedidos-almacen', false)).toBe(false)
  })
})
