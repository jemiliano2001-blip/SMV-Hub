import { useState, useMemo } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import { Clock, Search, Download } from 'lucide-react'
import { fechaHoyLocal } from '@/lib/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatearHorasMinutos(minutosTotales: number): string {
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  return `${horas}:${minutos.toString().padStart(2, '0')}:00`
}

export default function ResumenMensual() {
  const [mes, setMes] = useState(() => fechaHoyLocal().slice(0, 7)) // YYYY-MM
  
  const { registros, loading, error } = useBanos(mes)

  const resumen = useMemo(() => {
    const totales = new Map<string, number>()
    
    registros.forEach(r => {
      // Solo contamos registros completados (que tienen tiempoMinutos calculado)
      if (typeof r.tiempoMinutos === 'number') {
        const actual = totales.get(r.operador) || 0
        totales.set(r.operador, actual + r.tiempoMinutos)
      }
    })

    return Array.from(totales.entries())
      .map(([operador, minutos]) => ({
        operador,
        minutos,
        formatoHoras: formatearHorasMinutos(minutos)
      }))
      .sort((a, b) => b.minutos - a.minutos) // Mayor tiempo primero
  }, [registros])

  const [busqueda, setBusqueda] = useState('')

  if (error) {
    return <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">{error}</div>
  }

  const resumenFiltrado = resumen.filter(item => 
    item.operador.toLowerCase().includes(busqueda.toLowerCase())
  )

  const granTotalMinutos = resumenFiltrado.reduce((sum, item) => sum + item.minutos, 0)

  const exportarCSV = () => {
    const encabezados = ['Operador', 'Total Minutos', 'Horas y Minutos']
    const filas = resumenFiltrado.map(r => [r.operador, r.minutos, r.formatoHoras])
    const csvContent = [encabezados, ...filas].map(e => e.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `resumen_banos_${mes}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Controles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Mes a consultar:</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar operador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={exportarCSV}
            disabled={resumenFiltrado.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Exportar a CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {!loading && resumenFiltrado.length > 0 && (
        <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium w-fit ml-auto">
          <Clock className="h-4 w-4" />
          Total filtrado: {formatearHorasMinutos(granTotalMinutos)}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>
      ) : resumen.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg border-dashed">
          No hay tiempos registrados en este mes
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <Table className="w-full text-sm text-left">
            <TableHeader className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <TableRow>
                <TableHead className="px-6 py-4">Operador</TableHead>
                <TableHead className="px-6 py-4 text-right w-48">Total Minutos</TableHead>
                <TableHead className="px-6 py-4 text-right w-48">Horas y Minutos</TableHead>
                <TableHead className="px-6 py-4 w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {resumenFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron resultados para la búsqueda
                  </TableCell>
                </TableRow>
              ) : (
                resumenFiltrado.map((item, index) => (
                  <TableRow key={item.operador} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="px-6 py-3 font-medium text-gray-900 flex items-center gap-3">
                      <span className="w-6 text-xs text-gray-400 text-right">{index + 1}.</span>
                      {item.operador}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right font-medium text-primary">
                      {item.minutos} m
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right text-gray-600 font-mono tracking-tight">
                      {item.formatoHoras}
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      {/* Visual bar relative to the max */}
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full opacity-70"
                          style={{ width: `${Math.max(2, (item.minutos / resumen[0].minutos) * 100)}%` }}
                        ></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
