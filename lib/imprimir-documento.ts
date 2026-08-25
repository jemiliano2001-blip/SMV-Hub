/**
 * Impresión de documentos (PO, reportes, etiquetas) hacia PDF.
 *
 * Chrome propone `document.title` como nombre del archivo al elegir "Guardar como
 * PDF". Sin ajustarlo, el usuario termina con `localhost_3000_proveedores.pdf` y
 * una carpeta de descargas imposible de ordenar. El título se restaura siempre en
 * `finally`: si la impresión falla, la pestaña no se queda renombrada.
 */

/** Quita los caracteres que Windows y macOS rechazan en un nombre de archivo. */
export function sanitizarNombreArchivo(nombre: string): string {
  const limpio = nombre
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 120)
  return limpio || "Documento"
}

/**
 * Abre el diálogo de impresión nombrando el PDF resultante.
 *
 * @param nombreArchivo Nombre sugerido, sin extensión. Conviene que lleve
 *   contexto (módulo, folio o periodo, moneda) para que el archivo se sostenga
 *   solo fuera de la app.
 */
export function imprimirComoDocumento(nombreArchivo: string): void {
  const tituloOriginal = document.title
  document.title = sanitizarNombreArchivo(nombreArchivo)
  try {
    window.print()
  } finally {
    document.title = tituloOriginal
  }
}
