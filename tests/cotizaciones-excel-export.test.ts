import { describe, it, expect } from 'vitest'
import {
  agruparCotizaciones,
  generarBufferExcelCotizaciones,
} from '@/lib/cotizaciones-excel-export'
import type { Cotizacion } from '@/lib/schemas'
import ExcelJS from 'exceljs'

describe('cotizaciones-excel-export', () => {
  const cotizacionesMock: Cotizacion[] = [
    {
      id: 'COT-1',
      solicitante: 'PANTOJA',
      fecha: '2026-09-08',
      estatus: 'cotizado',
      ubicacion: 'USA',
      proveedor: 'EBAY',
      descripcion: '1PC New SMC CDUJB10-6DM Cylinder',
      numeroParte: 'CDUJB10-6DM',
      cantidad: 2,
      precioUnitario: 27.88,
      moneda: 'USD',
      total: 55.76,
      diasHabiles: '3-5 días',
      link: 'https://ebay.com/itm/123',
      notas: 'Entrega estándar',
      origen: 'cotizacion',
      creadoEn: new Date('2026-09-08T10:00:00Z'),
      actualizadoEn: new Date('2026-09-08T10:00:00Z'),
    },
    {
      id: 'COT-2',
      solicitante: 'FRANCISCO',
      fecha: '2026-09-08',
      estatus: 'cotizado',
      ubicacion: 'MX',
      proveedor: 'Almacén Automatización',
      descripcion: '2711P-T10C22D9P PanelView Plus 7',
      numeroParte: '2711P-T10C22D9P',
      cantidad: 1,
      precioUnitario: 57627.5,
      moneda: 'MXN',
      total: 57627.5,
      diasHabiles: 'Inmediato',
      link: null,
      notas: 'En existencia',
      origen: 'compra',
      creadoEn: new Date('2026-09-08T10:00:00Z'),
      actualizadoEn: new Date('2026-09-08T10:00:00Z'),
    },
    {
      id: 'COT-3',
      solicitante: 'PANTOJA',
      fecha: '2026-09-08',
      estatus: 'cotizado',
      ubicacion: 'USA',
      proveedor: 'EBAY',
      descripcion: 'SMC Mounting Bracket',
      numeroParte: 'BRK-01',
      cantidad: 4,
      precioUnitario: 10.0,
      moneda: 'USD',
      total: 40.0,
      diasHabiles: '3 días',
      link: null,
      notas: null,
      origen: 'cotizacion',
      creadoEn: new Date('2026-09-08T10:00:00Z'),
      actualizadoEn: new Date('2026-09-08T10:00:00Z'),
    },
  ]

  it('agrupa cotizaciones por proveedor y suma subtotales por moneda', () => {
    const grupos = agruparCotizaciones(cotizacionesMock, 'proveedor')
    expect(grupos).toHaveLength(2)

    const grupoEbay = grupos.find((g) => g.nombre === 'EBAY')
    expect(grupoEbay).toBeDefined()
    expect(grupoEbay?.items).toHaveLength(2)
    expect(grupoEbay?.totalUSD).toBe(95.76)
    expect(grupoEbay?.totalMXN).toBe(0)

    const grupoAlmacen = grupos.find((g) => g.nombre === 'Almacén Automatización')
    expect(grupoAlmacen).toBeDefined()
    expect(grupoAlmacen?.items).toHaveLength(1)
    expect(grupoAlmacen?.totalMXN).toBe(57627.5)
  })

  it('agrupa cotizaciones por solicitante', () => {
    const grupos = agruparCotizaciones(cotizacionesMock, 'solicitante')
    expect(grupos).toHaveLength(2)
    const pantoja = grupos.find((g) => g.nombre === 'PANTOJA')
    expect(pantoja?.items).toHaveLength(2)
    const francisco = grupos.find((g) => g.nombre === 'FRANCISCO')
    expect(francisco?.items).toHaveLength(1)
  })

  it('agrupa cotizaciones por ubicación / moneda', () => {
    const grupos = agruparCotizaciones(cotizacionesMock, 'ubicacion')
    expect(grupos).toHaveLength(2)
    const usa = grupos.find((g) => g.nombre.includes('EUA'))
    expect(usa?.items).toHaveLength(2)
    const mx = grupos.find((g) => g.nombre.includes('México'))
    expect(mx?.items).toHaveLength(1)
  })

  it('genera un workbook formal con hojas separadas por grupo', async () => {
    const buffer = await generarBufferExcelCotizaciones({
      cotizaciones: cotizacionesMock,
      criterioAgrupacion: 'proveedor',
      estructura: 'hojas_separadas',
      nombreProyecto: 'Proyecto Celda Robot',
    })

    expect(buffer).toBeDefined()
    expect(buffer.byteLength).toBeGreaterThan(1000)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    // Debe contener la hoja de Resumen y las hojas por proveedor
    expect(wb.worksheets.map((w) => w.name)).toContain('Resumen de Grupos')
    expect(wb.worksheets.map((w) => w.name)).toContain('EBAY')

    const sheetEbay = wb.getWorksheet('EBAY')
    expect(sheetEbay).toBeDefined()
    expect(sheetEbay?.getCell('A1').value).toContain('COTIZACIÓN: EBAY')
    expect(sheetEbay?.getCell('D5').value).toContain('SMC CDUJB10-6DM')
    expect(sheetEbay?.getCell('I5').value).toBe(27.88)
    expect(typeof sheetEbay?.getCell('I5').value).toBe('number')
  })

  it('genera un workbook formal con estructura de una sola hoja con secciones agrupadas', async () => {
    const buffer = await generarBufferExcelCotizaciones({
      cotizaciones: cotizacionesMock,
      criterioAgrupacion: 'proveedor',
      estructura: 'una_hoja',
      nombreProyecto: 'Cotizaciones Varias',
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    const sheet = wb.getWorksheet('Cotizaciones Agrupadas')
    expect(sheet).toBeDefined()
    expect(sheet?.getCell('A1').value).toContain('COTIZACIÓN: COTIZACIONES VARIAS')
  })
})
