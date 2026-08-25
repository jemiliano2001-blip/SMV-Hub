import { describe, expect, it } from 'vitest'
import { calcularDestinosBottomNav } from '@/components/layout/BottomNavBar'
import type { ModuloId } from '@/lib/schemas'

describe('BottomNavBar Destinos Inteligentes por Rol', () => {
  it('incluye Inicio siempre como primer elemento', () => {
    const destinos = calcularDestinosBottomNav([], false, false)
    expect(destinos[0].href).toBe('/')
  })

  it('calcula destinos para rol Almacén (sin compras ni órdenes)', () => {
    const modulos: ModuloId[] = ['almacen', 'pedidos-almacen', 'banos', 'documentos-venta', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/pedidos-almacen')
    expect(hrefs).toContain('/almacen')
    expect(hrefs).toContain('/notificaciones')
    // No debe contener compras ni órdenes
    expect(hrefs).not.toContain('/nueva-compra')
    expect(hrefs).not.toContain('/ordenes')
  })

  it('calcula destinos para rol Diseño (requisiciones, cotizaciones, horas extra)', () => {
    const modulos: ModuloId[] = ['cotizaciones', 'requisiciones', 'horas-extra']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/requisiciones')
    expect(hrefs).toContain('/cotizaciones')
    expect(hrefs).toContain('/horas-extra')
    expect(hrefs).toContain('/notificaciones')
    expect(hrefs).not.toContain('/nueva-compra')
    expect(hrefs).not.toContain('/ordenes')
    expect(hrefs).not.toContain('/almacen')
  })

  it('calcula destinos para rol Automatización (cotizaciones, requisiciones, horas extra, notificaciones)', () => {
    const modulos: ModuloId[] = ['cotizaciones', 'requisiciones', 'horas-extra', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/requisiciones')
    expect(hrefs).toContain('/cotizaciones')
    expect(hrefs).toContain('/horas-extra')
    expect(hrefs).toContain('/notificaciones')
  })

  it('calcula destinos para rol Ventas (documentos de venta)', () => {
    const modulos: ModuloId[] = ['documentos-venta', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false, true)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/documentos-venta')
    expect(hrefs).toContain('/notificaciones')
    expect(hrefs).not.toContain('/nueva-compra')
    expect(hrefs).not.toContain('/ordenes')
  })

  it('calcula destinos para rol Compras (nueva compra, requisiciones, pedidos)', () => {
    const modulos: ModuloId[] = [
      'nueva-compra',
      'compras-odoo',
      'cotizaciones',
      'requisiciones',
      'proveedores',
      'pedidos-almacen',
      'notificaciones',
    ]
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/nueva-compra')
    expect(hrefs).toContain('/requisiciones')
    expect(hrefs).toContain('/pedidos-almacen')
    expect(hrefs).toContain('/notificaciones')
  })

  it('calcula destinos para rol Super-Admin (nueva compra, órdenes, requisiciones)', () => {
    const modulos: ModuloId[] = ['nueva-compra', 'ordenes', 'requisiciones', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, true, false)

    const hrefs = destinos.map((d) => d.href)
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/nueva-compra')
    expect(hrefs).toContain('/ordenes')
    expect(hrefs).toContain('/requisiciones')
    expect(hrefs).toContain('/notificaciones')
  })

  it('limita a máximo 5 items para no saturar la pantalla móvil', () => {
    const destinos = calcularDestinosBottomNav([], true, true) // superadmin / bypass
    expect(destinos.length).toBeLessThanOrEqual(5)
  })
})
