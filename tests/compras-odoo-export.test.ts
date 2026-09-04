import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
  exportarHistorialOdooExcel,
  sumarTotalesPorMoneda,
  sumarSubtotalesPartidasPorMoneda,
  valorExcelSinMezclarMonedas,
} from '@/lib/compras-odoo-export'
import type { RegistroCotizacionOdoo } from '@/lib/schemas'

function registroBase(
  overrides: Partial<RegistroCotizacionOdoo> & Pick<RegistroCotizacionOdoo, 'id' | 'odooName' | 'moneda' | 'total'>
): RegistroCotizacionOdoo {
  return {
    odooId: 101,
    odooState: 'draft',
    proveedor: 'PROTOSA',
    proveedorId: 42,
    referenciaProveedor: 'COT-999',
    fecha: '2026-08-26',
    fechaRecepcion: '2026-08-28',
    notas: null,
    totalUntaxed: overrides.total,
    totalTax: 0,
    itemsCount: 1,
    partidas: [
      {
        id: `${overrides.id}-p1`,
        partida: 1,
        clave: 'SKU-001',
        descripcion: 'Inserto de carburo',
        cantidad: 1,
        udm: 'Pieza',
        precioUnitario: overrides.total,
        impuesto: 'IVA 16%',
        tasaIva: 0.16,
        subtotal: overrides.total,
        requisitor: 'Pablo',
        empresa: 'Taller',
        uso: 'General',
        ordenTrabajo: '2026/S01641',
        ordenTrabajoId: 99,
      },
    ],
    creadoPorUid: 'uid-1',
    creadoPorEmail: 'admin@smv.mx',
    creadoPorNombre: 'Admin SMV',
    creadoEn: new Date('2026-08-26T10:00:00Z'),
    actualizadoEn: new Date('2026-08-26T10:00:00Z'),
    ...overrides,
  }
}

// Mock de excel-export-base para probar la llamada sin efectos de navegador
vi.mock('@/lib/excel-export-base', async () => {
  const actual = await vi.importActual<typeof import('@/lib/excel-export-base')>('@/lib/excel-export-base')
  return {
    ...actual,
    descargarExcelEnNavegador: vi.fn(),
  }
})

describe('totales por moneda (sin mezclar MXN y USD)', () => {
  it('separa MXN y USD y nunca devuelve la suma cruzada', () => {
    const totales = sumarTotalesPorMoneda([
      { moneda: 'MXN', total: 1160 },
      { moneda: 'USD', total: 250 },
      { moneda: 'MXN', total: 40 },
    ])
    expect(totales).toEqual({ mxn: 1200, usd: 250 })
    expect(valorExcelSinMezclarMonedas(totales)).toBe('MXN 1200.00 · USD 250.00')
    expect(valorExcelSinMezclarMonedas(totales)).not.toBe(1450)
  })

  it('devuelve el número de la única moneda cuando el lote es homogéneo', () => {
    expect(valorExcelSinMezclarMonedas(sumarTotalesPorMoneda([{ moneda: 'USD', total: 250 }]))).toBe(250)
    expect(valorExcelSinMezclarMonedas(sumarTotalesPorMoneda([{ moneda: 'MXN', total: 1160 }]))).toBe(1160)
  })

  it('agrupa subtotales de partidas por la moneda del documento padre', () => {
    const subtotales = sumarSubtotalesPartidasPorMoneda([
      {
        moneda: 'MXN',
        partidas: [{ subtotal: 1000 }, { subtotal: 160 }],
      },
      {
        moneda: 'USD',
        partidas: [{ subtotal: 250 }],
      },
    ])
    expect(subtotales).toEqual({ mxn: 1160, usd: 250 })
    expect(valorExcelSinMezclarMonedas(subtotales)).not.toBe(1410)
  })
})

