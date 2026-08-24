import { useState, useMemo } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import { Search, Download } from 'lucide-react'
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

export default function CuentaDiaria() {
  const [mes, setMes] = useState(() => fechaHoyLocal().slice(0, 7)) // YYYY-MM
  
  const { registros, loading, error, fetchRegistros } = useBanos(mes)

  // Calcular la tabla pivot
  const pivot = useMemo(() => {
    // 1. Obtener lista única de fechas en el mes (ordenadas descendente)
    const fechasSet = new Set<string>()
    // 2. Obtener lista única de operadores
    const opsSet = new Set<string>()
    
    registros.forEach(r => {
      fechasSet.add(r.fecha)
      opsSet.add(r.operador)
    })

    const fechas = Array.from(fechasSet).sort((a, b) => b.localeCompare(a))
    const operadores = Array.from(opsSet).sort()

    // 3. Matriz de conteos: conteos[fecha][operador] = número
    const conteos: Record<string, Record<string, number>> = {}
    
    fechas.forEach(f => {
      conteos[f] = {}
      operadores.forEach(op => {
        conteos[f][op] = 0
      })
    })

    registros.forEach(r => {
      if (conteos[r.fecha] && conteos[r.fecha][r.operador] !== undefined) {
        conteos[r.fecha][r.operador]++
      }
    })

    return { fechas, operadores, conteos }
  }, [registros])

  const [busqueda, setBusqueda] = useState('')

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg text-sm space-y-2">
        <p>{error}</p>
        <button onClick={fetchRegistros} className="font-semibold underline hover:no-underline">Reintentar</button>
      </div>
    )
  }

  const operadoresFiltrados = pivot.operadores.filter(op =>
    op.toLowerCase().includes(busqueda.toLowerCase())
  )

  const exportarCSV = () => {
    const encabezados = ['Fecha', ...operadoresFiltrados]
    const filas = pivot.fechas.map(f => {
      return [f, ...operadoresFiltrados.map(op => pivot.conteos[f][op])]
    })
    const csvContent = [encabezados, ...filas].map(e => e.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `cuenta_diaria_banos_${mes}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
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
            disabled={operadoresFiltrados.length === 0 || pivot.fechas.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-card border border-border text-foreground rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
            title="Exportar a CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </ModuleSurface>

      {loading ? (
        <div className="animate-pulse h-64 bg-muted rounded-lg"></div>
      ) : pivot.fechas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/50 border border-border rounded-lg border-dashed">
          No hay registros en este mes
        </div>
      ) : (
        <ModuleSurface className="overflow-x-auto">
          <Table className="w-full text-sm text-center">
            <TableHeader className="bg-muted text-muted-foreground font-medium border-b border-border">
              <TableRow>
                <TableHead className="px-4 py-3 text-left sticky left-0 bg-muted border-r border-border z-10 whitespace-nowrap">
                  Fecha
                </TableHead>
                {operadoresFiltrados.map(op => (
                  <TableHead key={op} className="px-3 py-3 text-center whitespace-nowrap border-l border-border font-medium">
                    <div className="w-16 truncate mx-auto" title={op}>{op.split(' ')[0]}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {pivot.fechas.map(fecha => (
                <TableRow key={fecha} className="hover:bg-muted">
                  <TableCell className="px-4 py-2 font-medium text-foreground text-left sticky left-0 bg-card border-r border-border whitespace-nowrap">
                    {fecha}
                  </TableCell>
                  {operadoresFiltrados.map(op => {
                    const count = pivot.conteos[fecha][op]
                    return (
                      <TableCell key={op} className="px-3 py-2 border-l border-border">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs ${
                          count === 0 ? 'text-muted-foreground/40' :
                          count > 2 ? 'bg-red-100 text-red-700 font-bold' :
                          count === 2 ? 'bg-amber-100 text-amber-700 font-medium' :
                          'bg-blue-50 text-blue-700 font-medium'
                        }`}>
                          {count}
                        </span>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ModuleSurface>
      )}
    </div>
  )
}
