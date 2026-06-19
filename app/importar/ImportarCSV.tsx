'use client'

import { useState, useRef } from 'react'
import {
  UploadCloud,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { procesarCSV, type FilaParseada } from '@/lib/importar'
import PreviewImportacion from './PreviewImportacion'

const cls = {
  section: 'rounded-xl border border-gray-200 bg-white p-6 shadow-xs',
  heading: 'text-base font-semibold text-gray-900 mb-4',
}

export default function ImportarCSV() {
  const [filas, setFilas] = useState<FilaParseada[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [columnasDetectadas, setColumnasDetectadas] = useState<string[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const descargarPlantilla = () => {
    const headers = 'Proveedor,Requisitor,Orden de trabajo,Empresa,Estado del pedido,Fecha del pedido,Cantidad,Descripción,Link,Fecha entrega / Guía,Moneda,Total'
    const ej1 = 'McMaster-Carr,emiliano,OT-2024-001,SMV Maquinados,aprobado,2026-06-18,2,Tornillo M6x20 acero inoxidable,https://www.mcmaster.com,2026-06-25,USD,12.50'
    const ej2 = 'Amazon,emiliano,OT-2024-002,SilTech,pendiente,2026-06-18,1,Sensor de temperatura,https://www.amazon.com,,USD,45.00'
    const blob = new Blob([[headers, ej1, ej2].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-compras.csv'
    a.click()
    URL.revokeObjectURL(url)
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0])
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Por favor, selecciona un archivo con extensión .csv')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) {
        setError('El archivo está vacío o no se pudo leer')
        return
      }
      try {
        const resultado = procesarCSV(text)
        if (resultado.error) {
          setError(resultado.error)
        } else {
          setColumnasDetectadas(resultado.columnasDetectadas)
          setFilas(resultado.filas.map(f => ({ ...f, seleccionada: f.errores.length === 0 })))
        }
      } catch (err) {
        console.error('Error al procesar el archivo CSV:', err)
        setError('Ocurrió un error inesperado al procesar el archivo. Verifica el formato.')
      }
    }
    reader.readAsText(file)
  }

  const reiniciar = () => {
    setFilas(null)
    setError(null)
    setColumnasDetectadas(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (filas) {
    return (
      <PreviewImportacion
        filasIniciales={filas}
        onReiniciar={reiniciar}
        // @ts-expect-error - prop added in Task 5
        columnasDetectadas={columnasDetectadas ?? undefined}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className={cls.section}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Cargar archivo CSV</h2>
          <button
            onClick={descargarPlantilla}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
            Descargar plantilla
          </button>
        </div>
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
              Haz clic para seleccionar o arrastra un archivo CSV
            </span>
            <span className="text-xs text-gray-400">
              Exporta tu Google Sheet como CSV y súbelo aquí
            </span>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="sr-only" />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Error al cargar archivo</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}
      </section>

      <section className={cls.section}>
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-blue-500" />
          Columnas reconocidas en el CSV
        </h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          El importador detecta las columnas automáticamente desde la primera fila (header). Puedes usar estos nombres:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
            <span className="text-xs font-bold text-gray-700 block mb-1.5">Obligatorias (fila en rojo si falta):</span>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li><strong>Proveedor</strong></li>
              <li><strong>Requisitor</strong></li>
              <li><strong>Orden de trabajo</strong></li>
              <li><strong>Empresa</strong></li>
            </ul>
          </div>
          <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
            <span className="text-xs font-bold text-gray-700 block mb-1.5">Opcionales:</span>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li><strong>Estado del pedido</strong> (aprobado, pendiente, rechazado)</li>
              <li><strong>Fecha del pedido</strong></li>
              <li><strong>Cantidad</strong></li>
              <li><strong>Descripción</strong></li>
              <li><strong>Link</strong></li>
              <li><strong>Fecha entrega / Guía</strong></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
