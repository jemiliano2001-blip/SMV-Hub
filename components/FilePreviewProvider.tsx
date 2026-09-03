'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  X,
  Download,
  Printer,
  Copy,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Loader2,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  type ArchivoPreviewMetadata,
  type TipoArchivoPreview,
  detectarTipoArchivo,
  obtenerExtensionArchivo,
  obtenerNombreArchivo,
  descargarArchivoDesdeUrl,
  parsearCsvSimple,
} from '@/lib/preview-helpers'

interface FilePreviewContextValue {
  previewFile: (archivo: ArchivoPreviewMetadata, lista?: ArchivoPreviewMetadata[], indice?: number) => void
  previewList: (lista: ArchivoPreviewMetadata[], indiceInicial?: number) => void
  closePreview: () => void
  isOpen: boolean
  archivoActivo: ArchivoPreviewMetadata | null
  irSiguiente: () => void
  irAnterior: () => void
  hasPrev: boolean
  hasNext: boolean
  indiceActivo: number
  totalArchivos: number
}

const FilePreviewContext = createContext<FilePreviewContextValue | null>(null)

export function FilePreviewProvider({ children }: { children: ReactNode }) {
  const [archivoActivo, setArchivoActivo] = useState<ArchivoPreviewMetadata | null>(null)
  const [colaArchivos, setColaArchivos] = useState<ArchivoPreviewMetadata[]>([])
  const [indiceActivo, setIndiceActivo] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rotacion, setRotacion] = useState(0)
  const [posicion, setPosicion] = useState({ x: 0, y: 0 })
  const [arrastrando, setArrastrando] = useState(false)
  const [puntoInicio, setPuntoInicio] = useState({ x: 0, y: 0 })
  const [copiado, setCopiado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Estado para CSV y texto
  const [contenidoTexto, setContenidoTexto] = useState<string | null>(null)
  const [filtroTabla, setFiltroTabla] = useState('')

  const imagenRef = useRef<HTMLImageElement | null>(null)

  const aplicarArchivo = useCallback((archivo: ArchivoPreviewMetadata) => {
    setArchivoActivo(archivo)
    setZoom(1)
    setRotacion(0)
    setPosicion({ x: 0, y: 0 })
    setCopiado(false)
    setCargando(true)
    setErrorCarga(null)
    setContenidoTexto(null)
    setFiltroTabla('')
  }, [])

  const previewFile = useCallback(
    (archivo: ArchivoPreviewMetadata, lista?: ArchivoPreviewMetadata[], indice?: number) => {
      if (lista && lista.length > 0) {
        setColaArchivos(lista)
        const idx = indice ?? Math.max(0, lista.findIndex((a) => a.url === archivo.url))
        setIndiceActivo(idx)
        aplicarArchivo(lista[idx] || archivo)
      } else {
        setColaArchivos([archivo])
        setIndiceActivo(0)
        aplicarArchivo(archivo)
      }
    },
    [aplicarArchivo]
  )

  const previewList = useCallback(
    (lista: ArchivoPreviewMetadata[], indiceInicial = 0) => {
      if (!lista || lista.length === 0) return
      const idx = Math.min(Math.max(0, indiceInicial), lista.length - 1)
      setColaArchivos(lista)
      setIndiceActivo(idx)
      aplicarArchivo(lista[idx]!)
    },
    [aplicarArchivo]
  )

  const closePreview = useCallback(() => {
    setArchivoActivo(null)
    setColaArchivos([])
    setIndiceActivo(0)
    setZoom(1)
    setRotacion(0)
    setPosicion({ x: 0, y: 0 })
    setContenidoTexto(null)
  }, [])

  const hasPrev = indiceActivo > 0
  const hasNext = indiceActivo < colaArchivos.length - 1

  const irAnterior = useCallback(() => {
    if (!hasPrev) return
    const nuevoIdx = indiceActivo - 1
    const archivo = colaArchivos[nuevoIdx]
    if (archivo) {
      setIndiceActivo(nuevoIdx)
      aplicarArchivo(archivo)
    }
  }, [hasPrev, indiceActivo, colaArchivos, aplicarArchivo])

  const irSiguiente = useCallback(() => {
    if (!hasNext) return
    const nuevoIdx = indiceActivo + 1
    const archivo = colaArchivos[nuevoIdx]
    if (archivo) {
      setIndiceActivo(nuevoIdx)
      aplicarArchivo(archivo)
    }
  }, [hasNext, indiceActivo, colaArchivos, aplicarArchivo])

  // Tipo resuelto
  const tipoFinal: TipoArchivoPreview = useMemo(() => {
    if (!archivoActivo) return 'generic'
    if (archivoActivo.tipo && archivoActivo.tipo !== 'auto') {
      return archivoActivo.tipo
    }
    return detectarTipoArchivo(
      archivoActivo.url || archivoActivo.nombre || '',
      archivoActivo.mimeType
    )
  }, [archivoActivo])

  const extension = useMemo(() => {
    if (!archivoActivo) return ''
    return (
      obtenerExtensionArchivo(archivoActivo.nombre || archivoActivo.url) ||
      (tipoFinal === 'pdf'
        ? 'pdf'
        : tipoFinal === 'image'
          ? 'img'
          : tipoFinal === 'csv'
            ? 'csv'
            : tipoFinal === 'xml'
              ? 'xml'
              : '')
    ).toUpperCase()
  }, [archivoActivo, tipoFinal])

  const nombreMostrado = useMemo(() => {
    if (!archivoActivo) return ''
    return (
      archivoActivo.titulo ||
      obtenerNombreArchivo(archivoActivo.url, archivoActivo.nombre)
    )
  }, [archivoActivo])

  // Cargar contenido si es CSV o Texto
  useEffect(() => {
    if (!archivoActivo || (tipoFinal !== 'csv' && tipoFinal !== 'xml' && tipoFinal !== 'text')) {
      return
    }

    let cancelado = false
    const cargarTexto = async () => {
      try {
        setCargando(true)
        if (archivoActivo.url.startsWith('data:')) {
          const base64 = archivoActivo.url.split(',')[1]
          if (base64) {
            const dec = atob(base64)
            if (!cancelado) {
              setContenidoTexto(dec)
              setCargando(false)
            }
            return
          }
        }

        const res = await fetch(archivoActivo.url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (!cancelado) {
          setContenidoTexto(text)
          setCargando(false)
        }
      } catch (err) {
        if (!cancelado) {
          console.warn('[FilePreview] Error cargando texto:', err)
          setErrorCarga('No se pudo cargar el texto del archivo.')
          setCargando(false)
        }
      }
    }

    void cargarTexto()
    return () => {
      cancelado = true
    }
  }, [archivoActivo, tipoFinal])

  // Manejo de atajos de teclado
  useEffect(() => {
    if (!archivoActivo) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const esInput = tag === 'input' || tag === 'textarea' || tag === 'select'

      if (e.key === 'Escape') {
        e.preventDefault()
        closePreview()
      } else if ((e.key === ' ' || e.code === 'Space') && !esInput) {
        // QuickLook toggle: cerrar si se presiona espacio estando abierto
        e.preventDefault()
        closePreview()
      } else if (e.key === 'ArrowLeft' && !esInput) {
        if (hasPrev) {
          e.preventDefault()
          irAnterior()
        }
      } else if (e.key === 'ArrowRight' && !esInput) {
        if (hasNext) {
          e.preventDefault()
          irSiguiente()
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setZoom((z) => Math.min(z + 0.25, 4))
      } else if (e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(z - 0.25, 0.5))
      } else if (e.key === '0') {
        e.preventDefault()
        setZoom(1)
        setPosicion({ x: 0, y: 0 })
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        setRotacion((r) => (r + 90) % 360)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [archivoActivo, closePreview, hasPrev, hasNext, irAnterior, irSiguiente])

  // Zoom con rueda de ratón en visor de imagen
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || true) {
      e.preventDefault()
      const delta = e.deltaY * -0.0015
      setZoom((prev) => Math.min(Math.max(prev + delta, 0.5), 4))
    }
  }, [])

  // Arrastre/Pan cuando hay zoom
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setArrastrando(true)
    setPuntoInicio({ x: e.clientX - posicion.x, y: e.clientY - posicion.y })
  }, [posicion])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!arrastrando) return
      setPosicion({
        x: e.clientX - puntoInicio.x,
        y: e.clientY - puntoInicio.y,
      })
    },
    [arrastrando, puntoInicio]
  )

  const handleMouseUp = useCallback(() => {
    setArrastrando(false)
  }, [])

  const handleDescargar = async () => {
    if (!archivoActivo) return
    if (archivoActivo.onDownload) {
      await archivoActivo.onDownload()
      return
    }
    await descargarArchivoDesdeUrl(archivoActivo.url, archivoActivo.nombre || archivoActivo.titulo)
    toast.success('Descarga iniciada')
  }

  const handleCopiarEnlaceOImagen = async () => {
    if (!archivoActivo) return
    try {
      if (tipoFinal === 'image' && imagenRef.current && typeof ClipboardItem !== 'undefined') {
        // Intentar copiar imagen real
        try {
          const res = await fetch(archivoActivo.url)
          const blob = await res.blob()
          const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' })
          await navigator.clipboard.write([
            new ClipboardItem({ [pngBlob.type]: pngBlob }),
          ])
          setCopiado(true)
          toast.success('Imagen copiada al portapapeles', {
            description: 'Puedes pegarla con Ctrl+V en WhatsApp o un editor.',
          })
          setTimeout(() => setCopiado(false), 2000)
          return
        } catch {
          // Fallback a copiar URL si no permite copiar blob directo
        }
      }

      await navigator.clipboard.writeText(archivoActivo.url)
      setCopiado(true)
      toast.success('Enlace copiado al portapapeles')
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  const handleImprimir = () => {
    if (!archivoActivo) return
    if (tipoFinal === 'image') {
      const ventana = window.open('', '_blank')
      if (ventana) {
        ventana.document.write(`
          <html>
            <head><title>${nombreMostrado}</title></head>
            <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;">
              <img src="${archivoActivo.url}" style="max-width:100%;max-height:100%;object-fit:contain;" onload="window.print();window.close();" />
            </body>
          </html>
        `)
        ventana.document.close()
      }
    } else {
      window.print()
    }
  }

  const value = useMemo(
    () => ({
      previewFile,
      previewList,
      closePreview,
      isOpen: Boolean(archivoActivo),
      archivoActivo,
      irSiguiente,
      irAnterior,
      hasPrev,
      hasNext,
      indiceActivo,
      totalArchivos: colaArchivos.length,
    }),
    [
      previewFile,
      previewList,
      closePreview,
      archivoActivo,
      irSiguiente,
      irAnterior,
      hasPrev,
      hasNext,
      indiceActivo,
      colaArchivos.length,
    ]
  )

  const datosCsv = useMemo(() => {
    if (tipoFinal !== 'csv' || !contenidoTexto) return null
    const parseado = parsearCsvSimple(contenidoTexto)
    if (!filtroTabla.trim()) return parseado

    const query = filtroTabla.toLowerCase()
    const filasFiltradas = parseado.filas.filter((fila) =>
      fila.some((celda) => celda.toLowerCase().includes(query))
    )
    return {
      cabeceras: parseado.cabeceras,
      filas: filasFiltradas,
    }
  }, [tipoFinal, contenidoTexto, filtroTabla])

  return (
    <FilePreviewContext.Provider value={value}>
      {children}

      {archivoActivo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={nombreMostrado || 'Vista previa de archivo'}
          className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-md text-white animate-in fade-in duration-200"
        >
          {/* ── BARRA SUPERIOR DE ACCIONES ────────────────────────────────── */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-zinc-950/80 px-4 backdrop-blur-md z-10">
            {/* Información del archivo */}
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                {tipoFinal === 'image' ? (
                  <ImageIcon className="size-4 text-emerald-400" />
                ) : tipoFinal === 'pdf' ? (
                  <FileText className="size-4 text-rose-400" />
                ) : tipoFinal === 'csv' || tipoFinal === 'spreadsheet' ? (
                  <FileSpreadsheet className="size-4 text-emerald-400" />
                ) : tipoFinal === 'xml' ? (
                  <FileCode className="size-4 text-amber-400" />
                ) : (
                  <FileText className="size-4 text-sky-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    className="truncate text-xs sm:text-sm font-bold text-white max-w-[200px] sm:max-w-md"
                    title={nombreMostrado}
                  >
                    {nombreMostrado}
                  </h2>
                  {extension && (
                    <Badge
                      variant="outline"
                      className="border-white/20 bg-white/5 text-[10px] font-mono text-zinc-300 px-1.5 py-0 uppercase"
                    >
                      {extension}
                    </Badge>
                  )}
                </div>
                {archivoActivo.subtitulo && (
                  <p className="truncate text-[11px] text-zinc-400">
                    {archivoActivo.subtitulo}
                  </p>
                )}
              </div>
            </div>

            {/* Controles de Vista y Acciones */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Carrusel secuencial si hay varios archivos */}
              {colaArchivos.length > 1 && (
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 mr-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={irAnterior}
                    disabled={!hasPrev}
                    className="h-7 w-7 p-0 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Archivo anterior (←)"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="min-w-[48px] text-center font-mono text-[11px] font-semibold text-zinc-300 select-none">
                    {indiceActivo + 1} / {colaArchivos.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={irSiguiente}
                    disabled={!hasNext}
                    className="h-7 w-7 p-0 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Siguiente archivo (→)"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
              {tipoFinal === 'image' && (
                <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                    className="h-7 w-7 p-0 text-zinc-300 hover:bg-white/10 hover:text-white"
                    title="Reducir zoom (-)"
                  >
                    <ZoomOut className="size-3.5" />
                  </Button>
                  <span className="min-w-[42px] text-center font-mono text-[11px] font-semibold text-zinc-300">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                    className="h-7 w-7 p-0 text-zinc-300 hover:bg-white/10 hover:text-white"
                    title="Aumentar zoom (+)"
                  >
                    <ZoomIn className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setZoom(1)
                      setPosicion({ x: 0, y: 0 })
                    }}
                    className="h-7 px-1.5 text-[10px] font-mono text-zinc-300 hover:bg-white/10 hover:text-white"
                    title="Ajustar escala (0)"
                  >
                    <Maximize2 className="size-3 mr-1" /> Ajustar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRotacion((r) => (r + 90) % 360)}
                    className="h-7 w-7 p-0 text-zinc-300 hover:bg-white/10 hover:text-white"
                    title="Rotar 90° (R)"
                  >
                    <RotateCw className="size-3.5" />
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopiarEnlaceOImagen}
                className="h-8 px-2 sm:px-2.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white gap-1.5"
                title={tipoFinal === 'image' ? 'Copiar imagen o enlace' : 'Copiar enlace'}
              >
                {copiado ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {copiado ? 'Copiado' : tipoFinal === 'image' ? 'Copiar' : 'Copiar URL'}
                </span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleImprimir}
                className="h-8 px-2 sm:px-2.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white gap-1.5"
                title="Imprimir"
              >
                <Printer className="size-3.5" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleDescargar}
                className="h-8 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-2.5 sm:px-3 gap-1.5"
                title="Descargar archivo"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Descargar</span>
              </Button>

              {/* Botón de fallback para abrir en nueva pestaña solo si el usuario lo desea */}
              {!archivoActivo.url.startsWith('data:') && (
                <a
                  href={archivoActivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
                  title="Abrir en pestaña externa"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closePreview}
                className="h-8 w-8 p-0 rounded-lg text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400"
                title="Cerrar (Esc)"
              >
                <X className="size-4" />
              </Button>
            </div>
          </header>

          {/* ── ÁREA DE CONTENIDO PRINCIPAL ──────────────────────────────── */}
          <main
            className="relative flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none"
            onWheel={tipoFinal === 'image' ? handleWheel : undefined}
            onMouseDown={tipoFinal === 'image' ? handleMouseDown : undefined}
            onMouseMove={tipoFinal === 'image' ? handleMouseMove : undefined}
            onMouseUp={tipoFinal === 'image' ? handleMouseUp : undefined}
          >
            {/* Visualizador de Imágenes */}
            {tipoFinal === 'image' && (
              <div className="relative flex items-center justify-center h-full w-full overflow-hidden">
                {cargando && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-8 animate-spin text-primary" />
                  </div>
                )}
                {errorCarga ? (
                  <div className="text-center p-6 text-zinc-400">
                    <p className="text-sm font-semibold text-rose-400">Error al cargar la imagen</p>
                    <p className="text-xs mt-1">{errorCarga}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDescargar}
                      className="mt-4 border-white/20 text-white"
                    >
                      Descargar archivo
                    </Button>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    ref={imagenRef}
                    src={archivoActivo.url}
                    alt={nombreMostrado}
                    onLoad={() => setCargando(false)}
                    onError={() => {
                      setCargando(false)
                      setErrorCarga('No se pudo visualizar la imagen.')
                    }}
                    style={{
                      transform: `translate(${posicion.x}px, ${posicion.y}px) scale(${zoom}) rotate(${rotacion}deg)`,
                      cursor: zoom > 1 ? (arrastrando ? 'grabbing' : 'grab') : 'default',
                      transition: arrastrando ? 'none' : 'transform 0.15s ease-out',
                    }}
                    className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl pointer-events-auto"
                    draggable={false}
                  />
                )}
              </div>
            )}

            {/* Visualizador de PDF */}
            {tipoFinal === 'pdf' && (
              <div className="h-full w-full max-w-5xl rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-2xl flex flex-col">
                <iframe
                  src={`${archivoActivo.url}#toolbar=1&navpanes=0`}
                  title={nombreMostrado}
                  className="h-full w-full border-0 bg-zinc-900"
                  onLoad={() => setCargando(false)}
                />
              </div>
            )}

            {/* Visualizador de CSV y Tablas */}
            {tipoFinal === 'csv' && (
              <div className="h-full w-full max-w-5xl rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-2xl flex flex-col p-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="size-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-zinc-300">
                      Vista previa de datos ({datosCsv?.filas.length || 0} filas)
                    </span>
                  </div>
                  <div className="relative w-48 sm:w-64">
                    <Search className="absolute left-2.5 top-2 size-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Filtrar filas..."
                      value={filtroTabla}
                      onChange={(e) => setFiltroTabla(e.target.value)}
                      className="h-7.5 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-auto mt-2 select-text font-mono text-xs">
                  {cargando ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  ) : datosCsv && datosCsv.cabeceras.length > 0 ? (
                    <table className="w-full text-left text-zinc-300 border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 sticky top-0">
                          {datosCsv.cabeceras.map((cab, idx) => (
                            <th key={idx} className="p-2 font-bold text-white whitespace-nowrap">
                              {cab}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {datosCsv.filas.map((fila, fIdx) => (
                          <tr key={fIdx} className="hover:bg-white/5">
                            {fila.map((celda, cIdx) => (
                              <td key={cIdx} className="p-2 whitespace-nowrap">
                                {celda}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center text-zinc-500 py-10">No hay filas para mostrar</p>
                  )}
                </div>
              </div>
            )}

            {/* Visualizador de XML / Código / Texto */}
            {(tipoFinal === 'xml' || tipoFinal === 'text') && (
              <div className="h-full w-full max-w-4xl rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-2xl flex flex-col p-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs text-zinc-400">
                  <span>Formato {tipoFinal.toUpperCase()}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (contenidoTexto) {
                        void navigator.clipboard.writeText(contenidoTexto)
                        toast.success('Texto copiado al portapapeles')
                      }
                    }}
                    className="h-6 text-[11px] text-zinc-300"
                  >
                    <Copy className="size-3 mr-1" /> Copiar todo
                  </Button>
                </div>
                <div className="flex-1 overflow-auto mt-2 select-text">
                  {cargando ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <pre className="font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed">
                      {contenidoTexto || 'Sin contenido de texto.'}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Visualizador Genérico */}
            {tipoFinal === 'generic' || tipoFinal === 'spreadsheet' ? (
              <div className="max-w-md w-full rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center shadow-2xl space-y-4">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-zinc-300">
                  {tipoFinal === 'spreadsheet' ? (
                    <FileSpreadsheet className="size-8 text-emerald-400" />
                  ) : (
                    <FileText className="size-8 text-sky-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white truncate" title={nombreMostrado}>
                    {nombreMostrado}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Archivo {extension || 'adjunto'}
                  </p>
                </div>

                {archivoActivo.detallesExtra && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-left font-mono text-xs space-y-1">
                    {Object.entries(archivoActivo.detallesExtra).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-zinc-300">
                        <span className="text-zinc-500 capitalize">{k}:</span>
                        <span className="font-semibold text-white">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={handleDescargar}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold gap-2"
                  >
                    <Download className="size-4" /> Descargar para ver en aplicación
                  </Button>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      )}
    </FilePreviewContext.Provider>
  )
}

export function useFilePreview() {
  const context = useContext(FilePreviewContext)
  if (!context) {
    throw new Error('useFilePreview debe usarse dentro de un FilePreviewProvider')
  }
  return context
}
