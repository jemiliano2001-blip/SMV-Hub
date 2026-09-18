import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ChipMemoriaOperativa from '@/components/memoria/ChipMemoriaOperativa'
import type { ContextoOperativo } from '@/lib/services/memoria-operativa'

const mockContextoBase: ContextoOperativo = {
  indice: 0,
  llavePieza: 'tornillo-1-4',
  numerosParte: ['91251A123'],
  comprasPrevias: [
    {
      fuente: 'orden-item',
      refId: 'ord-1#0',
      refPath: 'ordenes/ord-1',
      titulo: 'Tornillo 1/4 industrial',
      proveedorNombre: 'McMaster-Carr',
      proveedorId: 'prov-mcmaster',
      precioUnitario: 12.5,
      moneda: 'USD',
      fecha: '2026-07-01',
      empate: 'exacto',
      score: 1.0,
      numeroParte: '91251A123',
      ubicacion: null,
      estatus: null,
    },
  ],
  cotizacionesPrevias: [],
  totalExactos: 1,
  totalParecidos: 0,
  familiaComprada: null,
  alertaPrecio: null,
  proveedorPreferido: {
    proveedorNombre: 'McMaster-Carr',
    proveedorId: 'prov-mcmaster',
    veces: 1,
  },
  claveSatValidada: {
    claveProdServ: '31161500',
    descripcionSat: 'Tornillos',
    confianza: 'alta',
  },
  familia: null,
}

describe('ChipMemoriaOperativa', () => {
  it('no renderiza nada si no hay coincidencias', () => {
    const html = renderToStaticMarkup(
      <ChipMemoriaOperativa
        contexto={{
          ...mockContextoBase,
          totalExactos: 0,
          totalParecidos: 0,
          comprasPrevias: [],
          cotizacionesPrevias: [],
          familiaComprada: null,
        }}
      />
    )
    expect(html).toBe('')
  })

  it('muestra indicador de carga cuando cargando=true', () => {
    const html = renderToStaticMarkup(<ChipMemoriaOperativa cargando={true} />)
    expect(html).toContain('Consultando historial')
  })

  it('renderiza resumen de compras previas con proveedor', () => {
    const html = renderToStaticMarkup(
      <ChipMemoriaOperativa
        contexto={mockContextoBase}
        verPrecios={false}
      />
    )
    expect(html).toContain('Comprado antes (1x)')
    expect(html).toContain('McMaster-Carr')
    // No debe mostrar el precio si verPrecios es false
    expect(html).not.toContain('$12.50')
  })

  it('muestra el precio de referencia cuando verPrecios=true', () => {
    const html = renderToStaticMarkup(
      <ChipMemoriaOperativa
        contexto={mockContextoBase}
        verPrecios={true}
      />
    )
    expect(html).toContain('12.50')
  })

  it('muestra alerta de precio si el precio actual es más caro', () => {
    const html = renderToStaticMarkup(
      <ChipMemoriaOperativa
        contexto={{
          ...mockContextoBase,
          alertaPrecio: {
            tipo: 'caro',
            mensaje: 'Más caro que la última compra ($15.00 vs $12.50)',
            precioActualUSD: 15,
            precioMinHistoricoUSD: 12.5,
            desviacionPct: 0.2,
          },
        }}
        verPrecios={true}
      />
    )
    expect(html).toContain('Más caro')
  })
})

