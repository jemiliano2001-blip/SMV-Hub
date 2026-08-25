import { describe, expect, it } from 'vitest'
import { calcularDestinosBottomNav } from '@/components/layout/BottomNavBar'
import type { ModuloId } from '@/lib/schemas'

describe('BottomNavBar Destinos', () => {
  it('incluye Inicio siempre', () => {
    const destinos = calcularDestinosBottomNav([], false, false)
    expect(destinos[0].href).toBe('/')
  })

  it('calcula destinos para usuario de taller/operación', () => {
    const modulos: ModuloId[] = ['pedidos-almacen', 'banos', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/pedidos-almacen')
    expect(hrefs).toContain('/banos')
    expect(hrefs).toContain('/notificaciones')
  })

  it('calcula destinos para usuario de compras', () => {
    const modulos: ModuloId[] = ['nueva-compra', 'ordenes', 'pedidos-almacen', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/pedidos-almacen')
    expect(hrefs).toContain('/nueva-compra')
    expect(hrefs).toContain('/ordenes')
    expect(hrefs).toContain('/notificaciones')
  })

  it('calcula destinos para usuario de almacén', () => {
    const modulos: ModuloId[] = ['almacen', 'pedidos-almacen', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/pedidos-almacen')
    expect(hrefs).toContain('/almacen')
    expect(hrefs).toContain('/notificaciones')
  })

  it('limita a máximo 5 items para no saturar la pantalla móvil', () => {
    const destinos = calcularDestinosBottomNav([], true, true) // superadmin / bypass
    expect(destinos.length).toBeLessThanOrEqual(5)
  })
})
