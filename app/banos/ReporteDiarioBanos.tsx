'use client'

import { useState, useMemo } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import { useOperadores } from '@/lib/hooks/useOperadores'
import {
  calcularEstadisticasDiarias,
  generarTextoResumenDiario,
  generarExcelReporteDiario,
  formatearHorasMinutos,
} from '@/lib/banos-export'
import { descargarExcelEnNavegador } from '@/lib/excel-export-base'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Copy,
  Clock,
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

function formatearFechaLegible(fechaStr: string): string {
  if (!fechaStr) return ''
  const [yyyy, mm, dd] = fechaStr.split('-').map(Number)
  if (!yyyy || !mm || !dd) return fechaStr
  const fecha = new Date(yyyy, mm - 1, dd)
  return fecha.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function sumarDias(fechaStr: string, dias: number): string {
  const [yyyy, mm, dd] = fechaStr.split('-').map(Number)
  const fecha = new Date(yyyy, mm - 1, dd)
  fecha.setDate(fecha.getDate() + dias)
  const nY = fecha.getFullYear()
  const nM = String(fecha.getMonth() + 1).padStart(2, '0')
  const nD = String(fecha.getDate()).padStart(2, '0')
  return `${nY}-${nM}-${nD}`
}

export default function ReporteDiarioBanos() {
  const [fecha, setFecha] = useState(() => fechaHoyLocal())
  const mesFiltro = fecha.slice(0, 7)
  const hoy = fechaHoyLocal()

  const { registros, loading, error, fetchRegistros } = useBanos(mesFiltro)
  const { activos: operadoresActivos } = useOperadores()
  const [exportandoExcel, setExportandoExcel] = useState(false)

  // Estadísticas del día
  const stats = useMemo(() => {
    return calcularEstadisticasDiarias(registros, fecha)
  }, [registros, fecha])

  const maxMinutos = stats.porOperador[0]?.tiempoTotalMinutos || 1

  function irHoy() {
    setFecha(hoy)
  }

  function irAyer() {
    setFecha(sumarDias(hoy, -1))
  }

  function irDiaAnterior() {
    setFecha(sumarDias(fecha, -1))
  }

  function irDiaSiguiente() {
    setFecha(sumarDias(fecha, 1))
  }

  const handleImprimir = () => {
    const tituloOriginal = document.title
    document.title = `Reporte_Diario_Banos_${fecha}`
    window.print()
    document.title = tituloOriginal
  }

  const handleCopiarWhatsApp = async () => {
    const texto = generarTextoResumenDiario(stats)
    await copiarAlPortapapeles(
      texto,
      'Resumen de reporte diario copiado para WhatsApp',
      'Listo para pegar en WhatsApp o correo'
    )
  }

  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const buffer = await generarExcelReporteDiario(stats)
      descargarExcelEnNavegador(buffer, `Reporte_Diario_Banos_${fecha}.xlsx`)
      toast.success('Reporte diario exportado a Excel')
    } catch (err) {
      console.error('Error exportando reporte diario a Excel:', err)
      toast.error('No se pudo exportar el reporte a Excel')
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
      {/* ── Encabezado Formal para Impresión (PDF) ── */}
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
            Reporte Diario de Control de Baños
          </p>
          <p className="mt-0.5 text-[9px] capitalize print:text-gray-200">
            {formatearFechaLegible(fecha)}
          </p>
        </div>
        <div className="text-right text-[8px] leading-tight print:text-gray-300">
          <p>Responsable: Personal de Almacén</p>
          <p>Emitido el {new Date().toLocaleDateString('es-MX')} {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {/* ── Barra de Controles y Selector de Fecha (Pantalla) ── */}
      <ModuleSurface className="p-4 sm:p-5 space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Navegador de Fecha */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-border bg-card p-1 shadow-2xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={irDiaAnterior}
                className="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                title="Día anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="relative flex items-center px-2">
                <Calendar className="size-4 mr-2 text-primary" />
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="text-xs sm:text-sm font-bold bg-transparent text-foreground border-0 focus:outline-none cursor-pointer"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={irDiaSiguiente}
                className="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                title="Día siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={irHoy}
                className={`h-8 px-2.5 text-xs font-semibold rounded-xl cursor-pointer ${
                  fecha === hoy ? 'border-primary text-primary bg-primary/10' : ''
                }`}
              >
                Hoy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={irAyer}
                className="h-8 px-2.5 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Ayer
              </Button>
            </div>

            <span className="text-xs text-muted-foreground capitalize hidden lg:inline ml-2">
              {formatearFechaLegible(fecha)}
            </span>
          </div>

          {/* Acciones de Exportación */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopiarWhatsApp}
              disabled={stats.totalVisitas === 0}
              className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer flex-1 sm:flex-none"
              title="Copiar texto formateado para WhatsApp / Chat"
            >
              <Copy className="size-3.5" />
              <span>Copiar WhatsApp</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportarExcel}
              disabled={exportandoExcel || stats.totalVisitas === 0}
              className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Excel</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleImprimir}
              disabled={stats.totalVisitas === 0}
              className="h-8 px-3.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-xs flex-1 sm:flex-none"
            >
              <Printer className="size-3.5" />
              <span>Guardar PDF</span>
            </Button>
          </div>
        </div>
      </ModuleSurface>

      {/* ── KPIs Ejecutivos del Día ── */}
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
              {stats.operadoresDistintos} operadores
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs print:border-black print:p-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-[8px] print:text-black">
            Tiempo Total
          </p>
          <p className="mt-1 text-2xl font-extrabold text-primary print:text-base print:text-black">
            {formatearHorasMinutos(stats.tiempoTotalMinutos)}
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

        <div className={`rounded-xl border p-3.5 shadow-2xs print:border-black print:p-2 ${
          stats.visitasProlongadas > 0
            ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
            : 'border-border bg-card'
        }`}>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider print:text-[8px] print:text-black">
            Visitas Prolongadas
          </p>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-2xl font-extrabold print:text-base print:text-black">
              {stats.visitasProlongadas}
            </p>
            {stats.visitasProlongadas > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 print:text-[7px] print:bg-transparent print:border print:border-black">
                ≥ 15 min
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-64 bg-muted rounded-xl" />
      ) : stats.totalVisitas === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground space-y-3">
          <Clock className="size-10 mx-auto opacity-40 text-muted-foreground" />
          <p className="text-sm font-semibold">
            No se encontraron registros de baño para el {formatearFechaLegible(fecha)}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Puedes cambiar la fecha con el selector arriba o volver al día de hoy para registrar nuevas entradas.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={irHoy}
            className="text-xs font-bold rounded-xl cursor-pointer"
          >
            Ir a fecha de hoy
          </Button>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-3">
          {/* ── Distribución por Ubicación de Baño ── */}
          <div className="flex flex-wrap items-center gap-2 print:gap-1.5">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1 print:text-[8px] print:text-black">
              Uso por Baño:
            </span>
            {stats.porBano.map((b) => (
              <div
                key={b.bano}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card text-xs font-medium print:border-black print:px-2 print:py-0.5 print:text-[8px] print:text-black"
              >
                <span className="font-bold text-foreground print:text-black">{b.bano}:</span>
                <span>{b.visitas} {b.visitas === 1 ? 'visita' : 'visitas'}</span>
                {b.tiempoTotalMinutos > 0 && (
                  <span className="text-muted-foreground print:text-gray-700">
                    ({b.tiempoTotalMinutos}m)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ── Tabla de Resumen por Operador ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground print:text-[9px] print:text-black">
                1. Resumen Acumulado por Operador
              </h3>
              <span className="text-xs text-muted-foreground print:hidden">
                Ordenado por mayor tiempo
              </span>
            </div>

            <ModuleSurface className="overflow-hidden print:border-black print:rounded-none">
              <Table className="w-full text-xs print:text-[8.5px]">
                <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border print:bg-[#111111] print:text-white">
                  <TableRow>
                    <TableHead className="px-4 py-2.5 w-12 print:px-1.5 print:py-1 print:text-white print:font-bold">#</TableHead>
                    <TableHead className="px-4 py-2.5 print:px-1.5 print:py-1 print:text-white print:font-bold">Operador</TableHead>
                    <TableHead className="px-4 py-2.5 text-center w-20 print:px-1.5 print:py-1 print:text-white print:font-bold">Visitas</TableHead>
                    <TableHead className="px-4 py-2.5 text-right w-24 print:px-1.5 print:py-1 print:text-white print:font-bold">Total Min</TableHead>
                    <TableHead className="px-4 py-2.5 text-right w-24 print:px-1.5 print:py-1 print:text-white print:font-bold">Promedio</TableHead>
                    <TableHead className="px-4 py-2.5 print:px-1.5 print:py-1 print:text-white print:font-bold">Horarios de Visitas</TableHead>
                    <TableHead className="px-4 py-2.5 w-28 print:hidden" />
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border print:divide-gray-300">
                  {stats.porOperador.map((op, idx) => {
                    const opCatalogo = operadoresActivos.find((o) => o.nombre === op.operador)
                    return (
                      <TableRow key={op.operador} className="hover:bg-muted/50 print:hover:bg-transparent">
                        <TableCell className="px-4 py-2 text-muted-foreground font-mono print:px-1.5 print:py-0.5 print:text-black">
                          {idx + 1}.
                        </TableCell>
                        <TableCell className="px-4 py-2 font-bold text-foreground print:px-1.5 print:py-0.5 print:text-black">
                          <div className="flex items-center gap-2">
                            <div className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 print:hidden ${
                              AREA_COLORS[opCatalogo?.area || 'taller'] || 'bg-muted text-muted-foreground'
                            }`}>
                              {getInitials(op.operador)}
                            </div>
                            <span>{op.operador}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center font-bold text-foreground print:px-1.5 print:py-0.5 print:text-black">
                          {op.visitas}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-extrabold text-primary font-mono print:px-1.5 print:py-0.5 print:text-black">
                          {op.tiempoTotalMinutos} min
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right text-muted-foreground font-mono print:px-1.5 print:py-0.5 print:text-black">
                          {op.tiempoPromedioMinutos} min
                        </TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground text-[11px] print:px-1.5 print:py-0.5 print:text-[8px] print:text-gray-800">
                          <div className="flex flex-wrap gap-1">
                            {op.visitasDetalle.map((v, vIdx) => (
                              <span
                                key={vIdx}
                                className={`inline-block px-1.5 py-0.5 rounded border text-[10px] print:text-[7.5px] font-mono ${
                                  v.minutos && v.minutos >= 15
                                    ? 'border-red-300 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-bold'
                                    : 'border-border bg-card text-foreground'
                                }`}
                              >
                                {v.horaEntrada}-{v.horaLlegada || 'En curso'} ({v.minutos !== null ? `${v.minutos}m` : '—'}) · {v.bano}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 print:hidden">
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full opacity-70"
                              style={{
                                width: `${Math.max(
                                  4,
                                  (op.tiempoTotalMinutos / maxMinutos) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ModuleSurface>
          </div>

          {/* ── Bitácora Cronológica Completa del Día ── */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground print:text-[9px] print:text-black">
                2. Registro Cronológico Detallado de Entradas y Salidas
              </h3>
              <span className="text-xs text-muted-foreground print:hidden">
                {stats.registros.length} movimientos
              </span>
            </div>

            <ModuleSurface className="overflow-hidden print:border-black print:rounded-none">
              <Table className="w-full text-xs print:text-[8.5px]">
                <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border print:bg-[#111111] print:text-white">
                  <TableRow>
                    <TableHead className="px-4 py-2 w-10 print:px-1.5 print:py-1 print:text-white print:font-bold">#</TableHead>
                    <TableHead className="px-4 py-2 print:px-1.5 print:py-1 print:text-white print:font-bold">Operador</TableHead>
                    <TableHead className="px-4 py-2 print:px-1.5 print:py-1 print:text-white print:font-bold">Baño</TableHead>
                    <TableHead className="px-4 py-2 text-center w-24 print:px-1.5 print:py-1 print:text-white print:font-bold">Entrada</TableHead>
                    <TableHead className="px-4 py-2 text-center w-24 print:px-1.5 print:py-1 print:text-white print:font-bold">Salida / Llegó</TableHead>
                    <TableHead className="px-4 py-2 text-right w-24 print:px-1.5 print:py-1 print:text-white print:font-bold">Duración</TableHead>
                    <TableHead className="px-4 py-2 text-center w-28 print:px-1.5 print:py-1 print:text-white print:font-bold">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border print:divide-gray-300">
                  {stats.registros.map((r, idx) => {
                    const esProlongado = typeof r.tiempoMinutos === 'number' && r.tiempoMinutos >= 15
                    const esEnCurso = !r.horaLlegada

                    return (
                      <TableRow key={r.id} className="hover:bg-muted/50 print:hover:bg-transparent">
                        <TableCell className="px-4 py-2 text-muted-foreground font-mono print:px-1.5 print:py-0.5 print:text-black">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="px-4 py-2 font-medium text-foreground print:px-1.5 print:py-0.5 print:text-black">
                          {r.operador}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground print:px-1.5 print:py-0.5 print:text-black">
                          {r.bano}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center font-mono font-medium text-foreground print:px-1.5 print:py-0.5 print:text-black">
                          {r.horaEntrada}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center font-mono text-muted-foreground print:px-1.5 print:py-0.5 print:text-black">
                          {r.horaLlegada || '—'}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono font-bold print:px-1.5 print:py-0.5 print:text-black">
                          {r.tiempoMinutos !== null ? (
                            <span className={esProlongado ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-foreground'}>
                              {r.tiempoMinutos} min
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">En curso</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center print:px-1.5 print:py-0.5">
                          {esEnCurso ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 print:text-black print:border print:border-black">
                              En baño
                            </span>
                          ) : esProlongado ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 print:text-black print:border print:border-black">
                              ≥ 15 min
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 print:text-black">
                              Normal
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ModuleSurface>
          </div>

          {/* ── Pie de Firmas Formales en Impresión PDF ── */}
          <div className="mt-14 hidden items-end justify-around pt-6 print:flex">
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Entregó / Personal de Almacén
              </p>
              <p className="text-[9px] text-muted-foreground print:text-gray-700">Control y Registro de Incidencias</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
              <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Recibió / Supervisión RH
              </p>
              <p className="text-[9px] text-muted-foreground print:text-gray-700">Revisión y Autorización de Turno</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
