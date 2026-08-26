import { describe, it, expect, vi } from 'vitest'
import { exportarHistorialOdooExcel } from '@/lib/compras-odoo-export'
import type { RegistroCotizacionOdoo } from '@/lib/schemas'

// Mock de excel-export-base para probar la llamada sin efectos de navegador
vi.mock('@/lib/excel-export-base', async () => {
  const actual = await vi.importActual<typeof import('@/lib/excel-export-base')>('@/lib/excel-export-base')
  return {
    ...actual,
    descargarExcelEnNavegador: vi.fn(),
  }
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
})