describe('compras-odoo-export', () => {
  it('no genera descarga si el arreglo de registros está vacío', async () => {
    const { descargarExcelEnNavegador } = await import('@/lib/excel-export-base')
    await exportarHistorialOdooExcel([])
    expect(descargarExcelEnNavegador).not.toHaveBeenCalled()
  })

  it('construye y descarga el Excel formal con datos de cotización y partidas', async () => {
    const { descargarExcelEnNavegador } = await import('@/lib/excel-export-base')
    vi.clearAllMocks()

    const mockRegistros: RegistroCotizacionOdoo[] = [
      {
        id: 'cot-1',
        odooId: 101,
        odooName: 'P00101',
        odooState: 'draft',
        proveedor: 'PROTOSA',
        proveedorId: 42,
        referenciaProveedor: 'COT-999',
        moneda: 'MXN',
        fecha: '2026-08-26',
        fechaRecepcion: '2026-08-28',
        notas: 'Entrega urgente en taller',
        totalUntaxed: 1000,
        totalTax: 160,
        total: 1160,
        itemsCount: 1,
        partidas: [
          {
            id: 'p-1',
            partida: 1,
            clave: 'SKU-001',
            descripcion: 'Inserto de carburo',
            cantidad: 5,
            udm: 'Pieza',
            precioUnitario: 200,
            impuesto: 'IVA 16%',
            tasaIva: 0.16,
            subtotal: 1000,
            requisitor: 'Pablo',
            empresa: 'Taller',
            uso: 'General',
            ordenTrabajo: '2026/S01641',
            ordenTrabajoId: 99,
          },
        ],
        creadoPorUid: 'uid-1',
        creadoPorEmail: 'admin@smv.mx',
        creadoPorNombre: 'Admin SMV',
        creadoEn: new Date('2026-08-26T10:00:00Z'),
        actualizadoEn: new Date('2026-08-26T10:00:00Z'),
      },
    ]

    await exportarHistorialOdooExcel(mockRegistros, { moneda: 'MXN', periodo: 'mes' })

    expect(descargarExcelEnNavegador).toHaveBeenCalledTimes(1)
    const [buffer, filename] = vi.mocked(descargarExcelEnNavegador).mock.calls[0]
    expect(buffer).toBeDefined()
    expect(filename).toMatch(/^Cotizaciones_Odoo_SMV_\d{4}-\d{2}-\d{2}\.xlsx$/)
  })

  it('no suma MXN y USD en la fila de totales del Excel (ni en el resumen ni en partidas)', async () => {
    const { descargarExcelEnNavegador } = await import('@/lib/excel-export-base')
    vi.clearAllMocks()

    const registros: RegistroCotizacionOdoo[] = [
      registroBase({ id: 'cot-mxn', odooName: 'P00101', odooId: 101, moneda: 'MXN', total: 1160 }),
      registroBase({ id: 'cot-usd', odooName: 'P00102', odooId: 102, moneda: 'USD', total: 250, proveedor: 'McMaster-Carr' }),
    ]
    const mezclaProhibida = 1160 + 250

    await exportarHistorialOdooExcel(registros)

    const [buffer] = vi.mocked(descargarExcelEnNavegador).mock.calls[0]
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as ArrayBuffer)

    const resumen = workbook.getWorksheet('Cotizaciones Odoo')
    expect(resumen).toBeDefined()
    const valoresResumen: Array<string | number> = []
    resumen!.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'number' || typeof cell.value === 'string') {
          valoresResumen.push(cell.value)
        }
      })
    })
    expect(valoresResumen).not.toContain(mezclaProhibida)
    expect(valoresResumen.some((v) => typeof v === 'string' && v.includes('MXN') && v.includes('USD'))).toBe(true)

    const partidas = workbook.getWorksheet('Partidas Detalladas')
    expect(partidas).toBeDefined()
    const valoresPartidas: Array<string | number> = []
    partidas!.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'number' || typeof cell.value === 'string') {
          valoresPartidas.push(cell.value)
        }
      })
    })
    expect(valoresPartidas).not.toContain(mezclaProhibida)
  })
})
