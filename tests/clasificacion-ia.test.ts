import { describe, expect, it } from 'vitest'
import {
  resolverCategoriaProducto,
} from '@/lib/compras-odoo/categorias-registro'
import {
  normalizarDescripcionMapeo,
  buscarMapeoAprobado,
  aplicarMapeosAprobados,
  type MapeoClasificacionAprobado,
} from '@/lib/compras-odoo/mapeos-clasificacion'
import type { CompraOdooItemNormalizado } from '@/lib/compras-odoo/construir-item'

describe('resolverCategoriaProducto con odooCategoria y keywords', () => {
  it('clasifica por odooCategoria si coincide con patrones', () => {
    const cat = resolverCategoriaProducto({
      descripcion: 'Material genérico 123',
      odooCategoria: 'Compras / Metal / Aceros',
    })
    expect(cat).toBe('metals')
  })

  it('clasifica herramientas por odooCategoria', () => {
    const cat = resolverCategoriaProducto({
      descripcion: 'Item sin keyword clara',
      odooCategoria: 'Tooling & Consumibles',
    })
    expect(cat).toBe('tools')
  })

  it('clasifica solera y redondo de acero como metals por keyword', () => {
    const cat1 = resolverCategoriaProducto({ descripcion: 'Solera de acero 1/4 x 2' })
    expect(cat1).toBe('metals')

    const cat2 = resolverCategoriaProducto({ descripcion: 'Redondo de aluminio 6061' })
    expect(cat2).toBe('metals')
  })
})

describe('mapeos-clasificacion', () => {
  it('normaliza descripciones correctamente', () => {
    const norm = normalizarDescripcionMapeo('  SOLERA DE ACERO 1/4" X 2"  ')
    expect(norm).toBe('solera de acero 1 4 x 2')
  })

  it('encuentra mapeo aprobado por coincidencia exacta o parcial', () => {
    const mapeos: MapeoClasificacionAprobado[] = [
      {
        id: 'map_1',
        descripcionNormalizada: 'solera de acero 1 4 x 2',
        descripcionEjemplo: 'Solera de acero 1/4 x 2',
        categoriaId: 'metals',
        tipoInsumo: 'acero_1018',
        medida: '1/4 x 2',
        aprobadoPor: 'test@smv.com',
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      },
    ]

    const encontrado = buscarMapeoAprobado('Solera de Acero 1/4" x 2"', mapeos)
    expect(encontrado).not.toBeNull()
    expect(encontrado?.categoriaId).toBe('metals')
    expect(encontrado?.tipoInsumo).toBe('acero_1018')
  })

  it('separa aplicados y pendientes en aplicarMapeosAprobados', () => {
    const mapeos: MapeoClasificacionAprobado[] = [
      {
        id: 'map_1',
        descripcionNormalizada: 'broca de carburo 1 2',
        descripcionEjemplo: 'Broca de carburo 1/2',
        categoriaId: 'tools',
        tipoInsumo: 'broca',
        medida: '1/2',
        aprobadoPor: 'test@smv.com',
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      },
    ]

    const items: CompraOdooItemNormalizado[] = [
      {
        id: '1',
        llaveItem: 'k1',
        fuente: 'po',
        odooDocId: 1,
        odooLineId: 1,
        referenciaDoc: 'PO001',
        origenPo: null,
        descripcion: 'Broca de carburo 1/2',
        cantidad: 1,
        precioUnitario: 10,
        subtotal: 10,
        moneda: 'MXN',
        fecha: '2026-07-20',
        odooPartnerId: 10,
        proveedorNombre: 'Prov 1',
        productOdooId: 100,
        claveProdServ: null,
        satPendiente: true,
        categoriaId: 'otros',
        tipoMetal: null,
        tipoInsumo: null,
        medida: null,
        unidad: null,
        esRfq: false,
        origen: 'odoo',
        odooCategoria: null,
        odooUom: null,
        odooCostoEstandar: null,
        odooRefInterna: null,
        clasificadoPorIa: false,
      },
      {
        id: '2',
        llaveItem: 'k2',
        fuente: 'po',
        odooDocId: 1,
        odooLineId: 2,
        referenciaDoc: 'PO001',
        origenPo: null,
        descripcion: 'Producto Raro Desconocido XYZ',
        cantidad: 1,
        precioUnitario: 50,
        subtotal: 50,
        moneda: 'MXN',
        fecha: '2026-07-20',
        odooPartnerId: 10,
        proveedorNombre: 'Prov 1',
        productOdooId: 101,
        claveProdServ: null,
        satPendiente: true,
        categoriaId: 'otros',
        tipoMetal: null,
        tipoInsumo: null,
        medida: null,
        unidad: null,
        esRfq: false,
        origen: 'odoo',
        odooCategoria: null,
        odooUom: null,
        odooCostoEstandar: null,
        odooRefInterna: null,
        clasificadoPorIa: false,
      },
    ]

    const res = aplicarMapeosAprobados(items, mapeos)
    expect(res.aplicados).toHaveLength(1)
    expect(res.aplicados[0].item.id).toBe('1')
    expect(res.pendientes).toHaveLength(1)
    expect(res.pendientes[0].id).toBe('2')
  })
})
