export type MotivoCopiaImagenWhatsApp =
  | 'sin-archivo'
  | 'archivo-no-imagen'
  | 'api-no-disponible'
  | 'conversion-no-disponible'
  | 'conversion-fallida'
  | 'permiso-denegado'

export type ResultadoCopiaImagenWhatsApp =
  | { estado: 'copiada' }
  | { estado: 'fallback'; motivo: MotivoCopiaImagenWhatsApp; mensaje: string }

type ClipboardEscritor = {
  write: (items: ClipboardItem[]) => Promise<void>
}

type Bitmap = {
  width: number
  height: number
  close?: () => void
}

type Canvas = {
  width: number
  height: number
  getContext: (contextId: '2d') => CanvasRenderingContext2D | null
  toBlob: (callback: BlobCallback, type?: string) => void
}

export type DependenciasCopiaImagenWhatsApp = {
  clipboard?: ClipboardEscritor
  ClipboardItem?: typeof ClipboardItem
  crearBitmap?: (imagen: Blob) => Promise<Bitmap>
  crearCanvas?: () => Canvas
}

function resultadoFallback(
  motivo: MotivoCopiaImagenWhatsApp,
  mensaje: string
): ResultadoCopiaImagenWhatsApp {
  return { estado: 'fallback', motivo, mensaje }
}

function esImagenRaster(archivo: File): boolean {
  return archivo.type.startsWith('image/')
}

function blobDeCanvas(canvas: Canvas): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

class ErrorConversionCaptura extends Error {}

function prepararPng(
  archivo: File,
  crearBitmap: (imagen: Blob) => Promise<Bitmap>,
  crearCanvas: () => Canvas
): Promise<Blob> {
  return (async () => {
    let bitmap: Bitmap | undefined
    try {
      bitmap = await crearBitmap(archivo)
      const canvas = crearCanvas()
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const contexto = canvas.getContext('2d')
      if (!contexto) throw new ErrorConversionCaptura('No hay contexto 2D para convertir la imagen.')
      contexto.drawImage(bitmap as CanvasImageSource, 0, 0)
      const convertido = await blobDeCanvas(canvas)
      if (!convertido) throw new ErrorConversionCaptura('No se pudo crear el PNG de la captura.')
      return convertido
    } catch (error) {
      throw error instanceof ErrorConversionCaptura
        ? error
        : new ErrorConversionCaptura('No se pudo convertir la captura.')
    } finally {
      bitmap?.close?.()
    }
  })()
}

/**
 * Copia una captura como imagen para pegarla en WhatsApp Web. No copia texto:
 * el texto viaja en la URL de WhatsApp, por lo que Ctrl+V queda reservado a la
 * imagen. Se ejecuta al clic de guardar para conservar la activación del usuario.
 */
export async function copiarCapturaWhatsApp(
  archivo: File | undefined,
  dependencias: DependenciasCopiaImagenWhatsApp = {}
): Promise<ResultadoCopiaImagenWhatsApp> {
  if (!archivo) {
    return resultadoFallback('sin-archivo', 'No hay comprobante para copiar como imagen.')
  }
  if (!esImagenRaster(archivo)) {
    return resultadoFallback(
      'archivo-no-imagen',
      'El comprobante es un PDF u otro archivo; WhatsApp no puede pegarlo como imagen automáticamente.'
    )
  }

  const clipboard = dependencias.clipboard ?? (typeof navigator !== 'undefined' ? navigator.clipboard : undefined)
  const ConstructorClipboardItem =
    dependencias.ClipboardItem ?? (typeof ClipboardItem !== 'undefined' ? ClipboardItem : undefined)
  if (!clipboard || !ConstructorClipboardItem) {
    return resultadoFallback(
      'api-no-disponible',
      'Este navegador no permite copiar imágenes al portapapeles. Adjunta el comprobante manualmente.'
    )
  }

  let imagenPng: Blob | Promise<Blob>
  if (archivo.type === 'image/png') {
    imagenPng = archivo
  } else {
    const crearBitmap =
      dependencias.crearBitmap ??
      (typeof createImageBitmap === 'function' ? createImageBitmap : undefined)
    const crearCanvas =
      dependencias.crearCanvas ??
      (typeof document !== 'undefined'
        ? () => document.createElement('canvas')
        : undefined)
    if (!crearBitmap || !crearCanvas) {
      return resultadoFallback(
        'conversion-no-disponible',
        'Este navegador no pudo preparar la captura para pegarla como imagen. Adjunta el comprobante manualmente.'
      )
    }

    imagenPng = prepararPng(archivo, crearBitmap, crearCanvas)
  }

  try {
    // ClipboardItem acepta una Promise<Blob>: invocamos write dentro del clic
    // original y dejamos que el navegador espere la conversión, sin perder la
    // activación transitoria en Safari y navegadores igualmente estrictos.
    await clipboard.write([new ConstructorClipboardItem({ 'image/png': imagenPng })])
    return { estado: 'copiada' }
  } catch (error) {
    if (error instanceof ErrorConversionCaptura) {
      console.warn('[copiarCapturaWhatsApp] No se pudo convertir la captura:', error)
      return resultadoFallback(
        'conversion-fallida',
        'No se pudo preparar la captura como imagen. Adjunta el comprobante manualmente.'
      )
    }
    console.warn('[copiarCapturaWhatsApp] No se pudo escribir la imagen al portapapeles:', error)
    return resultadoFallback(
      'permiso-denegado',
      'El navegador bloqueó el portapapeles. Adjunta el comprobante manualmente.'
    )
  }
}
