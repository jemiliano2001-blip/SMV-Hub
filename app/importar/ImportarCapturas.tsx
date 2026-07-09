'use client'

import { useState, useRef, useEffect } from 'react'
import {
  UploadCloud,
  AlertCircle,
  Loader2,
  ImageIcon,
  X,
} from 'lucide-react'
import { getClienteAuth } from '@/lib/firebase'
import { mapearExtraccion, type FilaParseada } from '@/lib/importar'
import type { ExtraccionInvoice } from '@/lib/schemas'
import PreviewImportacion from './PreviewImportacion'

const cls = {
  section: 'rounded-xl border border-gray-200 bg-white p-6 shadow-xs',
  heading: 'text-base font-semibold text-gray-900 mb-4',
}

export default function ImportarCapturas() {
  const [archivos, setArchivos] = useState<File[]>([])
  const [objectUrls, setObjectUrls] = useState<string[]>([])

  // Revoca todas las object URLs al desmontar el componente para evitar memory leaks
  useEffect(() => {
    return () => {
      objectUrls.forEach(u => { if (u) URL.revokeObjectURL(u) })
    }
  }, [objectUrls])

  const [filas, setFilas] = useState<FilaParseada[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [altaCalidad, setAltaCalidad] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const agregarArchivos = (lista: FileList) => {
    const imgs = Array.from(lista).filter(f => f.type.startsWith('image/'))
    if (imgs.length === 0) {
      setError('Selecciona archivos de imagen (jpeg, png, gif o webp)')
      return
    }
    setError(null)
    const nuevosUrls = imgs.map(f => {
      try { return URL.createObjectURL(f) } catch { return '' }
    })
    setArchivos(prev => [...prev, ...imgs])
    setObjectUrls(prev => [...prev, ...nuevosUrls])
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.length) agregarArchivos(e.dataTransfer.files)
  }

  const quitarArchivo = (i: number) => {
    if (objectUrls[i]) URL.revokeObjectURL(objectUrls[i])
    setArchivos(prev => prev.filter((_, idx) => idx !== i))
    setObjectUrls(prev => prev.filter((_, idx) => idx !== i))
  }

  const extraer = async () => {
    if (archivos.length === 0) return
    setProcesando(true)
    setError(null)
    try {
      const token = await getClienteAuth().currentUser?.getIdToken()
      if (!token) {
        setError('Inicia sesión para extraer datos de las capturas')
        return
      }

      const form = new FormData()
      archivos.forEach(f => form.append('imagenes', f))
      if (altaCalidad) form.append('calidad', 'alta')

      const res = await fetch('/api/extraer-lote', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Error al procesar las imágenes')
      }
      const { extracciones } = (await res.json()) as { extracciones: ExtraccionInvoice[] }
      if (!extracciones || extracciones.length === 0) {
        setError('No se detectaron compras en las imágenes')
        return
      }
      setFilas(extracciones.map((e, i) => mapearExtraccion(e, i)))
    } catch (err) {
      console.error('Error extrayendo capturas:', err)
      setError(err instanceof Error ? err.message : 'Error inesperado al procesar las imágenes')
    } finally {
      setProcesando(false)
    }
  }

  const reiniciar = () => {
    objectUrls.forEach(url => { if (url) URL.revokeObjectURL(url) })
    setArchivos([])
    setObjectUrls([])
    setFilas(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (filas) {
    return <PreviewImportacion filasIniciales={filas} onReiniciar={reiniciar} />
  }

  return (
    <div className="space-y-6">
      <section className={cls.section}>
        <h2 className={cls.heading}>Cargar capturas o fotos de facturas</h2>
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all duration-200 ${
            dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50/30'
          }`}
        >
          <UploadCloud className={`h-12 w-12 transition-colors duration-250 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
          <div className="text-center">
            <span className="text-sm font-semibold text-gray-700 block mb-1">
              Haz clic para seleccionar o arrastra varias imágenes
            </span>
            <span className="text-xs text-gray-400">
              Facturas sueltas o pantallazos de una tabla con varias compras
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && agregarArchivos(e.target.files)}
            className="sr-only"
          />
        </div>

        {archivos.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold text-gray-600">{archivos.length} imagen(es) seleccionada(s):</span>
            <ul className="space-y-1.5">
              {archivos.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-3 truncate text-gray-700">
                    {objectUrls[i] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={objectUrls[i]}
                        alt=""
                        className="h-10 w-10 rounded object-cover shrink-0 border border-gray-200"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-gray-300 shrink-0" />
                    )}
                    <span className="truncate text-sm">{f.name}</span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); quitarArchivo(i) }}
                    className="text-gray-400 hover:text-red-600 transition-colors shrink-0"
                    title="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            <label className="flex items-center gap-2 pt-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={altaCalidad}
                onChange={(e) => setAltaCalidad(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Alta precisión para tablas densas (más lento y costoso)
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={reiniciar}
                disabled={procesando}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={extraer}
                disabled={procesando}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {procesando && <Loader2 className="h-4 w-4 animate-spin" />}
                {procesando ? 'Extrayendo con IA…' : 'Extraer datos'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}
      </section>

      <section className={cls.section}>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Cómo funciona</h3>
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal pl-4 leading-relaxed">
          <li>Sube una o varias imágenes (cada factura suelta crea una orden; cada pantallazo de tabla crea una orden por fila detectada).</li>
          <li>La IA extrae proveedor, montos, fechas e ítems de cada compra.</li>
          <li>En el preview completa Requisitor, Orden de trabajo y Empresa con &quot;Aplicar a todas&quot;.</li>
          <li>Revisa, deselecciona lo que no quieras e importa. Las facturas duplicadas (mismo proveedor y número) se detectan y deseleccionan solas.</li>
        </ol>
      </section>
    </div>
  )
}
