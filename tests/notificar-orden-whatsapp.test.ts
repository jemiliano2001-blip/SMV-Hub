import { describe, expect, it, vi } from 'vitest'
import { notificarOrdenPorWhatsApp } from '@/lib/notificar-orden-whatsapp'
import type { OrdenCompra } from '@/lib/schemas'

function orden(overrides: Partial<OrdenCompra> = {}): OrdenCompra {
  return {
    id: 'orden-1',
    proveedor: 'McMaster-Carr',
    numeroFactura: 'INV-100',
    fechaFactura: '2026-08-12',
    moneda: 'USD',
    subtotal: 100,
    impuestos: 8,
    envio: null,
    total: 108,
    estado: 'pendiente',
    requisitor: 'Ana',
    empresa: 'SMV',
    cuentaCargo: 'SO-100',
    ordenTrabajo: '',
    destino: 'SMV',
    items: [],
    creadoEn: new Date('2026-08-12T12:00:00.000Z'),
    actualizadoEn: new Date('2026-08-12T12:00:00.000Z'),
    ...overrides,
  }
}

describe('notificarOrdenPorWhatsApp', () => {
  it('abre WhatsApp con texto precargado y recupera la captura de una orden histórica', async () => {
    const ventana = { location: { href: '' } } as unknown as Pick<Window, 'location'>
    const abrirVentana = vi.fn(() => ventana)
    const copiarCaptura = vi.fn().mockResolvedValue({ estado: 'copiada' as const })

    const resultado = await notificarOrdenPorWhatsApp(orden({ imagenUrl: 'https://storage.example.com/factura.png' }), {
      abrirVentana,
      copiarCaptura,
    })

    expect(abrirVentana).toHaveBeenCalledWith('about:blank', '_blank')
    expect(copiarCaptura).toHaveBeenCalledWith('https://storage.example.com/factura.png')
    expect(resultado.ventanaAbierta).toBe(true)
    expect(resultado.captura).toEqual({ estado: 'copiada' })
    expect(ventana.location.href).toContain('https://api.whatsapp.com/send?text=')
    expect(decodeURIComponent(ventana.location.href)).toContain(
      'Buen día, se pidió material para SMV en McMaster-Carr por USD $108.00.'
    )
  })

  it('sigue abriendo WhatsApp con texto cuando la orden no tiene comprobante', async () => {
    const ventana = { location: { href: '' } } as unknown as Pick<Window, 'location'>
    const copiarCaptura = vi.fn().mockResolvedValue({
      estado: 'fallback' as const,
      motivo: 'sin-archivo' as const,
      mensaje: 'No hay comprobante.',
    })

    const resultado = await notificarOrdenPorWhatsApp(orden(), {
      abrirVentana: () => ventana,
      copiarCaptura,
    })

    expect(copiarCaptura).toHaveBeenCalledWith(undefined)
    expect(resultado.ventanaAbierta).toBe(true)
    expect(resultado.captura).toMatchObject({ motivo: 'sin-archivo' })
    expect(ventana.location.href).toContain('api.whatsapp.com/send?text=')
  })

  it('navega a WhatsApp sin esperar a que termine de recuperar la captura', async () => {
    const ventana = { location: { href: '' } } as unknown as Pick<Window, 'location'>
    let resolverCopia: ((resultado: { estado: 'copiada' }) => void) | undefined
    const copiaPendiente = new Promise<{ estado: 'copiada' }>((resolve) => {
      resolverCopia = resolve
    })

    const notificacion = notificarOrdenPorWhatsApp(orden(), {
      abrirVentana: () => ventana,
      copiarCaptura: () => copiaPendiente,
    })

    expect(ventana.location.href).toContain('api.whatsapp.com/send?text=')
    resolverCopia?.({ estado: 'copiada' })
    await expect(notificacion).resolves.toMatchObject({ ventanaAbierta: true, captura: { estado: 'copiada' } })
  })

  it('devuelve el enlace de respaldo cuando el navegador bloquea la ventana', async () => {
    const resultado = await notificarOrdenPorWhatsApp(orden(), {
      abrirVentana: () => null,
      copiarCaptura: async () => ({
        estado: 'fallback',
        motivo: 'sin-archivo',
        mensaje: 'No hay comprobante.',
      }),
    })

    expect(resultado.ventanaAbierta).toBe(false)
    expect(resultado.whatsappUrl).toContain('api.whatsapp.com/send?text=')
  })
})
