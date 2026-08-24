import { useState, useMemo } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import { Clock, Search, Download } from 'lucide-react'
import { fechaHoyLocal } from '@/lib/format'
import ModuleSurface from '@/components/layout/ModuleSurface'
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
      <ModuleSurface className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">Mes a consultar:</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-1.5 text-sm border border-input bg-card text-foreground rounded-md focus:outline-none focus:border-primary"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar operador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-input bg-card text-foreground rounded-md focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={exportarCSV}
            disabled={resumenFiltrado.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-card border border-border text-foreground rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
            title="Exportar a CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </ModuleSurface>

      {!loading && resumenFiltrado.length > 0 && (
        <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium w-fit ml-auto">
          <Clock className="h-4 w-4" />
          Total filtrado: {formatearHorasMinutos(granTotalMinutos)}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse h-64 bg-muted rounded-lg"></div>
      ) : resumen.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/50 border border-border rounded-lg border-dashed">
          No hay tiempos registrados en este mes
        </div>
      ) : (
        <ModuleSurface>
          <Table className="w-full text-sm text-left">
            <TableHeader className="bg-muted text-muted-foreground font-medium border-b border-border">
              <TableRow>
                <TableHead className="px-6 py-4">Operador</TableHead>
                <TableHead className="px-6 py-4 text-right w-48">Total Minutos</TableHead>
                <TableHead className="px-6 py-4 text-right w-48">Horas y Minutos</TableHead>
                <TableHead className="px-6 py-4 w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {resumenFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No se encontraron resultados para la búsqueda
                  </TableCell>
                </TableRow>
              ) : (
                resumenFiltrado.map((item, index) => (
                  <TableRow key={item.operador} className="hover:bg-muted transition-colors">
                    <TableCell className="px-6 py-3 font-medium text-foreground flex items-center gap-3">
                      <span className="w-6 text-xs text-muted-foreground text-right">{index + 1}.</span>
                      {item.operador}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right font-medium text-primary">
                      {item.minutos} m
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right text-muted-foreground font-mono tracking-tight">
                      {item.formatoHoras}
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      {/* Visual bar relative to the max */}
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
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
        </ModuleSurface>
      )}
    </div>
  )
}
