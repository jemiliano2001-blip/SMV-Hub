import { describe, it, expect } from 'vitest'
import {
  CompraProveedorSchema,
} from '../lib/schemas'
import {
  calcularMetricasProveedor,
  calcularRankingCotizacion,
} from '../lib/proveedores-inteligencia'
import type { NuevaCompraPayload } from '../lib/proveedores-inteligencia'
import type { OfertaCotizacion } from '../lib/schemas'

const COMPRAS_FIXTURE: NuevaCompraPayload[] = [
  {
    proveedorId: 'shars-tool',
    proveedorNombre: 'Shars Tool Company',
    numeroOrden: 'PO-TEST-001',
    fecha: '2026-06-15',
    producto: 'Endmill Carburo Sólido 1/2" 4 Gavilanes AlTiN',
    categoria: 'endmills',
    marca: 'Shars Grade A',
    cantidad: 10,
    precioUnitario: 24.5,
    moneda: 'USD',
    costoTotal: 245.0,
    leadTimeRealDias: 4,
    notas: '',
  },
  {
    proveedorId: 'yg1-usa',
    proveedorNombre: 'YG-1 USA Industrial Tooling',
    numeroOrden: 'PO-TEST-002',
    fecha: '2026-06-20',
    producto: 'Refrigerante Soluble Blaser Swisslube B-Cool 755',
    categoria: 'consumibles',
    marca: 'Blaser',
    cantidad: 2,
    precioUnitario: 165.0,
    moneda: 'USD',
    costoTotal: 330.0,
    leadTimeRealDias: 2,
    notas: '',
  },
]

const OFERTAS_FIXTURE: OfertaCotizacion[] = [
  {
    proveedorId: 'shars-tool',
    proveedorNombre: 'Shars Tool Company',
    precioUnitario: 24.5,
    moneda: 'USD',
    leadTimeDias: 4,
    MOQ: 1,
    marca: 'Shars Grade A',
    disponible: true,
    garantia: 'Reemplazo por defecto',
    enlace: '',
    notas: '',
    scoreCalculado: 0,
  },
  {
    proveedorId: 'onlinecarbide',
    proveedorNombre: 'OnlineCarbide',
    precioUnitario: 21.0,
    moneda: 'USD',
    leadTimeDias: 3,
    MOQ: 1,
    marca: 'OnlineCarbide Direct',
    disponible: true,
    garantia: 'Garantía de fábrica EE.UU.',
    enlace: '',
    notas: '',
    scoreCalculado: 0,
  },
  {
    proveedorId: 'yg1-usa',
    proveedorNombre: 'YG-1 USA Industrial Tooling',
    precioUnitario: 48.0,
    moneda: 'USD',
    leadTimeDias: 3,
    MOQ: 1,
    marca: 'YG-1 V7 Plus',
    disponible: true,
    garantia: 'Rendimiento industrial garantizado',
    enlace: '',
    notas: '',
    scoreCalculado: 0,
  },
]

describe('Módulo de Proveedores USA Tooling e Inteligencia de Compras', () => {
  it('valida compras contra CompraProveedorSchema', () => {
    COMPRAS_FIXTURE.forEach((compra, i) => {
      const mockDoc = {
        id: `compra-${i}`,
        ...compra,
        creadoEn: new Date().toISOString(),
      }
      const res = CompraProveedorSchema.safeParse(mockDoc)
      expect(res.success).toBe(true)
    })
  })

  it('calcula métricas acumuladas correctamente en calcularMetricasProveedor', () => {
    const mockCompras = COMPRAS_FIXTURE.map((c, i) => ({ id: `c-${i}`, ...c }))
    const metricas = calcularMetricasProveedor(mockCompras)
    expect(metricas.totalCompras).toBe(COMPRAS_FIXTURE.length)
    expect(metricas.gastoAcumulado).toBeGreaterThan(0)
    expect(metricas.ticketPromedio).toBeGreaterThan(0)
    expect(metricas.leadTimePromedio).toBeGreaterThan(0)
    expect(metricas.categoriasCompradas.length).toBeGreaterThan(0)
  })

  it('calcula el ranking de ofertas con puntuación transparente y asigna badges', () => {
    const ranking = calcularRankingCotizacion(OFERTAS_FIXTURE, {
      'shars-tool': 4.7,
      onlinecarbide: 4.9,
      'yg1-usa': 4.8,
    })

    expect(ranking.length).toBe(3)
    // Debe ordenar de mayor a menor puntuación total
    expect(ranking[0].scoreCalculado).toBeGreaterThanOrEqual(ranking[1].scoreCalculado)
    expect(ranking[1].scoreCalculado).toBeGreaterThanOrEqual(ranking[2].scoreCalculado)

    // La oferta con menor precio debe tener esMejorPrecio = true
    const ofertaBarata = ranking.find((r) => r.precioUnitario === 21.0)
    expect(ofertaBarata?.esMejorPrecio).toBe(true)

    // La oferta ganadora del ranking global debe tener esMejorBalance = true
    expect(ranking[0].esMejorBalance).toBe(true)
  })
})
