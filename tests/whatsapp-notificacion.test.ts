import { describe, expect, it, vi } from 'vitest'
import { copiarCapturaWhatsApp } from '@/lib/whatsapp-notificacion'

const ItemPortapapelesFalso = class {
  constructor(readonly items: Record<string, Blob | Promise<Blob>>) {}
} as unknown as typeof ClipboardItem
type ItemPortapapelesFalsoInstancia = { items: Record<string, Blob | Promise<Blob>> }

function archivo(nombre: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], nombre, { type })
}

describe('copiarCapturaWhatsApp', () => {
  it('copia un PNG sin convertirlo y deja Ctrl+V disponible para la imagen', async () => {
    const write = vi.fn<Clipboard['write']>().mockResolvedValue()
    const captura = archivo('factura.png', 'image/png')

    const resultado = await copiarCapturaWhatsApp(captura, {
      clipboard: { write },
      ClipboardItem: ItemPortapapelesFalso,
    })

    expect(resultado).toEqual({ estado: 'copiada' })
    expect(write).toHaveBeenCalledTimes(1)
    const item = write.mock.calls[0][0][0] as unknown as ItemPortapapelesFalsoInstancia
    expect(item.items['image/png']).toBe(captura)
  })

  it('convierte una captura JPEG a PNG antes de escribirla', async () => {
    const write = vi.fn<Clipboard['write']>().mockResolvedValue()
    const drawImage = vi.fn()
    const close = vi.fn()
    const png = new Blob(['png'], { type: 'image/png' })

    const resultado = await copiarCapturaWhatsApp(archivo('factura.jpg', 'image/jpeg'), {
      clipboard: { write },
      ClipboardItem: ItemPortapapelesFalso,
      crearBitmap: async () => ({ width: 20, height: 10, close }),
      crearCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
        toBlob: (callback) => callback(png),
      }),
    })

    expect(resultado).toEqual({ estado: 'copiada' })
    expect(drawImage).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    const item = write.mock.calls[0][0][0] as unknown as ItemPortapapelesFalsoInstancia
    await expect(item.items['image/png']).resolves.toBe(png)
  })

  it('indica fallback cuando no hay captura o es un PDF', async () => {
    await expect(copiarCapturaWhatsApp(undefined)).resolves.toMatchObject({
      estado: 'fallback',
      motivo: 'sin-archivo',
    })
    await expect(copiarCapturaWhatsApp(archivo('factura.pdf', 'application/pdf'))).resolves.toMatchObject({
      estado: 'fallback',
      motivo: 'archivo-no-imagen',
    })
  })

  it('indica fallback cuando el navegador no expone la API de portapapeles', async () => {
    const navigatorOriginal = globalThis.navigator
    const clipboardItemOriginal = globalThis.ClipboardItem
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('ClipboardItem', undefined)

    await expect(copiarCapturaWhatsApp(archivo('factura.png', 'image/png'))).resolves.toMatchObject({
      estado: 'fallback',
      motivo: 'api-no-disponible',
    })

    vi.stubGlobal('navigator', navigatorOriginal)
    vi.stubGlobal('ClipboardItem', clipboardItemOriginal)
  })

  it('indica fallback cuando el navegador deniega el portapapeles', async () => {
    const write = vi.fn<Clipboard['write']>().mockRejectedValue(new Error('NotAllowedError'))

    await expect(
      copiarCapturaWhatsApp(archivo('factura.png', 'image/png'), {
        clipboard: { write },
        ClipboardItem: ItemPortapapelesFalso,
      })
    ).resolves.toMatchObject({
      estado: 'fallback',
      motivo: 'permiso-denegado',
    })
  })

  it('indica fallback cuando falla la conversión solicitada dentro de ClipboardItem', async () => {
    const write = vi.fn(async (items: ClipboardItem[]) => {
      const item = items[0] as unknown as ItemPortapapelesFalsoInstancia
      await item.items['image/png']
    })

    await expect(
      copiarCapturaWhatsApp(archivo('factura.jpg', 'image/jpeg'), {
        clipboard: { write },
        ClipboardItem: ItemPortapapelesFalso,
        crearBitmap: async () => ({ width: 1, height: 1 }),
        crearCanvas: () => ({
          width: 0,
          height: 0,
          getContext: () => null,
          toBlob: () => undefined,
        }),
      })
    ).resolves.toMatchObject({
      estado: 'fallback',
      motivo: 'conversion-fallida',
    })
  })
})
