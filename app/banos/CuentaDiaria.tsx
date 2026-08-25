'use client'

import { useState, useMemo } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import { Search, Printer, FileSpreadsheet, Calendar } from 'lucide-react'
import { fechaHoyLocal } from '@/lib/format'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  descargarExcelEnNavegador,
  generarBufferExcelFormal,
  type ColumnaExcelConfig,
} from '@/lib/excel-export-base'
import { toast } from 'sonner'

function formatearMesLegible(mesStr: string): string {
  if (!mesStr) return ''
  const [yyyy, mm] = mesStr.split('-').map(Number)
  if (!yyyy || !mm) return mesStr
  const fecha = new Date(yyyy, mm - 1, 1)
  return fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export default function CuentaDiaria() {
  const [mes, setMes] = useState(() => fechaHoyLocal().slice(0, 7)) // YYYY-MM
  const [busqueda, setBusqueda] = useState('')
  const [exportandoExcel, setExportandoExcel] = useState(false)

  const { registros, loading, error, fetchRegistros } = useBanos(mes)

  // Calcular la tabla pivot
  const pivot = useMemo(() => {
    // 1. Obtener lista única de fechas en el mes (ordenadas descendente)
    const fechasSet = new Set<string>()
    // 2. Obtener lista única de operadores
    const opsSet = new Set<string>()

    registros.forEach((r) => {
      fechasSet.add(r.fecha)
      opsSet.add(r.operador)
    })

    const fechas = Array.from(fechasSet).sort((a, b) => b.localeCompare(a))
    const operadores = Array.from(opsSet).sort()

    // 3. Matriz de conteos: conteos[fecha][operador] = número
    const conteos: Record<string, Record<string, number>> = {}

    fechas.forEach((f) => {
      conteos[f] = {}
      operadores.forEach((op) => {
        conteos[f][op] = 0
      })
    })

    registros.forEach((r) => {
      if (conteos[r.fecha] && conteos[r.fecha][r.operador] !== undefined) {
        conteos[r.fecha][r.operador]++
      }
    })

    return { fechas, operadores, conteos }
  }, [registros])

  const operadoresFiltrados = pivot.operadores.filter((op) =>
    op.toLowerCase().includes(busqueda.toLowerCase())
  )

  const handleImprimir = () => {
    const tituloOriginal = document.title
    document.title = `Cuenta_Diaria_Banos_${mes}`
    window.print()
    document.title = tituloOriginal
  }

  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const columnas: ColumnaExcelConfig[] = [
        { header: 'Fecha', width: 14, align: 'center' },
        ...operadoresFiltrados.map((op) => ({
          header: op,
          width: 14,
          align: 'center' as const,
          numFmt: '#,##0',
        })),
      ]

      const filas = pivot.fechas.map((f) => [
        f,
        ...operadoresFiltrados.map((op) => pivot.conteos[f][op]),
      ])

      const buffer = await generarBufferExcelFormal({
        nombreHoja: `Matriz ${mes}`,
        titulo: 'Matriz Diaria de Visitas al Baño por Operador',
        subtitulo: `Periodo: ${mes}`,
        metadatos: `${pivot.fechas.length} días  ·  ${operadoresFiltrados.length} operadores`,
        columnas,
        filas,
        orientacion: 'landscape',
      })

      descargarExcelEnNavegador(buffer, `Cuenta_Diaria_Banos_${mes}.xlsx`)
      toast.success('Matriz de cuenta diaria exportada a Excel')
    } catch (err) {
      console.error('Error exportando matriz diaria a Excel:', err)
      toast.error('No se pudo exportar la matriz a Excel')
    } finally {
      setExportandoExcel(false)
    }
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 rounded-xl text-sm space-y-2">
        <p>{error}</p>
        <button
          onClick={fetchRegistros}
          className="font-semibold underline hover:no-underline cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="reporte-formal-print space-y-6 print:space-y-4">
      {/* ── Encabezado Formal para Impresión PDF ── */}
      <div className="mb-3 hidden print:flex print:items-center print:justify-between print:bg-[#111111] print:px-4 print:py-3 print:text-white print:rounded-none">
        <div>
          <p className="text-[12px] font-extrabold uppercase tracking-widest print:text-white">
            SMV Maquinados S.A. de C.V.
          </p>
          <p className="mt-0.5 text-[8.5px] tracking-wide print:text-gray-300">
            Matriz de Frecuencia de Uso de Baño por Operador
          </p>
        </div>
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-wide print:text-white">
            Cuenta Diaria de Baños
          </p>
          <p className="mt-0.5 text-[9px] capitalize print:text-gray-200">
            Periodo: {formatearMesLegible(mes)}
          </p>
        </div>
        <div className="text-right text-[8px] leading-tight print:text-gray-300">
          <p>{operadoresFiltrados.length} operadores · {pivot.fechas.length} días</p>
          <p>Emitido el {new Date().toLocaleDateString('es-MX')}</p>
        </div>
      </div>

      {/* ── Controles en Pantalla ── */}
      <ModuleSurface className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border bg-card px-3 py-1.5 shadow-2xs">
            <Calendar className="size-4 mr-2 text-primary" />
            <label className="text-xs font-semibold text-muted-foreground mr-2">Mes:</label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="text-xs sm:text-sm font-bold bg-transparent text-foreground border-0 focus:outline-none cursor-pointer"
            />
          </div>
          <span className="text-xs text-muted-foreground capitalize hidden md:inline">
            {formatearMesLegible(mes)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar operador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-input bg-card text-foreground rounded-xl focus:outline-none focus:border-primary"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportarExcel}
            disabled={exportandoExcel || operadoresFiltrados.length === 0 || pivot.fechas.length === 0}
            className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Excel</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleImprimir}
            disabled={operadoresFiltrados.length === 0 || pivot.fechas.length === 0}
            className="h-8 px-3.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-xs"
          >
            <Printer className="size-3.5" />
            <span>Guardar PDF</span>
          </Button>
        </div>
      </ModuleSurface>

      {loading ? (
        <div className="animate-pulse h-64 bg-muted rounded-xl"></div>
      ) : pivot.fechas.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground space-y-2">
          <p className="text-sm font-semibold">No hay registros en {formatearMesLegible(mes)}</p>
          <p className="text-xs text-muted-foreground">Selecciona otro mes para ver la matriz de conteos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <ModuleSurface className="overflow-x-auto print:border-black print:rounded-none">
            <Table className="w-full text-xs text-center print:text-[8px]">
              <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border print:bg-[#111111] print:text-white">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left sticky left-0 bg-muted border-r border-border z-10 whitespace-nowrap print:bg-[#111111] print:text-white print:border-black">
                    Fecha
                  </TableHead>
                  {operadoresFiltrados.map((op) => (
                    <TableHead
                      key={op}
                      className="px-3 py-3 text-center whitespace-nowrap border-l border-border font-bold print:border-black print:text-white"
                    >
                      <div className="w-16 truncate mx-auto" title={op}>
                        {op.split(' ')[0]}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border print:divide-gray-300">
                {pivot.fechas.map((fecha) => (
                  <TableRow key={fecha} className="hover:bg-muted/50 print:hover:bg-transparent">
                    <TableCell className="px-4 py-2 font-bold text-foreground text-left sticky left-0 bg-card border-r border-border whitespace-nowrap print:bg-white print:text-black print:border-black">
                      {fecha}
                    </TableCell>
                    {operadoresFiltrados.map((op) => {
                      const count = pivot.conteos[fecha][op]
                      return (
                        <TableCell key={op} className="px-3 py-2 border-l border-border print:border-black print:p-1">
                          <span
                            className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-mono print:text-[8px] print:w-4 print:h-4 ${
                              count === 0
                                ? 'text-muted-foreground/30 print:text-gray-300'
                                : count > 2
                                ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-extrabold print:text-black print:bg-transparent print:border print:border-black'
                                : count === 2
                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold print:text-black'
                                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium print:text-black'
                            }`}
                          >
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

          {/* ── Pie de Firmas Formales en Impresión PDF ── */}
          <div className="mt-14 hidden items-end justify-around pt-6 print:flex">
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Personal de Almacén / Responsable
              </p>
              <p className="text-[9px] text-muted-foreground print:text-gray-700">Matriz de Frecuencia de Turnos</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Supervisión / Recursos Humanos
              </p>
              <p className="text-[9px] text-muted-foreground print:text-gray-700">Revisión y Control de Taller</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
