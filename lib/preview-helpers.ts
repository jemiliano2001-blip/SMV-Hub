/**
 * Utilidades para detección de tipos de archivos, formateo y visualización previa
 */

export type TipoArchivoPreview =
  | 'image'
  | 'pdf'
  | 'csv'
  | 'xml'
  | 'text'
  | 'spreadsheet'
  | 'generic'

export interface ArchivoPreviewMetadata {
  url: string
  nombre?: string
  tipo?: TipoArchivoPreview | 'auto'
  mimeType?: string
  titulo?: string
  subtitulo?: string
  detallesExtra?: Record<string, string | number | undefined>
  onDownload?: () => void | Promise<void>
}

/**
 * Detecta el tipo de archivo basándose en URL, nombre de archivo o MIME type.
 */
export function detectarTipoArchivo(
  urlOrNombre: string,
  mimeType?: string
): TipoArchivoPreview {
  const mime = mimeType?.toLowerCase() || ''
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'text/csv' || mime.includes('csv')) return 'csv'
  if (mime === 'text/xml' || mime === 'application/xml') return 'xml'
  if (mime.startsWith('text/')) return 'text'
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('vnd.ms-excel') ||
    mime.includes('openxmlformats-officedocument.spreadsheetml')
  ) {
    return 'spreadsheet'
  }

  // Si es un data URL
  if (urlOrNombre.startsWith('data:image/')) return 'image'
  if (urlOrNombre.startsWith('data:application/pdf')) return 'pdf'
  if (urlOrNombre.startsWith('data:text/xml')) return 'xml'
  if (urlOrNombre.startsWith('data:text/csv')) return 'csv'

  // Limpiar URL de parámetros query o hash
  const urlLimpia = urlOrNombre.split('?')[0].split('#')[0].toLowerCase()

  if (/\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i.test(urlLimpia)) {
    return 'image'
  }
  if (/\.pdf$/i.test(urlLimpia)) {
    return 'pdf'
  }
  if (/\.csv$/i.test(urlLimpia)) {
    return 'csv'
  }
  if (/\.xml$/i.test(urlLimpia)) {
    return 'xml'
  }
  if (/\.(txt|log|md|json|yaml|yml)$/i.test(urlLimpia)) {
    return 'text'
  }
  if (/\.(xlsx|xls)$/i.test(urlLimpia)) {
    return 'spreadsheet'
  }

  return 'generic'
}

/**
 * Obtiene la extensión limpia de un archivo
 */
export function obtenerExtensionArchivo(urlOrNombre: string): string {
  if (!urlOrNombre) return ''
  if (urlOrNombre.startsWith('data:image/jpeg')) return 'jpg'
  if (urlOrNombre.startsWith('data:image/png')) return 'png'
  if (urlOrNombre.startsWith('data:image/webp')) return 'webp'
  if (urlOrNombre.startsWith('data:application/pdf')) return 'pdf'

  const urlLimpia = urlOrNombre.split('?')[0].split('#')[0]
  const partes = urlLimpia.split('.')
  if (partes.length > 1) {
    const ext = partes.pop()?.toLowerCase() || ''
    if (ext.length <= 5) return ext
  }
  return ''
}

/**
 * Obtiene un nombre de archivo legible a partir de una URL o path
 */
export function obtenerNombreArchivo(url: string, nombreSugerido?: string): string {
  if (nombreSugerido && nombreSugerido.trim()) {
    return nombreSugerido.trim()
  }

  if (url.startsWith('data:')) {
    const tipo = detectarTipoArchivo(url)
    return `archivo-preview.${tipo === 'image' ? 'jpg' : tipo === 'pdf' ? 'pdf' : 'dat'}`
  }

  try {
    const urlLimpia = url.split('?')[0].split('#')[0]
    const nombre = urlLimpia.split('/').pop()
    if (nombre && decodeURIComponent(nombre).trim()) {
      return decodeURIComponent(nombre).trim()
    }
  } catch {
    // Si falla decodeURIComponent
  }

  return 'archivo'
}

/**
 * Descarga directamente un archivo desde una URL o Blob en el navegador sin abrir pestañas.
 */
export async function descargarArchivoDesdeUrl(url: string, nombreArchivo?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const nombreFinal = obtenerNombreArchivo(url, nombreArchivo)

  // Si ya es un blob: o data: URL
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const a = document.createElement('a')
    a.href = url
    a.download = nombreFinal
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return
  }

  try {
    // Intentar fetch como blob para forzar descarga segura con nombre
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = blobUrl
    a.download = nombreFinal
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    // Fallback con elemento <a> directo
    const a = document.createElement('a')
    a.href = url
    a.download = nombreFinal
    a.target = '_self'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

/**
 * Parsea contenido CSV plano para previsualización tabular rápida.
 */
export function parsearCsvSimple(textoCsv: string): { cabeceras: string[]; filas: string[][] } {
  if (!textoCsv || !textoCsv.trim()) {
    return { cabeceras: [], filas: [] }
  }

  const lineas = textoCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lineas.length === 0) return { cabeceras: [], filas: [] }

  const parsearLinea = (linea: string): string[] => {
    const resultado: string[] = []
    let actual = ''
    let enComillas = false

    for (let i = 0; i < linea.length; i++) {
      const char = linea[i]
      if (char === '"') {
        enComillas = !enComillas
      } else if ((char === ',' || char === ';') && !enComillas) {
        resultado.push(actual.trim().replace(/^"|"$/g, ''))
        actual = ''
      } else {
        actual += char
      }
    }
    resultado.push(actual.trim().replace(/^"|"$/g, ''))
    return resultado
  }

  const cabeceras = parsearLinea(lineas[0])
  const filas = lineas.slice(1, 101).map(parsearLinea) // Límite de 100 filas para preview

  return { cabeceras, filas }
}
