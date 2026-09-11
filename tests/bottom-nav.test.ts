import { describe, expect, it } from 'vitest'
import { calcularDestinosBottomNav } from '@/components/layout/BottomNavBar'
import type { ModuloId } from '@/lib/schemas'

describe('BottomNavBar Arquitectura 4 Pilares (Cross-Platform Mobile)', () => {
  it('incluye Inicio siempre como primer elemento y Más como último elemento', () => {
    const destinos = calcularDestinosBottomNav([], false, false)
    expect(destinos[0].href).toBe('/')
    expect(destinos[destinos.length - 1].action).toBe('mas')
    expect(destinos[destinos.length - 1].label).toBe('Más')
  })

  it('calcula los 4 pilares para rol Almacén (Inicio, Pedidos, Alertas, Más)', () => {
    const modulos: ModuloId[] = ['almacen', 'pedidos-almacen', 'banos', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    expect(destinos).toHaveLength(4)
    expect(destinos[0].href).toBe('/')
    expect(destinos[1].href).toBe('/pedidos-almacen')
    expect(destinos[1].badgeKey).toBe('pedidos')
    expect(destinos[2].href).toBe('/notificaciones')
    expect(destinos[2].badgeKey).toBe('notificaciones')
    expect(destinos[3].action).toBe('mas')
  })

  it('calcula los 4 pilares para rol Compras (Inicio, Pedidos/Comprar, Alertas, Más)', () => {
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

    expect(destinos).toHaveLength(4)
    expect(destinos[0].href).toBe('/')
    expect(destinos[1].href).toBe('/pedidos-almacen')
    expect(destinos[2].href).toBe('/notificaciones')
    expect(destinos[3].action).toBe('mas')
  })

  it('calcula los 4 pilares para rol Diseño/Automatización (Inicio, Requisiciones, Alertas, Más)', () => {
    const modulos: ModuloId[] = ['cotizaciones', 'requisiciones', 'horas-extra', 'notificaciones']
    const destinos = calcularDestinosBottomNav(modulos, false, false)

    expect(destinos).toHaveLength(4)
    expect(destinos[0].href).toBe('/')
    expect(destinos[1].href).toBe('/requisiciones')
    expect(destinos[2].href).toBe('/notificaciones')
    expect(destinos[3].action).toBe('mas')
  })

  it('calcula los 4 pilares para Super-Admin / Bypass', () => {
    const destinos = calcularDestinosBottomNav([], true, true)
    expect(destinos).toHaveLength(4)
    expect(destinos[0].href).toBe('/')
    expect(destinos[1].href).toBe('/pedidos-almacen')
    expect(destinos[2].href).toBe('/notificaciones')
    expect(destinos[3].action).toBe('mas')
  })

  it('mantiene exactamente 4 destinos ergonómicos táctiles (nunca satura la pantalla)', () => {
    const destinos = calcularDestinosBottomNav([], true, false)
    expect(destinos.length).toBeLessThanOrEqual(4)
  })
})
