'use client'

import { useState, useMemo } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import { useOperadores } from '@/lib/hooks/useOperadores'
import {
  calcularEstadisticasMensuales,
  generarExcelResumenMensual,
} from '@/lib/banos-export'
import { descargarExcelEnNavegador } from '@/lib/excel-export-base'
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
  Clock,
  Search,
  Printer,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'

const AREA_COLORS: Record<string, string> = {
  taller: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  diseno: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  automatizacion: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cnc: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  limpieza: 'bg-muted text-muted-foreground',
  administracion: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
}

function getInitials(name: string) {
  return name
    .trim()
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

function formatearMesLegible(mesStr: string): string {
  if (!mesStr) return ''
  const [yyyy, mm] = mesStr.split('-').map(Number)
  if (!yyyy || !mm) return mesStr
  const fecha = new Date(yyyy, mm - 1, 1)
  return fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export default function ResumenMensual() {
  const [mes, setMes] = useState(() => fechaHoyLocal().slice(0, 7)) // YYYY-MM
  const [busqueda, setBusqueda] = useState('')
  const [exportandoExcel, setExportandoExcel] = useState(false)

  const { registros, loading, error, fetchRegistros } = useBanos(mes)
  const { activos: operadoresActivos } = useOperadores()

  const stats = useMemo(() => {
    return calcularEstadisticasMensuales(registros, mes)
  }, [registros, mes])

  const resumenFiltrado = useMemo(() => {
    return stats.operadores.filter((item) =>
      item.operador.toLowerCase().includes(busqueda.toLowerCase())
    )
  }, [stats.operadores, busqueda])

  const maxMinutos = stats.operadores[0]?.totalMinutos || 1

  const handleImprimir = () => {
    const tituloOriginal = document.title
    document.title = `Resumen_Mensual_Banos_${mes}`
    window.print()
    document.title = tituloOriginal
  }

  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const buffer = await generarExcelResumenMensual(stats)
      descargarExcelEnNavegador(buffer, `Resumen_Mensual_Banos_${mes}.xlsx`)
      toast.success('Resumen mensual exportado a Excel')
    } catch (err) {
      console.error('Error exportando resumen a Excel:', err)
      toast.error('No se pudo exportar el resumen a Excel')
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
    <div className="reporte-formal-print space-y-6 print:space-y-4 max-w-5xl mx-auto">
      {/* ── Encabezado Formal para Impresión PDF ── */}
      <div className="mb-3 hidden print:flex print:items-center print:justify-between print:bg-[#111111] print:px-4 print:py-3 print:text-white print:rounded-none">
        <div>
          <p className="text-[12px] font-extrabold uppercase tracking-widest print:text-white">
            SMV Maquinados S.A. de C.V.
          </p>
          <p className="mt-0.5 text-[8.5px] tracking-wide print:text-gray-300">
            Control de Tiempos e Incidencias en Baño · Turno y Taller
          </p>
        </div>
        <div className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-wide print:text-white">
            Resumen Mensual de Control de Baños
          </p>
          <p className="mt-0.5 text-[9px] capitalize print:text-gray-200">
            Periodo: {formatearMesLegible(mes)}
          </p>
        </div>
        <div className="text-right text-[8px] leading-tight print:text-gray-300">
          <p>{stats.operadoresDistintos} operadores · {stats.totalVisitas} visitas</p>
          <p>Emitido el {new Date().toLocaleDateString('es-MX')}</p>
        </div>
      </div>

      {/* ── Barra de Controles en Pantalla ── */}
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
            disabled={exportandoExcel || stats.operadores.length === 0}
            className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Excel</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleImprimir}
            disabled={stats.operadores.length === 0}
            className="h-8 px-3.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-xs"
          >
            <Printer className="size-3.5" />
            <span>Guardar PDF</span>
          </Button>
        </div>
      </ModuleSurface>

      {/* ── KPIs Mensuales ── */}
      {!loading && stats.operadores.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4 print:gap-2">
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs print:border-black print:p-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-[8px] print:text-black">
              Total de Visitas
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="text-2xl font-extrabold text-foreground print:text-base print:text-black">
                {stats.totalVisitas}
              </p>
              <span className="text-xs text-muted-foreground print:text-[8px] print:text-black font-medium">
                {stats.operadoresDistintos} oper.
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs print:border-black print:p-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-[8px] print:text-black">
              Tiempo Total Acumulado
            </p>
            <p className="mt-1 text-2xl font-extrabold text-primary print:text-base print:text-black">
              {stats.formatoHorasTotal}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs print:border-black print:p-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-[8px] print:text-black">
              Promedio / Visita
            </p>
            <p className="mt-1 text-2xl font-extrabold text-foreground print:text-base print:text-black">
              {stats.promedioMinutosPorVisita}{' '}
              <span className="text-xs font-normal text-muted-foreground print:text-[8px] print:text-black">
                min
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs print:border-black print:p-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-[8px] print:text-black">
              Mayor Permanencia
            </p>
            <p className="mt-1 text-sm font-bold text-foreground truncate print:text-[9px] print:text-black">
              {stats.operadores[0]
                ? `${stats.operadores[0].operador} (${stats.operadores[0].totalMinutos}m)`
                : '—'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse h-64 bg-muted rounded-xl"></div>
      ) : stats.operadores.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground space-y-2">
          <Clock className="size-10 mx-auto opacity-40 text-muted-foreground" />
          <p className="text-sm font-semibold">
            No hay tiempos registrados en {formatearMesLegible(mes)}
          </p>
          <p className="text-xs text-muted-foreground">
            Selecciona otro mes en el selector para consultar el histórico.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ModuleSurface className="overflow-hidden print:border-black print:rounded-none">
            <Table className="w-full text-xs sm:text-sm text-left print:text-[8.5px]">
              <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border print:bg-[#111111] print:text-white">
                <TableRow>
                  <TableHead className="px-4 py-3 w-12 print:px-1.5 print:py-1 print:text-white print:font-bold">#</TableHead>
                  <TableHead className="px-4 py-3 print:px-1.5 print:py-1 print:text-white print:font-bold">Operador</TableHead>
                  <TableHead className="px-4 py-3 text-center w-24 print:px-1.5 print:py-1 print:text-white print:font-bold">Visitas</TableHead>
                  <TableHead className="px-4 py-3 text-center w-24 print:px-1.5 print:py-1 print:text-white print:font-bold">Días</TableHead>
                  <TableHead className="px-4 py-3 text-right w-28 print:px-1.5 print:py-1 print:text-white print:font-bold">Total Min</TableHead>
                  <TableHead className="px-4 py-3 text-right w-28 print:px-1.5 print:py-1 print:text-white print:font-bold">Horas : Min</TableHead>
                  <TableHead className="px-4 py-3 text-right w-28 print:px-1.5 print:py-1 print:text-white print:font-bold">Prom / Visita</TableHead>
                  <TableHead className="px-4 py-3 w-32 print:hidden" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border print:divide-gray-300">
                {resumenFiltrado.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                      No se encontraron resultados para la búsqueda
                    </TableCell>
                  </TableRow>
                ) : (
                  resumenFiltrado.map((item, index) => {
                    const opCatalogo = operadoresActivos.find((o) => o.nombre === item.operador)
                    return (
                      <TableRow
                        key={item.operador}
                        className="hover:bg-muted/50 transition-colors print:hover:bg-transparent"
                      >
                        <TableCell className="px-4 py-2.5 text-muted-foreground font-mono print:px-1.5 print:py-0.5 print:text-black">
                          {index + 1}.
                        </TableCell>
                        <TableCell className="px-4 py-2.5 font-bold text-foreground print:px-1.5 print:py-0.5 print:text-black">
                          <div className="flex items-center gap-2">
                            <div
                              className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 print:hidden ${
                                AREA_COLORS[opCatalogo?.area || 'taller'] || 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {getInitials(item.operador)}
                            </div>
                            <span>{item.operador}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-center font-bold text-foreground print:px-1.5 print:py-0.5 print:text-black">
                          {item.totalVisitas}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-center text-muted-foreground print:px-1.5 print:py-0.5 print:text-black">
                          {item.diasConVisita}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right font-extrabold text-primary font-mono print:px-1.5 print:py-0.5 print:text-black">
                          {item.totalMinutos} m
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right text-muted-foreground font-mono tracking-tight print:px-1.5 print:py-0.5 print:text-black">
                          {item.formatoHoras}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right text-muted-foreground font-mono print:px-1.5 print:py-0.5 print:text-black">
                          {item.promedioMinutosPorVisita} min
                        </TableCell>
                        <TableCell className="px-4 py-2.5 print:hidden">
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full opacity-70"
                              style={{
                                width: `${Math.max(
                                  3,
                                  (item.totalMinutos / maxMinutos) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </ModuleSurface>

          {/* ── Pie de Firmas Formales en Impresión PDF ── */}
          <div className="mt-14 hidden items-end justify-around pt-6 print:flex">
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Personal de Almacén / Registro
              </p>
              <p className="text-[9px] text-muted-foreground print:text-gray-700">Consolidado Mensual de Incidencias</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Supervisión / Recursos Humanos
              </p>
              <p className="text-[9px] text-muted-foreground print:text-gray-700">Validación y Aprobación Mensual</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
