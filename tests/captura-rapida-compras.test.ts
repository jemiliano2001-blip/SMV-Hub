import { describe, it, expect } from 'vitest'
import {
  calcularTotalPartida,
  calcularSubtotalFactura,
  calcularTotalFactura,
  mapearPartnerAEmpresa,
  extraerPoClienteDeSo,
  EMPRESAS_FRECUENTES,
  REQUISITORES_FRECUENTES,
} from '@/lib/captura-rapida-compras'

describe('captura-rapida-compras: cálculos automáticos', () => {
  it('calcula el total de partida multiplicando cantidad por precio unitario con 2 decimales', () => {
    expect(calcularTotalPartida(3, 101)).toBe(303)
    expect(calcularTotalPartida('3', '65.5')).toBe(196.5)
    expect(calcularTotalPartida(10, 3.936)).toBe(39.36)
    expect(calcularTotalPartida('', 50)).toBeNull()
    expect(calcularTotalPartida(5, '')).toBeNull()
    expect(calcularTotalPartida(null, null)).toBeNull()
  })

  it('calcula el subtotal de factura sumando todas las partidas', () => {
    const partidas = [
      { total: 303 },
      { total: 65.5 },
      { total: '40.25' },
    ]
    expect(calcularSubtotalFactura(partidas)).toBe(408.75)
  })

  it('devuelve null si ninguna partida tiene total válido', () => {
    expect(calcularSubtotalFactura([])).toBeNull()
    expect(calcularSubtotalFactura([{ total: '' }, { total: null }])).toBeNull()
  })

  it('calcula el total de la factura sumando subtotal, envío e impuestos', () => {
    expect(calcularTotalFactura(408.75, 15.00, 34.95)).toBe(458.7)
    expect(calcularTotalFactura(100, null, null)).toBe(100)
    expect(calcularTotalFactura('100', '10', '8.25')).toBe(118.25)
    expect(calcularTotalFactura(null, null, null)).toBeNull()
  })
})

describe('captura-rapida-compras: mapeo y constantes', () => {
  it('mapea correctamente nombres de partners de Odoo a empresas SMV', () => {
    expect(mapearPartnerAEmpresa('SUPRAJIT MEXICO')).toBe('SUPRAJIT')
    expect(mapearPartnerAEmpresa('OHD OPERATORS DE MEXICO')).toBe('OHD')
    expect(mapearPartnerAEmpresa('SENSATA TECHNOLOGIES INC')).toBe('SENSATA')
    expect(mapearPartnerAEmpresa('AFX INDUSTRIES')).toBe('AFX')
    expect(mapearPartnerAEmpresa('SILICONE TECHNOLOGIES')).toBe('SILTECH')
    expect(mapearPartnerAEmpresa('KOHLER REYNOSA')).toBe('KOHLER')
    expect(mapearPartnerAEmpresa('SMV Maquinados')).toBe('SMV')
    expect(mapearPartnerAEmpresa('Cliente Desconocido')).toBe('Cliente Desconocido')
    expect(mapearPartnerAEmpresa(null)).toBe('')
  })

  it('extrae la orden de compra / PO del cliente desde la SO de Odoo', () => {
    expect(extraerPoClienteDeSo({ ordenCompra: '00089165', clientOrderRef: null })).toBe('00089165')
    expect(extraerPoClienteDeSo({ ordenCompra: null, clientOrderRef: 'PO-9988' })).toBe('PO-9988')
    expect(extraerPoClienteDeSo(null)).toBe('')
  })

  it('incluye SMV como empresa propia con cuenta cargo default Stock', () => {
    const smv = EMPRESAS_FRECUENTES.find((e) => e.codigo === 'SMV')
    expect(smv).toBeDefined()
    expect(smv?.esPropia).toBe(true)
    expect(smv?.cuentaCargoDefault).toBe('Stock')
  })

  it('incluye a los principales requisitores históricos analizados', () => {
    expect(REQUISITORES_FRECUENTES).toContain('Francisco')
    expect(REQUISITORES_FRECUENTES).toContain('Chava')
    expect(REQUISITORES_FRECUENTES).toContain('Oscar')
    expect(REQUISITORES_FRECUENTES).toContain('Pantoja')
  })
})
