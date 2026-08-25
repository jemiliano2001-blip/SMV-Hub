import { describe, it, expect } from 'vitest'
import {
  calcularTotalesPO,
  DIRECCION_USA_DEFAULT,
  EMPRESA_USA_DEFAULT,
  TERMINOS_PAGO_DEFAULT,
  TERMINOS_PAGO_USA_OPCIONES,
} from '@/lib/ordenes-compra-usa'
import {
  OrdenCompraUsaSchema,
  ItemOrdenCompraUsaSchema,
  EstadoOrdenCompraUsaSchema,
} from '@/lib/schemas'
import { tienePermiso, modulosDePlantilla, RUTA_POR_MODULO } from '@/lib/roles'

describe('Órdenes de Compra USA (lib/ordenes-compra-usa)', () => {
  it('calcularTotalesPO calcula subtotal, impuestos, envío y total general con precisión', () => {
    const items = [
      { cantidad: 2, precioUnitario: 50.25, impuestos: 8.29 },
      { cantidad: 10, precioUnitario: 5.5, impuestos: 4.53 },
      { cantidad: 1, precioUnitario: 100.0, impuestos: 0 },
    ]
    const envio = 25.0

    const res = calcularTotalesPO(items, envio)

    // Subtotal: (2 * 50.25) + (10 * 5.50) + (1 * 100.00) = 100.50 + 55.00 + 100.00 = 255.50
    expect(res.subtotal).toBe(255.5)
    // Impuestos: 8.29 + 4.53 + 0 = 12.82
    expect(res.impuestos).toBe(12.82)
    // Envio: 25.00
    expect(res.envio).toBe(25.0)
    // Total: 255.50 + 12.82 + 25.00 = 293.32
    expect(res.total).toBe(293.32)
    expect(res.itemsConSubtotal[0].subtotal).toBe(100.5)
    expect(res.itemsConSubtotal[1].subtotal).toBe(55.0)
    expect(res.itemsConSubtotal[2].subtotal).toBe(100.0)
  })

  it('calcularTotalesPO maneja valores vacíos y negativos con seguridad', () => {
    const items = [
      { cantidad: -1, precioUnitario: 10, impuestos: 0 },
      { cantidad: 2, precioUnitario: -5, impuestos: -2 },
    ]
    const res = calcularTotalesPO(items, -10)
    expect(res.subtotal).toBe(0)
    expect(res.impuestos).toBe(0)
    expect(res.envio).toBe(0)
    expect(res.total).toBe(0)
  })

  it('constantes institucionales de USA configuran RGV Metal and Plastics CO. y Credit (Net 30)', () => {
    expect(DIRECCION_USA_DEFAULT).toBe('5423 Lovers Ln Brownsville, Texas 78526')
    expect(EMPRESA_USA_DEFAULT).toBe('RGV Metal and Plastics CO.')
    expect(TERMINOS_PAGO_DEFAULT).toBe('Credit (Net 30)')
    expect(TERMINOS_PAGO_USA_OPCIONES.some((o) => o.id === 'Credit (Net 30)')).toBe(true)
    expect(TERMINOS_PAGO_USA_OPCIONES.some((o) => o.id === 'Corporate Credit Card')).toBe(true)
    expect(TERMINOS_PAGO_USA_OPCIONES.some((o) => o.id === 'Wire Transfer / ACH')).toBe(true)
  })
})

describe('Esquemas de PO USA (lib/schemas)', () => {
  it('EstadoOrdenCompraUsaSchema valida todos los estados del flujo', () => {
    expect(EstadoOrdenCompraUsaSchema.parse('borrador')).toBe('borrador')
    expect(EstadoOrdenCompraUsaSchema.parse('enviada')).toBe('enviada')
    expect(EstadoOrdenCompraUsaSchema.parse('confirmada')).toBe('confirmada')
    expect(EstadoOrdenCompraUsaSchema.parse('recibida')).toBe('recibida')
    expect(EstadoOrdenCompraUsaSchema.parse('cancelada')).toBe('cancelada')
    expect(() => EstadoOrdenCompraUsaSchema.parse('invalido')).toThrow()
  })

  it('ItemOrdenCompraUsaSchema valida partidas válidas', () => {
    const item = {
      producto: '91290A115',
      descripcion: 'Alloy Steel Socket Head Screw 1/4-20',
      cantidad: 100,
      precioUnitario: 0.15,
      impuestos: 1.24,
      subtotal: 15.0,
      cuentaCargo: 'Stock',
      ordenTrabajo: 'OT-2026-001',
    }
    const parseado = ItemOrdenCompraUsaSchema.parse(item)
    expect(parseado.producto).toBe('91290A115')
    expect(parseado.subtotal).toBe(15.0)
  })

  it('OrdenCompraUsaSchema aplica defaults institucionales de RGV Metal and Plastics CO. y Crédito', () => {
    const rawPO = {
      id: 'po-123',
      folio: 'PO-2026-0001',
      proveedor: 'McMaster-Carr',
      fechaPedido: '2026-08-25',
      items: [
        {
          descripcion: 'Carbide End Mill 1/2"',
          cantidad: 2,
          precioUnitario: 45.0,
          subtotal: 90.0,
        },
      ],
      subtotal: 90.0,
      total: 90.0,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }

    const parseado = OrdenCompraUsaSchema.parse(rawPO)
    expect(parseado.shippingAddressUSA).toBe('5423 Lovers Ln Brownsville, Texas 78526')
    expect(parseado.moneda).toBe('USD')
    expect(parseado.estado).toBe('borrador')
    expect(parseado.empresa).toBe('RGV Metal and Plastics CO.')
    expect(parseado.terminosPago).toBe('Credit (Net 30)')
  })
})

describe('Roles y Módulos de PO USA (lib/roles)', () => {
  it('ruta de ordenes-compra está registrada', () => {
    expect(RUTA_POR_MODULO['ordenes-compra']).toBe('/ordenes-compra')
  })

  it('plantilla admin y compras incluyen ordenes-compra', () => {
    const adminModulos = modulosDePlantilla('admin')
    const comprasModulos = modulosDePlantilla('compras')

    expect(adminModulos).toContain('ordenes-compra')
    expect(comprasModulos).toContain('ordenes-compra')
    expect(tienePermiso(adminModulos, '/ordenes-compra')).toBe(true)
    expect(tienePermiso(comprasModulos, '/ordenes-compra')).toBe(true)
  })
})
