import { describe, it, expect } from 'vitest'
import {
  ProveedorSchema,
  CompraProveedorSchema,
} from '../lib/schemas'
import { PROVEEDORES_SEMILLA } from '../lib/proveedores'
import {
  COMPRAS_SEMILLA,
  COTIZACIONES_SEMILLA,
  calcularMetricasProveedor,
  calcularRankingCotizacion,
} from '../lib/proveedores-inteligencia'

describe('Módulo de Proveedores USA Tooling e Inteligencia de Compras', () => {
  it('incluye McMaster, Shars y MSC en el catálogo base de EE.UU.', () => {
    expect(PROVEEDORES_SEMILLA).toBeDefined()
    const nombres = PROVEEDORES_SEMILLA.map((proveedor) => proveedor.nombre)
    expect(nombres).toContain('McMaster-Carr')
    expect(nombres).toContain('Shars Tool Company')
    expect(nombres).toContain('MSC Industrial Direct')
  })

  it('valida todos los proveedores semilla contra ProveedorSchema', () => {
    PROVEEDORES_SEMILLA.forEach((prov, i) => {
      const mockDoc = {
        id: `semilla-${i}`,
        ...prov,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      }
      const res = ProveedorSchema.safeParse(mockDoc)
      expect(res.success).toBe(true)
    })
  })

  it('valida las compras históricas semilla contra CompraProveedorSchema', () => {
    COMPRAS_SEMILLA.forEach((compra, i) => {
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
    const mockCompras = COMPRAS_SEMILLA.map((c, i) => ({ id: `c-${i}`, ...c }))
    const metricas = calcularMetricasProveedor(mockCompras)
    expect(metricas.totalCompras).toBe(COMPRAS_SEMILLA.length)
    expect(metricas.gastoAcumulado).toBeGreaterThan(0)
    expect(metricas.ticketPromedio).toBeGreaterThan(0)
    expect(metricas.leadTimePromedio).toBeGreaterThan(0)
    expect(metricas.categoriasCompradas.length).toBeGreaterThan(0)
  })

  it('calcula el ranking de ofertas con puntuación transparente y asigna badges', () => {
    const cotizacionPrueba = COTIZACIONES_SEMILLA[0]
    const ranking = calcularRankingCotizacion(cotizacionPrueba.ofertas, {
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
