import { describe, it, expect } from 'vitest'
import {
  generarBufferExcelOrden,
  nombreArchivoOrdenExcel,
  sanitizarNombreArchivo,
  generarBufferExcelLoteOrdenes,
} from '@/lib/orden-excel-export'
import type { OrdenCompra } from '@/lib/schemas'
import ExcelJS from 'exceljs'

describe('orden-excel-export', () => {
  const ordenMock: OrdenCompra = {
    id: 'EA1mAQuKzDJlzdxFMwhg',
    proveedor: 'EBAY',
    numeroFactura: '25-15113-26620',
    fechaFactura: '2026-09-08',
    moneda: 'USD',
    subtotal: 27.88,
    envio: 6.0,
    impuestos: 2.8,
    total: 36.68,
    estado: 'pendiente',
    estadoRecepcion: 'pendiente',
    requisitor: 'PANTOJA',
    empresa: 'SMV',
    destino: 'SMV',
    cuentaCargo: 'Stock',
    ordenTrabajo: '',
    items: [
      {
        descripcion: '1PC New SMC CDUJB10-6DM Cylinder Free Shipping',
        descripcionSimplificada: 'Cilindro SMC',
        cantidad: 1,
        precioUnitario: 27.88,
        total: 27.88,
        claveProdServ: '14121702',
        satPendiente: false,
        empresa: 'SMV',
        cuentaCargo: 'Stock',
        requisitor: 'PANTOJA',
        ordenTrabajo: '',
      },
    ],
    creadoEn: new Date('2026-09-08T10:00:00Z'),
    actualizadoEn: new Date('2026-09-08T10:00:00Z'),
  }

  it('sanitiza nombres de archivo correctamente', () => {
    expect(sanitizarNombreArchivo('EBAY / US:2026*?')).toBe('EBAY___US_2026__')
  })

  it('genera un nombre de archivo contextual formal', () => {
    const nombre = nombreArchivoOrdenExcel(ordenMock)
    expect(nombre).toBe('OC_EBAY_25-15113-26620_USD.xlsx')
  })

  it('genera un buffer Excel formal con membrete y datos de orden', async () => {
    const buffer = await generarBufferExcelOrden(ordenMock)
    expect(buffer).toBeDefined()
    expect(buffer.byteLength).toBeGreaterThan(1000)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    const sheet = wb.worksheets[0]
    expect(sheet).toBeDefined()
    expect(sheet.getCell('A1').value).toBe('SMV MAQUINADOS — ORDEN DE COMPRA')

    // Metadatos
    expect(sheet.getCell('B4').value).toBe('EBAY')
    expect(sheet.getCell('E4').value).toBe('PANTOJA')
    expect(sheet.getCell('B5').value).toBe('25-15113-26620')
    expect(sheet.getCell('J4').value).toBe('USD')

    // Headers de partidas en fila 8
    expect(sheet.getCell('A8').value).toBe('#')
    expect(sheet.getCell('B8').value).toBe('Descripción')
    expect(sheet.getCell('C8').value).toBe('Clave SAT')
    expect(sheet.getCell('H8').value).toBe('Cant.')
    expect(sheet.getCell('J8').value).toBe('Total (USD)')

    // Fila 9: partida 1
    expect(sheet.getCell('A9').value).toBe(1)
    expect(sheet.getCell('B9').value).toContain('SMC CDUJB10-6DM')
    expect(sheet.getCell('C9').value).toBe('14121702')
    expect(sheet.getCell('H9').value).toBe(1)
    expect(sheet.getCell('I9').value).toBe(27.88)
    expect(sheet.getCell('J9').value).toBe(27.88)

    // Los montos son numéricos, no strings formateados
    expect(typeof sheet.getCell('J9').value).toBe('number')
  })

  it('maneja órdenes sin partidas explícitas creando una partida general de respaldo', async () => {
    const ordenSinItems: OrdenCompra = {
      ...ordenMock,
      id: 'ORD-VACIA',
      items: [],
      subtotal: 100,
      total: 100,
    }

    const buffer = await generarBufferExcelOrden(ordenSinItems)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    const sheet = wb.worksheets[0]
    expect(sheet.getCell('B9').value).toContain('EBAY')
    expect(sheet.getCell('J9').value).toBe(100)
  })

  it('genera un consolidado de lote de órdenes de compra', async () => {
    const buffer = await generarBufferExcelLoteOrdenes([ordenMock])
    expect(buffer).toBeDefined()
    expect(buffer.byteLength).toBeGreaterThan(1000)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
    const sheet = wb.getWorksheet('Órdenes de Compra')
    expect(sheet).toBeDefined()
    expect(sheet?.getCell('A1').value).toContain('CONSOLIDADO DE ÓRDENES DE COMPRA')
    expect(sheet?.getCell('D5').value).toBe('EBAY')
  })
})
