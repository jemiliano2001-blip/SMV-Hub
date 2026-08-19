'use client'

import { useState, useRef } from 'react'
import {
  UploadCloud,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Copy,
} from 'lucide-react'
import {
  procesarCSVCotizaciones,
  verificarDuplicadosCotizacion,
  importarCotizaciones,
  type FilaCotizacion,
} from '@/lib/cotizaciones-importar'
import { clavesExistentes } from '@/lib/cotizaciones'
import { formatPrecio } from '@/lib/format'
import ModuleSurface from '@/components/layout/ModuleSurface'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const cls = {
  section: 'rounded-xl border border-gray-200 bg-white p-6 shadow-xs',
}

export default function ImportarCotizaciones() {
  const [filas, setFilas] = useState<FilaCotizacion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [duplicados, setDuplicados] = useState<Set<number>>(new Set())
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)
  const [resultado, setResultado] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const descargarPlantilla = () => {
    const headers =
      'Columna 1,Fecha,Estatus,Ubicación,Proveedor,Descripcion,No. de parte,Cantidad,Precio en dolares,Precio Unit mx,Total,Dias habiles,Link,Notas'
    const ej1 =
      'Francisco,19/06/2026,Cotizado,USA,Tri-City Tool Parts,E110576 Seal Husky C304H,E110576,1,14.24,,,3 - 5 dias,https://tricitytoolparts.com,Compresor Husky'
    const ej2 =
      'Edgar,07/05/2026,Cotizado,MX,Higoh,Sensor fotoelectrico M18,BOS00JZ,1,,2340,,3 dias habiles,,'
    const blob = new Blob([[headers, ej1, ej2].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-cotizaciones.csv'
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
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Por favor selecciona un archivo con extensión .csv')
      return
    }
    setError(null)
    setResultado(null)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (!text) {
        setError('El archivo está vacío o no se pudo leer')
        return
      }
      try {
        const res = procesarCSVCotizaciones(text)
        if (res.error) {
          setError(res.error)
          return
        }
        // Marca duplicados contra lo ya guardado y los deselecciona por defecto.
        let dupSet = new Set<number>()
        try {
          const claves = await clavesExistentes()
          const dups = verificarDuplicadosCotizacion(res.filas, claves)
          dupSet = new Set(dups.map((d) => d.indice))
        } catch (err) {
          console.error('No se pudieron verificar duplicados:', err)
        }
        setDuplicados(dupSet)
        setFilas(
          res.filas.map((f) => ({
            ...f,
            seleccionada: f.errores.length === 0 && !dupSet.has(f.indice),
          }))
        )
      } catch (err) {
        console.error('Error al procesar el CSV:', err)
        setError('Ocurrió un error al procesar el archivo. Verifica el formato.')
      }
    }
    reader.readAsText(file)
  }

  const toggleFila = (indice: number) => {
    setFilas((prev) =>
      prev
        ? prev.map((f) => (f.indice === indice ? { ...f, seleccionada: !f.seleccionada } : f))
        : prev
    )
  }

  const reiniciar = () => {
    setFilas(null)
    setError(null)
    setDuplicados(new Set())
    setProgreso(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const importar = async () => {
    if (!filas) return
    setImportando(true)
    setProgreso({ hechas: 0, total: 0 })
    try {
      const { importadas } = await importarCotizaciones(filas, (hechas, total) =>
        setProgreso({ hechas, total })
      )
      setResultado(importadas)
      setFilas(null)
      setDuplicados(new Set())
    } catch (err) {
      console.error('Error importando cotizaciones:', err)
      setError('No se pudieron importar las cotizaciones. Intenta de nuevo.')
    } finally {
      setImportando(false)
      setProgreso(null)
    }
  }

  // ── Resultado de importación ────────────────────────────────────────────────
  if (resultado !== null) {
    return (
      <div className={cls.section}>
        <div className="flex flex-col items-center text-center py-8">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-bold text-gray-900">Importación completada</h3>
          <p className="text-sm text-gray-500 mt-1">
            Se importaron <strong>{resultado}</strong> cotizaciones a la base de datos.
          </p>
          <button
            onClick={reiniciar}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Importar otro archivo
          </button>
        </div>
      </div>
    )
  }

  // ── Preview ─────────────────────────────────────────────────────────────────
  if (filas) {
    const seleccionadas = filas.filter((f) => f.seleccionada).length
    const conError = filas.filter((f) => f.errores.length > 0).length
    return (
      <div className="space-y-4">
        <div className={cls.section}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Vista previa</h3>
              <p className="text-xs text-gray-500 mt-1">
                {filas.length} filas · {seleccionadas} seleccionadas
                {conError > 0 && ` · ${conError} con error`}
                {duplicados.size > 0 && ` · ${duplicados.size} duplicadas (deseleccionadas)`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={reiniciar}
                disabled={importando}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={importar}
                disabled={importando || seleccionadas === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {importando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progreso ? `Importando ${progreso.hechas}/${progreso.total}…` : 'Importando…'}
                  </>
                ) : (
                  `Importar ${seleccionadas} cotizaciones`
                )}
              </button>
            </div>
          </div>
        </div>

        <ModuleSurface>
          <div className="max-h-[60vh]">
            <Table className="text-sm text-left text-muted-foreground">
              <TableHeader className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200 sticky top-0">
                <TableRow>
                  <TableHead className="px-3 py-3 w-10"></TableHead>
                  <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Fecha</TableHead>
                  <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Proveedor</TableHead>
                  <TableHead className="px-3 py-3 font-semibold">Descripción</TableHead>
                  <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">No. parte</TableHead>
                  <TableHead className="px-3 py-3 font-semibold text-center">Ubic.</TableHead>
                  <TableHead className="px-3 py-3 font-semibold text-center">Cant.</TableHead>
                  <TableHead className="px-3 py-3 font-semibold text-right whitespace-nowrap">P. Unit.</TableHead>
                  <TableHead className="px-3 py-3 font-semibold">Notas / estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {filas.map((f) => {
                  const conErr = f.errores.length > 0
                  const dup = duplicados.has(f.indice)
                  return (
                    <TableRow key={f.indice} className={conErr ? 'bg-red-50/40' : dup ? 'bg-yellow-50/40' : ''}>
                      <TableCell className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={f.seleccionada}
                          disabled={conErr}
                          onChange={() => toggleFila(f.indice)}
                          className="rounded border-gray-300 text-primary focus:ring-ring cursor-pointer disabled:opacity-40"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5 whitespace-nowrap">{f.datos.fecha ?? '-'}</TableCell>
                      <TableCell className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{f.datos.proveedor || '—'}</TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-900 min-w-[200px]">{f.datos.descripcion || '—'}</TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{f.datos.numeroParte ?? '-'}</TableCell>
                      <TableCell className="px-3 py-2.5 text-center">{f.datos.ubicacion === 'USA' ? 'EUA' : 'MX'}</TableCell>
                      <TableCell className="px-3 py-2.5 text-center">{f.datos.cantidad ?? '-'}</TableCell>
                      <TableCell className="px-3 py-2.5 text-right whitespace-nowrap">{formatPrecio(f.datos.precioUnitario, f.datos.moneda)}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        {conErr && <span className="text-xs text-red-600 font-medium">{f.errores.join(', ')}</span>}
                        {!conErr && dup && <span className="text-xs text-yellow-700 font-medium">Ya existe (duplicada)</span>}
                        {!conErr && !dup && f.advertencias.length > 0 && (
                          <span className="text-xs text-gray-400">{f.advertencias.join(', ')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </ModuleSurface>
      </div>
    )
  }

  // ── Carga de archivo ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <section className={cls.section}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Importar desde Google Sheets</h2>
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
          <UploadCloud className={`h-12 w-12 transition-colors ${dragActive ? 'text-primary' : 'text-gray-400'}`} />
          <div className="text-center">
            <span className="text-sm font-semibold text-gray-700 block mb-1">
              Haz clic para seleccionar o arrastra un archivo CSV
            </span>
            <span className="text-xs text-gray-400">
              En Google Sheets: Archivo → Descargar → CSV, y súbelo aquí
            </span>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="sr-only" />
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
          <Copy className="h-4 w-4 text-blue-500" />
          Columnas que reconoce el importador
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
            <span className="text-xs font-bold text-gray-700 block mb-1.5">Obligatorias (fila en rojo si falta):</span>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li><strong>Proveedor</strong></li>
              <li><strong>Descripcion</strong></li>
            </ul>
          </div>
          <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
            <span className="text-xs font-bold text-gray-700 block mb-1.5">Opcionales:</span>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li><strong>Columna 1</strong> (solicitante), <strong>Fecha</strong>, <strong>Estatus</strong></li>
              <li><strong>Ubicación</strong> (MX / USA), <strong>No. de parte</strong>, <strong>Cantidad</strong></li>
              <li><strong>Precio en dolares</strong>, <strong>Precio Unit mx</strong> (según ubicación)</li>
              <li><strong>Dias habiles</strong>, <strong>Link</strong>, <strong>Notas</strong></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
